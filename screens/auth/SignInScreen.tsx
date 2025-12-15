import React, { useState } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { AuthStackParamList } from "@/navigation/types";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

type SignInScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignIn">;
};

export default function SignInScreen({ navigation }: SignInScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = t("auth.invalidEmail");
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t("auth.invalidEmail");
    }

    if (!password) {
      newErrors.password = t("auth.passwordTooShort");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setIsLoading(true);
    setGeneralError(null);
    try {
      const result = await signIn(email, password);
      if (!result.success) {
        const errorLower = (result.error || "").toLowerCase();
        if (errorLower.includes("not verified") || errorLower.includes("не подтвержд") || errorLower.includes("verify") || errorLower.includes("верификац")) {
          navigation.navigate("EmailVerification", { email: email.trim().toLowerCase() });
          return;
        }
        setGeneralError(result.error || t("errors.somethingWentWrong"));
      }
    } catch (error) {
      setGeneralError(t("errors.somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  const gradientColors = isDark
    ? [theme.primary + "40", theme.primary + "20", "transparent"] as const
    : [theme.primary + "25", theme.primary + "10", "transparent"] as const;

  const cardStyle = isDark ? CardStyles.dark : CardStyles.light;

  const renderBlurBackground = () => {
    if (Platform.OS === "ios") {
      return (
        <BlurView
          intensity={isDark ? 15 : 30}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      );
    }
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? "rgba(30,32,34,0.97)" : "rgba(255,255,255,0.95)" },
        ]}
      />
    );
  };

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.headerGradient}
        />
        <View style={[styles.card, cardStyle]}>
          {renderBlurBackground()}
          <View style={styles.cardContent}>
            <View style={styles.header}>
              <ThemedText type="h2" style={styles.title}>
                {t("auth.signIn")}
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.subtitle, { color: theme.textSecondary }]}
              >
                {t("auth.welcome")}
              </ThemedText>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.label}>
                  {t("auth.email")}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      borderColor: errors.email ? theme.accent : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"),
                      color: theme.text,
                    },
                  ]}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.email}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.label}>
                  {t("auth.password")}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      borderColor: errors.password ? theme.accent : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"),
                      color: theme.text,
                    },
                  ]}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                {errors.password ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.password}
                  </ThemedText>
                ) : null}
              </View>

              {generalError ? (
                <View style={[styles.errorContainer, { backgroundColor: theme.accent + '15' }]}>
                  <ThemedText type="body" style={{ color: theme.accent, textAlign: 'center' }}>
                    {generalError}
                  </ThemedText>
                </View>
              ) : null}

              <ThemedText
                type="link"
                onPress={() => navigation.navigate("ForgotPassword")}
                style={styles.forgotPassword}
              >
                {t("auth.forgotPassword")}
              </ThemedText>

              <Button onPress={handleSignIn} disabled={isLoading} style={styles.button}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  t("auth.signInButton")
                )}
              </Button>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t("auth.noAccount")}{" "}
        </ThemedText>
        <ThemedText
          type="link"
          onPress={() => navigation.replace("SignUp")}
          style={{ fontWeight: "600" }}
        >
          {t("auth.signUp")}
        </ThemedText>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  cardWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  headerGradient: {
    position: "absolute",
    top: -80,
    left: -Spacing.lg,
    right: -Spacing.lg,
    height: 200,
  },
  card: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  cardContent: {
    padding: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {},
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  button: {
    marginTop: Spacing.sm,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  forgotPassword: {
    textAlign: "right",
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
});
