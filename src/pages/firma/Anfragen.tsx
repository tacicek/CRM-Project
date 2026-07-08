import { Helmet } from "react-helmet-async";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedCompany } from "@/hooks/useCachedCompany";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Plus,
  Search,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  CalendarPlus,
  Pencil,
} from "lucide-react";
import AnfrageEditDialog from "@/components/firma/AnfrageEditDialog";
import { getServiceLabel } from "@/lib/serviceLabels";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Lead {
  id: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  from_plz: string | null;
  from_city: string | null;
  from_rooms: number | null;
  from_living_space_m2: number | null;
  to_plz: string | null;
  to_city: string | null;
  preferred_date: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
  detailed_form_data: Record<string, unknown> | null;
}

// Folk-style service groups — emoji + flat coral/mint/violet/lemon/sky/rose accent
type ServiceGroup = { key: string; label: string; emoji: string; color: string; bg: string };
const SERVICE_GROUPS: ServiceGroup[] = [
  { key: "umzug",      label: "Umzug",      emoji: "🏠", color: "text-folk-coral",  bg: "bg-folk-coral-bg" },
  { key: "reinigung",  label: "Reinigung",  emoji: "✨", color: "text-folk-mint",   bg: "bg-folk-mint-bg" },
  { key: "raeumung",   label: "Räumung",    emoji: "📦", color: "text-folk-lemon",  bg: "bg-folk-lemon-bg" },
  { key: "transport",  label: "Transport",  emoji: "🎹", color: "text-folk-violet", bg: "bg-folk-violet-bg" },
  { key: "lagerung",   label: "Lagerung",   emoji: "🗄️", color: "text-folk-sky",    bg: "bg-folk-sky-bg" },
  { key: "entsorgung", label: "Entsorgung", emoji: "♻️", color: "text-folk-rose",   bg: "bg-folk-rose-bg" },
];

const DEFAULT_GROUP: ServiceGroup = { key: "andere", label: "Sonstige", emoji: "🏷️", color: "text-folk-ink2", bg: "bg-folk-bg-warm" };

function getServiceGroup(serviceType: string): ServiceGroup {
  const found = SERVICE_GROUPS.find((g) => serviceType?.toLowerCase().includes(g.key));
  return found ?? DEFAULT_GROUP;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd. MMM yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd. MMM · HH:mm", { locale: de });
  } catch {
    return dateStr;
  }
}

function getCustomerName(lead: Lead): string {
  const name = `${lead.customer_first_name || ""} ${lead.customer_last_name || ""}`.trim();
  return name || "Unbekannter Kunde";
}

function getInitials(lead: Lead): string {
  const first = lead.customer_first_name?.[0] || "";
  const last = lead.customer_last_name?.[0] || "";
  const combined = `${first}${last}`.toUpperCase();
  return combined || "?";
}

export default function FirmaAnfragen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { companyId } = useCachedCompany("id");
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  // lead_id → existing offer (badge + "Offerte ansehen")
  const [leadOffers, setLeadOffers] = useState<Record<string, { id: string; offer_number: number | null; status: string }>>({});

  const fetchLeads = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data as Lead[]) || [];
      setLeads(rows);

      // Fetch offers for these leads → match the most recent offer for each lead
      const leadIds = rows.map((l) => l.id);
      if (leadIds.length > 0) {
        const { data: offers } = await supabase
          .from("offers")
          .select("id, lead_id, offer_number, status, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });
        const map: Record<string, { id: string; offer_number: number | null; status: string }> = {};
        for (const o of offers ?? []) {
          if (o.lead_id && !map[o.lead_id]) {
            map[o.lead_id] = { id: o.id, offer_number: o.offer_number, status: o.status };
          }
        }
        setLeadOffers(map);
      } else {
        setLeadOffers({});
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast({
        title: "Fehler",
        description: "Anfragen konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleDelete = async (leadId: string) => {
    if (!confirm("Diese Anfrage wirklich löschen?")) return;
    setIsDeleting(leadId);
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId)
        .eq("company_id", companyId!);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      if (selectedLead?.id === leadId) setSelectedLead(null);
      toast({ title: "Gelöscht", description: "Anfrage wurde entfernt." });
    } catch (err) {
      console.error(err);
      toast({ title: "Fehler", description: "Löschen fehlgeschlagen.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateOffer = (lead: Lead) => {
    navigate(`/firma/offerten/neu?lead=${lead.id}`);
  };

  // Compute counts per service group from current leads (after search but before service filter)
  const searched = leads.filter((lead) => {
    const name = getCustomerName(lead).toLowerCase();
    const city = `${lead.from_city || ""} ${lead.to_city || ""}`.toLowerCase();
    const search = searchQuery.toLowerCase();
    if (!search) return true;
    return (
      name.includes(search) ||
      city.includes(search) ||
      lead.customer_email?.toLowerCase().includes(search) ||
      lead.customer_phone?.includes(search) ||
      lead.from_plz?.includes(search) ||
      lead.to_plz?.includes(search)
    );
  });

  // Leads with an offer leave the service tabs and are grouped in a separate "Offeriert" tab
  const openLeads = searched.filter((lead) => !leadOffers[lead.id]);
  const offeredCount = searched.length - openLeads.length;

  const filtered = searched.filter((lead) => {
    const hasOffer = !!leadOffers[lead.id];
    if (serviceFilter === "offered") return hasOffer;
    if (hasOffer) return false; // leads with an offer are not shown in the open tabs
    if (serviceFilter === "all") return true;
    return getServiceGroup(lead.service_type).key === serviceFilter;
  });

  const groupCounts: Record<string, number> = {};
  for (const lead of openLeads) {
    const k = getServiceGroup(lead.service_type).key;
    groupCounts[k] = (groupCounts[k] || 0) + 1;
  }

  const presentGroups = SERVICE_GROUPS.filter((g) => (groupCounts[g.key] || 0) > 0);
  const tabs = [
    { key: "all", label: "Alle", emoji: "·", count: openLeads.length },
    ...presentGroups.map((g) => ({ key: g.key, label: g.label, emoji: g.emoji, count: groupCounts[g.key] || 0 })),
    ...(offeredCount > 0 ? [{ key: "offered", label: "Offeriert", emoji: "✓", count: offeredCount }] : []),
  ];

  if (!user) return null;

  return (
    <>
      <Helmet>
        <title>Anfragen · CRM</title>
      </Helmet>

      <div className="space-y-5">
        {/* Folk-style page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span className="text-4xl leading-none">📥</span>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Anfragen</h1>
              <span className="text-[15px] text-folk-ink3">
                <span className="font-mono">{leads.length}</span> Anfrage{leads.length !== 1 ? "n" : ""} · {presentGroups.length} Gruppe{presentGroups.length !== 1 ? "n" : ""}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-folk-ink2">
              Eingehende Anfragen aus Webformularen, Import und direkter Erfassung — bereit für die Offerte.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLeads}
              disabled={isLoading}
              className="h-9 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
            <Button
              onClick={() => navigate("/firma/manual-import")}
              className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
            >
              <Plus className="h-3.5 w-3.5" />
              Neue Anfrage
            </Button>
          </div>
        </div>

        {/* Group tabs strip (Folk Kontakte style) */}
        <div className="-mx-1 flex flex-wrap items-end gap-0 border-b border-folk-line">
          {tabs.map((tab) => {
            const active = serviceFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setServiceFilter(tab.key)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-[15px] transition-colors ${
                  active
                    ? "border-folk-ink font-semibold text-folk-ink"
                    : "border-transparent font-medium text-folk-ink2 hover:text-folk-ink"
                }`}
              >
                <span className={`leading-none ${tab.key === "all" ? "text-base text-folk-ink4 opacity-40" : "text-sm"}`}>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span className="ml-0.5 font-mono text-[13px] text-folk-ink3">{tab.count}</span>
              </button>
            );
          })}
          <span className="px-3 py-2 text-[14px] text-folk-ink4">+</span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-folk-ink3" />
            <Input
              placeholder="In Anfragen suchen …"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-lg border-folk-line bg-folk-card pl-8 text-[15px] text-folk-ink placeholder:text-folk-ink4 focus-visible:ring-folk-coral/30"
            />
          </div>
          {serviceFilter !== "all" && (
            <button
              onClick={() => setServiceFilter("all")}
              className="inline-flex items-center gap-1.5 rounded-md border border-folk-line bg-folk-card px-2.5 py-1.5 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
            >
              <span>{tabs.find((t) => t.key === serviceFilter)?.emoji ?? getServiceGroup(serviceFilter).emoji}</span>
              <span>{tabs.find((t) => t.key === serviceFilter)?.label ?? getServiceGroup(serviceFilter).label}</span>
              <span className="text-folk-ink4">×</span>
            </button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-folk-coral" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-folk-line bg-folk-card py-16 text-center">
            {leads.length === 0 ? (
              <div className="space-y-3">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-folk-bg-warm text-2xl">📭</div>
                <p className="text-[15px] font-semibold text-folk-ink">Noch keine Anfragen importiert</p>
                <p className="px-4 text-[14px] text-folk-ink3">Importieren Sie Anfragen aus Ihren E-Mails oder Webformularen.</p>
                <Button
                  onClick={() => navigate("/firma/manual-import")}
                  className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Erste Anfrage importieren
                </Button>
              </div>
            ) : (
              <p className="text-[15px] text-folk-ink3">Keine Anfragen entsprechen Ihrer Suche.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead) => {
              const group = getServiceGroup(lead.service_type);
              const offer = leadOffers[lead.id];
              const isNew = (lead.status === "new" || lead.status === "sent" || !lead.status) && !offer;
              return (
                <article
                  key={lead.id}
                  className="group overflow-hidden rounded-xl border border-folk-line bg-folk-card transition-colors hover:border-folk-ink5"
                >
                  <div className="space-y-3 p-4">
                    {/* Top row: avatar + name + chips + date */}
                    <div className="flex flex-wrap items-start gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${group.bg} text-[14px] font-semibold ${group.color}`}>
                        {getInitials(lead)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-[14px] font-semibold tracking-tight text-folk-ink">{getCustomerName(lead)}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[13px] font-medium ${group.bg} ${group.color}`}>
                            <span>{group.emoji}</span>
                            <span>{getServiceLabel(lead.service_type)}</span>
                          </span>
                          {lead.preferred_date && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-folk-line bg-folk-bg-warm px-2 py-0.5 text-[13px] text-folk-ink2">
                              <Calendar className="h-3 w-3" />
                              <span className="font-mono">{formatDate(lead.preferred_date)}</span>
                            </span>
                          )}
                          {isNew && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-folk-coral-bg px-2 py-0.5 text-[13px] font-semibold text-folk-coral">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-folk-coral" />
                              Neu
                            </span>
                          )}
                          {offer && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-folk-mint-bg px-2 py-0.5 text-[13px] font-semibold text-folk-mint">
                              <CheckCircle2 className="h-3 w-3" />
                              {offer.offer_number ? `Offerte Nr. ${offer.offer_number}` : "Offerte erstellt"}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[14px] text-folk-ink3">
                          {(lead.from_city || lead.from_plz) && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-folk-ink4" />
                              <span className="font-mono">{lead.from_plz}</span> {lead.from_city}
                              {lead.to_city && (
                                <>
                                  <span className="mx-0.5 text-folk-ink4">→</span>
                                  <span className="font-mono">{lead.to_plz}</span> {lead.to_city}
                                </>
                              )}
                            </span>
                          )}
                          {lead.from_rooms && (
                            <span>
                              <span className="font-mono">{lead.from_rooms}</span> Zi.
                            </span>
                          )}
                          {lead.from_living_space_m2 && (
                            <span>
                              <span className="font-mono">{lead.from_living_space_m2}</span> m²
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="whitespace-nowrap font-mono text-[13px] text-folk-ink4">
                        {formatRelativeDate(lead.created_at)}
                      </span>
                    </div>

                    {/* Contact line */}
                    {(lead.customer_phone || lead.customer_email) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-folk-bg-warm px-3 py-2 text-[14px] text-folk-ink2">
                        {lead.customer_phone && (
                          <a
                            href={`tel:${lead.customer_phone}`}
                            className="flex items-center gap-1.5 font-mono text-folk-ink2 hover:text-folk-coral"
                          >
                            <Phone className="h-3 w-3 text-folk-ink4" />
                            {lead.customer_phone}
                          </a>
                        )}
                        {lead.customer_email && (
                          <a
                            href={`mailto:${lead.customer_email}`}
                            className="flex items-center gap-1.5 hover:text-folk-coral"
                          >
                            <Mail className="h-3 w-3 text-folk-ink4" />
                            {lead.customer_email}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {offer ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => navigate(`/firma/offerten/${offer.id}`)}
                            className="h-8 gap-1.5 rounded-lg bg-folk-ink px-3 text-[14px] font-semibold text-white hover:bg-folk-ink2"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Offerte ansehen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateOffer(lead)}
                            className="h-8 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Neue Offerte
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCreateOffer(lead)}
                          className="h-8 gap-1.5 rounded-lg bg-folk-ink px-3 text-[14px] font-semibold text-white hover:bg-folk-ink2"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Offerte erstellen
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/firma/besichtigungen?lead_id=${lead.id}`)}
                        className="h-8 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Besichtigung
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/firma/kalender?${new URLSearchParams({
                              newAppointment: "true",
                              leadId: lead.id,
                              // Service appointment (Auftrag) — the service type comes from the
                              // Anfrage; Besichtigung has its own (video) button above.
                              type: "service",
                              title: `${getServiceLabel(lead.service_type)} - ${[lead.customer_first_name, lead.customer_last_name].filter(Boolean).join(" ")}`.trim(),
                            }).toString()}`,
                          )
                        }
                        className="h-8 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                        title="Termin im Kalender planen"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Termin planen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLead(lead)}
                        className="h-8 gap-1.5 rounded-lg px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                      >
                        Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditLead(lead)}
                        className="h-8 gap-1.5 rounded-lg px-3 text-[14px] text-folk-ink2 hover:bg-folk-bg-warm"
                        title="Anfrage bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-8 rounded-lg px-2 text-folk-ink3 hover:bg-folk-coral-bg hover:text-folk-coral"
                        onClick={() => handleDelete(lead.id)}
                        disabled={isDeleting === lead.id}
                        title="Löschen"
                      >
                        {isDeleting === lead.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Dialog — Folk styled */}
      {selectedLead && (
        <Dialog open onOpenChange={(open) => !open && setSelectedLead(null)}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-xl border-folk-line bg-folk-card">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-semibold ${getServiceGroup(selectedLead.service_type).bg} ${getServiceGroup(selectedLead.service_type).color}`}>
                  {getInitials(selectedLead)}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-[18px] font-bold tracking-tight text-folk-ink">
                    {getCustomerName(selectedLead)}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] text-folk-ink3">
                    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium ${getServiceGroup(selectedLead.service_type).bg} ${getServiceGroup(selectedLead.service_type).color}`}>
                      <span>{getServiceGroup(selectedLead.service_type).emoji}</span>
                      <span>{getServiceLabel(selectedLead.service_type)}</span>
                    </span>
                    <span className="font-mono">{formatRelativeDate(selectedLead.created_at)}</span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-[15px]">
              {/* Contact */}
              {(selectedLead.customer_email || selectedLead.customer_phone) && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Kontakt</p>
                  <div className="space-y-1 text-folk-ink2">
                    {selectedLead.customer_email && (
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-folk-ink4" />
                        <a href={`mailto:${selectedLead.customer_email}`} className="hover:text-folk-coral">
                          {selectedLead.customer_email}
                        </a>
                      </p>
                    )}
                    {selectedLead.customer_phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-folk-ink4" />
                        <a href={`tel:${selectedLead.customer_phone}`} className="font-mono hover:text-folk-coral">
                          {selectedLead.customer_phone}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(selectedLead.from_city || selectedLead.to_city) && (
                <>
                  <Separator className="bg-folk-line-soft" />
                  <div>
                    <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">Adresse</p>
                    <div className="space-y-1 text-folk-ink2">
                      {selectedLead.from_city && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-folk-ink4" />
                          <span>Von: <span className="font-mono">{selectedLead.from_plz}</span> {selectedLead.from_city}</span>
                        </p>
                      )}
                      {selectedLead.to_city && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-folk-ink4" />
                          <span>Nach: <span className="font-mono">{selectedLead.to_plz}</span> {selectedLead.to_city}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator className="bg-folk-line-soft" />

              <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5">
                {selectedLead.preferred_date && (
                  <>
                    <span className="text-folk-ink3">📅 Termin</span>
                    <span className="font-mono text-folk-ink">{formatDate(selectedLead.preferred_date)}</span>
                  </>
                )}
                {selectedLead.from_rooms !== null && (
                  <>
                    <span className="text-folk-ink3">🏠 Zimmer</span>
                    <span className="font-mono text-folk-ink">{selectedLead.from_rooms}</span>
                  </>
                )}
                {selectedLead.from_living_space_m2 !== null && (
                  <>
                    <span className="text-folk-ink3">📐 Fläche</span>
                    <span className="font-mono text-folk-ink">{selectedLead.from_living_space_m2} m²</span>
                  </>
                )}
              </div>

              {selectedLead.description && (
                <>
                  <Separator className="bg-folk-line-soft" />
                  <div>
                    <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">📝 Beschreibung</p>
                    <p className="whitespace-pre-wrap rounded-md bg-folk-bg-warm px-3 py-2 text-folk-ink2">
                      {selectedLead.description}
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="h-9 flex-1 gap-1.5 rounded-lg bg-folk-ink text-[15px] font-semibold text-white hover:bg-folk-ink2"
                  onClick={() => handleCreateOffer(selectedLead)}
                >
                  <FileText className="h-4 w-4" />
                  Offerte erstellen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditLead(selectedLead);
                    setSelectedLead(null);
                  }}
                  className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-folk-ink2 hover:bg-folk-bg-warm"
                  title="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                  Bearbeiten
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDelete(selectedLead.id)}
                  disabled={isDeleting === selectedLead.id}
                  className="h-9 rounded-lg border-folk-line bg-folk-card px-3 text-folk-coral hover:bg-folk-coral-bg"
                  title="Löschen"
                >
                  {isDeleting === selectedLead.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editLead && (
        <AnfrageEditDialog
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={() => {
            setEditLead(null);
            fetchLeads();
          }}
        />
      )}
    </>
  );
}
