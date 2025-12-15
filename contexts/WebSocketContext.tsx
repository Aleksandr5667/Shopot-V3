import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { wsService, WebSocketEvent, WebSocketEventHandler } from "@/services/websocket";
import { useAuth } from "./AuthContext";
import { messageQueue } from "@/services/messageQueue";
import { apiService } from "@/services/api";

interface WebSocketContextType {
  isConnected: boolean;
  sendTyping: (chatId: number) => void;
  subscribe: (handler: WebSocketEventHandler) => () => void;
  onlineUsers: Set<number>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const wasConnectedRef = useRef(false);
  const queueInitializedRef = useRef(false);

  useEffect(() => {
    if (!queueInitializedRef.current) {
      messageQueue.initialize();
      queueInitializedRef.current = true;
    }
  }, []);

  const loadOnlineUsers = useCallback(async () => {
    try {
      const result = await apiService.getOnlineUsers();
      if (result.success && result.data) {
        setOnlineUsers(new Set(result.data));
      }
    } catch (error) {
      __DEV__ && console.warn("[WebSocketContext] Failed to load online users:", error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      wsService.connect();
      loadOnlineUsers();

      const unsubscribe = wsService.subscribe((event) => {
        if (event.type === "user_online") {
          console.log("[WebSocketContext] User online:", event.userId);
          setOnlineUsers((prev) => new Set([...prev, event.userId]));
        } else if (event.type === "user_offline") {
          console.log("[WebSocketContext] User offline:", event.userId);
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(event.userId);
            return next;
          });
        } else if (event.type === "ws_connected") {
          console.log("[WebSocketContext] WebSocket connected, processing message queue");
          setIsConnected(true);
          wasConnectedRef.current = true;
          messageQueue.setOnline(true);
          loadOnlineUsers();
        }
      });

      const checkConnection = setInterval(() => {
        const currentlyConnected = wsService.isConnected;
        setIsConnected(currentlyConnected);
        
        if (currentlyConnected && !wasConnectedRef.current) {
          console.log("[WebSocketContext] Connection restored, processing message queue");
          messageQueue.setOnline(true);
          loadOnlineUsers();
        } else if (!currentlyConnected && wasConnectedRef.current) {
          console.log("[WebSocketContext] Connection lost");
          messageQueue.setOnline(false);
        }
        
        wasConnectedRef.current = currentlyConnected;
      }, 10000);

      return () => {
        unsubscribe();
        clearInterval(checkConnection);
        wsService.disconnect();
      };
    } else {
      wsService.disconnect();
      setIsConnected(false);
      setOnlineUsers(new Set());
      messageQueue.setOnline(false);
    }
  }, [isAuthenticated, loadOnlineUsers]);

  const sendTyping = useCallback((chatId: number) => {
    wsService.sendTyping(chatId);
  }, []);

  const subscribe = useCallback((handler: WebSocketEventHandler) => {
    return wsService.subscribe(handler);
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        sendTyping,
        subscribe,
        onlineUsers,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
