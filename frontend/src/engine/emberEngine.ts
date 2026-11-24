import type {
  BonusTier,
  CascadeStep,
  ClusterWin,
  GameMode,
  RoundBookEvent,
  SpinEvent,
  SymbolCode,
} from "../types/ember";

export const GRID_SIZE = 6;
export const MAX_WIN_CAP = 25000;
export const MAX_FREE_SPINS = 30;
export const PAYING_SYMBOLS: SymbolCode[] = ["L1", "L2", "L3", "L4", "H1", "H2", "H3", "H4"];
export const WILD: SymbolCode = "W";
export const SCATTER: SymbolCode = "S";

export const MODE_COSTS: Record<GameMode, number> = {
  base: 1,
  bonus_hunt: 3,
  buy_regular: 100,
  buy_super: 350,
  buy_epic: 1000,
  buy_random: 185,
};

export const BONUS_TITLES: Record<Exclude<BonusTier, 0>, { label: string; fullTitle: string; spins: number }> = {
  1: { label: "REGULAR", fullTitle: "Strike a Match", spins: 10 },
  2: { label: "SUPER", fullTitle: "Fuel the Fire", spins: 10 },
  3: { label: "EPIC", fullTitle: "Burn It Down", spins: 12 },
};

export const PAYTABLE: Record<Exclude<SymbolCode, "W" | "S">, [number, number][]> = {
  L1: [[15, 15], [12, 4], [10, 1.5], [9, 0.8], [8, 0.5], [7, 0.3], [6, 0.2], [5, 0.1]],
  L2: [[15, 15], [12, 4], [10, 1.5], [9, 0.8], [8, 0.5], [7, 0.3], [6, 0.2], [5, 0.1]],
  L3: [[15, 20], [12, 5], [10, 2], [9, 1], [8, 0.6], [7, 0.4], [6, 0.3], [5, 0.2]],
  L4: [[15, 20], [12, 5], [10, 2], [9, 1], [8, 0.6], [7, 0.4], [6, 0.3], [5, 0.2]],
  H1: [[15, 40], [12, 15], [10, 5], [9, 2.5], [8, 1.5], [7, 1], [6, 0.6], [5, 0.4]],
  H2: [[15, 60], [12, 20], [10, 7.5], [9, 3.5], [8, 2], [7, 1.2], [6, 0.8], [5, 0.5]],
  H3: [[15, 100], [12, 30], [10, 10], [9, 5], [8, 3], [7, 1.5], [6, 1], [5, 0.7]],
  H4: [[15, 150], [12, 50], [10, 20], [9, 8], [8, 5], [7, 2.5], [6, 1.5], [5, 1]],
};

const WEIGHTS: Record<string, Partial<Record<SymbolCode, number>>> = {
  base:  { L1: 180, L2: 180, L3: 165, L4: 165, H1: 95,  H2: 80, H3: 65, H4: 50, W: 14 },
  tier1: { L1: 175, L2: 175, L3: 160, L4: 160, H1: 100, H2: 85, H3: 70, H4: 55, W: 18 },
  tier2: { L1: 170, L2: 170, L3: 155, L4: 155, H1: 102, H2: 90, H3: 75, H4: 60, W: 24 },
  tier3: { L1: 165, L2: 165, L3: 155, L4: 155, H1: 105, H2: 95, H3: 80, H4: 65, W: 26 },
};

function clone2D<T>(matrix: T[][]): T[][] {
  return matrix.map((row) => [...row]);
}

function drawSymbol(profile: string): SymbolCode {
  const table = WEIGHTS[profile] ?? WEIGHTS.base;
  const entries = Object.entries(table) as [SymbolCode, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.floor(Math.random() * total);
  for (const [sym, w] of entries) {
    if (r < w) return sym;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

export function rollRandomBuyScatters(): 3 | 4 | 5 | 6 {
  const r = Math.random();
  if (r < 0.72) return 3;
  if (r < 0.945) return 4;
  if (r < 0.997) return 5;
  return 6;
}

function rollScatterCount(table: "base" | "bonus_hunt" | "retrigger"): number {
  const r = Math.random();
  if (table === "base") {
    if (r < 1 / 250000) return 6;
    if (r < 1 / 25000) return 5;
    if (r < 1 / 1800) return 4;
    if (r < 1 / 220) return 3;
    if (r < 0.065) return 2;
    if (r < 0.245) return 1;
    return 0;
  }
  if (table === "bonus_hunt") {
    if (r < 1 / 50000) return 6;
    if (r < 1 / 5000) return 5;
    if (r < 1 / 360) return 4;
    if (r < 1 / 44) return 3;
    if (r < 0.164) return 2;
    if (r < 0.384) return 1;
    return 0;
  }
  if (r < 1 / 35) return 3;
  if (r < 1 / 35 + 0.05) return 2;
  if (r < 1 / 35 + 0.17) return 1;
  return 0;
}

function upgradeCell(val: number, cap: number): number {
  if (val === 0) return 1;
  if (val === 1) return 2;
  return Math.min(val * 2, cap);
}

function getBasePay(symbol: Exclude<SymbolCode, "W" | "S">, size: number): number {
  for (const [minSize, mult] of PAYTABLE[symbol] ?? []) {
    if (size >= minSize) return mult;
  }
  return 0;
}

export function createInitialGrid(): SymbolCode[][] {
  return createGrid("base", 0);
}

function createGrid(profile: string, scatterCount: number): SymbolCode[][] {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => drawSymbol(profile))
  );
  if (scatterCount > 0) {
    const cols = Array.from({ length: GRID_SIZE }, (_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(scatterCount, GRID_SIZE));
    for (const c of cols) {
      const r = Math.floor(Math.random() * GRID_SIZE);
      grid[r][c] = SCATTER;
    }
  }
  return grid;
}

function findClusters(grid: SymbolCode[][]): { symbol: Exclude<SymbolCode, "W" | "S">; cells: [number, number][] }[] {
  const results: { symbol: Exclude<SymbolCode, "W" | "S">; cells: [number, number][] }[] = [];
  for (const sym of PAYING_SYMBOLS) {
    if (sym === "W" || sym === "S") continue;
    const visited = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (visited[r][c] || grid[r][c] !== sym) continue;
        const cluster: [number, number][] = [];
        const queue: [number, number][] = [[r, c]];
        visited[r][c] = true;
        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          cluster.push([cr, cc]);
          for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !visited[nr][nc]) {
              const cell = grid[nr][nc];
              if (cell === sym || cell === WILD) {
                visited[nr][nc] = true;
                queue.push([nr, nc]);
              }
            }
          }
        }
        if (cluster.length >= 5) {
          results.push({ symbol: sym, cells: cluster });
        }
      }
    }
  }
  return results;
}

function initBonusBoard(tier: Exclude<BonusTier, 0>): {
  embers: number[][];
  spins: number;
  cap: number;
  profile: string;
} {
  const embers = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  if (tier === 1) return { embers, spins: 10, cap: 128, profile: "tier1" };
  if (tier === 2) {
    for (const r of [2, 3]) for (const c of [2, 3]) embers[r][c] = 2;
    return { embers, spins: 10, cap: 128, profile: "tier2" };
  }
  const xCoords: [number, number][] = [
    [1, 1], [2, 2], [3, 3], [4, 4],
    [1, 4], [2, 3], [3, 2], [4, 1],
  ];
  for (const [r, c] of xCoords) embers[r][c] = 4;
  return { embers, spins: 12, cap: 128, profile: "tier3" };
}

function applyUpgradeToBoard(embers: number[][], newTier: Exclude<BonusTier, 0>): string {
  if (newTier === 2) {
    for (const r of [2, 3]) for (const c of [2, 3]) embers[r][c] = Math.max(embers[r][c], 2);
    return "tier2";
  }
  if (newTier === 3) {
    const xCoords: [number, number][] = [
      [1, 1], [2, 2], [3, 3], [4, 4],
      [1, 4], [2, 3], [3, 2], [4, 1],
    ];
    for (const [r, c] of xCoords) embers[r][c] = Math.max(embers[r][c], 4);
    return "tier3";
  }
  return "tier3";
}

function executeSingleSpin(
  spinIndex: number,
  isFreeSpin: boolean,
  freeSpinsRemaining: number,
  scattersLanded: number,
  retriggeredSpins: number,
  upgradedToTier: BonusTier | 4 | undefined,
  grid: SymbolCode[][],
  embers: number[][],
  profile: string,
  tier: BonusTier,
  cap: number,
  currentRoundWin: number
): { spin: SpinEvent; addedWin: number; capped: boolean } {
  const cascades: CascadeStep[] = [];
  let spinWin = 0;
  let capped = false;

  while (true) {
    const clusters = findClusters(grid);
    if (clusters.length === 0) break;

    const gridBefore = clone2D(grid);
    const exploded = new Set<string>();
    const winningWilds: [number, number][] = [];
    const clusterWins: ClusterWin[] = [];

    for (const { symbol, cells } of clusters) {
      const basePayout = getBasePay(symbol, cells.length);
      let multSum = 0;
      for (const [r, c] of cells) {
        if (embers[r][c] === 1) multSum += 2;
        else if (embers[r][c] >= 2) multSum += embers[r][c];
        exploded.add(`${r},${c}`);
        if (grid[r][c] === WILD && !winningWilds.some(([wr, wc]) => wr === r && wc === c)) {
          winningWilds.push([r, c]);
        }
      }
      const multiplierApplied = multSum > 0 ? multSum : 1;
      const finalPayout = basePayout * multiplierApplied;
      spinWin += finalPayout;
      clusterWins.push({ symbol, cells, basePayout, multiplierApplied, finalPayout });
    }

    if (currentRoundWin + spinWin >= MAX_WIN_CAP) {
      spinWin = Math.max(0, MAX_WIN_CAP - currentRoundWin);
      capped = true;
    }

    for (const key of exploded) {
      const [r, c] = key.split(",").map(Number);
      embers[r][c] = upgradeCell(embers[r][c], cap);
    }

    const wildIgnitions: CascadeStep["wildIgnitions"] = [];
    for (const [wr, wc] of winningWilds) {
      const nearEmber =
        embers[wr][wc] >= 1 ||
        [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
          const nr = wr + dr;
          const nc = wc + dc;
          return nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && embers[nr][nc] >= 1;
        });
      if (!nearEmber) continue;

      if (tier === 0 || tier === 1) {
        for (let c = 0; c < GRID_SIZE; c++) embers[wr][c] = upgradeCell(embers[wr][c], cap);
        wildIgnitions.push({ row: wr, col: wc, mode: "row" });
      } else if (tier === 2) {
        const rowHeat = embers[wr].reduce((a, b) => a + b, 0);
        const colHeat = embers.reduce((a, row) => a + row[wc], 0);
        if (colHeat > rowHeat) {
          for (let r = 0; r < GRID_SIZE; r++) embers[r][wc] = upgradeCell(embers[r][wc], cap);
        } else {
          for (let c = 0; c < GRID_SIZE; c++) embers[wr][c] = upgradeCell(embers[wr][c], cap);
        }
        wildIgnitions.push({ row: wr, col: wc, mode: "col_or_row" });
      } else if (tier === 3) {
        for (let c = 0; c < GRID_SIZE; c++) embers[wr][c] = upgradeCell(embers[wr][c], cap);
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (embers[r][c] >= 2) embers[r][c] = Math.min(embers[r][c] * 2, cap);
          }
        }
        wildIgnitions.push({ row: wr, col: wc, mode: "row_and_global_double" });
      }
    }

    for (let c = 0; c < GRID_SIZE; c++) {
      const surviving: SymbolCode[] = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        if (!exploded.has(`${r},${c}`)) surviving.push(grid[r][c]);
      }
      const missing = GRID_SIZE - surviving.length;
      const incoming = Array.from({ length: missing }, () => drawSymbol(profile));
      const merged = [...incoming, ...surviving];
      for (let r = 0; r < GRID_SIZE; r++) grid[r][c] = merged[r];
    }

    cascades.push({
      gridBefore,
      wins: clusterWins,
      wildIgnitions,
      embersAfter: clone2D(embers),
      gridAfter: clone2D(grid),
    });

    if (capped) break;
  }

  return {
    spin: {
      spinIndex,
      isFreeSpin,
      freeSpinsRemaining,
      scattersLanded,
      retriggeredSpins,
      upgradedToTier,
      cascades,
      spinWin,
    },
    addedWin: spinWin,
    capped,
  };
}

export function generateRoundBook(mode: GameMode): RoundBookEvent {
  const roundId = `rnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const betCostMultiplier = MODE_COSTS[mode];
  const spins: SpinEvent[] = [];
  let totalWin = 0;
  let scattersAwarded = 0;
  let bonusTierTriggered: BonusTier = 0;
  let maxWinReached = false;

  if (mode === "buy_regular" || mode === "buy_super" || mode === "buy_epic" || mode === "buy_random") {
    const sc =
      mode === "buy_regular"
        ? 3
        : mode === "buy_super"
        ? 4
        : mode === "buy_epic"
        ? 5
        : rollRandomBuyScatters();
    scattersAwarded = sc;
    if (sc === 6) {
      return {
        roundId,
        mode,
        betCostMultiplier,
        scattersAwarded: 6,
        bonusTierTriggered: 0,
        spins: [],
        totalWinMultiplier: MAX_WIN_CAP,
        maxWinReached: true,
      };
    }
    bonusTierTriggered = (sc - 2) as Exclude<BonusTier, 0>;
  } else {
    const scatterTable = mode === "bonus_hunt" ? "bonus_hunt" : "base";
    const scatters = rollScatterCount(scatterTable);
    scattersAwarded = scatters;
    const grid = createGrid("base", scatters);
    const embers = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    if (scatters === 6) {
      return {
        roundId,
        mode,
        betCostMultiplier,
        scattersAwarded: 6,
        bonusTierTriggered: 0,
        spins: [],
        totalWinMultiplier: MAX_WIN_CAP,
        maxWinReached: true,
      };
    }
    const res = executeSingleSpin(0, false, 0, scatters, 0, undefined, grid, embers, "base", 0, 128, totalWin);
    spins.push(res.spin);
    totalWin += res.addedWin;
    maxWinReached = res.capped;
    if (scatters >= 3 && !maxWinReached) {
      bonusTierTriggered = (scatters - 2) as Exclude<BonusTier, 0>;
    }
  }

  if (bonusTierTriggered > 0 && !maxWinReached) {
    const init = initBonusBoard(bonusTierTriggered);
    let spinsLeft = init.spins;
    let spinsPlayed = 0;
    let spinIdx = spins.length;
    let activeTier: Exclude<BonusTier, 0> = bonusTierTriggered;
    let activeProfile = init.profile;

    while (spinsLeft > 0 && !maxWinReached) {
      spinsLeft -= 1;
      spinsPlayed += 1;
      spinIdx += 1;

      const retriggerScatters = rollScatterCount("retrigger");
      let retriggered = 0;
      let upgradedTo: BonusTier | 4 | undefined = undefined;

      if (retriggerScatters >= 3) {
        if (Math.random() < 0.25) {
          if (activeTier < 3) {
            activeTier = (activeTier + 1) as Exclude<BonusTier, 0>;
            upgradedTo = activeTier;
            activeProfile = applyUpgradeToBoard(init.embers, activeTier);
          } else {
            upgradedTo = 4;
            totalWin = MAX_WIN_CAP;
            maxWinReached = true;
            break;
          }
        }
        if (spinsPlayed + spinsLeft < MAX_FREE_SPINS) {
          retriggered = Math.min(5, MAX_FREE_SPINS - (spinsPlayed + spinsLeft));
          spinsLeft += retriggered;
        }
      }

      const fsGrid = createGrid(activeProfile, retriggerScatters);
      const fsRes = executeSingleSpin(
        spinIdx,
        true,
        spinsLeft,
        retriggerScatters,
        retriggered,
        upgradedTo,
        fsGrid,
        init.embers,
        activeProfile,
        activeTier,
        init.cap,
        totalWin
      );
      spins.push(fsRes.spin);
      totalWin += fsRes.addedWin;
      maxWinReached = fsRes.capped;
    }
  }

  return {
    roundId,
    mode,
    betCostMultiplier,
    scattersAwarded,
    bonusTierTriggered,
    spins,
    totalWinMultiplier: Math.min(totalWin, MAX_WIN_CAP),
    maxWinReached,
  };
}
