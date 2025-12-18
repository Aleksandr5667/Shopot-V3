import { AudioPlayer } from "expo-audio";

type StopCallback = () => void;

class AudioPlayerManager {
  private currentPlayer: AudioPlayer | null = null;
  private currentPlayerId: string | null = null;
  private currentStopCallback: StopCallback | null = null;
  private playerIdCounter = 0;

  generatePlayerId(): string {
    this.playerIdCounter++;
    return `player_${this.playerIdCounter}_${Date.now()}`;
  }

  registerPlayer(player: AudioPlayer, playerId: string, onStop?: StopCallback): void {
    if (this.currentPlayer && this.currentPlayerId !== playerId) {
      try {
        this.currentPlayer.pause();
      } catch (error) {
        console.warn("[AudioPlayerManager] Failed to pause previous player:", error);
      }
      
      if (this.currentStopCallback) {
        try {
          this.currentStopCallback();
        } catch (e) {
          console.warn("[AudioPlayerManager] Stop callback failed:", e);
        }
        this.currentStopCallback = null;
      }
    }
    
    this.currentPlayer = player;
    this.currentPlayerId = playerId;
    this.currentStopCallback = onStop || null;
  }

  unregisterPlayer(playerId: string): void {
    if (this.currentPlayerId === playerId) {
      this.currentPlayer = null;
      this.currentPlayerId = null;
      this.currentStopCallback = null;
    }
  }

  isCurrentPlayer(playerId: string): boolean {
    return this.currentPlayerId === playerId;
  }

  stopCurrent(): void {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch (error) {
        console.warn("[AudioPlayerManager] Failed to stop current player:", error);
      }
      
      if (this.currentStopCallback) {
        try {
          this.currentStopCallback();
        } catch (e) {
          console.warn("[AudioPlayerManager] Stop callback failed:", e);
        }
      }
      
      this.currentPlayer = null;
      this.currentPlayerId = null;
      this.currentStopCallback = null;
    }
  }

  getCurrentPlayerId(): string | null {
    return this.currentPlayerId;
  }
}

export const audioPlayerManager = new AudioPlayerManager();
