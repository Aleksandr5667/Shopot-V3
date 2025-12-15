# Shepot (Шёпот) Mobile Messenger - Design Guidelines

## Architecture Decisions

### Authentication
**Auth Required** - The app is a multi-user messaging platform requiring:
- User registration and login system
- Implementation: Email/password authentication with option to add SSO later
- Mock the auth flow in prototype using AsyncStorage for account persistence
- Screens required:
  - **Onboarding/Welcome** (first launch)
  - **Sign Up** with email, password, display name fields
  - **Log In** with email/password
  - **Profile/Settings** with:
    - User avatar (generate 4-6 circular avatar presets in #0088CC and #25D366 tones)
    - Display name editing
    - Language toggle (Russian/English)
    - Privacy policy & terms links (placeholder)
    - Log out button with confirmation
    - Delete account (Settings > Account > Delete with double confirmation)

### Navigation
**Drawer + Stack Navigation**:
- **Drawer** (left side) contains:
  - User profile header (avatar, name)
  - Chats list (primary)
  - Settings
  - Language selector
  - About/Help
- **Stack Navigation** for:
  - Chat screen (opens from list)
  - Media viewer (full-screen photo/video)
  - New chat/contact selection
  - Profile editor

### Screen Specifications

#### 1. Chats List (Home)
- **Purpose**: View all conversations, access chats
- **Layout**:
  - Header: Custom transparent header with app name "Шёпот", hamburger menu (left), new chat icon (right)
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: insets.bottom + Spacing.xl
  - Main: FlatList of chat items (scrollable)
- **Components**:
  - Chat list items: avatar (48px circle), contact name, last message preview (1 line), timestamp, unread badge
  - Floating Action Button (bottom right): New chat icon
  - FAB shadow: offset {0, 2}, opacity 0.10, radius 2
- **States**: Empty state with illustration and "Start a conversation" message

#### 2. Chat Screen
- **Purpose**: View conversation, send/receive messages
- **Layout**:
  - Header: Non-transparent with contact name, avatar (small 32px), back button (left), call/video icons (right - phase 2)
  - Top inset: Spacing.xl
  - Bottom inset: message input height + insets.bottom + Spacing.md
  - Main: Inverted FlatList (scrollable from bottom)
  - Fixed bottom: Message input bar with attach button, text field, send button
- **Components**:
  - Message bubbles:
    - Outgoing: light green #DCF8C6, right-aligned, rounded corners (12px top-left, 12px top-right, 12px bottom-left, 2px bottom-right)
    - Incoming: white #FFFFFF, left-aligned, rounded corners (12px top-right, 12px top-left, 12px bottom-right, 2px bottom-left)
    - Subtle shadow on both: offset {0, 1}, opacity 0.05, radius 1
    - Max width: 75% of screen
    - Padding: 12px
    - Timestamp (small grey text below bubble)
  - Media messages: Image/video thumbnails within bubbles (max 220px width), tap to full-screen
  - Input bar: Light grey background #F7F7F7, height 56px, rounded top corners 16px

#### 3. Settings Screen
- **Purpose**: App preferences, account management, language
- **Layout**:
  - Header: Default navigation with "Settings" title
  - Top inset: Spacing.xl
  - Bottom inset: insets.bottom + Spacing.xl
  - Main: ScrollView with grouped sections
- **Components**:
  - Profile section: Avatar (large 80px), name, edit button
  - Language toggle: Russian/English segmented control
  - Appearance (future): Theme selector
  - Account section: Privacy, Terms, Log out, Delete account
  - About: Version, Help

#### 4. Media Viewer (Modal)
- **Purpose**: View photos/videos full-screen
- **Layout**: Full-screen modal overlay, black background
- **Components**:
  - Image: Pinch-to-zoom, swipe to dismiss
  - Video: Play/pause controls, progress bar
  - Header overlay: Close button (top-left), share/save icons (top-right)

## Design System

### Color Palette
- **Primary**: #0088CC (Telegram blue) - main actions, links
- **Secondary**: #25D366 (WhatsApp green) - online indicators, success states
- **Accent**: #FF6B6B (coral red) - notifications, delete actions
- **Background**: #F7F7F7 (light grey) - screen backgrounds
- **Surface**: #FFFFFF (white) - cards, incoming messages
- **Message Outgoing**: #DCF8C6 (light green)
- **Text Primary**: #222222 (dark grey)
- **Text Secondary**: #999999 (medium grey) - timestamps, hints
- **Divider**: #E0E0E0

### Typography
- **iOS**: SF Pro Display (system default)
- **Android**: Roboto
- **Sizes**:
  - Heading: 20px, semibold
  - Body: 16px, regular
  - Caption: 14px, regular (timestamps, hints)
  - Small: 12px, regular (badges)

### Spacing
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- xxl: 32px

### Components Style
- **Buttons**: 
  - Primary: #0088CC background, white text, height 48px, border radius 24px
  - Subtle press feedback: opacity 0.7
- **List Items**: 
  - Height 72px, horizontal padding 16px
  - Press: background #F0F0F0
- **Input Fields**: 
  - Border 1px #E0E0E0, border radius 8px, padding 12px
  - Focus: border #0088CC
- **Avatars**: Circle, generated with solid color backgrounds and white initials
- **Icons**: Feather icons 24px, color #222222 (or white on colored backgrounds)

### Critical Assets
1. **User Avatars** (4-6 presets): Circular, gradient backgrounds in blue/green tones, white letter initials
2. **Empty State Illustration**: Chat bubbles icon for empty chats list
3. **Placeholder for Media**: Grey rounded rectangle with image/video icon

### Accessibility
- Minimum touch target: 44px x 44px
- Text contrast ratio: 4.5:1 minimum
- Support Dynamic Type (iOS) and font scaling (Android)
- Voiceover/TalkBack labels for all interactive elements
- Color not the only indicator (use icons + text)

### Animations
- Screen transitions: Default stack slide (300ms)
- Message send: Bubble fade-in + slide up (200ms)
- Input bar expand: Spring animation when keyboard opens
- All touchable feedback: Immediate (no delay)

### Localization
- All text must support Russian and English
- RTL not required (both languages are LTR)
- Date/time formats: Use device locale
- Store language preference in AsyncStorage