import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Calendar, ExternalLink, Smartphone, Copy, Check } from "lucide-react";
import {
  CalendarEvent,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateOffice365CalendarUrl,
  generateYahooCalendarUrl,
  downloadIcsFile,
  openCalendarUrl,
  generateIcsContent,
} from "@/lib/calendarSync";
import { useT, useI18n } from "@/i18n/useI18n";
import { formatDateLong } from "@/i18n/format";
import { format } from "date-fns";
import { toast } from "sonner";

// Calendar provider icons as SVG components
const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const OutlookIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
    <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.152-.353.228-.584.228h-8.234v-6.182l1.602 1.142a.353.353 0 0 0 .206.07.353.353 0 0 0 .206-.07l6.813-4.894a.62.62 0 0 0 .23-.258V7.387z" fill="#0072C6"/>
    <path d="M15.072 8.203l-.102.072-5.024 3.614-.073.043a.377.377 0 0 1-.206.06.377.377 0 0 1-.206-.06l-.073-.043-5.024-3.614-.102-.072H15.072z" fill="#0072C6"/>
    <path d="M24 6.333a.817.817 0 0 0-.82-.82h-8.236v.874h8.056v.332L16.187 11l-1.243-.895v1.086l1.156.831a.353.353 0 0 0 .206.07.353.353 0 0 0 .206-.07l6.813-4.894a.62.62 0 0 0 .176-.203.62.62 0 0 0 .055-.258V6.333z" fill="#0072C6"/>
    <path d="M9.667 5.512H.82a.817.817 0 0 0-.82.82v11.338c0 .23.08.424.238.576.158.152.353.228.584.228h8.845V5.512z" fill="#0072C6"/>
    <path d="M7.15 15.462c-.685 0-1.239-.322-1.664-.967-.425-.645-.637-1.47-.637-2.477 0-1.055.22-1.912.66-2.573.44-.66 1.01-.99 1.709-.99.706 0 1.264.322 1.673.967.409.645.613 1.493.613 2.545 0 1.047-.21 1.893-.632 2.538-.421.645-.99.968-1.722.968zm.068-5.688c-.345 0-.625.21-.84.632-.215.421-.322 1.01-.322 1.766 0 .744.105 1.33.314 1.756.21.426.49.64.843.64.357 0 .638-.203.843-.61.205-.407.308-.994.308-1.76 0-.78-.104-1.378-.312-1.795-.208-.418-.492-.627-.852-.627z" fill="#fff"/>
  </svg>
);

const YahooIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#6001d2">
    <path d="M10.816 8.338l1.682 4.146 1.627-4.146h3.2l-3.254 7.43.017.024L17.07 24h-3.2l-2.907-7.125L7.93 24H4.73l2.982-8.064.017-.024-3.254-7.43h3.2l1.627 4.146L10.816 8.338zM13.068 0l4.286 6.36h-3.455l-2.664-4.28L8.57 6.36H5.114L9.4 0h3.668z"/>
  </svg>
);

interface CalendarExportMenuProps {
  event: CalendarEvent;
  triggerClassName?: string;
  showLabel?: boolean;
}

export function CalendarExportMenu({ event, triggerClassName, showLabel = true }: CalendarExportMenuProps) {
  const t = useT();
  const { locale, dateLocale } = useI18n();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGoogleCalendar = () => {
    openCalendarUrl(generateGoogleCalendarUrl(event));
  };

  const handleOutlookCalendar = () => {
    openCalendarUrl(generateOutlookCalendarUrl(event));
  };

  const handleOffice365Calendar = () => {
    openCalendarUrl(generateOffice365CalendarUrl(event));
  };

  const handleYahooCalendar = () => {
    openCalendarUrl(generateYahooCalendarUrl(event));
  };

  const handleAppleCalendar = () => {
    downloadIcsFile(event);
    toast.success(t("calendar.export.toast.appleDownloaded"));
  };

  const handleDownloadIcs = () => {
    downloadIcsFile(event);
    toast.success(t("calendar.export.toast.downloaded"));
  };

  const handleCopyIcs = async () => {
    try {
      const icsContent = generateIcsContent(event);
      await navigator.clipboard.writeText(icsContent);
      setCopied(true);
      toast.success(t("calendar.export.toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("calendar.export.toast.copyFailed"));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={triggerClassName}>
            <Calendar className="w-4 h-4 mr-2" />
            {showLabel && t("calendar.export.trigger")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("calendar.export.menuLabel")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Google Calendar */}
          <DropdownMenuItem onClick={handleGoogleCalendar} className="cursor-pointer">
            <GoogleIcon />
            <span className="ml-2">Google Calendar</span>
            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
          </DropdownMenuItem>
          
          {/* Apple Calendar */}
          <DropdownMenuItem onClick={handleAppleCalendar} className="cursor-pointer">
            <AppleIcon />
            <span className="ml-2">{t("calendar.export.apple")}</span>
            <Download className="w-3 h-3 ml-auto text-muted-foreground" />
          </DropdownMenuItem>
          
          {/* Outlook.com */}
          <DropdownMenuItem onClick={handleOutlookCalendar} className="cursor-pointer">
            <OutlookIcon />
            <span className="ml-2">Outlook.com</span>
            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
          </DropdownMenuItem>
          
          {/* Office 365 */}
          <DropdownMenuItem onClick={handleOffice365Calendar} className="cursor-pointer">
            <OutlookIcon />
            <span className="ml-2">Office 365</span>
            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
          </DropdownMenuItem>
          
          {/* Yahoo */}
          <DropdownMenuItem onClick={handleYahooCalendar} className="cursor-pointer">
            <YahooIcon />
            <span className="ml-2">{t("calendar.export.yahoo")}</span>
            <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* Download ICS */}
          <DropdownMenuItem onClick={handleDownloadIcs} className="cursor-pointer">
            <Download className="w-4 h-4" />
            <span className="ml-2">{t("calendar.export.downloadIcs")}</span>
          </DropdownMenuItem>
          
          {/* Copy ICS */}
          <DropdownMenuItem onClick={handleCopyIcs} className="cursor-pointer">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            <span className="ml-2">{copied ? t("calendar.export.copied") : t("calendar.export.copyIcs")}</span>
          </DropdownMenuItem>
          
          {/* Mobile QR Code */}
          <DropdownMenuItem onClick={() => setQrDialogOpen(true)} className="cursor-pointer">
            <Smartphone className="w-4 h-4" />
            <span className="ml-2">{t("calendar.export.mobile")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* QR Code Dialog for Mobile */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("calendar.export.qr.title")}</DialogTitle>
            <DialogDescription>
              {t("calendar.export.qr.description")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">{event.title}</p>
              <p className="text-sm text-muted-foreground">
                {`${format(event.startDate, "EEEE", { locale: dateLocale })}, ${formatDateLong(event.startDate, locale)}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {event.allDay
                  ? t("calendar.export.allDay")
                  : t("calendar.detail.timeRange", {
                      start: format(event.startDate, "HH:mm"),
                      end: format(event.endDate, "HH:mm"),
                    })
                }
              </p>
              {event.location && (
                <p className="text-sm text-muted-foreground">📍 {event.location}</p>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              <Button onClick={handleDownloadIcs} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                {t("calendar.export.qr.download")}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                {t("calendar.export.qr.hint")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

