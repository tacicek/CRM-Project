/**
 * One help article.
 *
 * Heading levels are fixed and never skip: the article title is the only `<h1>`, the
 * ten fixed sections are `<h2>`, and inline headings inside the step blocks are
 * `<h3>`. That is what lets a screen-reader user jump through the document by heading
 * and end up with an outline that matches what a sighted reader sees.
 */
import { Link } from "react-router-dom";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import { prevNextFor, WIKI_REGISTRY } from "@/features/wiki/wikiRegistry";
import { WikiCallout } from "@/features/wiki/components/WikiCallout";
import { WikiFigure } from "@/features/wiki/components/WikiFigure";
import type {
  WikiArticleBody,
  WikiArticleMeta,
  WikiBlock,
  WikiSearchIndex,
} from "@/features/wiki/wikiTypes";
import { formatDate } from "@/i18n/format";
import { useI18n, useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";

const PrintIcon = WIKI_ICONS.print;
const OpenIcon = WIKI_ICONS.guide;

/** Section wrapper — one <h2> per fixed section, so the outline is predictable. */
const Section = ({
  titleKey,
  children,
}: {
  titleKey: MessageKey;
  children: React.ReactNode;
}) => {
  const t = useT();
  return (
    <section className="space-y-2.5">
      <h2 className="text-[19px] font-semibold tracking-tight text-folk-ink">{t(titleKey)}</h2>
      {children}
    </section>
  );
};

const Bullets = ({ items }: { items: readonly string[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-folk-ink2">
        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-folk-ink4" aria-hidden="true" />
        <span className="min-w-0">{item}</span>
      </li>
    ))}
  </ul>
);

const BlockView = ({ block, isFirstFigure }: { block: WikiBlock; isFirstFigure: boolean }) => {
  const t = useT();

  switch (block.kind) {
    case "paragraph":
      return <p className="text-[15px] leading-relaxed text-folk-ink2">{block.text}</p>;

    case "heading":
      return (
        <h3 id={block.id} className="scroll-mt-20 pt-1 text-[16px] font-semibold text-folk-ink">
          {block.text}
        </h3>
      );

    case "list":
      return block.ordered ? (
        <ol className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-folk-ink2">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-folk-bg-warm font-mono text-[11px] font-semibold text-folk-ink2">
                {i + 1}
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Bullets items={block.items} />
      );

    case "steps":
      return (
        <ol className="space-y-2.5">
          {block.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-folk-ink font-mono text-[12px] font-bold text-folk-bg">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[15px] leading-relaxed text-folk-ink">{step.text}</p>
                {step.note && <p className="text-[14px] leading-relaxed text-folk-ink3">{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      );

    case "figure":
      return <WikiFigure figure={block} priority={isFirstFigure} />;

    case "callout":
      return <WikiCallout tone={block.tone} title={block.title} text={block.text} />;

    case "statusTable":
      return (
        <div className="overflow-x-auto rounded-xl border border-folk-line">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">{t("wiki.status.title")}</caption>
            <thead>
              <tr className="border-b border-folk-line bg-folk-bg-warm">
                {/* ink2, not ink3: at 13px on the warm background ink3 measures 4.32:1,
                    below the 4.5:1 that WCAG AA requires for normal-size text. */}
                <th scope="col" className="px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-folk-ink2">
                  {block.headers.status}
                </th>
                {/* ink2, not ink3: at 13px on the warm background ink3 measures 4.32:1,
                    below the 4.5:1 that WCAG AA requires for normal-size text. */}
                <th scope="col" className="px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-folk-ink2">
                  {block.headers.meaning}
                </th>
                {/* ink2, not ink3: at 13px on the warm background ink3 measures 4.32:1,
                    below the 4.5:1 that WCAG AA requires for normal-size text. */}
                <th scope="col" className="px-3.5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-folk-ink2">
                  {block.headers.next}
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.status} className="border-b border-folk-line last:border-0">
                  <th scope="row" className="px-3.5 py-2.5 align-top text-[14px] font-semibold text-folk-ink">
                    {row.status}
                  </th>
                  <td className="px-3.5 py-2.5 align-top text-[14px] text-folk-ink2">{row.meaning}</td>
                  <td className="px-3.5 py-2.5 align-top text-[14px] text-folk-ink2">{row.next ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
};

export const WikiArticleView = ({
  meta,
  body,
  /** Localized titles for the prerequisite and related links. */
  index,
}: {
  meta: WikiArticleMeta;
  body: WikiArticleBody;
  index: WikiSearchIndex | null;
}) => {
  const t = useT();
  const { locale } = useI18n();
  const Icon = WIKI_ICONS[meta.icon];
  const { prev, next } = prevNextFor(meta.slug);

  const headings = body.blocks.filter((b): b is Extract<WikiBlock, { kind: "heading" }> => b.kind === "heading");
  const firstFigureIndex = body.blocks.findIndex((b) => b.kind === "figure");
  /** The screen this article documents, when it is a plain (non-parameterised) route. */
  const openableRoute = meta.routes.find((route) => !route.includes(":") && route.startsWith("/firma"));

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {/* Breadcrumbs */}
      <nav aria-label={t("wiki.nav.breadcrumb")} className="print:hidden">
        {/*
          `min-w-0` + `break-words` on the items: at 320px a long category name would
          otherwise push the row wider than the viewport and make the whole page scroll
          sideways. The links carry `py-1` so they clear the 24px minimum target size.
        */}
        <ol className="flex flex-wrap items-center gap-x-1.5 text-[14px] text-folk-ink3">
          <li className="min-w-0">
            <Link
              to="/firma/hilfe"
              className="inline-block rounded py-1 hover:text-folk-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
            >
              {t("wiki.nav.breadcrumbHome")}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="min-w-0 break-words py-1">{t(`wiki.category.${meta.category}` as MessageKey)}</li>
        </ol>
      </nav>

      <header className="space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-folk-bg-warm">
            <Icon className="h-5 w-5 text-folk-ink2" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-folk-ink">
              {body.title}
            </h1>
            <p className="mt-1 text-[15px] text-folk-ink3">{body.summary}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {openableRoute && (
            <Link
              to={openableRoute}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-folk-bg hover:bg-folk-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink focus-visible:ring-offset-2"
            >
              <OpenIcon className="h-4 w-4" aria-hidden="true" />
              {t("wiki.nav.openScreen")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink focus-visible:ring-offset-2"
          >
            <PrintIcon className="h-4 w-4" aria-hidden="true" />
            {t("wiki.nav.print")}
          </button>
        </div>
      </header>

      {/* Table of contents — only worth showing when there is something to jump to. */}
      {headings.length > 1 && (
        <nav aria-label={t("wiki.section.contents")} className="rounded-xl border border-folk-line bg-folk-card p-4 print:hidden">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">
            {t("wiki.section.contents")}
          </h2>
          {/* py-1 keeps each entry at or above the 24px minimum target size (WCAG 2.5.8). */}
          <ol className="space-y-0.5">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className="inline-block rounded py-1 text-[15px] leading-6 text-folk-ink2 hover:text-folk-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <Section titleKey="wiki.section.purpose">
        <p className="text-[15px] leading-relaxed text-folk-ink2">{body.purpose}</p>
      </Section>

      <Section titleKey="wiki.section.whenToUse">
        <Bullets items={body.whenToUse} />
      </Section>

      {meta.prerequisites && meta.prerequisites.length > 0 && (
        <Section titleKey="wiki.section.beforeYouBegin">
          <ul className="space-y-1.5">
            {meta.prerequisites.map((slug) => (
              <li key={slug}>
                <Link
                  to={`/firma/hilfe/${slug}`}
                  className="inline-block rounded py-1 text-[15px] leading-6 text-folk-ink2 underline decoration-folk-line underline-offset-4 hover:text-folk-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
                >
                  {index?.[slug]?.title ?? slug}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* The body: steps, figures, callouts and status tables, in authored order. */}
      <div className="space-y-4">
        {body.blocks.map((block, i) => (
          <BlockView key={i} block={block} isFirstFigure={i === firstFigureIndex} />
        ))}
      </div>

      <Section titleKey="wiki.section.whatHappensNext">
        <Bullets items={body.whatHappensNext} />
      </Section>

      <Section titleKey="wiki.section.commonMistakes">
        <Bullets items={body.commonMistakes} />
      </Section>

      <Section titleKey="wiki.section.ifSomethingGoesWrong">
        <Bullets items={body.ifSomethingGoesWrong} />
      </Section>

      {meta.related && meta.related.length > 0 && (
        <Section titleKey="wiki.section.related">
          <ul className="grid gap-2 sm:grid-cols-2">
            {meta.related.map((slug) => {
              const relatedMeta = WIKI_REGISTRY[slug];
              const RelatedIcon = WIKI_ICONS[relatedMeta.icon];
              return (
                // `min-w-0` on BOTH the grid item and the flex container: grid and flex
                // children default to min-width:auto, so without it the child refuses to
                // shrink below its text and `truncate` never engages — which pushed the
                // whole page sideways at 320px.
                <li key={slug} className="min-w-0">
                  <Link
                    to={`/firma/hilfe/${slug}`}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-folk-line bg-folk-card p-3 text-[15px] text-folk-ink2 transition-colors hover:bg-folk-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
                  >
                    <RelatedIcon className="h-4 w-4 shrink-0 text-folk-ink3" strokeWidth={1.8} aria-hidden="true" />
                    <span className="min-w-0 truncate">{index?.[slug]?.title ?? slug}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Previous / next within the category */}
      <nav aria-label={t("wiki.nav.next")} className="flex flex-wrap gap-2 border-t border-folk-line pt-4 print:hidden">
        {prev && (
          <Link
            to={`/firma/hilfe/${prev.slug}`}
            className="inline-flex h-9 items-center rounded-lg border border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
          >
            ← {t("wiki.nav.previous")}
          </Link>
        )}
        {next && (
          <Link
            to={`/firma/hilfe/${next.slug}`}
            className="ml-auto inline-flex h-9 items-center rounded-lg border border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-folk-ink"
          >
            {t("wiki.nav.next")} →
          </Link>
        )}
      </nav>

      {/* ink3, not ink4: ink4 on white is 2.51:1 and fails AA even as secondary text. */}
      <p className="text-[13px] text-folk-ink3">
        {t("wiki.meta.lastVerified", { date: formatDate(meta.lastVerified, locale) })}
      </p>
    </article>
  );
};
