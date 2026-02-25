/**
 * Backfill geo_data column only. Fetches country, city, state, lat, lon from IP via API.
 * Does not update registration_info — only geo_data column and updated_at.
 *
 * Usage: node scripts/backfill-geo-data.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env or .env.local)",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const LOCALHOST = new Set(["::1", "127.0.0.1", "0.0.0.0"]);

function isLocalIp(ip) {
  return !ip || LOCALHOST.has(ip);
}

/** ip-api.com: country = full name, countryCode = 2-letter */
async function fetchGeoFromIpApi(ip) {
  if (isLocalIp(ip)) return null;
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,regionName,city,lat,lon`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return {
      country:
        String(data.country ?? "").trim() || String(data.countryCode ?? ""),
      country_code: String(data.countryCode ?? "")
        .toUpperCase()
        .slice(0, 2),
      state: data.regionName ?? "",
      city: data.city ?? "",
      lat: typeof data.lat === "number" ? data.lat : 0,
      lon: typeof data.lon === "number" ? data.lon : 0,
      processed_at: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

/** ipinfo.io fallback (e.g. when ip-api is rate-limited); data.country is 2-letter code */
async function fetchGeoFromIpInfo(ip) {
  if (isLocalIp(ip)) return null;
  try {
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.country) return null;
    const [lat, lon] = (data.loc || "0,0").split(",").map(Number);
    const country_code = String(data.country).toUpperCase().slice(0, 2);
    const country = (data.country_name || "").trim() || country_code;
    return {
      country,
      country_code,
      state: data.region ?? "",
      city: data.city ?? "",
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      processed_at: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

async function fetchGeoFromIp(ip) {
  const geo = await fetchGeoFromIpApi(ip);
  if (geo && (geo.country || geo.city)) return geo;
  return fetchGeoFromIpInfo(ip);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const PAGE_SIZE = 1000;

async function fetchAllUsers() {
  const all = [];
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("users")
      .select("id, email, registration_info, geo_data, login_history")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!page || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function main() {
  console.log(
    "Fetching users that need geo backfill (have IP, missing country/city/state/lat/lon)...\n",
  );

  let users;
  try {
    users = await fetchAllUsers();
  } catch (error) {
    console.error("Supabase error:", error);
    process.exit(1);
  }

  const total = users.length;
  const withIp = users.filter((u) => {
    const ri = u.registration_info || {};
    const col = u.geo_data;
    const latestLogin = Array.isArray(u.login_history) && u.login_history[0] ? u.login_history[0] : null;
    const ip = ri.ip ?? ri.ip_address ?? (col && col.ip) ?? (latestLogin && latestLogin.ip_address) ?? null;
    if (!ip || isLocalIp(ip)) return false;
    const inner = col && col.geo_data;
    const hasCountry =
      inner && typeof inner.country === "string" && inner.country.trim().length > 0;
    const hasCity =
      inner && typeof inner.city === "string" && inner.city.trim().length > 0;
    const hasCoords =
      inner &&
      typeof inner.lat === "number" &&
      typeof inner.lon === "number" &&
      (inner.lat !== 0 || inner.lon !== 0);
    const needsBackfill =
      !col ||
      !inner ||
      !hasCountry ||
      !hasCity ||
      !hasCoords;
    return needsBackfill;
  });

  console.log(
    `Found ${withIp.length} users to backfill (have IP, geo_data missing or incomplete). Total users: ${total}.`,
  );
  if (withIp.length > 0) {
    console.log(
      "This script fetches from Geo-IP API (~25 min for 1000+ users).\n",
    );
  }
  if (withIp.length === 0) {
    console.log(
      "Nothing to do. All users with IP already have geo_data filled (country, city, and lat/lon).",
    );
    console.log(
      "Tip: Backfill runs only for users who have an IP (from registration_info, geo_data.ip, or latest login_history) and missing/incomplete geo (empty country/city or lat/lon 0).",
    );
    return;
  }

  const delayMs = 1400; // ~43 req/min under ip-api.com 45/min limit
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < withIp.length; i++) {
    const u = withIp[i];
    const ri = u.registration_info || {};
    const col = u.geo_data;
    const latestLogin = Array.isArray(u.login_history) && u.login_history[0] ? u.login_history[0] : null;
    const ip = ri.ip ?? ri.ip_address ?? (col && col.ip) ?? (latestLogin && latestLogin.ip_address) ?? null;

    process.stdout.write(
      `[${i + 1}/${withIp.length}] ${u.email || u.id} (${ip}) ... `,
    );

    const geo = await fetchGeoFromIp(ip);
    if (!geo) {
      console.log("no geo");
      fail++;
      await sleep(delayMs);
      continue;
    }

    const geoDataColumn = { ip, geo_data: geo };
    const { error: updateError } = await supabase
      .from("users")
      .update({
        geo_data: geoDataColumn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", u.id);

    if (updateError) {
      console.log("update err:", updateError.message);
      fail++;
    } else {
      console.log(geo.city || geo.country || "ok");
      ok++;
    }

    await sleep(delayMs);
  }

  console.log(`\nDone. Updated: ${ok}, failed/skipped: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
