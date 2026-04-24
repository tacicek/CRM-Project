import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignaturePadRef {
  clear: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  label: string;
  signedAt?: string | null;
  existingSignature?: string | null;
  onConfirm: (dataUrl: string) => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, signedAt, existingSignature, onConfirm, onClear, disabled, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || !padRef.current) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = padRef.current.toData();
      canvas.width = container.offsetWidth * ratio;
      canvas.height = container.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(ratio, ratio);
      padRef.current.clear();
      padRef.current.fromData(data);
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      padRef.current = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255,255,255)",
        penColor: "rgb(0,0,0)",
        minWidth: 1.5,
        maxWidth: 2.5,
      });

      resizeCanvas();

      const ro = new ResizeObserver(resizeCanvas);
      if (containerRef.current) ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        padRef.current?.off();
      };
    }, [resizeCanvas]);

    // Load existing signature if provided
    useEffect(() => {
      if (existingSignature && padRef.current) {
        padRef.current.fromDataURL(existingSignature);
      }
    }, [existingSignature]);

    // Enable/disable
    useEffect(() => {
      if (!padRef.current) return;
      if (disabled) {
        padRef.current.off();
      } else {
        padRef.current.on();
      }
    }, [disabled]);

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      toDataURL: () => {
        if (!padRef.current || padRef.current.isEmpty()) return null;
        return padRef.current.toDataURL("image/png");
      },
      isEmpty: () => padRef.current?.isEmpty() ?? true,
    }));

    const handleClear = () => {
      padRef.current?.clear();
      onClear();
    };

    const handleConfirm = () => {
      if (!padRef.current || padRef.current.isEmpty()) return;
      const dataUrl = padRef.current.toDataURL("image/png");
      onConfirm(dataUrl);
    };

    const isSigned = !!existingSignature;

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            {label}
          </p>
          {isSigned && signedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
              <CheckCircle className="w-3 h-3" />
              {new Date(signedAt).toLocaleString("de-CH", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          )}
        </div>

        <div
          ref={containerRef}
          className={cn(
            "relative border-2 rounded-xl overflow-hidden bg-white",
            "h-36 sm:h-44",
            isSigned
              ? "border-emerald-400 bg-emerald-50/30"
              : "border-dashed border-slate-300 dark:border-slate-600",
          )}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", touchAction: "none" }}
            className={cn(disabled && "pointer-events-none opacity-80")}
          />
          {!isSigned && !disabled && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none select-none">
              Hier unterschreiben
            </p>
          )}
        </div>

        {!disabled && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="flex-1 h-9 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Löschen
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className="flex-1 h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              {isSigned ? "Neu bestätigen" : "Bestätigen"}
            </Button>
          </div>
        )}
      </div>
    );
  },
);

SignaturePad.displayName = "SignaturePad";
