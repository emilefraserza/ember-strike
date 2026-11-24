<script lang="ts">
  import { onMount } from "svelte";
  import { Application } from "pixi.js";
  import {
    BONUS_TITLES,
    createInitialGrid,
    generateRoundBook,
    GRID_SIZE,
    MODE_COSTS,
    PAYTABLE,
  } from "./engine/emberEngine";
  import { SYMBOL_MANIFEST } from "./engine/symbolManifest";
  import {
    finalizeRoundIfNeeded,
    getEngineSessionConfig,
    requestRoundEvent,
  } from "./rgs/engineClient";
  import { EmberGridStage } from "./pixi/EmberGridStage";
  import type { BonusTier, GameMode, RoundBookEvent, SymbolCode } from "./types/ember";

  const sessionConfig = getEngineSessionConfig();
  const PAY_ROWS: Exclude<SymbolCode, "W" | "S">[] = ["L1", "L2", "L3", "L4", "H1", "H2", "H3", "H4"];

  let canvasHost = $state<HTMLDivElement | null>(null);
  let pixiApp: Application | null = null;
  let gridStage: EmberGridStage | null = null;

  let socialMode = $state(sessionConfig.socialMode);
  let bonusHunt = $state(false);
  let turboMode = $state(false);
  let balance = $state(10000.0);
  let betAmount = $state(10.0);
  let lastWin = $state(0.0);
  let pendingBuyMode = $state<GameMode>("buy_regular");
  let showBuyModal = $state(false);
  let showInfoModal = $state(false);
  let isSpinning = $state(false);
  let activeBonusTier = $state<BonusTier>(0);
  let freeSpinsLeft = $state(0);
  let introBanner = $state<string | null>(null);
  let lastRound = $state<RoundBookEvent | null>(null);

  let grid = $state<SymbolCode[][]>(createInitialGrid());
  let embers = $state<number[][]>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
  );

  const labelBalance = $derived(socialMode ? "COINS" : "BALANCE");
  const labelBet = $derived(socialMode ? "PLAY" : "BET");
  const labelWin = $derived(socialMode ? "PRIZE" : "WIN");
  const labelBuy = $derived(socialMode ? "FEATURE" : "BUY BONUS");

  $effect(() => {
    gridStage?.updateBoard(grid, embers, activeBonusTier);
  });

  onMount(() => {
    if (!canvasHost) return;
    let disposed = false;

    (async () => {
      const app = new Application();
      await app.init({
        resizeTo: canvasHost!,
        backgroundColor: 0x0b0c0e,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });

      if (disposed) {
        app.destroy(true);
        return;
      }

      canvasHost!.innerHTML = "";
      canvasHost!.appendChild(app.canvas);
      pixiApp = app;
      const stage = new EmberGridStage(app);
      await stage.loadTextures("./assets/symbols/");
      gridStage = stage;
      gridStage.updateBoard(grid, embers, activeBonusTier);
    })();

    const onResize = () => gridStage?.layout();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      pixiApp?.destroy(true);
      pixiApp = null;
      gridStage = null;
    };
  });

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, turboMode ? Math.round(ms * 0.35) : ms));
  }

  function openBuyModal(): void {
    if (isSpinning) return;
    pendingBuyMode = "buy_regular";
    showBuyModal = true;
  }

  function confirmBuyModal(): void {
    const mode = pendingBuyMode;
    showBuyModal = false;
    void runRound(mode);
  }

  async function runRound(mode: GameMode): Promise<void> {
    if (isSpinning) return;
    const totalCost = betAmount * MODE_COSTS[mode];
    if (balance < totalCost) return;

    isSpinning = true;
    balance -= totalCost;
    lastWin = 0;
    introBanner = null;
    freeSpinsLeft = 0;

    try {
      const round = await requestRoundEvent(mode, betAmount, sessionConfig, generateRoundBook);
      lastRound = round;

      if (round.scattersAwarded === 6 && round.maxWinReached) {
        activeBonusTier = 0;
        introBanner = "6 SCATTERS — WATCH THE WORLD BURN! INSTANT 25,000x MAX WIN!";
        const payout = round.totalWinMultiplier * betAmount;
        lastWin = payout;
        balance += payout;
        await finalizeRoundIfNeeded(round, sessionConfig);
        return;
      }

      if (round.bonusTierTriggered > 0) {
        activeBonusTier = round.bonusTierTriggered;
        const info = BONUS_TITLES[round.bonusTierTriggered];
        introBanner = `${info.fullTitle.toUpperCase()} — ${info.spins} FREE SPINS`;
      } else {
        activeBonusTier = 0;
      }

      for (const spin of round.spins) {
        freeSpinsLeft = spin.freeSpinsRemaining;
        if (spin.upgradedToTier === 4) {
          introBanner = "UPGRADED TO 6 SCATTERS — INSTANT 25,000x MAX WIN!";
          break;
        }
        if (spin.upgradedToTier && spin.upgradedToTier > 0) {
          activeBonusTier = spin.upgradedToTier as BonusTier;
          const upInfo = BONUS_TITLES[activeBonusTier];
          introBanner = `FEATURE UPGRADE! ${upInfo.fullTitle.toUpperCase()}`;
        }

        for (const step of spin.cascades) {
          grid = step.gridBefore;
          await sleep(160);
          grid = step.gridAfter;
          embers = step.embersAfter;
          await sleep(220);
        }

        if (spin.cascades.length === 0) {
          grid = createInitialGrid();
          await sleep(140);
        }
      }

      const payout = round.totalWinMultiplier * betAmount;
      lastWin = payout;
      balance += payout;
      freeSpinsLeft = 0;
      await finalizeRoundIfNeeded(round, sessionConfig);
    } finally {
      isSpinning = false;
    }
  }
</script>

<main class="shell">
  <header class="bar">
    <div class="brand-group">
      <span class="font-stencil title">EMBER STRIKE</span>
      <span class="subtitle">
        {activeBonusTier > 0 ? BONUS_TITLES[activeBonusTier].fullTitle : "MATCHSTICK GAMING"}
      </span>
    </div>
    <div class="btn-row">
      <button type="button" class="btn" onclick={() => (showInfoModal = true)}>PAYTABLE</button>
      <button
        type="button"
        class="btn {bonusHunt ? 'btn-active' : ''}"
        disabled={isSpinning}
        onclick={() => (bonusHunt = !bonusHunt)}
      >
        BONUS HUNT (3x)
      </button>
      <button
        type="button"
        class="btn {turboMode ? 'btn-active' : ''}"
        onclick={() => (turboMode = !turboMode)}
      >
        TURBO: {turboMode ? "ON" : "OFF"}
      </button>
      <button type="button" class="btn" onclick={() => (socialMode = !socialMode)}>
        {socialMode ? "SOCIAL: ON" : "SOCIAL: OFF"}
      </button>
    </div>
  </header>

  <section class="stage-wrap">
    {#if introBanner}
      <div class="banner">{introBanner}</div>
    {/if}
    <div bind:this={canvasHost} class="canvas-box"></div>
  </section>

  {#if showBuyModal}
    <div class="backdrop">
      <div class="modal">
        <h2 class="font-display modal-title">{labelBuy}</h2>
        <div class="buy-grid">
          {#each (
            [
              ["buy_regular", "REGULAR", "100x", "3 Scatters • Strike a Match (10 FS)"],
              ["buy_super", "SUPER", "350x", "4 Scatters • Fuel the Fire (10 FS)"],
              ["buy_epic", "EPIC", "1,000x", "5 Scatters • Burn It Down (12 FS)"],
              ["buy_random", "RANDOM", "185x", "3–6 Scatters (6S = 25,000x Max Win)"],
            ] as const
          ) as [modeKey, tierLabel, multLabel, desc]}
            <button
              type="button"
              class="buy-card {pendingBuyMode === modeKey ? 'buy-card-active' : ''}"
              onclick={() => (pendingBuyMode = modeKey)}
            >
              <div class="buy-tier">{tierLabel}</div>
              <div class="font-display buy-mult">{multLabel}</div>
              <div class="buy-desc">{desc}</div>
            </button>
          {/each}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" onclick={() => (showBuyModal = false)}>CANCEL</button>
          <button type="button" class="btn btn-primary" onclick={confirmBuyModal}>CONFIRM</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showInfoModal}
    <div class="backdrop">
      <div class="modal">
        <h2 class="font-display modal-title">EMBER STRIKE — PAYTABLE (V4)</h2>
        <table class="paytable">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Tier</th>
              <th>5</th>
              <th>8</th>
              <th>10–11</th>
              <th>15+</th>
            </tr>
          </thead>
          <tbody>
            {#each PAY_ROWS as code}
              {@const m = SYMBOL_MANIFEST[code]}
              {@const row = PAYTABLE[code]}
              <tr>
                <td>{m.name}</td>
                <td>{m.tier.toUpperCase()}</td>
                <td>{row[7][1]}x</td>
                <td>{row[4][1]}x</td>
                <td>{row[2][1]}x</td>
                <td>{row[0][1]}x</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="info-note">
          <strong>Matchstick Wild:</strong> Substitutes for all 8 paying symbols and ignites adjacent Ember rows/axes.<br />
          <strong>IGNITE Scatter:</strong> 3 = Strike a Match (10 FS), 4 = Fuel the Fire (10 FS), 5 = Burn It Down (12 FS), 6 = Instant 25,000x Max Win.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" onclick={() => (showInfoModal = false)}>CLOSE</button>
        </div>
      </div>
    </div>
  {/if}

  <footer class="bar">
    <div class="stats">
      <div>{labelBalance}: <strong class="font-display">{balance.toFixed(2)}</strong></div>
      <div>{labelBet}: <strong class="font-display">{betAmount.toFixed(2)}</strong></div>
      <div>{labelWin}: <strong class="font-display gold">{lastWin.toFixed(2)}</strong></div>
      {#if freeSpinsLeft > 0}
        <div>FS LEFT: <strong class="font-display orange">{freeSpinsLeft}</strong></div>
      {/if}
      {#if lastRound}
        <div class="round-id">{lastRound.roundId}</div>
      {/if}
    </div>
    <div class="btn-row">
      <button
        type="button"
        class="btn"
        disabled={isSpinning}
        onclick={() => (betAmount = Math.max(1, betAmount / 2))}
      >
        -
      </button>
      <button
        type="button"
        class="btn"
        disabled={isSpinning}
        onclick={() => (betAmount = Math.min(1000, betAmount * 2))}
      >
        +
      </button>
      <button
        type="button"
        class="btn btn-buy"
        disabled={isSpinning}
        onclick={openBuyModal}
      >
        {labelBuy}
      </button>
      <button
        type="button"
        class="btn btn-spin"
        disabled={isSpinning}
        onclick={() => runRound(bonusHunt ? "bonus_hunt" : "base")}
      >
        {isSpinning ? "SPINNING..." : "SPIN"}
      </button>
    </div>
  </footer>
</main>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 14px 18px;
    gap: 12px;
    user-select: none;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: var(--bg-slate);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .title {
    font-size: 18px;
    letter-spacing: 0.08em;
  }
  .subtitle {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ember-orange);
    font-weight: 700;
  }
  .stage-wrap {
    margin: auto;
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .banner {
    width: 100%;
    padding: 8px 14px;
    text-align: center;
    border: 1px solid var(--ember-orange);
    background: var(--bg-slate);
    color: var(--ember-gold);
    font-family: "Oswald", sans-serif;
    letter-spacing: 0.06em;
    border-radius: 6px;
  }
  .canvas-box {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: 62vh;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    font-size: 13px;
  }
  .gold { color: var(--ember-gold); }
  .orange { color: var(--ember-orange); }
  .round-id {
    font-size: 11px;
    color: var(--ink-muted);
  }
  .btn-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .btn {
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: #1e222a;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--ember-orange);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-active {
    border-color: var(--ember-gold);
    color: var(--ember-gold);
  }
  .btn-buy {
    border-color: rgba(255, 106, 0, 0.75);
    color: var(--ember-orange);
  }
  .btn-primary {
    background: var(--ember-orange);
    border-color: var(--ember-orange);
    color: #000;
  }
  .btn-spin {
    padding: 8px 20px;
    background: #fff;
    border-color: #fff;
    color: #000;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 50;
  }
  .modal {
    background: var(--bg-slate);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 10px;
    max-width: 620px;
    width: 100%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .modal-title {
    margin: 0;
    font-size: 22px;
    letter-spacing: 0.06em;
  }
  .buy-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .buy-card {
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: var(--bg-obsidian);
    color: #fff;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
  }
  .buy-card-active {
    border-color: var(--ember-orange);
    background: rgba(255, 106, 0, 0.12);
  }
  .buy-tier {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .buy-mult {
    font-size: 20px;
    color: var(--ember-gold);
    margin-top: 4px;
  }
  .buy-desc {
    font-size: 11px;
    color: var(--ink-muted);
    margin-top: 4px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .paytable {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .paytable th,
  .paytable td {
    border-bottom: 1px solid var(--border-subtle);
    padding: 6px;
    text-align: left;
  }
  .paytable th {
    color: var(--ember-gold);
  }
  .info-note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-muted);
    line-height: 1.5;
  }
</style>
