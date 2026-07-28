/**
 * The contextual help control in the CRM header.
 *
 * It resolves the *current* route — including detail routes like `/firma/kunden/:id` —
 * to the article that explains it, and links straight there. When a screen has no
 * article yet the button still works: it goes to the help index, which is honest and
 * more useful than hiding the control or opening something unrelated.
 *
 * On narrow screens the label collapses to the icon, but `aria-label` and `title`
 * always carry the name, so the control is never an unlabelled icon.
 */
import { Link, useLocation } from "react-router-dom";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import { helpArticleForPath } from "@/features/wiki/wikiRouteMap";
import { useT } from "@/i18n/useI18n";

const HelpIcon = WIKI_ICONS.help;

export const WikiHelpButton = () => {
  const t = useT();
  const location = useLocation();

  const slug = helpArticleForPath(location.pathname);
  const target = slug ? `/firma/hilfe/${slug}` : "/firma/hilfe";
  const label = slug ? t("nav.hilfe.open") : t("nav.hilfe");

  return (
    <Link
      to={target}
      aria-label={label}
      title={label}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-folk-line bg-folk-card px-2 text-folk-ink2 transition-colors hover:bg-folk-bg-warm hover:text-folk-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink focus-visible:ring-offset-2 sm:px-3"
    >
      <HelpIcon className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {/* Hidden below `sm`, where the header is tight; the accessible name stays. */}
      <span className="hidden text-sm font-medium sm:block">{t("nav.hilfe")}</span>
    </Link>
  );
};
