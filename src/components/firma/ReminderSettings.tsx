import { useCallback, useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useT } from "@/i18n/useI18n";
import { getAppointmentTypeLabel } from "@/i18n/domain";
import {
  Bell, 
  Clock, 
  Mail, 
  Users, 
  Phone, 
  FileText, 
  DollarSign,
  Save,
  Loader2,
  AlertCircle
} from "lucide-react";

interface ReminderSettings {
  id?: string;
  company_id: string;
  team_reminder_hours: number;
  customer_reminder_hours: number;
  team_reminders_enabled: boolean;
  customer_reminders_enabled: boolean;
  include_customer_phone: boolean;
  include_customer_email: boolean;
  include_lead_details: boolean;
  include_offer_details: boolean;
  custom_footer_message: string | null;
}

interface PendingReminder {
  appointment_id: string;
  appointment_date: string;
  start_time: string;
  title: string;
  appointment_type: string;
  team_names: string[];
  team_emails: string[];
  reminder_time: string;
}

interface ReminderSettingsProps {
  companyId: string;
}

/** Lead times offered in the two selects — the label comes from `reminders.hoursBefore`. */
const TEAM_REMINDER_HOURS = [6, 12, 24, 48] as const;
const CUSTOMER_REMINDER_HOURS = [12, 24, 48, 72] as const;

export function ReminderSettings({ companyId }: ReminderSettingsProps) {
  const t = useT();
  const { locale, dateLocale } = useI18n();
  const [settings, setSettings] = useState<ReminderSettings>({
    company_id: companyId,
    team_reminder_hours: 12,
    customer_reminder_hours: 24,
    team_reminders_enabled: true,
    customer_reminders_enabled: true,
    include_customer_phone: true,
    include_customer_email: true,
    include_lead_details: true,
    include_offer_details: true,
    custom_footer_message: null,
  });
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("company_reminder_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching reminder settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const fetchPendingReminders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("pending_team_reminders")
        .select("*")
        .eq("company_id", companyId)
        .limit(10);

      if (error) {
        // View might not exist yet
        console.log("Pending reminders view not available");
        return;
      }

      setPendingReminders(data || []);
    } catch (error) {
      console.error("Error fetching pending reminders:", error);
    }
  }, [companyId]);

  useEffect(() => {
    fetchSettings();
    fetchPendingReminders();
     
  }, [fetchSettings, fetchPendingReminders]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("company_reminder_settings")
        .upsert({
          ...settings,
          company_id: companyId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "company_id"
        });

      if (error) throw error;

      toast({
        title: t("reminders.toast.saved"),
        description: t("reminders.toast.savedDescription"),
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: t("common.error"),
        description: t("reminders.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** "Mo, 03.02." in the OPERATOR's dashboard language — this list never leaves the dashboard. */
  const formatDate = (dateStr: string): string =>
    format(new Date(dateStr), "EEE, dd.MM.", { locale: dateLocale });

  const formatTime = (timeStr: string): string => {
    const parts = timeStr.split(":");
    return `${parts[0]}:${parts[1]}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Bell className="w-5 h-5 text-white" />
            </div>
            {t("reminders.title")}
          </CardTitle>
          <CardDescription>
            {t("reminders.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          {/* Team Reminders Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100">
                  <Users className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <Label className="text-base font-semibold">{t("reminders.team.title")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("reminders.team.description")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.team_reminders_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, team_reminders_enabled: checked })
                }
              />
            </div>

            {settings.team_reminders_enabled && (
              <div className="ml-11 space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="min-w-[160px]">{t("reminders.sendAt")}</Label>
                  <Select
                    value={String(settings.team_reminder_hours)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, team_reminder_hours: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_REMINDER_HOURS.map((hours) => (
                        <SelectItem key={hours} value={String(hours)}>
                          {t("reminders.hoursBefore", { count: hours })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Customer Reminders Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <Label className="text-base font-semibold">{t("reminders.customer.title")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("reminders.customer.description")}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.customer_reminders_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, customer_reminders_enabled: checked })
                }
              />
            </div>

            {settings.customer_reminders_enabled && (
              <div className="ml-11 space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <Label className="min-w-[160px]">{t("reminders.sendAt")}</Label>
                  <Select
                    value={String(settings.customer_reminder_hours)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, customer_reminder_hours: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOMER_REMINDER_HOURS.map((hours) => (
                        <SelectItem key={hours} value={String(hours)}>
                          {t("reminders.hoursBefore", { count: hours })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Email Content Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <Label className="text-base font-semibold">{t("reminders.content.title")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("reminders.content.description")}
                </p>
              </div>
            </div>

            <div className="ml-11 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <Label className="flex-1">{t("reminders.content.customerPhone")}</Label>
                <Switch
                  checked={settings.include_customer_phone}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, include_customer_phone: checked })
                  }
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <Label className="flex-1">{t("reminders.content.customerEmail")}</Label>
                <Switch
                  checked={settings.include_customer_email}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, include_customer_email: checked })
                  }
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <Label className="flex-1">{t("reminders.content.leadDetails")}</Label>
                <Switch
                  checked={settings.include_lead_details}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, include_lead_details: checked })
                  }
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <Label className="flex-1">{t("reminders.content.offerDetails")}</Label>
                <Switch
                  checked={settings.include_offer_details}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, include_offer_details: checked })
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Custom Footer Message */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t("reminders.footer.title")}</Label>
            <Textarea
              placeholder={t("reminders.footer.placeholder")}
              value={settings.custom_footer_message || ""}
              onChange={(e) =>
                setSettings({ ...settings, custom_footer_message: e.target.value || null })
              }
              rows={3}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Reminders Card */}
      {pendingReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              {t("reminders.pending.title")}
              <Badge variant="secondary">{pendingReminders.length}</Badge>
            </CardTitle>
            <CardDescription>
              {t("reminders.pending.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingReminders.map((reminder) => (
                <div
                  key={reminder.appointment_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100">
                      <Bell className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{reminder.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {getAppointmentTypeLabel(reminder.appointment_type, locale)}
                        </Badge>
                        <span>
                          {formatDate(reminder.appointment_date)} • {formatTime(reminder.start_time)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {t("reminders.pending.members", { count: reminder.team_names?.length ?? 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("reminders.pending.dispatch", {
                        date: formatDate(reminder.reminder_time),
                        time: formatTime(reminder.reminder_time.split("T")[1] || "00:00"),
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="p-2 rounded-lg bg-blue-100 h-fit">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">
                {t("reminders.info.title")}
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• {t("reminders.info.item1")}</li>
                <li>• {t("reminders.info.item2")}</li>
                <li>• {t("reminders.info.item3")}</li>
                <li>• {t("reminders.info.item4")}</li>
                <li>• {t("reminders.info.item5")}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ReminderSettings;

