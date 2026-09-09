"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./ui/button";

/**
 * A number worth watching (design frames 04-queue and 06-dashboard): a quiet label, the
 * value at display size, and a sub-line saying what it is counting.
 *
 * The `info` button opens the definition rather than hiding it in a tooltip, because a
 * KPI that cannot be reconciled is a KPI nobody trusts — and a disclosure is reachable
 * by keyboard, which a hover tooltip is not.
 */
export function KpiTile({
  label,
  value,
  unit,
  sub,
  definition,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  definition?: string;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-control font-normal text-muted-foreground">
          {label}
        </span>
        {definition ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            <Info aria-hidden="true" />
            <span className="sr-only">What "{label}" counts</span>
          </Button>
        ) : null}
      </div>
      <p className="text-kpi text-foreground tabular-nums">
        {value}
        {unit ? (
          <span className="ml-1 text-control text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
      {sub ? <p className="text-caption text-muted-foreground">{sub}</p> : null}
      {definition && open ? (
        <p
          id={panelId}
          className="mt-1 rounded-lg bg-muted p-2 text-caption text-muted-foreground"
        >
          {definition}
        </p>
      ) : null}
    </div>
  );
}
