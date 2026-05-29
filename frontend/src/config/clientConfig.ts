const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };

export const CLIENT_CONFIG = {
  apiBaseUrl: meta.env?.VITE_GAME_API_URL ?? "/api",
  currency: "EUR",
  revealWinDelayMs: 2300,
  frontendDecidesOutcome: false
};
