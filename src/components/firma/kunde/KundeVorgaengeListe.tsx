import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight, Loader2 } from "lucide-react";
import { useI18n, useT } from "@/i18n/useI18n";
import { formatCurrency } from "@/i18n/format";
import { AbschnittFehler } from "@/components/firma/kunde/AbschnittFehler";
import type { KundeVorgaenge } from "@/hooks/useKundeVorgaenge";
import type { Ladefehler } from "@/lib/ladefehler";
import type { MessageKey } from "@/i18n/translator";

type Zeile = {
  id: string;
  titel: string;
  unter?: string | null;
  status?: string | null;
  betrag?: number | null;
  /** Ohne Ziel wird die Zeile NICHT klickbar dargestellt. */
  ziel?: string;
};

const Block = ({
  titelKey,
  zeilen,
  anzahl,
}: {
  titelKey: MessageKey;
  zeilen: Zeile[];
  anzahl: number;
}) => {
  const navigate = useNavigate();
  const t = useT();
  const { locale } = useI18n();

  return (
    <section className="rounded-xl border border-folk-line bg-folk-card p-4">
      <h2 className="mb-2.5 flex items-baseline gap-2 text-[15px] font-semibold text-folk-ink">
        {t(titelKey)}
        <span className="font-mono text-[13px] font-normal text-folk-ink2">{anzahl}</span>
      </h2>

      {zeilen.length === 0 ? (
        <p className="py-3 text-[13.5px] text-folk-ink2">{t("kunde.docs.none")}</p>
      ) : (
        <ul className="space-y-1.5">
          {zeilen.map((z) => {
            const inhalt = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[14px] font-medium text-folk-ink">
                    {z.titel}
                  </span>
                  {z.unter && (
                    <span className="block text-[12.5px] text-folk-ink2">{z.unter}</span>
                  )}
                </span>
                {z.status && (
                  <span className="shrink-0 rounded bg-folk-bg-warm px-1.5 py-0.5 text-[11px] font-medium text-folk-ink2">
                    {z.status}
                  </span>
                )}
                {z.betrag !== null && z.betrag !== undefined && (
                  <span className="shrink-0 font-mono text-[13px] text-folk-ink2">
                    {formatCurrency(Number(z.betrag), locale)}
                  </span>
                )}
                {z.ziel && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-folk-ink3" aria-hidden />
                )}
              </>
            );

            return (
              <li key={z.id}>
                {z.ziel ? (
                  <button
                    type="button"
                    onClick={() => navigate(z.ziel!)}
                    className="flex w-full items-center gap-2 rounded-lg border border-folk-line p-2.5 text-left transition-colors hover:bg-folk-bg-warm"
                  >
                    {inhalt}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-folk-line p-2.5">
                    {inhalt}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

/**
 * Die Vorgaenge des Kunden nach Art — nicht nach Zeit.
 *
 * Der Verlauf beantwortet "was ist passiert". Hier steht "was gibt es": alle
 * Offerten beieinander, alle Auftraege, alle Belege. Die Zaehlerkacheln von
 * frueher nannten nur eine Zahl und fuehrten nirgendwohin; jede Zeile hier
 * fuehrt dorthin, wo es weitergeht — sofern es diesen Ort gibt.
 *
 * Auftraege und Termine haben KEINE Detailroute (App.tsx). Sie stehen deshalb
 * ohne Zeiger da, statt einen Klick anzubieten, der nichts tut.
 */
export const KundeVorgaengeListe = ({
  vorgaenge,
  laedt,
  fehler,
  neuLaden,
  arten = ["offerten", "auftraege", "rechnungen", "quittungen", "termine"],
}: {
  vorgaenge: KundeVorgaenge;
  laedt: boolean;
  fehler: Ladefehler | null;
  neuLaden: () => void;
  /** Welche Bloecke gezeigt werden. Der Finanzreiter braucht nur zwei davon. */
  arten?: (keyof KundeVorgaenge)[];
}) => {
  const t = useT();
  const { dateLocale } = useI18n();

  if (fehler) {
    return (
      <AbschnittFehler
        titelKey="kunde.error.documents"
        fehler={fehler}
        laedt={laedt}
        onRetry={neuLaden}
      />
    );
  }

  if (laedt) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-folk-coral" aria-hidden />
      </div>
    );
  }

  const datum = (iso: string | null) =>
    iso ? format(new Date(iso), "dd. MMM yyyy", { locale: dateLocale }) : null;

  const zeigt = (art: keyof KundeVorgaenge) => arten.includes(art);
  const leer = arten.every((a) => vorgaenge[a].length === 0);

  if (leer) {
    return (
      <section className="rounded-xl border border-folk-line bg-folk-card p-8 text-center">
        <p className="text-[14px] font-medium text-folk-ink">{t("kunde.empty.noDocuments")}</p>
      </section>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {zeigt("offerten") && (
      <Block
        titelKey="kunde.docs.offers"
        anzahl={vorgaenge.offerten.length}
        zeilen={vorgaenge.offerten.map((o) => ({
          id: o.id,
          titel: o.title || t("kunde.docs.offers"),
          unter: datum(o.created_at),
          status: o.status,
          betrag: o.total,
          ziel: `/firma/offerten/${o.id}`,
        }))}
      />
      )}

      {zeigt("auftraege") && (
      <Block
        titelKey="kunde.docs.auftraege"
        anzahl={vorgaenge.auftraege.length}
        zeilen={vorgaenge.auftraege.map((a) => ({
          id: a.id,
          titel: a.title || a.auftrag_nummer || t("kunde.docs.auftraege"),
          unter: [a.auftrag_nummer, datum(a.scheduled_date)].filter(Boolean).join(" · ") || null,
          status: a.status,
          betrag: a.total,
        }))}
      />
      )}

      {zeigt("rechnungen") && (
      <Block
        titelKey="kunde.docs.invoices"
        anzahl={vorgaenge.rechnungen.length}
        zeilen={vorgaenge.rechnungen.map((r) => ({
          id: r.id,
          titel: r.rechnung_nr || t("kunde.docs.invoices"),
          unter: datum(r.datum),
          status: r.status,
          // Der OFFENE Betrag ist hier die brauchbare Zahl: das Total steht auf
          // der Rechnung selbst, offen ist, was noch kommt.
          betrag: Number(r.open_amount) > 0 ? r.open_amount : r.gesamttotal,
          ziel: `/firma/rechnungen/${r.id}`,
        }))}
      />
      )}

      {zeigt("quittungen") && (
      <Block
        titelKey="kunde.docs.receipts"
        anzahl={vorgaenge.quittungen.length}
        zeilen={vorgaenge.quittungen.map((q) => ({
          id: q.id,
          titel: q.quittung_nr || t("kunde.docs.receipts"),
          unter: datum(q.datum),
          betrag: q.gesamttotal,
          ziel: `/firma/quittungen/${q.id}`,
        }))}
      />
      )}

      {zeigt("termine") && (
      <Block
        titelKey="kunde.docs.appointments"
        anzahl={vorgaenge.termine.length}
        zeilen={vorgaenge.termine.map((tm) => ({
          id: tm.id,
          titel: tm.title || t("kunde.docs.appointments"),
          unter: [datum(tm.appointment_date), tm.start_time?.slice(0, 5)]
            .filter(Boolean)
            .join(" · "),
          status: tm.status,
        }))}
      />
      )}
    </div>
  );
};
