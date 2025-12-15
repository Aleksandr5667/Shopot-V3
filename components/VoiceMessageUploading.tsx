import React, { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { CircularProgress } from "./CircularProgress";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface VoiceMessageUploadingProps {
  progress: number;
  duration: number;
  isOwn: boolean;
  hasError?: boolean;
}

const WAVEFORM_BARS = 20;
const BAR_WIDTH = 3;
const BAR_GAP = 2;

function AnimatedWaveformBar({ index, color, delay }: { index: number; color: string; delay: number }) {
  const height = useSharedValue(4);
  
  useEffect(() => {
    height.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(4 + Math.random() * 16, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(4 + Math.random() * 8, { duration: 300, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

export function VoiceMessageUploading({ progress, duration, isOwn, hasError }: VoiceMessageUploadingProps) {
  const { theme } = useTheme();
  
  const primaryColor = hasError ? "#FF6B6B" : isOwn ? theme.primary : "#7C7C7C";
  const secondaryColor = hasError ? "#FF6B6B40" : isOwn ? `${theme.primary}60` : "#D0D0D0";

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const bars = useMemo(() => 
    Array.from({ length: WAVEFORM_BARS }, (_, i) => ({
      index: i,
      delay: i * 50,
    })),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        <CircularProgress
          progress={progress}
          size={44}
          strokeWidth={2.5}
          color={primaryColor}
          backgroundColor={secondaryColor}
          showPercentage={false}
          showIcon={true}
          iconName="mic"
          hasError={hasError}
        />
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.waveformWrapper}>
          {bars.map(({ index, delay }) => (
            <AnimatedWaveformBar
              key={index}
              index={index}
              color={secondaryColor}
              delay={delay}
            />
          ))}
        </View>

        <View style={styles.infoRow}>
          <ThemedText
            type="caption"
            style={[styles.duration, { color: theme.textSecondary }]}
          >
            {formatDuration(duration)}
          </ThemedText>
          <ThemedText
            type="caption"
            style={[styles.progressText, { color: theme.textSecondary }]}
          >
            {progress}%
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 200,
    paddingVertical: Spacing.xs,
  },
  progressContainer: {
    marginRight: Spacing.md,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  waveformWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: BAR_GAP,
  },
  waveformBar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  duration: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
