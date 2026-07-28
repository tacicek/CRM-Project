/**
 * The help search box and its result list.
 *
 * Implemented as the ARIA combobox pattern rather than a plain input, because the
 * result list is interactive: arrow keys move a highlight, Enter opens, Escape closes.
 * The keyboard maths lives in `wikiSearchKeyboard.ts` so it can be unit-tested; this
 * component only wires it to events and ARIA attributes.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WIKI_ICONS } from "@/features/wiki/wikiIcons";
import { visibleArticles, WIKI_REGISTRY } from "@/features/wiki/wikiRegistry";
import { searchWiki } from "@/features/wiki/wikiSearch";
import {
  clampActiveIndex,
  nextActiveIndex,
  NO_ACTIVE_INDEX,
  type WikiSearchKey,
} from "@/features/wiki/wikiSearchKeyboard";
import type { WikiSearchIndex } from "@/features/wiki/wikiTypes";
import { useT } from "@/i18n/useI18n";
import type { MessageKey } from "@/i18n/translator";
import { cn } from "@/lib/utils";

const SearchIcon = WIKI_ICONS.search;
const ClearIcon = WIKI_ICONS.danger;

const ARROW_KEYS: ReadonlySet<string> = new Set(["ArrowDown", "ArrowUp", "Home", "End"]);

export const WikiSearch = ({ index }: { index: WikiSearchIndex | null }) => {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(NO_ACTIVE_INDEX);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const allowed = useMemo(() => visibleArticles().map((a) => a.slug), []);

  const results = useMemo(() => {
    if (!index || query.trim() === "") return [];
    return searchWiki(query, index, allowed);
  }, [query, index, allowed]);

  // A shrinking result list must not leave the highlight pointing past the end.
  useEffect(() => {
    setActiveIndex((current) => clampActiveIndex(current, results.length));
  }, [results.length]);

  const open = results.length > 0;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (ARROW_KEYS.has(event.key)) {
      event.preventDefault();
      setActiveIndex((current) => nextActiveIndex(current, event.key as WikiSearchKey, results.length));
      return;
    }
    if (event.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        event.preventDefault();
        navigate(`/firma/hilfe/${target.slug}`);
      }
      return;
    }
    if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      setQuery("");
      setActiveIndex(NO_ACTIVE_INDEX);
    }
  };

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative">
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        {t("wiki.search.label")}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-folk-line bg-folk-card px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-folk-ink">
        <SearchIcon className="h-4.5 w-4.5 shrink-0 text-folk-ink3" strokeWidth={1.8} aria-hidden="true" />
        <input
          id={`${listboxId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("wiki.search.placeholder")}
          // Placeholder in ink3, not ink4: placeholder text is real text for contrast
          // purposes, and ink4 on white measures 2.51:1 — well under AA.
          className="min-w-0 flex-1 bg-transparent text-[15px] text-folk-ink outline-none placeholder:text-folk-ink3"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveIndex(NO_ACTIVE_INDEX);
              inputRef.current?.focus();
            }}
            aria-label={t("wiki.search.clear")}
            title={t("wiki.search.clear")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-folk-ink3 hover:bg-folk-bg-warm hover:text-folk-ink"
          >
            <ClearIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Announced to screen readers without stealing focus from the input. */}
      <p aria-live="polite" className="sr-only">
        {query.trim() === "" ? "" : t("wiki.search.results", { count: results.length })}
      </p>

      {query.trim() !== "" && results.length === 0 && index && (
        <div className="mt-2 rounded-xl border border-folk-line bg-folk-card p-4">
          <p className="text-[15px] font-medium text-folk-ink">{t("wiki.search.noResults")}</p>
          <p className="mt-1 text-[14px] text-folk-ink3">{t("wiki.search.noResultsHint")}</p>
        </div>
      )}

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t("wiki.search.label")}
          className="absolute z-30 mt-2 max-h-[60vh] w-full overflow-y-auto rounded-xl border border-folk-line bg-folk-card p-1 shadow-lg"
        >
          {results.map((result, position) => {
            const meta = WIKI_REGISTRY[result.slug];
            const CategoryIcon = WIKI_ICONS[meta.icon];
            const isActive = position === activeIndex;
            return (
              <li key={result.slug} role="none">
                <button
                  id={`${listboxId}-option-${position}`}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onMouseEnter={() => setActiveIndex(position)}
                  onClick={() => navigate(`/firma/hilfe/${result.slug}`)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isActive ? "bg-folk-bg-warm" : "hover:bg-folk-bg-warm",
                  )}
                >
                  <CategoryIcon
                    className="mt-0.5 h-4 w-4 shrink-0 text-folk-ink3"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-folk-ink">
                      {index?.[result.slug].title}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-folk-ink3">
                      {t(`wiki.category.${meta.category}` as MessageKey)}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[14px] text-folk-ink2">
                      {result.excerpt}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
