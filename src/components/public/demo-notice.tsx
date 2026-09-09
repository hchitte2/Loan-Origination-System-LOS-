/**
 * The sentence every borrower render carries (`.claude/rules/public.md`). Plain, quiet,
 * and never behind a click: someone arriving from a text message should be told what
 * this is before they upload anything.
 */
export function DemoNotice() {
  return (
    <p className="text-center text-caption text-muted-foreground">
      Demo system with synthetic data. Do not upload real personal documents.
    </p>
  );
}
