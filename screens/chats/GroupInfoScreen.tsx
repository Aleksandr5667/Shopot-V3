import React, { useState, useCallback, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { SettingsItem, SettingsSection } from "@/components/SettingsItem";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useChatsContext } from "@/contexts/ChatsContext";
import { apiService } from "@/services/api";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import { ChatsStackParamList } from "@/navigation/types";
import { GroupMember } from "@/store/types";

type NavigationProp = NativeStackNavigationProp<ChatsStackParamList, "GroupInfo">;
type GroupInfoRouteProp = RouteProp<ChatsStackParamList, "GroupInfo">;

export function GroupInfoScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<GroupInfoRouteProp>();
  const { user } = useAuth();
  const { refreshChats, createChat, chats } = useChatsContext();
  const { chatId } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [avatarColor, setAvatarColor] = useState("#0088CC");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [createdBy, setCreatedBy] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const currentUserId = user?.visibleId;
  const currentMember = members.find((m) => m.id === currentUserId);
  const isAdmin = currentMember?.role === "admin";
  const isCreator = createdBy === currentUserId;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("group.info"),
    });
  }, [navigation, t]);

  const loadGroupDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const numericId = parseInt(chatId, 10);
      const result = await apiService.getGroupDetails(numericId);

      if (result.success && result.data) {
        const chat = result.data.chat;
        setGroupName(chat.name || "");
        setAvatarColor(chat.avatarColor || "#0088CC");
        setAvatarUrl(chat.avatarUrl || undefined);
        setCreatedBy(chat.createdBy || chat.createdById);
        
        const chatMembers = result.data.members || (chat as any).members || [];
        setMembers(
          chatMembers.map((m: any) => {
            const rawId = m.userId || m.user?.id || m.id;
            const memberId = typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10);
            return {
              id: memberId,
              visibleId: memberId,
              displayName: m.user?.displayName || m.displayName || "",
              email: m.user?.email || m.email || undefined,
              avatarColor: m.user?.avatarColor || m.avatarColor || "#3B82F6",
              avatarUrl: m.user?.avatarUrl || m.avatarUrl || undefined,
              role: m.role || "member",
              joinedAt: m.joinedAt,
              addedBy: m.addedBy ?? undefined,
            };
          })
        );
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load group details:", error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useFocusEffect(
    useCallback(() => {
      loadGroupDetails();
    }, [loadGroupDetails])
  );

  const handleEditName = useCallback(() => {
    setEditedName(groupName);
    setIsEditingName(true);
  }, [groupName]);

  const handleSaveName = useCallback(async () => {
    if (!editedName.trim() || editedName.trim() === groupName) {
      setIsEditingName(false);
      return;
    }

    setIsUpdating(true);
    try {
      const numericId = parseInt(chatId, 10);
      const result = await apiService.updateGroup(numericId, { name: editedName.trim() });
      if (result.success) {
        setGroupName(editedName.trim());
        setIsEditingName(false);
        refreshChats();
      } else {
        Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
      }
    } catch (error) {
      Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
    } finally {
      setIsUpdating(false);
    }
  }, [editedName, groupName, chatId, t, refreshChats]);

  const handleRemoveMember = useCallback(
    async (member: GroupMember) => {
      const numericCreatedBy = typeof createdBy === 'number' ? createdBy : parseInt(String(createdBy), 10);
      if (member.id === numericCreatedBy) {
        Alert.alert(t("common.error"), t("group.cannotRemoveCreator"));
        return;
      }

      const confirmMessage = t("group.removeConfirm", { name: member.displayName });
      
      const doRemove = async () => {
        try {
          const numericChatId = parseInt(chatId, 10);
          const result = await apiService.removeGroupMember(numericChatId, member.id);
          if (result.success) {
            setMembers((prev) => prev.filter((m) => m.id !== member.id));
          } else {
            Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
          }
        } catch (error) {
          Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
        }
      };

      if (Platform.OS === 'web') {
        if (window.confirm(confirmMessage)) {
          await doRemove();
        }
      } else {
        Alert.alert(
          t("group.removeMember"),
          confirmMessage,
          [
            { text: t("common.cancel"), style: "cancel" },
            { text: t("common.confirm"), style: "destructive", onPress: doRemove },
          ]
        );
      }
    },
    [chatId, createdBy, t]
  );

  const handleToggleAdmin = useCallback(
    async (member: GroupMember) => {
      const numericCreatedBy = typeof createdBy === 'number' ? createdBy : parseInt(String(createdBy), 10);
      if (member.id === numericCreatedBy) {
        Alert.alert(t("common.error"), t("group.cannotChangeCreatorRole"));
        return;
      }

      const isCurrentlyAdmin = member.role === "admin";
      const newRole = isCurrentlyAdmin ? "member" : "admin";
      const confirmTitle = isCurrentlyAdmin ? t("group.removeAdmin") : t("group.makeAdmin");
      const confirmMessage = isCurrentlyAdmin 
        ? t("group.removeAdminConfirm", { name: member.displayName })
        : t("group.makeAdminConfirm", { name: member.displayName });

      const doToggle = async () => {
        try {
          const numericChatId = parseInt(chatId, 10);
          const result = await apiService.changeGroupMemberRole(numericChatId, member.id, newRole);
          if (result.success) {
            setMembers((prev) =>
              prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
            );
          } else {
            Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
          }
        } catch (error) {
          Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
        }
      };

      if (Platform.OS === 'web') {
        if (window.confirm(confirmMessage)) {
          await doToggle();
        }
      } else {
        Alert.alert(confirmTitle, confirmMessage, [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirm"), onPress: doToggle },
        ]);
      }
    },
    [chatId, createdBy, t]
  );

  const handleOpenChat = useCallback(async (member: GroupMember) => {
    if (member.id === currentUserId) return;
    
    const existingChat = chats.find(
      (c) => c.type === "private" && c.participantIds.includes(member.id.toString())
    );
    
    const contact = {
      id: member.id.toString(),
      visibleId: member.id,
      displayName: member.displayName,
      email: member.email || "",
      avatarColor: member.avatarColor,
      avatarUrl: member.avatarUrl,
    };
    
    if (existingChat) {
      navigation.navigate("Chat", { chatId: existingChat.id, participant: contact });
    } else {
      const newChat = await createChat(contact);
      if (newChat) {
        navigation.navigate("Chat", { chatId: newChat.id, participant: contact });
      }
    }
  }, [currentUserId, chats, navigation, createChat]);

  const isCreatorAlone = isCreator && members.length === 1;

  const handleDeleteGroup = useCallback(() => {
    const doDelete = async () => {
      try {
        const numericId = parseInt(chatId, 10);
        const result = await apiService.deleteChat(numericId);
        if (result.success) {
          navigation.popToTop();
        } else {
          Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
        }
      } catch (error) {
        Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
      }
    };

    Alert.alert(t("group.deleteGroup"), t("group.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("group.deleteGroup"), style: "destructive", onPress: doDelete },
    ]);
  }, [chatId, navigation, t]);

  const handleLeaveGroup = useCallback(() => {
    const doLeave = async () => {
      try {
        const numericId = parseInt(chatId, 10);
        const result = await apiService.leaveGroup(numericId);
        if (result.success) {
          navigation.popToTop();
        } else {
          Alert.alert(t("common.error"), result.error || t("errors.somethingWentWrong"));
        }
      } catch (error) {
        Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
      }
    };

    const otherMembers = members.filter((m) => m.id !== currentUserId);
    let confirmMessage = t("group.leaveConfirm");
    
    if (isCreator && otherMembers.length > 0) {
      const oldestMember = [...otherMembers].sort(
        (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      )[0];
      confirmMessage = t("group.leaveAsCreatorConfirm", { name: oldestMember.displayName });
    }

    Alert.alert(t("group.leaveGroup"), confirmMessage, [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("group.leaveGroup"), style: "destructive", onPress: doLeave },
    ]);
  }, [chatId, navigation, t, members, isCreator, currentUserId]);

  const handleAddMembers = useCallback(() => {
    const existingMemberIds = members.map((m) => typeof m.id === 'number' ? m.id : parseInt(String(m.id), 10));
    navigation.navigate("AddGroupMembers", { chatId, existingMemberIds });
  }, [navigation, chatId, members]);

  const handleChangeAvatar = useCallback(async () => {
    const pickImage = async () => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setIsUpdating(true);
          const uploadResult = await apiService.uploadMedia(result.assets[0].uri, "image");
          
          if (uploadResult.success && uploadResult.data) {
            const numericId = parseInt(chatId, 10);
            const updateResult = await apiService.updateGroupAvatar(numericId, uploadResult.data);
            
            if (updateResult.success) {
              setAvatarUrl(uploadResult.data);
              refreshChats();
            } else {
              Alert.alert(t("common.error"), updateResult.error || t("errors.somethingWentWrong"));
            }
          } else {
            Alert.alert(t("common.error"), uploadResult.error || t("errors.somethingWentWrong"));
          }
          setIsUpdating(false);
        }
      } catch (error) {
        setIsUpdating(false);
        Alert.alert(t("common.error"), t("errors.somethingWentWrong"));
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("common.cancel"), t("profile.choosePhoto")],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImage();
          }
        }
      );
    } else {
      pickImage();
    }
  }, [chatId, t, refreshChats]);

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
        />
        <View style={[
          styles.headerCard,
          isDark ? CardStyles.dark : CardStyles.light,
        ]}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={isDark ? 15 : 30}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "rgba(30,32,34,0.97)" : "rgba(255,255,255,0.95)" },
              ]}
            />
          )}
          <View style={styles.headerContent}>
            <Pressable 
              style={[styles.groupAvatar, { backgroundColor: avatarColor }]}
              onPress={isCreator ? handleChangeAvatar : undefined}
              disabled={!isCreator || isUpdating}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Feather name="users" size={36} color="#FFFFFF" />
              )}
              {isCreator ? (
                <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="camera" size={12} color="#FFFFFF" />
                  )}
                </View>
              ) : null}
            </Pressable>
            <View style={styles.headerInfo}>
              <Pressable
                style={styles.groupNameContainer}
                onPress={isCreator ? handleEditName : undefined}
              >
                <ThemedText type="h4" style={styles.groupName}>
                  {groupName}
                </ThemedText>
                {isCreator ? (
                  <Feather name="edit-2" size={14} color={theme.textSecondary} style={styles.editIcon} />
                ) : null}
              </Pressable>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t("group.memberCount", { count: members.length })}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {(isCreator || isAdmin) ? (
        <SettingsSection title={t("group.actions")}>
          <SettingsItem
            icon="user-plus"
            label={t("group.addMembers")}
            onPress={handleAddMembers}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t("group.members")}>
        {members.map((member) => {
          const isCurrentUser = member.id === currentUserId;
          const isMemberCreator = member.id === createdBy;
          const isMemberAdmin = member.role === "admin";
          
          const roleLabel = isMemberCreator 
            ? t("group.creator") 
            : isMemberAdmin 
              ? t("group.admin") 
              : undefined;

          return (
            <Pressable
              key={member.id}
              style={styles.memberItem}
              onPress={() => !isCurrentUser && handleOpenChat(member)}
            >
              <View style={[styles.memberAvatar, { backgroundColor: member.avatarColor }]}>
                {member.avatarUrl ? (
                  <Image
                    source={{ uri: member.avatarUrl }}
                    style={styles.memberAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <ThemedText style={styles.memberAvatarText}>
                    {member.displayName?.charAt(0)?.toUpperCase() ?? "?"}
                  </ThemedText>
                )}
              </View>
              <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                  <ThemedText style={styles.memberName} numberOfLines={1}>
                    {member.displayName}
                    {isCurrentUser ? ` (${t("group.you")})` : ""}
                  </ThemedText>
                  {roleLabel ? (
                    <View style={[styles.roleBadge, { backgroundColor: theme.primary + "20" }]}>
                      <ThemedText style={[styles.roleBadgeText, { color: theme.primary }]}>
                        {roleLabel}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                {member.email ? (
                  <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
                    {member.email}
                  </ThemedText>
                ) : null}
              </View>
              {isCreator && !isCurrentUser && !isMemberCreator ? (
                <View style={styles.memberActions}>
                  <Pressable
                    style={[
                      styles.actionIconButton,
                      { backgroundColor: isMemberAdmin ? theme.primary + "20" : theme.divider },
                    ]}
                    onPress={() => handleToggleAdmin(member)}
                  >
                    <Feather
                      name="shield"
                      size={14}
                      color={isMemberAdmin ? theme.primary : theme.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.actionIconButton, { backgroundColor: theme.accent + "15" }]}
                    onPress={() => handleRemoveMember(member)}
                  >
                    <Feather name="trash-2" size={14} color={theme.accent} />
                  </Pressable>
                </View>
              ) : (
                !isCurrentUser ? (
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                ) : null
              )}
            </Pressable>
          );
        })}
      </SettingsSection>

      <SettingsSection>
        <SettingsItem
          icon={isCreatorAlone ? "trash-2" : "log-out"}
          label={isCreatorAlone ? t("group.deleteGroup") : t("group.leaveGroup")}
          onPress={isCreatorAlone ? handleDeleteGroup : handleLeaveGroup}
          destructive
        />
      </SettingsSection>

      <Modal visible={isEditingName} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditingName(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
            onPress={(e) => e.stopPropagation()}
          >
            {Platform.OS === "ios" ? (
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={styles.modalInner}>
              <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.md }}>
                {t("group.editName")}
              </ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: theme.text,
                    borderColor: theme.inputBorder,
                    backgroundColor: theme.backgroundRoot,
                  },
                ]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder={t("chats.groupName")}
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.divider }]}
                  onPress={() => setIsEditingName(false)}
                >
                  <ThemedText style={{ color: theme.text }}>{t("common.cancel")}</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: theme.primary }]}
                  onPress={handleSaveName}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={{ color: "#FFFFFF" }}>{t("common.save")}</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  headerWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  headerGradient: {
    position: "absolute",
    top: -60,
    left: -Spacing.lg,
    right: -Spacing.lg,
    height: 180,
  },
  headerCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  groupAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  groupNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  groupName: {
    marginBottom: 2,
  },
  editIcon: {
    marginLeft: Spacing.sm,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  memberName: {
    fontSize: 16,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  memberActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  modalInner: {
    padding: Spacing.xl,
  },
  modalInput: {
    fontSize: 16,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
