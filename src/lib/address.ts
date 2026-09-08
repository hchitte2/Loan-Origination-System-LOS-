/**
 * The property address is one field on the New loan form (design frame 02-new-loan) but
 * four columns on `loans` (PLAN.md §6). This parses the one into the four, strictly: a
 * demo takes synthetic US addresses in a single shape, and a strict parse with a worked
 * example in the error beats a lenient one that files a loan under the wrong city.
 *
 *   "48 Juniper Way, Austin TX 78704"
 *   "1200 Ridgeway Dr, Nashville, TN 37201"   (the comma before the state is optional)
 *
 * It reads from the right, one anchored match at a time, rather than with a single
 * pattern. A pattern with adjacent `[^,]+?` and `\s*` runs backtracks catastrophically on
 * input that can never match — 500 spaces measured 23 seconds of CPU — and this action is
 * reachable by anyone the demo hands a session to. Each step below is one anchored
 * quantifier over a bounded string, so the work stays linear in the input.
 */
export type ParsedAddress = {
  street: string;
  city: string;
  /** Two letters, upper case. */
  state: string;
  /** Five digits, or ZIP+4. */
  zip: string;
};

/** Longer than any synthetic address; refused before any matching happens. */
export const ADDRESS_MAX_LENGTH = 200;

/** The one shape the form accepts, quoted back to whoever typed something else. */
export const ADDRESS_EXAMPLE = "48 Juniper Way, Austin TX 78704";

const TRAILING_ZIP = /\s(\d{5}(?:-\d{4})?)$/;
const TRAILING_STATE = /\s([A-Za-z]{2})$/;

export function parseAddress(value: string): ParsedAddress | null {
  if (value.length > ADDRESS_MAX_LENGTH) return null;

  const trimmed = value.trimEnd();
  const zipMatch = TRAILING_ZIP.exec(trimmed);
  const zip = zipMatch?.[1];
  if (!zip) return null;
  const withoutZip = trimmed.slice(0, zipMatch.index).trimEnd();

  const stateMatch = TRAILING_STATE.exec(withoutZip);
  const state = stateMatch?.[1];
  if (!state) return null;
  // A comma may sit between the city and the state: "Nashville, TN 37201".
  const withoutState = withoutZip
    .slice(0, stateMatch.index)
    .trimEnd()
    .replace(/,$/, "")
    .trimEnd();

  // What is left is "street, city". One comma separates them, so neither may contain one
  // — which is what keeps "48 Juniper Way, Apt 2, Austin TX 78704" out.
  const comma = withoutState.indexOf(",");
  if (comma === -1 || comma !== withoutState.lastIndexOf(",")) return null;
  const street = withoutState.slice(0, comma).trim();
  const city = withoutState.slice(comma + 1).trim();
  if (!street || !city) return null;

  return { street, city, state: state.toUpperCase(), zip };
}

/** "412 Maple Ave, Austin TX 78704" — the same shape, for a form that edits one. */
export function formatAddress(address: ParsedAddress): string {
  return `${address.street}, ${address.city} ${address.state} ${address.zip}`;
}
