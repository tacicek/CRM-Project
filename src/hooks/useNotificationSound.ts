import { useCallback, useEffect, useState } from "react";
import { devLog } from "@/lib/devLog";

const NOTIFICATION_SOUND_KEY = "notification_sound_enabled";
const PUSH_NOTIFICATION_KEY = "push_notification_enabled";

// Generate a simple notification sound using Web Audio API
// Extend Window interface for webkit prefix
interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    
    // Create oscillator for the notification tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure the sound - a pleasant two-tone notification
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1046.5, audioContext.currentTime + 0.1); // C6
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.type = "sine";
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, 500);
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
};

// Check if browser supports notifications
const isNotificationSupported = () => {
  return "Notification" in window;
};

// Check if tab is in background
const isTabHidden = () => {
  return document.hidden;
};

// Request notification permission
const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    devLog("Browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission === "denied") {
    devLog("Notification permission was denied");
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

// Show browser notification
const showBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return;
  }
  
  try {
    const notification = new Notification(title, {
      icon: "/favicon.png",
      badge: "/favicon.png",
      ...options,
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    // Focus window when clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error("Error showing notification:", error);
  }
};

export const useNotificationSound = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const stored = localStorage.getItem(NOTIFICATION_SOUND_KEY);
    // Default to TRUE (enabled) if not set
    return stored === null ? true : stored === "true";
  });

  const [isPushEnabled, setIsPushEnabled] = useState(() => {
    const stored = localStorage.getItem(PUSH_NOTIFICATION_KEY);
    // Default to TRUE (enabled) if not set
    return stored === null ? true : stored === "true";
  });

  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    isNotificationSupported() ? Notification.permission : "denied"
  );

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_SOUND_KEY, String(isSoundEnabled));
  }, [isSoundEnabled]);

  useEffect(() => {
    localStorage.setItem(PUSH_NOTIFICATION_KEY, String(isPushEnabled));
  }, [isPushEnabled]);

  const playSound = useCallback(() => {
    if (isSoundEnabled) {
      playNotificationSound();
    }
  }, [isSoundEnabled]);

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => !prev);
  }, []);

  const testSound = useCallback(() => {
    playNotificationSound();
  }, []);

  const enablePushNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPushPermission(Notification.permission);
    if (granted) {
      setIsPushEnabled(true);
    }
    return granted;
  }, []);

  const togglePushNotifications = useCallback(async () => {
    if (isPushEnabled) {
      setIsPushEnabled(false);
    } else {
      const granted = await enablePushNotifications();
      if (!granted) {
        devLog("Push notification permission not granted");
      }
    }
  }, [isPushEnabled, enablePushNotifications]);

  const showPushNotification = useCallback((title: string, body?: string) => {
    // Only show if push is enabled and tab is hidden
    if (isPushEnabled && isTabHidden()) {
      showBrowserNotification(title, { body });
    }
  }, [isPushEnabled]);

  // Combined function that plays sound and shows push notification
  const notify = useCallback((title: string, body?: string) => {
    playSound();
    showPushNotification(title, body);
  }, [playSound, showPushNotification]);

  return {
    // Sound
    isSoundEnabled,
    setIsSoundEnabled,
    playSound,
    toggleSound,
    testSound,
    // Push notifications
    isPushEnabled,
    pushPermission,
    enablePushNotifications,
    togglePushNotifications,
    showPushNotification,
    // Combined
    notify,
    // Legacy alias
    isEnabled: isSoundEnabled,
  };
};
