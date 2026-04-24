import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bug,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Building2,
  MapPin,
  Search,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getServiceLabel } from "@/lib/serviceLabels";

interface LeadDistributionDebugProps {
  leadId: string;
  serviceType: string;
  fromPlz: string;
  fromCity: string;
}

interface CompanyDebugInfo {
  id: string;
  company_name: string;
  email: string;
  notification_email: string | null;
  is_active: boolean;
  is_verified: boolean;
  has_service: boolean;
  service_is_active: boolean;
  has_plz_coverage: boolean;
  plz_coverage_is_active: boolean;
  coverage_plz: string | null;
  coverage_radius_km: number | null;
  distance_km: number | null;
  matched: boolean;
  reason: string;
}

interface Distribution {
  id: string;
  company_id: string;
  status: string;
  company_name: string;
  email: string;
}

const LeadDistributionDebug = ({ leadId, serviceType, fromPlz, fromCity }: LeadDistributionDebugProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState<CompanyDebugInfo[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<CompanyDebugInfo[]>([]);

  const fetchDebugInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all existing distributions for this lead
      const { data: distData, error: distError } = await supabase
        .from("lead_distributions")
        .select(`
          id,
          company_id,
          status,
          companies:company_id (
            company_name,
            email
          )
        `)
        .eq("lead_id", leadId);

      if (distError) throw distError;

      const distributionList = (distData || []).map((d) => ({
        id: d.id,
        company_id: d.company_id,
        status: d.status,
        company_name: (d.companies as { company_name: string; email: string })?.company_name || "Unknown",
        email: (d.companies as { company_name: string; email: string })?.email || "Unknown",
      }));
      setDistributions(distributionList);

      // 2. Check all companies with the required service type
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select(`
          id,
          company_name,
          email,
          notification_email,
          is_active,
          is_verified,
          company_services!inner (
            service_type,
            is_active
          ),
          company_plz_coverage (
            plz,
            radius_km,
            is_active
          )
        `)
        .eq("company_services.service_type", serviceType);

      if (companiesError) throw companiesError;

      // 3. Analyze each company
      const debugInfoList: CompanyDebugInfo[] = [];

      for (const company of companiesData || []) {
        const services = company.company_services as { service_type: string; is_active: boolean }[] || [];
        const coverages = company.company_plz_coverage as { plz: string; radius_km: number | null; is_active: boolean }[] || [];

        const hasService = services.some(s => s.service_type === serviceType);
        const serviceIsActive = services.some(s => s.service_type === serviceType && s.is_active);

        // Check PLZ coverage
        let hasPlzCoverage = false;
        let plzCoverageIsActive = false;
        let coveragePlz: string | null = null;
        let coverageRadiusKm: number | null = null;
        let distanceKm: number | null = null;

        // Check for exact PLZ match or radius coverage
        for (const coverage of coverages) {
          if (coverage.plz === fromPlz) {
            hasPlzCoverage = true;
            plzCoverageIsActive = coverage.is_active;
            coveragePlz = coverage.plz;
            coverageRadiusKm = coverage.radius_km;
            distanceKm = 0;
            break;
          }
          // TODO: Calculate distance for radius check (would need swiss_plz table)
        }

        // If no exact match, check if any coverage with radius might apply
        if (!hasPlzCoverage && coverages.length > 0) {
          const activeCoverages = coverages.filter(c => c.is_active && c.radius_km && c.radius_km > 0);
          if (activeCoverages.length > 0) {
            hasPlzCoverage = true;
            plzCoverageIsActive = true;
            coveragePlz = activeCoverages[0].plz;
            coverageRadiusKm = activeCoverages[0].radius_km;
            // Note: We'd need to calculate actual distance to know if it's within radius
          }
        }

        // Determine if matched
        const wasDistributed = distributionList.some(d => d.company_id === company.id);
        const matched = company.is_active && company.is_verified && serviceIsActive && plzCoverageIsActive;

        // Build reason
        let reason = "";
        if (!company.is_active) reason = "Firma nicht aktiv";
        else if (!company.is_verified) reason = "Firma nicht verifiziert";
        else if (!hasService) reason = `Service "${serviceType}" nicht vorhanden`;
        else if (!serviceIsActive) reason = `Service "${serviceType}" nicht aktiv`;
        else if (!hasPlzCoverage) reason = `Keine PLZ-Abdeckung für ${fromPlz}`;
        else if (!plzCoverageIsActive) reason = `PLZ-Abdeckung für ${fromPlz} nicht aktiv`;
        else if (matched && !wasDistributed) reason = "Sollte gematcht sein, aber nicht verteilt";
        else if (matched && wasDistributed) reason = "✓ Erfolgreich verteilt";
        else reason = "Unbekannt";

        debugInfoList.push({
          id: company.id,
          company_name: company.company_name,
          email: company.email,
          notification_email: company.notification_email,
          is_active: company.is_active,
          is_verified: company.is_verified,
          has_service: hasService,
          service_is_active: serviceIsActive,
          has_plz_coverage: hasPlzCoverage,
          plz_coverage_is_active: plzCoverageIsActive,
          coverage_plz: coveragePlz,
          coverage_radius_km: coverageRadiusKm,
          distance_km: distanceKm,
          matched,
          reason,
        });
      }

      setCompanies(debugInfoList);
    } catch (error) {
      console.error("Error fetching debug info:", error);
    } finally {
      setIsLoading(false);
    }
  }, [leadId, serviceType, fromPlz]);

  useEffect(() => {
    if (open) {
      fetchDebugInfo();
    }
     
  }, [open, fetchDebugInfo]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          id,
          company_name,
          email,
          notification_email,
          is_active,
          is_verified,
          company_services (
            service_type,
            is_active
          ),
          company_plz_coverage (
            plz,
            radius_km,
            is_active
          )
        `)
        .ilike("email", `%${searchEmail.trim()}%`);

      if (error) throw error;

      const results: CompanyDebugInfo[] = (data || []).map(company => {
        const services = company.company_services as { service_type: string; is_active: boolean }[] || [];
        const coverages = company.company_plz_coverage as { plz: string; radius_km: number | null; is_active: boolean }[] || [];

        const hasService = services.some(s => s.service_type === serviceType);
        const serviceIsActive = services.some(s => s.service_type === serviceType && s.is_active);
        const hasPlzCoverage = coverages.some(c => c.plz === fromPlz);
        const plzCoverageIsActive = coverages.some(c => c.plz === fromPlz && c.is_active);

        let reason = "";
        if (!company.is_active) reason = "Firma nicht aktiv";
        else if (!company.is_verified) reason = "Firma nicht verifiziert";
        else if (!hasService) reason = `Service "${getServiceLabel(serviceType)}" nicht vorhanden`;
        else if (!serviceIsActive) reason = `Service "${getServiceLabel(serviceType)}" nicht aktiv`;
        else if (!hasPlzCoverage) reason = `Keine PLZ-Abdeckung für ${fromPlz}`;
        else if (!plzCoverageIsActive) reason = `PLZ-Abdeckung für ${fromPlz} nicht aktiv`;
        else reason = "✓ Sollte matchen";

        return {
          id: company.id,
          company_name: company.company_name,
          email: company.email,
          notification_email: company.notification_email,
          is_active: company.is_active,
          is_verified: company.is_verified,
          has_service: hasService,
          service_is_active: serviceIsActive,
          has_plz_coverage: hasPlzCoverage,
          plz_coverage_is_active: plzCoverageIsActive,
          coverage_plz: coverages.find(c => c.plz === fromPlz)?.plz || null,
          coverage_radius_km: coverages.find(c => c.plz === fromPlz)?.radius_km || null,
          distance_km: null,
          matched: company.is_active && company.is_verified && serviceIsActive && plzCoverageIsActive,
          reason,
        };
      });

      setSearchResults(results);
    } catch (error) {
      console.error("Error searching company:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const renderCompanyCard = (company: CompanyDebugInfo) => (
    <Card key={company.id} className={`${company.matched ? "border-green-500/30 bg-green-50/30 dark:bg-green-900/10" : "border-red-500/30 bg-red-50/30 dark:bg-red-900/10"}`}>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {company.company_name}
          </div>
          {company.matched ? (
            <Badge className="bg-green-500">Match</Badge>
          ) : (
            <Badge variant="destructive">Kein Match</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2 space-y-3">
        <div className="text-sm text-muted-foreground">{company.email}</div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            {getStatusIcon(company.is_active)}
            <span>Aktiv</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(company.is_verified)}
            <span>Verifiziert</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(company.service_is_active)}
            <span>Service: {getServiceLabel(serviceType)}</span>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(company.plz_coverage_is_active)}
            <span>PLZ: {fromPlz}</span>
          </div>
        </div>

        {company.coverage_plz && (
          <div className="text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 inline mr-1" />
            Abdeckung: {company.coverage_plz} 
            {company.coverage_radius_km ? ` (+${company.coverage_radius_km}km)` : ""}
          </div>
        )}

        <div className={`text-sm font-medium ${company.matched ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          <AlertTriangle className="w-3 h-3 inline mr-1" />
          {company.reason}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bug className="w-4 h-4" />
          Debug
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5" />
            Lead Distribution Debug
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead Info */}
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <Badge className="ml-2">{getServiceLabel(serviceType)}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">PLZ:</span>
                  <span className="ml-2 font-medium">{fromPlz}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Stadt:</span>
                  <span className="ml-2 font-medium">{fromCity}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Company by Email */}
          <div className="space-y-2">
            <Label>Firma nach E-Mail suchen</Label>
            <div className="flex gap-2">
              <Input
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="z.B. info@designx.ch"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="w-4 h-4 mr-2" />
                Suchen
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Suchergebnisse</h3>
              <div className="space-y-2">
                {searchResults.map(renderCompanyCard)}
              </div>
            </div>
          )}

          <Separator />

          {/* Distributions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Verteilte Firmen ({distributions.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={fetchDebugInfo} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : distributions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Keine Verteilungen gefunden
              </div>
            ) : (
              <div className="space-y-2">
                {distributions.map((dist) => (
                  <div key={dist.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <div className="font-medium">{dist.company_name}</div>
                      <div className="text-sm text-muted-foreground">{dist.email}</div>
                    </div>
                    <Badge variant={dist.status === "accepted" ? "default" : dist.status === "sent" ? "secondary" : "outline"}>
                      {dist.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* All Matching Companies Analysis */}
          <div>
            <h3 className="font-semibold mb-2">
              Firmen mit Service "{getServiceLabel(serviceType)}" ({companies.length})
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Keine Firmen mit diesem Service gefunden
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {companies.map(renderCompanyCard)}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDistributionDebug;

