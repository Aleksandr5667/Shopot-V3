import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User } from "@/store/types";
import { apiService, ServerUser } from "@/services/api";
import { chatCache } from "@/services/chatCache";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function serverUserToUser(serverUser: ServerUser): User {
  return {
    id: serverUser.id.toString(),
    visibleId: serverUser.id,
    email: serverUser.email,
    displayName: serverUser.displayName,
    avatarColor: serverUser.avatarColor,
    avatarUrl: serverUser.avatarUrl || undefined,
    bio: serverUser.bio || undefined,
    createdAt: serverUser.createdAt,
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      await apiService.init();
      const result = await apiService.getCurrentUser();
      if (result.success && result.data) {
        setUser(serverUserToUser(result.data));
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to load user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.login(email, password);
        
        if (result.success && result.data) {
          setUser(serverUserToUser(result.data.user));
          return { success: true };
        }
        
        return { success: false, error: result.error || "Invalid email or password" };
      } catch (error) {
        __DEV__ && console.warn("Sign in error:", error);
        return { success: false, error: "Sign in failed" };
      }
    },
    []
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const result = await apiService.register(email, password, displayName);
        
        if (result.success && result.data) {
          setUser(serverUserToUser(result.data.user));
          return { success: true };
        }
        
        return { success: false, error: result.error || "Registration failed" };
      } catch (error) {
        __DEV__ && console.warn("Sign up error:", error);
        return { success: false, error: "Sign up failed" };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    try {
      await apiService.clearToken();
      await chatCache.clearAll();
      setUser(null);
    } catch (error) {
      __DEV__ && console.warn("Failed to sign out:", error);
      setUser(null);
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    console.log("[updateUser] Called with:", updates);
    
    const previousUser = user;
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
    
    try {
      const result = await apiService.updateProfile({
        displayName: updates.displayName,
        avatarColor: updates.avatarColor,
        avatarUrl: updates.avatarUrl,
        bio: updates.bio,
      });
      console.log("[updateUser] API result:", result);
      
      if (result.success && result.data) {
        console.log("[updateUser] Syncing with server data:", result.data);
        setUser(serverUserToUser(result.data));
      } else {
        console.log("[updateUser] Update failed, reverting:", result.error);
        setUser(previousUser);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to update user:", error);
      setUser(previousUser);
    }
  }, [user]);

  const deleteAccount = useCallback(async () => {
    try {
      const result = await apiService.deleteAccount();
      if (result.success) {
        setUser(null);
      } else {
        __DEV__ && console.warn("Failed to delete account:", result.error);
      }
    } catch (error) {
      __DEV__ && console.warn("Failed to delete account:", error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
