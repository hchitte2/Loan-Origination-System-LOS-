import { Check, CircleDot } from "lucide-react";
import { ACTIVE_STAGES, borrowerLabel } from "@/lib/stages";
import { cn } from "@/lib/utils";

/**
 * Where the loan stands, in the borrower's words (design frames 05-public-desktop and
 * 05-public-mobile-*): a vertical list on a phone, horizontal on a wide screen.
 *
 * Six steps, always the same six, so the shape of the journey is visible from the first
 * visit. Position is never colour alone — done carries a check, the current step carries
 * a ring and the only sub-line on the list.
 */
export function MilestoneTracker({
  stageIndex,
  loanOfficerFirstName,
  processorFirstName,
}: {
  stageIndex: number;
  loanOfficerFirstName: string;
  /** Named in the "You are here" line when someone is working the file. */
  processorFirstName?: string | null;
}) {
  const helpers = processorFirstName
    ? `${loanOfficerFirstName} and ${processorFirstName}`
    : loanOfficerFirstName;

  return (
    <ol className="flex flex-col gap-0 rounded-lg border border-border bg-card p-4 sm:flex-row sm:gap-2">
      {ACTIVE_STAGES.map((stage, index) => {
        const done = index < stageIndex;
        const current = index === stageIndex;
        return (
          <li
            key={stage}
            className="relative flex gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
          >
            {/* The rail. Vertical on a phone, horizontal above the labels on desktop. */}
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[15px] h-full w-px -translate-y-1/2 sm:top-4 sm:left-auto sm:h-px sm:w-full sm:translate-y-0 sm:-translate-x-1/2",
                  done || current ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check aria-hidden="true" className="size-4" />
              ) : current ? (
                <CircleDot aria-hidden="true" className="size-4" />
              ) : null}
            </span>
            <span className="pb-4 sm:pb-0">
              <span
                className={cn(
                  "block text-public",
                  current
                    ? "font-medium text-foreground"
                    : done
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {borrowerLabel(stage)}
              </span>
              {current ? (
                <span className="block text-caption text-muted-foreground">
                  You are here · {helpers} {processorFirstName ? "are" : "is"}{" "}
                  moving this along
                </span>
              ) : null}
              <span className="sr-only">
                {done ? " · done" : current ? " · current step" : " · to come"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
