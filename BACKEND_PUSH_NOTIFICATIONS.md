# Backend Push Notifications Setup

## Overview
This document describes the API endpoints and implementation needed on the backend to support push notifications for Shepot (Шёпот).

## Required API Endpoints

### 1. Register Push Token
**POST** `/api/users/push-token`

Saves the user's Expo push token for sending notifications.

**Request:**
```json
{
  "pushToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response:**
```json
{
  "success": true
}
```

### 2. Remove Push Token
**DELETE** `/api/users/push-token`

Removes the push token when user logs out.

**Response:**
```json
{
  "success": true
}
```

## Database Schema Update

Add `pushToken` field to the users table:

```sql
ALTER TABLE users ADD COLUMN push_token VARCHAR(255);
```

Or in Drizzle schema:
```typescript
pushToken: varchar("push_token", { length: 255 }),
```

## Sending Push Notifications

### Using Expo Push Notifications Service

When a new message is sent, the backend should send a push notification to the recipient(s).

**Installation:**
```bash
npm install expo-server-sdk
```

**Implementation:**
```typescript
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    badge: 1,
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log('Push notification sent:', ticketChunk);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
```

## Integration with Message Sending

Update the message creation endpoint to send push notifications:

```typescript
// In POST /api/messages endpoint
async function createMessage(req, res) {
  // ... create message in database ...
  
  // Get recipient's push token
  const chat = await getChat(message.chatId);
  const recipients = chat.members.filter(m => m.userId !== req.user.id);
  
  for (const recipient of recipients) {
    const user = await getUser(recipient.userId);
    if (user.pushToken) {
      await sendPushNotification(
        user.pushToken,
        sender.displayName,
        message.type === 'text' 
          ? message.content.substring(0, 100) 
          : getMediaTypeLabel(message.type),
        {
          chatId: message.chatId.toString(),
          senderId: sender.id.toString(),
          type: 'new_message',
        }
      );
    }
  }
  
  // ... return response ...
}

function getMediaTypeLabel(type: string): string {
  switch (type) {
    case 'image': return 'Photo';
    case 'video': return 'Video';
    case 'voice': return 'Voice message';
    default: return 'New message';
  }
}
```

## Badge Count

For accurate badge counts, track unread messages per user:

```typescript
async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  userId: number
) {
  // Get total unread count for badge
  const unreadCount = await getTotalUnreadCount(userId);
  
  const message: ExpoPushMessage = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    badge: unreadCount,
  };
  
  // ... send notification ...
}
```

## Notification Types

The `data` field in notifications should include:
- `chatId` - to navigate to the correct chat when tapped
- `senderId` - ID of the message sender
- `type` - notification type: `new_message`, `typing`, etc.

## Error Handling

Handle invalid tokens and remove them:

```typescript
async function handlePushReceipts(tickets: ExpoPushTicket[]) {
  const receiptIds = tickets
    .filter(ticket => ticket.status === 'ok')
    .map(ticket => ticket.id);

  const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);

  for (const [receiptId, receipt] of Object.entries(receipts)) {
    if (receipt.status === 'error') {
      if (receipt.details?.error === 'DeviceNotRegistered') {
        // Remove invalid token from database
        await removeInvalidPushToken(receiptId);
      }
    }
  }
}
```

## Testing

1. Install Expo Go on a physical device
2. Scan QR code to connect
3. Grant notification permissions when prompted
4. Send a message from another account
5. Verify notification appears on device

## Notes

- Push notifications only work on physical devices (not emulators/web)
- Expo push tokens are platform-specific (different for iOS vs Android)
- Notifications are rate-limited by Expo's servers
- Consider batching notifications for group chats
