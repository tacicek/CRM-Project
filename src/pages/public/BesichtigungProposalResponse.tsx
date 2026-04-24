import { useCallback, useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, Building2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ProposalData {
  leadId: string;
  companyId: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  address: string;
  proposals: {
    date: string;
    time: string;
  }[];
}

export default function BesichtigungProposalResponse() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();
  
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<string>("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [action, setAction] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseProposalData = useCallback(() => {
    if (!leadId || !token) {
      setError("Ungültiger Link. Bitte verwenden Sie den Link aus Ihrer E-Mail.");
      setLoading(false);
      return;
    }

    try {
      // Parse proposal data from URL params
      const companyId = searchParams.get("companyId");
      const companyName = searchParams.get("companyName");
      const customerName = searchParams.get("customerName");
      const customerEmail = searchParams.get("customerEmail");
      const address = searchParams.get("address");
      const proposalsParam = searchParams.get("proposals");

      if (!companyId || !companyName || !proposalsParam) {
        setError("Ungültige Terminvorschläge.");
        setLoading(false);
        return;
      }

      let proposals: { date: string; time: string }[];
      try {
        proposals = JSON.parse(decodeURIComponent(proposalsParam));
        if (!Array.isArray(proposals)) {
          throw new Error("Invalid proposals format");
        }
      } catch (parseErr) {
        console.error("Error parsing proposal data:", parseErr);
        setError("Die Terminvorschläge konnten nicht geladen werden. Bitte verwenden Sie den Link aus Ihrer E-Mail erneut.");
        setLoading(false);
        return;
      }

      setProposalData({
        leadId,
        companyId,
        companyName: decodeURIComponent(companyName),
        customerName: customerName ? decodeURIComponent(customerName) : "",
        customerEmail: customerEmail ? decodeURIComponent(customerEmail) : "",
        address: address ? decodeURIComponent(address) : "",
        proposals,
      });
    } catch (err) {
      console.error("Error parsing proposal data:", err);
      setError("Fehler beim Laden der Terminvorschläge.");
    } finally {
      setLoading(false);
    }
  }, [leadId, token, searchParams]);

  useEffect(() => {
    parseProposalData();
  }, [parseProposalData]);

  const handleAccept = async () => {
    if (!proposalData || !selectedProposal) {
      toast.error("Bitte wählen Sie einen Termin aus");
      return;
    }
    
    setSubmitting(true);
    try {
      const selectedIndex = parseInt(selectedProposal);
      const selected = proposalData.proposals[selectedIndex];

      const { error: invokeError } = await supabase.functions.invoke("handle-proposal-response", {
        body: {
          leadId: proposalData.leadId,
          companyId: proposalData.companyId,
          action: "accept",
          selectedDate: selected.date,
          selectedTime: selected.time,
          customerMessage: message,
          customerName: proposalData.customerName,
          customerEmail: proposalData.customerEmail,
          companyName: proposalData.companyName,
          address: proposalData.address,
          token,
        },
      });

      if (invokeError) {
        console.error("Error handling response:", invokeError);
        throw invokeError;
      }

      setAction("accepted");
      setCompleted(true);
      toast.success("Termin bestätigt!");
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error("Fehler beim Bestätigen des Termins");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke("handle-proposal-response", {
        body: {
          leadId: proposalData?.leadId,
          companyId: proposalData?.companyId,
          action: "reject",
          customerMessage: message,
          customerName: proposalData?.customerName,
          customerEmail: proposalData?.customerEmail,
          companyName: proposalData?.companyName,
          token,
        },
      });

      if (invokeError) {
        console.error("Error handling response:", invokeError);
        throw invokeError;
      }

      setAction("rejected");
      setCompleted(true);
      toast.success("Anfrage abgelehnt");
    } catch (err) {
      console.error("Error submitting response:", err);
      toast.error("Fehler beim Ablehnen");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-3/4 mx-auto" />
              <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Fehler</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (completed) {
    const isAccepted = action === "accepted";
    const selected = isAccepted && selectedProposal 
      ? proposalData?.proposals[parseInt(selectedProposal)] 
      : null;

    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 ${isAccepted ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mb-4`}>
              {isAccepted ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-orange-600" />
              )}
            </div>
            <CardTitle>
              {isAccepted ? "Termin bestätigt!" : "Terminvorschläge abgelehnt"}
            </CardTitle>
            <CardDescription>
              {isAccepted 
                ? `Vielen Dank! ${proposalData?.companyName} wurde über Ihre Bestätigung informiert.`
                : `${proposalData?.companyName} wurde über Ihre Ablehnung informiert.`
              }
            </CardDescription>
          </CardHeader>
          {isAccepted && selected && (
            <CardContent>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-center">
                <div className="font-medium text-green-800">Ihr Besichtigungstermin</div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  {formatDate(selected.date)}
                </div>
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Clock className="h-4 w-4" />
                  {selected.time} Uhr
                </div>
                {proposalData?.address && (
                  <div className="flex items-center justify-center gap-2 text-green-700 pt-2 border-t border-green-200 mt-2">
                    <MapPin className="h-4 w-4" />
                    {proposalData.address}
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Terminvorschläge für Besichtigung</CardTitle>
          <CardDescription>
            {proposalData?.companyName} hat Ihnen folgende Termine vorgeschlagen
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Company Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{proposalData?.companyName}</span>
            </div>
            {proposalData?.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{proposalData.address}</span>
              </div>
            )}
          </div>

          {/* Proposal Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Wählen Sie einen Termin</Label>
            <RadioGroup value={selectedProposal} onValueChange={setSelectedProposal}>
              {proposalData?.proposals.map((proposal, index) => (
                <div 
                  key={index} 
                  className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedProposal === index.toString() 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedProposal(index.toString())}
                >
                  <RadioGroupItem value={index.toString()} id={`proposal-${index}`} />
                  <Label htmlFor={`proposal-${index}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium">{formatDate(proposal.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{proposal.time} Uhr</span>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Nachricht (optional)
            </Label>
            <Textarea
              placeholder="Haben Sie besondere Wünsche oder Anmerkungen?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleAccept}
              disabled={submitting || !selectedProposal}
              className="w-full"
            >
              {submitting ? "Wird verarbeitet..." : "Termin bestätigen"}
            </Button>
            <Button
              onClick={handleReject}
              disabled={submitting}
              variant="outline"
              className="w-full"
            >
              Keinen Termin annehmen
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Die Firma wird per E-Mail über Ihre Entscheidung informiert.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
