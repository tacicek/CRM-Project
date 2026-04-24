import { createContext, useContext, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTrackingScripts, trackPageView } from "@/hooks/useTrackingScripts";

interface TrackingContextValue {
  loaded: boolean;
  trackEvent: (eventName: string, eventParams?: Record<string, unknown>) => void;
  trackConversion: (type: "lead" | "signup", value?: number) => void;
}

const TrackingContext = createContext<TrackingContextValue>({
  loaded: false,
  trackEvent: () => {},
  trackConversion: () => {},
});

export function useTracking() {
  return useContext(TrackingContext);
}

interface TrackingProviderProps {
  children: ReactNode;
}

export function TrackingProvider({ children }: TrackingProviderProps) {
  const { loaded, trackEvent, trackConversion } = useTrackingScripts();
  const location = useLocation();

  // Track page views on route changes
  useEffect(() => {
    if (loaded) {
      trackPageView(location.pathname, document.title);
    }
  }, [location.pathname, loaded]);

  return (
    <TrackingContext.Provider value={{ loaded, trackEvent, trackConversion }}>
      {children}
    </TrackingContext.Provider>
  );
}

export default TrackingProvider;

