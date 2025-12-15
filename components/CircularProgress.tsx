import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
  showIcon?: boolean;
  iconName?: keyof typeof Feather.glyphMap;
  hasError?: boolean;
}

export function CircularProgress({
  progress,
  size = 56,
  strokeWidth = 3,
  color = "#FFFFFF",
  backgroundColor = "rgba(255,255,255,0.25)",
  showPercentage = true,
  showIcon = true,
  iconName = "arrow-up",
  hasError = false,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svgContainer}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={hasError ? "#FF6B6B" : color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.contentContainer}>
        {hasError ? (
          <Feather name="alert-circle" size={size * 0.35} color="#FF6B6B" />
        ) : showIcon ? (
          <Feather name={iconName} size={size * 0.35} color={color} />
        ) : null}
        {showPercentage && !hasError ? (
          <ThemedText style={[styles.percentageText, { fontSize: size * 0.2, color }]}>
            {Math.round(progress)}%
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  svgContainer: {
    position: "absolute",
  },
  contentContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  percentageText: {
    fontWeight: "700",
    marginTop: 2,
  },
});
