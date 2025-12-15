import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "./types";
import ChatsListScreen from "@/screens/chats/ChatsListScreen";
import ChatScreen from "@/screens/chats/ChatScreen";
import MediaViewerScreen from "@/screens/chats/MediaViewerScreen";
import AddContactScreen from "@/screens/chats/AddContactScreen";
import UserProfileScreen from "@/screens/chats/UserProfileScreen";
import { CreateGroupScreen } from "@/screens/chats/CreateGroupScreen";
import { GroupInfoScreen } from "@/screens/chats/GroupInfoScreen";
import { AddGroupMembersScreen } from "@/screens/chats/AddGroupMembersScreen";
import ForwardMessageScreen from "@/screens/chats/ForwardMessageScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions, getOpaqueHeaderOptions, createBackButton, getModalOptions, getFullScreenModalOptions } from "./screenOptions";
import { useTranslation } from "react-i18next";

const Stack = createNativeStackNavigator<ChatsStackParamList>();

export default function ChatsNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="ChatsList"
        component={ChatsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ navigation }) => ({
          ...getOpaqueHeaderOptions({ theme, isDark }),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={getFullScreenModalOptions({ theme })}
      />
      <Stack.Screen
        name="AddContact"
        component={AddContactScreen}
        options={({ navigation }) => ({
          ...getModalOptions({ theme, isDark, navigation }),
          headerTitle: t("chats.addContact"),
        })}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={({ navigation }) => ({
          ...getOpaqueHeaderOptions({ theme, isDark }),
          headerTitle: t("profile.userProfile"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={({ navigation }) => ({
          ...getOpaqueHeaderOptions({ theme, isDark }),
          headerTitle: t("chats.createGroup"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="GroupInfo"
        component={GroupInfoScreen}
        options={({ navigation }) => ({
          ...getOpaqueHeaderOptions({ theme, isDark }),
          headerTitle: t("group.info"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="AddGroupMembers"
        component={AddGroupMembersScreen}
        options={({ navigation }) => ({
          ...getOpaqueHeaderOptions({ theme, isDark }),
          headerTitle: t("group.addMembers"),
          headerLeft: () => createBackButton(navigation, theme.text),
        })}
      />
      <Stack.Screen
        name="ForwardMessage"
        component={ForwardMessageScreen}
        options={({ navigation }) => ({
          ...getModalOptions({ theme, isDark, navigation }),
          headerTitle: t("chat.forwardTo"),
        })}
      />
    </Stack.Navigator>
  );
}
