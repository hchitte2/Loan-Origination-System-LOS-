/** First tab stop on every page; visible on focus top-left as a primary button. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only rounded-lg bg-primary px-3 py-2 text-control text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      Skip to content
    </a>
  );
}
