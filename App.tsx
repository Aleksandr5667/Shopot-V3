import React, { useEffect } from "react";
import { StyleSheet, View, Platform } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  Theme,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ScreenCapture from "expo-screen-capture";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { ThemeProvider, useThemeContext } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { ChatsProvider } from "@/contexts/ChatsContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { Colors } from "@/constants/theme";
import "@/i18n";
import { getStoredLanguage, changeLanguage } from "@/i18n";

function AppContent() {
  const { colorScheme } = useThemeContext();
  const isDark = colorScheme === "dark";
  const theme = Colors[colorScheme];

  const navigationTheme: Theme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: theme.primary,
          background: theme.backgroundRoot,
          card: theme.backgroundDefault,
          text: theme.text,
          border: theme.divider,
          notification: theme.accent,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: theme.primary,
          background: theme.backgroundRoot,
          card: theme.backgroundDefault,
          text: theme.text,
          border: theme.divider,
          notification: theme.accent,
        },
      };

  useEffect(() => {
    const restoreLanguage = async () => {
      const savedLang = await getStoredLanguage();
      if (savedLang && savedLang !== "en") {
        await changeLanguage(savedLang);
      }
    };
    restoreLanguage();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenCapture.preventScreenCaptureAsync();
    }
    return () => {
      if (Platform.OS !== "web") {
        ScreenCapture.allowScreenCaptureAsync();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <AuthProvider>
            <WebSocketProvider>
              <ChatsProvider>
                <NavigationContainer theme={navigationTheme}>
                  <NotificationsProvider>
                    <View style={styles.root}>
                      <RootNavigator />
                      <ConnectionBanner />
                    </View>
                  </NotificationsProvider>
                </NavigationContainer>
              </ChatsProvider>
            </WebSocketProvider>
          </AuthProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
