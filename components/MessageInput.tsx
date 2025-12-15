import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, Platform, Keyboard } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync, useAudioRecorderState } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "./ThemedText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 400,
  mass: 0.5,
};

interface MessageInputProps {
  onSend: (text: string) => void;
  onAttachPress: () => void;
  onVoiceMessage?: (uri: string, duration: number) => void;
  onTyping?: () => void;
  editingMessage?: { id: string; text?: string } | null;
  editText?: string;
  onEditTextChange?: (text: string) => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
}

export function MessageInput({ 
  onSend, 
  onAttachPress, 
  onVoiceMessage, 
  onTyping,
  editingMessage,
  editText,
  onEditTextChange,
  onCancelEdit,
  onSaveEdit,
}: MessageInputProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const lastTypingTime = useRef<number>(0);
  
  const isRecordingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const recordingDurationRef = useRef(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  
  const isEditing = !!editingMessage;
  const displayText = isEditing ? (editText || "") : text;
  
  const sendButtonScale = useSharedValue(1);
  const sendButtonRotation = useSharedValue(0);
  const buttonAppear = useSharedValue(displayText.trim() ? 1 : 0);
  const isEditingSV = useSharedValue(isEditing ? 1 : 0);
  const micScale = useSharedValue(1);
  const recordingPulse = useSharedValue(1);
  const slideX = useSharedValue(0);
  const recordingOpacity = useSharedValue(0);

  useEffect(() => {
    isEditingSV.value = isEditing ? 1 : 0;
    buttonAppear.value = withSpring(displayText.trim() || isEditing ? 1 : 0, SPRING_CONFIG);
  }, [displayText, isEditing]);

  useEffect(() => {
    if (isRecording) {
      recordingOpacity.value = withTiming(1, { duration: 200 });
      recordingPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      recordingOpacity.value = withTiming(0, { duration: 200 });
      recordingPulse.value = withSpring(1);
    }
  }, [isRecording]);

  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (isRecordingRef.current) return;
    
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      isRecordingRef.current = true;
      cancelRequestedRef.current = false;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      slideX.value = 0;
      
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newVal = prev + 1;
          recordingDurationRef.current = newVal;
          return newVal;
        });
      }, 1000);
    } catch (error) {
      console.error("Failed to start recording:", error);
      isRecordingRef.current = false;
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async (cancelled: boolean = false) => {
    if (!isRecordingRef.current) return;
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    isRecordingRef.current = false;

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
      });

      const duration = recordingDurationRef.current;
      if (!cancelled && duration >= 1 && onVoiceMessage) {
        const uri = audioRecorder.uri;
        if (uri) {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onVoiceMessage(uri, duration);
        }
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }

    setIsRecording(false);
    setRecordingDuration(0);
    slideX.value = withSpring(0);
  }, [audioRecorder, onVoiceMessage]);

  const markCancelRequested = useCallback(() => {
    cancelRequestedRef.current = true;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, []);

  const isCancelled = useSharedValue(false);
  const isGestureActive = useSharedValue(false);
  
  const handleRecordingStart = useCallback(() => {
    micScale.value = withSpring(1.3, SPRING_CONFIG);
    startRecording();
  }, [startRecording]);

  const handleRecordingEnd = useCallback(() => {
    if (isRecordingRef.current) {
      micScale.value = withSpring(1, SPRING_CONFIG);
      const wasCancelled = cancelRequestedRef.current;
      cancelRequestedRef.current = false;
      stopRecording(wasCancelled);
    }
  }, [stopRecording]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(200)
    .maxDistance(Number.MAX_SAFE_INTEGER)
    .shouldCancelWhenOutside(false)
    .enabled(!isKeyboardVisible)
    .onStart(() => {
      isGestureActive.value = true;
      isCancelled.value = false;
      runOnJS(handleRecordingStart)();
    })
    .onEnd(() => {
      if (isGestureActive.value) {
        isGestureActive.value = false;
        slideX.value = withSpring(0);
        runOnJS(handleRecordingEnd)();
      }
    })
    .onFinalize(() => {
      if (isGestureActive.value) {
        isGestureActive.value = false;
        slideX.value = withSpring(0);
        runOnJS(handleRecordingEnd)();
      }
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((event, stateManager) => {
      if (isGestureActive.value) {
        stateManager.activate();
      }
    })
    .onUpdate((event) => {
      if (event.translationX < 0) {
        slideX.value = event.translationX;
        if (event.translationX < -80 && !isCancelled.value) {
          isCancelled.value = true;
          runOnJS(markCancelRequested)();
        }
      }
    })
    .onEnd(() => {
      slideX.value = withSpring(0);
    })
    .onFinalize(() => {
      slideX.value = withSpring(0);
    });

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture);

  const triggerSendAnimation = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    sendButtonScale.value = withSequence(
      withTiming(0.85, { duration: 80 }),
      withSpring(1, SPRING_CONFIG)
    );
    sendButtonRotation.value = withSequence(
      withTiming(-15, { duration: 100 }),
      withSpring(0, SPRING_CONFIG)
    );
  }, []);

  const handleSend = useCallback(async () => {
    if (isEditing) {
      if (onSaveEdit) {
        triggerSendAnimation();
        onSaveEdit();
      }
      return;
    }
    
    const trimmedText = text.trim();
    if (trimmedText && !isSending) {
      triggerSendAnimation();
      setIsSending(true);
      setText("");
      try {
        await onSend(trimmedText);
      } finally {
        setIsSending(false);
      }
    }
  }, [text, isSending, onSend, triggerSendAnimation, isEditing, onSaveEdit]);

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: sendButtonScale.value },
      { rotate: `${sendButtonRotation.value}deg` },
    ],
  }));

  const sendButtonAppearStyle = useAnimatedStyle(() => {
    if (isEditingSV.value === 1) {
      return { opacity: 1, transform: [{ scale: 1 }], pointerEvents: 'auto' as const };
    }
    const shouldShow = buttonAppear.value > 0.5 ? 1 : buttonAppear.value;
    return {
      opacity: shouldShow,
      transform: [
        { scale: interpolate(shouldShow, [0, 1], [0.8, 1], Extrapolation.CLAMP) },
      ],
      pointerEvents: shouldShow > 0.5 ? 'auto' as const : 'none' as const,
    };
  });

  const micButtonAppearStyle = useAnimatedStyle(() => ({
    opacity: interpolate(buttonAppear.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(buttonAppear.value, [0, 1], [1, 0.8], Extrapolation.CLAMP) },
    ],
    pointerEvents: buttonAppear.value < 0.5 ? 'auto' as const : 'none' as const,
  }));

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slideX.value },
      { scale: micScale.value * recordingPulse.value },
    ],
  }));

  const recordingDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingPulse.value }],
  }));

  const recordingOverlayStyle = useAnimatedStyle(() => ({
    opacity: recordingOpacity.value,
    pointerEvents: recordingOpacity.value > 0.5 ? 'auto' as const : 'none' as const,
  }));

  const normalInputStyle = useAnimatedStyle(() => ({
    opacity: interpolate(recordingOpacity.value, [0, 1], [1, 0], Extrapolation.CLAMP),
    pointerEvents: recordingOpacity.value < 0.5 ? 'auto' as const : 'none' as const,
  }));

  const handleTextChange = useCallback((newText: string) => {
    if (isEditing && onEditTextChange) {
      onEditTextChange(newText);
      return;
    }
    
    setText(newText);
    
    if (onTyping && newText.length > 0) {
      const now = Date.now();
      if (now - lastTypingTime.current > 2000) {
        lastTypingTime.current = now;
        onTyping();
      }
    }
  }, [onTyping, isEditing, onEditTextChange]);

  return (
    <View style={{ backgroundColor: theme.inputBackground }}>
      {isEditing ? (
        <View style={[styles.editPanel, { backgroundColor: theme.backgroundSecondary, borderTopColor: theme.inputBorder }]}>
          <View style={[styles.editIndicator, { backgroundColor: theme.primary }]} />
          <View style={styles.editContent}>
            <ThemedText style={[styles.editLabel, { color: theme.primary }]}>
              {t("chat.editMessage")}
            </ThemedText>
            <ThemedText style={[styles.editPreview, { color: theme.textSecondary }]} numberOfLines={1}>
              {editingMessage?.text || ""}
            </ThemedText>
          </View>
          <Pressable style={styles.editCancelButton} onPress={onCancelEdit} hitSlop={10}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.inputBackground,
            paddingBottom: insets.bottom + Spacing.sm,
          },
        ]}
      >
        <Animated.View style={[styles.recordingOverlay, recordingOverlayStyle]}>
          <Animated.View style={[styles.recordingDotOuter, recordingDotStyle]}>
            <View style={styles.recordingDot} />
          </Animated.View>
          
          <ThemedText style={[styles.recordingTime, { color: theme.text }]}>
            {formatDuration(recordingDuration)}
          </ThemedText>
          
          <View style={styles.slideHint}>
            <Feather name="chevrons-left" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.slideText, { color: theme.textSecondary }]}>
              {t("chats.slideToCancel")}
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View style={[styles.normalInputRow, normalInputStyle]}>
          {isEditing ? (
            <Pressable
              onPress={onCancelEdit}
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          ) : (
            <Pressable
              onPress={onAttachPress}
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="paperclip" size={24} color={theme.primary} />
            </Pressable>
          )}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder={isEditing ? t("chat.editMessage") : t("chats.typeMessage")}
              placeholderTextColor={theme.textSecondary}
              value={displayText}
              onChangeText={handleTextChange}
              multiline
              maxLength={4096}
              autoFocus={isEditing}
            />
          </View>
        </Animated.View>

        <View style={styles.buttonContainer}>
          {isEditing ? null : (
            <Animated.View style={[styles.buttonWrapper, micButtonAppearStyle]}>
              <GestureDetector gesture={composedGesture}>
                <Animated.View style={micAnimatedStyle}>
                  <View
                    style={[
                      styles.micButton,
                      isRecording 
                        ? styles.micButtonRecording
                        : { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                      isKeyboardVisible && !isRecording && { opacity: 0.4 },
                    ]}
                    pointerEvents={isKeyboardVisible ? "none" : "auto"}
                  >
                    <Feather name="mic" size={22} color={isRecording ? "#FFFFFF" : theme.primary} />
                  </View>
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          )}
          
          <Animated.View style={[styles.buttonWrapper, styles.sendButtonOverlay, sendButtonAppearStyle]}>
            <AnimatedPressable
              onPress={handleSend}
              disabled={isSending}
              style={[
                styles.sendButton,
                { backgroundColor: isEditing ? "#25D366" : theme.primary },
                sendButtonAnimatedStyle,
              ]}
            >
              <Feather name={isEditing ? "check" : "send"} size={20} color="#FFFFFF" />
            </AnimatedPressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  normalInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  inputContainer: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: "center",
  },
  input: {
    fontSize: 16,
    maxHeight: 100,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonRecording: {
    backgroundColor: "#FF3B30",
  },
  buttonContainer: {
    width: 44,
    height: 44,
    marginLeft: Spacing.sm,
  },
  buttonWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sendButtonOverlay: {
    zIndex: 1,
  },
  editPanel: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  editIndicator: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  editContent: {
    flex: 1,
    justifyContent: "center",
  },
  editLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  editPreview: {
    fontSize: 13,
  },
  editCancelButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  recordingOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: Spacing.md,
    paddingRight: 60,
    gap: Spacing.sm,
  },
  recordingDotOuter: {
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 40,
  },
  slideHint: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  slideText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
