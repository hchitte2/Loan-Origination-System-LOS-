"use client";

import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Clock,
  FileText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pill, type PillTone } from "@/components/pill";
import { UploadZone } from "@/components/upload-zone";
import { formatDate } from "@/lib/format";
import { registerPublicDocument } from "@/server/actions/public";
import type { PublicConditionView } from "@/server/authz";

/**
 * One thing the borrower has been asked for (design frames 05-public-*): what it is, why,
 * where it stands, what they have already sent, and — while it is still open — a way to
 * send another.
 *
 * The status pill uses the borrower vocabulary end to end. There is no "pending" and no
 * "rejected" here: an item whose last upload was turned down reads
 * "Needs another: <reason>" and simply reopens its box.
 */
const TONES: Record<string, PillTone> = {
  requested: "neutral",
  received: "warning",
  cleared: "success",
  waived: "neutral",
};

export function ConditionCard({
  condition,
  token,
  uploadPrefix,
  econsentGiven,
  uploadsEnabled,
}: {
  condition: PublicConditionView;
  token: string;
  /** The Blob folder this loan's uploads go to. Addressed with, never rendered. */
  uploadPrefix: string;
  econsentGiven: boolean;
  /** False until the e-consent box is ticked. */
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const needsAnother =
    condition.status === "requested" &&
    condition.statusLabel.startsWith("Needs another");

  const icon = needsAnother
    ? CircleAlert
    : condition.status === "received"
      ? Clock
      : condition.status === "cleared"
        ? CircleCheck
        : condition.status === "waived"
          ? CircleMinus
          : Circle;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-section text-foreground">{condition.title}</h3>
        <Pill
          tone={needsAnother ? "destructive" : TONES[condition.status]}
          icon={icon}
        >
          {condition.statusLabel}
        </Pill>
      </div>

      {condition.instructions ? (
        <p className="text-public text-muted-foreground">
          {condition.instructions}
        </p>
      ) : null}

      {condition.documents.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {condition.documents.map((document) => (
            <li
              key={`${document.fileName}-${document.sentOn.toISOString()}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="truncate text-public text-foreground">
                  {document.fileName}
                </span>
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">
                sent {formatDate(document.sentOn)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {condition.acceptsUploads ? (
        <UploadZone
          pathnamePrefix={uploadPrefix}
          disabled={!uploadsEnabled}
          clientPayload={{ token }}
          label={`Upload a file for ${condition.title}`}
          register={async (file) => {
            const result = await registerPublicDocument({
              token,
              conditionId: condition.id,
              econsent: econsentGiven,
              ...file,
            });
            if (result?.ok) {
              toast.success(`Thanks — we have your ${result.conditionTitle}.`);
              router.refresh();
              return null;
            }
            return (
              result?.error ?? "That upload did not go through. Try again."
            );
          }}
        />
      ) : null}
    </section>
  );
}
