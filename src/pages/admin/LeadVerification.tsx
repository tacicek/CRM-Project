/**
 * Lead Verification Page
 *
 * Admin page for reviewing, verifying, and rejecting incoming leads
 * before they are distributed to matching companies.
 *
 * Refactored: Logic extracted to useLeadVerification hook, UI split into sub-components.
 * Previous: ~2329 lines -> Current: ~200 lines
 */

import { Helmet } from "react-helmet-async";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, RefreshCw, Clock, CheckCircle, XCircle, Loader2, X, AlertCircle, Mail, AlertTriangle } from "lucide-react";

// Shared leads modules
import { useLeadVerification } from "@/components/admin/leads/useLeadVerification";
import { LeadStatCards } from "@/components/admin/leads/LeadStatCards";
import { LeadFilters } from "@/components/admin/leads/LeadFilters";
import { LeadBulkActionsBar, BulkVerifyDialog, BulkRejectDialog } from "@/components/admin/leads/LeadBulkActions";
import { LeadListItem } from "@/components/admin/leads/LeadListItem";
import { LeadDetailDialog } from "@/components/admin/leads/LeadDetailDialog";
import { LeadBlacklistDialog } from "@/components/admin/leads/LeadBlacklistDialog";
import { LeadPaginationHeader, LeadPaginationFooter } from "@/components/admin/leads/LeadPagination";

const LeadVerification = () => {
  const hook = useLeadVerification();

  return (
    <>
      <Helmet>
        <title>Lead-Verifizierung | Admin</title>
      </Helmet>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-secondary shrink-0" />
                Lead-Verifizierung
              </h2>
              <p className="text-muted-foreground text-sm">
                Überprüfen Sie Anfragen vor der Verteilung an Firmen
              </p>
            </div>
            <Button variant="outline" onClick={() => hook.fetchLeads()} disabled={hook.isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`w-4 h-4 mr-2 ${hook.isLoading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>

          {/* Statistics Cards */}
          <LeadStatCards
            pendingCount={hook.pendingCount}
            verifiedCount={hook.verifiedCount}
            rejectedCount={hook.rejectedCount}
            noMatchCount={hook.noMatchCount}
            autoVerifiedCount={hook.autoVerifiedCount}
            manualVerifiedCount={hook.manualVerifiedCount}
            onTabChange={hook.setActiveTab}
          />

          {/* Filters and Search */}
          <LeadFilters
            searchQuery={hook.searchQuery}
            onSearchChange={hook.setSearchQuery}
            serviceFilter={hook.serviceFilter}
            onServiceFilterChange={hook.setServiceFilter}
            blacklistCount={hook.blacklist.length}
            onExportCSV={hook.exportToCSV}
            onOpenBlacklist={() => hook.setIsBlacklistDialogOpen(true)}
          />

          {/* Bulk Actions */}
          <LeadBulkActionsBar
            selectedCount={hook.selectedLeads.length}
            isProcessing={hook.isProcessing}
            onDeselectAll={hook.deselectAll}
            onOpenVerify={() => hook.setShowBulkVerifyDialog(true)}
            onOpenReject={() => hook.setShowBulkRejectDialog(true)}
          />

          {/* Tabs */}
          <Tabs value={hook.activeTab} onValueChange={hook.setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
              <TabsTrigger value="pending_verification" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Ausstehend</span>
                {hook.pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">{hook.pendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="awaiting_confirmation" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">Best&auml;tigung</span>
                <span className="sm:hidden">Best.</span>
                {hook.awaitingConfirmationCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 bg-amber-100 text-amber-800 border-amber-200">
                    {hook.awaitingConfirmationCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="risky" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Risiko</span>
                {hook.riskyCount > 0 && (
                  <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">{hook.riskyCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="verified" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Verteilt</span>
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span>Abgelehnt</span>
              </TabsTrigger>
              <TabsTrigger value="no_matches" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">Kein Treffer</span>
                <span className="sm:hidden">Kein</span>
                {hook.noMatchCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">{hook.noMatchCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={hook.activeTab} className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">
                    {hook.activeTab === "pending_verification" && "Zu überprüfende Anfragen"}
                    {hook.activeTab === "awaiting_confirmation" && "Warten auf Kundenbestätigung (Double Opt-in)"}
                    {hook.activeTab === "risky" && "Riskante / unbestätigte Anfragen"}
                    {hook.activeTab === "verified" && "Verifizierte & verteilte Anfragen"}
                    {hook.activeTab === "rejected" && "Abgelehnte Anfragen"}
                    {hook.activeTab === "no_matches" && "Keine passende Firma gefunden"}
                    <span className="ml-2 text-muted-foreground font-normal">
                      ({hook.filteredTotalCount})
                    </span>
                  </CardTitle>
                  {hook.activeTab === "pending_verification" && hook.filteredTotalCount > 0 && (
                    <Button variant="outline" size="sm" onClick={hook.selectAllVisible}>
                      Alle ausw&auml;hlen
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {hook.isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                    </div>
                  ) : hook.filteredTotalCount === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {hook.activeTab === "pending_verification" && "Keine ausstehenden Anfragen"}
                      {hook.activeTab === "awaiting_confirmation" && "Keine Anfragen warten auf Kundenbest\u00e4tigung"}
                      {hook.activeTab === "risky" && "Keine riskanten Anfragen"}
                      {hook.activeTab === "verified" && "Keine verifizierten Anfragen"}
                      {hook.activeTab === "rejected" && "Keine abgelehnten Anfragen"}
                      {hook.activeTab === "no_matches" && "Keine Anfragen ohne Treffer"}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <LeadPaginationHeader
                        startIndex={hook.startIndex}
                        endIndex={hook.endIndex}
                        totalItems={hook.filteredTotalCount}
                        pageSize={hook.pageSize}
                        onPageSizeChange={(size) => {
                          hook.setPageSize(size);
                          hook.setCurrentPage(1);
                        }}
                      />

                      {hook.paginatedLeads.map((lead) => (
                        <LeadListItem
                          key={lead.id}
                          lead={lead}
                          activeTab={hook.activeTab}
                          isSelected={hook.selectedLeads.includes(lead.id)}
                          isProcessing={hook.isProcessing}
                          onToggleSelection={hook.toggleLeadSelection}
                          onOpenDetail={hook.openLeadDetail}
                          onVerify={hook.handleVerify}
                          onReject={(l) => {
                            hook.setSelectedLead(l);
                            hook.setIsRejectDialogOpen(true);
                          }}
                        />
                      ))}

                      <LeadPaginationFooter
                        currentPage={hook.currentPage}
                        totalPages={hook.totalPages}
                        onPageChange={hook.setCurrentPage}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Lead Detail Dialog */}
        <LeadDetailDialog
          open={hook.isDetailOpen}
          onOpenChange={hook.setIsDetailOpen}
          lead={hook.selectedLead}
          setLead={hook.setSelectedLead}
          distributions={hook.selectedLeadDistributions}
          adminNotes={hook.adminNotes}
          setAdminNotes={hook.setAdminNotes}
          isProcessing={hook.isProcessing}
          onVerify={hook.handleVerify}
          onOpenReject={() => hook.setIsRejectDialogOpen(true)}
          onAddIpToBlacklist={hook.addLeadIpToBlacklist}
          onManualDistributionSuccess={hook.fetchLeads}
        />

        {/* Reject Dialog */}
        <AlertDialog open={hook.isRejectDialogOpen} onOpenChange={hook.setIsRejectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anfrage ablehnen</AlertDialogTitle>
              <AlertDialogDescription>
                Bitte geben Sie einen Grund f&uuml;r die Ablehnung an. Diese Information wird intern gespeichert.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="z.B. Spam-Anfrage, ung&uuml;ltige Kontaktdaten, Test-Anfrage..."
                value={hook.rejectionReason}
                onChange={(e) => hook.setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                hook.setRejectionReason("");
                hook.setIsRejectDialogOpen(false);
              }}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={hook.handleReject}
                className="bg-destructive hover:bg-destructive/90"
                disabled={hook.isProcessing || !hook.rejectionReason.trim()}
              >
                {hook.isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Ablehnen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Blacklist Dialog */}
        <LeadBlacklistDialog
          open={hook.isBlacklistDialogOpen}
          onOpenChange={hook.setIsBlacklistDialogOpen}
          blacklist={hook.blacklist}
          newIp={hook.newBlacklistIp}
          setNewIp={hook.setNewBlacklistIp}
          newReason={hook.newBlacklistReason}
          setNewReason={hook.setNewBlacklistReason}
          isProcessing={hook.isProcessing}
          onAdd={hook.addToBlacklist}
          onRemove={hook.removeFromBlacklist}
        />

        {/* Bulk Verify Dialog */}
        <BulkVerifyDialog
          open={hook.showBulkVerifyDialog}
          onOpenChange={hook.setShowBulkVerifyDialog}
          selectedCount={hook.selectedLeads.length}
          isProcessing={hook.isProcessing}
          onConfirm={hook.handleBulkVerify}
        />

        {/* Bulk Reject Dialog */}
        <BulkRejectDialog
          open={hook.showBulkRejectDialog}
          onOpenChange={hook.setShowBulkRejectDialog}
          selectedCount={hook.selectedLeads.length}
          isProcessing={hook.isProcessing}
          onConfirm={hook.handleBulkReject}
        />
      </AdminLayout>
    </>
  );
};

export default LeadVerification;
