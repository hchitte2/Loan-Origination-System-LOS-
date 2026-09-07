/**
 * Production-database guard shared by every `pnpm db:*` script.
 *
 * `.claude/prod-db-host` lists the Neon `main` branch hostname(s). A script that finds
 * that host in `DATABASE_URL` refuses to run unless `CLEARLINE_RELEASE=1` is set, which
 * only the /release procedure does. Matching mirrors `.claude/hooks/block-unsafe.sh`:
 * a Neon hostname is reduced to its endpoint id so the direct and `-pooler` hostnames
 * both match, and the comparison is case-insensitive.
 *
 * Pure: no IO, so `tests/unit/db-guard.test.ts` can drive it.
 */

/** Lines of `.claude/prod-db-host`, minus comments, blank lines and whitespace. */
export function parseProdHostFile(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** `ep-name-123456-pooler.region.aws.neon.tech` → `ep-name-123456`; other hosts unchanged. */
export function hostKey(host: string): string {
  const trimmed = host.trim();
  if (!trimmed.startsWith("ep-")) return trimmed;
  const [endpoint] = trimmed.split(".");
  return endpoint.replace(/-pooler$/, "");
}

/** True when `databaseUrl` names any of the configured production hosts. */
export function isProductionHost(
  databaseUrl: string,
  prodHosts: readonly string[],
): boolean {
  const haystack = databaseUrl.toLowerCase();
  return prodHosts.some((host) => {
    const key = hostKey(host).toLowerCase();
    return key !== "" && haystack.includes(key);
  });
}
