import { Toaster as Sonner } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { CompanyProvider } from "@/hooks/useCompanyContext";
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
  Anfragen: () => import("./pages/firma/Anfragen"),
  Besichtigungen: () => import("./pages/firma/Besichtigungen"),
  Datenarchiv: () => import("./pages/firma/Datenarchiv"),
  Preisgestaltung: () => import("./pages/firma/Preisgestaltung"),
  Quittungen: () => import("./pages/firma/Quittungen"),
  QuittungDetail: () => import("./pages/firma/QuittungDetail"),
};

const FirmaDashboard = lazy(firmaImports.Dashboard);
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
const FirmaAnfragen = lazy(firmaImports.Anfragen);
const FirmaBesichtigungen = lazy(firmaImports.Besichtigungen);
const FirmaDatenarchiv = lazy(firmaImports.Datenarchiv);
const FirmaPreisgestaltung = lazy(firmaImports.Preisgestaltung);
const FirmaQuittungen = lazy(firmaImports.Quittungen);
const FirmaQuittungDetail = lazy(firmaImports.QuittungDetail);

// Layout wrapper
const FirmaLayout = lazy(() => import("./components/firma/FirmaLayout"));

const FirmaRouteWrapper = () => (
  <CompanyProvider>
    <FirmaLayout>
      <Outlet />
    </FirmaLayout>
  </CompanyProvider>
);

export { firmaImports };

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
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

                {/* Public shareable views */}
                <Route path="/offerte/:token" element={<PublicOfferView />} />
                <Route path="/termin/:appointmentId/absagen" element={<AppointmentCancel />} />
                <Route path="/termin/:appointmentId/verschieben" element={<AppointmentReschedule />} />
                <Route path="/termin/:appointmentId/antwort" element={<RescheduleResponse />} />
                <Route path="/besichtigung/:leadId/antwort" element={<BesichtigungProposalResponse />} />
                <Route path="/besichtigung/:token" element={<VirtualBesichtigung />} />

                {/* Firma (CRM) Routes — CompanyProvider + FirmaLayout wrapper */}
                <Route element={<ErrorBoundary><FirmaRouteWrapper /></ErrorBoundary>}>
                  <Route path="/firma" element={<FirmaDashboard />} />
                  <Route path="/firma/einstellungen" element={<FirmaEinstellungen />} />
                  <Route path="/firma/offerten" element={<FirmaOfferten />} />
                  <Route path="/firma/offerten/neu" element={<FirmaOfferteErstellen />} />
                  <Route path="/firma/offerten/:id" element={<FirmaOfferteDetail />} />
                  <Route path="/firma/offerte-bearbeiten/:offerId" element={<FirmaOfferteBearbeiten />} />
                  <Route path="/firma/quittungen" element={<FirmaQuittungen />} />
                  <Route path="/firma/quittungen/neu" element={<FirmaQuittungDetail />} />
                  <Route path="/firma/quittungen/:id" element={<FirmaQuittungDetail />} />
                  <Route path="/firma/quittungen/:id/bearbeiten" element={<FirmaQuittungDetail />} />
                  <Route path="/firma/kalender" element={<FirmaKalender />} />
                  <Route path="/firma/auftraege" element={<FirmaAuftraege />} />
                  <Route path="/firma/besichtigungen" element={<FirmaBesichtigungen />} />
                  <Route path="/firma/umzugsboxen" element={<FirmaUmzugsboxen />} />
                  <Route path="/firma/team" element={<FirmaTeam />} />
                  <Route path="/firma/checkliste" element={<FirmaCheckliste />} />
                  <Route path="/firma/leistungskatalog" element={<FirmaLeistungskatalog />} />
                  <Route path="/firma/preisgestaltung" element={<FirmaPreisgestaltung />} />
                  <Route path="/firma/manual-import" element={<FirmaManualImport />} />
                  <Route path="/firma/anfragen" element={<FirmaAnfragen />} />
                  <Route path="/firma/datenarchiv" element={<FirmaDatenarchiv />} />
                </Route>

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;