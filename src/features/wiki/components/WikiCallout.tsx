/**
 * A highlighted note inside an article.
 *
 * Every tone renders an icon *and* the word for that tone ("Achtung", "Nicht
 * umkehrbar"). Colour is decoration only — a reader who cannot distinguish the border
 * colours still gets the full meaning from the text.
 */
import { CALLOUT_ICON } from "@/features/wiki/wikiIcons";
import type { WikiCalloutTone } from "@/features/wiki/wikiTypes";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";
import { cn } from "@/lib/utils";

const TONE_STYLE: Record<WikiCalloutTone, { box: string; icon: string }> = {
  tip: { box: "border-folk-sky bg-folk-sky-bg", icon: "text-folk-sky" },
  warning: { box: "border-folk-coral bg-folk-coral-bg", icon: "text-folk-coral" },
  danger: { box: "border-folk-rose bg-folk-rose-bg", icon: "text-folk-rose" },
  permission: { box: "border-folk-violet bg-folk-violet-bg", icon: "text-folk-violet" },
};

const TONE_LABEL: Record<WikiCalloutTone, MessageKey> = {
  tip: "wiki.callout.tip",
  warning: "wiki.callout.warning",
  danger: "wiki.callout.danger",
  permission: "wiki.callout.permission",
};

export const WikiCallout = ({
  tone,
  title,
  text,
}: {
  tone: WikiCalloutTone;
  title: string;
  text: string;
}) => {
  const t = useT();
  const Icon = CALLOUT_ICON[tone];
  const style = TONE_STYLE[tone];

  return (
    <aside
      className={cn(
        "flex gap-3 rounded-xl border-l-4 border-y border-r border-y-folk-line border-r-folk-line p-3.5",
        style.box,
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.icon)} strokeWidth={1.9} aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="text-[14px] font-semibold text-folk-ink">
          {/* The tone is named in words, so it is never carried by colour alone. */}
          <span className="uppercase tracking-wide">{t(TONE_LABEL[tone])}</span>
          <span className="mx-1.5 text-folk-ink4" aria-hidden="true">
            ·
          </span>
          {title}
        </p>
        <p className="text-[15px] leading-relaxed text-folk-ink2">{text}</p>
      </div>
    </aside>
  );
};
