import { Sparkles } from "lucide-react";

/**
 * Phase 0 placeholder. The login page replaces this route in Phase 1.
 */
export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <main id="main" className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-card-foreground shadow-xs">
          <h1 className="text-2xl font-semibold tracking-tight">Clearline</h1>
          <p className="mt-2 text-muted-foreground">
            A demo loan origination system for a US mortgage shop.
          </p>
          <p className="mt-6 text-sm">
            Under construction. The login page and the first screens arrive
            next.
          </p>
          <p className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Demo · synthetic data
          </p>
        </div>
      </main>
    </>
  );
}
