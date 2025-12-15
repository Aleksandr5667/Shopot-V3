import React, { createContext, useContext, useCallback, useEffect, useRef, ReactNode } from "react";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useNotifications, NotificationData } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationsContextType {
  expoPushToken: string | null;
  permissionGranted: boolean;
  setBadgeCount: (count: number) => Promise<void>;
  clearBadge: () => Promise<void>;
  scheduleLocalNotification: (
    title: string,
    body: string,
    data?: NotificationData
  ) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

type RootStackParamList = {
  Chats: {
    screen: string;
    params: { chatId: string };
  };
};

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const hasRegistered = useRef(false);

  const handleNotificationTap = useCallback(
    (chatId: string) => {
      console.log("[NotificationsProvider] Navigating to chat:", chatId);
      navigation.navigate("Chats", {
        screen: "Chat",
        params: { chatId },
      });
    },
    [navigation]
  );

  const {
    expoPushToken,
    permissionGranted,
    setBadgeCount,
    clearBadge,
    scheduleLocalNotification,
    registerForPushNotifications,
    unregisterPushNotifications,
  } = useNotifications(handleNotificationTap);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAuthenticated && user && !hasRegistered.current) {
      console.log("[NotificationsProvider] User authenticated, registering push token...");
      hasRegistered.current = true;
      registerForPushNotifications();
    } else if (!isAuthenticated && hasRegistered.current) {
      console.log("[NotificationsProvider] User logged out, unregistering push token...");
      hasRegistered.current = false;
      unregisterPushNotifications();
    }
  }, [isAuthenticated, isLoading, user, registerForPushNotifications, unregisterPushNotifications]);

  return (
    <NotificationsContext.Provider
      value={{
        expoPushToken,
        permissionGranted,
        setBadgeCount,
        clearBadge,
        scheduleLocalNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotificationsContext must be used within NotificationsProvider");
  }
  return context;
}
