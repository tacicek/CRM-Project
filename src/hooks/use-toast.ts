import * as React from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive" | "success";

type ToastInput = {
  id?: string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  duration?: number;
  variant?: ToastVariant;
};

type ToastResult = {
  id: string | number;
  dismiss: () => void;
  update: (next: ToastInput) => void;
};

function showToast(input: ToastInput): string | number {
  const { id, title, description, action, duration, variant = "default" } = input;
  const headline = title ?? description ?? "";
  const details = title ? description : undefined;
  const options = { id, description: details, action, duration };

  if (variant === "destructive") {
    return sonnerToast.error(headline, options);
  }

  if (variant === "success") {
    return sonnerToast.success(headline, options);
  }

  return sonnerToast(headline, options);
}

function toast(input: ToastInput): ToastResult {
  const id = showToast(input);

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: ToastInput) => {
      showToast({ ...next, id });
    },
  };
}

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
