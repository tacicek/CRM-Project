import { Toaster as Sonner } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, useLayoutEffect } from "react";

// CRM-FORK: removed TrackingProvider, CookieBanner — portal-only features

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

// Auth
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Public views kept (shareable offer link, appointment actions)
const PublicOfferView = lazy(() => import("./pages/public/OfferView"));
const AppointmentCancel = lazy(() => import("./pages/public/AppointmentCancel"));
const AppointmentReschedule = lazy(() => import("./pages/public/AppointmentReschedule"));
const RescheduleResponse = lazy(() => import("./pages/public/RescheduleResponse"));
const BesichtigungProposalResponse = lazy(() => import("./pages/public/BesichtigungProposalResponse"));
const VirtualBesichtigung = lazy(() => import("./pages/public/VirtualBesichtigung"));

const NotFound = lazy(() => import("./pages/NotFound"));

// Firma (CRM) pages
const firmaImports = {
  Dashboard: () => import("./pages/firma/Dashboard"),
  Anfragen: () => import("./pages/firma/Anfragen"),
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
  // CRM-FORK: removed CrmUpgrade, Tokens (portal/marketplace pages)
  Preisgestaltung: () => import("./pages/firma/Preisgestaltung"),
  Quittungen: () => import("./pages/firma/Quittungen"),
  QuittungDetail: () => import("./pages/firma/QuittungDetail"),
};

const FirmaDashboard = lazy(firmaImports.Dashboard);
const FirmaAnfragen = lazy(firmaImports.Anfragen);
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
const FirmaPreisgestaltung = lazy(firmaImports.Preisgestaltung);
const FirmaQuittungen = lazy(firmaImports.Quittungen);
const FirmaQuittungDetail = lazy(firmaImports.QuittungDetail);

export { firmaImports };

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="crm-theme">
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Root → redirect to CRM dashboard */}
                <Route path="/" element={<Navigate to="/firma" replace />} />

                {/* Auth */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />

                {/* Public shareable views (offer link, appointment actions, virtual tour) */}
                <Route path="/offerte/:token" element={<PublicOfferView />} />
                <Route path="/termin/:appointmentId/absagen" element={<AppointmentCancel />} />
                <Route path="/termin/:appointmentId/verschieben" element={<AppointmentReschedule />} />
                <Route path="/termin/:appointmentId/antwort" element={<RescheduleResponse />} />
                <Route path="/besichtigung/:leadId/antwort" element={<BesichtigungProposalResponse />} />
                <Route path="/besichtigung/:token" element={<VirtualBesichtigung />} />

                {/* Firma (CRM) Routes */}
                <Route path="/firma" element={<ErrorBoundary><FirmaDashboard /></ErrorBoundary>} />
                <Route path="/firma/anfragen" element={<ErrorBoundary><FirmaAnfragen /></ErrorBoundary>} />
                <Route path="/firma/einstellungen" element={<ErrorBoundary><FirmaEinstellungen /></ErrorBoundary>} />
                <Route path="/firma/offerten" element={<ErrorBoundary><FirmaOfferten /></ErrorBoundary>} />
                <Route path="/firma/offerten/neu" element={<ErrorBoundary><FirmaOfferteErstellen /></ErrorBoundary>} />
                <Route path="/firma/offerten/:id" element={<ErrorBoundary><FirmaOfferteDetail /></ErrorBoundary>} />
                <Route path="/firma/offerte-bearbeiten/:offerId" element={<ErrorBoundary><FirmaOfferteBearbeiten /></ErrorBoundary>} />
                <Route path="/firma/quittungen" element={<ErrorBoundary><FirmaQuittungen /></ErrorBoundary>} />
                <Route path="/firma/quittungen/neu" element={<ErrorBoundary><FirmaQuittungDetail /></ErrorBoundary>} />
                <Route path="/firma/quittungen/:id" element={<ErrorBoundary><FirmaQuittungDetail /></ErrorBoundary>} />
                <Route path="/firma/quittungen/:id/bearbeiten" element={<ErrorBoundary><FirmaQuittungDetail /></ErrorBoundary>} />
                <Route path="/firma/kalender" element={<ErrorBoundary><FirmaKalender /></ErrorBoundary>} />
                <Route path="/firma/auftraege" element={<ErrorBoundary><FirmaAuftraege /></ErrorBoundary>} />
                <Route path="/firma/besichtigungen" element={<ErrorBoundary><FirmaBesichtigungen /></ErrorBoundary>} />
                <Route path="/firma/umzugsboxen" element={<ErrorBoundary><FirmaUmzugsboxen /></ErrorBoundary>} />
                <Route path="/firma/team" element={<ErrorBoundary><FirmaTeam /></ErrorBoundary>} />
                <Route path="/firma/checkliste" element={<ErrorBoundary><FirmaCheckliste /></ErrorBoundary>} />
                <Route path="/firma/leistungskatalog" element={<ErrorBoundary><FirmaLeistungskatalog /></ErrorBoundary>} />
                <Route path="/firma/preisgestaltung" element={<ErrorBoundary><FirmaPreisgestaltung /></ErrorBoundary>} />
                <Route path="/firma/manual-import" element={<ErrorBoundary><FirmaManualImport /></ErrorBoundary>} />
                <Route path="/firma/datenarchiv" element={<ErrorBoundary><FirmaDatenarchiv /></ErrorBoundary>} />

                {/* CRM-FORK: removed /admin/*, /anfrage/*, public marketing pages, token pages */}
                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
  </ThemeProvider>
);

export default App;
