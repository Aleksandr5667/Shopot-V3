import { useState, useCallback, useRef, useEffect } from "react";
import { Chat, Message, Contact, User } from "@/store/types";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

export interface SearchResult {
  type: "chat" | "message" | "contact" | "user";
  chat?: Chat;
  message?: Message;
  contact?: Contact;
  user?: User;
  matchedText?: string;
}

export function useSearch() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    async (searchQuery: string, chats: Chat[] = [], contacts: Contact[] = []) => {
      const trimmedQuery = searchQuery.trim().toLowerCase();
      setQuery(searchQuery);

      if (!trimmedQuery || trimmedQuery.length < 3) {
        setResults([]);
        return;
      }

      setIsSearching(true);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      try {
        const searchResults: SearchResult[] = [];

        contacts.forEach((contact) => {
          if (
            contact.displayName.toLowerCase().includes(trimmedQuery) ||
            contact.email?.toLowerCase().includes(trimmedQuery)
          ) {
            searchResults.push({
              type: "contact",
              contact,
              matchedText: contact.displayName,
            });
          }
        });

        chats.forEach((chat) => {
          const participantName = chat.participant?.displayName || chat.name || "";
          if (participantName.toLowerCase().includes(trimmedQuery)) {
            const alreadyInContacts = searchResults.some(
              (r) =>
                r.type === "contact" &&
                r.contact?.visibleId === chat.participant?.visibleId
            );
            if (!alreadyInContacts) {
              searchResults.push({
                type: "chat",
                chat,
                matchedText: participantName,
              });
            }
          }
        });

        const isEmailLike = trimmedQuery.includes("@") || trimmedQuery.length >= 3;
        if (isEmailLike && user?.visibleId) {
          searchTimeoutRef.current = setTimeout(async () => {
            try {
              const userResult = await apiService.searchUserByEmail(trimmedQuery);
              if (userResult.success && userResult.data) {
                const foundUser = apiService.serverUserToUser(userResult.data);
                if (foundUser.visibleId !== user.visibleId) {
                  setResults((prev) => {
                    const alreadyInResults = prev.some(
                      (r) =>
                        (r.type === "contact" && r.contact?.visibleId === foundUser.visibleId) ||
                        (r.type === "chat" && r.chat?.participant?.visibleId === foundUser.visibleId) ||
                        (r.type === "user" && r.user?.visibleId === foundUser.visibleId)
                    );
                    if (alreadyInResults) {
                      return prev;
                    }
                    return [
                      ...prev,
                      {
                        type: "user",
                        user: foundUser,
                        matchedText: foundUser.displayName,
                      },
                    ];
                  });
                }
              }
            } catch {
            }
          }, 500);
        }

        setResults(searchResults);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [user?.visibleId]
  );

  const clearSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    query,
    results,
    isSearching,
    search,
    clearSearch,
  };
}
