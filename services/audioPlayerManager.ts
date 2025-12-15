import { AudioPlayer } from "expo-audio";

type StopCallback = () => void;

class AudioPlayerManager {
  private currentPlayer: AudioPlayer | null = null;
  private currentStopCallback: StopCallback | null = null;

  registerPlayer(player: AudioPlayer, onStop?: StopCallback): void {
    if (this.currentPlayer && this.currentPlayer !== player) {
      try {
        this.currentPlayer.pause();
      } catch (error) {
        console.warn("[AudioPlayerManager] Failed to pause previous player:", error);
      }
      
      if (this.currentStopCallback) {
        this.currentStopCallback();
        this.currentStopCallback = null;
      }
    }
    
    this.currentPlayer = player;
    this.currentStopCallback = onStop || null;
  }

  unregisterPlayer(player: AudioPlayer): void {
    if (this.currentPlayer === player) {
      this.currentPlayer = null;
      this.currentStopCallback = null;
    }
  }

  isCurrentPlayer(player: AudioPlayer): boolean {
    return this.currentPlayer === player;
  }

  stopCurrent(): void {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch (error) {
        console.warn("[AudioPlayerManager] Failed to stop current player:", error);
      }
      
      if (this.currentStopCallback) {
        this.currentStopCallback();
      }
      
      this.currentPlayer = null;
      this.currentStopCallback = null;
    }
  }
}

export const audioPlayerManager = new AudioPlayerManager();
