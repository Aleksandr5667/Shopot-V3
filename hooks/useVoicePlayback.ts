import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { mediaCache } from "@/services/mediaCache";

type PlaybackState = 'idle' | 'loading' | 'playing' | 'error';

interface UseVoicePlaybackOptions {
  onPlaybackComplete?: () => void;
  onListened?: () => void;
}

interface UseVoicePlaybackResult {
  state: PlaybackState;
  currentTime: number;
  audioDuration: number;
  togglePlayback: () => Promise<void>;
  hasError: boolean;
  isLoading: boolean;
  stop: () => Promise<void>;
}

let currentPlayingSound: Audio.Sound | null = null;
let currentPlayingId: string | null = null;

export function useVoicePlayback(uri: string, options?: UseVoicePlaybackOptions): UseVoicePlaybackResult {
  const { onPlaybackComplete, onListened } = options || {};
  
  const [state, setState] = useState<PlaybackState>('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const isMountedRef = useRef(true);
  const hasCalledListenedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") {
      setState('error');
      return;
    }

    let mounted = true;
    setState('loading');

    const preloadAudio = async () => {
      try {
        let finalUri = await mediaCache.getCachedUri(uri);
        if (!finalUri) {
          finalUri = await mediaCache.cacheMedia(uri);
          if (!mounted || !finalUri) {
            if (mounted) setState('error');
            return;
          }
        }
        
        if (!mounted) return;

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: finalUri },
          { shouldPlay: false, progressUpdateIntervalMillis: 100 },
          (status) => {
            if (!mounted) return;
            if (status.isLoaded) {
              const durationSec = status.durationMillis ? status.durationMillis / 1000 : 0;
              const positionSec = status.positionMillis ? status.positionMillis / 1000 : 0;
              
              setAudioDuration(durationSec);
              setCurrentTime(positionSec);
              
              if (status.isPlaying) {
                setState('playing');
              } else if (status.didJustFinish) {
                setState('idle');
                setCurrentTime(0);
                currentPlayingSound = null;
                currentPlayingId = null;
                onPlaybackComplete?.();
              }
            }
          }
        );

        if (!mounted) {
          sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        setState('idle');
      } catch (err: any) {
        if (mounted) {
          console.warn("[useVoicePlayback] Error loading audio:", err);
          setState('error');
        }
      }
    };

    preloadAudio();

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (currentPlayingId === playbackIdRef.current) {
        currentPlayingSound = null;
        currentPlayingId = null;
      }
    };
  }, [uri, onPlaybackComplete]);

  const stopOtherPlayers = useCallback(async () => {
    if (currentPlayingSound && currentPlayingId !== playbackIdRef.current) {
      try {
        await currentPlayingSound.stopAsync();
        await currentPlayingSound.setPositionAsync(0);
      } catch (e) {}
      currentPlayingSound = null;
      currentPlayingId = null;
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!soundRef.current) {
      setState('error');
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        setState('error');
        return;
      }

      if (state === 'playing') {
        await soundRef.current.pauseAsync();
        setState('idle');
        currentPlayingSound = null;
        currentPlayingId = null;
      } else {
        await stopOtherPlayers();
        
        if (status.positionMillis && status.durationMillis && 
            status.positionMillis >= status.durationMillis - 100) {
          await soundRef.current.setPositionAsync(0);
        }

        await soundRef.current.playAsync();
        setState('playing');
        currentPlayingSound = soundRef.current;
        currentPlayingId = playbackIdRef.current;

        if (!hasCalledListenedRef.current) {
          hasCalledListenedRef.current = true;
          onListened?.();
        }
      }
    } catch (err: any) {
      console.warn("[useVoicePlayback] Playback error:", err);
      setState('error');
    }
  }, [state, stopOtherPlayers, onListened]);

  const stop = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.setPositionAsync(0);
      setState('idle');
      setCurrentTime(0);
      if (currentPlayingId === playbackIdRef.current) {
        currentPlayingSound = null;
        currentPlayingId = null;
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (currentPlayingId !== null && currentPlayingId !== playbackIdRef.current && state === 'playing') {
      setState('idle');
      setCurrentTime(0);
    }
  }, [state]);

  return {
    state,
    currentTime,
    audioDuration,
    togglePlayback,
    hasError: state === 'error',
    isLoading: state === 'loading',
    stop,
  };
}
