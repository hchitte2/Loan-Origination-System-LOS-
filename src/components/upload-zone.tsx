"use client";

import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { formatFileSize } from "@/lib/format";
import {
  ALLOWED_CONTENT_TYPES,
  blobPathnameFor,
  fileRejection,
} from "@/lib/uploads";
import { cn } from "@/lib/utils";

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
  loanId,
  clientPayload,
  register,
  label,
  disabled,
  onUploaded,
}: {
  /** The folder the file belongs in. The route pins the token to this prefix. */
  loanId: string;
  /** `{ loanId }` for staff, `{ token }` for the borrower's page. */
  clientPayload: Record<string, string>;
  /** Records the upload once Blob has it. Returns the sentence to show, or null. */
  register: (file: {
    blobPathname: string;
    fileName: string;
  }) => Promise<string | null>;
  /** What this zone is for, for screen readers: "Upload a file for Pay stubs". */
  label: string;
  disabled?: boolean;
  onUploaded?: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    name: string;
    percent: number;
    sent: number;
    total: number;
  } | null>(null);

  const busy = progress !== null;

  async function send(file: File): Promise<void> {
    setError(null);
    const refusal = fileRejection(file.type, file.size);
    if (refusal) {
      setError(refusal);
      return;
    }

    setProgress({ name: file.name, percent: 0, sent: 0, total: file.size });
    try {
      const result = await upload(blobPathnameFor(loanId, file.name), file, {
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
      });
      const failed = await register({
        blobPathname: result.pathname,
        fileName: file.name,
      });
      if (failed) {
        setError(failed);
        return;
      }
      onUploaded?.();
    } catch (caught) {
      // The route's refusals arrive as the message on a thrown BlobError. They are
      // written to be read by whoever is looking at this zone.
      setError(
        caught instanceof Error && caught.message
          ? caught.message.replace(/^Vercel Blob:\s*/, "")
          : "That upload did not go through. Try again.",
      );
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (busy) {
    return (
      <div className="rounded-lg bg-muted p-3">
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

  return (
    <div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the label inside is the real control; these handlers only add dragging as an alternative way to reach it. */}
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files?.[0];
          if (file) void send(file);
        }}
      >
        <label
          htmlFor={inputId}
          className={cn(
            "upload-zone flex min-h-upload-zone cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-3 text-center transition-colors duration-150 ease-out motion-reduce:transition-none",
            disabled && "cursor-not-allowed opacity-50",
            error
              ? "border-destructive bg-destructive-soft"
              : dragging
                ? "border-2 border-primary bg-primary-soft"
                : "border-primary bg-primary-soft/40 hover:bg-primary-soft",
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
              if (file) void send(file);
            }}
          />
          <Upload aria-hidden="true" className="size-5 text-primary" />
          <span className="text-body font-medium text-foreground">
            {dragging ? "Drop to upload" : "Tap to upload"}
          </span>
          <span className="text-caption text-muted-foreground">
            PDF, JPG or PNG · up to 10 MB
          </span>
          <span className="sr-only">{label}</span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
