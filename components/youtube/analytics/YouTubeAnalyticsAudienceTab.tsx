"use client";

import { useState } from "react";
import { Users, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Country } from "country-state-city";
import {
  COUNTRY_NAMES,
  countryFlag,
  formatAgeGroupLabel,
  formatDeviceLabel,
  formatGenderLabel,
  formatOsLabel,
  formatProvinceLabel,
  parseCityKey,
} from "@/lib/youtube-analytics-labels";
import {
  YT_AUDIENCE_GEO_DETAIL_LIMIT,
  YT_AUDIENCE_GEO_PREVIEW_LIMIT,
} from "@/lib/youtube-constants";
import {
  geoSortScore,
  hasRichGeoData,
  normalizeGeoMetric,
  type GeoMetricValue,
} from "@/lib/youtube-geo-metrics";
import type { YouTubeMetrics } from "./types";
import { GeoMetricsTable } from "./GeoMetricsTable";
import {
  EmptyTabMessage,
  PctBar,
  SectionHeader,
  timeAgo,
} from "./shared";

function formatCountryName(code: string): string {
  const normalized = code.trim().toUpperCase();
  const fromLib = Country.getCountryByCode(normalized);
  if (fromLib?.name) return fromLib.name;
  return COUNTRY_NAMES[normalized] ?? code;
}

function geoViewsPct(value: GeoMetricValue): number {
  return normalizeGeoMetric(value)?.views_pct ?? 0;
}

function sortGeoEntries(
  map: Record<string, GeoMetricValue> | undefined,
): [string, GeoMetricValue][] {
  return Object.entries(map ?? {}).sort(
    (a, b) => geoSortScore(b[1]) - geoSortScore(a[1]),
  );
}

export function YouTubeAnalyticsAudienceTab({
  metrics,
  isDark,
  showDemographics = true,
}: {
  metrics: YouTubeMetrics;
  isDark?: boolean;
  showDemographics?: boolean;
}) {
  const dark = !!isDark;
  const [geoExpanded, setGeoExpanded] = useState(false);
  const demo = metrics.demographics;
  const devices = metrics.devices;

  const ageGroups = Object.entries(demo?.age_groups ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const genders = Object.entries(demo?.gender ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const allCountries = sortGeoEntries(demo?.countries);
  const allProvinces = sortGeoEntries(demo?.provinces);

  const citiesByCountry = new Map<string, [string, GeoMetricValue][]>();
  for (const [key, metric] of Object.entries(demo?.cities ?? {})) {
    const { country, city } = parseCityKey(key);
    if (!country || !city) continue;
    const list = citiesByCountry.get(country) ?? [];
    list.push([city, metric]);
    citiesByCountry.set(country, list);
  }
  for (const [, list] of citiesByCountry) {
    list.sort((a, b) => geoSortScore(b[1]) - geoSortScore(a[1]));
  }

  const geoLimit = geoExpanded
    ? YT_AUDIENCE_GEO_DETAIL_LIMIT
    : YT_AUDIENCE_GEO_PREVIEW_LIMIT;

  const visibleCountries = allCountries.slice(0, geoLimit);
  const visibleProvinces = allProvinces.slice(0, geoLimit);

  const richCountries = hasRichGeoData(demo?.countries);
  const richCities = hasRichGeoData(demo?.cities);
  const richProvinces = hasRichGeoData(demo?.provinces);
  const showRichGeo = geoExpanded && (richCountries || richCities || richProvinces);

  const hasGeoOverflow =
    allCountries.length > YT_AUDIENCE_GEO_PREVIEW_LIMIT ||
    allProvinces.length > YT_AUDIENCE_GEO_PREVIEW_LIMIT ||
    [...citiesByCountry.values()].some(
      (cities) => cities.length > YT_AUDIENCE_GEO_PREVIEW_LIMIT,
    );

  const hasGeo =
    allCountries.length > 0 ||
    citiesByCountry.size > 0 ||
    allProvinces.length > 0;

  const deviceTypes = Object.entries(devices?.device_types ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const operatingSystems = Object.entries(
    devices?.operating_systems ?? {},
  ).sort((a, b) => b[1] - a[1]);

  const hasDemo =
    ageGroups.length > 0 ||
    genders.length > 0 ||
    hasGeo;
  const hasDevices = deviceTypes.length > 0 || operatingSystems.length > 0;

  if (!showDemographics) return null;

  if (!hasDemo && !hasDevices) {
    return (
      <div>
        <SectionHeader
          isDark={dark}
          icon={<Users className="h-3.5 w-3.5" />}
          title="Audience"
        />
        <EmptyTabMessage
          isDark={dark}
          message='No data yet — click "Refresh Demographics".'
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        isDark={dark}
        icon={<Users className="h-3.5 w-3.5" />}
        title="Audience"
      />

      {genders.length > 0 && (
        <div className="flex gap-2 mb-2">
          {genders.map(([gender, pct]) => (
            <div
              key={gender}
              className={cn(
                "flex-1 rounded-md py-1.5 text-center",
                dark
                  ? "bg-slate-800"
                  : "bg-slate-50 border border-slate-100",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-bold",
                  dark ? "text-slate-200" : "text-slate-700",
                )}
              >
                {pct.toFixed(0)}%
              </div>
              <div
                className={cn(
                  "text-[10px]",
                  dark ? "text-slate-500" : "text-slate-400",
                )}
              >
                {formatGenderLabel(gender)}
              </div>
            </div>
          ))}
        </div>
      )}

      {ageGroups.map(([age, pct]) => (
        <PctBar
          key={age}
          label={formatAgeGroupLabel(age)}
          pct={pct}
          barClass="bg-purple-400"
          isDark={dark}
        />
      ))}

      {hasGeo && (
        <div className="mt-3">
          {visibleCountries.length > 0 && (
            <>
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide mb-1.5",
                  dark ? "text-slate-500" : "text-slate-400",
                )}
              >
                Top countries
              </p>
              {showRichGeo && richCountries ? (
                <>
                  <GeoMetricsTable
                    isDark={dark}
                    rows={visibleCountries.map(([code, metric]) => ({
                      key: code,
                      label: `${countryFlag(code)} ${formatCountryName(code)}`,
                      metric: normalizeGeoMetric(metric)!,
                    }))}
                  />
                  {visibleCountries.map(([code]) => {
                    const cityRows = (citiesByCountry.get(code) ?? [])
                      .slice(0, geoLimit)
                      .map(([city, metric]) => ({
                        key: `${code}-${city}`,
                        label: city,
                        metric: normalizeGeoMetric(metric)!,
                      }))
                      .filter((r) => r.metric);
                    if (cityRows.length === 0) return null;
                    return (
                      <div key={`cities-${code}`} className="mt-2 ml-1">
                        <p
                          className={cn(
                            "text-[9px] font-medium mb-1",
                            dark ? "text-slate-500" : "text-slate-400",
                          )}
                        >
                          {formatCountryName(code)} — cities
                        </p>
                        <GeoMetricsTable
                          isDark={dark}
                          compact
                          rows={cityRows}
                        />
                      </div>
                    );
                  })}
                </>
              ) : (
                visibleCountries.map(([code, metric]) => (
                  <div key={code}>
                    <PctBar
                      label={`${countryFlag(code)} ${formatCountryName(code)}`}
                      pct={geoViewsPct(metric)}
                      barClass="bg-blue-400"
                      isDark={dark}
                      truncateLabel={180}
                    />
                    {(citiesByCountry.get(code) ?? [])
                      .slice(0, geoLimit)
                      .map(([city, cityMetric]) => (
                        <div key={`${code}-${city}`} className="ml-4">
                          <PctBar
                            label={city}
                            pct={geoViewsPct(cityMetric)}
                            barClass="bg-cyan-400/80"
                            isDark={dark}
                            truncateLabel={150}
                          />
                        </div>
                      ))}
                  </div>
                ))
              )}
            </>
          )}

          {visibleProvinces.length > 0 && (
            <div className={visibleCountries.length > 0 ? "mt-3" : ""}>
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide mb-1.5",
                  dark ? "text-slate-500" : "text-slate-400",
                )}
              >
                US states
              </p>
              {showRichGeo && richProvinces ? (
                <GeoMetricsTable
                  isDark={dark}
                  rows={visibleProvinces.map(([code, metric]) => ({
                    key: code,
                    label: formatProvinceLabel(code),
                    metric: normalizeGeoMetric(metric)!,
                  }))}
                />
              ) : (
                visibleProvinces.map(([code, metric]) => (
                  <PctBar
                    key={code}
                    label={formatProvinceLabel(code)}
                    pct={geoViewsPct(metric)}
                    barClass="bg-indigo-400"
                    isDark={dark}
                  />
                ))
              )}
            </div>
          )}

          {hasGeoOverflow && (
            <button
              type="button"
              onClick={() => setGeoExpanded((v) => !v)}
              className={cn(
                "text-[10px] mt-2 underline-offset-2 hover:underline",
                dark ? "text-purple-400" : "text-purple-600",
              )}
            >
              {geoExpanded
                ? "Show less"
                : "Show detailed demographics"}
            </button>
          )}
        </div>
      )}

      {hasDevices && (
        <div className="mt-3">
          <SectionHeader
            isDark={dark}
            icon={<Smartphone className="h-3.5 w-3.5" />}
            title="Devices"
          />
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              {deviceTypes.map(([type, pct]) => (
                <PctBar
                  key={type}
                  label={formatDeviceLabel(type)}
                  pct={pct}
                  barClass="bg-slate-400"
                  isDark={dark}
                  truncateLabel={70}
                />
              ))}
            </div>
            <div>
              {operatingSystems.slice(0, 6).map(([os, pct]) => (
                <PctBar
                  key={os}
                  label={formatOsLabel(os)}
                  pct={pct}
                  barClass="bg-slate-500"
                  isDark={dark}
                  truncateLabel={70}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <p
        className={cn(
          "text-[10px] mt-2",
          dark ? "text-slate-500" : "text-slate-400",
        )}
      >
        Updated {timeAgo(metrics.last_demographics_update)}
      </p>
    </div>
  );
}
