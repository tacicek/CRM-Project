import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatReceiptTimestamp } from '@/lib/quittungPresentation';
import { documentI18nFor } from '@/i18n/documentLocale';
import type { Locale } from '@/i18n/locale';

export interface SignaturePadRef {
  clear: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  label: string;
  locale: Locale;
  signedAt?: string | null;
  existingSignature?: string | null;
  onConfirm: (dataUrl: string) => void;
  onClear: () => void;
  onDraw?: () => void;
  disabled?: boolean;
  className?: string;
}

/** Saved signatures are raster images, not editable vector strokes. Keeping them out of
 * signature_pad means resize can never erase a loaded signature or mistake it for empty.
 * The active pad holds only new strokes and rescales those strokes to its new CSS size.
 */
export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, locale, signedAt, existingSignature, onConfirm, onClear, onDraw, disabled, className }, ref) => {
    const { t } = documentI18nFor(locale);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const sizeRef = useRef({ width: 0, height: 0 });
    const drawRef = useRef(onDraw);
    drawRef.current = onDraw;

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const pad = padRef.current;
      if (!canvas || !container || !pad || !container.clientWidth || !container.clientHeight) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      const oldSize = sizeRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const strokes = pad.toData().map(group => ({ ...group, points: group.points.map(point => ({
        ...point, x: oldSize.width ? point.x * width / oldSize.width : point.x,
        y: oldSize.height ? point.y * height / oldSize.height : point.y,
      })) }));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext('2d')?.scale(ratio, ratio);
      sizeRef.current = { width, height };
      pad.clear();
      pad.fromData(strokes);
    }, []);

    useEffect(() => {
      if (existingSignature || !canvasRef.current) return;
      const pad = new SignaturePadLib(canvasRef.current, {
        backgroundColor: 'rgb(255,255,255)', penColor: 'rgb(0,0,0)', minWidth: 1.5, maxWidth: 2.5,
      });
      padRef.current = pad;
      const onEnd = () => drawRef.current?.();
      pad.addEventListener('endStroke', onEnd);
      resize();
      const observer = new ResizeObserver(resize);
      if (containerRef.current) observer.observe(containerRef.current);
      return () => { observer.disconnect(); pad.removeEventListener('endStroke', onEnd); pad.off(); padRef.current = null; sizeRef.current = { width: 0, height: 0 }; };
    }, [existingSignature, resize]);

    useEffect(() => {
      if (disabled) padRef.current?.off(); else padRef.current?.on();
    }, [disabled, existingSignature]);

    useImperativeHandle(ref, () => ({
      clear: () => padRef.current?.clear(),
      toDataURL: () => existingSignature || (padRef.current && !padRef.current.isEmpty() ? padRef.current.toDataURL('image/png') : null),
      isEmpty: () => !existingSignature && (padRef.current?.isEmpty() ?? true),
    }), [existingSignature]);

    const confirm = () => {
      if (!padRef.current || padRef.current.isEmpty()) return;
      onConfirm(padRef.current.toDataURL('image/png'));
    };

    return <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-folk-ink3">{label}</p>
        {existingSignature && signedAt && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle className="size-3" />{formatReceiptTimestamp(signedAt, locale)}</span>}
      </div>
      <div ref={containerRef} className={cn('relative h-36 overflow-hidden rounded-xl border-2 bg-white sm:h-44', existingSignature ? 'border-emerald-400' : 'border-dashed border-folk-line-hard')}>
        {existingSignature ? <img src={existingSignature} alt={label} className="h-full w-full object-contain" /> : <>
          <canvas ref={canvasRef} aria-label={label} className={cn('h-full w-full touch-none', disabled && 'pointer-events-none opacity-80')} />
          {!disabled && <p className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-xs text-slate-400">{t('receipt.signatureHere')}</p>}
        </>}
      </div>
      {!disabled && <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => { padRef.current?.clear(); onClear(); }} className="flex-1"><Trash2 className="mr-1 size-4" />{t('receipt.signatureClear')}</Button>
        {!existingSignature && <Button type="button" size="sm" onClick={confirm} className="flex-1"><CheckCircle className="mr-1 size-4" />{t('receipt.signatureConfirm')}</Button>}
      </div>}
    </div>;
  },
);
SignaturePad.displayName = 'SignaturePad';
