/** Format number as Indonesian Rupiah: 1500000 -> "Rp 1.500.000" */
export function formatIDR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `Rp\u00A0${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}`;
}

/** Format decimal number without currency symbol */
export function formatNumber(value: number | string | null | undefined, digits = 0): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);
}

/** Format date to Indonesian long format: 17 September 2026 */
export function formatDateID(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Format date short: 17 Sep 2026 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** Format datetime: 17 Sep 2026, 14:20 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** Bytes -> human readable */
export function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convert Date to yyyy-MM-dd for <input type="date"> */
export function toInputDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

/** Days from now until date (negative = past) */
export function daysUntil(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
