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
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { apiService } from "@/services/api";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
};

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const { paddingTop, paddingBottom } = useScreenInsets({ topSpacing: Spacing.md });

  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateEmail = (email: string): boolean => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError(t("auth.invalidEmail"));
      return;
    }

    if (!validateEmail(email)) {
      setError(t("auth.invalidEmail"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.requestPasswordReset(email.trim().toLowerCase());
      
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigation.navigate("ResetPassword", { email: email.trim().toLowerCase() });
        }, 1500);
      } else {
        setError(result.error || t("errors.somethingWentWrong"));
      }
    } catch (err) {
      setError(t("errors.somethingWentWrong"));
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
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop, paddingBottom }
      ]}
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
                {t("auth.forgotPasswordTitle")}
              </ThemedText>
              <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
                {t("auth.forgotPasswordSubtitle")}
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
                      borderColor: error ? theme.accent : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"),
                      color: theme.text,
                    },
                  ]}
                  placeholder={t("auth.emailPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!success}
                />
                {error ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {error}
                  </ThemedText>
                ) : null}
              </View>

              {success ? (
                <View style={[styles.successContainer, { backgroundColor: theme.primary + "15" }]}>
                  <ThemedText type="body" style={{ color: theme.primary, textAlign: "center" }}>
                    {t("auth.codeSent")}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: theme.textSecondary,
                      textAlign: "center",
                      marginTop: Spacing.sm,
                      fontSize: 12,
                    }}
                  >
                    {t("auth.checkSpam")}
                  </ThemedText>
                </View>
              ) : null}

              <Button onPress={handleSendCode} disabled={isLoading || success} style={styles.button}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  t("auth.sendCode")
                )}
              </Button>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t("auth.rememberPassword")}{" "}
        </ThemedText>
        <ThemedText
          type="link"
          onPress={() => navigation.goBack()}
          style={{ fontWeight: "600" }}
        >
          {t("auth.signIn")}
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
  successContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.lg,
  },
});
