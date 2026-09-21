"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LatLngBounds, Map as LeafletMap } from "leaflet";
import { FaYoutube, FaInstagram, FaTwitter } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronDown,
  FilterX,
  Layers3,
  Loader2,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  UserRound,
  Users,
  X,
} from "lucide-react";
import REGIONS_AND_COUNTRIES_DATA from "@/data/regions-and-countries.json";

type SocialLink = { label: string; url: string | null };

const STATE_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const GEOJSON_CACHE = new Map<string, any>();
const GEOJSON_INFLIGHT = new Map<string, Promise<any>>();

function FullscreenViewportPortal({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (active && typeof document !== "undefined") {
    return createPortal(children, document.body);
  }
  return <>{children}</>;
}

async function loadGeoJsonCached(url: string): Promise<any> {
  if (GEOJSON_CACHE.has(url)) return GEOJSON_CACHE.get(url);
  const inflight = GEOJSON_INFLIGHT.get(url);
  if (inflight) return inflight;
  const p = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load geojson: ${url}`);
      return res.json();
    })
    .then((json) => {
      GEOJSON_CACHE.set(url, json);
      GEOJSON_INFLIGHT.delete(url);
      return json;
    })
    .catch((err) => {
      GEOJSON_INFLIGHT.delete(url);
      throw err;
    });
  GEOJSON_INFLIGHT.set(url, p);
  return p;
}

type UserMarker = {
  lat: number;
  lon: number;
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  username?: string | null;
  profile_picture_url?: string | null;
  city?: string;
  state?: string;
  country?: string;
  youtube?: SocialLink | null;
  instagram?: SocialLink | null;
  twitter?: SocialLink | null;
};

function getLocationKey(m: UserMarker): string {
  const parts = [m.city, m.state, m.country].filter(Boolean) as string[];
  return parts.length ? parts.join(", ") : "unknown location";
}

type LocationCounts = {
  lat: number;
  lon: number;
  label: string;
  users: number;
  admins: number;
  brands: number;
  creators: number;
};

const countryToRegionMap: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const data = REGIONS_AND_COUNTRIES_DATA as Record<string, string[]>;
  for (const [region, countries] of Object.entries(data)) {
    for (const c of countries) m[c] = region;
  }
  return m;
})();

/** Map alternate country names to canonical names used in regions-and-countries.json so they group correctly */
const COUNTRY_ALIASES: Record<string, string> = {
  "united states of america": "United States",
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united kingdom of great britain and northern ireland": "United Kingdom",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  "republic of korea": "South Korea",
  "korea, republic of": "South Korea",
  "south korea": "South Korea",
  "korea, democratic people's republic of": "North Korea",
  "democratic people's republic of korea": "North Korea",
  "north korea": "North Korea",
  "russian federation": "Russia",
  "viet nam": "Vietnam",
  "lao people's democratic republic": "Laos",
  "lao pdr": "Laos",
  "iran, islamic republic of": "Iran",
  "bolivia (plurinational state of)": "Bolivia",
  "venezuela (bolivarian republic of)": "Venezuela",
  "congo, democratic republic of the": "Congo (DRC)",
  "democratic republic of the congo": "Congo (DRC)",
  drc: "Congo (DRC)",
  "tanzania, united republic of": "Tanzania",
  "united republic of tanzania": "Tanzania",
  czechia: "Czech Republic",
  "republic of moldova": "Moldova",
  "syrian arab republic": "Syria",
  "libyan arab jamahiriya": "Libya",
  "the former yugoslav republic of macedonia": "North Macedonia",
  macedonia: "North Macedonia",
  "brunei darussalam": "Brunei",
  "ivory coast": "Côte d'Ivoire",
  "côte d'ivoire": "Côte d'Ivoire",
  burma: "Myanmar",
  "republic of the congo": "Congo",
  "congo, republic of the": "Congo",
  "east timor": "Timor-Leste",
  "palestine, state of": "Palestine",
  "state of palestine": "Palestine",
  "taiwan, province of china": "Taiwan",
  "hong kong": "China",
  macau: "China",
  macao: "China",
  "united states virgin islands": "United States",
  "puerto rico": "United States",
  guam: "United States",
  "american samoa": "United States",
  reunion: "France",
  réunion: "France",
  martinique: "France",
  guadeloupe: "France",
  "french guiana": "France",
  "new caledonia": "France",
  "french polynesia": "France",
  "the netherlands": "Netherlands",
  netherlands: "Netherlands",
  holland: "Netherlands",
  "kingdom of the netherlands": "Netherlands",
  // Natural Earth / GeoJSON short or alternate names -> canonical for region choropleth
  "w. sahara": "Western Sahara",
  "western sahara": "Western Sahara",
  "dem. rep. congo": "Congo (DRC)",
  "dominican rep.": "Dominican Republic",
  "dominican rep": "Dominican Republic",
  "eq. guinea": "Equatorial Guinea",
  "equatorial guinea": "Equatorial Guinea",
  "marshall is.": "Marshall Islands",
  "marshall is": "Marshall Islands",
  "solomon is.": "Solomon Islands",
  "solomon is": "Solomon Islands",
  "s. sudan": "South Sudan",
  "south sudan": "South Sudan",
  "u.a.e.": "United Arab Emirates",
  "u.a.e": "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "bosnia and herz.": "Bosnia and Herzegovina",
  "bosnia and herz": "Bosnia and Herzegovina",
  "central african rep.": "Central African Republic",
  "central african rep": "Central African Republic",
  "st. vincent and the grenadines": "Saint Vincent and the Grenadines",
  "st. kitts and nevis": "Saint Kitts and Nevis",
  "st. lucia": "Saint Lucia",
  "antigua and barb.": "Antigua and Barbuda",
  "antigua and barb": "Antigua and Barbuda",
  "the gambia": "Gambia",
  gambia: "Gambia",
  "são tomé and príncipe": "Sao Tome and Principe",
  "sao tome and principe": "Sao Tome and Principe",
  "n. cyprus": "Cyprus",
  "northern cyprus": "Cyprus",
  cyprus: "Cyprus",
  "falkland is.": "Falkland Islands",
  "falkland is": "Falkland Islands",
  "fr. guiana": "France",
  "trinidad and tob.": "Trinidad and Tobago",
  "trinidad and tob": "Trinidad and Tobago",
  "st. pierre and miquelon": "Saint Pierre and Miquelon",
  "micronesia (federated states of)": "Micronesia",
  "federated states of micronesia": "Micronesia",
  "br. virgin is.": "United Kingdom",
  "british virgin islands": "United Kingdom",
  "cayman is.": "United Kingdom",
  "cayman is": "United Kingdom",
  "cayman islands": "United Kingdom",
  "turks and caicos is.": "United Kingdom",
  "turks and caicos islands": "United Kingdom",
  anguilla: "United Kingdom",
  montserrat: "United Kingdom",
  korea: "South Korea",
};

function getCanonicalCountry(country: string | null | undefined): string {
  if (!country || !country.trim()) return "Unknown";
  let trimmed = country.trim();
  if (trimmed.startsWith("The ") || trimmed.startsWith("the ")) {
    trimmed = trimmed.slice(4).trim();
  }
  const lower = trimmed.toLowerCase();
  const alias = COUNTRY_ALIASES[lower];
  if (alias) return alias;
  if (countryToRegionMap[trimmed]) return trimmed;
  for (const [canonical] of Object.entries(countryToRegionMap)) {
    if (canonical.toLowerCase() === lower) return canonical;
  }
  return trimmed;
}

function getRegion(m: UserMarker): string {
  const canonical = getCanonicalCountry(m.country);
  return countryToRegionMap[canonical] || canonical;
}

function getStateKey(m: UserMarker): string {
  const state = (m.state || "Unknown").trim();
  const country = (m.country || "").trim();
  return country ? `${state}, ${country}` : state || "Unknown";
}

/** Aggregate by region -> LocationCounts (centroid + counts) */
function aggregateByRegion(markers: UserMarker[]): LocationCounts[] {
  const byKey = new Map<
    string,
    {
      latSum: number;
      lonSum: number;
      count: number;
      label: string;
      admins: number;
      brands: number;
      creators: number;
    }
  >();
  for (const m of markers) {
    const key = getRegion(m);
    const label = key;
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byKey.get(key);
    if (existing) {
      existing.latSum += m.lat;
      existing.lonSum += m.lon;
      existing.count += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        latSum: m.lat,
        lonSum: m.lon,
        count: 1,
        label,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return Array.from(byKey.entries()).map(([_, v]) => ({
    lat: v.latSum / v.count,
    lon: v.lonSum / v.count,
    label: v.label,
    users: v.count,
    admins: v.admins,
    brands: v.brands,
    creators: v.creators,
  }));
}

/** Aggregate by state (state, country) -> LocationCounts */
function aggregateByState(markers: UserMarker[]): LocationCounts[] {
  const byKey = new Map<
    string,
    {
      latSum: number;
      lonSum: number;
      count: number;
      label: string;
      admins: number;
      brands: number;
      creators: number;
    }
  >();
  for (const m of markers) {
    const key = getStateKey(m);
    const label = key;
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byKey.get(key);
    if (existing) {
      existing.latSum += m.lat;
      existing.lonSum += m.lon;
      existing.count += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        latSum: m.lat,
        lonSum: m.lon,
        count: 1,
        label,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return Array.from(byKey.entries()).map(([_, v]) => ({
    lat: v.latSum / v.count,
    lon: v.lonSum / v.count,
    label: v.label,
    users: v.count,
    admins: v.admins,
    brands: v.brands,
    creators: v.creators,
  }));
}

/** Aggregate by country -> LocationCounts (for pins when groupBy=country) */
function aggregateByCountryToLocationCounts(
  markers: UserMarker[],
): LocationCounts[] {
  const byKey = new Map<
    string,
    {
      latSum: number;
      lonSum: number;
      count: number;
      label: string;
      admins: number;
      brands: number;
      creators: number;
    }
  >();
  for (const m of markers) {
    const key = (m.country || "Unknown").trim();
    const label = key;
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byKey.get(key);
    if (existing) {
      existing.latSum += m.lat;
      existing.lonSum += m.lon;
      existing.count += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        latSum: m.lat,
        lonSum: m.lon,
        count: 1,
        label,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return Array.from(byKey.entries()).map(([_, v]) => ({
    lat: v.latSum / v.count,
    lon: v.lonSum / v.count,
    label: v.label,
    users: v.count,
    admins: v.admins,
    brands: v.brands,
    creators: v.creators,
  }));
}

type Counts = {
  total: number;
  admins: number;
  brands: number;
  creators: number;
};

type MapMetricCounts = Counts | LocationCounts;

function getMapMetricRows(
  counts: MapMetricCounts,
  activeTab: string,
): Array<[string, number]> {
  const total = "users" in counts ? counts.users : counts.total;
  if (activeTab === "advertisers") {
    return [["Advertisers", counts.brands]];
  }
  if (activeTab === "creators") {
    return [["Creators", counts.creators]];
  }
  return [
    ["Users", total],
    ["Advertisers", counts.brands],
    ["Creators", counts.creators],
    ["Admins", counts.admins],
  ];
}

function renderMapMetricRows(rows: Array<[string, number]>): string {
  return `<dl class="users-map-metrics">${rows
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${Number(value).toLocaleString()}</dd></div>`,
    )
    .join("")}</dl>`;
}

/** Aggregate by country for choropleth: country name -> Counts */
function aggregateByCountry(markers: UserMarker[]): Map<string, Counts> {
  const byCountry = new Map<string, Counts>();
  for (const m of markers) {
    const country = (m.country || "Unknown").trim();
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byCountry.get(country);
    if (existing) {
      existing.total += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byCountry.set(country, {
        total: 1,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return byCountry;
}

/** Aggregate by state (state, country) -> Counts for state choropleth */
function aggregateByStateCounts(markers: UserMarker[]): Map<string, Counts> {
  const byKey = new Map<string, Counts>();
  for (const m of markers) {
    const key = getStateKey(m);
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byKey.get(key);
    if (existing) {
      existing.total += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        total: 1,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return byKey;
}

/** Aggregate by region -> Counts for region choropleth */
function aggregateByRegionCounts(markers: UserMarker[]): Map<string, Counts> {
  const byKey = new Map<string, Counts>();
  for (const m of markers) {
    const key = getRegion(m);
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    const existing = byKey.get(key);
    if (existing) {
      existing.total += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        total: 1,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return byKey;
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Aggregate markers by city/state/country with counts by type (users, admins, brands, creators) */
function aggregateByLocation(markers: UserMarker[]): LocationCounts[] {
  const byKey = new Map<
    string,
    {
      latSum: number;
      lonSum: number;
      count: number;
      label: string;
      admins: number;
      brands: number;
      creators: number;
    }
  >();
  for (const m of markers) {
    const key = getLocationKey(m);
    const label = key;
    const existing = byKey.get(key);
    const ut = (m.user_type || "").toLowerCase();
    const isAdmin = ut === "admin";
    const isBrand = ut === "advertiser";
    const isCreator = ut === "creator";
    if (existing) {
      existing.latSum += m.lat;
      existing.lonSum += m.lon;
      existing.count += 1;
      if (isAdmin) existing.admins += 1;
      if (isBrand) existing.brands += 1;
      if (isCreator) existing.creators += 1;
    } else {
      byKey.set(key, {
        latSum: m.lat,
        lonSum: m.lon,
        count: 1,
        label,
        admins: isAdmin ? 1 : 0,
        brands: isBrand ? 1 : 0,
        creators: isCreator ? 1 : 0,
      });
    }
  }
  return Array.from(byKey.entries()).map(([_, v]) => ({
    lat: v.latSum / v.count,
    lon: v.lonSum / v.count,
    label: v.label,
    users: v.count,
    admins: v.admins,
    brands: v.brands,
    creators: v.creators,
  }));
}

type MapGroupBy = "region" | "state" | "country" | "city";
type MapTab = "all" | "advertisers" | "creators";

type MapGeographyFilters = {
  region: string;
  country: string;
  state: string;
  city: string;
};

export type UsersMapProps = {
  markers: UserMarker[];
  activeTab: string;
  totalInTab: number;
  isDark: boolean;
  groupBy: MapGroupBy;
  onActiveTabChange: (tab: MapTab) => void;
  onGroupByChange: (groupBy: MapGroupBy) => void;
  tabCounts: Record<MapTab, number>;
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
  className?: string;
};

function getGroupByKey(
  m: UserMarker,
  groupBy: MapGroupBy,
): string {
  if (groupBy === "region") return getRegion(m);
  if (groupBy === "state") return getStateKey(m);
  if (groupBy === "country") return (m.country || "Unknown").trim();
  return getLocationKey(m);
}

function getDemographicDisplayLabel(
  fullKey: string,
  groupBy: MapGroupBy,
): string {
  if (groupBy === "state" || groupBy === "city") {
    const first = fullKey.split(",")[0]?.trim();
    return first || "Unknown";
  }
  return fullKey || "Unknown";
}

export function UsersMap({
  markers,
  activeTab,
  totalInTab,
  isDark,
  groupBy,
  onActiveTabChange,
  onGroupByChange,
  tabCounts,
  isLoading,
  loadError,
  onRetry,
  className,
}: UsersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const choroplethLayerRef = useRef<{ remove: () => void } | null>(null);
  const mapBoundsRef = useRef<LatLngBounds | null>(null);
  const syncMapViewportRef = useRef<(() => void) | null>(null);
  const savedMapViewRef = useRef<{
    center: { lat: number; lng: number };
    zoom: number;
  } | null>(null);
  const hasAppliedMapViewRef = useRef(false);
  const mapInitGenerationRef = useRef(0);
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null);
  const fullscreenExitRef = useRef<HTMLButtonElement>(null);
  const wasMapFullscreenRef = useRef(false);
  const [detailLocation, setDetailLocation] = useState<string | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMapRendering, setIsMapRendering] = useState(false);
  const [mapRenderError, setMapRenderError] = useState(false);
  const [mapRenderNonce, setMapRenderNonce] = useState(0);
  const [mapMode, setMapMode] = useState<"pins" | "choropleth" | "demographic">(
    "pins",
  );
  const [demographicSort, setDemographicSort] = useState<{
    column: "total" | "brands" | "creators" | "admins" | null;
    order: "asc" | "desc" | null;
  }>({ column: null, order: null });
  const [geographyFilters, setGeographyFilters] =
    useState<MapGeographyFilters>({
      region: "all",
      country: "all",
      state: "all",
      city: "all",
    });
  const setDetailLocationRef = useRef<(location: string | null) => void>(
    setDetailLocation,
  );

  const exitMapFullscreen = useCallback(() => {
    setIsDrawerOpen(false);
    setIsMapFullscreen(false);
  }, []);

  const enterMapFullscreen = useCallback(() => {
    setIsDrawerOpen(false);
    setIsMapFullscreen(true);
  }, []);

  const refreshMapViewport = useCallback(() => {
    if (syncMapViewportRef.current) {
      syncMapViewportRef.current();
      return;
    }
    mapRef.current?.invalidateSize({ animate: false, pan: false });
  }, []);

  setDetailLocationRef.current = (location: string | null) => {
    if (location && isMapFullscreen) exitMapFullscreen();
    setDetailLocation(location);
  };

  // Choropleth isn't available for cities; switch to pins when All Cities is selected
  useEffect(() => {
    if (groupBy === "city" && mapMode === "choropleth") setMapMode("pins");
  }, [groupBy, mapMode]);

  // Warm heavy geojson files so choropleth opens faster.
  useEffect(() => {
    void loadGeoJsonCached(STATE_GEOJSON_URL);
    void loadGeoJsonCached(WORLD_GEOJSON_URL);
  }, []);

  useEffect(() => {
    if (mapMode === "demographic") setDetailLocation(null);
  }, [mapMode]);

  useEffect(() => {
    if (!isMapFullscreen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapFullscreen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (isMapFullscreen) {
        wasMapFullscreenRef.current = true;
        fullscreenExitRef.current?.focus();
      } else if (wasMapFullscreenRef.current) {
        wasMapFullscreenRef.current = false;
        if (!detailLocation) fullscreenTriggerRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailLocation, isMapFullscreen]);

  useEffect(() => {
    if (!isMapFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return;
      }
      exitMapFullscreen();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exitMapFullscreen, isDrawerOpen, isMapFullscreen]);

  // Leaflet caches the container dimensions. Re-measure once layout transitions
  // have completed, without changing the user's center or zoom.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      refreshMapViewport();
    });
    const timeout = window.setTimeout(() => {
      refreshMapViewport();
    }, 240);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [isMapFullscreen, refreshMapViewport]);

  useEffect(() => {
    if (!isMapFullscreen) return;
    const timeout = window.setTimeout(() => {
      refreshMapViewport();
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [isDrawerOpen, isMapFullscreen, refreshMapViewport]);

  useEffect(() => {
    if (mapMode === "demographic" || !containerRef.current) return;
    let frame: number | null = null;
    const invalidate = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        refreshMapViewport();
      });
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(invalidate)
        : null;
    observer?.observe(containerRef.current);
    window.addEventListener("resize", invalidate);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [mapMode, refreshMapViewport]);

  const regionOptions = useMemo(
    () =>
      Array.from(new Set(markers.map((marker) => getRegion(marker))))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [markers],
  );

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          markers
            .filter(
              (marker) =>
                geographyFilters.region === "all" ||
                getRegion(marker) === geographyFilters.region,
            )
            .map((marker) => (marker.country || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [geographyFilters.region, markers],
  );

  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set(
          markers
            .filter(
              (marker) =>
                geographyFilters.country === "all" ||
                (marker.country || "").trim() === geographyFilters.country,
            )
            .map((marker) => (marker.state || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [geographyFilters.country, markers],
  );

  const cityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          markers
            .filter((marker) => {
              if (
                geographyFilters.country !== "all" &&
                (marker.country || "").trim() !== geographyFilters.country
              )
                return false;
              if (
                geographyFilters.state !== "all" &&
                (marker.state || "").trim() !== geographyFilters.state
              )
                return false;
              return true;
            })
            .map((marker) => (marker.city || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [geographyFilters.country, geographyFilters.state, markers],
  );

  useEffect(() => {
    setGeographyFilters((current) => {
      if (
        current.region !== "all" &&
        !regionOptions.includes(current.region)
      ) {
        return { region: "all", country: "all", state: "all", city: "all" };
      }
      if (
        current.country !== "all" &&
        !countryOptions.includes(current.country)
      ) {
        return { ...current, country: "all", state: "all", city: "all" };
      }
      if (current.state !== "all" && !stateOptions.includes(current.state)) {
        return { ...current, state: "all", city: "all" };
      }
      if (current.city !== "all" && !cityOptions.includes(current.city)) {
        return { ...current, city: "all" };
      }
      return current;
    });
  }, [cityOptions, countryOptions, regionOptions, stateOptions]);

  const updateGeographyFilter = useCallback(
    (filter: keyof MapGeographyFilters, value: string) => {
      setGeographyFilters((current) => {
        if (filter === "region") {
          return { region: value, country: "all", state: "all", city: "all" };
        }
        if (filter === "country") {
          return { ...current, country: value, state: "all", city: "all" };
        }
        if (filter === "state") {
          return { ...current, state: value, city: "all" };
        }
        return { ...current, city: value };
      });
    },
    [],
  );

  const clearGeographyFilters = useCallback(() => {
    setGeographyFilters({
      region: "all",
      country: "all",
      state: "all",
      city: "all",
    });
  }, []);

  const visibleMarkers = useMemo(
    () =>
      markers.filter((marker) => {
        if (
          geographyFilters.region !== "all" &&
          getRegion(marker) !== geographyFilters.region
        )
          return false;
        if (
          geographyFilters.country !== "all" &&
          (marker.country || "").trim() !== geographyFilters.country
        )
          return false;
        if (
          geographyFilters.state !== "all" &&
          (marker.state || "").trim() !== geographyFilters.state
        )
          return false;
        if (
          geographyFilters.city !== "all" &&
          (marker.city || "").trim() !== geographyFilters.city
        )
          return false;
        return true;
      }),
    [geographyFilters, markers],
  );

  const tabLabel =
    activeTab === "all"
      ? "Users"
      : activeTab === "advertisers"
        ? "Advertisers"
        : "Creators";
  const showAdvertisersColumn = activeTab !== "creators";
  const showCreatorsColumn = activeTab !== "advertisers";
  const showAdminsColumn = activeTab === "all";
  const showTotalColumn = activeTab === "all";
  const demographicTableColSpan =
    2 +
    (showTotalColumn ? 1 : 0) +
    (showAdvertisersColumn ? 1 : 0) +
    (showCreatorsColumn ? 1 : 0) +
    (showAdminsColumn ? 1 : 0);
  const demographicGroupLabel =
    groupBy === "city"
      ? "City"
      : groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
  const demographicGroupPlural =
    groupBy === "country"
      ? "countries"
      : groupBy === "city"
        ? "cities"
        : `${groupBy}s`;

  const withLocationCount = visibleMarkers.length;
  const detailUsers = detailLocation
    ? visibleMarkers.filter(
        (marker) => getGroupByKey(marker, groupBy) === detailLocation,
      )
    : [];

  const locationAggregates = useMemo(() => {
    if (groupBy === "region") return aggregateByRegion(visibleMarkers);
    if (groupBy === "state") return aggregateByState(visibleMarkers);
    if (groupBy === "city") return aggregateByLocation(visibleMarkers);
    return aggregateByCountryToLocationCounts(visibleMarkers);
  }, [visibleMarkers, groupBy]);

  const demographicRows = useMemo(() => {
    const byKey = new Map<
      string,
      { total: number; admins: number; brands: number; creators: number }
    >();
    visibleMarkers.forEach((m) => {
      const key = getGroupByKey(m, groupBy);
      const existing = byKey.get(key) || {
        total: 0,
        admins: 0,
        brands: 0,
        creators: 0,
      };
      const ut = (m.user_type || "").toLowerCase();
      existing.total += 1;
      if (ut === "admin") existing.admins += 1;
      if (ut === "advertiser") existing.brands += 1;
      if (ut === "creator") existing.creators += 1;
      byKey.set(key, existing);
    });
    return Array.from(byKey.entries())
      .map(([fullKey, counts]) => ({
        label: getDemographicDisplayLabel(fullKey, groupBy),
        ...counts,
      }))
      .sort((a, b) => b.total - a.total);
  }, [visibleMarkers, groupBy]);

  const sortedDemographicRows = useMemo(() => {
    if (!demographicSort.column || !demographicSort.order)
      return demographicRows;
    const rows = [...demographicRows];
    const { column, order } = demographicSort;
    rows.sort((a, b) =>
      order === "asc" ? a[column] - b[column] : b[column] - a[column],
    );
    return rows;
  }, [demographicRows, demographicSort]);

  useEffect(() => {
    let cancelled = false;
    const generation = ++mapInitGenerationRef.current;

    const rememberMapView = (map: LeafletMap | null) => {
      if (!map || !hasAppliedMapViewRef.current) return;
      const center = map.getCenter();
      savedMapViewRef.current = {
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      };
    };

    const removeCurrentMap = () => {
      if (choroplethLayerRef.current) {
        choroplethLayerRef.current.remove();
        choroplethLayerRef.current = null;
      }
      if (mapRef.current) {
        rememberMapView(mapRef.current);
        mapRef.current.remove();
        mapRef.current = null;
      }
      syncMapViewportRef.current = null;
      mapBoundsRef.current = null;
    };

    if (mapMode === "demographic") {
      removeCurrentMap();
      setIsMapRendering(false);
      return () => {
        cancelled = true;
      };
    }

    if (typeof window === "undefined" || !containerRef.current) {
      return () => {
        cancelled = true;
      };
    }

    const countryCounts = aggregateByCountry(visibleMarkers);
    const stateCounts = aggregateByStateCounts(visibleMarkers);
    const regionCounts = aggregateByRegionCounts(visibleMarkers);
    const maxCountryCount = Math.max(
      1,
      ...Array.from(countryCounts.values()).map((v) => v.total),
    );
    const maxStateCount = Math.max(
      1,
      ...Array.from(stateCounts.values()).map((v) => v.total),
    );
    const maxRegionCount = Math.max(
      1,
      ...Array.from(regionCounts.values()).map((v) => v.total),
    );

    setIsMapRendering(true);
    setMapRenderError(false);

    const init = async (
      tab: string,
      dark: boolean,
      mode: "pins" | "choropleth",
      groupByVal: MapGroupBy,
    ) => {
      const L = await import("leaflet");
      // @ts-expect-error - leaflet CSS has no type declarations
      await import("leaflet/dist/leaflet.css");

      if (
        cancelled ||
        generation !== mapInitGenerationRef.current ||
        !containerRef.current
      )
        return;
      removeCurrentMap();
      // If container was used by a previous map we don't have a ref to (e.g. async init), clear Leaflet's id so L.map() can run
      const container = containerRef.current;
      if ((container as any)._leaflet_id != null && !mapRef.current) {
        delete (container as any)._leaflet_id;
      }

      const worldBounds = L.latLngBounds(
        [-85.05112878, -180],
        [85.05112878, 180],
      );
      const leafletMap = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        zoomControl: false,
        maxBounds: worldBounds,
        maxBoundsViscosity: 1,
        worldCopyJump: false,
      });
      mapRef.current = leafletMap;

      const syncViewportConstraints = () => {
        if (mapRef.current !== leafletMap) return;
        leafletMap.invalidateSize({ animate: false, pan: false });
        // Reset the previous responsive floor before measuring so the minimum
        // can decrease again when moving from a wide viewport to a narrow one.
        leafletMap.setMinZoom(1);
        const boundsZoom = leafletMap.getBoundsZoom(worldBounds, true);
        const responsiveMinZoom = Number.isFinite(boundsZoom)
          ? Math.max(1, boundsZoom)
          : 1;
        leafletMap.setMinZoom(responsiveMinZoom);
        if (leafletMap.getZoom() < responsiveMinZoom) {
          leafletMap.setZoom(responsiveMinZoom, { animate: false });
        }
        leafletMap.panInsideBounds(worldBounds, { animate: false });
      };
      syncMapViewportRef.current = syncViewportConstraints;

      const resultBounds = L.latLngBounds(
        visibleMarkers.map(
          (marker) => [marker.lat, marker.lon] as [number, number],
        ),
      );
      mapBoundsRef.current = resultBounds.isValid() ? resultBounds : null;
      const captureMapView = () => rememberMapView(leafletMap);
      leafletMap.on("moveend", captureMapView);

      const finalizeMap = () => {
        if (cancelled || generation !== mapInitGenerationRef.current) return;
        syncViewportConstraints();
        const savedView = savedMapViewRef.current;
        if (savedView) {
          leafletMap.setView([savedView.center.lat, savedView.center.lng], savedView.zoom, {
            animate: false,
          });
        } else if (mapBoundsRef.current?.isValid()) {
          leafletMap.fitBounds(mapBoundsRef.current.pad(0.1), {
            animate: false,
            maxZoom: 12,
          });
          hasAppliedMapViewRef.current = true;
        }
        syncViewportConstraints();
        setIsMapRendering(false);
      };

      // Theme-aware CARTO tiles (NEXT_PUBLIC_CARTO_API_KEY from env)
      const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY ?? "";
      const tileUrl = dark
        ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`
        : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`;
      L.tileLayer(tileUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
        bounds: worldBounds,
        noWrap: true,
      }).addTo(leafletMap);

      L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

      if (mode === "choropleth" && groupByVal !== "city") {
        // Finer choropleth ranges like reference legend (0, 1-10, 10-30, ... 1000+)
        const CHOROPLETH_COLORS = [
          "#f2f2f2", // 0
          "#bfe6fb", // 1-10
          "#9bd9f8", // 10-30
          "#74c9f2", // 30-50
          "#4ab4ea", // 50-100
          "#2ea0dd", // 100-200
          "#1e89cf", // 200-300
          "#166fb5", // 300-500
          "#0f5a98", // 500-1000
          "#0b1220", // 1000+
        ];
        const CHOROPLETH_BUCKETS = [
          { min: 0, max: 0, label: "0" },
          { min: 1, max: 10, label: "1 - 10" },
          { min: 11, max: 30, label: "10 - 30" },
          { min: 31, max: 50, label: "30 - 50" },
          { min: 51, max: 100, label: "50 - 100" },
          { min: 101, max: 200, label: "100 - 200" },
          { min: 201, max: 300, label: "200 - 300" },
          { min: 301, max: 500, label: "300 - 500" },
          { min: 501, max: 1000, label: "500 - 1000" },
          { min: 1001, max: Infinity, label: "1000+" },
        ];
        const getBucketIndex = (total: number) => {
          const n = Math.floor(total);
          const i = CHOROPLETH_BUCKETS.findIndex(
            (b) => n >= b.min && n <= b.max,
          );
          return i >= 0 ? i : 0;
        };
        const getColorForBucket = (bucketIndex: number) => {
          if (bucketIndex <= 0 && dark) return "#475569";
          return CHOROPLETH_COLORS[
            Math.min(bucketIndex, CHOROPLETH_COLORS.length - 1)
          ];
        };
        const getRangeLabel = (total: number) =>
          CHOROPLETH_BUCKETS[getBucketIndex(total)].label;
        /** Darken a hex color by amount (0–1). AnyChart-style hover. */
        const darkenHex = (hex: string, amount: number): string => {
          const n = hex.replace(/^#/, "");
          let r = parseInt(n.slice(0, 2), 16);
          let g = parseInt(n.slice(2, 4), 16);
          let b = parseInt(n.slice(4, 6), 16);
          r = Math.max(0, Math.floor(r * (1 - amount)));
          g = Math.max(0, Math.floor(g * (1 - amount)));
          b = Math.max(0, Math.floor(b * (1 - amount)));
          return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        };
        const getColor = (total: number, _maxCount: number) =>
          getColorForBucket(getBucketIndex(total));

        const addChoroplethLegend = (
          map: L.Map,
          buckets: { label: string }[],
          colorFn: (i: number) => string,
        ) => {
          const Legend = (L.Control as any).extend({
            onAdd: () => {
              const div = L.DomUtil.create("div", "choropleth-legend");
              div.innerHTML = `<div class="choropleth-legend-title">Users</div><div class="choropleth-legend-bar">${buckets
                .map(
                  (_b, i) =>
                    `<div class="choropleth-legend-cell" style="background:${colorFn(i)}"></div>`,
                )
                .join("")}</div><div class="choropleth-legend-labels">${buckets
                .map(
                  (b) =>
                    `<div class="choropleth-legend-label" title="${escapeHtml(b.label)}">${escapeHtml(b.label)}</div>`,
                )
                .join("")}</div>`;
              return div;
            },
          });
          new Legend({ position: "bottomleft" }).addTo(map);
        };

        // State-level choropleth (admin 1 states/provinces)
        if (groupByVal === "state") {
          try {
            const geojson = await loadGeoJsonCached(STATE_GEOJSON_URL);
            if (
              cancelled ||
              generation !== mapInitGenerationRef.current ||
              mapRef.current !== leafletMap
            )
              return;
            const stateCountsNorm = new Map<string, Counts>();
            for (const [k, v] of stateCounts) {
              stateCountsNorm.set(normalizeKey(k), v);
            }
            const getStateCount = (stateName: string, countryName: string) => {
              const key = `${String(stateName).trim()}, ${String(countryName).trim()}`;
              const exact = stateCounts.get(key);
              if (exact) return exact;
              const keyNorm = normalizeKey(key);
              for (const [k, data] of stateCountsNorm) {
                if (k === keyNorm || k.includes(keyNorm) || keyNorm.includes(k))
                  return data;
              }
              for (const [k, data] of stateCounts) {
                const kNorm = normalizeKey(k);
                if (
                  kNorm === keyNorm ||
                  (k.includes(countryName) && k.includes(stateName))
                )
                  return data;
              }
              return null;
            };
            const geoLayer = L.geoJSON(geojson, {
              style: (feature) => {
                const name =
                  feature?.properties?.name ?? feature?.properties?.NAME ?? "";
                const country =
                  feature?.properties?.admin ??
                  feature?.properties?.adm0_name ??
                  feature?.properties?.ADMIN ??
                  "";
                const data = getStateCount(name, country);
                const total = data?.total ?? 0;
                return {
                  fillColor: getColor(total, maxStateCount),
                  weight: 1,
                  opacity: 1,
                  color: dark ? "#475569" : "#94a3b8",
                  fillOpacity: 0.85,
                };
              },
              onEachFeature: (feature, layer) => {
                const pathLayer = layer as L.Path;
                const name =
                  feature?.properties?.name ?? feature?.properties?.NAME ?? "—";
                const country =
                  feature?.properties?.admin ??
                  feature?.properties?.adm0_name ??
                  "";
                const data = getStateCount(String(name), String(country));
                const total = data?.total ?? 0;
                const rangeLabel = getRangeLabel(total);
                const fillColor = getColorForBucket(getBucketIndex(total));
                const parts: string[] = [];
                if (tab === "all") {
                  if ((data?.admins ?? 0) > 0)
                    parts.push(`Admins: ${data?.admins ?? 0}`);
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                } else {
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                }
                const line = parts.length ? parts.join(" · ") : "—";
                const label = country ? `${name}, ${country}` : name;
                layer.bindTooltip(
                  `<div class="users-map-tooltip"><h6 class="choropleth-total">${escapeHtml(String(label))}</h6><span class="text-muted">${escapeHtml(line)}</span><br/><span class="choropleth-total"><b>${total}</b> users</span> <span class="choropleth-range">(${escapeHtml(rangeLabel)})</span></div>`,
                  { className: "users-map-marker-tooltip", direction: "top" },
                );
                const hoverFill = darkenHex(fillColor, 0.2);
                pathLayer.on("mouseover", () => {
                  pathLayer.setStyle({
                    fillColor: hoverFill,
                    fillOpacity: 0.95,
                  });
                  pathLayer.bringToFront();
                });
                pathLayer.on("mouseout", () => {
                  pathLayer.setStyle({ fillColor, fillOpacity: 0.85 });
                });
              },
            }).addTo(leafletMap);
            choroplethLayerRef.current = geoLayer;
            addChoroplethLegend(
              leafletMap,
              CHOROPLETH_BUCKETS,
              getColorForBucket,
            );
            finalizeMap();
            return;
          } catch {
            // Fallback to pins
          }
        }

        // Country-level choropleth (for groupBy country; city uses pins only)
        if (groupByVal === "country") {
          try {
            const geojson = await loadGeoJsonCached(WORLD_GEOJSON_URL);
            if (
              cancelled ||
              generation !== mapInitGenerationRef.current ||
              mapRef.current !== leafletMap
            )
              return;
            const getCount = (geoName: string) => {
              if (!geoName) return null;
              const n = String(geoName).trim();
              const exact = countryCounts.get(n);
              if (exact) return exact;
              for (const [ourCountry, data] of countryCounts) {
                if (
                  ourCountry === n ||
                  n.includes(ourCountry) ||
                  ourCountry.includes(n)
                )
                  return data;
              }
              return null;
            };
            const geoLayer = L.geoJSON(geojson, {
              style: (feature) => {
                const name =
                  feature?.properties?.NAME ??
                  feature?.properties?.name ??
                  feature?.properties?.ADMIN ??
                  "";
                const data = getCount(name);
                const total = data?.total ?? 0;
                return {
                  fillColor: getColor(total, maxCountryCount),
                  weight: 1,
                  opacity: 1,
                  color: dark ? "#475569" : "#94a3b8",
                  fillOpacity: 0.85,
                };
              },
              onEachFeature: (feature, layer) => {
                const pathLayer = layer as L.Path;
                const name =
                  feature?.properties?.NAME ??
                  feature?.properties?.name ??
                  feature?.properties?.ADMIN ??
                  "—";
                const data = getCount(String(name));
                const total = data?.total ?? 0;
                const rangeLabel = getRangeLabel(total);
                const fillColor = getColorForBucket(getBucketIndex(total));
                const parts: string[] = [];
                if (tab === "all") {
                  if ((data?.admins ?? 0) > 0)
                    parts.push(`Admins: ${data?.admins ?? 0}`);
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                } else {
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                }
                const line = parts.length ? parts.join(" · ") : "—";
                pathLayer.bindTooltip(
                  `<div class="users-map-tooltip"><h6 class="choropleth-total">${escapeHtml(String(name))}</h6><span class="text-muted">${escapeHtml(line)}</span><br/><span class="choropleth-total"><b>${total}</b> users</span> <span class="choropleth-range">(${escapeHtml(rangeLabel)})</span></div>`,
                  { className: "users-map-marker-tooltip", direction: "top" },
                );
                const hoverFillCountry = darkenHex(fillColor, 0.2);
                pathLayer.on("mouseover", () => {
                  pathLayer.setStyle({
                    fillColor: hoverFillCountry,
                    fillOpacity: 0.95,
                  });
                  pathLayer.bringToFront();
                });
                pathLayer.on("mouseout", () => {
                  pathLayer.setStyle({ fillColor, fillOpacity: 0.85 });
                });
              },
            }).addTo(leafletMap);
            choroplethLayerRef.current = geoLayer;
            addChoroplethLegend(
              leafletMap,
              CHOROPLETH_BUCKETS,
              getColorForBucket,
            );
            finalizeMap();
            return;
          } catch {
            // Fallback to pins
          }
        }

        // Region-level: color countries by their region's total count
        if (groupByVal === "region") {
          try {
            const geojson = await loadGeoJsonCached(WORLD_GEOJSON_URL);
            if (
              cancelled ||
              generation !== mapInitGenerationRef.current ||
              mapRef.current !== leafletMap
            )
              return;
            const getRegionCountByCountry = (
              geoName: string,
              continent?: string | null,
            ) => {
              if (!geoName) return null;
              const canonical = getCanonicalCountry(geoName);
              let region = countryToRegionMap[canonical];
              if (
                region === undefined &&
                continent &&
                regionCounts.has(String(continent))
              )
                region = String(continent);
              region = region ?? canonical;
              return regionCounts.get(region) ?? null;
            };
            const getRegionForFeature = (
              geoName: string,
              continent?: string | null,
            ) => {
              const canonical = getCanonicalCountry(geoName);
              let region = countryToRegionMap[canonical];
              if (
                region === undefined &&
                continent &&
                regionCounts.has(String(continent))
              )
                region = String(continent);
              return region ?? canonical;
            };
            // Map region name -> { pathLayers, fillColor } so hover highlights whole region
            const regionToLayers = new Map<
              string,
              { pathLayers: L.Path[]; fillColor: string }
            >();
            // Single shared tooltip for the whole region so it closes when moving to another region
            const regionSharedTooltip = L.tooltip({
              permanent: false,
              direction: "top",
              className: "users-map-marker-tooltip",
            });
            const geoLayer = L.geoJSON(geojson, {
              style: (feature) => {
                const name =
                  feature?.properties?.NAME ??
                  feature?.properties?.name ??
                  feature?.properties?.ADMIN ??
                  "";
                const continent =
                  feature?.properties?.CONTINENT ??
                  feature?.properties?.REGION_UN ??
                  null;
                const data = getRegionCountByCountry(name, continent);
                const total = data?.total ?? 0;
                return {
                  fillColor: getColor(total, maxRegionCount),
                  weight: 1,
                  opacity: 1,
                  color: dark ? "#475569" : "#94a3b8",
                  fillOpacity: 0.85,
                };
              },
              onEachFeature: (feature, layer) => {
                const pathLayer = layer as L.Path;
                const name =
                  feature?.properties?.NAME ??
                  feature?.properties?.name ??
                  feature?.properties?.ADMIN ??
                  "—";
                const continent =
                  feature?.properties?.CONTINENT ??
                  feature?.properties?.REGION_UN ??
                  null;
                const region = getRegionForFeature(String(name), continent);
                const data = regionCounts.get(region) ?? null;
                const total = data?.total ?? 0;
                const rangeLabel = getRangeLabel(total);
                const fillColor = getColorForBucket(getBucketIndex(total));
                if (!regionToLayers.has(region)) {
                  regionToLayers.set(region, { pathLayers: [], fillColor });
                }
                regionToLayers.get(region)!.pathLayers.push(pathLayer);
                const parts: string[] = [];
                if (tab === "all") {
                  if ((data?.admins ?? 0) > 0)
                    parts.push(`Admins: ${data?.admins ?? 0}`);
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                } else {
                  if ((data?.brands ?? 0) > 0)
                    parts.push(`Brands: ${data?.brands ?? 0}`);
                  if ((data?.creators ?? 0) > 0)
                    parts.push(`Creators: ${data?.creators ?? 0}`);
                }
                const line = parts.length ? parts.join(" · ") : "—";
                const tooltipContent = `<div class="users-map-tooltip"><h6 class="choropleth-total">${escapeHtml(region)}</h6><span class="text-muted">${escapeHtml(line)}</span><br/><span class="choropleth-total"><b>${total}</b> users</span> <span class="choropleth-range">(${escapeHtml(rangeLabel)})</span></div>`;
                pathLayer.on("mouseover", (e: L.LeafletMouseEvent) => {
                  regionSharedTooltip.remove();
                  regionSharedTooltip
                    .setContent(tooltipContent)
                    .setLatLng(e.latlng)
                    .addTo(leafletMap);
                  // Reset all regions first so previous hover is cleared when moving between regions
                  regionToLayers.forEach((entry) => {
                    entry.pathLayers.forEach((p) => {
                      p.setStyle({
                        fillColor: entry.fillColor,
                        fillOpacity: 0.85,
                      });
                    });
                  });
                  const entry = regionToLayers.get(region);
                  if (entry) {
                    const hoverFillRegion = darkenHex(entry.fillColor, 0.2);
                    entry.pathLayers.forEach((p) => {
                      p.setStyle({
                        fillColor: hoverFillRegion,
                        fillOpacity: 0.95,
                      });
                      p.bringToFront();
                    });
                  }
                });
                pathLayer.on("mouseout", () => {
                  regionSharedTooltip.remove();
                  const entry = regionToLayers.get(region);
                  if (entry) {
                    entry.pathLayers.forEach((p) => {
                      p.setStyle({
                        fillColor: entry.fillColor,
                        fillOpacity: 0.85,
                      });
                    });
                  }
                });
              },
            }).addTo(leafletMap);
            choroplethLayerRef.current = geoLayer;
            // When mouse moves over ocean (not over any choropleth path), clear hover and tooltip
            const clearRegionHover = () => {
              regionSharedTooltip.remove();
              regionToLayers.forEach((entry) => {
                entry.pathLayers.forEach((p) => {
                  p.setStyle({
                    fillColor: entry.fillColor,
                    fillOpacity: 0.85,
                  });
                });
              });
            };
            const pathElements = new Set<HTMLElement | SVGElement>();
            regionToLayers.forEach((entry) => {
              entry.pathLayers.forEach((p) => {
                const el = (
                  p as unknown as { _path?: HTMLElement | SVGElement }
                )._path;
                if (el) pathElements.add(el);
              });
            });
            leafletMap.on("mousemove", (e: L.LeafletMouseEvent) => {
              const target = (e.originalEvent?.target as Node) ?? null;
              if (!target) return;
              const isOverChoropleth = Array.from(pathElements).some(
                (el) => el === target || el.contains(target),
              );
              if (!isOverChoropleth) clearRegionHover();
            });
            addChoroplethLegend(
              leafletMap,
              CHOROPLETH_BUCKETS,
              getColorForBucket,
            );
            finalizeMap();
            return;
          } catch {
            // Fallback to pins
          }
        }
      }

      // Pins mode
      const pinColor =
        tab === "advertisers"
          ? "#a78bfa"
          : tab === "creators"
            ? "#34d399"
            : "#60a5fa";
      const pinStroke = dark ? "#1e293b" : "#ffffff";
      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" width="28" height="40">
        <defs><filter id="pin-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity="0.25"/></filter></defs>
        <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${pinColor}" stroke="${pinStroke}" stroke-width="2" filter="url(#pin-shadow)" />
      </svg>`;
      const PinIcon = L.divIcon({
        className: "custom-pin",
        html: pinSvg,
        iconSize: [28, 40],
        iconAnchor: [14, 40],
        popupAnchor: [0, -40],
      });

      locationAggregates.forEach((loc) => {
        const parts: string[] = [];
        if (tab === "all") {
          if (loc.users > 0) parts.push(`Users: ${loc.users}`);
          if (loc.admins > 0) parts.push(`Admins: ${loc.admins}`);
          if (loc.brands > 0) parts.push(`Advertisers: ${loc.brands}`);
          if (loc.creators > 0) parts.push(`Creators: ${loc.creators}`);
        } else if (tab === "advertisers") {
          if (loc.brands > 0) parts.push(`Brands: ${loc.brands}`);
        } else if (tab === "creators") {
          if (loc.creators > 0) parts.push(`Creators: ${loc.creators}`);
        }
        const countsLine = parts.length ? parts.join(", ") : "—";
        const metricRows = renderMapMetricRows(getMapMetricRows(loc, tab));
        const locationLabelEscaped = escapeHtml(loc.label).replace(
          /"/g,
          "&quot;",
        );
        // Hover tooltip: location + brands/creators (and admins when all)
        const tooltipParts: string[] = [];
        if (tab === "all") {
          if (loc.users > 0) tooltipParts.push(`Users: ${loc.users}`);
          if (loc.admins > 0) tooltipParts.push(`Admins: ${loc.admins}`);
          if (loc.brands > 0) tooltipParts.push(`Brands: ${loc.brands}`);
          if (loc.creators > 0) tooltipParts.push(`Creators: ${loc.creators}`);
        } else if (tab === "advertisers") {
          if (loc.users > 0) tooltipParts.push(`Users: ${loc.users}`);
          if (loc.brands > 0) tooltipParts.push(`Advertisers: ${loc.brands}`);
        } else if (tab === "creators") {
          if (loc.users > 0) tooltipParts.push(`Users: ${loc.users}`);
          if (loc.creators > 0) tooltipParts.push(`Creators: ${loc.creators}`);
        }
        const tooltipLine = tooltipParts.length
          ? tooltipParts.join(" · ")
          : "—";
        const tooltipHtml = `<div class="users-map-tooltip"><strong>${escapeHtml(loc.label)}</strong>${metricRows}</div>`;

        const marker = L.marker([loc.lat, loc.lon], { icon: PinIcon })
          .addTo(leafletMap)
          .bindTooltip(tooltipHtml, {
            direction: "top",
            permanent: false,
            className: "users-map-marker-tooltip",
            offset: [0, -20],
          })
          .bindPopup(
            `<div class="users-map-popup min-w-[200px] text-left">
              <p class="popup-title">${escapeHtml(loc.label)}</p>
              ${metricRows}
              <button type="button" class="view-detail-btn" data-location-label="${locationLabelEscaped}">View users</button>
            </div>`,
          );
      });

      leafletMap.on(
        "popupopen",
        (e: { popup: { getElement(): HTMLElement } }) => {
          const popupEl = e.popup.getElement();
          const btn = popupEl?.querySelector(".view-detail-btn");
          if (btn) {
            const handler = () => {
              const label = btn.getAttribute("data-location-label");
              if (label) setDetailLocationRef.current?.(decodeHtml(label));
              (leafletMap as { closePopup(): void }).closePopup();
            };
            btn.addEventListener("click", handler);
            const once = () => {
              btn.removeEventListener("click", handler);
              leafletMap.off("popupclose", once);
            };
            leafletMap.once("popupclose", once);
          }
        },
      );

      finalizeMap();
    };

    void init(activeTab, isDark, mapMode, groupBy).catch((error) => {
      if (cancelled || generation !== mapInitGenerationRef.current) return;
      console.error("Unable to initialize users map:", error);
      setMapRenderError(true);
      setIsMapRendering(false);
    });
    return () => {
      cancelled = true;
      removeCurrentMap();
    };
  }, [
    activeTab,
    groupBy,
    isDark,
    isMapFullscreen,
    locationAggregates,
    mapMode,
    mapRenderNonce,
    visibleMarkers,
  ]);

  const pinLegendColor =
    activeTab === "advertisers"
      ? "#a78bfa"
      : activeTab === "creators"
        ? "#34d399"
        : "#60a5fa";

  const selectedMapTab: MapTab =
    activeTab === "advertisers" || activeTab === "creators"
      ? activeTab
      : "all";
  const hasGeographyFilters = Object.values(geographyFilters).some(
    (value) => value !== "all",
  );
  const activeFilterChips = (
    [
      ["region", geographyFilters.region],
      ["country", geographyFilters.country],
      ["state", geographyFilters.state],
      ["city", geographyFilters.city],
    ] as Array<[keyof MapGeographyFilters, string]>
  ).filter(([, value]) => value !== "all");
  const hasMapError = loadError || mapRenderError;

  const fitToResults = useCallback(() => {
    const map = mapRef.current;
    const bounds = mapBoundsRef.current;
    if (!map || !bounds?.isValid()) return;
    map.fitBounds(bounds.pad(0.12), { animate: true, maxZoom: 12 });
    window.requestAnimationFrame(() => syncMapViewportRef.current?.());
  }, []);

  const resetMapView = useCallback(() => {
    savedMapViewRef.current = null;
    const map = mapRef.current;
    if (!map) return;
    map.setView([20, 0], Math.max(2, map.getMinZoom()), { animate: true });
    window.requestAnimationFrame(() => syncMapViewportRef.current?.());
  }, []);

  const retryMap = useCallback(() => {
    setMapRenderError(false);
    setMapRenderNonce((current) => current + 1);
    onRetry();
  }, [onRetry]);

  const selectClassName = cn(
    "h-9 w-full rounded-lg border px-2.5 text-sm outline-none transition focus:ring-2 focus:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-100",
    isDark
      ? "border-white/10 bg-slate-900/90 text-slate-100 disabled:text-slate-500"
      : "border-slate-200 bg-white text-slate-900 shadow-sm disabled:bg-slate-100 disabled:text-slate-500",
  );
  const fullscreenSelectClassName =
    "h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-sm font-medium text-slate-100 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/40 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/80 disabled:text-slate-500 disabled:opacity-100 [&>option]:bg-slate-900 [&>option]:text-slate-100";

  const renderGeographyControls = (variant: "normal" | "drawer") => {
    const isDrawer = variant === "drawer";
    const geographySelectClassName = isDrawer
      ? fullscreenSelectClassName
      : selectClassName;
    const geographyLabelClassName = isDrawer
      ? "text-slate-300"
      : isDark
        ? "text-slate-300"
        : "text-slate-600";
    return (
      <div
        className={cn(
          isDrawer
            ? "grid min-w-0 gap-3"
            : "grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4",
        )}
      >
        <label className="grid min-w-0 gap-1 text-xs font-medium">
          <span className={geographyLabelClassName}>
            Region
          </span>
          <select
            value={geographyFilters.region}
            onChange={(event) =>
              updateGeographyFilter("region", event.target.value)
            }
            className={geographySelectClassName}
          >
            <option value="all">All regions</option>
            {regionOptions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-medium">
          <span className={geographyLabelClassName}>
            Country
          </span>
          <select
            value={geographyFilters.country}
            onChange={(event) =>
              updateGeographyFilter("country", event.target.value)
            }
            className={geographySelectClassName}
          >
            <option value="all">All countries</option>
            {countryOptions.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-medium">
          <span className={geographyLabelClassName}>
            State
          </span>
          <select
            value={geographyFilters.state}
            onChange={(event) =>
              updateGeographyFilter("state", event.target.value)
            }
            disabled={geographyFilters.country === "all"}
            className={geographySelectClassName}
          >
            <option value="all">
              {geographyFilters.country === "all"
                ? "Select country first"
                : "All states"}
            </option>
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-medium">
          <span className={geographyLabelClassName}>
            City
          </span>
          <select
            value={geographyFilters.city}
            onChange={(event) => updateGeographyFilter("city", event.target.value)}
            disabled={geographyFilters.state === "all"}
            className={geographySelectClassName}
          >
            <option value="all">
              {geographyFilters.state === "all"
                ? "Select state first"
                : "All cities"}
            </option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  };

  const renderVisualizationControls = (
    variant: "normal" | "drawer" = "normal",
  ) => {
    const isDrawer = variant === "drawer";
    const options = [
      ["pins", "Pins", MapPin],
      ...(groupBy === "city"
        ? []
        : ([ ["choropleth", "Choropleth", BarChart3] ] as const)),
      ["demographic", "Demographic", Layers3],
    ] as const;

    return (
      <div
        className={cn(
          "grid min-w-0 gap-1 rounded-xl border p-1",
          options.length === 2 ? "grid-cols-2" : "grid-cols-3",
          isDrawer
            ? "border-slate-700/80 bg-slate-950/80"
            : isDark
              ? "border-white/10 bg-slate-900/70"
              : "border-slate-200/80 bg-slate-100/80",
        )}
        role="group"
        aria-label="Map visualization"
      >
        {options.map(([value, label, Icon]) => {
          const isSelected = mapMode === value;
          return (
            <Button
              key={value}
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 min-w-0 gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-purple-400",
                isDrawer &&
                  "max-[389px]:h-12 max-[389px]:flex-col max-[389px]:gap-0.5 max-[389px]:px-1 max-[389px]:text-[11px]",
                isDrawer && isSelected &&
                  "bg-purple-500 text-white shadow-sm hover:bg-purple-400 hover:text-white",
                isDrawer && !isSelected &&
                  "text-slate-300 hover:bg-slate-800 hover:text-white",
                !isDrawer && isSelected && isDark &&
                  "bg-slate-700 text-white shadow-sm hover:bg-slate-600 hover:text-white",
                !isDrawer && isSelected && !isDark &&
                  "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 hover:bg-white hover:text-slate-950",
                !isDrawer && !isSelected && isDark &&
                  "text-slate-300 hover:bg-white/10 hover:text-white",
                !isDrawer && !isSelected && !isDark &&
                  "text-slate-600 hover:bg-white hover:text-slate-950",
              )}
              onClick={() =>
                setMapMode(value as "pins" | "choropleth" | "demographic")
              }
              aria-pressed={isSelected}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </Button>
          );
        })}
      </div>
    );
  };

  const renderMapDataTabs = () => (
    <div className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-slate-700/80 bg-slate-950/80 p-1">
      {(
        [
          ["all", "Users", Users],
          ["advertisers", "Advertisers", Building2],
          ["creators", "Creators", UserRound],
        ] as const
      ).map(([tab, label, Icon]) => (
        <Button
          key={tab}
          variant="ghost"
          size="sm"
          className={cn(
            "h-12 min-w-0 flex-col gap-0.5 rounded-lg px-1 text-slate-300 transition-colors duration-200 hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400",
            selectedMapTab === tab &&
              "bg-purple-500 text-white shadow-sm hover:bg-purple-400 hover:text-white",
          )}
          onClick={() => onActiveTabChange(tab)}
          aria-pressed={selectedMapTab === tab}
        >
          <span className="flex min-w-0 max-w-full items-center gap-1 text-[11px] font-semibold sm:text-xs">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <span className="text-[10px] font-medium tabular-nums opacity-80">
            {tabCounts[tab].toLocaleString()}
          </span>
        </Button>
      ))}
    </div>
  );

  const renderFullscreenDrawerContent = () => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
      <section className="space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-400">
          Map data
        </p>
        {renderMapDataTabs()}
      </section>
      <section className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-400">
          Geography
        </p>
        {renderGeographyControls("drawer")}
      </section>
      <section className="mt-4 space-y-3 border-t border-white/10 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-400">
          Visualization
        </p>
        <label className="grid gap-1 text-xs font-medium text-slate-300">
          <span>Aggregate by</span>
          <select
            value={groupBy}
            onChange={(event) =>
              onGroupByChange(event.target.value as MapGroupBy)
            }
            className={fullscreenSelectClassName}
          >
            <option value="region">Regions</option>
            <option value="country">Countries</option>
            <option value="state">States</option>
            <option value="city">Cities</option>
          </select>
        </label>
        {renderVisualizationControls("drawer")}
      </section>
      <section className="mt-4 space-y-2 border-t border-white/10 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-400">
          Map actions
        </p>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 justify-start gap-1.5 border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800 hover:text-white disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500 disabled:opacity-100"
            onClick={fitToResults}
            disabled={
              mapMode === "demographic" ||
              visibleMarkers.length === 0 ||
              isMapRendering
            }
          >
            <LocateFixed className="h-3.5 w-3.5" />
            Fit results
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 justify-start gap-1.5 border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800 hover:text-white disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500 disabled:opacity-100"
            onClick={resetMapView}
            disabled={mapMode === "demographic" || isMapRendering}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset view
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 justify-start gap-1.5 border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800 hover:text-white disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500 disabled:opacity-100 min-[360px]:col-span-2"
            onClick={clearGeographyFilters}
            disabled={!hasGeographyFilters}
          >
            <FilterX className="h-3.5 w-3.5" />
            Clear geography filters
          </Button>
        </div>
      </section>
      <p className="mt-5 text-xs leading-5 text-slate-400">
        Showing {withLocationCount.toLocaleString()} mapped record
        {withLocationCount === 1 ? "" : "s"} from {totalInTab.toLocaleString()} selected user
        {totalInTab === 1 ? "" : "s"}.
      </p>
    </div>
  );

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      <style>{`
        .custom-pin.leaflet-marker-icon { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05); padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 0; min-width: 200px; }
        .users-map-popup { padding: 14px 16px; font-family: inherit; }
        .users-map-popup .popup-title { font-weight: 600; font-size: 0.9375rem; color: #0f172a; margin: 0; line-height: 1.3; }
        .users-map-popup .popup-counts { font-size: 0.8125rem; color:rgb(44, 47, 53); margin: 6px 0 12px; line-height: 1.4; }
        .users-map-metrics { display: grid; gap: 4px; margin: 8px 0 12px; }
        .users-map-metrics > div { display: flex; align-items: center; justify-content: space-between; gap: 20px; font-size: 12px; line-height: 1.25; }
        .users-map-metrics dt { color: #64748b; }
        .users-map-metrics dd { margin: 0; color: #0f172a; font-weight: 600; font-variant-numeric: tabular-nums; }
        .users-map-popup .view-detail-btn { width: 100%; border-radius: 8px; padding: 8px 12px; font-size: 0.8125rem; font-weight: 500; background: #3b82f6; color: #fff; border: none; cursor: pointer; transition: background 0.15s, transform 0.1s; }
        .users-map-popup .view-detail-btn:hover { background: #2563eb; }
        .users-map-popup .view-detail-btn:active { transform: scale(0.98); }
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a { width: 32px !important; height: 32px !important; line-height: 32px !important; font-size: 18px !important; border-radius: 8px !important; background: #fff !important; color: #334155 !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
        .leaflet-control-zoom a:hover { background: #f1f5f9 !important; }
        .leaflet-control-zoom-in { margin-bottom: 4px !important; }
        .leaflet-control-attribution { font-size: 10px !important; opacity: 0.85; }
        .users-map-dark .leaflet-control-attribution a { color: #94a3b8 !important; }
        .users-map-marker-tooltip { padding: 8px 12px !important; border-radius: 8px !important; font-size: 12px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; border: 1px solid rgba(0,0,0,0.08) !important; }
        .users-map-tooltip strong { display: block; margin-bottom: 4px; }
        .users-map-tooltip .users-map-metrics { margin: 6px 0 0; min-width: 132px; }
        .users-map-tooltip .text-muted { color: #64748b; font-size: 11px; }
        /* Remove black border/outline on choropleth click (focus ring) */
        .leaflet-interactive:focus, .leaflet-interactive:active, .leaflet-interactive:focus-visible { outline: none !important; outline-offset: 0 !important; box-shadow: none !important; }
        .leaflet-pane path.leaflet-interactive, .leaflet-pane svg path.leaflet-interactive { outline: none !important; }
        /* Choropleth legend (AnyChart-style color range) */
        .choropleth-legend { box-sizing: border-box; width: min(26rem, calc(100vw - 5rem)); max-width: 100%; overflow: hidden; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.96); box-shadow: 0 8px 24px rgba(15,23,42,0.14); border: 1px solid rgba(15,23,42,0.08); font-size: 11px; line-height: 1.35; }
        .leaflet-control .choropleth-legend { margin: 0; }
        .choropleth-legend-title { font-weight: 600; margin-bottom: 8px; color: #0f172a; font-size: 13px; }
        .choropleth-legend-bar { display: flex; flex-wrap: nowrap; gap: 0; align-items: stretch; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); }
        .choropleth-legend-cell { flex: 1; min-width: 0; height: 12px; }
        .choropleth-legend-cell:first-child { border-radius: 5px 0 0 5px; }
        .choropleth-legend-cell:last-child { border-radius: 0 5px 5px 0; }
        .choropleth-legend-labels { margin-top: 6px; display: flex; gap: 0; }
        .choropleth-legend-label { flex: 1; min-width: 0; overflow: hidden; text-align: center; color: #0f172a; font-weight: 600; font-size: clamp(7px, 1.7vw, 10px); }
        .choropleth-range { opacity: 0.9; font-size: 11px; }
        .users-map-tooltip .choropleth-total { font-size: 14px; font-weight: 400; margin: 0.2rem 0; }
        .users-map-dark .choropleth-legend { background: rgba(15,23,42,0.96); border-color: rgba(255,255,255,0.12); }
        .users-map-dark .choropleth-legend-title { color: #e2e8f0; }
        .users-map-dark .choropleth-legend-label { color: #e2e8f0; }
      `}</style>
      {/* The portal escapes dashboard compact-mode zoom and uses the real viewport. */}
      <FullscreenViewportPortal active={isMapFullscreen}>
        <div
          ref={workspaceRef}
          className={cn(
            "relative z-0 flex min-w-0 flex-col gap-3",
            detailLocation && "hidden",
            isMapFullscreen &&
              (isDark
                ? "fixed inset-0 z-[200] h-[100dvh] w-screen overflow-hidden bg-slate-950 p-2 sm:p-3 lg:p-4"
                : "fixed inset-0 z-[200] h-[100dvh] w-screen overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4"),
          )}
          role={isMapFullscreen ? "region" : undefined}
          aria-label={isMapFullscreen ? "Fullscreen users map" : undefined}
        >
        {!isMapFullscreen && (
          <div
            className={cn(
              "rounded-2xl border p-2.5 sm:p-3",
              isDark
                ? "border-white/10 bg-slate-900/45"
                : "border-slate-200/80 bg-slate-50/70",
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2 xl:flex xl:items-center">
                <div
                  className={cn(
                    "grid min-w-0 grid-cols-4 gap-1 rounded-xl border p-1",
                    isDark
                      ? "border-white/10 bg-slate-900/70"
                      : "border-slate-200/80 bg-slate-100/80",
                  )}
                  role="group"
                  aria-label="Aggregate map by"
                >
                  {(
                    [
                      ["region", "Regions"],
                      ["country", "Countries"],
                      ["state", "States"],
                      ["city", "Cities"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 min-w-0 rounded-lg px-1.5 text-xs font-semibold transition-colors duration-200 sm:px-2.5",
                        groupBy === value && isDark &&
                          "bg-slate-700 text-white shadow-sm hover:bg-slate-600 hover:text-white",
                        groupBy === value && !isDark &&
                          "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200 hover:bg-white hover:text-slate-950",
                        groupBy !== value && isDark &&
                          "text-slate-300 hover:bg-white/10 hover:text-white",
                        groupBy !== value && !isDark &&
                          "text-slate-600 hover:bg-white hover:text-slate-950",
                      )}
                      onClick={() => onGroupByChange(value)}
                      aria-pressed={groupBy === value}
                    >
                      <span className="truncate">{label}</span>
                    </Button>
                  ))}
                </div>
                {renderVisualizationControls()}
              </div>
              <Button
                ref={fullscreenTriggerRef}
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 w-full shrink-0 gap-1.5 rounded-lg px-3 shadow-sm sm:w-auto",
                  isDark &&
                    "border-white/15 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white",
                )}
                onClick={() => void enterMapFullscreen()}
                aria-label="View map fullscreen"
                title="View map fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
                Full screen
              </Button>
            </div>
            <div
              className={cn(
                "mt-3 grid min-w-0 gap-3 border-t pt-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-end",
                isDark ? "border-white/10" : "border-slate-200/80",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] lg:pb-2",
                  isDark ? "text-purple-300" : "text-purple-700",
                )}
              >
                <Layers3 className="h-3.5 w-3.5" />
                Geography
              </div>
              {renderGeographyControls("normal")}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 w-full gap-1.5 px-3 sm:w-auto",
                    isDark
                      ? "text-slate-300 hover:bg-white/10 hover:text-white disabled:text-slate-600"
                      : "text-slate-600 hover:bg-white hover:text-slate-950 disabled:text-slate-400",
                  )}
                  onClick={clearGeographyFilters}
                  disabled={!hasGeographyFilters}
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}
        {isMapFullscreen && (
          <>
            <div className="absolute left-3 top-3 z-[1200] flex max-w-[calc(100%-9rem)] items-center gap-2 rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2 text-slate-100 shadow-lg backdrop-blur-md sm:left-4 sm:top-4">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: pinLegendColor }}
              />
              <span className="hidden text-sm font-semibold sm:inline">
                Geographic explorer
              </span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium">
                {tabLabel}
              </span>
              <span className="truncate text-xs text-slate-300">
                {withLocationCount.toLocaleString()} mapped
              </span>
            </div>

            <Button
              ref={fullscreenExitRef}
              variant="outline"
              size="sm"
              className="absolute right-3 top-3 z-[1201] h-9 gap-1.5 border-white/15 bg-slate-950/80 px-3 text-slate-100 shadow-lg backdrop-blur-md hover:bg-slate-800 hover:text-white sm:right-4 sm:top-4"
              onClick={exitMapFullscreen}
              aria-label="Exit fullscreen map"
              title="Exit fullscreen (Esc)"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Exit fullscreen</span>
            </Button>

            {activeFilterChips.length > 0 && (
              <div className="absolute left-3 top-14 z-[1200] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5 sm:left-4 sm:top-[4.5rem]">
                {activeFilterChips.map(([filter, value]) => (
                  <button
                    key={filter}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-slate-100 shadow-sm backdrop-blur-md transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    onClick={() => updateGeographyFilter(filter, "all")}
                    aria-label={`Clear ${filter} filter: ${value}`}
                    title={`Clear ${filter} filter`}
                  >
                    <span className="max-w-40 truncate">{value}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {!isDrawerOpen && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-0 top-1/2 z-[1200] hidden h-12 -translate-y-1/2 rounded-r-none border-slate-700 bg-slate-950/90 px-2 text-slate-100 shadow-lg backdrop-blur-md hover:bg-slate-800 hover:text-white lg:flex"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Open map controls"
                  title="Open map controls"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute bottom-24 right-3 z-[1200] h-10 gap-1.5 border-slate-700 bg-slate-950/90 text-slate-100 shadow-lg backdrop-blur-md hover:bg-slate-800 hover:text-white lg:hidden"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Open map controls"
                >
                  <PanelRightOpen className="h-4 w-4" />
                  Controls
                </Button>
              </>
            )}

            <aside
              aria-label="Map controls"
              className={cn(
                "absolute bottom-4 right-4 top-16 z-[1200] hidden w-[clamp(20rem,24vw,23rem)] max-w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-200 motion-reduce:transition-none lg:flex",
                isDrawerOpen
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Map controls</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Adjust data, geography, and display.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Collapse map controls"
                  title="Collapse map controls"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              {renderFullscreenDrawerContent()}
            </aside>

            <aside
              aria-label="Map controls"
              className={cn(
                "absolute bottom-2 left-1/2 z-[1200] flex max-h-[calc(100dvh-4.5rem)] w-[calc(100vw-1rem)] max-w-[42rem] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-200 motion-reduce:transition-none sm:bottom-3 sm:w-[calc(100vw-1.5rem)] lg:hidden",
                isDrawerOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-[calc(100%+1rem)] opacity-0",
              )}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Map controls</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Explore without leaving the map.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-300 hover:bg-white/10 hover:text-white"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close map controls"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {renderFullscreenDrawerContent()}
            </aside>
          </>
        )}

        {mapMode === "demographic" ? (
          <div
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border",
              !isMapFullscreen &&
                "mt-2 h-[clamp(24rem,58dvh,42rem)] min-h-[24rem]",
              isMapFullscreen &&
                (activeFilterChips.length > 2
                  ? "mt-40 min-h-0 flex-1"
                  : activeFilterChips.length > 0
                    ? "mt-32 min-h-0 flex-1"
                    : "mt-14 min-h-0 flex-1"),
              isDark
                ? "border-white/10 bg-slate-950/70"
                : "border-slate-200/80 bg-white",
            )}
          >
            <div
              className={cn(
                "flex shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                isDark
                  ? "border-white/10 bg-slate-900/90"
                  : "border-slate-200 bg-slate-50/90",
              )}
            >
              <div className="min-w-0">
                <h3
                  className={cn(
                    "truncate text-sm font-semibold",
                    isDark ? "text-slate-100" : "text-slate-900",
                  )}
                >
                  {tabLabel} by {demographicGroupLabel.toLowerCase()}
                </h3>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  {withLocationCount.toLocaleString()} mapped {tabLabel.toLowerCase()} across{" "}
                  {sortedDemographicRows.length.toLocaleString()} {demographicGroupPlural}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {demographicSort.column && demographicSort.order && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      isDark
                        ? "bg-purple-500/15 text-purple-300"
                        : "bg-purple-100 text-purple-700",
                    )}
                  >
                    {demographicSort.order === "desc" ? "Highest first" : "Lowest first"}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
                    isDark
                      ? "border-slate-700 bg-slate-900 text-slate-300"
                      : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {sortedDemographicRows.length.toLocaleString()} rows
                </span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <table
              className={cn(
                "w-full table-fixed text-[14px]",
                demographicTableColSpan > 3 && "min-w-[46rem]",
              )}
            >
              <thead
                className={cn(
                  "sticky top-0 z-10 border-b text-[11px] uppercase tracking-[0.08em]",
                  isDark
                    ? "border-white/10 bg-slate-900 text-slate-300"
                    : "border-slate-200 bg-slate-50 text-slate-600",
                )}
              >
                <tr>
                  <th
                    scope="col"
                    className="w-14 px-3 py-3 text-center font-semibold"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold"
                  >
                    {groupBy === "city" ? "City" : groupBy}
                  </th>
                  {showTotalColumn ? (
                    <th className="w-36 px-4 py-3 text-right font-semibold">
                      <div className="inline-flex items-center gap-1">
                        <span>Total</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              aria-label="Sort by total"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({
                                  column: "total",
                                  order: "asc",
                                })
                              }
                            >
                              Sort Ascending
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({
                                  column: "total",
                                  order: "desc",
                                })
                              }
                            >
                              Sort Descending
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({ column: null, order: null })
                              }
                            >
                              Clear Sort
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  ) : null}
                  {showAdvertisersColumn ? (
                    <th className="w-36 px-4 py-3 text-right font-semibold">
                      <div className="inline-flex items-center gap-1">
                        <span>Advertisers</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              aria-label="Sort by advertisers"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({
                                  column: "brands",
                                  order: "asc",
                                })
                              }
                            >
                              Sort Ascending
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({
                                  column: "brands",
                                  order: "desc",
                                })
                              }
                            >
                              Sort Descending
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDemographicSort({ column: null, order: null })
                              }
                            >
                              Clear Sort
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  ) : null}
                  {showCreatorsColumn ? (
                    <>
                      <th className="w-36 px-4 py-3 text-right font-semibold">
                        <div className="inline-flex items-center gap-1">
                          <span>Creators</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                aria-label="Sort by creators"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({
                                    column: "creators",
                                    order: "asc",
                                  })
                                }
                              >
                                Sort Ascending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({
                                    column: "creators",
                                    order: "desc",
                                  })
                                }
                              >
                                Sort Descending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({ column: null, order: null })
                                }
                              >
                                Clear Sort
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </th>
                    </>
                  ) : null}
                  {showAdminsColumn ? (
                    <>
                      <th className="w-36 px-4 py-3 text-right font-semibold">
                        <div className="inline-flex items-center gap-1">
                          <span>Admins</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                aria-label="Sort by admins"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({
                                    column: "admins",
                                    order: "asc",
                                  })
                                }
                              >
                                Sort Ascending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({
                                    column: "admins",
                                    order: "desc",
                                  })
                                }
                              >
                                Sort Descending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setDemographicSort({ column: null, order: null })
                                }
                              >
                                Clear Sort
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sortedDemographicRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={demographicTableColSpan}
                      className={cn(
                        "px-3 py-8 text-center",
                        isDark ? "text-slate-400" : "text-gray-500",
                      )}
                    >
                      No demographic data available.
                    </td>
                  </tr>
                ) : (
                  sortedDemographicRows.map((r, idx) => (
                    <tr
                      key={`${r.label}-${idx}`}
                      className={cn(
                        "border-t transition-colors duration-150",
                        isDark
                          ? "border-white/5 text-slate-100 odd:bg-white/[0.025] hover:bg-purple-500/10"
                          : "border-slate-100 text-slate-800 odd:bg-slate-50/60 hover:bg-purple-50/80",
                      )}
                    >
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums",
                            idx < 3
                              ? isDark
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-purple-100 text-purple-700"
                              : isDark
                                ? "bg-slate-800 text-slate-400"
                                : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{r.label}</td>
                      {showTotalColumn ? (
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {r.total.toLocaleString()}
                        </td>
                      ) : null}
                      {showAdvertisersColumn ? (
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {r.brands.toLocaleString()}
                        </td>
                      ) : null}
                      {showCreatorsColumn ? (
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {r.creators.toLocaleString()}
                        </td>
                      ) : null}
                      {showAdminsColumn ? (
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {r.admins.toLocaleString()}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative mt-2 w-full",
              isMapFullscreen && "mt-0 min-h-0 flex-1",
            )}
          >
            <div
              ref={containerRef}
              className={cn(
                "relative z-0 w-full overflow-hidden rounded-xl shadow-inner",
                isMapFullscreen
                  ? "h-full min-h-0"
                  : "h-[clamp(24rem,58dvh,42rem)] min-h-[24rem]",
                isDark
                  ? "border border-white/10 bg-slate-900/50 users-map-dark"
                  : "border border-gray-200/80 bg-slate-50/50",
              )}
            />
            {(isLoading || isMapRendering) && !hasMapError && (
              <div className="pointer-events-none absolute left-3 top-3 z-[1100] inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating map
              </div>
            )}
            {hasMapError && (
              <div className="absolute inset-0 z-[1100] flex items-center justify-center p-4">
                <div
                  className={cn(
                    "w-full max-w-xs rounded-2xl border p-4 text-center shadow-xl backdrop-blur-md",
                    isDark
                      ? "border-rose-400/20 bg-slate-950/90 text-slate-100"
                      : "border-rose-200 bg-white/95 text-slate-900",
                  )}
                >
                  <AlertCircle className="mx-auto h-5 w-5 text-rose-500" />
                  <p className="mt-2 text-sm font-semibold">
                    Unable to load map data.
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                  >
                    Your existing page data has not been changed.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5"
                    onClick={retryMap}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
            {!hasMapError &&
              !isLoading &&
              !isMapRendering &&
              visibleMarkers.length === 0 && (
                <div className="absolute inset-0 z-[1100] flex items-center justify-center p-4">
                  <div
                    className={cn(
                      "w-full max-w-xs rounded-2xl border p-4 text-center shadow-xl backdrop-blur-md",
                      isDark
                        ? "border-white/10 bg-slate-950/90 text-slate-100"
                        : "border-slate-200 bg-white/95 text-slate-900",
                    )}
                  >
                    <p className="text-sm font-semibold">
                      No users found for these filters.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 gap-1.5"
                      onClick={clearGeographyFilters}
                    >
                      <FilterX className="h-3.5 w-3.5" />
                      Clear filters
                    </Button>
                  </div>
                </div>
              )}
          </div>
        )}
        </div>
      </FullscreenViewportPortal>
      {/* Detail view: card when View is clicked */}
      {detailLocation ? (
        <div
          className={cn(
            "flex h-[480px] min-h-[320px] flex-col overflow-hidden rounded-xl shadow-xl",
            isDark
              ? "border border-white/10 bg-slate-900"
              : "border border-gray-200 bg-white",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between shrink-0 border-b px-4 py-3",
              isDark
                ? "border-white/10 bg-slate-800/80"
                : "border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/80",
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5",
                isDark
                  ? "text-slate-300 hover:bg-white/10 hover:text-white"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-900",
              )}
              onClick={() => setDetailLocation(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to map
            </Button>
            <h3
              className={cn(
                "flex-1 truncate px-3 text-center text-sm font-semibold",
                isDark ? "text-slate-100" : "text-gray-800",
              )}
            >
              {detailLocation}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-8 shrink-0 rounded-full p-0",
                isDark
                  ? "text-slate-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-gray-900",
              )}
              onClick={() => setDetailLocation(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ul className="flex-1 space-y-3 overflow-y-auto p-3">
            {detailUsers.map((u) => {
              const hasSocial = u.youtube || u.instagram || u.twitter;
              return (
                <li
                  key={u.id}
                  className={cn(
                    "rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md",
                    isDark
                      ? "border-white/10 bg-slate-800/50 hover:bg-slate-800/70"
                      : "border-gray-100 bg-white hover:shadow-md",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar
                        className={cn(
                          "h-12 w-12 flex-shrink-0 border-2 shadow-sm",
                          isDark ? "border-white/10" : "border-gray-100",
                        )}
                      >
                        <AvatarImage src={u.profile_picture_url || undefined} />
                        <AvatarFallback
                          className={cn(
                            "text-sm font-medium",
                            isDark
                              ? "bg-slate-600 text-slate-200"
                              : "bg-gray-200 text-gray-600",
                          )}
                        >
                          {(u.full_name || u.email || "?")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isDark ? "text-slate-100" : "text-gray-900",
                            )}
                          >
                            {u.full_name || "—"}
                          </p>
                          {hasSocial && (
                            <div className="flex items-center gap-0.5">
                              {u.youtube &&
                                (u.youtube.url ? (
                                  <a
                                    href={u.youtube.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={u.youtube.label}
                                    className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
                                  >
                                    <FaYoutube className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <span
                                    title={u.youtube.label}
                                    className="rounded p-1 text-gray-400"
                                  >
                                    <FaYoutube className="h-3.5 w-3.5" />
                                  </span>
                                ))}
                              {u.instagram &&
                                (u.instagram.url ? (
                                  <a
                                    href={u.instagram.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={u.instagram.label}
                                    className="rounded p-1 text-pink-600 transition-colors hover:bg-pink-50"
                                  >
                                    <FaInstagram className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <span
                                    title={u.instagram.label}
                                    className="rounded p-1 text-gray-400"
                                  >
                                    <FaInstagram className="h-3.5 w-3.5" />
                                  </span>
                                ))}
                              {u.twitter &&
                                (u.twitter.url ? (
                                  <a
                                    href={u.twitter.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={u.twitter.label}
                                    className="rounded p-1 text-sky-600 transition-colors hover:bg-sky-50"
                                  >
                                    <FaTwitter className="h-3.5 w-3.5" />
                                  </a>
                                ) : (
                                  <span
                                    title={u.twitter.label}
                                    className="rounded p-1 text-gray-400"
                                  >
                                    <FaTwitter className="h-3.5 w-3.5" />
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        {u.username && (
                          <p
                            className={cn(
                              "text-sm",
                              isDark ? "text-slate-300" : "text-gray-700",
                            )}
                          >
                            @{u.username}
                          </p>
                        )}
                        <p
                          className={cn(
                            "mt-0.5 block truncate text-sm",
                            isDark ? "text-slate-200" : "text-gray-800",
                          )}
                        >
                          {u.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          (u.user_type || "").toLowerCase() === "admin"
                            ? isDark
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-amber-100 text-amber-700"
                            : (u.user_type || "").toLowerCase() === "advertiser"
                              ? isDark
                                ? "bg-violet-500/20 text-violet-300"
                                : "bg-violet-100 text-violet-700"
                              : isDark
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-emerald-100 text-emerald-700",
                        )}
                      >
                        {u.user_type || "—"}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function decodeHtml(s: string): string {
  const div = document.createElement("div");
  div.innerHTML = s;
  return div.textContent || s;
}
