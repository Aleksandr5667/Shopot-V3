import React from "react";
import { Platform, Pressable } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Feather } from "@expo/vector-icons";

interface ScreenOptionsParams {
  theme: {
    backgroundRoot: string;
    backgroundDefault: string;
    text: string;
  };
  isDark: boolean;
  transparent?: boolean;
}

export const createBackButton = (
  navigation: { goBack: () => void },
  color: string
) => (
  <Pressable
    onPress={() => navigation.goBack()}
    style={({ pressed }) => ({
      opacity: pressed ? 0.6 : 1,
      paddingRight: Platform.OS === "ios" ? 0 : 16,
    })}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
  >
    <Feather name="chevron-left" size={24} color={color} />
  </Pressable>
);

export const getCommonScreenOptions = ({
  theme,
  isDark,
  transparent = true,
}: ScreenOptionsParams): NativeStackNavigationOptions => ({
  headerTitleAlign: "center",
  headerTransparent: transparent,
  headerBlurEffect: isDark ? "dark" : "light",
  headerTintColor: theme.text,
  headerBackButtonDisplayMode: "minimal",
  headerStyle: transparent
    ? {
        backgroundColor: Platform.select({
          ios: undefined,
          android: theme.backgroundRoot,
          web: theme.backgroundRoot,
        }),
      }
    : {
        backgroundColor: theme.backgroundDefault,
      },
  gestureEnabled: true,
  gestureDirection: "horizontal",
  fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
  contentStyle: {
    backgroundColor: theme.backgroundRoot,
  },
});

export const getOpaqueHeaderOptions = ({
  theme,
  isDark,
}: Omit<ScreenOptionsParams, 'transparent'>): NativeStackNavigationOptions => ({
  ...getCommonScreenOptions({ theme, isDark, transparent: false }),
  headerTransparent: false,
  headerStyle: {
    backgroundColor: theme.backgroundDefault,
  },
  headerShadowVisible: false,
});

export const getAuthStackOptions = ({
  theme,
  isDark,
}: Omit<ScreenOptionsParams, 'transparent'>): NativeStackNavigationOptions => ({
  ...getCommonScreenOptions({ theme, isDark, transparent: false }),
  headerShown: false,
});

export const getAuthScreenOptions = ({
  theme,
  isDark,
  navigation,
}: Omit<ScreenOptionsParams, 'transparent'> & { navigation: { goBack: () => void } }): NativeStackNavigationOptions => ({
  ...getCommonScreenOptions({ theme, isDark, transparent: false }),
  headerShown: true,
  headerTitle: "",
  headerLeft: () => createBackButton(navigation, theme.text),
});

export const getModalOptions = ({
  theme,
  isDark,
  navigation,
}: Omit<ScreenOptionsParams, 'transparent'> & { navigation: { goBack: () => void } }): NativeStackNavigationOptions => ({
  ...getOpaqueHeaderOptions({ theme, isDark }),
  presentation: "modal",
  headerLeft: () => createBackButton(navigation, theme.text),
});

export const getFullScreenModalOptions = ({
  theme,
}: Pick<ScreenOptionsParams, 'theme'>): NativeStackNavigationOptions => ({
  presentation: "fullScreenModal",
  headerShown: false,
  animation: "fade",
  contentStyle: {
    backgroundColor: theme.backgroundRoot,
  },
});
