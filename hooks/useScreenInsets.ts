import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { Spacing } from "@/constants/theme";

export const ANDROID_NAVIGATION_BAR_HEIGHT = 48;

interface ScreenInsetsOptions {
  topSpacing?: number;
  bottomSpacing?: number;
}

export function useScreenInsets(options?: ScreenInsetsOptions) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const topSpacing = options?.topSpacing ?? Spacing.xl;
  const bottomSpacing = options?.bottomSpacing ?? Spacing.xl;

  const bottomInset = Platform.OS === "android" 
    ? Math.max(insets.bottom, ANDROID_NAVIGATION_BAR_HEIGHT)
    : insets.bottom;

  return {
    paddingTop: headerHeight + topSpacing,
    paddingBottom: bottomInset + bottomSpacing,
    scrollInsetBottom: bottomInset + 16,
    rawBottomInset: bottomInset,
    headerHeight,
    topInset: insets.top,
  };
}
