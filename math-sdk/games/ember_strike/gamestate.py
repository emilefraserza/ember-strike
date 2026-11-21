"""Stake Engine math-sdk full event-book & lookup-table builder for Ember Strike (V4)."""

import argparse
import csv
import json
import random
from collections import deque
from pathlib import Path

from game_config import (
    BET_MODES,
    CLUSTER_PAYTABLE,
    FEATURE_UPGRADE_CHANCE,
    GRID_COLS,
    GRID_ROWS,
    MAX_FREE_SPINS,
    MAX_WIN_MULTIPLIER,
    PAYING_SYMBOLS,
    RANDOM_BUY_WEIGHTS,
    SCATTER,
    SCATTER_PROBS,
    SYMBOL_WEIGHTS,
    WILD,
)

try:
    import zstandard as zstd
except ImportError:
    zstd = None


def to_engine_payout_units(multiplier: float) -> int:
    capped = min(max(0.0, multiplier), float(MAX_WIN_MULTIPLIER))
    return int(round(capped * 100))


def _build_sampler(weight_dict: dict[str, int]):
    symbols = list(weight_dict.keys())
    cum_weights = []
    total = 0
    for w in weight_dict.values():
        total += w
        cum_weights.append(total)
    return symbols, cum_weights, total


SAMPLERS = {k: _build_sampler(v) for k, v in SYMBOL_WEIGHTS.items()}


class EmberStrikeGameState:
    def __init__(self, seed: int | None = None):
        self.rng = random.Random(seed)

    def draw_symbol(self, profile: str) -> str:
        symbols, cum_weights, total = SAMPLERS[profile]
        r = self.rng.randrange(total)
        for sym, cw in zip(symbols, cum_weights):
            if r < cw:
                return sym
        return symbols[-1]

    def roll_scatter_count(self, table_name: str) -> int:
        r = self.rng.random()
        acc = 0.0
        for count, prob in SCATTER_PROBS[table_name]:
            acc += prob
            if r < acc:
                return count
        return 0

    def roll_random_buy_scatters(self) -> int:
        r = self.rng.random()
        acc = 0.0
        for count, prob in RANDOM_BUY_WEIGHTS:
            acc += prob
            if r < acc:
                return count
        return 3

    def get_cluster_base_pay(self, symbol: str, size: int) -> float:
        for min_size, mult in CLUSTER_PAYTABLE[symbol]:
            if size >= min_size:
                return mult
        return 0.0

    @staticmethod
    def upgrade_cell(val: int, cap: int) -> int:
        if val == 0:
            return 1
        if val == 1:
            return 2
        return min(val * 2, cap)

    def create_grid(self, profile: str, scatter_count: int) -> list[list[str]]:
        grid = [[self.draw_symbol(profile) for _ in range(GRID_COLS)] for _ in range(GRID_ROWS)]
        if scatter_count > 0:
            cols = self.rng.sample(range(GRID_COLS), min(scatter_count, GRID_COLS))
            for c in cols:
                r = self.rng.randrange(GRID_ROWS)
                grid[r][c] = SCATTER
        return grid

    @staticmethod
    def find_winning_clusters(grid: list[list[str]]) -> list[tuple[str, list[tuple[int, int]]]]:
        wins = []
        for sym in PAYING_SYMBOLS:
            visited = [[False] * GRID_COLS for _ in range(GRID_ROWS)]
            for r in range(GRID_ROWS):
                for c in range(GRID_COLS):
                    if visited[r][c] or grid[r][c] != sym:
                        continue
                    cluster = []
                    q = deque([(r, c)])
                    visited[r][c] = True
                    while q:
                        cr, cc = q.popleft()
                        cluster.append((cr, cc))
                        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                            nr, nc = cr + dr, cc + dc
                            if 0 <= nr < GRID_ROWS and 0 <= nc < GRID_COLS and not visited[nr][nc]:
                                cell = grid[nr][nc]
                                if cell == sym or cell == WILD:
                                    visited[nr][nc] = True
                                    q.append((nr, nc))
                    if len(cluster) >= 5:
                        wins.append((sym, cluster))
        return wins

    @staticmethod
    def init_bonus_board(tier: int) -> tuple[list[list[int]], int, int, str]:
        embers = [[0] * GRID_COLS for _ in range(GRID_ROWS)]
        if tier == 1:
            return embers, 10, 128, "tier1"
        if tier == 2:
            for r in (2, 3):
                for c in (2, 3):
                    embers[r][c] = 2
            return embers, 10, 128, "tier2"
        if tier == 3:
            for r, c in ((1, 1), (2, 2), (3, 3), (4, 4), (1, 4), (2, 3), (3, 2), (4, 1)):
                embers[r][c] = 4
            return embers, 12, 128, "tier3"
        raise ValueError(f"Unsupported free-spin tier: {tier}")

    @staticmethod
    def apply_tier_upgrade_to_board(embers: list[list[int]], new_tier: int) -> str:
        if new_tier == 2:
            for r in (2, 3):
                for c in (2, 3):
                    embers[r][c] = max(embers[r][c], 2)
            return "tier2"
        if new_tier == 3:
            for r, c in ((1, 1), (2, 2), (3, 3), (4, 4), (1, 4), (2, 3), (3, 2), (4, 1)):
                embers[r][c] = max(embers[r][c], 4)
            return "tier3"
        return "tier3"

    def resolve_spin_events(
        self,
        events: list[dict],
        grid: list[list[str]],
        embers: list[list[int]],
        profile: str,
        tier: int,
        cap: int,
        running_win: float,
    ) -> tuple[float, bool]:
        game_type = "basegame" if tier == 0 else f"freegame_tier_{tier}"
        events.append({
            "index": len(events),
            "type": "reveal",
            "board": [row[:] for row in grid],
            "embers": [row[:] for row in embers],
            "gameType": game_type,
        })

        spin_win = 0.0
        capped = False

        while True:
            clusters = self.find_winning_clusters(grid)
            if not clusters:
                break

            exploded = set()
            wilds = []
            win_entries = []

            for sym, cells in clusters:
                base_pay = self.get_cluster_base_pay(sym, len(cells))
                mult_sum = 0
                for r, c in cells:
                    if embers[r][c] == 1:
                        mult_sum += 2
                    elif embers[r][c] >= 2:
                        mult_sum += embers[r][c]
                    exploded.add((r, c))
                    if grid[r][c] == WILD and (r, c) not in wilds:
                        wilds.append((r, c))

                applied_mult = mult_sum if mult_sum > 0 else 1
                final_pay = base_pay * applied_mult
                spin_win += final_pay
                win_entries.append({
                    "symbol": sym,
                    "kind": len(cells),
                    "win": to_engine_payout_units(final_pay),
                    "multiplier": applied_mult,
                    "positions": [{"reel": c, "row": r} for r, c in cells],
                })

            if running_win + spin_win >= MAX_WIN_MULTIPLIER:
                spin_win = max(0.0, MAX_WIN_MULTIPLIER - running_win)
                capped = True

            for r, c in exploded:
                embers[r][c] = self.upgrade_cell(embers[r][c], cap)

            wild_events = []
            for wr, wc in wilds:
                near_ember = embers[wr][wc] >= 1 or any(
                    0 <= wr + dr < GRID_ROWS and 0 <= wc + dc < GRID_COLS and embers[wr + dr][wc + dc] >= 1
                    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))
                )
                if not near_ember:
                    continue

                if tier in (0, 1):
                    for c in range(GRID_COLS):
                        embers[wr][c] = self.upgrade_cell(embers[wr][c], cap)
                    wild_events.append({"reel": wc, "row": wr, "mode": "row"})
                elif tier == 2:
                    row_heat = sum(embers[wr])
                    col_heat = sum(embers[r][wc] for r in range(GRID_ROWS))
                    if col_heat > row_heat:
                        for r in range(GRID_ROWS):
                            embers[r][wc] = self.upgrade_cell(embers[r][wc], cap)
                        wild_events.append({"reel": wc, "row": wr, "mode": "col"})
                    else:
                        for c in range(GRID_COLS):
                            embers[wr][c] = self.upgrade_cell(embers[wr][c], cap)
                        wild_events.append({"reel": wc, "row": wr, "mode": "row"})
                elif tier == 3:
                    for c in range(GRID_COLS):
                        embers[wr][c] = self.upgrade_cell(embers[wr][c], cap)
                    for r in range(GRID_ROWS):
                        for c in range(GRID_COLS):
                            if embers[r][c] >= 2:
                                embers[r][c] = min(embers[r][c] * 2, cap)
                    wild_events.append({"reel": wc, "row": wr, "mode": "row_and_global_double"})

            events.append({
                "index": len(events),
                "type": "winInfo",
                "totalWin": to_engine_payout_units(spin_win),
                "wins": win_entries,
            })

            if wild_events:
                events.append({
                    "index": len(events),
                    "type": "wildIgnition",
                    "ignitions": wild_events,
                    "embers": [row[:] for row in embers],
                })

            new_symbols_per_col = []
            for c in range(GRID_COLS):
                surviving = [grid[r][c] for r in range(GRID_ROWS) if (r, c) not in exploded]
                missing = GRID_ROWS - len(surviving)
                incoming = [self.draw_symbol(profile) for _ in range(missing)]
                new_symbols_per_col.append(incoming)
                merged = incoming + surviving
                for r in range(GRID_ROWS):
                    grid[r][c] = merged[r]

            events.append({
                "index": len(events),
                "type": "tumbleBoard",
                "explodingSymbols": [{"reel": c, "row": r} for r, c in sorted(exploded)],
                "newSymbols": new_symbols_per_col,
                "embers": [row[:] for row in embers],
            })

            if capped:
                break

        events.append({
            "index": len(events),
            "type": "setWin",
            "amount": to_engine_payout_units(spin_win),
            "winLevel": 1 if spin_win > 0 else 0,
        })
        return spin_win, capped

    def simulate_round_book(self, round_id: int, mode: str) -> dict:
        if mode not in BET_MODES:
            raise ValueError(f"Unknown mode: {mode}")

        events: list[dict] = []
        total_win = 0.0
        capped = False
        bonus_tier = 0
        scatters_landed = 0

        if mode in ("buy_regular", "buy_super", "buy_epic", "buy_random"):
            scatters_landed = {
                "buy_regular": 3,
                "buy_super": 4,
                "buy_epic": 5,
            }.get(mode) or self.roll_random_buy_scatters()

            if scatters_landed == 6:
                total_win = MAX_WIN_MULTIPLIER
                events.append({
                    "index": 0,
                    "type": "instantMaxWin",
                    "scatters": 6,
                    "title": "Watch the World Burn",
                    "amount": to_engine_payout_units(total_win),
                })
                events.append({
                    "index": 1,
                    "type": "finalWin",
                    "amount": to_engine_payout_units(total_win),
                })
                return {
                    "id": round_id,
                    "payoutMultiplier": to_engine_payout_units(total_win),
                    "criteria": "wincap",
                    "events": events,
                }

            bonus_tier = scatters_landed - 2
            events.append({
                "index": 0,
                "type": "buyBonusTrigger",
                "mode": mode,
                "scatters": scatters_landed,
                "tier": bonus_tier,
            })
        else:
            sc_table = "bonus_hunt" if mode == "bonus_hunt" else "base"
            scatters_landed = self.roll_scatter_count(sc_table)
            if scatters_landed == 6:
                total_win = MAX_WIN_MULTIPLIER
                events.append({
                    "index": 0,
                    "type": "instantMaxWin",
                    "scatters": 6,
                    "title": "Watch the World Burn",
                    "amount": to_engine_payout_units(total_win),
                })
                events.append({
                    "index": 1,
                    "type": "finalWin",
                    "amount": to_engine_payout_units(total_win),
                })
                return {
                    "id": round_id,
                    "payoutMultiplier": to_engine_payout_units(total_win),
                    "criteria": "wincap",
                    "events": events,
                }

            grid = self.create_grid("base", scatters_landed)
            embers = [[0] * GRID_COLS for _ in range(GRID_ROWS)]
            added, capped = self.resolve_spin_events(events, grid, embers, "base", 0, 128, total_win)
            total_win += added
            if scatters_landed >= 3 and not capped:
                bonus_tier = scatters_landed - 2

        if bonus_tier > 0 and not capped:
            embers, spins_left, cap, profile = self.init_bonus_board(bonus_tier)
            spins_played = 0
            active_tier = bonus_tier

            events.append({
                "index": len(events),
                "type": "freeSpinTrigger",
                "tier": active_tier,
                "totalFs": spins_left,
                "embers": [row[:] for row in embers],
            })

            while spins_left > 0 and not capped:
                spins_left -= 1
                spins_played += 1

                retrig_scatters = self.roll_scatter_count("retrigger")
                if retrig_scatters >= 3:
                    if self.rng.random() < FEATURE_UPGRADE_CHANCE:
                        if active_tier < 3:
                            active_tier += 1
                            profile = self.apply_tier_upgrade_to_board(embers, active_tier)
                            events.append({
                                "index": len(events),
                                "type": "featureUpgrade",
                                "newTier": active_tier,
                                "embers": [row[:] for row in embers],
                            })
                        else:
                            total_win = MAX_WIN_MULTIPLIER
                            capped = True
                            events.append({
                                "index": len(events),
                                "type": "instantMaxWin",
                                "scatters": 6,
                                "title": "Watch the World Burn",
                                "amount": to_engine_payout_units(total_win),
                            })
                            break

                    if (spins_played + spins_left) < MAX_FREE_SPINS:
                        added_fs = min(5, MAX_FREE_SPINS - (spins_played + spins_left))
                        spins_left += added_fs
                        events.append({
                            "index": len(events),
                            "type": "freeSpinRetrigger",
                            "addedFs": added_fs,
                            "totalFs": spins_played + spins_left,
                        })

                events.append({
                    "index": len(events),
                    "type": "updateFreeSpin",
                    "amount": spins_played,
                    "total": spins_played + spins_left,
                })

                fs_grid = self.create_grid(profile, retrig_scatters)
                added, capped = self.resolve_spin_events(
                    events, fs_grid, embers, profile, active_tier, cap, total_win
                )
                total_win += added

        total_win = min(total_win, MAX_WIN_MULTIPLIER)
        payout_units = to_engine_payout_units(total_win)

        events.append({
            "index": len(events),
            "type": "setTotalWin",
            "amount": payout_units,
        })
        events.append({
            "index": len(events),
            "type": "finalWin",
            "amount": payout_units,
        })

        criteria = (
            "wincap"
            if total_win >= MAX_WIN_MULTIPLIER
            else "freegame"
            if bonus_tier > 0
            else "basegame"
            if total_win > 0
            else "zero"
        )

        return {
            "id": round_id,
            "payoutMultiplier": payout_units,
            "criteria": criteria,
            "events": events,
        }


def build_publish_files(out_dir: Path, rounds_per_mode: int, compress: bool = True, seed: int = 42) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    state = EmberStrikeGameState(seed=seed)
    index_modes = []

    for mode_name, meta in BET_MODES.items():
        lut_filename = f"lookUpTable_{mode_name}_0.csv"
        use_zst = compress and (zstd is not None)
        book_filename = f"books_{mode_name}.jsonl.zst" if use_zst else f"books_{mode_name}.jsonl"

        lut_path = out_dir / lut_filename
        book_path = out_dir / book_filename

        raw_lines = []
        with lut_path.open("w", newline="", encoding="utf-8") as csv_f:
            writer = csv.writer(csv_f)
            for idx in range(1, rounds_per_mode + 1):
                book = state.simulate_round_book(round_id=idx, mode=mode_name)
                writer.writerow([idx, 1, book["payoutMultiplier"]])
                raw_lines.append(json.dumps(book, separators=(",", ":")))

        payload_bytes = ("\n".join(raw_lines) + "\n").encode("utf-8")
        if use_zst:
            cctx = zstd.ZstdCompressor(level=3)
            book_path.write_bytes(cctx.compress(payload_bytes))
        else:
            book_path.write_bytes(payload_bytes)

        index_modes.append({
            "name": mode_name,
            "cost": meta["cost_mult"],
            "events": book_filename,
            "weights": lut_filename,
        })

    (out_dir / "index.json").write_text(json.dumps({"modes": index_modes}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Ember Strike Stake Engine event books and LUTs")
    parser.add_argument("--out", type=Path, default=Path("./library/publish_files"))
    parser.add_argument("--rounds", type=int, default=100)
    parser.add_argument("--no-compress", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    build_publish_files(args.out, rounds_per_mode=args.rounds, compress=not args.no_compress, seed=args.seed)
    print(f"Generated publish_files for {len(BET_MODES)} modes in {args.out}")
