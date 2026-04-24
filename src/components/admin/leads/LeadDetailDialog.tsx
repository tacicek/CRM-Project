import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  User, Package, MapPin, Calendar, Phone, Mail, Check, X, Loader2,
  AlertTriangle, Ban, Building2, Zap, Coins, Save, Pencil,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getServiceLabel } from "@/lib/serviceLabels";
import type { Lead, LeadDistribution } from "./types";
import { isPendingStatus, formatDate } from "./utils";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/lib/adminPermissions";
import { SpamRiskBadge, StatusBadge, VerificationTypeBadge } from "./LeadBadges";
import { LeadFormDataRenderer } from "./LeadFormDataRenderer";
import { ManualDistributionDialog } from "./ManualDistributionDialog";

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  setLead: (lead: Lead | null) => void;
  distributions: LeadDistribution[];
  adminNotes: string;
  setAdminNotes: (notes: string) => void;
  isProcessing: boolean;
  onVerify: (lead: Lead) => void;
  onOpenReject: () => void;
  onAddIpToBlacklist: (lead: Lead) => void;
  onManualDistributionSuccess?: () => void;
}

export function LeadDetailDialog({
  open,
  onOpenChange,
  lead,
  setLead,
  distributions,
  adminNotes,
  setAdminNotes,
  isProcessing,
  onVerify,
  onOpenReject,
  onAddIpToBlacklist,
  onManualDistributionSuccess,
}: LeadDetailDialogProps) {
  const { adminRole } = useAuth();
  const canEdit = hasPermission(adminRole, "leads.manage");

  const [editTokenCost, setEditTokenCost] = useState<number | null>(null);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isRedistributing, setIsRedistributing] = useState(false);
  const [isManualDistributionOpen, setIsManualDistributionOpen] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    customer_phone: "",
    description: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  if (!lead) return null;

  const startEdit = () => {
    setEditData({
      customer_first_name: lead.customer_first_name ?? "",
      customer_last_name: lead.customer_last_name ?? "",
      customer_email: lead.customer_email ?? "",
      customer_phone: lead.customer_phone ?? "",
      description: lead.description ?? "",
    });
    setIsEditMode(true);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
  };

  const handleSaveLead = async () => {
    setIsSavingEdit(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          customer_first_name: editData.customer_first_name,
          customer_last_name: editData.customer_last_name,
          customer_email: editData.customer_email,
          customer_phone: editData.customer_phone,
          description: editData.description || null,
        })
        .eq("id", lead.id);
      if (error) throw error;
      setLead({
        ...lead,
        customer_first_name: editData.customer_first_name,
        customer_last_name: editData.customer_last_name,
        customer_email: editData.customer_email,
        customer_phone: editData.customer_phone,
        description: editData.description || null,
      });
      setIsEditMode(false);
      toast.success("Anfrage erfolgreich aktualisiert");
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Speichern der Änderungen");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const isPending = isPendingStatus(lead.status);
  const hasNoAcceptedDistribution =
    distributions.length === 0 || distributions.every((d) => d.status !== "accepted");
  const canManuallyDistribute =
    lead.status === "no_matches" ||
    lead.status === "unknown_plz" ||
    (lead.status === "distributed" && hasNoAcceptedDistribution) ||
    (lead.status === "verified" && distributions.length === 0);

  const isEditingToken = editTokenCost !== null;
  const currentTokenCost = lead.token_cost || 10;

  const handleSaveTokenCost = async () => {
    if (editTokenCost === null || editTokenCost === currentTokenCost) {
      setEditTokenCost(null);
      return;
    }
    setIsSavingToken(true);
    try {
      // 1. Update leads table
      const { error: leadErr } = await supabase
        .from("leads")
        .update({ token_cost: editTokenCost, token_cost_overridden: true })
        .eq("id", lead.id);
      if (leadErr) throw leadErr;

      // 2. Sync all distributions for this lead (sent + accepted)
      const { data: updatedDists, error: distErr } = await supabase
        .from("lead_distributions")
        .update({ token_cost: editTokenCost })
        .eq("lead_id", lead.id)
        .select("id");

      if (distErr) throw distErr;

      const count = updatedDists?.length ?? 0;
      setLead({ ...lead, token_cost: editTokenCost });
      setEditTokenCost(null);

      if (count > 0) {
        toast.success(`Token-Kosten auf ${editTokenCost} geändert (${count} Verteilung${count === 1 ? "" : "en"} aktualisiert)`);
      } else {
        toast.success(`Token-Kosten auf ${editTokenCost} geändert (noch keine Verteilungen)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler beim Speichern der Token-Kosten");
    } finally {
      setIsSavingToken(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Lead Details - {lead.slug || lead.id.substring(0, 8)}
            </DialogTitle>
            {canEdit && !isEditMode && (
              <Button size="sm" variant="outline" onClick={startEdit} className="shrink-0">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Bearbeiten
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Edit mode info bar */}
          {isEditMode && (
            <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950/30 dark:border-orange-800">
              <span className="text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" />
                Bearbeitungsmodus aktiv
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSavingEdit}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Abbrechen
                </Button>
                <Button size="sm" onClick={handleSaveLead} disabled={isSavingEdit} className="bg-green-600 hover:bg-green-700 text-white">
                  {isSavingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1" />
                  )}
                  Speichern
                </Button>
              </div>
            </div>
          )}
          {/* Status & Risk */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{getServiceLabel(lead.service_type)}</Badge>
              <StatusBadge status={lead.status} />
              <VerificationTypeBadge lead={lead} />
              <SpamRiskBadge lead={lead} />
            </div>
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              {isEditingToken ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={editTokenCost}
                    onChange={e => setEditTokenCost(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-20 h-7 text-sm text-center"
                    min={1}
                    max={500}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveTokenCost} disabled={isSavingToken}>
                    {isSavingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-green-600" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditTokenCost(null)}>
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditTokenCost(currentTokenCost)}
                  className="text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-0.5 rounded-md border border-amber-200 transition-colors cursor-pointer"
                  title="Klicken zum Bearbeiten"
                >
                  {currentTokenCost} Token
                </button>
              )}
            </div>
          </div>

          {/* Customer Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Kundendaten
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vorname:</span>
                {isEditMode ? (
                  <Input
                    value={editData.customer_first_name}
                    onChange={e => setEditData(d => ({ ...d, customer_first_name: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <div className="font-medium">{lead.customer_first_name}</div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Nachname:</span>
                {isEditMode ? (
                  <Input
                    value={editData.customer_last_name}
                    onChange={e => setEditData(d => ({ ...d, customer_last_name: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <div className="font-medium">{lead.customer_last_name}</div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">E-Mail:</span>
                {isEditMode ? (
                  <Input
                    type="email"
                    value={editData.customer_email}
                    onChange={e => setEditData(d => ({ ...d, customer_email: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <div className="font-medium flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {lead.customer_email}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Telefon:</span>
                {isEditMode ? (
                  <Input
                    type="tel"
                    value={editData.customer_phone}
                    onChange={e => setEditData(d => ({ ...d, customer_phone: e.target.value }))}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <div className="font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {lead.customer_phone}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Max. Firmen:</span>
                {isPending ? (
                  <>
                  <Select
                    value={String(lead.max_companies)}
                    disabled={isRedistributing}
                    onValueChange={async (value) => {
                      const newMax = parseInt(value);
                      const oldMax = lead.max_companies ?? 3;

                      // 1. Save to DB
                      const { error } = await supabase
                        .from("leads")
                        .update({ max_companies: newMax })
                        .eq("id", lead.id);
                      if (error) {
                        toast.error("Fehler beim Speichern");
                        return;
                      }
                      setLead({ ...lead, max_companies: newMax });

                      // 2. If increased AND lead was already distributed → re-run match-lead
                      const alreadyDistributed = distributions.length > 0;
                      if (newMax > oldMax && alreadyDistributed) {
                        setIsRedistributing(true);
                        toast.info(`Max. Firmen auf ${newMax} erhöht – sende an neue Firmen…`);
                        try {
                          const { data: result } = await supabase.functions.invoke("match-lead", {
                            body: { lead_id: lead.id },
                          });
                          if (result?.already_distributed) {
                            toast.success(`Max. Firmen auf ${newMax} geändert – keine neuen passenden Firmen gefunden`);
                          } else if (result?.matched_count) {
                            const newCount = result.matched_count - distributions.length;
                            toast.success(`Max. Firmen auf ${newMax} geändert – ${newCount > 0 ? `${newCount} neue Firma(en) benachrichtigt` : "keine neuen Firmen verfügbar"}`);
                          } else {
                            toast.success(`Max. Firmen auf ${newMax} geändert`);
                          }
                        } catch {
                          toast.warning(`Max. Firmen gespeichert, aber erneute Verteilung fehlgeschlagen`);
                        } finally {
                          setIsRedistributing(false);
                        }
                      } else {
                        toast.success(`Max. Firmen auf ${newMax} ge\u00e4ndert`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                    </SelectContent>
                  </Select>
                  {isRedistributing && (
                    <span className="flex items-center gap-1 text-xs text-blue-600 ml-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Verteilt…
                    </span>
                  )}
                </>
                ) : (
                  <div className="font-medium">{lead.max_companies}</div>
                )}
              </div>
            </div>
            {lead.ip_address && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">IP-Adresse: {lead.ip_address}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  onClick={() => onAddIpToBlacklist(lead)}
                >
                  <Ban className="w-3 h-3 mr-1" />
                  Auf Blacklist setzen
                </Button>
              </div>
            )}
          </div>

          {/* Warning: verified but no distributions */}
          {lead.status === "verified" && distributions.length === 0 && (
            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
              <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Lead verifiziert, aber an keine Firma verteilt. Mögliche Ursachen: Keine passenden Firmen gefunden, PLZ nicht abgedeckt oder Freigabe-Einstellungen der Firmen schliessen diesen Lead aus. Bitte manuell verteilen.
              </p>
            </div>
          )}

          {/* Distributions */}
          {distributions.length > 0 && (
            <div className="p-4 border rounded-lg space-y-3 bg-blue-50/50 dark:bg-blue-950/20">
              <h4 className="font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Building2 className="w-4 h-4" />
                Verteilt an {distributions.length} Firma(en)
              </h4>
              <div className="space-y-2">
                {distributions.map((dist) => (
                  <div key={dist.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{dist.company_name}</span>
                      <Badge
                        variant={dist.status === "accepted" ? "default" : dist.status === "rejected" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {dist.status === "sent" ? "Gesendet" : dist.status === "accepted" ? "Angenommen" : dist.status === "rejected" ? "Abgelehnt" : dist.status}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">{dist.token_cost} Tokens</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                Von
              </h4>
              <div className="text-sm space-y-1">
                <div className="font-medium">{lead.from_plz} {lead.from_city}</div>
                {lead.from_street && <div>{lead.from_street} {lead.from_house_number}</div>}
                {lead.from_floor !== null && (
                  <div className="text-muted-foreground">
                    {lead.from_floor === 0 ? "EG" : `${lead.from_floor}. Stock`}
                    {lead.from_has_lift && " (mit Lift)"}
                  </div>
                )}
                {lead.from_rooms && <div className="text-muted-foreground">{lead.from_rooms} Zimmer</div>}
                {lead.from_living_space_m2 && <div className="text-muted-foreground">{lead.from_living_space_m2} m²</div>}
              </div>
            </div>

            {lead.to_city && (
              <div className="p-4 border rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  Nach
                </h4>
                <div className="text-sm space-y-1">
                  <div className="font-medium">{lead.to_plz} {lead.to_city}</div>
                  {lead.to_street && <div>{lead.to_street} {lead.to_house_number}</div>}
                  {lead.to_floor !== null && (
                    <div className="text-muted-foreground">
                      {lead.to_floor === 0 ? "EG" : `${lead.to_floor}. Stock`}
                      {lead.to_has_lift && " (mit Lift)"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timing */}
          <div className="p-4 border rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Termin
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Wunschdatum:</span>
                <div className="font-medium">
                  {lead.preferred_date
                    ? new Date(lead.preferred_date).toLocaleDateString("de-CH")
                    : "Nicht angegeben"}
                </div>
              </div>
              {lead.preferred_time_slot && (
                <div>
                  <span className="text-muted-foreground">Zeitfenster:</span>
                  <div className="font-medium">{lead.preferred_time_slot}</div>
                </div>
              )}
              {lead.is_flexible_date && (
                <div className="text-green-600">✓ Flexibles Datum</div>
              )}
            </div>
          </div>

          {/* Extra Services */}
          {(lead.packing_service_needed || lead.cleaning_service_needed ||
            lead.storage_needed || lead.piano_transport_needed) && (
            <div className="p-4 border rounded-lg space-y-2 bg-purple-50/50 dark:bg-purple-950/20">
              <h4 className="font-medium flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Package className="w-4 h-4" />
                Gew\u00fcnschte Zusatzleistungen
              </h4>
              <div className="flex flex-wrap gap-2">
                {lead.packing_service_needed && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    📦 Einpackservice
                  </Badge>
                )}
                {lead.cleaning_service_needed && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    🧹 Endreinigung
                  </Badge>
                )}
                {lead.storage_needed && (
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    📦 Einlagerung
                  </Badge>
                )}
                {lead.piano_transport_needed && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    🎹 Klaviertransport
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Special Items */}
          {lead.special_items && lead.special_items.length > 0 && (
            <div className="p-4 border rounded-lg space-y-2 bg-amber-50/50 dark:bg-amber-950/20">
              <h4 className="font-medium flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                Spezielle Gegenst\u00e4nde
              </h4>
              <div className="flex flex-wrap gap-2">
                {lead.special_items.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-sm">{item}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Service-Specific Details */}
          <ServiceSpecificDetails lead={lead} />

          {/* Detailed Form Data */}
          {lead.detailed_form_data && Object.keys(lead.detailed_form_data).length > 0 && (
            <div className="p-4 border rounded-lg space-y-3 bg-slate-50/50 dark:bg-slate-950/20">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="w-4 h-4" />
                Detaillierte Anfragedaten
                <Badge variant="outline" className="text-xs">
                  Formular v{lead.form_version || 1}
                </Badge>
              </h4>
              <div className="space-y-4">
                <LeadFormDataRenderer data={lead.detailed_form_data} />
              </div>
            </div>
          )}

          {/* Description */}
          {(lead.description || isEditMode) && (
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-medium">Nachricht des Kunden</h4>
              {isEditMode ? (
                <Textarea
                  value={editData.description}
                  onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                  placeholder="Nachricht des Kunden..."
                  rows={4}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{lead.description}</p>
              )}
            </div>
          )}

          {/* Admin Notes */}
          {isPending ? (
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-medium">Admin-Notizen</h4>
              <Textarea
                placeholder="Interne Notizen zur Anfrage..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
              />
            </div>
          ) : lead.admin_notes ? (
            <div className="p-4 border rounded-lg space-y-2">
              <h4 className="font-medium">Admin-Notizen</h4>
              <p className="text-sm text-muted-foreground">{lead.admin_notes}</p>
            </div>
          ) : null}

          {/* Rejection reason */}
          {lead.status === "rejected" && lead.rejection_reason && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
              <h4 className="font-medium text-destructive">Ablehnungsgrund</h4>
              <p className="text-sm">{lead.rejection_reason}</p>
            </div>
          )}

          {/* Meta info */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            Erstellt am {formatDate(lead.created_at)} &bull; Lead-ID: {lead.id}
            {lead.verified_at && <span> &bull; Bearbeitet am {formatDate(lead.verified_at)}</span>}
          </div>

          {/* Actions for pending leads */}
          {isPending && (
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schliessen
              </Button>
              <Button
                variant="destructive"
                onClick={onOpenReject}
                disabled={isProcessing}
              >
                <X className="w-4 h-4 mr-2" />
                Ablehnen
              </Button>
              <Button
                variant="default"
                onClick={() => onVerify(lead)}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Verifizieren & Senden
              </Button>
            </DialogFooter>
          )}

          {/* Actions for no-match / unaccepted distributed leads */}
          {canManuallyDistribute && (
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schliessen
              </Button>
              <Button
                variant="default"
                onClick={() => setIsManualDistributionOpen(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Manuell verteilen
              </Button>
            </DialogFooter>
          )}

          {/* Footer for edit mode when no other footer is shown */}
          {isEditMode && !isPending && !canManuallyDistribute && (
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={cancelEdit} disabled={isSavingEdit}>
                Abbrechen
              </Button>
              <Button onClick={handleSaveLead} disabled={isSavingEdit} className="bg-green-600 hover:bg-green-700 text-white">
                {isSavingEdit ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Speichern
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Manual Distribution Dialog */}
    {canManuallyDistribute && (
      <ManualDistributionDialog
        open={isManualDistributionOpen}
        onOpenChange={setIsManualDistributionOpen}
        lead={lead}
        distributions={distributions}
        onSuccess={() => {
          onOpenChange(false);
          onManualDistributionSuccess?.();
        }}
      />
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Service-Specific Details sub-component
// ---------------------------------------------------------------------------

function ServiceSpecificDetails({ lead }: { lead: Lead }) {
  const hasDetails =
    lead.piano_type || lead.property_type || lead.clearing_type ||
    lead.disposal_type || lead.storage_duration || lead.bathroom_count ||
    lead.estimated_volume || lead.items_description;

  if (!hasDetails) return null;

  return (
    <div className="p-4 border rounded-lg space-y-2 bg-cyan-50/50 dark:bg-cyan-950/20">
      <h4 className="font-medium flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
        <Zap className="w-4 h-4" />
        Service-spezifische Details
      </h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {lead.property_type && (
          <div>
            <span className="text-muted-foreground">Objekttyp:</span>
            <div className="font-medium">{lead.property_type}</div>
          </div>
        )}
        {lead.bathroom_count && (
          <div>
            <span className="text-muted-foreground">Badezimmer:</span>
            <div className="font-medium">{lead.bathroom_count}</div>
          </div>
        )}
        {lead.piano_type && (
          <div>
            <span className="text-muted-foreground">Klaviertyp:</span>
            <div className="font-medium">{lead.piano_type}</div>
          </div>
        )}
        {lead.piano_brand && (
          <div>
            <span className="text-muted-foreground">Marke:</span>
            <div className="font-medium">{lead.piano_brand}</div>
          </div>
        )}
        {lead.piano_weight_kg && (
          <div>
            <span className="text-muted-foreground">Gewicht:</span>
            <div className="font-medium">{lead.piano_weight_kg} kg</div>
          </div>
        )}
        {lead.clearing_type && (
          <div>
            <span className="text-muted-foreground">R\u00e4umungsart:</span>
            <div className="font-medium">{lead.clearing_type}</div>
          </div>
        )}
        {lead.estimated_volume && (
          <div>
            <span className="text-muted-foreground">Gesch\u00e4tztes Volumen:</span>
            <div className="font-medium">{lead.estimated_volume}</div>
          </div>
        )}
        {lead.disposal_type && (
          <div>
            <span className="text-muted-foreground">Entsorgungsart:</span>
            <div className="font-medium">{lead.disposal_type}</div>
          </div>
        )}
        {lead.storage_duration && (
          <div>
            <span className="text-muted-foreground">Lagerdauer:</span>
            <div className="font-medium">{lead.storage_duration}</div>
          </div>
        )}
        {lead.storage_volume && (
          <div>
            <span className="text-muted-foreground">Lagervolumen:</span>
            <div className="font-medium">{lead.storage_volume}</div>
          </div>
        )}
      </div>
      {lead.items_description && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-muted-foreground text-sm">Beschreibung:</span>
          <p className="text-sm mt-1">{lead.items_description}</p>
        </div>
      )}
    </div>
  );
}
