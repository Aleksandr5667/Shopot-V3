export interface User {
  id: string;
  visibleId?: number;
  email: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  visibleId?: number;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string;
  email?: string;
  bio?: string;
  isOnline?: boolean;
}

export interface ReplyToMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: "text" | "image" | "video" | "voice" | "system";
}

export type SystemActionType = 
  | "member_added" 
  | "member_removed" 
  | "member_left" 
  | "group_created" 
  | "name_changed" 
  | "avatar_changed" 
  | "admin_added" 
  | "admin_removed";

export interface SystemAction {
  action: SystemActionType;
  actorId: number;
  actorName: string;
  targetId?: number;
  targetName?: string;
  oldValue?: string;
  newValue?: string;
}

export interface Message {
  id: string;
  tempId?: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderColor?: string;
  text?: string;
  type?: "text" | "image" | "video" | "voice" | "system";
  mediaType?: "photo" | "video" | "audio";
  mediaUri?: string;
  mediaUrl?: string;
  audioDuration?: number;
  timestamp: string;
  status: "sending" | "sent" | "delivered" | "read" | "error";
  readBy?: string[];
  readAt?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  uploadError?: boolean;
  isEdited?: boolean;
  replyToId?: string;
  replyToMessage?: ReplyToMessage;
  systemAction?: SystemAction;
}

export interface GroupMember {
  id: number;
  visibleId?: number;
  displayName: string;
  email?: string;
  avatarColor: string;
  avatarUrl?: string;
  role: "admin" | "member";
  joinedAt: string;
  addedBy?: number;
}

export interface Chat {
  id: string;
  type?: "private" | "group";
  name?: string;
  description?: string;
  avatarUrl?: string;
  participantIds: string[];
  participant?: Contact;
  participants?: Contact[];
  members?: GroupMember[];
  isGroup?: boolean;
  groupName?: string;
  groupAvatarColor?: string;
  avatarColor?: string;
  createdBy?: number;
  memberCount?: number;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

export const AVATAR_COLORS = [
  "#0088CC",
  "#25D366",
  "#FF6B6B",
  "#9B59B6",
  "#E67E22",
  "#1ABC9C",
];

export const getRandomAvatarColor = (): string => {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};
