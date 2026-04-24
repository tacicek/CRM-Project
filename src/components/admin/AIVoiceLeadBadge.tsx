import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Clock, MessageSquare, Sparkles, FileText } from "lucide-react";

interface AIVoiceLeadBadgeProps {
  source: string;
  conversationDuration?: number | null;
  conversationTranscript?: string | null;
  leadScore?: number | null;
  aiConfidenceScore?: number | null;
  vapiCallId?: string | null;
}

/**
 * Badge and info display for AI Voice leads
 * Shows special indicator when lead came from AI voice assistant
 */
export function AIVoiceLeadBadge({
  source,
  conversationDuration,
  conversationTranscript,
  leadScore,
  aiConfidenceScore,
}: AIVoiceLeadBadgeProps) {
  if (source !== "ai_voice") return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 70) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* AI Voice Badge */}
      <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 gap-1.5">
        <Bot className="w-3 h-3" />
        KI-Assistent
      </Badge>

      {/* Duration */}
      {conversationDuration && conversationDuration > 0 && (
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Clock className="w-3 h-3" />
          {formatDuration(conversationDuration)}
        </Badge>
      )}

      {/* Lead Score */}
      {leadScore !== null && leadScore !== undefined && (
        <Badge className={`${getScoreColor(leadScore)} gap-1.5`}>
          <Sparkles className="w-3 h-3" />
          Score: {leadScore}
        </Badge>
      )}

      {/* AI Confidence */}
      {aiConfidenceScore !== null && aiConfidenceScore !== undefined && (
        <Badge variant="secondary" className="gap-1.5 text-xs">
          KI: {aiConfidenceScore.toFixed(0)}%
        </Badge>
      )}

      {/* Transcript Viewer */}
      {conversationTranscript && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
              <FileText className="w-3 h-3" />
              Transcript
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Gesprächsprotokoll
              </DialogTitle>
              <DialogDescription>
                Vollständiges Transkript des KI-Assistenten Gesprächs
                {conversationDuration && (
                  <span className="ml-2">
                    • Dauer: {formatDuration(conversationDuration)}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300">
                {conversationTranscript}
              </pre>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/**
 * Compact inline badge for table views
 */
export function AIVoiceBadgeInline({ source }: { source: string }) {
  if (source !== "ai_voice") return null;

  return (
    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 gap-1 text-xs px-1.5 py-0.5">
      <Bot className="w-3 h-3" />
      KI
    </Badge>
  );
}

/**
 * Lead score indicator with color coding
 */
export function LeadScoreIndicator({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;

  const getColor = (): string => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getBgColor = (): string => {
    if (score >= 70) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 40) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <div
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${getBgColor()} ${getColor()} font-semibold text-sm`}
      title={`Lead Score: ${score}/100`}
    >
      {score}
    </div>
  );
}
