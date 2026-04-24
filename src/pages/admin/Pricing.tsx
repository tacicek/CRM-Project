import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calculator, Loader2, Save, Coins, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface ServiceCatalogItem {
  id: string;
  service_type: string;
  name_de: string;
  category: string;
  base_token_cost: number;
  is_active: boolean;
}


const DEFAULT_SIZE_MULTIPLIERS: Record<string, number> = {
  "1-2": 1.0,
  "3": 1.2,
  "4-5": 1.4,
  "6+": 1.6,
};

const DEFAULT_OFFERTEN_MULTIPLIERS: Record<string, number> = {
  "3": 1.3,
  "4": 1.15,
  "5": 1.0,
};

const SIZE_LABELS: Record<string, string> = {
  "1-2": "1–2 Zimmer",
  "3": "3 Zimmer",
  "4-5": "4–5 Zimmer",
  "6+": "6+ Zimmer",
};

const OFFERTEN_LABELS: Record<string, string> = {
  "3": "3 Firmen",
  "4": "4 Firmen",
  "5": "5 Firmen",
};

const AdminPricing = () => {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [tokenValueChf, setTokenValueChf] = useState(1.0);
  const [minTokens, setMinTokens] = useState(10);
  const [maxTokens, setMaxTokens] = useState(200);
  const [sizeMultipliers, setSizeMultipliers] = useState<Record<string, number>>(DEFAULT_SIZE_MULTIPLIERS);
  const [offertenMultipliers, setOffertenMultipliers] = useState<Record<string, number>>(DEFAULT_OFFERTEN_MULTIPLIERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catalogRes, settingsRes] = await Promise.all([
        supabase.from("service_catalog").select("id, service_type, name_de, category, base_token_cost, is_active")
          .eq("is_active", true).order("sort_order"),
        supabase.from("pricing_settings").select("*").limit(1).maybeSingle(),
      ]);

      if (catalogRes.error) throw catalogRes.error;
      setServices((catalogRes.data as ServiceCatalogItem[]) || []);

      if (settingsRes.data) {
        const s = settingsRes.data;
        setSettingsId(s.id);
        setTokenValueChf(Number(s.token_value_chf) || 1.0);
        setMinTokens(Number(s.min_lead_price_tokens) || 10);
        setMaxTokens(Number(s.max_lead_price_tokens) || 200);
        setSizeMultipliers(s.size_multipliers || DEFAULT_SIZE_MULTIPLIERS);
        setOffertenMultipliers(s.offerten_multipliers || DEFAULT_OFFERTEN_MULTIPLIERS);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Fehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (isSaving) return;
    if (minTokens >= maxTokens) {
      toast({ title: "Ungültig", description: "Min muss kleiner als Max sein.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      // Save pricing_settings
      const settingsPayload = {
        token_value_chf: tokenValueChf,
        min_lead_price_tokens: minTokens,
        max_lead_price_tokens: maxTokens,
        size_multipliers: sizeMultipliers,
        offerten_multipliers: offertenMultipliers,
        updated_at: new Date().toISOString(),
      };
      if (settingsId) {
        const { error } = await supabase.from("pricing_settings").update(settingsPayload).eq("id", settingsId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_settings").insert(settingsPayload);
        if (error) throw error;
      }

      // Save each service's base_token_cost
      for (const svc of services) {
        const { error } = await supabase.from("service_catalog")
          .update({ base_token_cost: svc.base_token_cost })
          .eq("id", svc.id);
        if (error) throw error;
      }

      toast({ title: "Gespeichert", description: "Preiseinstellungen wurden aktualisiert." });
    } catch (error) {
      console.error(error);
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateServiceCost = (id: string, rawValue: string) => {
    const cost = rawValue === "" ? 0 : parseFloat(rawValue);
    if (isNaN(cost)) return;
    setServices(prev => prev.map(s => s.id === id ? { ...s, base_token_cost: cost } : s));
  };

  const updateSizeMult = (key: string, rawValue: string) => {
    const val = rawValue === "" ? 0 : parseFloat(rawValue);
    if (isNaN(val)) return;
    setSizeMultipliers(prev => ({ ...prev, [key]: val }));
  };

  const updateOffertenMult = (key: string, rawValue: string) => {
    const val = rawValue === "" ? 0 : parseFloat(rawValue);
    if (isNaN(val)) return;
    setOffertenMultipliers(prev => ({ ...prev, [key]: val }));
  };

  const examplePrice = (baseCost: number, rooms: number, offerten = 5): number => {
    let sizeMult = 1.0;
    for (const [key, m] of Object.entries(sizeMultipliers)) {
      if (key.includes("+")) { if (rooms >= parseInt(key)) sizeMult = m; }
      else if (key.includes("-")) { const [a, b] = key.split("-").map(Number); if (rooms >= a && rooms <= b) sizeMult = m; }
      else { if (rooms === parseFloat(key)) sizeMult = m; }
    }
    const offMult = offertenMultipliers[String(offerten)] ?? 1.0;
    let price = Math.round(baseCost * sizeMult * offMult);
    price = Math.max(price, minTokens);
    price = Math.min(price, maxTokens);
    return price;
  };

  if (isLoading) {
    return (
      <>
        <Helmet><title>Preisgestaltung | Offerio Admin</title></Helmet>
        <AdminLayout>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        </AdminLayout>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Preisgestaltung | Offerio Admin</title></Helmet>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Preisgestaltung</h2>
              <p className="text-muted-foreground text-sm">
                Token = Basispreis × Größe × Offerten-Faktor
              </p>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Alle speichern
            </Button>
          </div>

          {/* Formel-Erklärung */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">Preisformel</h4>
            <code className="text-sm bg-white dark:bg-slate-900 px-3 py-1.5 rounded inline-block">
              Token = base_token_cost × size_multiplier × offerten_multiplier
            </code>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              Ergebnis wird auf min. <strong>{minTokens}</strong> und max. <strong>{maxTokens}</strong> Token begrenzt.
              Admin kann den Preis pro Lead manuell überschreiben.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Baz Token Fiyatları */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  Basispreise pro Service
                </CardTitle>
                <CardDescription>
                  Grundpreis in Token für jede Serviceart
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 px-2">Service</th>
                        <th className="py-2 px-2 text-center">Basispreis</th>
                        <th className="py-2 px-2 text-center text-gray-400">1–2 Zi</th>
                        <th className="py-2 px-2 text-center text-gray-400">3 Zi</th>
                        <th className="py-2 px-2 text-center text-gray-400">4–5 Zi</th>
                        <th className="py-2 px-2 text-center text-gray-400">6+ Zi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(svc => (
                        <tr key={svc.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            <div className="font-medium">{svc.name_de}</div>
                            <div className="text-xs text-muted-foreground font-mono">{svc.service_type}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              max="500"
                              className="w-20 text-center mx-auto"
                              value={svc.base_token_cost || ""}
                              onChange={e => updateServiceCost(svc.id, e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">
                            {examplePrice(svc.base_token_cost, 1)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">
                            {examplePrice(svc.base_token_cost, 3)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-xs text-amber-600">
                            {examplePrice(svc.base_token_cost, 4)}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-xs text-red-500">
                            {examplePrice(svc.base_token_cost, 6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 2. Size Multipliers + Settings */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="w-5 h-5" />
                    Größen-Multiplikatoren
                  </CardTitle>
                  <CardDescription>
                    Faktor nach Zimmeranzahl (editierbar)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(SIZE_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <Label className="flex-1 text-sm">{label}</Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="5"
                          className="w-20 text-center"
                          value={sizeMultipliers[key] ?? ""}
                          onChange={e => updateSizeMult(key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-green-600" />
                    Offerten-Multiplikatoren
                  </CardTitle>
                  <CardDescription>
                    Weniger Firmen = exklusiver = teurer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(OFFERTEN_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <Label className="flex-1 text-sm">{label}</Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          step="0.05"
                          min="0.5"
                          max="3"
                          className="w-20 text-center"
                          value={offertenMultipliers[key] ?? ""}
                          onChange={e => updateOffertenMult(key, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Min / Max
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Token-Wert (CHF)</Label>
                    <Input type="number" step="0.01" min="0.01"
                      value={tokenValueChf || ""}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTokenValueChf(v); else if (e.target.value === "") setTokenValueChf(0); }}
                      className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">1 Token = {tokenValueChf.toFixed(2)} CHF</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Min Token</Label>
                      <Input type="number" min={1} value={minTokens || ""}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setMinTokens(v); else if (e.target.value === "") setMinTokens(0); }}
                        className="mt-1" />
                    </div>
                    <div>
                      <Label>Max Token</Label>
                      <Input type="number" min={1} value={maxTokens || ""}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) setMaxTokens(v); else if (e.target.value === "") setMaxTokens(0); }}
                        className="mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Preisvorschau — Beispielszenarien
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 px-2">Szenario</th>
                      <th className="py-2 px-2 text-center">3 Firmen</th>
                      <th className="py-2 px-2 text-center">4 Firmen</th>
                      <th className="py-2 px-2 text-center">5 Firmen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Privatumzug 2 Zi", type: "umzug_privat", rooms: 2 },
                      { label: "Privatumzug 4 Zi", type: "umzug_privat", rooms: 4 },
                      { label: "Firmenumzug 4 Zi", type: "umzug_firma", rooms: 4 },
                      { label: "Reinigung 2 Zi", type: "reinigung", rooms: 2 },
                      { label: "Reinigung 5 Zi", type: "reinigung", rooms: 5 },
                      { label: "Räumung 3 Zi", type: "raeumung", rooms: 3 },
                      { label: "Klaviertransport", type: "klaviertransport", rooms: 1 },
                      { label: "Möbellift", type: "moebellift", rooms: 1 },
                      { label: "Lagerung", type: "lagerung", rooms: 1 },
                    ].map(sc => {
                      const svc = services.find(s => s.service_type === sc.type);
                      const base = svc?.base_token_cost || 15;
                      const t3 = examplePrice(base, sc.rooms, 3);
                      const t4 = examplePrice(base, sc.rooms, 4);
                      const t5 = examplePrice(base, sc.rooms, 5);
                      return (
                        <tr key={sc.label} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">
                            <span className="font-medium">{sc.label}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-medium text-amber-600">{t3}</td>
                          <td className="py-2 px-2 text-center font-mono">{t4}</td>
                          <td className="py-2 px-2 text-center font-mono text-muted-foreground">{t5}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </>
  );
};

export default AdminPricing;
