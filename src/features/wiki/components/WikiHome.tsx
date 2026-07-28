/**
 * The help centre landing page.
 *
 * Ordered by what a lost operator needs, not alphabetically: search first (they may
 * already know the word), then "Start here" for someone on their first day, then the
 * everyday guides, then the full shelf of categories.
 */
import { Link } from "react-router-dom";
import { WikiSearch } from "@/features/wiki/components/WikiSearch";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import { articlesByCategory, DAILY_GUIDES, WIKI_REGISTRY, visibleArticles } from "@/features/wiki/wikiRegistry";
import type { WikiArticleMeta, WikiSearchIndex } from "@/features/wiki/wikiTypes";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

const StartIcon = WIKI_ICONS.start;

/** A tappable card: icon + localized title + one-line summary. 44px min touch target. */
const ArticleCard = ({
  meta,
  index,
}: {
  meta: WikiArticleMeta;
  index: WikiSearchIndex | null;
}) => {
  const Icon = WIKI_ICONS[meta.icon];
  const entry = index?.[meta.slug];
  return (
    <Link
      to={`/firma/hilfe/${meta.slug}`}
      className="flex min-h-[44px] items-start gap-3 rounded-xl border border-folk-line bg-folk-card p-3.5 transition-colors hover:bg-folk-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink focus-visible:ring-offset-2"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-folk-bg-warm">
        <Icon className="h-4 w-4 text-folk-ink2" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-folk-ink">{entry?.title ?? meta.slug}</span>
        {entry && <span className="mt-0.5 block text-[14px] leading-snug text-folk-ink3">{entry.summary}</span>}
      </span>
    </Link>
  );
};

export const WikiHome = ({ index }: { index: WikiSearchIndex | null }) => {
  const t = useT();

  const all = visibleArticles();
  const grouped = articlesByCategory();

  // The three promoted blocks overlap by nature: a "start" article can also be a journey
  // and also a daily guide. Showing it three times reads as padding and makes the page
  // look longer than it is, so each guide is promoted exactly once, in the first block
  // that claims it. The full list further down still shows everything.
  const promoted = new Set<string>();
  const claim = (articles: readonly WikiArticleMeta[]): readonly WikiArticleMeta[] => {
    const fresh = articles.filter((meta) => !promoted.has(meta.slug));
    fresh.forEach((meta) => promoted.add(meta.slug));
    return fresh;
  };

  const startArticles = claim(all.filter((meta) => meta.category === "start"));
  const journeys = claim(all.filter((meta) => meta.kind === "journey"));
  const daily = claim(
    DAILY_GUIDES.map((slug) => WIKI_REGISTRY[slug]).filter((meta) =>
      all.some((visible) => visible.slug === meta.slug),
    ),
  );

  return (
    <div className="space-y-8">
      <section aria-label={t("wiki.search.label")} className="max-w-2xl">
        <WikiSearch index={index} />
      </section>

      {/* Start here */}
      {startArticles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2.5">
            <StartIcon className="h-5 w-5 text-folk-coral" strokeWidth={1.8} aria-hidden="true" />
            <h2 className="text-[19px] font-semibold tracking-tight text-folk-ink">
              {t("wiki.home.startHere")}
            </h2>
          </div>
          <p className="text-[15px] text-folk-ink3">{t("wiki.home.startHereHint")}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {startArticles.map((meta) => (
              <ArticleCard key={meta.slug} meta={meta} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* What do you want to do? — the cross-screen journeys */}
      {journeys.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[19px] font-semibold tracking-tight text-folk-ink">
            {t("wiki.home.tasks")}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {journeys.map((meta) => (
              <ArticleCard key={meta.slug} meta={meta} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Everyday guides */}
      {daily.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[19px] font-semibold tracking-tight text-folk-ink">
            {t("wiki.home.daily")}
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {daily.map((meta) => (
              <ArticleCard key={meta.slug} meta={meta} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* All areas */}
      <section className="space-y-3">
        <h2 className="text-[19px] font-semibold tracking-tight text-folk-ink">
          {t("wiki.home.categories")}
        </h2>
        <div className="space-y-4">
          {grouped.map(({ category, articles }) => (
            <div key={category} className="rounded-xl border border-folk-line bg-folk-card p-4">
              <h3 className="text-[16px] font-semibold text-folk-ink">
                {t(`wiki.category.${category}` as MessageKey)}
              </h3>
              <p className="mt-0.5 text-[13px] text-folk-ink3">
                {t("wiki.home.articleCount", { count: articles.length })}
              </p>
              <ul className="mt-3 space-y-1.5">
                {articles.map((meta) => {
                  const Icon = WIKI_ICONS[meta.icon];
                  return (
                    <li key={meta.slug}>
                      <Link
                        to={`/firma/hilfe/${meta.slug}`}
                        className="flex min-h-[36px] items-center gap-2.5 rounded-lg px-2 py-1.5 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm hover:text-folk-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-folk-ink3" strokeWidth={1.8} aria-hidden="true" />
                        <span className="min-w-0 truncate">{index?.[meta.slug]?.title ?? meta.slug}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
