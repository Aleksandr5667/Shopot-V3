import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput, ActivityIndicator, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AuthStackParamList } from "@/navigation/types";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { apiService } from "@/services/api";
import { Spacing, BorderRadius } from "@/constants/theme";

type ResetPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ResetPassword">;
  route: RouteProp<AuthStackParamList, "ResetPassword">;
};

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { email } = route.params;
  const { paddingTop, paddingBottom } = useScreenInsets({ topSpacing: Spacing.md });

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      await apiService.requestPasswordReset(email);
      setResendCooldown(60);
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
      cooldownIntervalRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) {
              clearInterval(cooldownIntervalRef.current);
              cooldownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(t("errors.somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const codeString = code.join("");

    if (codeString.length !== 6) {
      setError(t("auth.invalidCode"));
      return;
    }

    if (newPassword.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.confirmPasswordReset(email, codeString, newPassword);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigation.navigate("SignIn");
        }, 2000);
      } else {
        setError(result.error || t("errors.somethingWentWrong"));
      }
    } catch (err) {
      setError(t("errors.somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop, paddingBottom }
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.title}>
          {t("auth.resetPasswordTitle")}
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("auth.resetPasswordSubtitle", { email })}
        </ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <ThemedText type="small" style={styles.label}>
            {t("auth.verificationCode")}
          </ThemedText>
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.codeInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: error ? theme.accent : theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!success}
              />
            ))}
          </View>
          <Pressable onPress={handleResendCode} disabled={resendCooldown > 0 || isLoading}>
            <ThemedText
              type="caption"
              style={{
                color: resendCooldown > 0 ? theme.textSecondary : theme.primary,
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              {resendCooldown > 0
                ? t("auth.resendCodeIn", { seconds: resendCooldown })
                : t("auth.resendCode")}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText type="small" style={styles.label}>
            {t("auth.newPassword")}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder={t("auth.newPasswordPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              setError(null);
            }}
            secureTextEntry
            editable={!success}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText type="small" style={styles.label}>
            {t("auth.confirmNewPassword")}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder={t("auth.confirmNewPasswordPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setError(null);
            }}
            secureTextEntry
            editable={!success}
          />
        </View>

        {error ? (
          <View style={[styles.errorContainer, { backgroundColor: theme.accent + "15" }]}>
            <ThemedText type="body" style={{ color: theme.accent, textAlign: "center" }}>
              {error}
            </ThemedText>
          </View>
        ) : null}

        {success ? (
          <View style={[styles.successContainer, { backgroundColor: theme.primary + "15" }]}>
            <ThemedText type="body" style={{ color: theme.primary, textAlign: "center" }}>
              {t("auth.passwordResetSuccess")}
            </ThemedText>
          </View>
        ) : null}

        <Button onPress={handleResetPassword} disabled={isLoading || success} style={styles.button}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            t("auth.resetPassword")
          )}
        </Button>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  header: {
    marginBottom: Spacing["3xl"],
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
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  codeInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  button: {
    marginTop: Spacing.md,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  successContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
});
