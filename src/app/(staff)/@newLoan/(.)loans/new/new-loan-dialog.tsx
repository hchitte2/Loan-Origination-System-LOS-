"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NewLoanForm } from "@/app/(staff)/loans/new/new-loan-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The dialog shell for the intercepted route. Closing it goes back, so the board returns
 * and the URL follows; creating navigates on to the new loan instead.
 */
export function NewLoanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    router.back();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="sm:max-w-dialog-form">
        <DialogHeader>
          <DialogTitle>New loan</DialogTitle>
        </DialogHeader>
        <NewLoanForm
          footerClassName="-mx-6 -mb-6 rounded-b-lg border-t border-border px-6 py-4"
          footer={
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          }
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
