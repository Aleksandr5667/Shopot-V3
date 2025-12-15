import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { AuthStackParamList } from "@/navigation/types";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, CardStyles } from "@/constants/theme";
import api from "@/services/api";

type SignUpScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignUp">;
};

type EmailStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  const emailCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedEmailRef = useRef<string>("");

  const isValidEmailFormat = (emailValue: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim());
  };

  const checkEmailAvailability = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck.trim() || !isValidEmailFormat(emailToCheck)) {
      setEmailStatus(emailToCheck.trim() ? "invalid" : "idle");
      return;
    }

    if (lastCheckedEmailRef.current === emailToCheck.toLowerCase()) {
      return;
    }

    setEmailStatus("checking");
    lastCheckedEmailRef.current = emailToCheck.toLowerCase();

    try {
      const result = await api.checkEmailAvailable(emailToCheck);
      
      if (lastCheckedEmailRef.current !== emailToCheck.toLowerCase()) {
        return;
      }

      if (result.success && result.data) {
        setEmailStatus(result.data.available ? "available" : "taken");
        if (!result.data.available) {
          setErrors(prev => ({ ...prev, email: t("errors.emailAlreadyExists") }));
        } else {
          setErrors(prev => {
            const newErrors = { ...prev };
            if (newErrors.email === t("errors.emailAlreadyExists")) {
              delete newErrors.email;
            }
            return newErrors;
          });
        }
      } else {
        setEmailStatus("error");
      }
    } catch (error) {
      console.error("Email check error:", error);
      setEmailStatus("error");
    }
  }, [t]);

  useEffect(() => {
    if (emailCheckTimeoutRef.current) {
      clearTimeout(emailCheckTimeoutRef.current);
    }

    if (!email.trim()) {
      setEmailStatus("idle");
      return;
    }

    if (!isValidEmailFormat(email)) {
      setEmailStatus("invalid");
      return;
    }

    emailCheckTimeoutRef.current = setTimeout(() => {
      checkEmailAvailability(email);
    }, 500);

    return () => {
      if (emailCheckTimeoutRef.current) {
        clearTimeout(emailCheckTimeoutRef.current);
      }
    };
  }, [email, checkEmailAvailability]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = t("auth.nameRequired");
    }

    if (!email.trim()) {
      newErrors.email = t("auth.invalidEmail");
    } else if (!isValidEmailFormat(email)) {
      newErrors.email = t("auth.invalidEmail");
    } else if (emailStatus === "taken") {
      newErrors.email = t("errors.emailAlreadyExists");
    }

    if (!password || password.length < 8) {
      newErrors.password = t("auth.passwordTooShort");
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    if (emailStatus === "checking") {
      return;
    }

    if (emailStatus === "taken") {
      setGeneralError(t("errors.emailAlreadyExists"));
      return;
    }

    setIsLoading(true);
    setGeneralError(null);
    try {
      const registerResult = await api.register(email, password, displayName);
      
      if (!registerResult.success) {
        const errorMessage = registerResult.error?.toLowerCase() || "";
        let displayError = t("errors.registrationFailed");
        
        if (errorMessage.includes("email") && (errorMessage.includes("exists") || errorMessage.includes("already") || errorMessage.includes("taken"))) {
          displayError = t("errors.emailAlreadyExists");
          setEmailStatus("taken");
        } else if (errorMessage.includes("пароль") || errorMessage.includes("password") || errorMessage.includes("символ") || errorMessage.includes("character")) {
          displayError = t("auth.passwordTooShort");
          setErrors(prev => ({ ...prev, password: t("auth.passwordTooShort") }));
        } else if (errorMessage.includes("network")) {
          displayError = t("errors.networkError");
        }
        
        setGeneralError(displayError);
        return;
      }

      const verificationResult = await api.sendVerificationCode(email.trim().toLowerCase());
      
      if (verificationResult.success) {
        navigation.replace("EmailVerification", { email: email.trim().toLowerCase() });
      } else {
        navigation.replace("EmailVerification", { email: email.trim().toLowerCase() });
      }
    } catch (error) {
      setGeneralError(t("errors.networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const getEmailStatusIcon = () => {
    switch (emailStatus) {
      case "checking":
        return <ActivityIndicator size="small" color={theme.primary} />;
      case "available":
        return <Feather name="check-circle" size={20} color="#22c55e" />;
      case "taken":
        return <Feather name="x-circle" size={20} color={theme.accent} />;
      case "invalid":
        return <Feather name="alert-circle" size={20} color="#f59e0b" />;
      case "error":
        return <Feather name="wifi-off" size={20} color={theme.textSecondary} />;
      default:
        return null;
    }
  };

  const getEmailBorderColor = () => {
    if (errors.email) return theme.accent;
    switch (emailStatus) {
      case "available":
        return "#22c55e";
      case "taken":
        return theme.accent;
      case "invalid":
        return "#f59e0b";
      default:
        return isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
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

  const inputBorderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const inputBgColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

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
                {t("auth.createAccount")}
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.subtitle, { color: theme.textSecondary }]}
              >
                {t("auth.welcomeSubtitle")}
              </ThemedText>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.label}>
                  {t("auth.displayName")}
                </ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputBgColor,
                      borderColor: errors.displayName ? theme.accent : inputBorderColor,
                      color: theme.text,
                    },
                  ]}
                  placeholder={t("auth.namePlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                {errors.displayName ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.displayName}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.label}>
                  {t("auth.email")}
                </ThemedText>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputPaddingRight,
                      {
                        backgroundColor: inputBgColor,
                        borderColor: getEmailBorderColor(),
                        color: theme.text,
                      },
                    ]}
                    placeholder={t("auth.emailPlaceholder")}
                    placeholderTextColor={theme.textSecondary}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.email;
                          return newErrors;
                        });
                      }
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.inputIcon}>
                    {getEmailStatusIcon()}
                  </View>
                </View>
                {errors.email ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.email}
                  </ThemedText>
                ) : emailStatus === "available" ? (
                  <ThemedText type="caption" style={{ color: "#22c55e" }}>
                    {t("auth.emailAvailable")}
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
                      backgroundColor: inputBgColor,
                      borderColor: errors.password ? theme.accent : inputBorderColor,
                      color: theme.text,
                    },
                  ]}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.password ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.password}
                  </ThemedText>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <ThemedText type="small" style={styles.label}>
                  {t("auth.confirmPassword")}
                </ThemedText>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.inputPaddingRight,
                      {
                        backgroundColor: inputBgColor,
                        borderColor: errors.confirmPassword 
                          ? theme.accent 
                          : confirmPassword && password 
                            ? (password === confirmPassword ? "#22c55e" : "#f59e0b")
                            : inputBorderColor,
                        color: theme.text,
                      },
                    ]}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    placeholderTextColor={theme.textSecondary}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errors.confirmPassword) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.confirmPassword;
                          return newErrors;
                        });
                      }
                    }}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.inputIcon}>
                    {confirmPassword && password ? (
                      password === confirmPassword ? (
                        <Feather name="check-circle" size={20} color="#22c55e" />
                      ) : (
                        <Feather name="x-circle" size={20} color="#f59e0b" />
                      )
                    ) : null}
                  </View>
                </View>
                {errors.confirmPassword ? (
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {errors.confirmPassword}
                  </ThemedText>
                ) : confirmPassword && password ? (
                  password === confirmPassword ? (
                    <ThemedText type="caption" style={{ color: "#22c55e" }}>
                      {t("auth.passwordsMatch")}
                    </ThemedText>
                  ) : (
                    <ThemedText type="caption" style={{ color: "#f59e0b" }}>
                      {t("auth.passwordMismatch")}
                    </ThemedText>
                  )
                ) : null}
              </View>

              {generalError ? (
                <View style={[styles.errorContainer, { backgroundColor: theme.accent + '15' }]}>
                  <ThemedText type="body" style={{ color: theme.accent, textAlign: 'center' }}>
                    {generalError}
                  </ThemedText>
                </View>
              ) : null}

              <Button 
                onPress={handleSignUp} 
                disabled={isLoading || emailStatus === "checking" || emailStatus === "taken"} 
                style={styles.button}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  t("auth.signUpButton")
                )}
              </Button>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t("auth.hasAccount")}{" "}
        </ThemedText>
        <ThemedText
          type="link"
          onPress={() => navigation.replace("SignIn")}
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
    paddingVertical: Spacing.xl,
  },
  cardWrapper: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {},
  form: {
    gap: Spacing.md,
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
  inputWithIcon: {
    position: "relative",
  },
  inputPaddingRight: {
    paddingRight: Spacing.xl + Spacing.md,
  },
  inputIcon: {
    position: "absolute",
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    marginTop: Spacing.sm,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
});
