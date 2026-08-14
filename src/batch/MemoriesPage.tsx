import { FormEvent, useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { getBlob, ref, uploadBytesResumable, UploadTask } from 'firebase/storage'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'

type Media = { path: string; mimeType: string }
type Post = { id: string; authorUid: string; caption?: string; media?: Media[]; createdAt?: { toDate: () => Date } }
type Comment = { id: string; authorUid: string; body: string }
type Report = { id: string; targetType: string; targetId: string; category: string }
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime'])

async function videoDuration(file: File) {
  if (!file.type.startsWith('video/')) return undefined
  const url = URL.createObjectURL(file)
  try { return await new Promise<number>((resolve, reject) => { const video = document.createElement('video'); video.onloadedmetadata = () => resolve(video.duration); video.onerror = () => reject(new Error('The video could not be read.')); video.src = url }) } finally { URL.revokeObjectURL(url) }
}
function validateMedia(file: File, duration?: number) {
  if (!allowedTypes.has(file.type)) throw new Error('Use JPG, PNG, HEIC, WebP, MP4, or MOV media.')
  const limit = file.type.startsWith('image/') ? 20 * 1024 * 1024 : 250 * 1024 * 1024
  if (file.size > limit) throw new Error('This file exceeds the archive size limit.')
  if (duration && duration > 300) throw new Error('Videos must be five minutes or shorter.')
}

export function MemoriesPage() {
  const [posts, setPosts] = useState<Post[]>([]); const [comments, setComments] = useState<Record<string, Comment[]>>({}); const [liked, setLiked] = useState<Record<string, boolean>>({}); const [reports, setReports] = useState<Report[]>([]); const [notice, setNotice] = useState(''); const [progress, setProgress] = useState<number | null>(null); const [canRetry, setCanRetry] = useState(false)
  const upload = useRef<UploadTask | null>(null); const retry = useRef<(() => Promise<void>) | null>(null)
  const refresh = async () => {
    const { db, auth } = firebaseServices(); const snapshots = await getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/posts`), where('status', '==', 'visible'), orderBy('createdAt', 'desc')))
    const nextPosts = snapshots.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() } as Post)); setPosts(nextPosts)
    const details = await Promise.all(nextPosts.map(async (post) => {
      const [commentDocs, like] = await Promise.all([getDocs(collection(db, `batches/${PILOT_BATCH_ID}/posts/${post.id}/comments`)), getDocs(collection(db, `batches/${PILOT_BATCH_ID}/posts/${post.id}/likes`))])
      return [post.id, commentDocs.docs.map((item) => ({ id: item.id, ...item.data() } as Comment)), like.docs.some((item) => item.id === auth.currentUser?.uid)] as const
    }))
    setComments(Object.fromEntries(details.map(([id, list]) => [id, list]))); setLiked(Object.fromEntries(details.map(([id, , isLiked]) => [id, isLiked])))
    try { const reportDocs = await getDocs(collection(db, `batches/${PILOT_BATCH_ID}/reports`)); setReports(reportDocs.docs.filter((item) => item.data().status === 'open').map((item) => ({ id: item.id, ...item.data() } as Report))) } catch { setReports([]) }
  }
  useEffect(() => { void refresh(); return () => { upload.current?.cancel() } }, [])
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get('media') as File
    try {
      const duration = file?.size ? await videoDuration(file) : undefined; if (file?.size) validateMedia(file, duration)
      const post = await httpsCallable<Record<string, unknown>, { postId: string }>(firebaseServices().functions, 'createPost')({ batchId: PILOT_BATCH_ID, caption: form.get('caption'), consentConfirmed: form.get('consent') === 'on' })
      const complete = async () => {
        if (!file?.size) return
        const path = `batches/${PILOT_BATCH_ID}/posts/${post.data.postId}/media/${Date.now()}-${file.name}`; const task = uploadBytesResumable(ref(firebaseServices().storage, path), file, { contentType: file.type }); upload.current = task
        await new Promise<void>((resolve, reject) => task.on('state_changed', (snapshot) => setProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, resolve))
        await httpsCallable(firebaseServices().functions, 'addArchiveMedia')({ batchId: PILOT_BATCH_ID, contentType: 'post', contentId: post.data.postId, storagePath: path, mimeType: file.type, size: file.size, durationSeconds: duration })
      }
      retry.current = complete; await complete(); retry.current = null; setCanRetry(false); event.currentTarget.reset(); setNotice('Memory published to the private batch archive.'); await refresh()
    } catch (error) { setCanRetry(Boolean(retry.current)); setNotice(error instanceof Error ? error.message : 'Unable to publish this memory. You can retry the upload.') }
    finally { upload.current = null; setProgress(null) }
  }
  async function comment(event: FormEvent<HTMLFormElement>, postId: string) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await httpsCallable(firebaseServices().functions, 'saveArchiveComment')({ batchId: PILOT_BATCH_ID, postId, body: form.get('body') }); event.currentTarget.reset(); await refresh() } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to add comment.') } }
  async function like(postId: string) { try { await httpsCallable(firebaseServices().functions, 'setArchiveLike')({ batchId: PILOT_BATCH_ID, postId, liked: !liked[postId] }); await refresh() } catch { setNotice('Unable to update like.') } }
  async function report(postId: string) { const category = window.prompt('Report category: harassment, sexualContent, privacy, financialInformation, fraud, spam, rights, or other'); if (!category) return; const explanation = window.prompt('Optional explanation') ?? ''; try { await httpsCallable(firebaseServices().functions, 'reportArchiveContent')({ batchId: PILOT_BATCH_ID, targetType: 'post', targetId: postId, category, explanation }); setNotice('Report sent privately to Coordinators.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to send report.') } }
  async function moderate(reportId: string, action: string) { const reason = window.prompt('Optional moderation reason') ?? ''; try { await httpsCallable(firebaseServices().functions, 'moderateArchiveContent')({ batchId: PILOT_BATCH_ID, reportId, action, reason }); setNotice('Moderation action recorded.'); await refresh() } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to moderate content.') } }
  async function createAlbum(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await httpsCallable(firebaseServices().functions, 'createAlbum')({ batchId: PILOT_BATCH_ID, title: form.get('title'), description: form.get('description'), consentConfirmed: form.get('consent') === 'on' }); event.currentTarget.reset(); setNotice('Album created in the private batch archive.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to create album.') } }
  return <section className="page-stack"><div><p className="eyebrow">Private archive</p><h1>Our memories.</h1></div><form className="panel form-stack" onSubmit={publish}><h2>Share a memory</h2><label>Caption<textarea name="caption" maxLength={2000} /></label><label>Photo or video (optional)<input name="media" type="file" accept="image/jpeg,image/png,image/heic,image/webp,video/mp4,video/quicktime" /></label><label className="check-label"><input name="consent" type="checkbox" required />I have the right to share this, it is suitable for this private batch, and it contains no sensitive financial or personal information without permission.</label><button type="submit">Publish memory</button>{progress !== null && <><progress value={progress} max="100">{progress}%</progress><span className="member-actions"><button type="button" onClick={() => upload.current?.cancel()}>Cancel upload</button></span></>}{canRetry && <button type="button" onClick={() => void retry.current?.()}>Retry upload</button>}</form><form className="panel form-stack" onSubmit={createAlbum}><h2>Create an album</h2><label>Title<input name="title" maxLength={120} required /></label><label>Description<textarea name="description" maxLength={1000} /></label><label className="check-label"><input name="consent" type="checkbox" required />I have the right to share this album with approved batch members.</label><button>Create album</button></form><section className="page-stack">{posts.map((post) => <article className="panel" key={post.id}><div className="member-row"><span><strong>{post.authorUid}</strong><small>{post.createdAt?.toDate().toLocaleString('en-IN') ?? 'Just now'}</small></span><button type="button" onClick={() => void report(post.id)}>Report</button></div>{post.caption && <p>{post.caption}</p>}<div className="archive-media">{post.media?.map((media) => <ArchiveMedia key={media.path} media={media} />)}</div><button type="button" onClick={() => void like(post.id)}>{liked[post.id] ? 'Unlike' : 'Like'}</button><div className="comments">{comments[post.id]?.map((item) => <p key={item.id}><strong>{item.authorUid}</strong> · {item.body}</p>)}</div><form className="comment-form" onSubmit={(event) => void comment(event, post.id)}><input name="body" maxLength={1000} required aria-label="Comment" placeholder="Add a comment" /><button>Comment</button></form></article>)}{!posts.length && <section className="panel"><p className="muted">No memories yet. Share the first one.</p></section>}</section>{reports.length > 0 && <section className="panel"><h2>Open moderation reports</h2>{reports.map((report) => <div className="member-row" key={report.id}><span><strong>{report.category}</strong><small>{report.targetType} · {report.targetId}</small></span><span className="member-actions"><button onClick={() => void moderate(report.id, 'dismiss')}>Dismiss</button><button onClick={() => void moderate(report.id, 'hide')}>Hide</button><button onClick={() => void moderate(report.id, 'remove')}>Remove</button></span></div>)}</section>}{notice && <p role="status">{notice}</p>}</section>
}

function ArchiveMedia({ media }: { media: Media }) {
  const [url, setUrl] = useState('')
  useEffect(() => { let active = true; let objectUrl = ''; void getBlob(ref(firebaseServices().storage, media.path)).then((blob) => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl) }).catch(() => setUrl('')); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) } }, [media.path])
  if (!url) return null
  return media.mimeType.startsWith('video/') ? <video controls src={url} /> : <img src={url} alt="Shared batch memory" />
}
