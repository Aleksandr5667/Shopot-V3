import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { SettingsStackParamList } from "./types";
import SettingsScreen from "@/screens/settings/SettingsScreen";
import EditProfileScreen from "@/screens/settings/EditProfileScreen";
import LanguageSettingsScreen from "@/screens/settings/LanguageSettingsScreen";
import LegalScreen from "@/screens/settings/LegalScreen";
import { useTheme } from "@/hooks/useTheme";
import { getOpaqueHeaderOptions, createBackButton } from "./screenOptions";

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getOpaqueHeaderOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          title: t("settings.title"),
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={({ navigation }) => ({
          title: t("settings.editProfile"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={({ navigation }) => ({
          title: t("settings.language"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="Legal"
        component={LegalScreen}
        options={({ route, navigation }) => ({
          title: route.params.type === "privacy" 
            ? t("legal.privacyPolicy") 
            : t("legal.termsOfUse"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
    </Stack.Navigator>
  );
}
