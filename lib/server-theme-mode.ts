/**
 * Server-side marketing theme.
 * Home / creators / brands are dark-only (light mode disabled).
 */
export type MarketingThemeMode = "light" | "dark";

export async function getServerThemeMode(): Promise<MarketingThemeMode> {
  return "dark";
}
