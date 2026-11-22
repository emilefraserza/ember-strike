import type { SymbolCode } from "../types/ember";

export interface SymbolMeta {
  code: SymbolCode;
  name: string;
  shortLabel: string;
  tier: "low" | "high" | "wild" | "scatter";
  spriteFile: string;
  accentHex: string;
}

export const SYMBOL_MANIFEST: Record<SymbolCode, SymbolMeta> = {
  L1: { code: "L1", name: "Triangle", shortLabel: "TRIANGLE", tier: "low", spriteFile: "L1_Triangle.jpg", accentHex: "#8E96A4" },
  L2: { code: "L2", name: "Thermometer", shortLabel: "THERMO", tier: "low", spriteFile: "L2_Thermometer.jpg", accentHex: "#8E96A4" },
  L3: { code: "L3", name: "Kindling", shortLabel: "KINDLING", tier: "low", spriteFile: "L3_Kindling.jpg", accentHex: "#8E96A4" },
  L4: { code: "L4", name: "Fuel Can", shortLabel: "FUEL CAN", tier: "low", spriteFile: "L4_Fuel_Can.jpg", accentHex: "#8E96A4" },
  H1: { code: "H1", name: "Flint", shortLabel: "FLINT", tier: "high", spriteFile: "H1_Flint.jpg", accentHex: "#FFB800" },
  H2: { code: "H2", name: "Lighter", shortLabel: "LIGHTER", tier: "high", spriteFile: "H2_Lighter.jpg", accentHex: "#FF8A00" },
  H3: { code: "H3", name: "Flamethrower", shortLabel: "FLAMER", tier: "high", spriteFile: "H3_Flamethrower.jpg", accentHex: "#FF6A00" },
  H4: { code: "H4", name: "Dynamite", shortLabel: "DYNAMITE", tier: "high", spriteFile: "H4_Dynamite.jpg", accentHex: "#FFD000" },
  W:  { code: "W",  name: "Matchstick Wild", shortLabel: "WILD", tier: "wild", spriteFile: "W_Matchstick_Wild.jpg", accentHex: "#FFFFFF" },
  S:  { code: "S",  name: "IGNITE Scatter", shortLabel: "IGNITE", tier: "scatter", spriteFile: "S_Ignite_Scatter.jpg", accentHex: "#D92626" },
};
