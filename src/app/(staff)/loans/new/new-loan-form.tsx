"use client";

import { CalendarIcon, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADDRESS_EXAMPLE } from "@/lib/address";
import { formatFullDate } from "@/lib/format";
import {
  LOAN_TYPES,
  type LoanType,
  loanTypeLabel,
  PURPOSES,
  type Purpose,
  purposeLabel,
  REFERRAL_SOURCES,
  type ReferralSource,
  referralSourceLabel,
} from "@/lib/loan-facts";
import { staffLabel } from "@/lib/stages";
import { cn } from "@/lib/utils";
import { type CreateLoanState, createLoan } from "@/server/actions/loans";
import type { CreateLoanField } from "@/server/actions/schemas";

/**
 * New loan (design frame 02-new-loan): a two-column grid, errors under their field, and
 * a footer that says what creating one does. The same form is the 560 px dialog over the
 * board and the standalone page at /loans/new, so `footer` lets each shell supply its own
 * Cancel.
 *
 * The action re-validates everything with the same zod schema; this form is not the
 * control, it is the affordance.
 */
export function NewLoanForm({
  footer,
  footerClassName = "border-t border-border pt-4",
  onCreated,
}: {
  /** Rendered beside the submit button: a dialog Cancel, or a link back on the page. */
  footer?: React.ReactNode;
  /** The dialog bleeds its footer to the edges; the page does not. */
  footerClassName?: string;
  /** The dialog closes itself; the page navigates. */
  onCreated?: () => void;
}) {
  const router = useRouter();
  const ids = {
    name: useId(),
    email: useId(),
    phone: useId(),
    address: useId(),
    purpose: useId(),
    program: useId(),
    amount: useId(),
    referral: useId(),
    close: useId(),
    addressHelp: useId(),
  };
  const [text, setText] = useState({
    borrowerName: "",
    borrowerEmail: "",
    borrowerPhone: "",
    propertyAddress: "",
    amount: "",
  });
  const bind = (field: keyof typeof text) => ({
    value: text[field],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setText((current) => ({ ...current, [field]: event.target.value })),
  });
  const [purpose, setPurpose] = useState<Purpose>("purchase");
  const [loanType, setLoanType] = useState<LoanType>("conventional");
  const [referral, setReferral] = useState<ReferralSource>("realtor");
  const [closeDate, setCloseDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [state, formAction] = useActionState<CreateLoanState, FormData>(
    async (previous, formData) => {
      const result = await createLoan(previous, formData);
      if (result?.ok) {
        toast.success(`${result.familyName} created · ${staffLabel("lead")}.`);
        onCreated?.();
        router.push(`/loans/${result.loanId}`);
        return null;
      }
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.errors : {};
  const formError = state && !state.ok ? state.error : undefined;
  /** Point a control at its error, or at its hint when there is no error. */
  const describedBy = (id: string, field: CreateLoanField, hintId?: string) =>
    errors[field] ? `${id}-error` : hintId;
  const errorCount = Object.keys(errors).length;

  return (
    <form action={formAction} className="contents" noValidate>
      {/* A failed submit is announced, not only painted; the detail stays by each field. */}
      <p role="status" aria-live="polite" className="sr-only">
        {errorCount > 0
          ? `The loan was not created. ${errorCount} ${errorCount === 1 ? "field needs" : "fields need"} attention.`
          : ""}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          id={ids.name}
          label="Borrower name"
          error={errors.borrowerName}
        >
          <Input
            id={ids.name}
            name="borrowerName"
            required
            {...bind("borrowerName")}
            autoComplete="off"
            aria-describedby={describedBy(ids.name, "borrowerName")}
            aria-invalid={errors.borrowerName ? true : undefined}
          />
        </Field>

        <Field id={ids.email} label="Email" error={errors.borrowerEmail}>
          <Input
            id={ids.email}
            name="borrowerEmail"
            required
            type="email"
            {...bind("borrowerEmail")}
            autoComplete="off"
            aria-describedby={describedBy(ids.email, "borrowerEmail")}
            aria-invalid={errors.borrowerEmail ? true : undefined}
          />
        </Field>

        <Field id={ids.phone} label="Phone" error={errors.borrowerPhone}>
          <Input
            id={ids.phone}
            name="borrowerPhone"
            type="tel"
            {...bind("borrowerPhone")}
            autoComplete="off"
            aria-describedby={describedBy(ids.phone, "borrowerPhone")}
          />
        </Field>

        <Field
          className="sm:col-span-2"
          id={ids.address}
          label="Property address"
          error={errors.propertyAddress}
          hint={`Street, city, state and ZIP — ${ADDRESS_EXAMPLE}`}
          hintId={ids.addressHelp}
        >
          <Input
            id={ids.address}
            name="propertyAddress"
            required
            {...bind("propertyAddress")}
            autoComplete="off"
            aria-describedby={describedBy(
              ids.address,
              "propertyAddress",
              ids.addressHelp,
            )}
            aria-invalid={errors.propertyAddress ? true : undefined}
          />
        </Field>

        <Field id={ids.purpose} label="Purpose" error={errors.purpose}>
          <input type="hidden" name="purpose" value={purpose} />
          <Select
            value={purpose}
            onValueChange={(value) => setPurpose(value as Purpose)}
          >
            <SelectTrigger
              id={ids.purpose}
              className="w-full"
              aria-describedby={describedBy(ids.purpose, "purpose")}
              aria-invalid={errors.purpose ? true : undefined}
            >
              <SelectValue>{purposeLabel(purpose)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {purposeLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id={ids.program} label="Program" error={errors.loanType}>
          <input type="hidden" name="loanType" value={loanType} />
          <Select
            value={loanType}
            onValueChange={(value) => setLoanType(value as LoanType)}
          >
            <SelectTrigger
              id={ids.program}
              className="w-full"
              aria-describedby={describedBy(ids.program, "loanType")}
              aria-invalid={errors.loanType ? true : undefined}
            >
              <SelectValue>{loanTypeLabel(loanType)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LOAN_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {loanTypeLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id={ids.amount} label="Loan amount" error={errors.amount}>
          <Input
            id={ids.amount}
            name="amount"
            required
            inputMode="numeric"
            placeholder="$425,000"
            {...bind("amount")}
            autoComplete="off"
            className="text-right tabular-nums"
            aria-describedby={describedBy(ids.amount, "amount")}
            aria-invalid={errors.amount ? true : undefined}
          />
        </Field>

        <Field
          id={ids.referral}
          label="Referral source"
          error={errors.referralSource}
        >
          <input type="hidden" name="referralSource" value={referral} />
          <Select
            value={referral}
            onValueChange={(value) => setReferral(value as ReferralSource)}
          >
            <SelectTrigger
              id={ids.referral}
              className="w-full"
              aria-describedby={describedBy(ids.referral, "referralSource")}
              aria-invalid={errors.referralSource ? true : undefined}
            >
              <SelectValue>{referralSourceLabel(referral)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REFERRAL_SOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {referralSourceLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          id={ids.close}
          label="Target close date"
          error={errors.targetCloseDate}
        >
          <input
            type="hidden"
            name="targetCloseDate"
            value={closeDate ? toISODate(closeDate) : ""}
          />
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button
                  id={ids.close}
                  type="button"
                  variant="outline"
                  aria-labelledby={`${ids.close}-label ${ids.close}-value`}
                  aria-describedby={describedBy(ids.close, "targetCloseDate")}
                  aria-invalid={errors.targetCloseDate ? true : undefined}
                  className="h-9 w-full justify-between text-body font-normal"
                />
              }
            >
              <span
                id={`${ids.close}-value`}
                className={cn(!closeDate && "text-muted-foreground")}
              >
                {closeDate
                  ? formatFullDate(toISODate(closeDate))
                  : "Pick a date"}
              </span>
              <CalendarIcon aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={closeDate}
                defaultMonth={closeDate}
                disabled={{ before: new Date() }}
                onSelect={(date) => {
                  setCloseDate(date);
                  setCalendarOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>

      {formError ? (
        <p role="alert" className="text-caption text-destructive">
          {formError}
        </p>
      ) : null}

      <div
        className={cn(
          "mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between",
          footerClassName,
        )}
      >
        <p className="text-caption text-muted-foreground">
          Creates the default needs list for a{" "}
          {purposeLabel(purpose).toLowerCase()} loan.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {footer}
          <SubmitButton pendingLabel="Creating…">Create loan</SubmitButton>
        </div>
      </div>
    </form>
  );
}

/** Label, control, optional hint and the error that replaces it. */
function Field({
  id,
  label,
  error,
  hint,
  hintId,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  hintId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1 text-caption text-destructive"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A calendar day as the plain calendar date the column stores, not a UTC instant. */
function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
