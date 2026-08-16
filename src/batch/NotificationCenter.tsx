import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { collection, DocumentData, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from '../auth/AuthProvider'
import { firebaseServices } from '../lib/firebase'
import { Notification, unreadCount } from '../lib/notifications'
import { PILOT_BATCH_ID } from '../lib/membership'
import { PAGE_SIZE } from '../lib/pagination'

export function NotificationCenter() {
  const { user } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData>>()
  const [hasMore, setHasMore] = useState(false)
  const [open, setOpen] = useState(false)
  const refresh = async () => {
    if (!user) return
    const snapshots = await getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/notifications/${user.uid}/items`), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)))
    setItems(snapshots.docs.map((item) => ({ id: item.id, ...item.data() } as Notification))); setCursor(snapshots.docs.at(-1)); setHasMore(snapshots.size === PAGE_SIZE)
  }
  useEffect(() => { void refresh() }, [user])
  async function markRead() {
    const unread = items.filter((item) => !item.readAt).map((item) => item.id)
    if (!unread.length) return
    await httpsCallable(firebaseServices().functions, 'markNotificationsRead')({ batchId: PILOT_BATCH_ID, notificationIds: unread })
    await refresh()
  }
  async function loadMore() {
    if (!user || !cursor) return
    const snapshots = await getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/notifications/${user.uid}/items`), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE)))
    setItems((current) => [...current, ...snapshots.docs.map((item) => ({ id: item.id, ...item.data() } as Notification))]); setCursor(snapshots.docs.at(-1)); setHasMore(snapshots.size === PAGE_SIZE)
  }
  const unread = unreadCount(items)
  return <div className="notification-center"><button className="ui-icon-button notification-trigger" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) void markRead() }}><Bell aria-hidden="true" size={20} /><span className="notification-count" aria-hidden="true">{unread || ''}</span></button>{open && <section className="notification-panel" aria-label="Notification centre"><h2>Notifications</h2>{items.length ? items.map((item) => <article key={item.id} className="notification-item"><strong>{item.title}</strong><p>{item.body}</p></article>) : <p className="muted">You have no notifications.</p>}{hasMore && <button type="button" onClick={() => void loadMore()}>Load more notifications</button>}</section>}</div>
}
