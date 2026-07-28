/**
 * A real screenshot with an optional numbered legend.
 *
 * Three things this component is careful about:
 *
 *  - **No layout shift.** `width`/`height` come from the capture manifest and are set
 *    as real attributes, so the browser reserves the right box before the file loads.
 *  - **No text in the bitmap.** Hotspot markers are positioned in percent with CSS and
 *    their labels are ordinary translated text. Baking labels into the image would
 *    mean re-capturing every screenshot for every language.
 *  - **Zoom returns focus.** The enlarged view is a Radix Dialog, which restores focus
 *    to the trigger on close, so a keyboard user is not dropped at the top of the page.
 */
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { WikiFigureBlock } from "@/features/wiki/wikiTypes";
import { useT } from "@/i18n/useI18n";

export const WikiFigure = ({
  figure,
  /** Above-the-fold figures load eagerly; everything below waits until it is near. */
  priority = false,
}: {
  figure: WikiFigureBlock;
  priority?: boolean;
}) => {
  const t = useT();
  const hotspots = figure.hotspots ?? [];

  return (
    <figure className="space-y-2">
      {/*
        Never render an image larger than it was captured. A narrow element crop — the
        240px sidebar, say — stretched to the full article width turns into a blurry
        smear, which defeats the point of a screenshot. Wide screenshots still scale
        DOWN to fit, so the layout stays responsive to 320px.
      */}
      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-folk-line bg-folk-card"
        style={{ maxWidth: `${figure.width}px` }}
      >
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`${t("wiki.figure.zoom")}: ${figure.caption}`}
              title={t("wiki.figure.zoomHint")}
              className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink focus-visible:ring-offset-2 print:cursor-auto"
            >
              <img
                src={figure.src}
                alt={figure.alt}
                width={figure.width}
                height={figure.height}
                loading={priority ? "eager" : "lazy"}
                decoding="async"
                className="h-auto w-full"
              />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] p-2 sm:max-w-[92vw]">
            {/* The caption is the accessible name of the enlarged view. */}
            <DialogTitle className="sr-only">{figure.caption}</DialogTitle>
            <img
              src={figure.src}
              alt={figure.alt}
              width={figure.width}
              height={figure.height}
              className="h-auto max-h-[85vh] w-full rounded-lg object-contain"
            />
          </DialogContent>
        </Dialog>

        {/*
          Numbered markers laid over the bitmap. Decorative: every marker is repeated
          as a real list item below, which is what a screen reader announces.
        */}
        {hotspots.map((spot) => (
          <span
            key={spot.n}
            className="pointer-events-none absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-folk-coral font-mono text-[12px] font-bold text-white shadow-md"
            style={{ left: `${spot.xPct}%`, top: `${spot.yPct}%` }}
            aria-hidden="true"
          >
            {spot.n}
          </span>
        ))}
      </div>

      <figcaption className="mx-auto text-[14px] text-folk-ink3" style={{ maxWidth: `${figure.width}px` }}>
        {figure.caption}
      </figcaption>

      {hotspots.length > 0 && (
        <ol className="space-y-1.5" aria-label={t("wiki.figure.legend")}>
          {hotspots.map((spot) => (
            <li key={spot.n} className="flex gap-2.5 text-[14px] text-folk-ink2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-folk-coral font-mono text-[11px] font-bold text-white">
                {spot.n}
              </span>
              <span className="min-w-0">{spot.label}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
};
