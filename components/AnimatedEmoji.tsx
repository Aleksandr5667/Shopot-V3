import React, { useMemo } from "react";
import { View, StyleSheet, Text } from "react-native";
import LottieView from "lottie-react-native";

const EMOJI_ANIMATIONS: Record<string, any> = {
  "❤️": require("@/assets/animations/emojis/heart.json"),
  "❤": require("@/assets/animations/emojis/heart.json"),
  "👍": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏻": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏼": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏽": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏾": require("@/assets/animations/emojis/thumbs-up.json"),
  "👍🏿": require("@/assets/animations/emojis/thumbs-up.json"),
  "😂": require("@/assets/animations/emojis/laugh-cry.json"),
  "😍": require("@/assets/animations/emojis/heart-eyes.json"),
  "🔥": require("@/assets/animations/emojis/fire.json"),
  "🎉": require("@/assets/animations/emojis/party.json"),
  "👎": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏻": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏼": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏽": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏾": require("@/assets/animations/emojis/thumbs-down.json"),
  "👎🏿": require("@/assets/animations/emojis/thumbs-down.json"),
  "😭": require("@/assets/animations/emojis/crying.json"),
  "😮": require("@/assets/animations/emojis/surprised.json"),
  "😡": require("@/assets/animations/emojis/angry.json"),
  "🤬": require("@/assets/animations/emojis/angry.json"),
  "😊": require("@/assets/animations/emojis/smiling.json"),
  "🙂": require("@/assets/animations/emojis/smiling.json"),
  "🤔": require("@/assets/animations/emojis/thinking.json"),
  "💯": require("@/assets/animations/emojis/hundred.json"),
  "✅": require("@/assets/animations/emojis/check.json"),
  "❌": require("@/assets/animations/emojis/cross.json"),
};

const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Regional_Indicator}{2})(\p{Emoji_Modifier})?/gu;

interface AnimatedEmojiProps {
  emoji: string;
  size: number;
}

export function AnimatedEmoji({ emoji, size }: AnimatedEmojiProps) {
  const normalizedEmoji = emoji.replace(/\uFE0F/g, "");
  const animation = EMOJI_ANIMATIONS[emoji] || EMOJI_ANIMATIONS[normalizedEmoji];
  
  if (!animation) {
    return (
      <Text style={[styles.fallbackEmoji, { fontSize: size * 0.85 }]}>
        {emoji}
      </Text>
    );
  }

  return (
    <LottieView
      source={animation}
      autoPlay
      loop
      style={{ width: size, height: size }}
    />
  );
}

interface AnimatedEmojiTextProps {
  text: string;
  emojiSize: number;
}

export function AnimatedEmojiText({ text, emojiSize }: AnimatedEmojiTextProps) {
  const parts = useMemo(() => {
    const result: Array<{ type: "emoji" | "text"; content: string }> = [];
    let lastIndex = 0;
    
    const matches = text.matchAll(EMOJI_REGEX);
    
    for (const match of matches) {
      if (match.index !== undefined && match.index > lastIndex) {
        result.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      result.push({ type: "emoji", content: match[0] });
      lastIndex = (match.index || 0) + match[0].length;
    }
    
    if (lastIndex < text.length) {
      result.push({ type: "text", content: text.slice(lastIndex) });
    }
    
    return result;
  }, [text]);

  return (
    <View style={styles.container}>
      {parts.map((part, index) => {
        if (part.type === "emoji") {
          return (
            <View key={index} style={styles.emojiWrapper}>
              <AnimatedEmoji emoji={part.content} size={emojiSize} />
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

export function hasAnimatedEmoji(text: string): boolean {
  const matches = text.match(EMOJI_REGEX);
  if (!matches) return false;
  
  return matches.some(emoji => {
    const normalizedEmoji = emoji.replace(/\uFE0F/g, "");
    return EMOJI_ANIMATIONS[emoji] || EMOJI_ANIMATIONS[normalizedEmoji];
  });
}

export function getAnimatedEmojis(text: string): string[] {
  const matches = text.match(EMOJI_REGEX);
  if (!matches) return [];
  return matches;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackEmoji: {
    textAlign: "center",
  },
});
