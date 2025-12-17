# Shepot (Шёпот) - Mobile Messenger Application

## Overview
Shepot (Шёпот - "whisper" in Russian) is a mobile messaging application built with React Native and Expo, designed as a secure messaging alternative. The app features bilingual support (Russian/English), media sharing capabilities, and real-time messaging via WebSocket. It aims to provide a modern UI inspired by Telegram and WhatsApp, primarily targeting RuStore distribution.

## User Preferences
- Bilingual interface (Russian and English)
- WhatsApp/Telegram-inspired design
- Communication in Russian language preferred

## System Architecture
The application is built with React Native and Expo, utilizing a component-based architecture.

**UI/UX Decisions:**
- **Design Inspiration**: Telegram and WhatsApp, focusing on a modern and intuitive user experience.
- **Color Scheme**: Primary color #0088CC (Telegram blue), Secondary color #25D366 (WhatsApp green), Accent color #FF6B6B (coral red).
- **Messaging UI**: White bubbles for incoming messages, #DCF8C6 for outgoing.
- **Typography**: System fonts (SF Pro / Roboto).
- **Navigation**: Uses React Navigation for nested navigation stacks (Auth, Drawer, Chats, Settings).
- **Offline-First**: Implements local caching for chats, messages, and contacts to ensure instant loading and background synchronization.

**Technical Implementations & Feature Specifications:**
- **Authentication**: JWT-based authentication with email verification and password reset flows.
- **Real-time Communication**: WebSocket for instant messaging, typing indicators, and online/offline status updates.
- **Media Handling**: Supports photo, video, and voice message sharing, including recording, playback, and full-screen viewing. Media files are cached locally for offline access and faster loading.
- **Push Notifications**: Integrated with `expo-notifications` for real-time alerts.
- **Internationalization**: Bilingual support for Russian and English using `i18next`.
- **User Management**: Features include profile editing, custom avatars (photo or colored initials), contact search by email, and contact management.
- **Chat Features**: Group chat creation and management (Telegram-style UX with admin/member roles, member administration, avatar upload), message editing and deletion, read receipts, unread message count badges, chat deletion, and system messages for group events (member added/removed, role changes, name changes).
- **Performance**: Throttled typing indicators and optimized media upload/download with progress display.
- **Pagination**: Cursor-based pagination implemented for chats list, contacts list, and message search using base64-encoded JSON cursors. Page size defaults to 50 items. Infinite scroll with FlatList onEndReached for seamless loading.
- **Modern Emoji Rendering**: Messages consisting only of emojis are displayed with larger, lively sizes (64px for 1 emoji down to 28px for 5+) and without bubble background for a clean, modern look.
- **Animated Emojis**: Emoji-only messages use Lottie animations from Google Noto Animated Emojis (CC BY 4.0) for a lively, engaging chat experience. Supported emojis include: ❤️, 👍, 😂, 😍, 🔥, 🎉, 👎, 😭, 😮, 😡, 😊, 🤔, 💯, ✅, ❌. Unsupported emojis fall back to static text. Animations loop continuously and are stored in `assets/animations/emojis/`.
- **Error Handling**: Robust API and WebSocket error handling, including automatic WebSocket reconnection with exponential backoff.

**System Design Choices:**
- **Context API**: Utilizes React Context for global state management, including `AuthContext`, `WebSocketContext`, and `NotificationsContext`.
- **Custom Hooks**: Encapsulates logic for data fetching and manipulation (e.g., `useChats`, `useMessages`, `useContacts`, `useSearch`, `useNotifications`).
- **Service Layer**: Dedicated services for API interaction, WebSocket communication, and various caching mechanisms (e.g., `api.ts`, `websocket.ts`, `chatCache.ts`, `mediaCache.ts`).
- **Media Storage**: Media files are uploaded via pre-signed URLs to object storage.

## External Dependencies
- **Backend API**: Custom backend API server accessible at `https://537ec24e-fd89-49c7-9042-1db53746fbd5-00-9qkr3j0foo4s.riker.replit.dev`.
- **WebSocket**: Custom WebSocket server for real-time communication.
- **`expo-image-picker`**: For selecting images and videos from the device gallery.
- **`expo-av`**: For audio and video playback (note: `expo-video` is considered for future).
- **`expo-notifications`**: For handling push notifications.
- **`i18next`**: For internationalization and language switching.
- **`AsyncStorage`**: Used for storing JWT tokens.
- **`expo-file-system`**: For local media caching.