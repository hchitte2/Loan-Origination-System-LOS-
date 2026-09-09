/**
 * Formatting helpers shared by every screen. Money is whole dollars with commas; dates
 * are short ("Sep 19"); relative times read like a colleague wrote them ("2 min ago").
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "$485,000". */
export function formatMoney(amount: number): string {
  return money.format(amount);
}

/** "$6.2M" for tiles; whole millions drop the decimal ("$2M"). */
export function formatMoneyCompact(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  const thousands = amount / 1_000;
  return `$${Math.round(thousands)}K`;
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Sep 19" from a Date or a YYYY-MM-DD string. Dates are calendar days, read in UTC. */
export function formatDate(value: Date | string): string {
  const date =
    typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value;
  return shortDate.format(date);
}

const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Oct 3, 2026" — for a date far enough out that the year matters. */
export function formatFullDate(value: Date | string): string {
  const date =
    typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value;
  return fullDate.format(date);
}

const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Sat, Sep 6". */
export function formatLongDate(date: Date): string {
  return longDate.format(date);
}

/**
 * "Now", "2 min ago", "1 h ago", "Yesterday", "3 d ago", then a short date. Matches the
 * design's Activity and Users frames.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE_MS) return "Now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)} h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} d ago`;
  return formatDate(date);
}

/** Whole days since `date`, for "N d in stage" and condition ages. */
export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

/** "Alex Rivera" → "AR"; single names give one letter. */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Whole days from `now` until a calendar date ("2026-10-03" → 27 on Sep 6). Negative
 * once the date has passed. Calendar days are read at noon UTC so a timezone offset
 * never shifts the answer by one.
 */
export function daysUntil(date: Date | string, now: Date = new Date()): number {
  const target =
    typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12),
  );
  return Math.round((target.getTime() - from.getTime()) / DAY_MS);
}

/**
 * A file size as a person reads it: "1.2 MB", "184 KB", "812 B". Decimal units, because
 * that is what every operating system shows next to a downloaded file.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1000 / 1000).toFixed(1)} MB`;
}

/**
 * How old something is, in the queue's compact form: "1 h", "6 h", "2 d". Hours below a
 * day, days above it — a reviewer scanning a column wants the magnitude, not a sentence.
 */
export function formatAge(date: Date, now: Date = new Date()): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
