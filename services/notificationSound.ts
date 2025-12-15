import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, AudioPlayer } from "expo-audio";

const receiveSound = require("@/assets/sounds/message-receive.mp3");
const groupSound = require("@/assets/sounds/group-message.mp3");
const deleteSound = require("@/assets/sounds/message-delete.mp3");

class NotificationSoundService {
  private isInitialized = false;
  private receiveSoundPlayer: AudioPlayer | null = null;
  private groupSoundPlayer: AudioPlayer | null = null;
  private deleteSoundPlayer: AudioPlayer | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      this.receiveSoundPlayer = createAudioPlayer(receiveSound);
      this.groupSoundPlayer = createAudioPlayer(groupSound);
      this.deleteSoundPlayer = createAudioPlayer(deleteSound);
      
      this.isInitialized = true;
      console.log("[NotificationSound] Initialized with audio files");
    } catch (error) {
      console.log("[NotificationSound] Audio init error:", error);
      this.isInitialized = true;
    }
  }

  async playSendSound(): Promise<void> {
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 50);
      }
      
      if (this.receiveSoundPlayer) {
        this.receiveSoundPlayer.seekTo(0);
        this.receiveSoundPlayer.play();
      } else if (Platform.OS === "web") {
        this.playWebSound("receive");
      }
    } catch (error) {
      console.log("[NotificationSound] Play send error:", error);
    }
  }

  async playReceiveSound(): Promise<void> {
    try {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (this.groupSoundPlayer) {
        this.groupSoundPlayer.seekTo(0);
        this.groupSoundPlayer.play();
      } else if (Platform.OS === "web") {
        this.playWebSound("group");
      }
    } catch (error) {
      console.log("[NotificationSound] Play receive error:", error);
    }
  }

  async playGroupMessageSound(): Promise<void> {
    try {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      if (this.groupSoundPlayer) {
        this.groupSoundPlayer.seekTo(0);
        this.groupSoundPlayer.play();
      } else if (Platform.OS === "web") {
        this.playWebSound("group");
      }
    } catch (error) {
      console.log("[NotificationSound] Play group error:", error);
    }
  }

  async playMessageSound(): Promise<void> {
    await this.playReceiveSound();
  }

  async playDeleteSound(): Promise<void> {
    try {
      console.log("[NotificationSound] Playing delete sound...");
      
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      if (this.deleteSoundPlayer) {
        console.log("[NotificationSound] Using native delete sound player");
        this.deleteSoundPlayer.seekTo(0);
        this.deleteSoundPlayer.play();
      } else if (Platform.OS === "web") {
        console.log("[NotificationSound] Using web audio for delete");
        this.playWebSound("delete");
      } else {
        console.log("[NotificationSound] No delete sound player available");
      }
    } catch (error) {
      console.log("[NotificationSound] Play delete error:", error);
    }
  }

  private playWebSound(type: "send" | "receive" | "group" | "delete"): void {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === "send") {
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
      } else if (type === "receive") {
        oscillator.frequency.setValueAtTime(660, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
        oscillator.frequency.exponentialRampToValueAtTime(1100, audioCtx.currentTime + 0.16);
        gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.2);
      } else if (type === "delete") {
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.12);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
      } else {
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (error) {
      console.log("[NotificationSound] Web audio error:", error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.receiveSoundPlayer) {
        this.receiveSoundPlayer.release();
        this.receiveSoundPlayer = null;
      }
      if (this.groupSoundPlayer) {
        this.groupSoundPlayer.release();
        this.groupSoundPlayer = null;
      }
      if (this.deleteSoundPlayer) {
        this.deleteSoundPlayer.release();
        this.deleteSoundPlayer = null;
      }
    } catch (error) {
      console.log("[NotificationSound] Cleanup error:", error);
    }
    this.isInitialized = false;
  }
}

export const notificationSoundService = new NotificationSoundService();
