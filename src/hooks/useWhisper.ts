import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const WHISPER_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

type WhisperStatus = "idle" | "recording" | "transcribing" | "done" | "error";

interface UseWhisperReturn {
  status: WhisperStatus;
  transcript: string;
  error: string | null;
  recordingDuration: number;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export function useWhisper(): UseWhisperReturn {
  const [status, setStatus] = useState<WhisperStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
  }, []);

  const transcribe = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size > WHISPER_MAX_SIZE_BYTES) {
      if (isMountedRef.current) {
        setError(
          `Aufnahme zu gross (${(audioBlob.size / 1024 / 1024).toFixed(1)} MB). Maximum: 25 MB.`
        );
        setStatus("error");
      }
      return;
    }

    if (isMountedRef.current) setStatus("transcribing");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sitzung abgelaufen. Bitte laden Sie die Seite neu.");
      }

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Fehler (${res.status})`);
      }

      if (isMountedRef.current) {
        setTranscript(json.transcript);
        setStatus("done");
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "Transkription fehlgeschlagen."
        );
        setStatus("error");
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    setRecordingDuration(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        transcribe(blob);
      };

      recorder.onerror = () => {
        if (isMountedRef.current) {
          setError("Aufnahme fehlgeschlagen.");
          setStatus("error");
        }
        cleanup();
      };

      recorder.start(1000);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          setRecordingDuration(Math.floor((Date.now() - start) / 1000));
        }
      }, 500);

      if (isMountedRef.current) setStatus("recording");
    } catch (err) {
      if (isMountedRef.current) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Mikrofon-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen."
            : "Mikrofon konnte nicht gestartet werden.";
        setError(msg);
        setStatus("error");
      }
    }
  }, [cleanup, transcribe]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setTranscript("");
    setError(null);
    setRecordingDuration(0);
  }, [cleanup]);

  return {
    status,
    transcript,
    error,
    recordingDuration,
    isSupported,
    startRecording,
    stopRecording,
    reset,
  };
}
