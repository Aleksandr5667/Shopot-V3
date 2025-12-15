import { Contact, Chat } from "@/store/types";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
  EmailVerification: { email: string };
};

export type DrawerParamList = {
  ChatsStack: undefined;
  Settings: undefined;
};

export type ChatsStackParamList = {
  ChatsList: undefined;
  Chat: { 
    chatId: string;
    participant?: Contact;
    isGroup?: boolean;
    groupName?: string;
    groupAvatarUrl?: string;
    memberCount?: number;
    groupParticipants?: Contact[];
  };
  MediaViewer: { uri: string; type: "photo" | "video" };
  AddContact: undefined;
  UserProfile: { user: Contact };
  CreateGroup: undefined;
  GroupInfo: { chatId: string };
  AddGroupMembers: { chatId: string; existingMemberIds: number[] };
  ForwardMessage: { 
    messageContent: string;
    messageType: "text" | "image" | "video" | "voice";
    mediaUrl?: string;
    mediaUri?: string;
    audioDuration?: number;
  };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  EditProfile: undefined;
  LanguageSettings: undefined;
  Legal: { type: "privacy" | "terms" };
};
