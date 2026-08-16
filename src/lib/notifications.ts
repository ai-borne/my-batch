export type NotificationDestination = { pathname: '/home' | '/reunion' | '/memories' | '/account'; itemId?: string }
export type Notification = { id: string; title: string; body: string; kind: 'announcement' | 'rsvp' | 'payment' | 'moderation'; destination?: NotificationDestination; createdAt?: { toDate: () => Date }; readAt?: { toDate: () => Date } }

export function unreadCount(notifications: Notification[]) { return notifications.filter((notification) => !notification.readAt).length }

const ALLOWED_PATHNAMES: ReadonlyArray<NotificationDestination['pathname']> = ['/home', '/reunion', '/memories', '/account']
export function isNotificationDestination(value: unknown): value is NotificationDestination {
  if (typeof value !== 'object' || value === null) return false
  const destination = value as { pathname?: unknown; itemId?: unknown }
  if (!ALLOWED_PATHNAMES.includes(destination.pathname as NotificationDestination['pathname'])) return false
  return destination.itemId === undefined || typeof destination.itemId === 'string'
}

export function notificationTimestamp(createdAt: { toDate?: () => Date } | undefined, now = new Date()) {
  if (!createdAt?.toDate) return undefined
  const date = createdAt.toDate()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay ? date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
