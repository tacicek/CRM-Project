import { Toaster as Sonner } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, useLayoutEffect } from "react";
import { TrackingProvider } from "./components/TrackingProvider";

// Disable browser's automatic scroll restoration so we control it
if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

// Critical pages - loaded immediately (above the fold)
import DashIndex from "./pages/DashIndex";
import Anfrage from "./pages/Anfrage";


// Lazy load all other pages to reduce initial bundle
// Public pages
const ReinigungAnfrage = lazy(() => import("./pages/ReinigungAnfrage"));
const UmzugAnfrage = lazy(() => import("./pages/UmzugAnfrage"));
const RaeumungAnfrage = lazy(() => import("./pages/RaeumungAnfrage"));
const KlaviertransportAnfrage = lazy(() => import("./pages/KlaviertransportAnfrage"));
const MoebelliftAnfrage = lazy(() => import("./pages/MoebelliftAnfrage"));
// Entsorgung is now handled by RaeumungAnfrage (combined form)
const RenovationAnfrage = lazy(() => import("./pages/Renovation"));
const MalerarbeitAnfrage = lazy(() => import("./pages/Malerarbeit"));
const LagerungAnfrage = lazy(() => import("./pages/Lagerung"));
const SpezialTransportAnfrage = lazy(() => import("./pages/SpezialTransportAnfrage"));
const AnfrageErfolg = lazy(() => import("./pages/AnfrageErfolg"));
const LeadBestaetigen = lazy(() => import("./pages/public/LeadBestaetigen"));
const SoFunktioniertEs = lazy(() => import("./pages/SoFunktioniertEs"));
const FuerFirmen = lazy(() => import("./pages/FuerFirmen"));
const Preise = lazy(() => import("./pages/Preise"));
const AIBerater = lazy(() => import("./pages/AIBerater"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const PartnerRegistrierung = lazy(() => import("./pages/PartnerRegistrierung"));
const UmzugReinigung = lazy(() => import("./pages/UmzugReinigung"));

// Blog
const BlogList = lazy(() => import("./pages/public/BlogList"));
const BlogPost = lazy(() => import("./pages/public/BlogPost"));

// Public views
const PublicOfferView = lazy(() => import("./pages/public/OfferView"));
const AppointmentCancel = lazy(() => import("./pages/public/AppointmentCancel"));
const AppointmentReschedule = lazy(() => import("./pages/public/AppointmentReschedule"));
const RescheduleResponse = lazy(() => import("./pages/public/RescheduleResponse"));
const BesichtigungProposalResponse = lazy(() => import("./pages/public/BesichtigungProposalResponse"));
const EmbedForm = lazy(() => import("./pages/EmbedForm"));
const VirtualBesichtigung = lazy(() => import("./pages/public/VirtualBesichtigung"));

// Legal pages
const Datenschutz = lazy(() => import("./pages/legal/Datenschutz"));
const AGB = lazy(() => import("./pages/legal/AGB"));
const Impressum = lazy(() => import("./pages/legal/Impressum"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));

// SEO & Misc
const Sitemap = lazy(() => import("./pages/Sitemap"));
const RobotsTxt = lazy(() => import("./pages/RobotsTxt"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages - loaded only when admin logs in
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminLeads = lazy(() => import("./pages/admin/Leads"));
const AdminLeadVerification = lazy(() => import("./pages/admin/LeadVerification"));
const AdminCompanies = lazy(() => import("./pages/admin/Companies"));
const AdminSubscriptions = lazy(() => import("./pages/admin/Subscriptions"));
const AdminSupportTickets = lazy(() => import("./pages/admin/SupportTickets"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminTokenPackages = lazy(() => import("./pages/admin/TokenPackages"));
const AdminPricing = lazy(() => import("./pages/admin/Pricing"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const AdminForms = lazy(() => import("./pages/admin/Forms"));
const AdminEmailLogs = lazy(() => import("./pages/admin/EmailLogs"));
const AdminManualImportSubscriptions = lazy(() => import("./pages/admin/ManualImportSubscriptions"));
const AdminStatistics = lazy(() => import("./pages/admin/Statistics"));
const AdminBlogManagement = lazy(() => import("./pages/admin/BlogManagement"));
const AdminSharedContent = lazy(() => import("./pages/admin/SharedContent"));
const AdminWebsiteSettings = lazy(() => import("./pages/admin/WebsiteSettings"));
const AdminArchiveManagement = lazy(() => import("./pages/admin/ArchiveManagement"));
const AdminVapiSettings = lazy(() => import("./pages/admin/VapiSettings"));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog"));

// Firma pages - loaded only when company logs in
// Create importers for prefetching
const firmaImports = {
  Dashboard: () => import("./pages/firma/Dashboard"),
  Anfragen: () => import("./pages/firma/Anfragen"),
  Tokens: () => import("./pages/firma/Tokens"),
  Einstellungen: () => import("./pages/firma/Einstellungen"),
  Offerten: () => import("./pages/firma/Offerten"),
  OfferteErstellen: () => import("./pages/firma/OfferteErstellen"),
  OfferteDetail: () => import("./pages/firma/OfferteDetail"),
  OfferteBearbeiten: () => import("./pages/firma/OfferteBearbeiten"),
  Checkliste: () => import("./pages/firma/Checkliste"),
  Leistungskatalog: () => import("./pages/firma/Leistungskatalog"),
  Kalender: () => import("./pages/firma/Kalender"),
  Umzugsboxen: () => import("./pages/firma/Umzugsboxen"),
  Auftraege: () => import("./pages/firma/Auftraege"),
  Team: () => import("./pages/firma/Team"),
  ManualImport: () => import("./pages/firma/ManualImport"),
  Besichtigungen: () => import("./pages/firma/Besichtigungen"),
  Datenarchiv: () => import("./pages/firma/Datenarchiv"),
  CrmUpgrade: () => import("./pages/firma/CrmUpgrade"),
  Preisgestaltung: () => import("./pages/firma/Preisgestaltung"),
  Quittungen: () => import("./pages/firma/Quittungen"),
  QuittungDetail: () => import("./pages/firma/QuittungDetail"),
};

// Lazy components
const FirmaDashboard = lazy(firmaImports.Dashboard);
const FirmaAnfragen = lazy(firmaImports.Anfragen);
const FirmaTokens = lazy(firmaImports.Tokens);
const FirmaEinstellungen = lazy(firmaImports.Einstellungen);
const FirmaOfferten = lazy(firmaImports.Offerten);
const FirmaOfferteErstellen = lazy(firmaImports.OfferteErstellen);
const FirmaOfferteDetail = lazy(firmaImports.OfferteDetail);
const FirmaOfferteBearbeiten = lazy(firmaImports.OfferteBearbeiten);
const FirmaCheckliste = lazy(firmaImports.Checkliste);
const FirmaLeistungskatalog = lazy(firmaImports.Leistungskatalog);
const FirmaKalender = lazy(firmaImports.Kalender);
const FirmaUmzugsboxen = lazy(firmaImports.Umzugsboxen);
const FirmaAuftraege = lazy(firmaImports.Auftraege);
const FirmaTeam = lazy(firmaImports.Team);
const FirmaManualImport = lazy(firmaImports.ManualImport);
const FirmaBesichtigungen = lazy(firmaImports.Besichtigungen);
const FirmaDatenarchiv = lazy(firmaImports.Datenarchiv);
const FirmaCrmUpgrade = lazy(firmaImports.CrmUpgrade);
const FirmaPreisgestaltung = lazy(firmaImports.Preisgestaltung);
const FirmaQuittungen = lazy(firmaImports.Quittungen);
const FirmaQuittungDetail = lazy(firmaImports.QuittungDetail);

// Export for prefetching in FirmaLayout
export { firmaImports };

// CRM route guard (not lazy – small component, needed immediately on CRM routes)
import CrmGuard from "./components/firma/CrmGuard";

// Lazy load non-critical components
const CookieBanner = lazy(() => import("./components/CookieBanner"));

const queryClient = new QueryClient();

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="offerio-theme">
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <Suspense fallback={null}>
            <CookieBanner />
          </Suspense>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ScrollToTop />
            <TrackingProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Critical routes - no lazy loading */}
                  <Route path="/" element={<DashIndex />} />
                  <Route path="/anfrage" element={<Anfrage />} />

                  {/* Public Anfrage routes */}
                  <Route path="/anfrage/reinigung" element={<ReinigungAnfrage />} />
                  <Route path="/anfrage/umzug" element={<UmzugAnfrage />} />
                  <Route path="/anfrage/raeumung" element={<RaeumungAnfrage />} />
                  <Route path="/anfrage/klaviertransport" element={<KlaviertransportAnfrage />} />
                  <Route path="/anfrage/moebellift" element={<MoebelliftAnfrage />} />
                  <Route path="/anfrage/entsorgung" element={<RaeumungAnfrage />} />
                  <Route path="/anfrage/renovation" element={<RenovationAnfrage />} />
                  <Route path="/anfrage/malerarbeiten" element={<MalerarbeitAnfrage />} />
                  <Route path="/anfrage/lagerung" element={<LagerungAnfrage />} />
                  <Route path="/anfrage/spezialtransport" element={<SpezialTransportAnfrage />} />
                  <Route path="/anfrage/erfolg" element={<AnfrageErfolg />} />
                  <Route path="/lead-bestaetigen/:token" element={<LeadBestaetigen />} />

                  {/* Public info pages */}
                  <Route path="/so-funktioniert-es" element={<SoFunktioniertEs />} />
                  <Route path="/fuer-firmen" element={<FuerFirmen />} />
                  <Route path="/preise" element={<Preise />} />
                  <Route path="/ai-berater" element={<AIBerater />} />

                  {/* Auth */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/partner-werden" element={<PartnerRegistrierung />} />
                  <Route path="/umzug-reinigung" element={<UmzugReinigung />} />

                  {/* Embed & Public views */}
                  <Route path="/embed/:slug" element={<EmbedForm />} />
                  <Route path="/offerte/:token" element={<PublicOfferView />} />
                  <Route path="/blog" element={<BlogList />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/ratgeber" element={<BlogList />} />
                  <Route path="/ratgeber/:slug" element={<BlogPost />} />
                  <Route path="/termin/:appointmentId/absagen" element={<AppointmentCancel />} />
                  <Route path="/termin/:appointmentId/verschieben" element={<AppointmentReschedule />} />
                  <Route path="/termin/:appointmentId/antwort" element={<RescheduleResponse />} />
                  <Route path="/besichtigung/:leadId/antwort" element={<BesichtigungProposalResponse />} />
                  <Route path="/besichtigung/:token" element={<VirtualBesichtigung />} />

                  {/* Legal Pages */}
                  <Route path="/datenschutz" element={<Datenschutz />} />
                  <Route path="/agb" element={<AGB />} />
                  <Route path="/impressum" element={<Impressum />} />
                  <Route path="/cookies" element={<Cookies />} />

                  {/* SEO Pages */}
                  <Route path="/sitemap.xml" element={<Sitemap />} />
                  <Route path="/robots.txt" element={<RobotsTxt />} />

                  {/* Admin Routes - lazy loaded */}
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/leads" element={<AdminLeads />} />
                  <Route path="/admin/verification" element={<AdminLeadVerification />} />
                  <Route path="/admin/companies" element={<AdminCompanies />} />
                  <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
                  <Route path="/admin/support" element={<AdminSupportTickets />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/token-packages" element={<AdminTokenPackages />} />
                  <Route path="/admin/pricing" element={<AdminPricing />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/forms" element={<AdminForms />} />
                  <Route path="/admin/email-logs" element={<AdminEmailLogs />} />
                  <Route path="/admin/manual-import" element={<AdminManualImportSubscriptions />} />
                  <Route path="/admin/statistics" element={<AdminStatistics />} />
                  <Route path="/admin/blog" element={<AdminBlogManagement />} />
                  <Route path="/admin/webseite/settings" element={<AdminWebsiteSettings />} />
                  <Route path="/admin/webseite/shared-content" element={<AdminSharedContent />} />
                  <Route path="/admin/archive" element={<AdminArchiveManagement />} />
                  <Route path="/admin/vapi" element={<AdminVapiSettings />} />
                  <Route path="/admin/audit-log" element={<AdminAuditLog />} />

                  {/* Firma Routes - lazy loaded, wrapped in ErrorBoundary */}
                  <Route path="/firma" element={<ErrorBoundary><FirmaDashboard /></ErrorBoundary>} />
                  <Route path="/firma/anfragen" element={<ErrorBoundary><FirmaAnfragen /></ErrorBoundary>} />
                  <Route path="/firma/tokens" element={<ErrorBoundary><FirmaTokens /></ErrorBoundary>} />
                  <Route path="/firma/einstellungen" element={<ErrorBoundary><FirmaEinstellungen /></ErrorBoundary>} />
                  {/* CRM-only routes — redirect to /firma/crm-upgrade if not subscribed */}
                  <Route path="/firma/quittungen" element={<ErrorBoundary><CrmGuard><FirmaQuittungen /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/quittungen/neu" element={<ErrorBoundary><CrmGuard><FirmaQuittungDetail /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/quittungen/:id" element={<ErrorBoundary><CrmGuard><FirmaQuittungDetail /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/quittungen/:id/bearbeiten" element={<ErrorBoundary><CrmGuard><FirmaQuittungDetail /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/offerten" element={<ErrorBoundary><CrmGuard><FirmaOfferten /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/offerten/neu" element={<ErrorBoundary><CrmGuard><FirmaOfferteErstellen /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/offerten/:id" element={<ErrorBoundary><CrmGuard><FirmaOfferteDetail /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/offerte-bearbeiten/:offerId" element={<ErrorBoundary><CrmGuard><FirmaOfferteBearbeiten /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/checkliste" element={<ErrorBoundary><CrmGuard><FirmaCheckliste /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/leistungskatalog" element={<ErrorBoundary><CrmGuard><FirmaLeistungskatalog /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/kalender" element={<ErrorBoundary><CrmGuard><FirmaKalender /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/umzugsboxen" element={<ErrorBoundary><CrmGuard><FirmaUmzugsboxen /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/auftraege" element={<ErrorBoundary><CrmGuard><FirmaAuftraege /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/team" element={<ErrorBoundary><CrmGuard><FirmaTeam /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/besichtigungen" element={<ErrorBoundary><CrmGuard><FirmaBesichtigungen /></CrmGuard></ErrorBoundary>} />
                  <Route path="/firma/preisgestaltung" element={<ErrorBoundary><CrmGuard><FirmaPreisgestaltung /></CrmGuard></ErrorBoundary>} />
                  {/* Non-CRM routes */}
                  <Route path="/firma/manual-import" element={<ErrorBoundary><FirmaManualImport /></ErrorBoundary>} />
                  <Route path="/firma/datenarchiv" element={<ErrorBoundary><FirmaDatenarchiv /></ErrorBoundary>} />
                  <Route path="/firma/crm-upgrade" element={<ErrorBoundary><FirmaCrmUpgrade /></ErrorBoundary>} />

                  {/* Catch-all 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </TrackingProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
  </ThemeProvider>
);

export default App;
