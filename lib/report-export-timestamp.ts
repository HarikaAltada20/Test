const REPORT_TIME_ZONE = "Asia/Kolkata";

function getIstParts(instant: Date, hour12: boolean) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour").padStart(2, "0"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Report ID at download time: GOC-YYYYMMDDHHmmss (IST, 12-hour clock). */
export function buildReportIdFromInstant(instant: Date = new Date()): string {
  const { year, month, day, hour, minute, second } = getIstParts(instant, true);
  return `GOC-${year}${month}${day}${hour}${minute}${second}`;
}

/** Human-readable generated timestamp in IST. */
export function formatReportGeneratedTimestampIST(
  instant: Date = new Date(),
): string {
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(instant);

  return `${formatted} IST`;
}

/** Date-only label for cover footer (IST). */
export function formatReportExportDateIST(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(instant);
}
