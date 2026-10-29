/**
 * Skydo payouts → withdrawal requests.
 *
 * Skydo sends one payout per Skydo email, covering every approved request in that
 * email's group. Admins paste the Skydo payouts table (copied straight from the Skydo
 * dashboard) or a JSON array, and we match each payout to its group by email.
 *
 * Pure functions only, shared by the API route and the admin UI.
 */

export type SkydoPayoutStatusKey = "completed" | "in_progress" | "other";

export interface SkydoPayout {
  payoutId: string;
  name: string;
  email: string;
  status: string;
  statusKey: SkydoPayoutStatusKey;
  /** USD cents. */
  payoutAmountCents: number;
  /** INR paise, null until Skydo settles. */
  settledInrPaise: number | null;
  /** YYYY-MM-DD, null until credited. */
  dateOfCredit: string | null;
  utr: string | null;
}

export interface ParseResult {
  format: "table" | "json" | "unknown";
  payouts: SkydoPayout[];
  /** Rows we could not read, with the reason. */
  errors: string[];
  /** Readable but worth knowing (duplicates dropped, etc.). */
  warnings: string[];
}

/** Stored on each withdrawal request in `payout_details`. */
export interface WithdrawalPayoutDetails {
  provider: "skydo" | "manual";
  payout_id: string | null;
  utr: string | null;
  payout_amount_usd: number | null;
  amount_settled_inr: number | null;
  date_of_credit: string | null;
  status: string | null;
  payee_name: string | null;
  payee_email: string | null;
  /** How many withdrawal requests this one payout covered. */
  group_request_count: number;
  source: "import" | "manual";
  recorded_at: string;
  recorded_by: string | null;
}

const PAYOUT_ID_RE = /^pout_[A-Za-z0-9]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
/** Skydo truncates long emails on screen; a copied/OCR'd one may end in "…" or "...". */
const TRUNCATED_RE = /(…|\.\.\.)$/;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function statusKeyOf(status: string): SkydoPayoutStatusKey {
  const s = status.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (s === "completed" || s === "complete" || s === "paid" || s === "success") {
    return "completed";
  }
  if (s === "in progress" || s === "processing" || s === "pending" || s === "scheduled") {
    return "in_progress";
  }
  return "other";
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s === "—" || s === "–" || s.toLowerCase() === "null";
}

/** "USD 1,331.47", "$14.10", "₹ 680.44", 14.1 → minor units (×100). */
export function parseMoneyMinor(v: unknown): number | null {
  if (isBlank(v)) return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? Math.round(v * 100) : null;
  }
  const cleaned = String(v)
    .replace(/usd|inr|rs\.?|[$₹,\s]/gi, "")
    .trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** "Oct 16, 2026", "16 Oct 2026", "2026-10-16" → "2026-10-16". */
export function parseCreditDate(v: unknown): string | null {
  if (isBlank(v)) return null;
  const s = String(v).trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) =>
    y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    const [d, y] = [Number(m[2]), Number(m[3])];
    return mo && valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const [d, y] = [Number(m[1]), Number(m[3])];
    return mo && valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

function cleanText(v: unknown): string {
  return isBlank(v) ? "" : String(v).trim();
}

function cleanUtr(v: unknown): string | null {
  if (isBlank(v)) return null;
  const s = String(v).trim().replace(/\s+/g, "");
  return s.length ? s : null;
}

function buildPayout(
  fields: {
    payoutId: unknown;
    name: unknown;
    email: unknown;
    status: unknown;
    payoutAmount: unknown;
    settled: unknown;
    date: unknown;
    utr: unknown;
  },
  label: string,
): { payout?: SkydoPayout; error?: string } {
  const payoutId = cleanText(fields.payoutId);
  if (!payoutId) return { error: `${label}: missing payout ID` };
  const email = normalizeEmail(cleanText(fields.email));
  if (!email || !(EMAIL_RE.test(email) || TRUNCATED_RE.test(email))) {
    return { error: `${payoutId}: couldn't read the payee email` };
  }
  const status = cleanText(fields.status);
  if (!status) return { error: `${payoutId}: missing payout status` };
  const payoutAmountCents = parseMoneyMinor(fields.payoutAmount);
  if (payoutAmountCents === null || payoutAmountCents <= 0) {
    return { error: `${payoutId}: couldn't read the payout amount` };
  }
  const settledInrPaise = parseMoneyMinor(fields.settled);
  if (!isBlank(fields.settled) && settledInrPaise === null) {
    return { error: `${payoutId}: couldn't read the settled INR amount` };
  }
  const dateOfCredit = parseCreditDate(fields.date);
  if (!isBlank(fields.date) && dateOfCredit === null) {
    return { error: `${payoutId}: couldn't read the date of credit` };
  }
  return {
    payout: {
      payoutId,
      name: cleanText(fields.name),
      email,
      status,
      statusKey: statusKeyOf(status),
      payoutAmountCents,
      settledInrPaise,
      dateOfCredit,
      utr: cleanUtr(fields.utr),
    },
  };
}

/**
 * The copied Skydo table: a header, then per payout the payout ID, payee name, payee
 * email, status, payout amount, settled INR, date of credit and UTR, one per line (or
 * tab-separated). Each "pout_…" token starts a new payout.
 */
function parseCopiedTable(text: string): ParseResult {
  const tokens = text
    .split(/[\r\n\t]+/)
    .map((t) => t.trim().replace(/^"+|"+$/g, "").trim())
    .filter(Boolean);
  const starts = tokens
    .map((t, i) => (PAYOUT_ID_RE.test(t) ? i : -1))
    .filter((i) => i >= 0);

  const payouts: SkydoPayout[] = [];
  const errors: string[] = [];
  starts.forEach((start, k) => {
    const chunk = tokens.slice(start, k + 1 < starts.length ? starts[k + 1] : tokens.length);
    const payoutId = chunk[0];
    const emailIdx = chunk.findIndex(
      (t, i) => i > 0 && (EMAIL_RE.test(t) || (t.includes("@") && TRUNCATED_RE.test(t))),
    );
    if (emailIdx < 0) {
      errors.push(`${payoutId}: couldn't find the payee email`);
      return;
    }
    const rest = chunk.slice(emailIdx + 1);
    if (rest.length < 5) {
      errors.push(`${payoutId}: expected status, amount, settled INR, date and UTR after the email`);
      return;
    }
    const res = buildPayout(
      {
        payoutId,
        name: chunk.slice(1, emailIdx).join(" "),
        email: chunk[emailIdx],
        status: rest[0],
        payoutAmount: rest[1],
        settled: rest[2],
        date: rest[3],
        utr: rest[4],
      },
      payoutId,
    );
    if (res.payout) payouts.push(res.payout);
    else if (res.error) errors.push(res.error);
  });
  return { format: "table", payouts, errors, warnings: [] };
}

function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const byNorm = new Map(Object.entries(obj).map(([k, v]) => [normKey(k), v]));
  for (const k of keys) {
    if (byNorm.has(k)) return byNorm.get(k);
  }
  return undefined;
}

function parseJson(text: string): ParseResult | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!stripped.startsWith("[") && !stripped.startsWith("{")) return null;
  let data: unknown;
  try {
    data = JSON.parse(stripped);
  } catch {
    return {
      format: "json",
      payouts: [],
      errors: ["That looks like JSON but it isn't valid. Check for a missing comma or bracket."],
      warnings: [],
    };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { payouts?: unknown }).payouts)
      ? (data as { payouts: unknown[] }).payouts
      : null;
  if (!list) {
    return {
      format: "json",
      payouts: [],
      errors: ["Expected a JSON array of payouts."],
      warnings: [],
    };
  }
  const payouts: SkydoPayout[] = [];
  const errors: string[] = [];
  list.forEach((item, i) => {
    if (!item || typeof item !== "object") {
      errors.push(`Item ${i + 1}: not an object`);
      return;
    }
    const o = item as Record<string, unknown>;
    const res = buildPayout(
      {
        payoutId: pick(o, ["payoutid", "id", "payout"]),
        name: pick(o, ["name", "payeename", "payee"]),
        email: pick(o, ["email", "payeeemail", "skydoemail"]),
        status: pick(o, ["status", "payoutstatus"]),
        payoutAmount: pick(o, ["payoutamountusd", "payoutamount", "amountusd", "amount"]),
        settled: pick(o, ["amountsettledinr", "amountsettled", "settledinr", "settledamountinr", "inr"]),
        date: pick(o, ["dateofcredit", "creditdate", "creditedon", "date"]),
        utr: pick(o, ["utr", "utrno", "utrnumber"]),
      },
      `Item ${i + 1}`,
    );
    if (res.payout) payouts.push(res.payout);
    else if (res.error) errors.push(res.error);
  });
  return { format: "json", payouts, errors, warnings: [] };
}

/** Accepts the copied Skydo table or a JSON array. Drops repeated payout IDs. */
export function parseSkydoPayouts(text: string): ParseResult {
  const input = (text ?? "").trim();
  if (!input) {
    return { format: "unknown", payouts: [], errors: [], warnings: [] };
  }
  const parsed = parseJson(input) ?? parseCopiedTable(input);
  if (parsed.format === "table" && parsed.payouts.length === 0 && parsed.errors.length === 0) {
    return {
      format: "unknown",
      payouts: [],
      errors: [
        "No Skydo payouts found. Paste the copied Skydo payouts table (rows start with pout_…) or a JSON array.",
      ],
      warnings: [],
    };
  }
  const seen = new Set<string>();
  const unique: SkydoPayout[] = [];
  for (const p of parsed.payouts) {
    if (seen.has(p.payoutId)) {
      parsed.warnings.push(`${p.payoutId} appears more than once; using the first.`);
      continue;
    }
    seen.add(p.payoutId);
    unique.push(p);
  }
  return { ...parsed, payouts: unique };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface MatchableRequest {
  id: string;
  /** Skydo email from the payout method snapshot. */
  email: string;
  /** USD cents the payee should receive (net of our processing fee). */
  sendCents: number;
  status: string;
  username?: string | null;
  fullName?: string | null;
}

export type MatchState =
  | "ready"
  | "not_completed"
  | "no_match"
  | "amount_mismatch"
  | "already_recorded"
  | "duplicate_email"
  | "ambiguous_email";

export interface MatchRow {
  payout: SkydoPayout;
  state: MatchState;
  /** Email of the matched group (may differ from a truncated pasted email). */
  matchedEmail: string | null;
  partialEmail: boolean;
  requestIds: string[];
  usernames: string[];
  expectedCents: number;
  /** Approved requests for this email that fall outside the current filters. */
  outsideFilterCount: number;
  message: string;
}

export const AMOUNT_TOLERANCE_CENTS = 1;

export function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Match payouts to approved requests by Skydo email.
 * `recordedPayoutIds` are payout IDs already saved on a paid request.
 * `outsideCounts` maps email → approved requests outside the active filters.
 */
export function matchSkydoPayouts(
  payouts: SkydoPayout[],
  requests: MatchableRequest[],
  opts: {
    recordedPayoutIds?: Set<string>;
    outsideCounts?: Map<string, number>;
  } = {},
): MatchRow[] {
  const byEmail = new Map<string, MatchableRequest[]>();
  for (const r of requests) {
    if (r.status !== "approved") continue;
    const key = normalizeEmail(r.email);
    if (!key) continue;
    const list = byEmail.get(key) ?? [];
    list.push(r);
    byEmail.set(key, list);
  }
  const emails = [...byEmail.keys()];

  const resolveEmail = (raw: string): { email: string | null; partial: boolean; ambiguous: boolean } => {
    if (byEmail.has(raw)) return { email: raw, partial: false, ambiguous: false };
    if (TRUNCATED_RE.test(raw)) {
      const prefix = raw.replace(TRUNCATED_RE, "");
      const hits = emails.filter((e) => e.startsWith(prefix));
      if (hits.length === 1) return { email: hits[0], partial: true, ambiguous: false };
      if (hits.length > 1) return { email: null, partial: true, ambiguous: true };
    }
    return { email: null, partial: false, ambiguous: false };
  };

  // Two completed payouts to one email in the same paste can't be split automatically.
  const completedPerEmail = new Map<string, number>();
  for (const p of payouts) {
    if (p.statusKey !== "completed") continue;
    const { email } = resolveEmail(p.email);
    if (email) completedPerEmail.set(email, (completedPerEmail.get(email) ?? 0) + 1);
  }

  return payouts.map((payout): MatchRow => {
    const { email, partial, ambiguous } = resolveEmail(payout.email);
    const group = email ? byEmail.get(email) ?? [] : [];
    const expectedCents = group.reduce((s, r) => s + r.sendCents, 0);
    const base = {
      payout,
      matchedEmail: email,
      partialEmail: partial && Boolean(email),
      requestIds: group.map((r) => r.id),
      usernames: [
        ...new Set(group.map((r) => r.username).filter((u): u is string => Boolean(u))),
      ],
      expectedCents,
      outsideFilterCount: opts.outsideCounts?.get(email ?? normalizeEmail(payout.email)) ?? 0,
    };

    if (opts.recordedPayoutIds?.has(payout.payoutId)) {
      return { ...base, state: "already_recorded", message: "Already recorded on a paid request" };
    }
    if (payout.statusKey !== "completed") {
      return {
        ...base,
        state: "not_completed",
        message: `${payout.status || "Not completed"}, left for later`,
      };
    }
    if (ambiguous) {
      return {
        ...base,
        state: "ambiguous_email",
        message: "Email is cut off and matches more than one payee",
      };
    }
    if (!email || group.length === 0) {
      return { ...base, state: "no_match", message: "No approved requests for this email" };
    }
    if ((completedPerEmail.get(email) ?? 0) > 1) {
      return {
        ...base,
        state: "duplicate_email",
        message: "More than one completed payout to this email. Fill these by hand.",
      };
    }
    if (Math.abs(expectedCents - payout.payoutAmountCents) > AMOUNT_TOLERANCE_CENTS) {
      return {
        ...base,
        state: "amount_mismatch",
        message: `Skydo paid ${formatUsdCents(payout.payoutAmountCents)}, approved here is ${formatUsdCents(expectedCents)}`,
      };
    }
    return { ...base, state: "ready", message: "Ready to mark paid" };
  });
}

export function buildPayoutDetails(
  payout: SkydoPayout,
  opts: {
    groupRequestCount: number;
    source: "import" | "manual";
    recordedBy: string | null;
    now?: Date;
    provider?: "skydo" | "manual";
  },
): WithdrawalPayoutDetails {
  return {
    provider: opts.provider ?? "skydo",
    payout_id: payout.payoutId || null,
    utr: payout.utr,
    payout_amount_usd: payout.payoutAmountCents / 100,
    amount_settled_inr: payout.settledInrPaise === null ? null : payout.settledInrPaise / 100,
    date_of_credit: payout.dateOfCredit,
    status: payout.status || null,
    payee_name: payout.name || null,
    payee_email: payout.email || null,
    group_request_count: opts.groupRequestCount,
    source: opts.source,
    recorded_at: (opts.now ?? new Date()).toISOString(),
    recorded_by: opts.recordedBy,
  };
}

/** Read `payout_details` defensively (it's jsonb, so anything could be in there). */
export function readPayoutDetails(raw: unknown): WithdrawalPayoutDetails | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    provider: o.provider === "manual" ? "manual" : "skydo",
    payout_id: str(o.payout_id),
    utr: str(o.utr),
    payout_amount_usd: num(o.payout_amount_usd),
    amount_settled_inr: num(o.amount_settled_inr),
    date_of_credit: str(o.date_of_credit),
    status: str(o.status),
    payee_name: str(o.payee_name),
    payee_email: str(o.payee_email),
    group_request_count: num(o.group_request_count) ?? 1,
    source: o.source === "manual" ? "manual" : "import",
    recorded_at: str(o.recorded_at) ?? "",
    recorded_by: str(o.recorded_by),
  };
}

/** INR per USD implied by a payout, e.g. 94.43. */
export function impliedUsdInrRate(details: WithdrawalPayoutDetails): number | null {
  const usd = details.payout_amount_usd;
  const inr = details.amount_settled_inr;
  if (!usd || !inr || usd <= 0 || inr <= 0) return null;
  return Math.round((inr / usd) * 100) / 100;
}

/** Fixed ChatGPT prompt, for when the copied text can't be pasted directly. */
export const SKYDO_CHATGPT_PROMPT = `You convert a Skydo payouts table into JSON. I will give you a screenshot of the table and the same table copied as text. Use the COPIED TEXT as the source of truth for every value (emails, IDs, amounts, UTR). Use the screenshot only to understand which values belong to which row.

Return ONLY a JSON array, no explanation, no code fence. One object per payout row, in the same order, with exactly these keys:

{
  "payout_id": string,                   // e.g. "pout_K4cpDw", copied exactly
  "name": string,                        // payee name
  "email": string,                       // full email, lowercase, copied exactly
  "status": string,                      // exactly as shown, e.g. "Completed" or "In progress"
  "payout_amount_usd": number,           // "USD 14.10" -> 14.10
  "amount_settled_inr": number | null,   // "INR 1,331.47" -> 1331.47, "-" -> null
  "date_of_credit": string | null,       // "Oct 16, 2026" -> "2026-10-16", "-" -> null
  "utr": string | null                   // copied exactly as a string, "-" -> null
}

Rules: never guess or complete a value; if a value is missing or "-", use null. Keep UTR and payout_id as strings. Do not skip any row, including "In progress" ones.`;
