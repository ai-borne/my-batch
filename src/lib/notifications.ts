export type NotificationDestination = { pathname: '/home' | '/reunion' | '/memories' | '/account'; itemId?: string }
export type Notification = { id: string; title: string; body: string; kind: 'announcement' | 'rsvp' | 'payment' | 'moderation'; destination?: NotificationDestination; readAt?: { toDate: () => Date } }

export function unreadCount(notifications: Notification[]) { return notifications.filter((notification) => !notification.readAt).length }
