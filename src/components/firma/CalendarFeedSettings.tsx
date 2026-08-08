/**
 * "Kalender verbinden" — webcal/ICS-Abo der CRM-Termine (Einstellungen-Tab).
 *
 * Der Klartext eines Tokens existiert genau einmal: im Rueckgabewert von
 * `create_calendar_feed_token()`. Er lebt hier nur im React-State und ist nach
 * dem Verlassen des Tabs weg — die Liste unten zeigt darum bewusst KEINE
 * Abo-Links, nur Metadaten. Wer den Link verliert, widerruft und erzeugt neu.
 *
 * Widerruf ist ein UPDATE auf `revoked_at` (RLS: Firmenmitglieder), kein
 * DELETE — die Zeile bleibt als Beleg, der Feed antwortet sofort mit 404.
 */
import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Copy, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n/useI18n";
import { formatDateTime } from "@/i18n/format";
import {
  buildCalendarFeedUrl,
  CALENDAR_FEED_TYPES,
  CalendarFeedType,
} from "@/lib/calendarFeedUrl";

interface TokenRow {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface FreshToken {
  token: string;
  label: string | null;
}

interface CalendarFeedSettingsProps {
  companyId: string;
}

export const CalendarFeedSettings = ({ companyId }: CalendarFeedSettingsProps) => {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [freshToken, setFreshToken] = useState<FreshToken | null>(null);
  const [revokeCandidate, setRevokeCandidate] = useState<TokenRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const supabaseBase = import.meta.env.VITE_SUPABASE_URL as string | undefined;

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      // RLS grenzt ohnehin auf die eigene Firma ein — der explizite Filter
      // macht die Absicht lesbar und haelt die Query stabil, falls ein Nutzer
      // je mehrere Mitgliedschaften bekommt.
      const { data, error } = await supabase
        .from("calendar_feed_tokens")
        .select("id, label, created_at, last_used_at")
        .eq("company_id", companyId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTokens(data ?? []);
    } catch {
      toast({ title: t("settings.calfeed.loadFailed"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, t, toast]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const trimmed = labelDraft.trim();
      const { data, error } = await supabase.rpc("create_calendar_feed_token", {
        ...(trimmed ? { p_label: trimmed } : {}),
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error("empty rpc result");
      setFreshToken({ token: row.token, label: row.label ?? null });
      setLabelDraft("");
      toast({ title: t("settings.calfeed.created") });
      await loadTokens();
    } catch {
      toast({ title: t("settings.calfeed.createFailed"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: t("settings.calfeed.copied") });
    } catch {
      toast({ title: t("settings.calfeed.copyFailed"), variant: "destructive" });
    }
  };

  const handleRevoke = async () => {
    if (!revokeCandidate) return;
    setIsRevoking(true);
    try {
      const { error } = await supabase
        .from("calendar_feed_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", revokeCandidate.id);
      if (error) throw error;
      toast({ title: t("settings.calfeed.revoked") });
      setRevokeCandidate(null);
      // Der widerrufene Klartext darf nicht kopierbar stehen bleiben.
      setFreshToken(null);
      await loadTokens();
    } catch {
      toast({ title: t("settings.calfeed.revokeFailed"), variant: "destructive" });
    } finally {
      setIsRevoking(false);
    }
  };

  const typLabel = (typ: CalendarFeedType) => t(`settings.calfeed.typ.${typ}`);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            {t("settings.calfeed.title")}
          </CardTitle>
          <CardDescription>{t("settings.calfeed.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("settings.calfeed.securityNotice")}</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.calfeed.createTitle")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder={t("settings.calfeed.labelPlaceholder")}
                maxLength={80}
                className="sm:max-w-sm"
              />
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarPlus className="mr-2 h-4 w-4" />
                )}
                {t("settings.calfeed.createButton")}
              </Button>
            </div>
          </div>

          {freshToken && (
            <div className="space-y-3 rounded-md border border-folk-line bg-folk-bg-warm p-4">
              <p className="text-sm font-medium">
                {t("settings.calfeed.linksTitle")}
                {freshToken.label ? ` — ${freshToken.label}` : ""}
              </p>
              {CALENDAR_FEED_TYPES.map((typ) => {
                const url = buildCalendarFeedUrl(supabaseBase, freshToken.token, typ);
                return (
                  <div key={typ} className="space-y-1">
                    <p className="text-xs font-medium text-folk-ink2">{typLabel(typ)}</p>
                    {url ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-folk-card px-2 py-1.5 text-xs">
                          {url}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopy(url)}
                          aria-label={`${t("settings.calfeed.copy")} ${typLabel(typ)}`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-destructive">
                        {t("settings.calfeed.urlMissing")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("settings.calfeed.tokensTitle")}</p>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-folk-ink3" />
            ) : tokens.length === 0 ? (
              <p className="text-sm text-folk-ink3">{t("settings.calfeed.noTokens")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("settings.calfeed.colLabel")}</TableHead>
                    <TableHead>{t("settings.calfeed.colCreated")}</TableHead>
                    <TableHead>{t("settings.calfeed.colLastUsed")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.label ?? (
                          <span className="text-folk-ink3">
                            {t("settings.calfeed.unnamed")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(row.created_at, locale)}</TableCell>
                      <TableCell>
                        {row.last_used_at
                          ? formatDateTime(row.last_used_at, locale)
                          : t("settings.calfeed.neverUsed")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevokeCandidate(row)}
                        >
                          {t("settings.calfeed.revoke")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={revokeCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeCandidate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.calfeed.revokeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.calfeed.revokeConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>
              {t("settings.calfeed.revokeCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRevoke();
              }}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.calfeed.revokeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
