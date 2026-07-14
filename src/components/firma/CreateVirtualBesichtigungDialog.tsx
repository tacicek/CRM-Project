import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Camera, Copy, Check, ExternalLink, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { documentI18nFor } from "@/i18n/documentLocale";
import { useI18n, useT } from "@/i18n/useI18n";

interface CreateVirtualBesichtigungDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  // Optional pre-fill data
  leadId?: string;
  offerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  fromAddress?: string;
  fromPlz?: string;
  fromCity?: string;
}

export function CreateVirtualBesichtigungDialog({
  open,
  onOpenChange,
  companyId,
  leadId,
  offerId,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  fromAddress = "",
  fromPlz = "",
  fromCity = "",
}: CreateVirtualBesichtigungDialogProps) {
  const t = useT();
  // companyLocale = companies.default_language, i.e. the DOCUMENT-locale fallback for a
  // customer who has no row of their own yet (see resolveDocumentLocale). It deliberately
  // ignores the operator's personal dashboard override — see the mailto draft below.
  const { companyLocale } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [phone, setPhone] = useState(customerPhone);
  const [address, setAddress] = useState(fromAddress);
  const [plz, setPlz] = useState(fromPlz);
  const [city, setCity] = useState(fromCity);
  const [expiresDays, setExpiresDays] = useState(30);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setName(customerName);
      setEmail(customerEmail);
      setPhone(customerPhone);
      setAddress(fromAddress);
      setPlz(fromPlz);
      setCity(fromCity);
      setCreatedUrl(null);
      setCopied(false);
    }
  }, [open, customerName, customerEmail, customerPhone, fromAddress, fromPlz, fromCity]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t("calendar.virtualCreate.error.nameRequired"));
      return;
    }

    setIsLoading(true);

    try {
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      let activeSession = initialSession;
      if (!activeSession?.access_token) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        activeSession = refreshed.session;
      }

      if (!activeSession?.access_token) {
        toast.error(t("calendar.virtualCreate.error.sessionExpired"));
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(
        activeSession.access_token
      );
      if (userError || !userData.user) {
        toast.error(t("calendar.virtualCreate.error.sessionInvalid"));
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-besichtigung-session",
        {
          body: {
            company_id: companyId,
            customer_name: name.trim(),
            customer_email: email.trim() || undefined,
            customer_phone: phone.trim() || undefined,
            lead_id: leadId || undefined,
            offer_id: offerId || undefined,
            from_address: address.trim() || undefined,
            from_plz: plz.trim() || undefined,
            from_city: city.trim() || undefined,
            expires_days: expiresDays,
            app_origin: window.location.origin,
          },
        }
      );

      if (error) throw error;

      setCreatedUrl(data.url);
      toast.success(t("calendar.virtualCreate.toast.created"));
    } catch (error: unknown) {
      console.error("Error creating virtual besichtigung:", error);
      // Extract detailed error from edge function response
      let errorMsg = t("calendar.virtualCreate.error.createFailed");
      if (error && typeof error === "object" && "context" in error) {
        try {
          const ctx = (error as { context: { json: () => Promise<{ error?: string; details?: string }> } }).context;
          const body = await ctx.json();
          console.error("Edge function error details:", body);
          errorMsg = body?.details || body?.error || errorMsg;
        } catch {
          // ignore parse errors
        }
      }
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdUrl) return;

    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      toast.success(t("calendar.virtualCreate.toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("calendar.virtualCreate.toast.copyFailed"));
    }
  };

  const handleSendEmail = () => {
    if (!createdUrl || !email) return;

    // CUSTOMER-facing draft → DOCUMENT locale, not the dashboard locale. The customer has no
    // row (and therefore no `language`) at this point — the dialog creates the very first
    // record for them — so the company default applies, exactly as resolveDocumentLocale()
    // does for a row without a language. Reading useT() here would leak a French operator's
    // personal UI override into a German customer's mail.
    const { t: tDoc } = documentI18nFor(companyLocale);

    const subject = encodeURIComponent(tDoc("calendar.virtualCreate.mail.subject"));
    const body = encodeURIComponent(
      tDoc("calendar.virtualCreate.mail.body", {
        name,
        url: createdUrl,
        validity: tDoc("calendar.virtualCreate.validityHint", { count: expiresDays }),
      })
    );

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {t("calendar.virtualCreate.title")}
          </DialogTitle>
          <DialogDescription>
            {t("calendar.virtualCreate.description")}
          </DialogDescription>
          <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <span className="shrink-0 mt-0.5">⏰</span>
            <span>
              <strong>{t("calendar.virtualCreate.privacyTitle")}</strong>{" "}
              {t("calendar.virtualCreate.privacyBody")}
            </span>
          </div>
        </DialogHeader>

        {!createdUrl ? (
          // Creation form
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("calendar.virtualCreate.customerName")} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Max Muster"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">{t("common.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@example.ch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("common.phone")}</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+41 79 123 45 67"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("calendar.virtualCreate.addressLabel")}</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Musterstrasse 123"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="plz">{t("common.plz")}</Label>
                <Input
                  id="plz"
                  value={plz}
                  onChange={(e) => setPlz(e.target.value)}
                  placeholder="8000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("common.city")}</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Zürich"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">{t("calendar.virtualCreate.validFor")}</Label>
              <select
                id="expires"
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {[7, 14, 30, 60].map((days) => (
                  <option key={days} value={days}>
                    {t("calendar.virtualCreate.days", { count: days })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          // Success view with link
          <div className="py-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">
                {t("calendar.virtualCreate.created")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("calendar.virtualCreate.linkLabel")}</Label>
              <div className="flex gap-2">
                <Input
                  value={createdUrl}
                  readOnly
                  className="text-sm font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(createdUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t("calendar.virtualCreate.open")}
              </Button>
              {email && (
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleSendEmail}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {t("calendar.virtualCreate.sendEmail")}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {t("calendar.virtualCreate.hint")}
              <br />
              {t("calendar.virtualCreate.validityHint", { count: expiresDays })}
            </p>
          </div>
        )}

        <DialogFooter>
          {!createdUrl ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("calendar.virtualCreate.creating")}
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    {t("calendar.virtualCreate.create")}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>{t("common.close")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
