import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Truck, Calendar, User, AlertTriangle, Plus, X } from "lucide-react";
import { toast } from "sonner";

export interface BoxItem {
  type: string;
  quantity: number;
}

export interface UmzugsboxRental {
  id: string;
  company_id: string;
  lead_id: string | null;
  offer_id: string | null;
  appointment_id: string | null;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  // Delivery address - where boxes are delivered TO (old home)
  delivery_address: string | null;
  delivery_plz: string | null;
  delivery_city: string | null;
  // Pickup address - where boxes will be collected FROM (new home)
  pickup_address: string | null;
  pickup_plz: string | null;
  pickup_city: string | null;
  box_type?: string; // Legacy field, kept for backward compatibility
  box_quantity?: number; // Legacy field, kept for backward compatibility
  box_items: BoxItem[] | null; // New field: array of box items
  box_description: string | null;
  is_rental: boolean;
  rental_price_per_day: number | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  delivery_date: string;
  expected_return_date: string | null;
  actual_return_date: string | null;
  pickup_scheduled_date: string | null;
  pickup_scheduled_time: string | null;
  status: string;
  assigned_team_member_id: string | null;
  delivered_by_team_member_id: string | null;
  picked_up_by_team_member_id: string | null;
  reminder_days_before: number;
  reminder_sent: boolean;
  customer_notified: boolean;
  internal_notes: string | null;
  customer_notes: string | null;
  archived_at: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  color_code: string;
}

interface Lead {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  // From address (old home - delivery)
  from_street: string | null;
  from_house_number: string | null;
  from_plz: string | null;
  from_city: string | null;
  // To address (new home - pickup)
  to_street: string | null;
  to_house_number: string | null;
  to_plz: string | null;
  to_city: string | null;
}

interface UmzugsboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  rental: UmzugsboxRental | null;
  companyId: string | null;
  onSaved: () => void;
  initialLeadId?: string | null;
}

const boxTypes = [
  { value: "standard", label: "Standard Umzugskarton" },
  { value: "wardrobe", label: "Kleiderbox" },
  { value: "book", label: "Bücherbox" },
  { value: "fragile", label: "Fragile / Glas" },
  { value: "archive", label: "Archivbox" },
  { value: "other", label: "Andere" },
];

const statusOptions = [
  { value: "reserved", label: "Reserviert", color: "bg-blue-500" },
  { value: "delivered", label: "Geliefert", color: "bg-green-500" },
  { value: "in_use", label: "In Gebrauch", color: "bg-yellow-500" },
  { value: "pickup_requested", label: "Abholung angefragt", color: "bg-orange-500" },
  { value: "pickup_scheduled", label: "Abholung geplant", color: "bg-purple-500" },
  { value: "returned", label: "Zurückgegeben", color: "bg-gray-500" },
  { value: "lost", label: "Verloren", color: "bg-red-500" },
  { value: "damaged", label: "Beschädigt", color: "bg-red-300" },
];

export const UmzugsboxModal = ({
  isOpen,
  onClose,
  rental,
  companyId,
  onSaved,
  initialLeadId,
}: UmzugsboxModalProps) => {
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId || null);

  const [boxItems, setBoxItems] = useState<BoxItem[]>([
    { type: "standard", quantity: 10 }
  ]);

  const [formData, setFormData] = useState({
    customer_first_name: "",
    customer_last_name: "",
    customer_email: "",
    customer_phone: "",
    // Delivery address - where boxes go first (old home)
    delivery_address: "",
    delivery_plz: "",
    delivery_city: "",
    // Pickup address - where boxes will be collected (new home)
    pickup_address: "",
    pickup_plz: "",
    pickup_city: "",
    box_description: "",
    is_rental: true,
    rental_price_per_day: 0,
    deposit_amount: 0,
    deposit_paid: false,
    delivery_date: format(new Date(), "yyyy-MM-dd"),
    expected_return_date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
    pickup_scheduled_date: "",
    pickup_scheduled_time: "",
    status: "delivered",
    assigned_team_member_id: "",
    delivered_by_team_member_id: "",
    reminder_days_before: 3,
    internal_notes: "",
    customer_notes: "",
  });

  // Initialize form
  useEffect(() => {
    if (rental) {
      // Parse box_items from rental (handle both new format and legacy format)
      let items: BoxItem[] = [];
      if (rental.box_items && Array.isArray(rental.box_items)) {
        items = rental.box_items;
      } else if (rental.box_type && rental.box_quantity) {
        // Legacy format: convert single box_type + box_quantity to array
        items = [{ type: rental.box_type, quantity: rental.box_quantity }];
      } else {
        items = [{ type: "standard", quantity: 1 }];
      }

      setBoxItems(items);
      setFormData({
        customer_first_name: rental.customer_first_name,
        customer_last_name: rental.customer_last_name,
        customer_email: rental.customer_email || "",
        customer_phone: rental.customer_phone || "",
        delivery_address: rental.delivery_address || "",
        delivery_plz: rental.delivery_plz || "",
        delivery_city: rental.delivery_city || "",
        pickup_address: rental.pickup_address || "",
        pickup_plz: rental.pickup_plz || "",
        pickup_city: rental.pickup_city || "",
        box_description: rental.box_description || "",
        is_rental: rental.is_rental,
        rental_price_per_day: rental.rental_price_per_day || 0,
        deposit_amount: rental.deposit_amount || 0,
        deposit_paid: rental.deposit_paid,
        delivery_date: rental.delivery_date,
        expected_return_date: rental.expected_return_date || "",
        pickup_scheduled_date: rental.pickup_scheduled_date || "",
        pickup_scheduled_time: rental.pickup_scheduled_time || "",
        status: rental.status,
        assigned_team_member_id: rental.assigned_team_member_id || "",
        delivered_by_team_member_id: rental.delivered_by_team_member_id || "",
        reminder_days_before: rental.reminder_days_before,
        internal_notes: rental.internal_notes || "",
        customer_notes: rental.customer_notes || "",
      });
      setSelectedLeadId(rental.lead_id);
    } else {
      // Reset form for new entry
      setBoxItems([{ type: "standard", quantity: 10 }]);
      setFormData({
        customer_first_name: "",
        customer_last_name: "",
        customer_email: "",
        customer_phone: "",
        delivery_address: "",
        delivery_plz: "",
        delivery_city: "",
        pickup_address: "",
        pickup_plz: "",
        pickup_city: "",
        box_description: "",
        is_rental: true,
        rental_price_per_day: 0,
        deposit_amount: 0,
        deposit_paid: false,
        delivery_date: format(new Date(), "yyyy-MM-dd"),
        expected_return_date: format(addDays(new Date(), 14), "yyyy-MM-dd"),
        pickup_scheduled_date: "",
        pickup_scheduled_time: "",
        status: "delivered",
        assigned_team_member_id: "",
        delivered_by_team_member_id: "",
        reminder_days_before: 3,
        internal_notes: "",
        customer_notes: "",
      });
      setSelectedLeadId(initialLeadId || null);
    }
  }, [rental, initialLeadId, isOpen]);

  // Load team members and leads
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!companyId || !isOpen) return;

      const [teamRes, leadsRes] = await Promise.all([
        supabase
          .from("team_members")
          .select("id, first_name, last_name, role, color_code")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("leads")
          .select("id, customer_first_name, customer_last_name, customer_email, customer_phone, from_street, from_house_number, from_plz, from_city, to_street, to_house_number, to_plz, to_city")
          .eq("company_id", companyId)
          .in("status", ["verified", "distributed", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      // FIX: Only update state if component is still mounted
      if (isMounted) {
        if (teamRes.data) setTeamMembers(teamRes.data);
        if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
      }
    };

    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [isOpen, companyId]);

  // Fill form when lead selected
  useEffect(() => {
    if (selectedLeadId && !rental) {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (lead) {
        setFormData(prev => ({
          ...prev,
          customer_first_name: lead.customer_first_name || "",
          customer_last_name: lead.customer_last_name || "",
          customer_email: lead.customer_email || "",
          customer_phone: lead.customer_phone || "",
          // Delivery = From address (old home - where boxes go first)
          delivery_address: [lead.from_street, lead.from_house_number].filter(Boolean).join(" "),
          delivery_plz: lead.from_plz || "",
          delivery_city: lead.from_city || "",
          // Pickup = To address (new home - where boxes will be collected)
          pickup_address: [lead.to_street, lead.to_house_number].filter(Boolean).join(" "),
          pickup_plz: lead.to_plz || "",
          pickup_city: lead.to_city || "",
        }));
      }
    }
  }, [selectedLeadId, leads, rental]);

  const handleSubmit = async () => {
    if (!companyId) return;
    if (!formData.customer_first_name.trim() || !formData.customer_last_name.trim()) {
      toast.error("Bitte geben Sie den Kundennamen ein");
      return;
    }

    // FIX: Email format validation
    if (formData.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
      toast.error("Bitte geben Sie eine gültige E-Mail-Adresse ein");
      return;
    }

    // FIX: Date validation - expected return date must be after delivery date
    if (formData.expected_return_date && formData.delivery_date) {
      const deliveryDate = new Date(formData.delivery_date);
      const returnDate = new Date(formData.expected_return_date);
      if (returnDate < deliveryDate) {
        toast.error("Das Rückgabedatum muss nach dem Lieferdatum liegen");
        return;
      }
    }

    // Validate box items
    const validBoxItems = boxItems.filter(item => item.quantity > 0);
    if (validBoxItems.length === 0) {
      toast.error("Bitte geben Sie mindestens eine Box mit Menge > 0 ein");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        company_id: companyId,
        lead_id: selectedLeadId || null,
        customer_first_name: formData.customer_first_name,
        customer_last_name: formData.customer_last_name,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        delivery_address: formData.delivery_address || null,
        delivery_plz: formData.delivery_plz || null,
        delivery_city: formData.delivery_city || null,
        pickup_address: formData.pickup_address || null,
        pickup_plz: formData.pickup_plz || null,
        pickup_city: formData.pickup_city || null,
        box_items: validBoxItems, // JSONB array
        box_description: formData.box_description || null,
        is_rental: formData.is_rental,
        rental_price_per_day: formData.rental_price_per_day || null,
        deposit_amount: formData.deposit_amount || null,
        deposit_paid: formData.deposit_paid,
        delivery_date: formData.delivery_date,
        expected_return_date: formData.expected_return_date || null,
        pickup_scheduled_date: formData.pickup_scheduled_date || null,
        pickup_scheduled_time: formData.pickup_scheduled_time || null,
        status: formData.status,
        assigned_team_member_id: formData.assigned_team_member_id || null,
        delivered_by_team_member_id: formData.delivered_by_team_member_id || null,
        reminder_days_before: formData.reminder_days_before,
        internal_notes: formData.internal_notes || null,
        customer_notes: formData.customer_notes || null,
      };

      if (rental) {
        const { error } = await supabase
          .from("umzugsbox_rentals")
          .update(payload)
          .eq("id", rental.id);

        if (error) throw error;
        toast.success("Umzugsbox-Eintrag aktualisiert");
      } else {
        const { error } = await supabase
          .from("umzugsbox_rentals")
          .insert([payload]);

        if (error) throw error;
        toast.success("Umzugsbox-Eintrag erstellt");
      }

      onSaved();
    } catch (e) {
      console.error("Error saving umzugsbox rental:", e);
      toast.error("Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = statusOptions.find(s => s.value === status);
    if (!opt) return null;
    return (
      <Badge className={`${opt.color} text-white`}>
        {opt.label}
      </Badge>
    );
  };

  const isOverdue = () => {
    if (!formData.expected_return_date) return false;
    return new Date(formData.expected_return_date) < new Date() && 
           !["returned", "lost", "damaged"].includes(formData.status);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {rental ? "Umzugsbox bearbeiten" : "Neue Umzugsbox-Vermietung"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status & Overdue Warning */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              {getStatusBadge(formData.status)}
            </div>
            {isOverdue() && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Überfällig!</span>
              </div>
            )}
          </div>

          {/* Lead Selection (for new entries) */}
          {!rental && leads.length > 0 && (
            <div className="space-y-2">
              <Label>Mit Anfrage verknüpfen (optional)</Label>
              <Select
                value={selectedLeadId || "none"}
                onValueChange={(v) => setSelectedLeadId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Anfrage auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Verknüpfung</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.customer_first_name} {lead.customer_last_name} - {lead.from_city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="w-4 h-4" />
              Kundendaten
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname *</Label>
                <Input
                  value={formData.customer_first_name}
                  onChange={(e) => setFormData({ ...formData, customer_first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nachname *</Label>
                <Input
                  value={formData.customer_last_name}
                  onChange={(e) => setFormData({ ...formData, customer_last_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Addresses Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Delivery Address - where boxes go first (old home) */}
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Truck className="w-4 h-4" />
                📦 Lieferadresse (Boxen hinbringen)
              </div>
              <p className="text-xs text-blue-600">Wohin die Boxen zuerst geliefert werden (alte Wohnung)</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Strasse</Label>
                  <Input
                    value={formData.delivery_address}
                    onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                    placeholder="Musterstrasse 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">PLZ</Label>
                    <Input
                      value={formData.delivery_plz}
                      onChange={(e) => setFormData({ ...formData, delivery_plz: e.target.value })}
                      placeholder="8000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ort</Label>
                    <Input
                      value={formData.delivery_city}
                      onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
                      placeholder="Zürich"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pickup Address - where boxes will be collected (new home) */}
            <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                <Truck className="w-4 h-4" />
                🚚 Abholadresse (Boxen abholen)
              </div>
              <p className="text-xs text-green-600">Woher die Boxen später abgeholt werden (neue Wohnung)</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Strasse</Label>
                  <Input
                    value={formData.pickup_address}
                    onChange={(e) => setFormData({ ...formData, pickup_address: e.target.value })}
                    placeholder="Neuestrasse 2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">PLZ</Label>
                    <Input
                      value={formData.pickup_plz}
                      onChange={(e) => setFormData({ ...formData, pickup_plz: e.target.value })}
                      placeholder="8001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ort</Label>
                    <Input
                      value={formData.pickup_city}
                      onChange={(e) => setFormData({ ...formData, pickup_city: e.target.value })}
                      placeholder="Zürich"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Box Details */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="w-4 h-4" />
                Box-Details
              </div>
              <div className="text-xs text-muted-foreground">
                Gesamt: {boxItems.reduce((sum, item) => sum + item.quantity, 0)} Boxen
              </div>
            </div>
            
            {/* Box Items List */}
            <div className="space-y-3">
              {boxItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Box-Typ</Label>
                    <Select
                      value={item.type}
                      onValueChange={(v) => {
                        const updated = [...boxItems];
                        updated[index].type = v;
                        setBoxItems(updated);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {boxTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32 space-y-2">
                    <Label>Anzahl</Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...boxItems];
                        updated[index].quantity = parseInt(e.target.value) || 0;
                        setBoxItems(updated);
                      }}
                    />
                  </div>
                  {boxItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mb-0"
                      onClick={() => {
                        setBoxItems(boxItems.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setBoxItems([...boxItems, { type: "standard", quantity: 1 }]);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Weitere Box-Typ hinzufügen
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Input
                value={formData.box_description}
                onChange={(e) => setFormData({ ...formData, box_description: e.target.value })}
                placeholder="Zusätzliche Informationen zu den Boxen..."
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_rental"
                  checked={formData.is_rental}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_rental: !!checked })}
                />
                <Label htmlFor="is_rental" className="cursor-pointer">
                  Mietboxen (müssen zurückgegeben werden)
                </Label>
              </div>
            </div>
          </div>

          {/* Rental Info */}
          {formData.is_rental && (
            <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                <Calendar className="w-4 h-4" />
                Miet-Details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mietpreis pro Tag (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.rental_price_per_day || ""}
                    onChange={(e) => setFormData({ ...formData, rental_price_per_day: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kaution (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.deposit_amount || ""}
                    onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="deposit_paid"
                  checked={formData.deposit_paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, deposit_paid: !!checked })}
                />
                <Label htmlFor="deposit_paid" className="cursor-pointer">
                  Kaution bezahlt
                </Label>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              Termine
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lieferdatum *</Label>
                <Input
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Erwartetes Rückgabedatum</Label>
                <Input
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
                />
              </div>
            </div>
            {(formData.status === "pickup_requested" || formData.status === "pickup_scheduled") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Geplantes Abholdatum</Label>
                  <Input
                    type="date"
                    value={formData.pickup_scheduled_date}
                    onChange={(e) => setFormData({ ...formData, pickup_scheduled_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geplante Abholzeit</Label>
                  <Input
                    type="time"
                    value={formData.pickup_scheduled_time}
                    onChange={(e) => setFormData({ ...formData, pickup_scheduled_time: e.target.value })}
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Erinnerung X Tage vor Rückgabe</Label>
              <Select
                value={formData.reminder_days_before.toString()}
                onValueChange={(v) => setFormData({ ...formData, reminder_days_before: parseInt(v) })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Tag</SelectItem>
                  <SelectItem value="2">2 Tage</SelectItem>
                  <SelectItem value="3">3 Tage</SelectItem>
                  <SelectItem value="5">5 Tage</SelectItem>
                  <SelectItem value="7">7 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Assignment */}
          {teamMembers.length > 0 && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
              <div className="text-sm font-medium">Team-Zuordnung</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zuständig für Abholung</Label>
                  <Select
                    value={formData.assigned_team_member_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, assigned_team_member_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Team-Mitglied wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: member.color_code }}
                            />
                            {member.first_name} {member.last_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Geliefert von</Label>
                  <Select
                    value={formData.delivered_by_team_member_id || "none"}
                    onValueChange={(v) => setFormData({ ...formData, delivered_by_team_member_id: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Team-Mitglied wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: member.color_code }}
                            />
                            {member.first_name} {member.last_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Interne Notizen</Label>
              <Textarea
                value={formData.internal_notes}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                placeholder="Nur für interne Verwendung..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Kundenhinweise zur Abholung</Label>
              <Textarea
                value={formData.customer_notes}
                onChange={(e) => setFormData({ ...formData, customer_notes: e.target.value })}
                placeholder="z.B. Boxen stehen im Keller, Zugang via Hintereingang"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {rental ? "Aktualisieren" : "Erstellen"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

