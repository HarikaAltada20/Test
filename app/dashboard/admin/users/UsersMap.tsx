"use client";

import { useEffect, useRef, useState, useMemo } from "react";
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
import { ArrowLeft, X, MapPin, BarChart3, ChevronDown } from "lucide-react";
import REGIONS_AND_COUNTRIES_DATA from "@/data/regions-and-countries.json";

type SocialLink = { label: string; url: string | null };

const STATE_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const WORLD_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const GEOJSON_CACHE = new Map<string, any>();
const GEOJSON_INFLIGHT = new Map<string, Promise<any>>();

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

export type UsersMapProps = {
  markers: UserMarker[];
  activeTab: string;
  totalInTab: number;
  isDark: boolean;
  groupBy: "region" | "state" | "country" | "city";
  className?: string;
};

function getGroupByKey(
  m: UserMarker,
  groupBy: "region" | "state" | "country" | "city",
): string {
  if (groupBy === "region") return getRegion(m);
  if (groupBy === "state") return getStateKey(m);
  if (groupBy === "country") return (m.country || "Unknown").trim();
  return getLocationKey(m);
}

function getDemographicDisplayLabel(
  fullKey: string,
  groupBy: "region" | "state" | "country" | "city",
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
  className,
}: UsersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const choroplethLayerRef = useRef<{ remove: () => void } | null>(null);
  const [detailLocation, setDetailLocation] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"pins" | "choropleth" | "demographic">(
    "pins",
  );
  const [demographicSort, setDemographicSort] = useState<{
    column: "total" | "brands" | "creators" | "admins" | null;
    order: "asc" | "desc" | null;
  }>({ column: null, order: null });
  const [demographicCountryFilter, setDemographicCountryFilter] =
    useState<string>("all");
  const [demographicStateFilter, setDemographicStateFilter] =
    useState<string>("all");
  const [demographicCityFilter, setDemographicCityFilter] =
    useState<string>("all");
  const setDetailLocationRef = useRef(setDetailLocation);
  setDetailLocationRef.current = setDetailLocation;

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
    if (groupBy !== "city") setDemographicCityFilter("all");
    if (groupBy !== "state" && groupBy !== "city") {
      setDemographicCountryFilter("all");
      setDemographicStateFilter("all");
    }
  }, [groupBy]);

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
    1 +
    (showTotalColumn ? 1 : 0) +
    (showAdvertisersColumn ? 1 : 0) +
    (showCreatorsColumn ? 1 : 0) +
    (showAdminsColumn ? 1 : 0);

  const withLocationCount = markers.length;
  const detailUsers = detailLocation
    ? markers.filter((m) => getGroupByKey(m, groupBy) === detailLocation)
    : [];

  const locationAggregates = useMemo(() => {
    if (groupBy === "region") return aggregateByRegion(markers);
    if (groupBy === "state") return aggregateByState(markers);
    if (groupBy === "city") return aggregateByLocation(markers);
    return aggregateByCountryToLocationCounts(markers);
  }, [markers, groupBy]);

  const demographicCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          markers
            .map((m) => (m.country || "").trim())
            .filter((v) => v.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [markers],
  );

  const demographicStateOptions = useMemo(() => {
    const base = markers.filter((m) =>
      demographicCountryFilter === "all"
        ? true
        : (m.country || "").trim() === demographicCountryFilter,
    );
    return Array.from(
      new Set(
        base.map((m) => (m.state || "").trim()).filter((v) => v.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [markers, demographicCountryFilter]);

  const demographicCityOptions = useMemo(() => {
    const base = markers.filter((m) => {
      if (
        demographicCountryFilter !== "all" &&
        (m.country || "").trim() !== demographicCountryFilter
      )
        return false;
      if (
        demographicStateFilter !== "all" &&
        (m.state || "").trim() !== demographicStateFilter
      )
        return false;
      return true;
    });
    return Array.from(
      new Set(
        base.map((m) => (m.city || "").trim()).filter((v) => v.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [markers, demographicCountryFilter, demographicStateFilter]);

  const canSelectStateFilter = demographicCountryFilter !== "all";
  const canSelectCityFilter =
    groupBy === "city" &&
    demographicCountryFilter !== "all" &&
    demographicStateFilter !== "all";

  useEffect(() => {
    if (
      demographicCountryFilter !== "all" &&
      !demographicCountryOptions.includes(demographicCountryFilter)
    ) {
      setDemographicCountryFilter("all");
    }
  }, [demographicCountryFilter, demographicCountryOptions]);

  useEffect(() => {
    if (
      demographicStateFilter !== "all" &&
      !demographicStateOptions.includes(demographicStateFilter)
    ) {
      setDemographicStateFilter("all");
    }
  }, [demographicStateFilter, demographicStateOptions]);

  useEffect(() => {
    if (
      demographicCityFilter !== "all" &&
      !demographicCityOptions.includes(demographicCityFilter)
    ) {
      setDemographicCityFilter("all");
    }
  }, [demographicCityFilter, demographicCityOptions]);

  const filteredDemographicMarkers = useMemo(() => {
    if (groupBy !== "state" && groupBy !== "city") return markers;
    return markers.filter((m) => {
      const country = (m.country || "").trim();
      const state = (m.state || "").trim();
      const city = (m.city || "").trim();
      if (
        demographicCountryFilter !== "all" &&
        country !== demographicCountryFilter
      )
        return false;
      if (demographicStateFilter !== "all" && state !== demographicStateFilter)
        return false;
      if (groupBy === "city") {
        if (demographicCityFilter !== "all" && city !== demographicCityFilter)
          return false;
      }
      return true;
    });
  }, [
    markers,
    groupBy,
    demographicCountryFilter,
    demographicStateFilter,
    demographicCityFilter,
  ]);

  const demographicRows = useMemo(() => {
    const byKey = new Map<
      string,
      { total: number; admins: number; brands: number; creators: number }
    >();
    filteredDemographicMarkers.forEach((m) => {
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
  }, [filteredDemographicMarkers, groupBy]);

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
    if (typeof window === "undefined" || !containerRef.current) return;

    const countryCounts = aggregateByCountry(markers);
    const stateCounts = aggregateByStateCounts(markers);
    const regionCounts = aggregateByRegionCounts(markers);
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

    const init = async (
      tab: string,
      dark: boolean,
      mode: "pins" | "choropleth",
      groupByVal: "region" | "state" | "country" | "city",
    ) => {
      const L = await import("leaflet");
      // @ts-expect-error - leaflet CSS has no type declarations
      await import("leaflet/dist/leaflet.css");

      if (!containerRef.current) return;
      if (mapRef.current) {
        if (choroplethLayerRef.current) {
          choroplethLayerRef.current.remove();
          choroplethLayerRef.current = null;
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
      // If container was used by a previous map we don't have a ref to (e.g. async init), clear Leaflet's id so L.map() can run
      const container = containerRef.current;
      if ((container as any)._leaflet_id != null && !mapRef.current) {
        delete (container as any)._leaflet_id;
      }

      const leafletMap = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
      });
      mapRef.current = leafletMap;

      // Theme-aware tiles
      const tileUrl = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      L.tileLayer(tileUrl, {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
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
            mapRef.current = leafletMap;
            return;
          } catch {
            // Fallback to pins
          }
        }

        // Country-level choropleth (for groupBy country; city uses pins only)
        if (groupByVal === "country") {
          try {
            const geojson = await loadGeoJsonCached(WORLD_GEOJSON_URL);
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
            mapRef.current = leafletMap;
            return;
          } catch {
            // Fallback to pins
          }
        }

        // Region-level: color countries by their region's total count
        if (groupByVal === "region") {
          try {
            const geojson = await loadGeoJsonCached(WORLD_GEOJSON_URL);
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
            mapRef.current = leafletMap;
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

      const leafletMarkers: L.Marker[] = [];
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
        const tooltipHtml = `<div class="users-map-tooltip"><strong>${escapeHtml(loc.label)}</strong><br/><span class="text-muted">${escapeHtml(tooltipLine)}</span></div>`;

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
              <p class="popup-counts">${escapeHtml(countsLine)}</p>
              <button type="button" class="view-detail-btn" data-location-label="${locationLabelEscaped}">View users</button>
            </div>`,
          );
        leafletMarkers.push(marker);
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

      if (leafletMarkers.length > 0) {
        const group = L.featureGroup(leafletMarkers);
        const bounds = group.getBounds();
        if (bounds.isValid()) leafletMap.fitBounds(bounds.pad(0.1));
      }

      mapRef.current = leafletMap;
    };

    if (mapMode === "demographic") {
      if (choroplethLayerRef.current) {
        choroplethLayerRef.current.remove();
        choroplethLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return () => {};
    }

    init(activeTab, isDark, mapMode, groupBy);
    return () => {
      if (choroplethLayerRef.current) {
        choroplethLayerRef.current.remove();
        choroplethLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markers, activeTab, isDark, mapMode, groupBy, locationAggregates]);

  const pinLegendColor =
    activeTab === "advertisers"
      ? "#a78bfa"
      : activeTab === "creators"
        ? "#34d399"
        : "#60a5fa";

  return (
    <div className={cn("relative z-0 flex flex-col gap-2", className)}>
      <style>{`
        .custom-pin.leaflet-marker-icon { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05); padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 0; min-width: 200px; }
        .users-map-popup { padding: 14px 16px; font-family: inherit; }
        .users-map-popup .popup-title { font-weight: 600; font-size: 0.9375rem; color: #0f172a; margin: 0; line-height: 1.3; }
        .users-map-popup .popup-counts { font-size: 0.8125rem; color:rgb(44, 47, 53); margin: 6px 0 12px; line-height: 1.4; }
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
        .users-map-tooltip .text-muted { color: #64748b; font-size: 11px; }
        /* Remove black border/outline on choropleth click (focus ring) */
        .leaflet-interactive:focus, .leaflet-interactive:active, .leaflet-interactive:focus-visible { outline: none !important; outline-offset: 0 !important; box-shadow: none !important; }
        .leaflet-pane path.leaflet-interactive, .leaflet-pane svg path.leaflet-interactive { outline: none !important; }
        /* Choropleth legend (AnyChart-style color range) */
        .choropleth-legend { padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.98); box-shadow: 0 2px 14px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.06); font-size: 11px; line-height: 1.4; }
        .leaflet-control .choropleth-legend { margin: 0; }
        .choropleth-legend-title { font-weight: 600; margin-bottom: 8px; color: #0f172a; font-size: 13px; }
        .choropleth-legend-bar { display: flex; flex-wrap: nowrap; gap: 0; align-items: stretch; border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); }
        .choropleth-legend-cell { flex: 1; min-width: 36px; height: 14px; }
        .choropleth-legend-cell:first-child { border-radius: 5px 0 0 5px; }
        .choropleth-legend-cell:last-child { border-radius: 0 5px 5px 0; }
        .choropleth-legend-labels { margin-top: 6px; display: flex; gap: 0; }
        .choropleth-legend-label { flex: 1; min-width: 36px; text-align: center; color: #0f172a; font-weight: 500; font-size: 10px; }
        .choropleth-range { opacity: 0.9; font-size: 11px; }
        .users-map-tooltip .choropleth-total { font-size: 14px; font-weight: 400; margin: 0.2rem 0; }
        .users-map-dark .choropleth-legend { background: rgba(15,23,42,0.96); border-color: rgba(255,255,255,0.12); }
        .users-map-dark .choropleth-legend-title { color: #e2e8f0; }
        .users-map-dark .choropleth-legend-label { color: #e2e8f0; }
      `}</style>
      {/* Map view: summary + map container (hidden when detail is open). z-0 so modals (z-50) appear on top. */}
      <div
        className={cn(
          "relative z-0 flex flex-col gap-2",
          detailLocation && "hidden",
        )}
      >
        {/* Pins vs Choropleth toggle (Choropleth not available for All Cities) */}
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant={mapMode === "pins" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5",
              mapMode !== "pins" &&
                isDark &&
                "text-slate-300 hover:bg-white/10 hover:text-white",
              mapMode !== "pins" &&
                !isDark &&
                "text-gray-600 hover:bg-gray-100",
            )}
            onClick={() => setMapMode("pins")}
          >
            <MapPin className="h-4 w-4" />
            Pins
          </Button>
          {groupBy !== "city" && (
            <Button
              variant={mapMode === "choropleth" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "gap-1.5",
                mapMode !== "choropleth" &&
                  isDark &&
                  "text-slate-300 hover:bg-white/10 hover:text-white",
                mapMode !== "choropleth" &&
                  !isDark &&
                  "text-gray-600 hover:bg-gray-100",
              )}
              onClick={() => setMapMode("choropleth")}
            >
              <BarChart3 className="h-4 w-4" />
              Choropleth
            </Button>
          )}
          <Button
            variant={mapMode === "demographic" ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "gap-1.5",
              mapMode !== "demographic" &&
                isDark &&
                "text-slate-300 hover:bg-white/10 hover:text-white",
              mapMode !== "demographic" &&
                !isDark &&
                "text-gray-600 hover:bg-gray-100",
            )}
            onClick={() => setMapMode("demographic")}
          >
            <BarChart3 className="h-4 w-4" />
            Demographic
          </Button>
        </div>
        {mapMode === "demographic" ? (
          <div
            className={cn(
              "mt-2 h-[480px] min-h-[320px] overflow-auto rounded-xl border",
              isDark
                ? "border-white/10 bg-slate-900/50"
                : "border-gray-200 bg-white",
            )}
          >
            {(groupBy === "state" || groupBy === "city") && (
              <div
                className={cn(
                  "sticky top-0 z-10 flex flex-wrap gap-2 border-b px-3 py-2",
                  isDark
                    ? "border-white/10 bg-slate-900/90"
                    : "border-gray-200 bg-white/95",
                )}
              >
                <select
                  value={demographicCountryFilter}
                  onChange={(e) => {
                    setDemographicCountryFilter(e.target.value);
                    setDemographicStateFilter("all");
                    setDemographicCityFilter("all");
                  }}
                  className={cn(
                    "h-10 rounded-md border px-2 text-sm",
                    isDark
                      ? "border-white/10 bg-slate-800 text-slate-100"
                      : "border-gray-300 bg-white text-gray-900",
                  )}
                >
                  <option value="all">All Countries</option>
                  {demographicCountryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>

                {(groupBy === "state" || groupBy === "city") && (
                  <select
                    value={demographicStateFilter}
                    onChange={(e) => {
                      setDemographicStateFilter(e.target.value);
                      setDemographicCityFilter("all");
                    }}
                    disabled={!canSelectStateFilter}
                    className={cn(
                      "h-10 rounded-md border px-2 text-sm",
                      !canSelectStateFilter && "cursor-not-allowed opacity-60",
                      isDark
                        ? "border-white/10 bg-slate-800 text-slate-100"
                        : "border-gray-300 bg-white text-gray-900",
                    )}
                  >
                    <option value="all">
                      {canSelectStateFilter
                        ? "All States"
                        : "Select Country First"}
                    </option>
                    {demographicStateOptions.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                )}

                {groupBy === "city" && (
                  <select
                    value={demographicCityFilter}
                    onChange={(e) => setDemographicCityFilter(e.target.value)}
                    disabled={!canSelectCityFilter}
                    className={cn(
                      "h-10 rounded-md border px-2 text-sm",
                      !canSelectCityFilter && "cursor-not-allowed opacity-60",
                      isDark
                        ? "border-white/10 bg-slate-800 text-slate-100"
                        : "border-gray-300 bg-white text-gray-900",
                    )}
                  >
                    <option value="all">
                      {canSelectCityFilter
                        ? "All Cities"
                        : "Select State First"}
                    </option>
                    {demographicCityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <table className="w-full text-sm">
              <thead
                className={cn(
                  isDark
                    ? "bg-slate-800/70 text-slate-200"
                    : "bg-gray-50 text-gray-700",
                )}
              >
                <tr>
                  <th className="px-3 py-2 text-left font-semibold capitalize">
                    {groupBy === "city" ? "City" : groupBy}
                  </th>
                  {showTotalColumn ? (
                    <th className="px-3 py-2 text-center font-semibold">
                      <div className="inline-flex items-center gap-1">
                        <span>Total</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
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
                    <th className="px-3 py-2 text-center font-semibold">
                      <div className="inline-flex items-center gap-1">
                        <span>Advertisers</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
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
                      <th className="px-3 py-2 text-center font-semibold">
                        <div className="inline-flex items-center gap-1">
                          <span>Creators</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
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
                      <th className="px-3 py-2 text-center font-semibold">
                        <div className="inline-flex items-center gap-1">
                          <span>Admins</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
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
                        "border-t",
                        isDark
                          ? "border-white/10 text-slate-100"
                          : "border-gray-100 text-gray-800",
                      )}
                    >
                      <td className="px-3 py-2">{r.label}</td>
                      {showTotalColumn ? (
                        <td className="px-3 py-2 text-center">{r.total}</td>
                      ) : null}
                      {showAdvertisersColumn ? (
                        <td className="px-3 py-2 text-center">{r.brands}</td>
                      ) : null}
                      {showCreatorsColumn ? (
                        <>
                          <td className="px-3 py-2 text-center">{r.creators}</td>
                        </>
                      ) : null}
                      {showAdminsColumn ? (
                        <>
                          <td className="px-3 py-2 text-center">{r.admins}</td>
                        </>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="relative mt-2 w-full">
            <div
              ref={containerRef}
              className={cn(
                "relative z-0 h-[480px] w-full rounded-xl overflow-hidden shadow-inner",
                isDark
                  ? "border border-white/10 bg-slate-900/50 users-map-dark"
                  : "border border-gray-200/80 bg-slate-50/50",
              )}
              style={{ minHeight: "320px" }}
            />
          </div>
        )}
      </div>
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
