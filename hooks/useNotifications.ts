import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiService } from "@/services/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  chatId?: string;
  senderId?: string;
  type?: string;
  [key: string]: unknown;
}

type NotificationHandler = (chatId: string) => void;

export function useNotifications(onNotificationTap?: NotificationHandler) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const onNotificationTapRef = useRef(onNotificationTap);

  const registerForPushNotifications = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === "web") {
      console.log("[Notifications] Push notifications not supported on web");
      return null;
    }

    if (!Device.isDevice) {
      console.log("[Notifications] Push notifications require a physical device");
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("[Notifications] Permission not granted");
        setPermissionGranted(false);
        return null;
      }

      setPermissionGranted(true);

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      let token: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = tokenData.data;
      } catch (tokenError) {
        console.log("[Notifications] Could not get push token (normal in Expo Go):", tokenError);
        return null;
      }
      
      console.log("[Notifications] Expo Push Token:", token);

      const result = await apiService.registerPushToken(token);
      if (result.success) {
        console.log("[Notifications] Token registered on server");
        setExpoPushToken(token);
      } else {
        console.error("[Notifications] Failed to register token:", result.error);
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Shepot Messages",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#0088CC",
          sound: "default",
        });
      }

      return token;
    } catch (error) {
      console.error("[Notifications] Error registering:", error);
      return null;
    }
  }, []);

  const unregisterPushNotifications = useCallback(async () => {
    try {
      await apiService.removePushToken();
      setExpoPushToken(null);
      console.log("[Notifications] Token removed from server");
    } catch (error) {
      console.error("[Notifications] Error removing token:", error);
    }
  }, []);

  useEffect(() => {
    onNotificationTapRef.current = onNotificationTap;
  }, [onNotificationTap]);

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as NotificationData;
    
    if (data?.chatId && onNotificationTapRef.current) {
      console.log("[Notifications] Opening chat:", data.chatId);
      onNotificationTapRef.current(data.chatId);
    }
  }, []);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[Notifications] Received:", notification.request.content);
        setNotification(notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationResponse]);

  const setBadgeCount = useCallback(async (count: number) => {
    if (Platform.OS !== "web") {
      try {
        await Notifications.setBadgeCountAsync(count);
      } catch (error) {
        console.error("[Notifications] Failed to set badge:", error);
      }
    }
  }, []);

  const clearBadge = useCallback(async () => {
    await setBadgeCount(0);
  }, [setBadgeCount]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: NotificationData
  ) => {
    if (Platform.OS === "web") return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: "default",
      },
      trigger: null,
    });
  }, []);

  return {
    expoPushToken,
    notification,
    permissionGranted,
    registerForPushNotifications,
    unregisterPushNotifications,
    setBadgeCount,
    clearBadge,
    scheduleLocalNotification,
  };
}
