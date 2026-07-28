import { ArrowRight, Bot, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatDateTime } from "@/i18n/format";
import type { MessageKey } from "@/i18n/translator";
import type { ActivityEvent } from "@/types/uebersicht";

/** Gewonnen und verloren bekommen Farbe, der Rest bleibt neutral. */
const DOT: Record<string, string> = {
  won: "bg-folk-mint",
  lost: "bg-folk-coral",
  offer_sent: "bg-folk-sky",
};

/**
 * Der Verlauf der Verkaufsstufen.
 *
 * Quelle ist `sales_stage_history`. Sie ist die einzige unternehmensweite,
 * nur anhängende Ereignistabelle — `offers.sent_at` kennt nur den letzten
 * Versand und taugt für einen Verlauf nicht.
 *
 * `source = 'trigger'` wird sichtbar gemacht: sonst liest sich eine vom System
 * gesetzte Stufe wie die Arbeit einer Kollegin, und die Frage „hat das jemand
 * angefasst?" lässt sich nicht beantworten.
 */
export const ActivityPanel = ({ events }: { events: readonly ActivityEvent[] }) => {
  const t = useT();
  const { locale } = useI18n();

  if (events.length === 0) return null;

  return (
    <section className="rounded-xl border border-folk-line bg-folk-card">
      <div className="border-b border-folk-line px-5 py-3.5">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-folk-ink">
          {t("uebersicht.aktivitaet.title")}
        </h2>
      </div>

      <ul className="px-5 py-1">
        {events.map((event) => (
          <li key={event.id} className="border-b border-folk-line-soft py-2.5 last:border-b-0">
            {/* Zwei Zeilen, nicht eine: in der schmalen rechten Leiste blieb von
                "Neu → Offerte versendet" nur "Neu → Off…" uebrig. Oben steht,
                WAS erreicht wurde, darunter woher und wann. */}
            <Link
              to={`/firma/anfragen?lead=${event.leadId}`}
              className="flex items-start gap-2.5 text-[12.5px]"
            >
              <span
                className={`mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full ${DOT[event.toStage] ?? "bg-folk-ink4"}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-folk-ink">
                  {t(`stage.${event.toStage}` as MessageKey)}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-folk-ink4">
                  {event.fromStage !== null && (
                    <>
                      <span className="truncate">
                        {t(`stage.${event.fromStage}` as MessageKey)}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </>
                  )}
                  <span className="shrink-0 font-mono">{formatDateTime(event.at, locale)}</span>
                  {event.automatisch ? (
                    <Bot
                      className="h-3 w-3 shrink-0"
                      aria-label={t("uebersicht.aktivitaet.automatisch")}
                    />
                  ) : (
                    <User
                      className="h-3 w-3 shrink-0"
                      aria-label={t("uebersicht.aktivitaet.vonHand")}
                    />
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
