import { cookies } from "next/headers";

export type MarketingThemeMode = "light" | "dark";

const PRESET_TO_MODE: Record<string, MarketingThemeMode> = {
  "game-of-creators": "dark",
  "clean-professional": "light",
  "dark-professional": "dark",
};

/** Server-side theme from cookies. Explicit mode beats legacy preset. */
export async function getServerThemeMode(): Promise<MarketingThemeMode> {
  const cookieStore = await cookies();
  const modeCookie = cookieStore.get("dashboard-mode")?.value;
  if (modeCookie === "dark" || modeCookie === "light") return modeCookie;

  const presetCookie = cookieStore.get("dashboard-preset")?.value;
  if (presetCookie && PRESET_TO_MODE[presetCookie]) {
    return PRESET_TO_MODE[presetCookie];
  }

  return "light";
}
