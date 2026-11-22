export type SymbolCode =
  | "L1" | "L2" | "L3" | "L4"
  | "H1" | "H2" | "H3" | "H4"
  | "W" | "S";

export type GameMode =
  | "base"
  | "bonus_hunt"
  | "buy_regular"
  | "buy_super"
  | "buy_epic"
  | "buy_random";

export type BonusTier = 0 | 1 | 2 | 3;

export interface ClusterWin {
  symbol: SymbolCode;
  cells: [number, number][];
  basePayout: number;
  multiplierApplied: number;
  finalPayout: number;
}

export interface CascadeStep {
  gridBefore: SymbolCode[][];
  wins: ClusterWin[];
  wildIgnitions: {
    row: number;
    col: number;
    mode: "row" | "col_or_row" | "row_and_global_double";
  }[];
  embersAfter: number[][];
  gridAfter: SymbolCode[][];
}

export interface SpinEvent {
  spinIndex: number;
  isFreeSpin: boolean;
  freeSpinsRemaining: number;
  scattersLanded: number;
  retriggeredSpins: number;
  upgradedToTier?: BonusTier | 4;
  cascades: CascadeStep[];
  spinWin: number;
}

export interface RoundBookEvent {
  roundId: string;
  mode: GameMode;
  betCostMultiplier: number;
  scattersAwarded: number;
  bonusTierTriggered: BonusTier;
  spins: SpinEvent[];
  totalWinMultiplier: number;
  maxWinReached: boolean;
}
