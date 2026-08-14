import { useEffect, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from '../auth/AuthProvider'
import { firebaseServices } from '../lib/firebase'
import { Notification, unreadCount } from '../lib/notifications'
import { PILOT_BATCH_ID } from '../lib/membership'

export function NotificationCenter() {
  const { user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const refresh = async () => {
    if (!user) return
    const snapshots = await getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/notifications/${user.uid}/items`), orderBy('createdAt', 'desc'), limit(50)))
    setItems(snapshots.docs.map((item) => ({ id: item.id, ...item.data() } as Notification)))
  }
  useEffect(() => { void refresh() }, [user])
  async function markRead() {
    const unread = items.filter((item) => !item.readAt).map((item) => item.id)
    if (!unread.length) return
    await httpsCallable(firebaseServices().functions, 'markNotificationsRead')({ batchId: PILOT_BATCH_ID, notificationIds: unread })
    await refresh()
  }
  const unread = unreadCount(items)
  return <div className="notification-center"><button className="text-button" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void markRead() }}>Notifications{unread ? ` (${unread})` : ''}</button>{open && <section className="notification-panel" aria-label="Notification centre"><h2>Notifications</h2>{items.length ? items.map((item) => <article key={item.id} className="notification-item"><strong>{item.title}</strong><p>{item.body}</p></article>) : <p className="muted">You have no notifications.</p>}</section>}</div>
}
