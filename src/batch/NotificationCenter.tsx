import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { collection, DocumentData, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { firebaseServices } from '../lib/firebase'
import { Notification, notificationTimestamp, unreadCount } from '../lib/notifications'
import { PILOT_BATCH_ID } from '../lib/membership'
import { PAGE_SIZE } from '../lib/pagination'
import { COPY } from '../lib/copy'

export function NotificationCenter() {
  const { user } = useAuth()
  const panel = useRef<HTMLElement>(null)
  const openButton = useRef<HTMLButtonElement>(null)
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData>>()
  const [hasMore, setHasMore] = useState(false)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const refresh = async () => {
    if (!user) return
    const snapshots = await getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/notifications/${user.uid}/items`), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)))
    setItems(snapshots.docs.map((item) => ({ id: item.id, ...item.data() } as Notification))); setCursor(snapshots.docs.at(-1)); setHasMore(snapshots.size === PAGE_SIZE)
  }
  useEffect(() => { void refresh() }, [user])
  useEffect(() => {
    if (open) { panel.current?.querySelector<HTMLElement>('h2')?.focus(); return }
    openButton.current?.focus()
  }, [open])
  const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id)
  async function markAllRead() {
    if (!unreadIds.length) return
    try { await httpsCallable(firebaseServices().functions, 'markNotificationsRead')({ batchId: PILOT_BATCH_ID, notificationIds: unreadIds }); setNotice(COPY.notifications.markedRead); await refresh() } catch { setNotice(COPY.dialogActionFailed) }
  }
  async function loadMore() {
    if (!user || !cursor) return
    const snapshots = await getDocs(query(collection(firebaseServices().db, `batches/${PILOT_BATCH_ID}/notifications/${user.uid}/items`), orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE)))
    setItems((current) => [...current, ...snapshots.docs.map((item) => ({ id: item.id, ...item.data() } as Notification))]); setCursor(snapshots.docs.at(-1)); setHasMore(snapshots.size === PAGE_SIZE)
  }
  const unread = unreadCount(items)
  return <div className="notification-center"><button ref={openButton} className="ui-icon-button notification-trigger" aria-label={unread ? `Notifications (${unread} unread)` : COPY.notifications.label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Bell aria-hidden="true" size={20} /><span className="notification-count" aria-hidden="true">{unread || ''}</span></button>{open && <section ref={panel} className="notification-sheet" aria-label="Notification centre" role="region"><div className="notification-sheet-head"><h2 tabIndex={-1}>{COPY.notifications.title}</h2><div className="member-actions"><button type="button" disabled={!unreadIds.length} onClick={() => void markAllRead()}>{COPY.notifications.markAllRead}</button><button type="button" onClick={() => setOpen(false)}>{COPY.cancel}</button></div></div>{notice && <p role="status">{notice}</p>}{items.length ? <ul className="notification-list">{items.map((item) => <li key={item.id} className="notification-item">{item.destination?.pathname ? <Link className="notification-link" to={item.destination.pathname} onClick={() => setOpen(false)}>{item.title}</Link> : <strong>{item.title}</strong>}<p>{item.body}</p>{!item.readAt && <span className="notification-unread" aria-label="unread" role="presentation" />}<time className="muted">{notificationTimestamp(item.createdAt) ?? ''}</time></li>)}</ul> : <p className="muted">{COPY.notifications.empty}</p>}{hasMore && <button type="button" onClick={() => void loadMore()}>{COPY.notifications.loadMore}</button>}</section>}</div>
}
