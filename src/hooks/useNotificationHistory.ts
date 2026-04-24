import { useState, useCallback } from "react";

export interface NotificationMetadata {
  appointment_id?: string;
  customer_name?: string;
  customer_email?: string;
  proposed_date?: string;
  proposed_time?: string;
  original_date?: string;
  original_time?: string;
  confirm_url?: string;
  reject_url?: string;
  offer_id?: string;
  offer_title?: string;
  status?: string;
  total?: number;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  timestamp: Date;
  read: boolean;
  route?: string; // Route to navigate to when clicked
  type?: string; // Notification type for categorization
  metadata?: NotificationMetadata;
}

const MAX_NOTIFICATIONS = 20;

export const useNotificationHistory = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  const loadNotifications = useCallback((items: NotificationItem[]) => {
    if (!loadedFromDb) {
      setNotifications(items);
      setLoadedFromDb(true);
    }
  }, [loadedFromDb]);

  const addNotification = useCallback((
    title: string, 
    body?: string, 
    route?: string, 
    type?: string,
    id?: string, // Optional DB ID for proper sync
    metadata?: NotificationMetadata
  ) => {
    const newNotification: NotificationItem = {
      id: id || crypto.randomUUID(),
      title,
      body,
      timestamp: new Date(),
      read: false,
      route,
      type,
      metadata,
    };

    setNotifications((prev) => {
      // Check if notification with same ID already exists
      if (id && prev.find(n => n.id === id)) {
        return prev;
      }
      // Check if notification with same title already exists in last 5 seconds
      const recentDuplicate = prev.find(
        (n) => n.title === title && Date.now() - n.timestamp.getTime() < 5000
      );
      if (recentDuplicate) return prev;
      
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    loadNotifications,
  };
};
