import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { NotificationBanner } from "./NotificationBanner";

const OFFLINE_DELAY_MS = 10000;

export function ConnectionBanner() {
  const { isConnected } = useWebSocket();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setVisible(false);
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      return;
    }
    
    if (!isConnected && !dismissed) {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
      }
      offlineTimerRef.current = setTimeout(() => {
        setVisible(true);
      }, OFFLINE_DELAY_MS);
    } else if (isConnected) {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      setDismissed(false);
      setVisible(false);
    }
    
    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
    };
  }, [isConnected, user, dismissed]);

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  return (
    <View style={[styles.container, { top: insets.top + 4 }]}>
      <NotificationBanner
        type="error"
        message={t("common.offline")}
        visible={visible}
        onDismiss={handleDismiss}
        showCloseButton={true}
        icon="wifi-off"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100,
  },
});
