import React, { useEffect, memo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TypingIndicatorProps {
  name?: string;
}

const DOT_SIZE = 8;
const WAVE_HEIGHT = 6;

function AnimatedDot({ index, color }: { index: number; color: string }) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const duration = 350;
    const delay = index * 120;

    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-WAVE_HEIGHT, { 
            duration, 
            easing: Easing.bezier(0.4, 0, 0.2, 1) 
          }),
          withTiming(0, { 
            duration, 
            easing: Easing.bezier(0.4, 0, 0.2, 1) 
          })
        ),
        -1,
        false
      )
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration, easing: Easing.out(Easing.ease) }),
          withTiming(0.9, { duration, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [-WAVE_HEIGHT, 0],
      [1, 0.5],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

function TypingIndicatorComponent({ name }: TypingIndicatorProps) {
  const { theme } = useTheme();
  const containerScale = useSharedValue(0);
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    containerScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    containerOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
    opacity: containerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerAnimStyle]}>
      <View 
        style={[
          styles.bubble, 
          { backgroundColor: theme.messageIncoming }
        ]}
      >
        {name ? (
          <ThemedText style={[styles.text, { color: theme.textSecondary }]}>
            {name}
          </ThemedText>
        ) : null}
        <View style={styles.dots}>
          <AnimatedDot index={0} color={theme.primary} />
          <AnimatedDot index={1} color={theme.primary} />
          <AnimatedDot index={2} color={theme.primary} />
        </View>
      </View>
    </Animated.View>
  );
}

export const TypingIndicator = memo(TypingIndicatorComponent);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.messageBubble,
    borderBottomLeftRadius: BorderRadius.messageTail,
  },
  text: {
    fontSize: 13,
    marginRight: Spacing.sm,
    fontWeight: "500",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    height: DOT_SIZE + WAVE_HEIGHT * 2,
    paddingTop: WAVE_HEIGHT,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: 3,
  },
});
