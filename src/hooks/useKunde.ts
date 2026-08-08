import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import { deuteLadefehler, veralteteAntwort, type Ladefehler } from "@/lib/ladefehler";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Kunde } from "@/hooks/useKunden";

export type DuplikatKandidat =
  Database["public"]["Functions"]["duplicate_candidates"]["Returns"][number];

/**
 * Rueckgabe von `customer_summary` (Stand 20260807100000). Die RPC liefert Json;
 * diese Form beschreibt, was tatsaechlich drinsteht.
 */
export type KundeZusammenfassung = {
  kunde: Kunde;
  anzahl: Record<
    | "anfragen" | "offerten" | "auftraege" | "termine" | "rechnungen" | "quittungen"
    | "emails" | "faelle" | "aufgaben" | "orte" | "adressen",
    number
  >;
  pipeline: Record<"offerten_offen" | "offerten_akzeptiert" | "auftraege_offen", number>;
  /** Was jetzt Aufmerksamkeit braucht — Grundlage des Achtungsstreifens. */
  offen: Record<
    "aufgaben" | "aufgaben_faellig" | "faelle" | "faelle_dringend" | "aenderungswuensche",
    number
  >;
  /**
   * Seit dem Zahlungsbuch (20260729160000) gibt es nur EINEN Umsatztopf:
   * `bezahlt` ist die Summe der Zahlungseingaenge, `davon_quittungen` ein
   * Ausschnitt daraus. `offen` kommt aus rechnungen.open_amount und kennt
   * Teilzahlungen; `ueberfaellig` ist der Teil davon, dessen Frist verstrichen ist.
   */
  finanzen: Record<
    "fakturiert" | "bezahlt" | "offen" | "ueberfaellig" | "davon_quittungen" | "gutschriften",
    number
  >;
  aktivitaet: {
    erster_kontakt: string | null;
    /** NUR Geschehenes. Ein Termin naechste Woche steht unter naechster_termin. */
    letzte_aktion: string | null;
    letzte_aktion_art: string | null;
    naechster_termin: {
      id: string;
      datum: string;
      start: string | null;
      ende: string | null;
      ganztags: boolean | null;
      art: string | null;
      titel: string;
    } | null;
    naechste_aufgabe: {
      id: string;
      titel: string;
      faellig_am: string | null;
      prioritaet: string;
      art: string;
    } | null;
  };
  /** Anknuepfpunkte fuer Schnellaktionen; null heisst: die Aktion gibt es nicht. */
  aktionen: { letzte_anfrage_id: string | null };
  zusammengefuehrt_aus: { id: string; anzeigename: string; am: string }[];
};

/** Warum der Stammsatz nicht dasteht. Vier Faelle, vier Antworten. */
export type KundeZustand = "laedt" | "da" | "nicht_gefunden" | "kein_zugriff" | "fehler";

/**
 * Die Bloecke, mit denen diese Oberflaeche rechnet. `offen` und `aktionen` sind
 * mit 20260807100000 dazugekommen — an ihnen erkennt der Hook eine Datenbank,
 * die die Migration noch nicht hat.
 */
const PFLICHTFELDER_ZUSAMMENFASSUNG = [
  "kunde",
  "anzahl",
  "pipeline",
  "offen",
  "finanzen",
  "aktivitaet",
  "aktionen",
] as const;

/**
 * Eine Kundenkarte: Stammsatz, Kennzahlen und Duplikat-Kandidaten.
 *
 * Die drei Abfragen werden GETRENNT gehalten und melden getrennt Fehler. Vorher
 * hing alles an einem `loading` und einem `nichtGefunden`: scheiterte
 * `customer_summary`, blieb `zusammenfassung` null und die Karte zeigte
 * CHF 0.00 — eine Behauptung ueber das Geld dieses Kunden, die niemand geprueft
 * hatte. Jetzt bleibt der Abschnitt leer und bietet "Erneut versuchen" an,
 * waehrend der Rest der Karte weiterarbeitet.
 */
export const useKunde = (id: string | undefined, companyId: string | undefined) => {
  const { toast } = useToast();
  const t = useT();

  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [zustand, setZustand] = useState<KundeZustand>("laedt");
  const [stammFehler, setStammFehler] = useState<Ladefehler | null>(null);

  const [zusammenfassung, setZusammenfassung] = useState<KundeZusammenfassung | null>(null);
  const [zusammenfassungFehler, setZusammenfassungFehler] = useState<Ladefehler | null>(null);
  const [zusammenfassungLaedt, setZusammenfassungLaedt] = useState(true);

  const [duplikate, setDuplikate] = useState<DuplikatKandidat[]>([]);

  const zusammenfassungLaden = useCallback(async () => {
    if (!id) return;
    setZusammenfassungLaedt(true);
    const { data, error } = await supabase.rpc("customer_summary", { p_customer_id: id });
    if (error) {
      // NICHT auf null/0 fallen. Der Abschnitt bleibt leer und sagt, warum.
      setZusammenfassung(null);
      setZusammenfassungFehler(deuteLadefehler(error));
      setZusammenfassungLaedt(false);
      return;
    }
    // Die Antwort kann alt sein, ohne fehlerhaft zu sein: laeuft die Oberflaeche
    // gegen eine Datenbank ohne 20260807100000, fehlen `offen` und `aktionen`.
    // Ungeprueft durchgereicht las der Achtungsstreifen `offen.faelle` auf
    // undefined und die ganze Seite blieb leer.
    const veraltet = veralteteAntwort(data, PFLICHTFELDER_ZUSAMMENFASSUNG);
    if (veraltet) {
      setZusammenfassung(null);
      setZusammenfassungFehler(veraltet);
      setZusammenfassungLaedt(false);
      return;
    }

    setZusammenfassung((data as unknown as KundeZusammenfassung) ?? null);
    setZusammenfassungFehler(null);
    setZusammenfassungLaedt(false);
  }, [id]);

  const duplikateLaden = useCallback(async () => {
    if (!id || !companyId) return;
    const { data, error } = await supabase.rpc("duplicate_candidates", {
      p_company_id: companyId,
      p_customer_id: id,
    });
    // Duplikat-Kandidaten sind ein Hinweis, keine Auskunft: schlaegt die Abfrage
    // fehl, faellt das Band weg. Ein Fehlerkasten dafuer waere Laerm.
    setDuplikate(error ? [] : ((data ?? []) as DuplikatKandidat[]));
  }, [id, companyId]);

  const laden = useCallback(async () => {
    if (!id || !companyId) return;
    setZustand("laedt");
    setStammFehler(null);

    // BEWUSST OHNE .eq("company_id"): die Mandantentrennung macht RLS. Nur so
    // laesst sich "gibt es nicht" von "gehoert einer anderen Firma" trennen —
    // wer in beiden Firmen Mitglied ist, bekommt die Zeile und sieht am
    // company_id, dass er die falsche Firma offen hat.
    const { data: satz, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      const f = deuteLadefehler(error);
      setStammFehler(f);
      setZustand(f?.art === "kein_zugriff" ? "kein_zugriff" : "fehler");
      return;
    }
    if (!satz) {
      // RLS gibt einem fremden Kunden gegenueber keine Auskunft — deshalb steht
      // hier "nicht gefunden" und nicht "kein Zugriff". Alles andere hiesse,
      // die Existenz fremder Kunden zu bestaetigen.
      setZustand("nicht_gefunden");
      return;
    }
    if (satz.company_id !== companyId) {
      setZustand("kein_zugriff");
      return;
    }

    setKunde(satz);
    setZustand("da");
    void zusammenfassungLaden();
    void duplikateLaden();
  }, [id, companyId, zusammenfassungLaden, duplikateLaden]);

  useEffect(() => {
    laden();
  }, [laden]);

  const speichern = useCallback(
    async (werte: Database["public"]["Tables"]["customers"]["Update"]) => {
      if (!id) return false;
      const { data, error } = await supabase
        .from("customers")
        .update(werte)
        .eq("id", id)
        .select("*")
        .single();

      if (error || !data) {
        const f = deuteLadefehler(error);
        toast({
          title: t("kunde.error.save"),
          description: f?.art === "kein_zugriff" ? t("kunde.error.forbidden") : f?.nachricht,
          variant: "destructive",
        });
        return false;
      }
      setKunde(data);
      toast({ title: t("kunde.saved") });
      // Der Anzeigename kann sich geaendert haben und steht auch in der
      // Zusammenfassung — sonst zeigten Kopfzeile und Zaehlerblock zwei Namen.
      void zusammenfassungLaden();
      return true;
    },
    [id, toast, t, zusammenfassungLaden],
  );

  /**
   * Zusammenfuehren. Die eigentliche Regel — wer darf, was wird umgehaengt, was
   * bleibt stehen — steckt in `merge_customers`; hier wird nur aufgerufen und
   * die Ablehnung in einen lesbaren Satz uebersetzt.
   */
  const zusammenfuehren = useCallback(
    async (quelleId: string, zielId: string, grund: string | null) => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc("merge_customers", {
        p_company_id: companyId,
        p_source_customer_id: quelleId,
        p_target_customer_id: zielId,
        p_reason: grund,
      });
      if (error) {
        toast({
          title: t("common.error"),
          // 23505 kommt aus dem Abbruch bei einem unbekannten
          // Eindeutigkeitskonflikt — die Meldung nennt Tabelle und Spalte und
          // ist damit brauchbarer als jeder eigene Satz.
          description: error.code === "42501" ? t("kunde.merge.forbidden") : error.message,
          variant: "destructive",
        });
        return null;
      }
      toast({ title: t("kunde.merge.done") });
      return data as Json;
    },
    [companyId, toast, t],
  );

  const vorschau = useCallback(
    async (quelleId: string, zielId: string) => {
      if (!companyId) return null;
      const { data, error } = await supabase.rpc("customer_merge_preview", {
        p_company_id: companyId,
        p_source_customer_id: quelleId,
        p_target_customer_id: zielId,
      });
      return error ? null : (data as Json);
    },
    [companyId],
  );

  return {
    kunde,
    zustand,
    stammFehler,
    zusammenfassung,
    zusammenfassungFehler,
    zusammenfassungLaedt,
    duplikate,
    laden,
    zusammenfassungLaden,
    speichern,
    zusammenfuehren,
    vorschau,
  };
};
