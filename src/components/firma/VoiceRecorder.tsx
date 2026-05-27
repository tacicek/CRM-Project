import { Mic, Square, Loader2, AlertCircle, RotateCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useWhisper } from "@/hooks/useWhisper";
import { useState, useEffect, useCallback } from "react";

interface VoiceRecorderProps {
  onTranscriptReady: (text: string) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceRecorder({ onTranscriptReady, disabled }: VoiceRecorderProps) {
  const {
    status,
    transcript,
    error,
    recordingDuration,
    isSupported,
    startRecording,
    stopRecording,
    reset,
  } = useWhisper();

  const [editedTranscript, setEditedTranscript] = useState("");

  useEffect(() => {
    if (transcript) setEditedTranscript(transcript);
  }, [transcript]);

  const handleUseTranscript = useCallback(() => {
    const text = editedTranscript.trim();
    if (text) {
      onTranscriptReady(text);
      reset();
      setEditedTranscript("");
    }
  }, [editedTranscript, onTranscriptReady, reset]);

  if (!isSupported) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Ihr Browser unterstützt keine Audioaufnahme. Bitte verwenden Sie einen
          aktuellen Chrome, Firefox oder Edge Browser.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Recording controls */}
      {status === "idle" && (
        <Button
          type="button"
          variant="outline"
          onClick={startRecording}
          disabled={disabled}
          className="gap-2"
        >
          <Mic className="w-4 h-4" />
          Spracheingabe
        </Button>
      )}

      {status === "recording" && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="text-sm font-medium text-red-700">
            Aufnahme läuft — {formatDuration(recordingDuration)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={stopRecording}
            className="ml-auto gap-1.5"
          >
            <Square className="w-3.5 h-3.5" />
            Stoppen
          </Button>
        </div>
      )}

      {status === "transcribing" && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm font-medium text-blue-700">
            Transkribiere Aufnahme...
          </span>
        </div>
      )}

      {/* Error */}
      {status === "error" && error && (
        <div className="space-y-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Erneut versuchen
          </Button>
        </div>
      )}

      {/* Transcript review */}
      {status === "done" && (
        <div className="space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-4">
          <p className="text-sm font-medium text-green-800">
            Transkription abgeschlossen — bitte prüfen und bei Bedarf bearbeiten:
          </p>
          <Textarea
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
            rows={5}
            className="bg-white text-sm"
            aria-label="Transkription bearbeiten"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleUseTranscript}
              disabled={!editedTranscript.trim()}
              className="min-w-0 flex-1 gap-1.5 max-sm:px-0 sm:px-4"
            >
              <ArrowRight className="w-4 h-4 shrink-0" />
              Mit AI extrahieren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              className="min-w-0 flex-1 gap-1.5 max-sm:px-0 sm:px-4"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Verwerfen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
