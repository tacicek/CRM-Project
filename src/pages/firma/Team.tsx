import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { fetchSingleCompanyForUser } from "@/lib/fetchSingleCompanyForUser";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Phone,
  Mail,
  Users,
  Loader2,
  Truck,
  Wrench,
  UserPlus,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

// Import shared types, constants, and validation helpers
import type { TeamMember, Resource, MemberFormState, ResourceFormState } from "@/types/team";
import { getColorOptions, getRoleLabel, getRoleIcon, getRoleOptions, getRandomColor } from "@/constants/team";
import { isValidEmail, sanitizePhone, parseCapacity, parseQuantity, getInitials } from "@/lib/validation";
import { useI18n, useT } from "@/i18n/useI18n";

const TeamPage = () => {
  const { user } = useAuth();
  const t = useT();
  const { locale } = useI18n();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  
  // FIX: Add saving state and pending operation for race condition protection
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "member" | "resource"; id: string } | null>(null);

  const [memberForm, setMemberForm] = useState<MemberFormState>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "",
    color_code: "#3B82F6",
  });

  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
    resource_type: "vehicle",
    name: "",
    description: "",
    license_plate: "",
    capacity_m3: "",
    quantity: "1",
  });

  // FIX: Add isMounted flag to prevent memory leak
  useEffect(() => {
    let isMounted = true;
    
    const loadCompany = async () => {
      if (!user) return;
      try {
        const company = await fetchSingleCompanyForUser<{ id: string }>({
          userId: user.id,
          userEmail: user.email,
          select: "id",
        });
        if (isMounted && company) setCompanyId(company.id);
      } catch (e) {
        if (isMounted) console.error("Error loading company:", e);
      }
    };
    
    loadCompany();
    
    return () => {
      isMounted = false;
    };
  }, [user]);

  const fetchData = useCallback(async (isMounted = true) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [membersRes, resourcesRes] = await Promise.all([
        supabase
          .from("team_members")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("firma_resources")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
      ]);

      if (!isMounted) return;
      
      if (membersRes.data) setTeamMembers(membersRes.data as TeamMember[]);
      if (resourcesRes.data) setResources(resourcesRes.data as Resource[]);
    } catch (e) {
      if (isMounted) {
        console.error("Error fetching data:", e);
        toast.error(t("team.toast.loadFailed"));
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [companyId, t]);

  // FIX: Add cleanup to prevent memory leak
  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);
    return () => { isMounted = false; };
  }, [fetchData]);

  const openMemberModal = (member?: TeamMember) => {
    if (member) {
      setEditingMember(member);
      setMemberForm({
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email || "",
        phone: member.phone || "",
        role: member.role || "",
        color_code: member.color_code,
      });
    } else {
      setEditingMember(null);
      setMemberForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        role: "",
        color_code: getRandomColor(),
      });
    }
    setIsMemberModalOpen(true);
  };

  const openResourceModal = (resource?: Resource) => {
    if (resource) {
      setEditingResource(resource);
      setResourceForm({
        resource_type: resource.resource_type,
        name: resource.name,
        description: resource.description || "",
        license_plate: resource.license_plate || "",
        capacity_m3: resource.capacity_m3?.toString() || "",
        quantity: resource.quantity.toString(),
      });
    } else {
      setEditingResource(null);
      setResourceForm({
        resource_type: "vehicle",
        name: "",
        description: "",
        license_plate: "",
        capacity_m3: "",
        quantity: "1",
      });
    }
    setIsResourceModalOpen(true);
  };

  const saveMember = async () => {
    // FIX: Prevent concurrent operations
    if (!companyId || isSaving) return;
    
    if (!memberForm.first_name.trim() || !memberForm.last_name.trim()) {
      toast.error(t("team.toast.nameRequired"));
      return;
    }

    // FIX: Validate email format
    if (!isValidEmail(memberForm.email)) {
      toast.error(t("team.toast.invalidEmail"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        company_id: companyId,
        first_name: memberForm.first_name.trim(),
        last_name: memberForm.last_name.trim(),
        email: memberForm.email.trim() || null,
        phone: sanitizePhone(memberForm.phone),
        role: memberForm.role || null,
        color_code: memberForm.color_code,
      };

      if (editingMember) {
        const { error } = await supabase
          .from("team_members")
          .update(payload)
          .eq("id", editingMember.id);
        if (error) throw error;
        toast.success("Mitarbeiter aktualisiert");
      } else {
        const { error } = await supabase.from("team_members").insert(payload);
        if (error) throw error;
        toast.success("Mitarbeiter hinzugefügt");
      }

      setIsMemberModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Error saving member:", e);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const saveResource = async () => {
    // FIX: Prevent concurrent operations
    if (!companyId || isSaving) return;
    
    if (!resourceForm.name.trim()) {
      toast.error(t("team.toast.resourceNameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      // FIX: Use proper parsing helpers
      const payload = {
        company_id: companyId,
        resource_type: resourceForm.resource_type,
        name: resourceForm.name.trim(),
        description: resourceForm.description.trim() || null,
        license_plate: resourceForm.license_plate.trim() || null,
        capacity_m3: parseCapacity(resourceForm.capacity_m3),
        quantity: parseQuantity(resourceForm.quantity),
      };

      if (editingResource) {
        const { error } = await supabase
          .from("firma_resources")
          .update(payload)
          .eq("id", editingResource.id);
        if (error) throw error;
        toast.success(t("team.toast.resourceUpdated"));
      } else {
        const { error } = await supabase.from("firma_resources").insert(payload);
        if (error) throw error;
        toast.success(t("team.toast.resourceAdded"));
      }

      setIsResourceModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Error saving resource:", e);
      toast.error(t("team.toast.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    // FIX: Prevent concurrent operations
    if (!deleteConfirm || isDeleting) return;

    setIsDeleting(true);
    try {
      if (deleteConfirm.type === "member") {
        const { error } = await supabase
          .from("team_members")
          .delete()
          .eq("id", deleteConfirm.id);
        if (error) throw error;
        toast.success(t("team.toast.memberDeleted"));
      } else {
        const { error } = await supabase
          .from("firma_resources")
          .delete()
          .eq("id", deleteConfirm.id);
        if (error) throw error;
        toast.success(t("team.toast.resourceDeleted"));
      }
      fetchData();
    } catch (e) {
      console.error("Error deleting:", e);
      toast.error(t("team.toast.deleteFailed"));
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // FIX: Add useMemo for filtered resources
  const vehicles = useMemo(() =>
    resources.filter((r) => r.resource_type === "vehicle"),
    [resources]
  );

  const equipment = useMemo(() =>
    resources.filter((r) => r.resource_type === "equipment"),
    [resources]
  );

  // Role and colour labels follow the operator's dashboard language.
  const roleOptions = useMemo(() => getRoleOptions(locale), [locale]);
  const colorOptions = useMemo(() => getColorOptions(locale), [locale]);

  if (loading && !teamMembers.length) {
    return (
      <>
        <Helmet>
          <title>{t("team.pageTitle")}</title>
        </Helmet>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Team | Firma</title>
      </Helmet>
        <div className="space-y-6">
          {/* Folk-style header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <span className="text-4xl leading-none">👥</span>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-folk-ink">Team-Verwaltung</h1>
                <span className="text-[15px] text-folk-ink3">
                  <span className="font-mono">{teamMembers.length}</span> Mitarbeiter · <span className="font-mono">{vehicles.length}</span> Fahrzeuge · <span className="font-mono">{equipment.length}</span> Ausrüstung
                </span>
              </div>
              <p className="mt-1 text-[15px] text-folk-ink2">
                Mitarbeiter, Fahrzeuge und Ausrüstung verwalten — Termine zuweisen und Verfügbarkeit prüfen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => openResourceModal()}
                className="h-9 gap-1.5 rounded-lg border-folk-line bg-folk-card px-3 text-[15px] font-medium text-folk-ink2 hover:bg-folk-bg-warm"
              >
                <Truck className="h-3.5 w-3.5" />
                Ressource
              </Button>
              <Button
                onClick={() => openMemberModal()}
                className="h-9 gap-1.5 rounded-lg bg-folk-ink px-3.5 text-[15px] font-semibold text-white hover:bg-folk-ink2"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Mitarbeiter
              </Button>
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { emoji: '👤', label: 'Mitarbeiter', value: teamMembers.length },
              { emoji: '🚚', label: 'Fahrzeuge',   value: vehicles.length },
              { emoji: '🧰', label: 'Ausrüstung',  value: equipment.length },
            ].map((tile) => (
              <div key={tile.label} className="rounded-xl border border-folk-line bg-folk-card p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-folk-ink3">{tile.label}</span>
                  <span className="text-xl leading-none">{tile.emoji}</span>
                </div>
                <div className="mt-3 font-sans text-3xl font-bold tracking-tight text-folk-ink">{tile.value}</div>
              </div>
            ))}
          </div>

          {/* Team Members */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Users className="w-5 h-5 text-white" />
                </div>
                Mitarbeiter
                <Badge variant="secondary" className="ml-2">{teamMembers.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {teamMembers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                    <Users className="w-10 h-10 text-violet-500" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Noch keine Mitarbeiter</h3>
                  <p className="text-muted-foreground mb-6">
                    Fügen Sie Ihre Teammitglieder hinzu
                  </p>
                  <Button onClick={() => openMemberModal()} className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Ersten Mitarbeiter hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teamMembers.map((member) => {
                    const RoleIcon = getRoleIcon(member.role);
                    return (
                      <div
                        key={member.id}
                        className="group relative border rounded-2xl bg-white hover:shadow-lg hover:border-primary/20 transition-all duration-300 overflow-hidden"
                      >
                        <div className="p-5">
                          <div className="flex items-start gap-4">
                            <div
                              className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shrink-0"
                              style={{ backgroundColor: member.color_code }}
                            >
                              {/* FIX: Safe initial access */}
                              {getInitials(member.first_name, member.last_name)}
                              <div 
                                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center border-2 border-white"
                                style={{ color: member.color_code }}
                              >
                                <RoleIcon className="w-3.5 h-3.5" />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                              <h3 className="font-bold text-lg text-foreground truncate">
                                {member.first_name} {member.last_name}
                              </h3>
                              {member.role && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge 
                                    variant="secondary" 
                                    className="px-2.5 py-0.5 rounded-md font-medium text-xs border bg-opacity-10"
                                    style={{ 
                                      backgroundColor: `${member.color_code}10`,
                                      color: member.color_code,
                                      borderColor: `${member.color_code}20`
                                    }}
                                  >
                                    {getRoleLabel(member.role)}
                                  </Badge>
                                </div>
                              )}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label={`${member.first_name} ${member.last_name} Optionen`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openMemberModal(member)} className="gap-2">
                                  <Edit2 className="w-4 h-4" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive gap-2"
                                  onClick={() => setDeleteConfirm({ type: "member", id: member.id })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-6">
                            {member.phone ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                asChild 
                                className="h-10 gap-2 w-full justify-center hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                              >
                                <a href={`tel:${member.phone}`}>
                                  <Phone className="w-4 h-4" />
                                  Anrufen
                                </a>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled className="h-10 gap-2 w-full opacity-50">
                                <Phone className="w-4 h-4" />
                                Anrufen
                              </Button>
                            )}
                            
                            {member.email ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                asChild 
                                className="h-10 gap-2 w-full justify-center hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                              >
                                <a href={`mailto:${member.email}`}>
                                  <Mail className="w-4 h-4" />
                                  E-Mail
                                </a>
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled className="h-10 gap-2 w-full opacity-50">
                                <Mail className="w-4 h-4" />
                                E-Mail
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                Fahrzeuge
                <Badge variant="secondary" className="ml-2">{vehicles.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {vehicles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Truck className="w-8 h-8 text-blue-500" />
                  </div>
                  <p className="text-muted-foreground mb-4">Noch keine Fahrzeuge hinzugefügt</p>
                  <Button variant="outline" onClick={() => openResourceModal()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Fahrzeug hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehicles.map((v) => (
                    <div
                      key={v.id}
                      className="group relative p-5 border rounded-xl bg-gradient-to-br from-card to-blue-500/5 hover:shadow-lg hover:border-blue-500/20 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600">
                            <Truck className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{v.name}</h3>
                            {v.license_plate && (
                              <p className="text-sm text-muted-foreground mt-1 font-mono">{v.license_plate}</p>
                            )}
                            {v.capacity_m3 && (
                              <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
                                {v.capacity_m3} m³
                              </Badge>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`${v.name} Optionen`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openResourceModal(v)} className="gap-2">
                              <Edit2 className="w-4 h-4" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive gap-2"
                              onClick={() => setDeleteConfirm({ type: "resource", id: v.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                Ausrüstung
                <Badge variant="secondary" className="ml-2">{equipment.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {equipment.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Wrench className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-muted-foreground mb-4">Noch keine Ausrüstung hinzugefügt</p>
                  <Button variant="outline" onClick={() => openResourceModal()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ausrüstung hinzufügen
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {equipment.map((e) => (
                    <div
                      key={e.id}
                      className="group relative p-5 border rounded-xl bg-gradient-to-br from-card to-amber-500/5 hover:shadow-lg hover:border-amber-500/20 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                            <Settings className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{e.name}</h3>
                            {e.description && (
                              <p className="text-sm text-muted-foreground mt-1">{e.description}</p>
                            )}
                            {e.quantity > 1 && (
                              <Badge variant="outline" className="mt-2 bg-amber-50 text-amber-700 border-amber-200">
                                {e.quantity}x vorhanden
                              </Badge>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label={`${e.name} Optionen`}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openResourceModal(e)} className="gap-2">
                              <Edit2 className="w-4 h-4" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive gap-2"
                              onClick={() => setDeleteConfirm({ type: "resource", id: e.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Member Modal */}
        <Dialog open={isMemberModalOpen} onOpenChange={setIsMemberModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingMember ? (
                  <>
                    <Edit2 className="w-5 h-5 text-primary" />
                    Mitarbeiter bearbeiten
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 text-primary" />
                    Neuer Mitarbeiter
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vorname *</Label>
                  <Input
                    value={memberForm.first_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, first_name: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nachname *</Label>
                  <Input
                    value={memberForm.last_name}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, last_name: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rolle</Label>
                <Select
                  value={memberForm.role}
                  onValueChange={(v) => setMemberForm({ ...memberForm, role: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Rolle auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {opt.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    type="tel"
                    value={memberForm.phone}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, phone: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm({ ...memberForm, email: e.target.value })
                    }
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Farbe</Label>
                <div className="flex gap-2 flex-wrap p-3 bg-muted/50 rounded-xl">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 ${
                        memberForm.color_code === color.value
                          ? "border-foreground scale-110 shadow-lg"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setMemberForm({ ...memberForm, color_code: color.value })}
                      title={color.name}
                      aria-label={`Farbe ${color.name} auswählen`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsMemberModalOpen(false)} disabled={isSaving}>
                Abbrechen
              </Button>
              <Button onClick={saveMember} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  editingMember ? "Aktualisieren" : "Hinzufügen"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Resource Modal */}
        <Dialog open={isResourceModalOpen} onOpenChange={setIsResourceModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingResource ? (
                  <>
                    <Edit2 className="w-5 h-5 text-primary" />
                    Ressource bearbeiten
                  </>
                ) : (
                  <>
                    <Truck className="w-5 h-5 text-primary" />
                    Neue Ressource
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Typ</Label>
                <Select
                  value={resourceForm.resource_type}
                  onValueChange={(v) =>
                    setResourceForm({ ...resourceForm, resource_type: v })
                  }
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4" />
                        Fahrzeug
                      </div>
                    </SelectItem>
                    <SelectItem value="equipment">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Ausrüstung
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={resourceForm.name}
                  onChange={(e) =>
                    setResourceForm({ ...resourceForm, name: e.target.value })
                  }
                  placeholder={
                    resourceForm.resource_type === "vehicle"
                      ? "z.B. Möbelwagen 25m³"
                      : "z.B. Tresor-Dolly"
                  }
                  className="h-11"
                />
              </div>

              {resourceForm.resource_type === "vehicle" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kennzeichen</Label>
                    <Input
                      value={resourceForm.license_plate}
                      onChange={(e) =>
                        setResourceForm({ ...resourceForm, license_plate: e.target.value })
                      }
                      placeholder="ZH 123456"
                      className="h-11 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kapazität (m³)</Label>
                    <Input
                      type="number"
                      value={resourceForm.capacity_m3}
                      onChange={(e) =>
                        setResourceForm({ ...resourceForm, capacity_m3: e.target.value })
                      }
                      placeholder="25"
                      className="h-11"
                    />
                  </div>
                </div>
              )}

              {resourceForm.resource_type === "equipment" && (
                <div className="space-y-2">
                  <Label>Anzahl</Label>
                  <Input
                    type="number"
                    className="w-full sm:w-1/2 h-11"
                    value={resourceForm.quantity}
                    onChange={(e) =>
                      setResourceForm({ ...resourceForm, quantity: e.target.value })
                    }
                    min="1"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Beschreibung</Label>
                <Input
                  value={resourceForm.description}
                  onChange={(e) =>
                    setResourceForm({ ...resourceForm, description: e.target.value })
                  }
                  placeholder="Optional"
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsResourceModalOpen(false)} disabled={isSaving}>
                Abbrechen
              </Button>
              <Button onClick={saveResource} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  editingResource ? "Aktualisieren" : "Hinzufügen"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={() => !isDeleting && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                Löschen bestätigen
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sind Sie sicher, dass Sie{" "}
                {deleteConfirm?.type === "member" ? "diesen Mitarbeiter" : "diese Ressource"}{" "}
                löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Löschen...
                  </>
                ) : (
                  "Löschen"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
};

export default TeamPage;
