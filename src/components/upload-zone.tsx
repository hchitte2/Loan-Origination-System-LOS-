"use client";

import { upload } from "@vercel/blob/client";
import { CircleAlert, FileText, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatFileSize } from "@/lib/format";
import {
  ALLOWED_CONTENT_TYPES,
  type FileRejection,
  fileRejection,
  safeFileName,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

/**
 * The upload zone in all four drawn states (design-system skill, "Upload zone"; frames
 * 05-public-*): idle, drag-over, uploading with progress, and error.
 *
 * The browser writes straight to Blob and then tells the server about it. That means the
 * file never passes through a Server Action — which is what keeps a 10 MB upload off a
 * serverless function — and it is why `register` re-checks everything: this component is
 * a convenience, never a control.
 *
 * `clientPayload` is what tells `/api/upload` who is asking. Staff send a loan id and are
 * judged by their session; the borrower's page sends its token and has no session at all.
 * Neither is trusted: the route resolves the loan itself from whichever arrives.
 *
 * The size and type check here is a courtesy — it saves a doomed upload and gives the
 * kind sentence the design asks for. Blob refuses the same things by token, and the
 * register action refuses them again from what the store actually holds.
 */
export function UploadZone({
  pathnamePrefix,
  clientPayload,
  register,
  label,
  audience = "staff",
  disabled,
  onUploaded,
}: {
  /**
   * The folder the file belongs in, from `uploadPrefix(loanId)`. The zone is handed the
   * folder rather than the loan it belongs to: the borrower's page has no loan id to
   * give, and this way the route's prefix check is the only thing that has to know.
   */
  pathnamePrefix: string;
  /** `{ loanId }` for staff, `{ token }` for the borrower's page. */
  clientPayload: Record<string, string>;
  /** Records the upload once Blob has it. Returns the sentence to show, or null. */
  register: (file: {
    blobPathname: string;
    fileName: string;
  }) => Promise<string | null>;
  /** What this zone is for, for screen readers: "Upload a file for Pay stubs". */
  label: string;
  /**
   * Whose screen this is. It decides the voice of the check-it step and its tap targets:
   * the borrower's page wants 44 px (design-system skill, "Sizes and spacing").
   */
  audience?: "staff" | "borrower";
  disabled?: boolean;
  onUploaded?: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<FileRejection | null>(null);
  const [progress, setProgress] = useState<{
    name: string;
    percent: number;
    sent: number;
    total: number;
  } | null>(null);
  // Picked, not yet sent. Nothing reaches the network until the person says so.
  const [chosen, setChosen] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const busy = progress !== null;

  // The preview is a blob: URL over the local File — the bytes never leave the browser,
  // which is what lets the borrower look at their own upload at all. The public page is
  // forbidden from serving them back afterwards, so this is the only chance they get.
  useEffect(() => {
    if (!chosen?.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(chosen);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [chosen]);

  /**
   * Take a file from the picker or a drop and hold it for checking.
   *
   * The type and size refusal happens here rather than after the confirm, so an .exe or
   * an 11 MB photo is turned away in the same breath as choosing it — and a file that is
   * never sent costs no upload slot and no `put` against the month's budget, which is the
   * other half of why this step exists.
   */
  function choose(file: File): void {
    const refusal = fileRejection(file.type, file.size);
    if (refusal) {
      setError(refusal);
      setChosen(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setChosen(file);
  }

  function discard(): void {
    setChosen(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.click();
  }

  async function send(file: File): Promise<void> {
    setError(null);
    const refusal = fileRejection(file.type, file.size);
    if (refusal) {
      setError(refusal);
      return;
    }

    setProgress({ name: file.name, percent: 0, sent: 0, total: file.size });
    try {
      const result = await upload(
        `${pathnamePrefix}${safeFileName(file.name)}`,
        file,
        {
          access: "private",
          handleUploadUrl: "/api/upload",
          clientPayload: JSON.stringify(clientPayload),
          contentType: file.type,
          onUploadProgress: ({ percentage, loaded, total }) => {
            setProgress({
              name: file.name,
              percent: Math.round(percentage),
              sent: loaded,
              total,
            });
          },
        },
      );
      const failed = await register({
        blobPathname: result.pathname,
        fileName: file.name,
      });
      if (failed) {
        setError({ title: failed, hint: "Try again." });
        return;
      }
      onUploaded?.();
    } catch (caught) {
      // The route's refusals arrive as the message on a thrown BlobError. They are
      // written to be read by whoever is looking at this zone.
      setError({
        title:
          caught instanceof Error && caught.message
            ? caught.message.replace(/^Vercel Blob:\s*/, "").replace(/\.$/, "")
            : "That upload did not go through",
        hint: "Try again.",
      });
    } finally {
      setProgress(null);
      setChosen(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (busy) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-body text-foreground">
            {progress.name}
          </span>
          <span className="shrink-0 text-body text-muted-foreground tabular-nums">
            {progress.percent}%
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${progress.name}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-caption text-muted-foreground tabular-nums">
          Uploading · {formatFileSize(progress.sent)} of{" "}
          {formatFileSize(progress.total)}
        </p>
      </div>
    );
  }

  /**
   * Picked, not yet sent (an extension to the four states the handoff drew — proposed for
   * the design-system skill). Solid border on `card` rather than the zone's dashed
   * `primary`: this is no longer somewhere to drop a file, it is the file itself.
   *
   * An image shows; a PDF cannot without a renderer we do not ship, so it gets its name,
   * size and type — which is roughly what the file picker already showed, and why this
   * step earns its keep mostly for photographs.
   */
  if (chosen) {
    const borrower = audience === "borrower";
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
      >
        <p className="text-body font-medium text-foreground">
          {borrower ? "Does this look right?" : "Check this is the right file."}
        </p>

        {previewUrl ? (
          // biome-ignore lint/performance/noImgElement: next/image cannot optimize a blob: URL over a local File, and there is nothing to optimize — the bytes are already in the browser and must not leave it.
          <img
            src={previewUrl}
            alt=""
            className="max-h-64 w-full rounded-lg border border-border object-contain"
          />
        ) : (
          <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-4">
            <FileText
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 truncate text-body text-foreground">
              {chosen.name}
            </span>
          </span>
        )}

        <p className="text-caption text-muted-foreground tabular-nums">
          {chosen.name} · {formatFileSize(chosen.size)}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void send(chosen)}
            className={cn(borrower && "min-h-11 flex-1")}
          >
            {borrower ? "Send this file" : "Upload file"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={discard}
            className={cn(borrower && "min-h-11 flex-1")}
          >
            {borrower ? "Choose a different one" : "Choose another"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the label inside is the real control; these handlers only add dragging as an alternative way to reach it. */}
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          // Moving over a child fires dragleave on the parent; ignore those.
          if (
            event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            return;
          }
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files?.[0];
          if (file) choose(file);
        }}
      >
        <label
          htmlFor={inputId}
          className={cn(
            // A 2 px border at rest as well as on drag-over, so becoming a drop target
            // changes the colour and not the layout.
            "upload-zone flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-3 text-center transition-colors duration-150 ease-out motion-reduce:transition-none",
            disabled && "cursor-not-allowed opacity-50",
            error
              ? "border-destructive"
              : dragging
                ? "border-primary bg-primary-soft"
                : "border-primary hover:bg-primary-soft",
          )}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={ALLOWED_CONTENT_TYPES.join(",")}
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) choose(file);
            }}
          />
          {error ? (
            <CircleAlert
              aria-hidden="true"
              className="size-5 text-destructive"
            />
          ) : (
            <Upload aria-hidden="true" className="size-5 text-primary" />
          )}
          <span
            className={cn(
              "text-body font-medium",
              error ? "text-destructive" : "text-foreground",
            )}
          >
            {error
              ? error.title
              : dragging
                ? "Drop to upload"
                : "Tap to upload"}
          </span>
          <span className="text-caption text-muted-foreground">
            {error ? error.hint : "PDF, JPG or PNG · up to 10 MB"}
          </span>
          <span className="sr-only">{label}</span>
        </label>
      </div>
      {/* The zone itself carries the message; this announces it. Rendered only when
          there is one, so a page of zones is not a page of empty live regions. */}
      {error ? (
        <p role="alert" className="sr-only">
          {`${error.title}. ${error.hint}`}
        </p>
      ) : null}
    </div>
  );
}
