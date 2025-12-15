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
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";
import { Spacing, BorderRadius } from "@/constants/theme";

type EmailVerificationScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "EmailVerification">;
  route: RouteProp<AuthStackParamList, "EmailVerification">;
};

export default function EmailVerificationScreen({ navigation, route }: EmailVerificationScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { setUserFromVerification } = useAuth();
  const { email } = route.params;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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

    setIsSendingCode(true);
    try {
      const result = await apiService.sendVerificationCode(email);
      if (result.success) {
        setResendCooldown(60);
      } else {
        setError(result.error || t("errors.somethingWentWrong"));
      }
    } catch (err) {
      setError(t("errors.somethingWentWrong"));
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async () => {
    const codeString = code.join("");

    if (codeString.length !== 6) {
      setError(t("auth.invalidCode"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await apiService.verifyEmail(email, codeString);

      if (result.success && result.data) {
        setSuccess(true);
        if (result.data.token && result.data.user) {
          setTimeout(() => {
            setUserFromVerification(result.data!.user, result.data!.token);
          }, 1500);
        } else {
          setTimeout(() => {
            navigation.navigate("SignIn");
          }, 2000);
        }
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
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.title}>
          {t("auth.verifyEmailTitle")}
        </ThemedText>
        <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
          {t("auth.verifyEmailSubtitle", { email })}
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
          <Pressable onPress={handleResendCode} disabled={resendCooldown > 0 || isSendingCode}>
            <ThemedText
              type="caption"
              style={{
                color: resendCooldown > 0 ? theme.textSecondary : theme.primary,
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              {isSendingCode
                ? t("common.loading")
                : resendCooldown > 0
                ? t("auth.resendCodeIn", { seconds: resendCooldown })
                : t("auth.resendCode")}
            </ThemedText>
          </Pressable>
          <ThemedText
            type="caption"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginTop: Spacing.md,
              fontSize: 12,
            }}
          >
            {t("auth.checkSpam")}
          </ThemedText>
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
              {t("auth.emailVerified")}
            </ThemedText>
          </View>
        ) : null}

        <Button onPress={handleVerify} disabled={isLoading || success} style={styles.button}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            t("auth.verify")
          )}
        </Button>
      </View>

      <View style={styles.footer}>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          {t("auth.wrongEmail")}{" "}
        </ThemedText>
        <ThemedText
          type="link"
          onPress={() => navigation.navigate("SignUp")}
          style={{ fontWeight: "600" }}
        >
          {t("auth.changeEmail")}
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing["3xl"],
  },
});
