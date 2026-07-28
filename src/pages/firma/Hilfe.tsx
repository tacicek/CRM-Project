/**
 * /firma/hilfe and /firma/hilfe/:slug
 *
 * One page serves both the index and every article, because the search index is
 * shared: opening an article and then searching from it must not re-download it.
 *
 * Everything below the chrome is loaded on demand — the per-locale index when the page
 * mounts, the article body when a slug is opened — so the help centre costs nothing to
 * an operator who never opens it.
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { WikiArticleView } from "@/features/wiki/components/WikiArticleView";
import { WikiHome } from "@/features/wiki/components/WikiHome";
import { loadArticleBody, loadSearchIndex } from "@/features/wiki/wikiContent";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import { WIKI_REGISTRY } from "@/features/wiki/wikiRegistry";
import { isWikiSlug } from "@/features/wiki/wikiSlugs";
import type { WikiArticleBody, WikiSearchIndex } from "@/features/wiki/wikiTypes";
import { useI18n, useT } from "@/i18n/useI18n";

const HelpIcon = WIKI_ICONS.help;

/** Shared empty-state shell, matching the convention the other firma pages use. */
const Notice = ({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) => (
  <div className="rounded-xl border border-folk-line bg-folk-card py-16 text-center">
    <p className="font-semibold text-folk-ink">{title}</p>
    <p className="mx-auto mt-1 max-w-md text-[14px] text-folk-ink3">{hint}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const Hilfe = () => {
  const t = useT();
  const { locale } = useI18n();
  const { slug } = useParams<{ slug: string }>();

  const [index, setIndex] = useState<WikiSearchIndex | null>(null);
  const [body, setBody] = useState<WikiArticleBody | null>(null);
  const [bodyError, setBodyError] = useState(false);
  const [bodyLoading, setBodyLoading] = useState(false);

  // The per-locale search index. Re-fetched on a language switch; the loader caches,
  // so switching back is instant.
  useEffect(() => {
    let cancelled = false;
    loadSearchIndex(locale)
      .then((loaded) => {
        if (!cancelled) setIndex(loaded);
      })
      .catch(() => {
        // The index only powers search; the category lists still render from the
        // registry, so a failure here degrades rather than breaks the page.
        if (!cancelled) setIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // The article body, when a slug is in the URL.
  useEffect(() => {
    if (!slug || !isWikiSlug(slug)) {
      setBody(null);
      setBodyError(false);
      return;
    }
    let cancelled = false;
    setBodyLoading(true);
    setBodyError(false);
    loadArticleBody(slug, locale)
      .then((loaded) => {
        if (cancelled) return;
        setBody(loaded);
        setBodyLoading(false);
        // A fresh article starts at the top; an in-page anchor keeps its position.
        if (!window.location.hash) window.scrollTo({ top: 0, behavior: "auto" });
      })
      .catch(() => {
        if (cancelled) return;
        setBodyError(true);
        setBodyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  const meta = slug && isWikiSlug(slug) ? WIKI_REGISTRY[slug] : null;
  const pageTitle = body?.title ?? t("wiki.title");

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
      </Helmet>

      <div className="space-y-5">
        {/* The index page keeps the standard firma page header; an article renders its own. */}
        {!slug && (
          <header className="flex flex-wrap items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-folk-bg-warm">
              <HelpIcon className="h-5 w-5 text-folk-ink2" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold tracking-tight text-folk-ink">{t("wiki.title")}</h1>
              <p className="text-[15px] text-folk-ink3">{t("wiki.subtitle")}</p>
            </div>
          </header>
        )}

        {!slug && <WikiHome index={index} />}

        {slug && !meta && (
          <Notice
            title={t("wiki.state.notFoundTitle")}
            hint={t("wiki.state.notFoundHint")}
            action={
              <Link
                to="/firma/hilfe"
                className="inline-flex h-9 items-center rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-folk-bg hover:bg-folk-ink2"
              >
                {t("wiki.nav.backToHome")}
              </Link>
            }
          />
        )}

        {slug && meta && bodyLoading && (
          <div className="flex justify-center py-16" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-folk-coral" aria-hidden="true" />
            <span className="sr-only">{t("wiki.state.loading")}</span>
          </div>
        )}

        {slug && meta && bodyError && (
          <Notice title={t("wiki.state.errorTitle")} hint={t("wiki.state.errorHint")} />
        )}

        {slug && meta && body && !bodyLoading && !bodyError && (
          <WikiArticleView meta={meta} body={body} index={index} />
        )}
      </div>
    </>
  );
};

export default Hilfe;
