# GEMINI.md — Ember Strike (Matchstick Gaming)

## Project Overview
- **Game Title:** Ember Strike
- **Studio:** Matchstick Gaming
- **Target Platform:** Stake Engine (RGS / Web Client)
- **Tech Stack:** Vite, TypeScript, Svelte 5 (Runes API), PixiJS v8
- **Math & Simulation:** Python / Node.js Monte Carlo 4-Tier Bonus Simulator (Target Max Win: 25,000x)

---

## Core Architecture & Directory Conventions
- `src/lib/` — Game state stores (Svelte 5 `$state`, `$derived`, `$effect`), RGS API client, and math/replay parsers.
- `src/components/` — Svelte 5 UI overlays, HUD, paytable, bonus buy modal, and settings.
- `src/pixi/` — PixiJS stage, reel containers, symbol sprite animations, particle effects, and forge background layers.
- `public/assets/` — Exported symbol sprites (Low/High pays, Matchstick Wild, Ignite Scatter) and background textures.
- `Review/` & `TODO/` — Stake Engine compliance self-review logs and productionization checklists.

---

## Game Mechanics & Domain Rules
1. **Bonus Tiers (4-Tier System):**
   - **Tier 1:** Strike a Match
   - **Tier 2:** Fuel the Fire
   - **Tier 3:** Burn It Down
   - **Tier 4:** Cataclysm Bonus (25,000x Max Win cap)
2. **Bonus Buy & Feature Upgrades:**
   - Support direct tier buys and the **3–6 Scatter Random Bonus Buy**.
   - Ensure bet-level multipliers, ante/feature upgrade states, and RGS wallet balances remain strictly synchronized before spin execution.

---

## Coding Standards & Strict Constraints
1. **Svelte 5 Idioms:**
   - Exclusively use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`). Do **not** introduce legacy Svelte 4 `export let` or `$:` reactive statements.
2. **PixiJS Lifecycle & Memory Safety:**
   - Always clean up PixiJS textures, tickers, filters, and event listeners on component unmount (`onDestroy` or `$effect` cleanup) to prevent WebGL context loss or memory leaks during rapid turbo spins.
3. **Stake Engine Compliance:**
   - **No Hardcoded Currency Symbols:** Always format currency dynamically via the RGS session currency/locale configuration.
   - **Deterministic Replay & RGS Integrity:** All spin outcomes, cascade/tumble steps, and bonus triggers must strictly render from the RGS server payload without client-side RNG overrides.
   - **Asset & Bundle Hygiene:** Keep production builds self-contained with relative asset paths (`./assets/...`), clean console output (no stray `console.log` in production), and strict TypeScript type safety (`npm run check` / `tsc --noEmit`).
   - **Zero Bet-Lock / UI Freeze:** Guarantee all win-presentation animations can be skipped/fast-forwarded cleanly and that spin buttons remain locked while `isSpinning` or `isModalOpen` is active.

---

## Workflow & Verification Commands
- **Dev Server:** `npm run dev`
- **Type Check:** `npm run check`
- **Production Build:** `npm run build`
- **Pre-Submission Audit:** Before packaging any Stake Engine release zip, verify that `dist/` builds cleanly without TypeScript errors, missing assets, or unapproved external network calls.
