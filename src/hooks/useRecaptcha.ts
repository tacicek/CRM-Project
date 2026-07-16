// useRecaptcha.ts - Google reCAPTCHA v3 hook for form protection

import { useCallback, useEffect, useState } from "react";
import { devLog, devWarn } from "@/lib/devLog";

// Get site key from environment or use default
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

devLog('[reCAPTCHA] Site key configured:', RECAPTCHA_SITE_KEY ? 'Yes' : 'No');

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

interface UseRecaptchaReturn {
  executeRecaptcha: (action: string) => Promise<string | null>;
  isLoaded: boolean;
  isEnabled: boolean;
  error: string | null;
}

/**
 * Hook for Google reCAPTCHA v3
 * 
 * Usage:
 * ```tsx
 * const { executeRecaptcha, isLoaded, isEnabled } = useRecaptcha();
 * 
 * const handleSubmit = async () => {
 *   const token = await executeRecaptcha('submit_form');
 *   if (!token && isEnabled) {
 *     // Handle error - reCAPTCHA failed
 *     return;
 *   }
 *   // Continue with form submission, include token in request
 * };
 * ```
 */
export function useRecaptcha(): UseRecaptchaReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isEnabled = Boolean(RECAPTCHA_SITE_KEY);

  useEffect(() => {
    // Skip if reCAPTCHA is not configured
    if (!isEnabled) {
      return;
    }

    // Check if script is already loaded
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setIsLoaded(true);
      });
      return;
    }

    // Load reCAPTCHA script dynamically
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      window.grecaptcha.ready(() => {
        setIsLoaded(true);
        devLog("[reCAPTCHA] Script loaded successfully");
      });
    };
    
    script.onerror = () => {
      setError("Failed to load reCAPTCHA script");
      console.error("[reCAPTCHA] Failed to load script");
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [isEnabled]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    // If reCAPTCHA is not enabled, return null (submission should continue)
    if (!isEnabled) {
      return null;
    }

    // If script not loaded yet, wait a bit
    if (!isLoaded || !window.grecaptcha) {
      devWarn("[reCAPTCHA] Script not loaded yet");
      setError("reCAPTCHA not loaded");
      return null;
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
      return token;
    } catch (err) {
      console.error("[reCAPTCHA] Error executing:", err);
      setError("reCAPTCHA execution failed");
      return null;
    }
  }, [isLoaded, isEnabled]);

  return {
    executeRecaptcha,
    isLoaded,
    isEnabled,
    error,
  };
}

export { RECAPTCHA_SITE_KEY };
