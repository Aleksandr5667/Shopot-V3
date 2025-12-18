import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Dimensions, Platform, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
  useDerivedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Message } from "@/store/types";
import { ThemedText } from "./ThemedText";
import { MessageStatus } from "./MessageStatus";
import { VoiceMessage } from "./VoiceMessage";
import { VoiceMessageUploading } from "./VoiceMessageUploading";
import { CachedImage } from "./CachedImage";
import { CircularProgress } from "./CircularProgress";
import { CachedVideo } from "./CachedVideo";
import { AnimatedEmojiText } from "./AnimatedEmoji";
import { mediaCache } from "@/services/mediaCache";
import { listenedMessagesService } from "@/services/listenedMessages";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

const loadedMediaCache = new Set<string>();

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isGroup?: boolean;
  onMediaPress?: () => void;
  onLongPress?: () => void;
  onRetry?: () => void;
  onQuotedMessagePress?: () => void;
  isHighlighted?: boolean;
  isDeleting?: boolean;
  onDeleteAnimationComplete?: () => void;
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;
const MEDIA_MAX_WIDTH = 260;

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.6,
};

const EMOJI_ONLY_REGEX = /^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\p{Emoji_Modifier_Base}\p{Emoji_Modifier}\p{Emoji_Component}\p{Regional_Indicator}\u200D\s]+$/u;
const EMOJI_COUNT_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Regional_Indicator}{2}/gu;

const MAX_COLLAPSED_LINES = 15;
const MAX_COLLAPSED_CHARS = 500;

function isEmojiOnlyMessage(text: string | undefined): boolean {
  if (!text || text.trim().length === 0) return false;
  const trimmed = text.trim();
  // Exclude messages that contain only digits (0-9) as they match \p{Emoji} but aren't actual emojis
  if (/^[\d\s]+$/.test(trimmed)) return false;
  return EMOJI_ONLY_REGEX.test(trimmed) && trimmed.length <= 20;
}

function countEmojis(text: string): number {
  const matches = text.match(EMOJI_COUNT_REGEX);
  return matches ? matches.length : 0;
}

function getEmojiSize(emojiCount: number): number {
  if (emojiCount === 1) return 72;
  if (emojiCount === 2) return 56;
  if (emojiCount === 3) return 48;
  if (emojiCount <= 5) return 40;
  return 32;
}

interface UploadProgressProps {
  progress: number;
  hasError?: boolean;
  mediaType?: "image" | "video" | "audio";
  uploadedBytes?: number;
  totalBytes?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadProgressOverlay({ progress, hasError, mediaType = "image", uploadedBytes, totalBytes }: UploadProgressProps) {
  const iconName = mediaType === "video" ? "video" : mediaType === "audio" ? "mic" : "image";
  const showBytesInfo = totalBytes && totalBytes > 0;
  
  return (
    <View style={styles.uploadOverlay}>
      <CircularProgress
        progress={progress}
        size={64}
        strokeWidth={3}
        color="#FFFFFF"
        backgroundColor="rgba(255,255,255,0.25)"
        showPercentage={true}
        showIcon={true}
        iconName={iconName}
        hasError={hasError}
      />
      {showBytesInfo ? (
        <ThemedText style={styles.bytesText}>
          {formatBytes(uploadedBytes || 0)} / {formatBytes(totalBytes)}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function MessageBubble({
  message,
  isOwn,
  isGroup,
  onMediaPress,
  onLongPress,
  onRetry,
  onQuotedMessagePress,
  isHighlighted,
  isDeleting,
  onDeleteAnimationComplete,
}: MessageBubbleProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const enterAnim = useSharedValue(0);
  const highlightAnim = useSharedValue(0);
  const pressAnim = useSharedValue(1);
  const deleteAnim = useSharedValue(1);
  
  const mediaKey = message.mediaUri || message.mediaUrl || "";
  const isAlreadyKnownLoaded = isOwn || loadedMediaCache.has(mediaKey);
  const [isMediaLoaded, setIsMediaLoaded] = useState(isAlreadyKnownLoaded);
  const [isCheckingCache, setIsCheckingCache] = useState(!isAlreadyKnownLoaded && !!mediaKey);
  const [isExpanded, setIsExpanded] = useState(false);
  // null = not yet determined, true = listened, false = not listened
  const [voiceListenedState, setVoiceListenedState] = useState<boolean | null>(() => {
    // If service is already initialized, use sync value
    if (listenedMessagesService.isInitialized()) {
      return listenedMessagesService.isListened(message.id);
    }
    return null; // Don't know yet
  });
  
  // Check listened status asynchronously
  useEffect(() => {
    if (message.type !== "voice") return;
    
    listenedMessagesService.isListenedAsync(message.id).then((listened) => {
      setVoiceListenedState(listened);
    });
  }, [message.id, message.type]);
  
  // For rendering: null means we haven't loaded yet, treat as listened to avoid flash
  const isVoiceListened = voiceListenedState === null ? true : voiceListenedState;
  
  const handleVoiceListened = useCallback((messageId: string) => {
    setVoiceListenedState(true);
    listenedMessagesService.markAsListened(messageId);
  }, []);

  const isLongMessage = message.text && (
    message.text.length > MAX_COLLAPSED_CHARS || 
    message.text.split('\n').length > MAX_COLLAPSED_LINES
  );

  const getCollapsedText = (text: string): string => {
    const lines = text.split('\n');
    if (lines.length > MAX_COLLAPSED_LINES) {
      return lines.slice(0, MAX_COLLAPSED_LINES).join('\n') + '...';
    }
    if (text.length > MAX_COLLAPSED_CHARS) {
      return text.slice(0, MAX_COLLAPSED_CHARS) + '...';
    }
    return text;
  };
  
  const handleLoadMedia = useCallback(() => {
    if (mediaKey) {
      loadedMediaCache.add(mediaKey);
      setIsMediaLoaded(true);
    }
  }, [mediaKey]);

  useEffect(() => {
    enterAnim.value = withSpring(1, SPRING_CONFIG);
  }, []);

  useEffect(() => {
    if (!isMediaLoaded && mediaKey) {
      setIsCheckingCache(true);
      mediaCache.getCachedUri(mediaKey).then((cachedUri) => {
        if (cachedUri) {
          loadedMediaCache.add(mediaKey);
          setIsMediaLoaded(true);
        }
        setIsCheckingCache(false);
      }).catch(() => {
        setIsCheckingCache(false);
      });
    }
  }, [mediaKey]);

  useEffect(() => {
    if (isHighlighted) {
      highlightAnim.value = withSpring(1, SPRING_CONFIG);
      setTimeout(() => {
        highlightAnim.value = withSpring(0, SPRING_CONFIG);
      }, 800);
    }
  }, [isHighlighted]);

  useEffect(() => {
    if (isDeleting) {
      deleteAnim.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      }, (finished) => {
        if (finished && onDeleteAnimationComplete) {
          runOnJS(onDeleteAnimationComplete)();
        }
      });
    }
  }, [isDeleting]);

  const triggerHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleLongPress = () => {
    triggerHaptic();
    onLongPress?.();
  };

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      pressAnim.value = withSpring(0.95, { damping: 20, stiffness: 400 });
      runOnJS(handleLongPress)();
    })
    .onFinalize(() => {
      pressAnim.value = withSpring(1, SPRING_CONFIG);
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      pressAnim.value = withSpring(0.97, { damping: 25, stiffness: 500 });
    })
    .onFinalize(() => {
      pressAnim.value = withSpring(1, SPRING_CONFIG);
    });

  const composedGesture = Gesture.Exclusive(longPressGesture, tapGesture);

  const enterAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const enterScale = interpolate(enterAnim.value, [0, 1], [0.85, 1], Extrapolation.CLAMP);
    const deleteScale = interpolate(deleteAnim.value, [0, 1], [0.6, 1], Extrapolation.CLAMP);
    
    return {
      opacity: enterAnim.value * deleteAnim.value,
      transform: [
        { scale: enterScale * deleteScale },
        { translateY: interpolate(enterAnim.value, [0, 1], [15, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressAnim.value }],
  }));

  const highlightStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: `rgba(0, 136, 204, ${interpolate(highlightAnim.value, [0, 1], [0, 0.15], Extrapolation.CLAMP)})`,
    };
  });

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const mediaSource = message.mediaUri || message.mediaUrl;
  const mediaType = message.mediaType || message.type;
  const hasMedia = mediaSource && mediaType;
  const isAudio = mediaType === "audio" || mediaType === "voice";
  
  const isEmojiOnly = !hasMedia && !message.replyToMessage && isEmojiOnlyMessage(message.text);

  const outgoingBackground = isDark 
    ? 'rgba(70, 70, 72, 0.95)' 
    : 'rgba(230, 230, 232, 0.98)';
  
  const outgoingTextColor = isDark ? '#FFFFFF' : '#1C1C1E';
  
  const incomingBackground = isDark 
    ? 'rgba(58, 58, 60, 0.95)' 
    : 'rgba(255, 255, 255, 0.98)';

  const showSenderName = isGroup && !isOwn && message.senderName;
  
  // Media-only message: has image/video but no text (excluding audio)
  const isMediaOnly = hasMedia && !isAudio && !message.text && !message.replyToMessage;

  const renderBubbleContent = () => {
    const bubbleRadius = 22;
    const tailRadius = 4;

    const bubbleStyles = [
      styles.bubble,
      isEmojiOnly && styles.emojiBubble,
      !isEmojiOnly && !isOwn && {
        backgroundColor: incomingBackground,
        borderTopLeftRadius: bubbleRadius,
        borderTopRightRadius: bubbleRadius,
        borderBottomLeftRadius: tailRadius,
        borderBottomRightRadius: bubbleRadius,
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 8,
          },
          android: {
            elevation: 3,
          },
        }),
      },
    ];

    const innerContent = (
      <>
        {showSenderName && !isMediaOnly ? (
          <ThemedText 
            style={[
              styles.senderName, 
              { color: message.senderColor || theme.primary }
            ]}
            numberOfLines={1}
          >
            {message.senderName}
          </ThemedText>
        ) : null}

        {message.replyToMessage ? (
          <Pressable 
            onPress={onQuotedMessagePress}
            style={[
              styles.quotedMessage, 
              { 
                backgroundColor: isOwn 
                  ? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)") 
                  : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
              }
            ]}
          >
            <View style={[styles.quotedBar, { backgroundColor: isOwn ? (isDark ? "#FFFFFF" : theme.primary) : theme.primary }]} />
            <View style={styles.quotedContent}>
              <ThemedText 
                style={[
                  styles.quotedName, 
                  { color: isOwn ? (isDark ? "rgba(255,255,255,0.9)" : theme.primary) : theme.primary }
                ]} 
                numberOfLines={1}
              >
                {message.replyToMessage.senderName}
              </ThemedText>
              <ThemedText 
                style={[
                  styles.quotedText, 
                  { color: isOwn ? (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)") : theme.textSecondary }
                ]} 
                numberOfLines={3}
              >
                {message.replyToMessage.type === "image" ? t("chat.photo") : 
                 message.replyToMessage.type === "video" ? t("chat.video") :
                 message.replyToMessage.type === "voice" ? t("chat.voiceMessage") :
                 message.replyToMessage.content || ""}
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        {isAudio && mediaSource ? (
          <View style={styles.mediaContainer}>
            {message.isUploading ? (
              <VoiceMessageUploading
                progress={message.uploadProgress || 0}
                duration={message.audioDuration || 0}
                isOwn={isOwn}
                hasError={message.uploadError}
              />
            ) : (
              <VoiceMessage
                uri={mediaSource}
                duration={message.audioDuration || 0}
                isOwn={isOwn}
                messageId={message.id}
                isListened={isVoiceListened}
                onListened={handleVoiceListened}
              />
            )}
          </View>
        ) : hasMedia ? (
          <Pressable 
            onPress={message.isUploading ? undefined : (isMediaLoaded ? onMediaPress : handleLoadMedia)} 
            style={[styles.mediaContainer, isMediaOnly && { marginBottom: 0 }]}
          >
            {mediaType === "photo" || mediaType === "image" ? (
              <View style={styles.mediaWrapper}>
                {message.isUploading ? (
                  <>
                    <Image
                      source={{ uri: mediaSource }}
                      style={[styles.media, styles.mediaUploading]}
                      contentFit="cover"
                    />
                    <UploadProgressOverlay 
                      progress={message.uploadProgress || 0} 
                      hasError={message.uploadError}
                      mediaType="image"
                      uploadedBytes={message.uploadedBytes}
                      totalBytes={message.totalBytes}
                    />
                  </>
                ) : isMediaLoaded ? (
                  <CachedImage
                    source={{ uri: mediaSource }}
                    style={styles.media}
                    contentFit="cover"
                  />
                ) : isCheckingCache ? (
                  <View style={[styles.media, styles.mediaPlaceholder]}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.media, styles.mediaPlaceholder]}>
                    <View style={styles.loadMediaButton}>
                      <Feather name="image" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={styles.loadMediaText}>{t("chat.tapToLoad")}</ThemedText>
                  </View>
                )}
                {isMediaOnly && showSenderName ? (
                  <View style={styles.mediaSenderOverlay}>
                    <ThemedText type="caption" style={[styles.mediaSenderText, { color: message.senderColor || "#FFFFFF" }]} numberOfLines={1}>
                      {message.senderName}
                    </ThemedText>
                  </View>
                ) : null}
                {isMediaOnly ? (
                  <View style={styles.mediaTimeOverlay}>
                    {message.isEdited ? (
                      <ThemedText type="caption" style={styles.mediaTimeText}>
                        {t("chat.edited")}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="caption" style={styles.mediaTimeText}>
                      {formatTime(message.timestamp)}
                    </ThemedText>
                    <MessageStatus status={message.status} isOutgoing={isOwn} isEmojiOnly={false} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.media, styles.videoPlaceholder]}>
                {message.isUploading ? (
                  <>
                    <View style={[styles.media, styles.videoBackground]} />
                    <UploadProgressOverlay 
                      progress={message.uploadProgress || 0} 
                      hasError={message.uploadError}
                      mediaType="video"
                      uploadedBytes={message.uploadedBytes}
                      totalBytes={message.totalBytes}
                    />
                  </>
                ) : isMediaLoaded ? (
                  <CachedVideo
                    source={{ uri: mediaSource! }}
                    style={styles.media}
                    showPlayButton={true}
                  />
                ) : isCheckingCache ? (
                  <View style={[styles.media, styles.mediaPlaceholder]}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.media, styles.mediaPlaceholder]}>
                    <View style={styles.loadMediaButton}>
                      <Feather name="video" size={28} color="#FFFFFF" />
                    </View>
                    <ThemedText style={styles.loadMediaText}>{t("chat.tapToLoad")}</ThemedText>
                  </View>
                )}
                {isMediaOnly && showSenderName ? (
                  <View style={styles.mediaSenderOverlay}>
                    <ThemedText type="caption" style={[styles.mediaSenderText, { color: message.senderColor || "#FFFFFF" }]} numberOfLines={1}>
                      {message.senderName}
                    </ThemedText>
                  </View>
                ) : null}
                {isMediaOnly ? (
                  <View style={styles.mediaTimeOverlay}>
                    {message.isEdited ? (
                      <ThemedText type="caption" style={styles.mediaTimeText}>
                        {t("chat.edited")}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="caption" style={styles.mediaTimeText}>
                      {formatTime(message.timestamp)}
                    </ThemedText>
                    <MessageStatus status={message.status} isOutgoing={isOwn} isEmojiOnly={false} />
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
        ) : null}

        {message.text ? (
          isEmojiOnlyMessage(message.text) ? (
            <View style={styles.animatedEmojiContainer}>
              <AnimatedEmojiText 
                text={message.text} 
                emojiSize={getEmojiSize(countEmojis(message.text))} 
              />
            </View>
          ) : (
            <View>
              <ThemedText
                type="body"
                style={[
                  styles.text, 
                  { color: isOwn ? outgoingTextColor : theme.text },
                  Platform.OS === "web" ? { wordBreak: "break-word" } as any : null
                ]}
              >
                {isLongMessage && !isExpanded 
                  ? getCollapsedText(message.text) 
                  : message.text}
              </ThemedText>
              {isLongMessage ? (
                <Pressable 
                  onPress={() => setIsExpanded(!isExpanded)} 
                  style={styles.expandButton}
                  hitSlop={8}
                >
                  <ThemedText 
                    style={[
                      styles.expandButtonText, 
                      { color: isOwn ? (isDark ? "rgba(255,255,255,0.8)" : theme.primary) : theme.primary }
                    ]}
                  >
                    {isExpanded ? t("chat.collapse") : t("chat.readMore")}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        ) : null}

        {!isMediaOnly ? (
        <View style={[styles.footer, isEmojiOnly && styles.footerEmoji]}>
          {message.isEdited ? (
            <ThemedText type="caption" style={[styles.editedLabel, { color: isEmojiOnly ? theme.textSecondary : (isOwn ? (isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.45)") : theme.textSecondary) }]}>
              {t("chat.edited")}
            </ThemedText>
          ) : null}
          <ThemedText
            type="caption"
            style={[styles.time, { color: isEmojiOnly 
              ? theme.textSecondary 
              : (isOwn ? (isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)") : theme.textSecondary) 
            }]}
          >
            {formatTime(message.timestamp)}
          </ThemedText>
          {message.status === "error" && onRetry ? (
            <Pressable onPress={onRetry} style={styles.retryButton} hitSlop={8}>
              <Feather name="refresh-cw" size={12} color="#FF453A" />
            </Pressable>
          ) : (
            <MessageStatus status={message.status} isOutgoing={isOwn} isEmojiOnly={isEmojiOnly} />
          )}
        </View>
        ) : null}
      </>
    );

    // Media-only messages: render without bubble background
    if (isMediaOnly) {
      return (
        <View style={styles.mediaOnlyBubble}>
          {innerContent}
        </View>
      );
    }

    if (isOwn && !isEmojiOnly) {
      return (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: outgoingBackground,
              borderTopLeftRadius: bubbleRadius,
              borderTopRightRadius: bubbleRadius,
              borderBottomLeftRadius: bubbleRadius,
              borderBottomRightRadius: tailRadius,
            },
            Platform.select({
              ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.08,
                shadowRadius: 8,
              },
              android: {
                elevation: 3,
              },
            }),
          ]}
        >
          {innerContent}
        </View>
      );
    }

    return (
      <View style={bubbleStyles}>
        {innerContent}
      </View>
    );
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { alignItems: isOwn ? "flex-end" : "flex-start" }, 
        enterAnimStyle, 
        highlightStyle
      ]}
    >
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={pressAnimStyle}>
          {renderBubbleContent()}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginVertical: 2,
  },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: MAX_BUBBLE_WIDTH,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    overflow: "hidden",
  },
  emojiBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  emojiText: {
    textAlign: "center",
    lineHeight: 80,
    paddingVertical: Spacing.xs,
  },
  animatedEmojiContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  footerEmoji: {
    marginTop: 6,
  },
  time: {
    fontSize: 11,
    fontWeight: "500",
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: "italic",
  },
  retryButton: {
    marginLeft: 4,
    padding: 2,
  },
  mediaContainer: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  mediaWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  media: {
    width: MEDIA_MAX_WIDTH,
    height: MEDIA_MAX_WIDTH,
    borderRadius: 16,
  },
  mediaUploading: {
    opacity: 0.6,
  },
  mediaPlaceholder: {
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadMediaButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadMediaText: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 10,
    fontWeight: "500",
  },
  videoPlaceholder: {
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  videoBackground: {
    backgroundColor: "#2a2a2a",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  bytesText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  quotedMessage: {
    flexDirection: "row",
    marginBottom: 10,
    paddingVertical: 10,
    paddingRight: 14,
    paddingLeft: 4,
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 140,
  },
  quotedBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 10,
    alignSelf: "stretch",
  },
  quotedContent: {
    flex: 1,
    minWidth: 0,
  },
  quotedName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 3,
  },
  quotedText: {
    fontSize: 14,
    lineHeight: 19,
  },
  expandButton: {
    marginTop: 6,
    paddingVertical: 2,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  mediaTimeOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  mediaTimeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  mediaOnlyBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  mediaSenderOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: "70%",
  },
  mediaSenderText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
