import React, { useEffect, useRef, memo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Message } from "@/store/types";

interface MessageStatusProps {
  status: Message["status"];
  isOutgoing: boolean;
  color?: string;
  isEmojiOnly?: boolean;
}

const SPRING_CONFIG = {
  damping: 12,
  stiffness: 200,
  mass: 0.5,
};

function AnimatedCheck({ color, delay = 0 }: { color: string; delay?: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSpring(1, SPRING_CONFIG)
    );
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 150 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="check" size={14} color={color} />
    </Animated.View>
  );
}

function AnimatedDoubleCheck({ color, isRead }: { color: string; isRead?: boolean }) {
  const scale1 = useSharedValue(0);
  const scale2 = useSharedValue(0);
  const colorAnim = useSharedValue(isRead ? 1 : 0);

  useEffect(() => {
    scale1.value = withSpring(1, SPRING_CONFIG);
    scale2.value = withDelay(80, withSpring(1, SPRING_CONFIG));
    colorAnim.value = withTiming(isRead ? 1 : 0, { duration: 300 });
  }, [isRead]);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: scale1.value,
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: scale2.value,
  }));

  const checkColor = isRead ? "#0088CC" : color;

  return (
    <View style={styles.doubleCheck}>
      <Animated.View style={[styles.firstCheck, style1]}>
        <Feather name="check" size={14} color={checkColor} />
      </Animated.View>
      <Animated.View style={style2}>
        <Feather name="check" size={14} color={checkColor} />
      </Animated.View>
    </View>
  );
}

function AnimatedClock({ color }: { color: string }) {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 150 });
    rotation.value = withSequence(
      withTiming(15, { duration: 200 }),
      withSpring(0, SPRING_CONFIG)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="clock" size={14} color={color} />
    </Animated.View>
  );
}

function AnimatedError() {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.2, { damping: 8, stiffness: 300 }),
      withSpring(1, SPRING_CONFIG)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Feather name="alert-circle" size={14} color="#FF3B30" />
    </Animated.View>
  );
}

function MessageStatusComponent({ status, isOutgoing, color = "#8E8E93", isEmojiOnly }: MessageStatusProps) {
  if (!isOutgoing) return null;

  const iconColor = isEmojiOnly ? "#8E8E93" : color;

  const getIcon = () => {
    switch (status) {
      case "sending":
        return <AnimatedClock color={iconColor} />;
      case "sent":
        return <AnimatedCheck color={iconColor} />;
      case "delivered":
        return <AnimatedDoubleCheck color={iconColor} isRead={false} />;
      case "read":
        return <AnimatedDoubleCheck color={iconColor} isRead={true} />;
      case "error":
        return <AnimatedError />;
      default:
        return null;
    }
  };

  return <View style={styles.container}>{getIcon()}</View>;
}

export const MessageStatus = memo(MessageStatusComponent);

const styles = StyleSheet.create({
  container: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 20,
  },
  doubleCheck: {
    flexDirection: "row",
    alignItems: "center",
  },
  firstCheck: {
    marginRight: -8,
  },
});
