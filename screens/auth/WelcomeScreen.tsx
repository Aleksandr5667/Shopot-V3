import React, { useEffect, useCallback } from "react";
import { View, StyleSheet, Image, Platform, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { AuthStackParamList } from "@/navigation/types";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getStoredLanguage, changeLanguage } from "@/i18n";

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function GlassButton({ 
  onPress, 
  children, 
  variant = "primary",
  delay = 0,
}: { 
  onPress: () => void; 
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  delay?: number;
}) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 15, stiffness: 100 }));
  }, [delay, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const isPrimary = variant === "primary";
  const intensity = isDark ? 40 : 80;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.glassButtonWrapper,
        styles.glassButton,
        isPrimary ? { backgroundColor: theme.primary } : {},
        animatedStyle,
      ]}
    >
      {!isPrimary ? (
        Platform.OS === "ios" ? (
          <BlurView
            intensity={intensity}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View 
            style={[
              StyleSheet.absoluteFill, 
              { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.7)" }
            ]} 
          />
        )
      ) : null}
      <ThemedText 
        type="body" 
        style={[
          styles.glassButtonText, 
          { color: isPrimary ? "#FFFFFF" : theme.primary }
        ]}
      >
        {children}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    const loadLanguage = async () => {
      const lang = await getStoredLanguage();
      await changeLanguage(lang);
    };
    loadLanguage();

    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    titleTranslateY.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 100 }));
    
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
  }, [logoScale, logoOpacity, titleOpacity, titleTranslateY, subtitleOpacity]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const gradientColors = isDark 
    ? ["#1a1a2e", "#16213e", "#0f3460"] as const
    : ["#e8f4f8", "#d4e9f7", "#bde0fe"] as const;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.content}>
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <View style={[styles.logoGlow, { backgroundColor: theme.primary }]} />
            <View style={[styles.logoInner, { backgroundColor: theme.primary }]}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          <Animated.View style={titleAnimatedStyle}>
            <ThemedText type="h1" style={styles.title}>
              Шёпот
            </ThemedText>
          </Animated.View>

          <Animated.View style={subtitleAnimatedStyle}>
            <ThemedText
              type="body"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              {t("auth.welcomeSubtitle")}
            </ThemedText>
          </Animated.View>
        </View>

        <View style={styles.buttons}>
          <GlassButton 
            onPress={() => navigation.navigate("SignUp")}
            variant="primary"
            delay={600}
          >
            {t("auth.createAccount")}
          </GlassButton>

          <GlassButton 
            onPress={() => navigation.navigate("SignIn")}
            variant="secondary"
            delay={750}
          >
            {t("auth.signIn")}
          </GlassButton>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logoGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.2,
  },
  logoInner: {
    width: 120,
    height: 120,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    lineHeight: 24,
  },
  buttons: {
    gap: Spacing.md,
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingBottom: Spacing.xl,
  },
  glassButtonWrapper: {
    width: "100%",
  },
  glassButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glassButtonText: {
    fontWeight: "600",
    fontSize: 17,
  },
});
