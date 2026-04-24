import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormErrorProps {
  message?: string;
  className?: string;
}

export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;

  return (
    <p className={cn("text-sm text-destructive flex items-center gap-1 mt-1", className)}>
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  );
}
