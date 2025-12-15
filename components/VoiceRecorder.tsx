import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, useAudioRecorderState } from "expo-audio";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { ThemedText } from "./ThemedText";
import { InlineNotificationBanner } from "./NotificationBanner";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import * as Haptics from "expo-haptics";

interface VoiceRecorderProps {
  onRecordComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecordComplete, onCancel }: VoiceRecorderProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  
  const pulse = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    checkPermission();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (recorderState.isRecording) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withSpring(1);
    }
  }, [recorderState.isRecording, pulse]);

  const checkPermission = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
    } catch (error) {
      setPermissionGranted(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    if (!permissionGranted) {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
      if (!status.granted) {
        console.log("[VoiceRecorder] Permission denied");
        return;
      }
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      setRecordingError(null);
      
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      
      if (errorMessage.includes("Session activation failed") || 
          errorMessage.includes("audio session")) {
        setRecordingError(t("chats.recordingUnavailableDuringCall"));
      } else {
        setRecordingError(t("chats.recordingFailed"));
      }
      
      if (__DEV__) {
        console.log("[VoiceRecorder] Recording error:", error);
      }
    }
  }, [audioRecorder, permissionGranted, t]);

  const stopRecording = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
      });

      const uri = audioRecorder.uri;
      const duration = recordingDuration;

      if (uri && duration >= 1) {
        onRecordComplete(uri, duration);
      } else {
        onCancel();
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      onCancel();
    }
  }, [audioRecorder, recordingDuration, onRecordComplete, onCancel]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await audioRecorder.stop();
    } catch (error) {
      console.error("Failed to cancel recording:", error);
    }
    
    onCancel();
  }, [audioRecorder, onCancel]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (permissionGranted === false) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {t("media.permissionRequired")}
        </ThemedText>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {t("media.useExpoGo")}
        </ThemedText>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Feather name="x" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <Pressable onPress={cancelRecording} style={styles.cancelButton}>
        <Feather name="x" size={20} color={theme.textSecondary} />
      </Pressable>

      <View style={styles.recordingInfo}>
        {recordingError ? (
          <InlineNotificationBanner
            type="error"
            message={recordingError}
            visible={true}
            onDismiss={() => setRecordingError(null)}
          />
        ) : recorderState.isRecording ? (
          <View style={styles.recordingStatus}>
            <Animated.View
              style={[
                styles.recordingDot,
                { backgroundColor: "#FF3B30" },
                pulseStyle,
              ]}
            />
            <ThemedText type="body" style={styles.durationText}>
              {formatDuration(recordingDuration)}
            </ThemedText>
          </View>
        ) : (
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            {t("chats.tapToRecord")}
          </ThemedText>
        )}
      </View>

      <Animated.View style={buttonStyle}>
        <Pressable
          onPressIn={() => {
            scale.value = withSpring(0.9);
          }}
          onPressOut={() => {
            scale.value = withSpring(1);
          }}
          onPress={() => {
            if (recorderState.isRecording) {
              stopRecording();
            } else {
              startRecording();
            }
          }}
          style={[
            styles.recordButton,
            {
              backgroundColor: recorderState.isRecording ? "#FF3B30" : theme.primary,
            },
          ]}
        >
          <Feather
            name={recorderState.isRecording ? "square" : "mic"}
            size={24}
            color="#FFFFFF"
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  cancelButton: {
    padding: Spacing.sm,
  },
  recordingInfo: {
    flex: 1,
    alignItems: "center",
  },
  recordingStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  durationText: {
    fontVariant: ["tabular-nums"],
  },
  recordButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
