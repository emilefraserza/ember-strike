import type { SymbolCode } from "../types/ember";

export interface SymbolMeta {
  code: SymbolCode;
  name: string;
  tier: "low" | "high" | "wild" | "scatter";
  spriteFile: string;
}

export const SYMBOL_MANIFEST: Record<SymbolCode, SymbolMeta> = {
  L1: { code: "L1", name: "Triangle", tier: "low", spriteFile: "L1_Triangle.jpg" },
  L2: { code: "L2", name: "Thermometer", tier: "low", spriteFile: "L2_Thermometer.jpg" },
  L3: { code: "L3", name: "Kindling", tier: "low", spriteFile: "L3_Kindling.jpg" },
  L4: { code: "L4", name: "Fuel Can", tier: "low", spriteFile: "L4_Fuel_Can.jpg" },
  H1: { code: "H1", name: "Flint", tier: "high", spriteFile: "H1_Flint.jpg" },
  H2: { code: "H2", name: "Lighter", tier: "high", spriteFile: "H2_Lighter.jpg" },
  H3: { code: "H3", name: "Flamethrower", tier: "high", spriteFile: "H3_Flamethrower.jpg" },
  H4: { code: "H4", name: "Dynamite", tier: "high", spriteFile: "H4_Dynamite.jpg" },
  W:  { code: "W",  name: "Matchstick Wild", tier: "wild", spriteFile: "W_Matchstick_Wild.jpg" },
  S:  { code: "S",  name: "IGNITE Scatter", tier: "scatter", spriteFile: "S_Ignite_Scatter.jpg" },
};
