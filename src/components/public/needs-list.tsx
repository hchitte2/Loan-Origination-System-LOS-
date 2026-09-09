"use client";

import { CheckCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Pill } from "@/components/pill";
import { Checkbox } from "@/components/ui/checkbox";
import type { PublicLoanView } from "@/server/authz";
import { ConditionCard } from "./condition-card";

/**
 * What the borrower still owes, and the e-consent that comes before the first upload
 * (design frames 05-public-desktop and 05-public-done).
 *
 * The consent box is shown once, above the first upload zone, and its value travels with
 * every upload into the activity detail — the log is append-only, so that is the durable
 * record that it was shown and ticked. Unticking it closes the zones again rather than
 * leaving a control that would fail on submit.
 *
 * When nothing is open, the whole list is replaced by the all-done card and a summary of
 * what was sent, which is the state the frame draws for a borrower with nothing to do.
 */
export function PublicNeedsList({
  view,
  token,
}: {
  view: PublicLoanView;
  token: string;
}) {
  const econsentId = useId();
  const open = view.conditions.filter((condition) => condition.acceptsUploads);
  const [econsent, setEconsent] = useState(false);
  // Announce a status change to a screen reader, since the page rewrites itself in place.
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    setAnnouncement(
      open.length === 0
        ? "Everything has been sent."
        : `${open.length} ${open.length === 1 ? "item is" : "items are"} still needed.`,
    );
  }, [open.length]);

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {open.length === 0 ? (
        <>
          <div className="flex flex-col items-start gap-2 rounded-lg border border-success/40 bg-success-soft p-4">
            <CheckCheck aria-hidden="true" className="size-6 text-success" />
            <h2 className="text-greeting text-foreground">
              Nice, that's everything for now.
            </h2>
            <p className="text-public text-muted-foreground">
              We'll let you know if we need anything else.
            </p>
          </div>
          <h3 className="text-section text-muted-foreground">
            What you've sent
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {view.conditions.map((condition) => (
              <li
                key={condition.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="text-public text-foreground">
                  {condition.title}
                </span>
                <Pill
                  tone={
                    condition.status === "cleared"
                      ? "success"
                      : condition.status === "received"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {condition.statusLabel}
                </Pill>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h2 className="text-greeting text-foreground">
            {view.loanOfficer.firstName} needs {open.length}{" "}
            {open.length === 1 ? "thing" : "things"} from you.
          </h2>

          <label
            htmlFor={econsentId}
            className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <Checkbox
              id={econsentId}
              checked={econsent}
              onCheckedChange={(checked) => setEconsent(checked === true)}
            />
            <span className="text-public text-foreground">
              I agree to receive loan updates electronically
            </span>
          </label>

          {view.conditions.map((condition) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              token={token}
              uploadPrefix={view.uploadPrefix}
              econsentGiven={econsent}
              // Until the box is ticked there is nothing to consent to an upload with,
              // so the zone stays closed rather than failing after the file is chosen.
              uploadsEnabled={econsent}
            />
          ))}
        </>
      )}
    </div>
  );
}
