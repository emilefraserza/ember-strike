import type { GameMode, RoundBookEvent } from "../types/ember";

export interface EngineSessionConfig {
  rgsUrl?: string;
  sessionId?: string;
  currency?: string;
  socialMode: boolean;
}

export function getEngineSessionConfig(): EngineSessionConfig {
  const params = new URLSearchParams(window.location.search);
  const socialParam = params.get("social") ?? params.get("mode");
  const socialMode =
    socialParam === "1" ||
    socialParam === "true" ||
    socialParam === "social" ||
    window.location.hostname.includes("stake.us");

  return {
    rgsUrl: params.get("rgsUrl") ?? undefined,
    sessionId: params.get("sessionId") ?? undefined,
    currency: params.get("currency") ?? (socialMode ? "FC" : "USD"),
    socialMode,
  };
}

export async function requestRoundEvent(
  mode: GameMode,
  betAmount: number,
  config: EngineSessionConfig,
  fallbackGenerator: (m: GameMode) => RoundBookEvent
): Promise<RoundBookEvent> {
  if (config.rgsUrl && config.sessionId) {
    const response = await fetch(`${config.rgsUrl.replace(/\/$/, "")}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: config.sessionId,
        mode,
        amount: betAmount,
      }),
    });

    if (!response.ok) {
      throw new Error(`RGS play request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.round as RoundBookEvent;
  }

  return fallbackGenerator(mode);
}

export async function finalizeRoundIfNeeded(
  round: RoundBookEvent,
  config: EngineSessionConfig
): Promise<void> {
  if (config.rgsUrl && config.sessionId && round.totalWinMultiplier > 0) {
    await fetch(`${config.rgsUrl.replace(/\/$/, "")}/end-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: config.sessionId,
        roundId: round.roundId,
      }),
    });
  }
}
