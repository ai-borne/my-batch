export type Notification = { id: string; title: string; body: string; kind: 'announcement' | 'rsvp' | 'payment' | 'moderation'; readAt?: { toDate: () => Date } }

export function unreadCount(notifications: Notification[]) { return notifications.filter((notification) => !notification.readAt).length }
