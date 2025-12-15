import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { DrawerParamList, ChatsStackParamList } from "./types";
import ChatsNavigator from "./ChatsNavigator";
import SettingsNavigator from "./SettingsNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Avatar } from "@/components/Avatar";
import { Spacing, BorderRadius } from "@/constants/theme";

const Drawer = createDrawerNavigator<DrawerParamList>();

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { navigation, state } = props;

  const mainMenuItems = [
    { name: "ChatsStack", label: t("chats.title"), icon: "message-circle" },
    { name: "CreateGroup", label: t("chats.createGroup"), icon: "users", isAction: true },
  ];

  const bottomMenuItems = [
    { name: "Settings", label: t("settings.title"), icon: "settings" },
  ];

  const handleMenuItemPress = (item: { name: string; isAction?: boolean }) => {
    if (item.isAction) {
      navigation.closeDrawer();
      setTimeout(() => {
        (navigation as any).navigate("ChatsStack", { screen: item.name });
      }, 100);
    } else {
      navigation.navigate(item.name as keyof DrawerParamList);
    }
  };

  const renderMenuItem = (item: { name: string; label: string; icon: string; isAction?: boolean }, isActive: boolean) => (
    <Pressable
      key={item.name}
      onPress={() => handleMenuItemPress(item)}
      style={({ pressed }) => [
        styles.menuItem,
        {
          backgroundColor: isActive
            ? theme.primary + "15"
            : pressed
              ? theme.backgroundSecondary
              : "transparent",
        },
      ]}
    >
      <Feather
        name={item.icon as any}
        size={24}
        color={isActive ? theme.primary : theme.text}
      />
      <ThemedText
        style={[
          styles.menuLabel,
          { color: isActive ? theme.primary : theme.text },
        ]}
      >
        {item.label}
      </ThemedText>
    </Pressable>
  );

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={[
        styles.drawerContent,
        { paddingTop: insets.top + Spacing.lg },
      ]}
    >
      <View style={styles.header}>
        <Avatar
          name={user?.displayName || ""}
          color={user?.avatarColor || theme.primary}
          avatarUrl={user?.avatarUrl}
          size={64}
        />
        <ThemedText type="h4" style={styles.userName}>
          {user?.displayName}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {user?.email}
        </ThemedText>
      </View>

      <View style={styles.menuContainer}>
        {mainMenuItems.map((item, index) => {
          const isActive = !item.isAction && state.index === index;
          return renderMenuItem(item, isActive);
        })}
      </View>

      <View style={styles.bottomMenu}>
        {bottomMenuItems.map((item) => {
          const isActive = state.index === mainMenuItems.length;
          return renderMenuItem(item, isActive);
        })}
      </View>

    </DrawerContentScrollView>
  );
}

export default function DrawerNavigator() {
  const { theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: {
          backgroundColor: theme.backgroundRoot,
          width: 280,
        },
        overlayColor: "rgba(0,0,0,0.5)",
      }}
    >
      <Drawer.Screen name="ChatsStack" component={ChatsNavigator} />
      <Drawer.Screen name="Settings" component={SettingsNavigator} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.lg,
  },
  userName: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  menuContainer: {
    flex: 1,
  },
  bottomMenu: {
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  menuLabel: {
    marginLeft: Spacing.md,
    fontSize: 16,
    fontWeight: "500",
  },
});
