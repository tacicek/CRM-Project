import { useCallback, useMemo, useState } from "react";
import { Languages, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n/useI18n";
import { LOCALE_NAMES, type Locale } from "@/i18n/locale";

/**
 * Übersetzt firmen-eigene Inhalte (Katalogpositionen, AGB-Abschnitte, Checklisten)
 * ins Französische und Englische.
 *
 * Der KI-Vorschlag wird NICHT direkt gespeichert — die Firma sieht Deutsch und
 * Übersetzung nebeneinander, korrigiert und gibt frei. Diese Texte landen auf einer
 * Offerte, die ein Kunde unterschreibt; eine ungeprüfte Maschinenübersetzung gehört
 * dort nicht hin.
 *
 * Gespeichert wird in die `translations` JSONB-Spalte der jeweiligen Tabelle:
 *   {"fr": {"name": "…", "description": "…"}, "en": {…}}
 * Die deutsche Basisspalte bleibt Quelle der Wahrheit und Fallback.
 */

/** Die Sprachen, in die übersetzt wird — Deutsch ist die Quelle, nicht das Ziel. */
const TARGET_LOCALES: Locale[] = ["fr", "en"];

export interface TranslatableField {
  /** Spaltenname in der DB, z. B. "name" oder "content". */
  key: string;
  /** Beschriftung im Dialog. */
  label: string;
  /** Mehrzeilig (AGB-Text) statt einzeilig (Positionsname). */
  multiline?: boolean;
}

export interface TranslatableRecord {
  id: string;
  /** Deutsche Basiswerte, nach Feldname. */
  source: Record<string, string>;
  /** Bereits gespeicherte Übersetzungen. */
  translations: Record<string, Record<string, string>>;
}

interface ContentTranslationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  /** Tabelle, in die zurückgeschrieben wird (muss eine `translations` JSONB-Spalte haben). */
  table: "company_service_items" | "agb_sections" | "checklist_templates";
  records: TranslatableRecord[];
  fields: TranslatableField[];
  /** Fachlicher Kontext für die KI, z. B. "Leistungskatalog einer Umzugsfirma". */
  context: string;
  onSaved: () => void;
}

type Draft = Record<string, Record<string, Record<string, string>>>;

export const ContentTranslationDialog = ({
  open,
  onOpenChange,
  companyId,
  table,
  records,
  fields,
  context,
  onSaved,
}: ContentTranslationDialogProps) => {
  const t = useT();
  const [draft, setDraft] = useState<Draft>({});
  const [translating, setTranslating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bereits gespeicherte Übersetzungen sind der Startwert; der Entwurf überschreibt sie.
  const valueFor = useCallback(
    (recordId: string, locale: Locale, field: string): string => {
      const drafted = draft[recordId]?.[locale]?.[field];
      if (drafted !== undefined) return drafted;
      const record = records.find((r) => r.id === recordId);
      return record?.translations?.[locale]?.[field] ?? "";
    },
    [draft, records]
  );

  const setValue = (recordId: string, locale: Locale, field: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [locale]: { ...prev[recordId]?.[locale], [field]: value },
      },
    }));
  };

  const missingCount = useMemo(
    () =>
      records.reduce((acc, r) => {
        const gaps = TARGET_LOCALES.flatMap((l) =>
          fields.filter((f) => !valueFor(r.id, l, f.key).trim())
        );
        return acc + gaps.length;
      }, 0),
    [records, fields, valueFor]
  );

  const runTranslation = async () => {
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-content", {
        body: {
          company_id: companyId,
          target_locales: TARGET_LOCALES,
          context,
          items: records.map((r) => ({
            id: r.id,
            fields: Object.fromEntries(
              fields.map((f) => [f.key, r.source[f.key] ?? ""])
            ),
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const suggestions = (data?.items ?? []) as Array<{
        id: string;
        translations: Record<string, Record<string, string>>;
      }>;

      // Vorschlag füllt nur LEERE Felder — eine bereits von Hand korrigierte
      // Übersetzung darf die KI nicht überschreiben.
      setDraft((prev) => {
        const next: Draft = { ...prev };
        for (const s of suggestions) {
          for (const locale of TARGET_LOCALES) {
            for (const field of fields) {
              const existing = valueFor(s.id, locale, field.key);
              if (existing.trim()) continue;
              const proposed = s.translations?.[locale]?.[field.key];
              if (!proposed) continue;
              next[s.id] = {
                ...next[s.id],
                [locale]: { ...next[s.id]?.[locale], [field.key]: proposed },
              };
            }
          }
        }
        return next;
      });

      toast.success(t("catalog.translation.suggested"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("catalog.translation.failed"), { description: message });
    } finally {
      setTranslating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const record of records) {
        const merged: Record<string, Record<string, string>> = {
          ...record.translations,
        };
        for (const locale of TARGET_LOCALES) {
          const entry: Record<string, string> = { ...merged[locale] };
          for (const field of fields) {
            const value = valueFor(record.id, locale, field.key).trim();
            // Leere Übersetzung wird nicht gespeichert — dann greift der
            // deutsche Fallback, statt dem Kunden ein leeres Feld zu zeigen.
            if (value) entry[field.key] = value;
            else delete entry[field.key];
          }
          if (Object.keys(entry).length > 0) merged[locale] = entry;
          else delete merged[locale];
        }

        const { error } = await supabase
          .from(table)
          .update({ translations: merged })
          .eq("id", record.id)
          .eq("company_id", companyId);

        if (error) throw error;
      }

      toast.success(t("catalog.translation.saved"));
      setDraft({});
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(t("common.errorGeneric"), { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {t("catalog.translation.title")}
          </DialogTitle>
          <DialogDescription>{t("catalog.translation.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {t("catalog.translation.missing", { count: missingCount })}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={runTranslation}
            disabled={translating || records.length === 0}
          >
            {translating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {t("catalog.translation.suggest")}
          </Button>
        </div>

        <Tabs defaultValue={TARGET_LOCALES[0]}>
          <TabsList>
            {TARGET_LOCALES.map((locale) => (
              <TabsTrigger key={locale} value={locale}>
                {LOCALE_NAMES[locale]}
              </TabsTrigger>
            ))}
          </TabsList>

          {TARGET_LOCALES.map((locale) => (
            <TabsContent key={locale} value={locale} className="space-y-6 pt-4">
              {records.map((record) => (
                <div key={record.id} className="space-y-3 rounded-lg border p-4">
                  {fields.map((field) => (
                    <div key={field.key} className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {field.label} · {LOCALE_NAMES.de}
                        </Label>
                        <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
                          {record.source[field.key] || "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {field.label} · {LOCALE_NAMES[locale]}
                        </Label>
                        <Textarea
                          value={valueFor(record.id, locale, field.key)}
                          onChange={(e) =>
                            setValue(record.id, locale, field.key, e.target.value)
                          }
                          rows={field.multiline ? 6 : 2}
                          placeholder={t("catalog.translation.placeholder")}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
