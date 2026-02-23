"use client";

import { useEffect, useRef, useState } from "react";
import { FaYoutube, FaInstagram, FaTwitter } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, X } from "lucide-react";

type SocialLink = { label: string; url: string | null };

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
  const parts=[m.city,m.state,m.country].filter(Boolean) as string[];
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

type UsersMapProps = {
  markers: UserMarker[];
  activeTab: string;
  totalInTab: number;
  isDark: boolean;
  className?: string;
};

export function UsersMap({
  markers,
  activeTab,
  totalInTab,
  isDark,
  className,
}: UsersMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [detailLocation, setDetailLocation] = useState<string | null>(null);
  const setDetailLocationRef = useRef(setDetailLocation);
  setDetailLocationRef.current = setDetailLocation;

  const tabLabel =
    activeTab === "all"
      ? "Users"
      : activeTab === "advertisers"
        ? "Advertisers"
        : "Creators";

  const withLocationCount = markers.length;
  const detailUsers = detailLocation
    ? markers.filter((m) => getLocationKey(m) === detailLocation)
    : [];

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    const locationAggregates = aggregateByLocation(markers);

    const init = async (tab: string) => {
      const L = await import("leaflet");
      // @ts-expect-error - leaflet CSS has no type declarations
      await import("leaflet/dist/leaflet.css");

      if (!containerRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Pin color per tab (same pin design, different color)
      const pinColor =
        tab === "advertisers"
          ? "#8b5cf6"
          : tab === "creators"
            ? "#22c55e"
            : "#3b82f6"; // users/all = blue

      const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="20" height="30"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z" fill="${pinColor}" stroke="#fff" stroke-width="1.5"/></svg>`;
      const PinIcon = L.divIcon({
        className: "custom-pin",
        html: pinSvg,
        iconSize: [20, 30],
        iconAnchor: [10, 30],
        popupAnchor: [0, -30],
      });

      const leafletMap = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(leafletMap);

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
        const marker = L.marker([loc.lat, loc.lon], { icon: PinIcon })
          .addTo(leafletMap)
          .bindPopup(
            `<div class="min-w-[180px] text-left">
              <p class="font-semibold text-sm">${escapeHtml(loc.label)}</p>
              <p class="text-sm mt-1">${escapeHtml(countsLine)}</p>
              <button type="button" class="view-detail-btn mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90" data-location-label="${locationLabelEscaped}">View</button>
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

    init(activeTab);
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [markers, activeTab]);

  return (
    <div className={cn("relative z-0 flex flex-col gap-2", className)}>
      <style>{`.custom-pin.leaflet-marker-icon { background: transparent !important; border: none !important; }`}</style>
      {/* Map view: summary + map container (hidden when detail is open). z-0 so modals (z-50) appear on top. */}
      <div className={cn("relative z-0 flex flex-col gap-2", detailLocation && "hidden")}>
        <div
          ref={containerRef}
          className="relative z-0 h-[480px] mt-4 w-full rounded-lg overflow-hidden border border-input bg-muted/30"
          style={{ minHeight: "320px" }}
        />
      </div>
      {/* Detail view: white card when View is clicked */}
      {detailLocation ? (
        <div className="flex h-[480px] min-h-[320px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between shrink-0 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-50/80 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              onClick={() => setDetailLocation(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to map
            </Button>
            <h3 className="flex-1 truncate px-3 text-center text-sm font-semibold text-gray-800">
              {detailLocation}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 rounded-full p-0 text-gray-500 hover:bg-gray-200 hover:text-gray-900"
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
                  className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0 border-2 border-gray-100 shadow-sm">
                        <AvatarImage src={u.profile_picture_url || undefined} />
                        <AvatarFallback className="bg-gray-200 text-sm font-medium text-gray-600">
                          {(u.full_name || u.email || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
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
                          <p className="text-sm text-gray-700">@{u.username}</p>
                        )}
                        <p
                         
                          className="mt-0.5 block truncate text-sm text-gray-800"
                        >
                          {u.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span
                        className={
                          (u.user_type || "").toLowerCase() === "admin"
                            ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium capitalize text-amber-700"
                            : (u.user_type || "").toLowerCase() === "advertiser"
                              ? "rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium capitalize text-violet-700"
                              : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium capitalize text-emerald-700"
                        }
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
