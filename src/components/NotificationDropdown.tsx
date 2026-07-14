import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell,
  Check,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  FileCheck,
  FileX,
  Eye,
  Clock,
  ArrowRight,
  BellRing
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NotificationItem } from "@/hooks/useNotificationHistory";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/useI18n";
import { toast } from "sonner";

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: NotificationItem) => void;
}

// Notification type configurations
const notificationConfig: Record<string, {
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  accentColor: string;
}> = {
  offer_response: {
    icon: FileCheck,
    gradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    iconColor: "text-white",
    accentColor: "border-l-emerald-500",
  },
  offer_rejected: {
    icon: FileX,
    gradient: "from-rose-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-rose-400 to-rose-600",
    iconColor: "text-white",
    accentColor: "border-l-rose-500",
  },
  new_lead: {
    icon: Sparkles,
    gradient: "from-amber-500/20 via-amber-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    iconColor: "text-white",
    accentColor: "border-l-amber-500",
  },
  besichtigung_request: {
    icon: Eye,
    gradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-blue-400 to-blue-600",
    iconColor: "text-white",
    accentColor: "border-l-blue-500",
  },
  appointment: {
    icon: Calendar,
    gradient: "from-violet-500/20 via-violet-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-violet-400 to-violet-600",
    iconColor: "text-white",
    accentColor: "border-l-violet-500",
  },
  appointment_reschedule: {
    icon: Clock,
    gradient: "from-orange-500/20 via-orange-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-orange-400 to-orange-600",
    iconColor: "text-white",
    accentColor: "border-l-orange-500",
  },
  default: {
    icon: BellRing,
    gradient: "from-slate-500/20 via-slate-500/10 to-transparent",
    iconBg: "bg-gradient-to-br from-slate-400 to-slate-600",
    iconColor: "text-white",
    accentColor: "border-l-slate-500",
  },
};

const getNotificationConfig = (type?: string) => {
  if (!type) return notificationConfig.default;

  // Check for offer_response with accepted/rejected status
  if (type === "offer_response") {
    return notificationConfig.offer_response;
  }

  return notificationConfig[type] || notificationConfig.default;
};

export const NotificationDropdown = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNotificationClick,
}: NotificationDropdownProps) => {
  const { t, dateLocale } = useI18n();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notification: NotificationItem) => {
    onMarkAsRead(notification.id);
    if (onNotificationClick && notification.route) {
      onNotificationClick(notification);
    }
  };

  const handleRescheduleAction = async (
    e: React.MouseEvent,
    notification: NotificationItem,
    action: "confirm" | "reject"
  ) => {
    e.stopPropagation();

    if (!notification.metadata) {
      toast.error(t("nav.notifications.error.noMetadata"));
      return;
    }

    const {
      appointment_id,
      customer_name,
      customer_email,
      proposed_date,
      proposed_time
    } = notification.metadata;

    if (!appointment_id || !customer_email || !proposed_date || !proposed_time) {
      toast.error(t("nav.notifications.error.incompleteData"));
      return;
    }

    setProcessingId(notification.id);

    try {
      const { data: appointment, error: fetchError } = await supabase
        .from("appointments")
        .select("*, companies(company_name)")
        .eq("id", appointment_id)
        .maybeSingle();

      if (fetchError || !appointment) {
        throw new Error(t("nav.notifications.error.appointmentNotFound"));
      }

      const companyName = (appointment.companies as { company_name: string })?.company_name || "Firma";

      const { error } = await supabase.functions.invoke("handle-reschedule-response", {
        body: {
          appointmentId: appointment_id,
          action,
          proposedDate: proposed_date,
          proposedTime: proposed_time,
          customerEmail: customer_email,
          customerName: customer_name,
          companyName,
          appointmentTitle: appointment.title,
        },
      });

      if (error) throw error;

      onMarkAsRead(notification.id);

      await supabase
        .from("notifications")
        .delete()
        .eq("id", notification.id);

      if (action === "confirm") {
        toast.success(t("nav.notifications.reschedule.confirmed"), {
          description: t("nav.notifications.reschedule.confirmedDescription", {
            date: format(new Date(proposed_date), "dd.MM.yyyy", { locale: dateLocale }),
            time: proposed_time,
          }),
        });
      } else {
        toast.info(t("nav.notifications.reschedule.rejected"), {
          description: t("nav.notifications.reschedule.rejectedDescription"),
        });
      }
    } catch (error) {
      console.error("Error handling reschedule action:", error);
      toast.error(t("nav.notifications.error.processing"), {
        description: error instanceof Error ? error.message : t("nav.notifications.error.retry"),
      });
    } finally {
      setProcessingId(null);
    }
  };

  const renderRescheduleActions = (notification: NotificationItem) => {
    if (notification.type !== "appointment_reschedule" || !notification.metadata) {
      return null;
    }

    const isProcessing = processingId === notification.id;
    const { proposed_date, proposed_time } = notification.metadata;

    return (
      <div className="mt-3 space-y-2">
        {proposed_date && proposed_time && (
          <div className="flex items-center gap-2 text-xs bg-orange-50 px-3 py-2 rounded-lg border border-orange-200">
            <Calendar className="h-3.5 w-3.5 text-orange-600" />
            <span className="font-medium text-orange-700">
              {t("nav.notifications.reschedule.proposed", {
                date: format(new Date(proposed_date), "EEEE, dd. MMMM yyyy", { locale: dateLocale }),
                time: proposed_time,
              })}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8 text-xs flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm"
            disabled={isProcessing}
            onClick={(e) => handleRescheduleAction(e, notification, "confirm")}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                {t("nav.notifications.reschedule.accept")}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            disabled={isProcessing}
            onClick={(e) => handleRescheduleAction(e, notification, "reject")}
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                {t("nav.notifications.reschedule.reject")}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`
            relative group p-2.5 rounded-xl
            bg-gradient-to-br from-slate-50 to-slate-100 
           
            border border-slate-200
            shadow-sm hover:shadow-md
            transition-all duration-300 ease-out
            hover:scale-105 active:scale-95
            ${isOpen ? 'ring-2 ring-secondary/30 shadow-md' : ''}
            ${unreadCount > 0 ? 'ring-2 ring-amber-400/30' : ''}
          `}
          aria-label={
            unreadCount > 0
              ? t("nav.notifications.new", { count: unreadCount })
              : t("nav.notifications.show")
          }
        >
          {/* Bell icon with animation */}
          <Bell className={`
            w-5 h-5 text-slate-600
            transition-all duration-300
            ${isOpen ? 'text-secondary scale-110' : 'group-hover:text-secondary'}
            ${unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}
          `} />

          {/* Notification badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center">
              {/* Ping animation */}
              <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-gradient-to-br from-rose-400 to-amber-400 opacity-50"></span>
              {/* Badge */}
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 via-rose-500 to-amber-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </span>
          )}

          {/* Subtle glow effect when has notifications */}
          {unreadCount > 0 && (
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400/10 to-rose-400/10 animate-pulse" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[420px] p-0 overflow-hidden bg-white border border-slate-200 shadow-2xl rounded-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-secondary to-secondary/80 shadow-sm">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">{t("nav.notifications")}</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-slate-500">
                    {t("nav.notifications.unread", { count: unreadCount })}
                  </p>
                )}
              </div>
            </div>
            {notifications.length > 0 && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  onClick={(e) => {
                    e.preventDefault();
                    onMarkAllAsRead();
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {t("nav.notifications.markAllReadShort")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                  aria-label={t("nav.notifications.clearAll")}
                  onClick={(e) => {
                    e.preventDefault();
                    onClearAll();
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {notifications.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">{t("nav.notifications.empty")}</p>
            <p className="text-xs text-slate-400 mt-1">{t("nav.notifications.emptyHint")}</p>
          </div>
        ) : (
          <ScrollArea className="h-[420px]">
            <div className="p-2 space-y-1">
              {notifications.map((notification, index) => {
                const config = getNotificationConfig(notification.type);
                const IconComponent = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={`
                      group relative rounded-xl overflow-hidden cursor-pointer
                      transition-all duration-200 ease-out
                      hover:scale-[1.01] hover:shadow-md
                      ${!notification.read
                        ? `bg-gradient-to-r ${config.gradient} border-l-4 ${config.accentColor}`
                        : 'bg-white hover:bg-slate-50'
                      }
                    `}
                    style={{
                      animationDelay: `${index * 50}ms`,
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="p-3.5">
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div className={`
                          shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                          ${config.iconBg} shadow-lg shadow-black/10
                          transition-transform duration-200 group-hover:scale-110
                        `}>
                          <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`
                              font-semibold text-sm leading-tight
                              ${!notification.read ? 'text-slate-900' : 'text-slate-700'}
                            `}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {notification.route && notification.type !== "appointment_reschedule" && (
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                              {!notification.read && (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75"></span>
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-secondary"></span>
                                </span>
                              )}
                            </div>
                          </div>

                          {notification.body && (
                            <p className={`
                              text-xs mt-1 line-clamp-2 leading-relaxed
                              ${!notification.read ? 'text-slate-600' : 'text-slate-500'}
                            `}>
                              {notification.body}
                            </p>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatDistanceToNow(notification.timestamp, {
                                addSuffix: true,
                                locale: dateLocale,
                              })}
                            </span>
                          </div>

                          {renderRescheduleActions(notification)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2">
            <p className="text-[11px] text-slate-400 text-center">
              {t("nav.notifications.count", { count: notifications.length })}
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
