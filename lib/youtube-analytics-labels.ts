/** Shared display labels for YouTube Analytics (panel + export). */

export const TRAFFIC_LABELS: Record<string, string> = {
  SHORTS: "Shorts Feed",
  YT_SEARCH: "YouTube Search",
  RELATED_VIDEO: "Related Videos",
  YT_CHANNEL: "Channel Page",
  SUBSCRIBER: "Subscriber Feed",
  EXT_URL: "External Links",
  NO_LINK_OTHER: "Direct / Other",
  NO_LINK_EMBEDDED: "Embedded",
  YT_OTHER_PAGE: "Other YouTube",
  HASHTAGS: "Hashtags",
  PLAYLIST: "Playlist",
  SOUND_PAGE: "Sound Page",
  NOTIFICATION: "Notifications",
  END_SCREEN: "End Screen",
  ADVERTISING: "Advertising",
  ANNOTATION: "Annotations",
  LIVE_REDIRECT: "Live Redirect",
  PROMOTED: "Promoted",
  PRODUCT_PAGE: "Product Page",
  VIDEO_REMIXES: "Video Remixes",
};

export const AGE_LABELS: Record<string, string> = {
  age13_17: "13–17",
  age18_24: "18–24",
  age25_34: "25–34",
  age35_44: "35–44",
  age45_54: "45–54",
  age55_64: "55–64",
  age65_: "65+",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  user_specified: "Not specified",
};

export const DEVICE_LABELS: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
  TV: "TV",
  GAME_CONSOLE: "Game Console",
  AUTOMOTIVE: "Automotive",
  WEARABLE: "Wearable",
  UNKNOWN_PLATFORM: "Unknown",
};

export const OS_LABELS: Record<string, string> = {
  ANDROID: "Android",
  IOS: "iOS",
  WINDOWS: "Windows",
  MACINTOSH: "macOS",
  LINUX: "Linux",
  CHROMECAST: "Chromecast",
  SMART_TV: "Smart TV",
  PLAYSTATION: "PlayStation",
  XBOX: "Xbox",
  WEBOS: "webOS",
  TIZEN: "Tizen",
  KAIOS: "KaiOS",
  OTHER: "Other",
};

export const SUBSCRIBED_LABELS: Record<string, string> = {
  SUBSCRIBED: "Subscribed",
  UNSUBSCRIBED: "Not subscribed",
};

/** US ISO 3166-2 province codes → display name */
export const PROVINCE_LABELS: Record<string, string> = {
  "US-AL": "Alabama",
  "US-AK": "Alaska",
  "US-AZ": "Arizona",
  "US-AR": "Arkansas",
  "US-CA": "California",
  "US-CO": "Colorado",
  "US-CT": "Connecticut",
  "US-DE": "Delaware",
  "US-DC": "District of Columbia",
  "US-FL": "Florida",
  "US-GA": "Georgia",
  "US-HI": "Hawaii",
  "US-ID": "Idaho",
  "US-IL": "Illinois",
  "US-IN": "Indiana",
  "US-IA": "Iowa",
  "US-KS": "Kansas",
  "US-KY": "Kentucky",
  "US-LA": "Louisiana",
  "US-ME": "Maine",
  "US-MD": "Maryland",
  "US-MA": "Massachusetts",
  "US-MI": "Michigan",
  "US-MN": "Minnesota",
  "US-MS": "Mississippi",
  "US-MO": "Missouri",
  "US-MT": "Montana",
  "US-NE": "Nebraska",
  "US-NV": "Nevada",
  "US-NH": "New Hampshire",
  "US-NJ": "New Jersey",
  "US-NM": "New Mexico",
  "US-NY": "New York",
  "US-NC": "North Carolina",
  "US-ND": "North Dakota",
  "US-OH": "Ohio",
  "US-OK": "Oklahoma",
  "US-OR": "Oregon",
  "US-PA": "Pennsylvania",
  "US-RI": "Rhode Island",
  "US-SC": "South Carolina",
  "US-SD": "South Dakota",
  "US-TN": "Tennessee",
  "US-TX": "Texas",
  "US-UT": "Utah",
  "US-VT": "Vermont",
  "US-VA": "Virginia",
  "US-WA": "Washington",
  "US-WV": "West Virginia",
  "US-WI": "Wisconsin",
  "US-WY": "Wyoming",
  "US-ZZ": "Unknown state",
};

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  BR: "Brazil",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  MX: "Mexico",
  PH: "Philippines",
  ID: "Indonesia",
  NG: "Nigeria",
  PK: "Pakistan",
  BD: "Bangladesh",
  TR: "Turkey",
  VN: "Vietnam",
  KR: "South Korea",
  JP: "Japan",
  EG: "Egypt",
  TH: "Thailand",
  IT: "Italy",
  ES: "Spain",
  CO: "Colombia",
  AR: "Argentina",
  SA: "Saudi Arabia",
  MY: "Malaysia",
  RU: "Russia",
  ZA: "South Africa",
  NL: "Netherlands",
  PL: "Poland",
  UA: "Ukraine",
  KE: "Kenya",
  GH: "Ghana",
  AE: "UAE",
  SG: "Singapore",
  NZ: "New Zealand",
  NP: "Nepal",
  LK: "Sri Lanka",
};

/** YouTube API returns age13-17 (hyphens); labels use underscores. */
export function normalizeAgeGroupKey(key: string): string {
  return key.replace(/-/g, "_");
}

export function formatAgeGroupLabel(key: string): string {
  const normalized = normalizeAgeGroupKey(key);
  return AGE_LABELS[normalized] ?? key.replace(/^age/, "").replace(/_/g, "–");
}

export function formatGenderLabel(key: string): string {
  const lower = key.toLowerCase();
  return GENDER_LABELS[lower] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatDeviceLabel(key: string): string {
  return DEVICE_LABELS[key] ?? key.replace(/_/g, " ");
}

export function formatOsLabel(key: string): string {
  return OS_LABELS[key] ?? key.replace(/_/g, " ");
}

export function formatProvinceLabel(code: string): string {
  return PROVINCE_LABELS[code] ?? code.replace(/^US-/, "");
}

export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const offset = 0x1f1e6 - 65;
  return Array.from(code.toUpperCase())
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + offset))
    .join("");
}

/** Parse city storage key "CC|CityName" */
export function parseCityKey(key: string): { country: string; city: string } {
  const idx = key.indexOf("|");
  if (idx === -1) return { country: "", city: key };
  return { country: key.slice(0, idx), city: key.slice(idx + 1) };
}

export function trafficBarColor(source: string, pct: number): string {
  if (
    ["EXT_URL", "NO_LINK_OTHER", "NO_LINK_EMBEDDED"].includes(source) &&
    pct > 20
  ) {
    return "bg-red-400";
  }
  if (
    source === "SHORTS" ||
    source === "YT_SEARCH" ||
    source === "RELATED_VIDEO"
  ) {
    return "bg-emerald-400";
  }
  if (source === "SUBSCRIBER" || source === "YT_CHANNEL") return "bg-blue-400";
  return "bg-slate-400";
}
