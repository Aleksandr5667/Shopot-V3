import { Platform } from "react-native";

export const ShepotColors = {
  primary: "#0088CC",
  secondary: "#25D366",
  accent: "#FF6B6B",
  background: "#F7F7F7",
  surface: "#FFFFFF",
  messageOutgoing: "#DCF8C6",
  textPrimary: "#222222",
  textSecondary: "#999999",
  divider: "#E0E0E0",
  inputBorder: "#E0E0E0",
  pressedBackground: "#F0F0F0",
};

const tintColorLight = ShepotColors.primary;
const tintColorDark = "#0A84FF";

export const Colors = {
  light: {
    text: ShepotColors.textPrimary,
    textSecondary: ShepotColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    link: ShepotColors.primary,
    backgroundRoot: ShepotColors.background,
    backgroundDefault: ShepotColors.surface,
    backgroundSecondary: "#E6E6E6",
    backgroundTertiary: "#D9D9D9",
    primary: ShepotColors.primary,
    secondary: ShepotColors.secondary,
    accent: ShepotColors.accent,
    messageOutgoing: ShepotColors.messageOutgoing,
    messageIncoming: ShepotColors.surface,
    divider: ShepotColors.divider,
    inputBorder: ShepotColors.inputBorder,
    inputBackground: ShepotColors.background,
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: "#0A84FF",
    backgroundRoot: "#1F2123",
    backgroundDefault: "#2A2C2E",
    backgroundSecondary: "#353739",
    backgroundTertiary: "#404244",
    primary: "#0088CC",
    secondary: "#25D366",
    accent: "#FF6B6B",
    messageOutgoing: "#005C4B",
    messageIncoming: "#2A2C2E",
    divider: "#404244",
    inputBorder: "#404244",
    inputBackground: "#2A2C2E",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 48,
  avatarSmall: 32,
  avatarMedium: 48,
  avatarLarge: 80,
  chatListItemHeight: 72,
  messageInputHeight: 56,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
  messageBubble: 12,
  messageTail: 2,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const CardStyles = {
  light: {
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dark: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.10)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
};
