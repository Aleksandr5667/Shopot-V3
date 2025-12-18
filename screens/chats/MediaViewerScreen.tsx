import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAndroidBottomInset } from "@/hooks/useScreenInsets";
import { Feather } from "@expo/vector-icons";
import { ChatsStackParamList } from "@/navigation/types";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";
import { mediaCache } from "@/services/mediaCache";

type Props = NativeStackScreenProps<ChatsStackParamList, "MediaViewer">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function WebVideoPlayer({ uri, onLoad, onError }: { uri: string; onLoad: () => void; onError: () => void }) {
  return (
    <video
      src={uri}
      controls
      autoPlay
      onLoadedData={onLoad}
      onError={onError}
      style={{
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        objectFit: "contain",
      }}
    />
  );
}

function NativeVideoPlayer({ 
  uri, 
  videoHeight,
  onLoad,
  onError,
  onBufferingChange 
}: { 
  uri: string; 
  videoHeight: number;
  onLoad: () => void;
  onError: () => void;
  onBufferingChange: (isBuffering: boolean) => void;
}) {
  const player = useVideoPlayer(uri, (player) => {
    player.play();
  });

  useEffect(() => {
    const statusSubscription = player.addListener("statusChange", (event) => {
      if (event.status === "readyToPlay") {
        onLoad();
        onBufferingChange(false);
      } else if (event.status === "error") {
        onError();
      } else if (event.status === "loading") {
        onBufferingChange(true);
      }
    });

    return () => {
      statusSubscription.remove();
    };
  }, [player, onLoad, onError, onBufferingChange]);

  return (
    <VideoView
      player={player}
      style={[styles.videoMedia, { height: videoHeight }]}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function MediaViewerScreen({ route, navigation }: Props) {
  const { uri, type } = route.params;
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [cachedVideoUri, setCachedVideoUri] = useState<string | null>(null);

  useEffect(() => {
    if (type === "video" && Platform.OS !== "web") {
      mediaCache.cacheMedia(uri).then((cachedUri) => {
        setCachedVideoUri(cachedUri);
      }).catch(() => {
        setCachedVideoUri(uri);
      });
    }
  }, [uri, type]);

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setError(true);
  }, []);

  const handleBufferingChange = useCallback((buffering: boolean) => {
    setIsBuffering(buffering);
  }, []);

  const videoHeight = SCREEN_HEIGHT - insets.top - getAndroidBottomInset(insets.bottom) - 80;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.closeButton, { top: insets.top + Spacing.md }]}
        onPress={handleClose}
      >
        <View style={styles.closeButtonBackground}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </View>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color="#FFFFFF"
          style={styles.loader}
        />
      ) : null}

      {!isLoading && isBuffering && type === "video" ? (
        <View style={styles.bufferingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#FFFFFF" />
          <ThemedText style={styles.errorText}>
            Failed to load media
          </ThemedText>
        </View>
      ) : null}

      {type === "photo" ? (
        <Image
          source={{ uri }}
          style={styles.imageMedia}
          contentFit="contain"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : Platform.OS === "web" ? (
        <View style={styles.webVideoContainer}>
          <WebVideoPlayer uri={uri} onLoad={handleLoad} onError={handleError} />
        </View>
      ) : cachedVideoUri ? (
        <NativeVideoPlayer 
          uri={cachedVideoUri}
          videoHeight={videoHeight}
          onLoad={handleLoad}
          onError={handleError}
          onBufferingChange={handleBufferingChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 100,
  },
  closeButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageMedia: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoMedia: {
    width: SCREEN_WIDTH,
    backgroundColor: "#000000",
  },
  webVideoContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  loader: {
    position: "absolute",
    zIndex: 50,
  },
  bufferingContainer: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 50,
  },
  errorContainer: {
    position: "absolute",
    alignItems: "center",
    zIndex: 50,
  },
  errorText: {
    color: "#FFFFFF",
    marginTop: Spacing.md,
  },
});
