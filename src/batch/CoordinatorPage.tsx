import { FormEvent, useEffect, useState } from 'react'
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore/lite'
import { httpsCallable } from 'firebase/functions'
import { ref, uploadBytes } from 'firebase/storage'
import { useAuth } from '../auth/AuthProvider'
import { EXPENSE_CATEGORIES, ledgerCsv } from '../lib/finance'
import { firebaseServices } from '../lib/firebase'
import { HOUSES, PILOT_BATCH_ID } from '../lib/membership'

type Claim = { id: string; memberUid: string; amountPaise: number; utr: string; status: string; contributionHead?: string }
type Expense = { id: string; category: string; amountPaise: number; status: string; vendor: string }
type Member = { uid: string; role?: string; status: string; houseId?: string; displayName?: string }
type AccessRequest = { id: string; displayName: string; houseId?: string }
const call = (name: string, data: Record<string, unknown>) => httpsCallable(firebaseServices().functions, name)({ requestId: crypto.randomUUID(), ...data })

export function CoordinatorPage() {
  const { reauthenticate } = useAuth()
  const [claims, setClaims] = useState<Claim[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [notice, setNotice] = useState('')
  const db = firebaseServices().db
  const refresh = async () => {
    const [claimDocs, expenseDocs, memberDocs, requestDocs] = await Promise.all([getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/paymentClaims`), orderBy('submittedAt', 'desc'), limit(25))), getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/expenses`), orderBy('createdAt', 'desc'), limit(25))), getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/memberships`), orderBy('updatedAt', 'desc'), limit(25))), getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/accessRequests`), where('status', '==', 'pending'), limit(25)))])
    setClaims(claimDocs.docs.map((item) => ({ id: item.id, ...item.data() } as Claim)))
    setExpenses(expenseDocs.docs.map((item) => ({ id: item.id, ...item.data() } as Expense)))
    setMembers(memberDocs.docs.map((item) => item.data() as Member))
    setRequests(requestDocs.docs.map((item) => ({ id: item.id, ...item.data() } as AccessRequest)))
  }
  useEffect(() => { void refresh() }, [])
  async function manage(memberUid: string, action: string, houseId?: string) { try { await reauthenticate(); await call('manageMembership', { batchId: PILOT_BATCH_ID, memberUid, action, houseId }); await refresh(); setNotice('Membership updated.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to update membership.') } }
  async function approve(requestId: string) { try { await reauthenticate(); await call('approveMembership', { batchId: PILOT_BATCH_ID, requestId }); await refresh(); setNotice('Member approved.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to approve member.') } }
  async function reject(requestId: string) { const reason = window.prompt('Reason for rejection (shown to the requester):'); if (!reason) return; try { await reauthenticate(); await call('rejectMembership', { batchId: PILOT_BATCH_ID, requestId, reason }); await refresh(); setNotice('Request rejected; the member can correct and resubmit it.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to reject member.') } }
  async function saveReunion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await setDoc(doc(db, `batches/${PILOT_BATCH_ID}/reunion/config`), { title: data.get('title'), venue: data.get('venue'), venueMapUrl: data.get('mapUrl'), accommodation: data.get('accommodation'), logistics: data.get('logistics'), instructions: data.get('instructions'), rsvpCutoffAt: new Date(String(data.get('cutoff'))), updatedAt: serverTimestamp() }, { merge: true })
    setNotice('Reunion configuration saved.')
  }
  async function addSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await addDoc(collection(db, `batches/${PILOT_BATCH_ID}/reunionSchedule`), { title: data.get('title'), location: data.get('location'), startsAt: new Date(String(data.get('startsAt'))), endsAt: new Date(String(data.get('endsAt'))), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    event.currentTarget.reset(); setNotice('Schedule event added.')
  }
  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    await addDoc(collection(db, `batches/${PILOT_BATCH_ID}/reunionContacts`), { name: data.get('name'), role: data.get('role'), phone: data.get('phone'), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    event.currentTarget.reset(); setNotice('Contact added.')
  }
  async function announce(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try { const result = await call('publishAnnouncement', { batchId: PILOT_BATCH_ID, title: data.get('title'), body: data.get('body') }) as { data: { delivered: number } }; event.currentTarget.reset(); setNotice(`Announcement delivered to ${result.data.delivered} active members.`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to publish announcement.') }
  }
  async function savePaymentConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const qr = data.get('qr') as File
    const qrStoragePath = `batches/${PILOT_BATCH_ID}/reunion/qr/${Date.now()}-${qr.name}`
    await uploadBytes(ref(firebaseServices().storage, qrStoragePath), qr)
    await setDoc(doc(db, `batches/${PILOT_BATCH_ID}/paymentConfig/current`), { defaultFamilyAmountPaise: Math.round(Number(data.get('amount')) * 100), targetPaise: Math.round(Number(data.get('target')) * 100), currency: 'INR', upiId: data.get('upiId'), accountLabel: data.get('label'), contributionHeads: String(data.get('heads')).split(',').map((item) => item.trim()).filter(Boolean), qrStoragePath, updatedBy: firebaseServices().auth.currentUser?.uid, updatedAt: serverTimestamp() }, { merge: true })
    setNotice('Payment instructions saved.')
  }
  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const receipt = data.get('receipt') as File
    const result = await httpsCallable<Record<string, unknown>, { expenseId: string }>(firebaseServices().functions, 'saveExpense')({ batchId: PILOT_BATCH_ID, requestId: crypto.randomUUID(), category: data.get('category'), amountPaise: Math.round(Number(data.get('amount')) * 100), vendor: data.get('vendor'), expenseDate: data.get('date'), notes: data.get('notes') })
    if (receipt.size) { const path = `batches/${PILOT_BATCH_ID}/expenses/${result.data.expenseId}/receipts/${Date.now()}-${receipt.name}`; await uploadBytes(ref(firebaseServices().storage, path), receipt); await call('attachExpenseReceipt', { batchId: PILOT_BATCH_ID, expenseId: result.data.expenseId, receiptStoragePath: path }) }
    await refresh(); event.currentTarget.reset(); setNotice('Expense saved as draft.')
  }
  async function reviewClaim(claimId: string, status: string) { await call('reviewPaymentClaim', { batchId: PILOT_BATCH_ID, claimId, status }); await refresh(); setNotice(`Payment marked ${status}.`) }
  async function reviewExpense(expenseId: string, status: string) { await call('reviewExpense', { batchId: PILOT_BATCH_ID, expenseId, status }); await refresh(); setNotice(`Expense ${status}.`) }
  function exportLedger() {
    const csv = ledgerCsv([...claims.map((claim) => ({ recordType: 'payment' as const, recordId: claim.id, status: claim.status, amountPaise: claim.amountPaise, contributionHead: claim.contributionHead, memberUid: claim.memberUid })), ...expenses.map((expense) => ({ recordType: 'expense' as const, recordId: expense.id, status: expense.status, amountPaise: expense.amountPaise, category: expense.category, vendor: expense.vendor }))])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = 'ajinkyans-reunion-ledger.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="page-stack"><div><p className="eyebrow">Coordinator</p><h1>Batch operations</h1></div>
    <section className="panel"><h2>Pending access requests</h2>{requests.map((request) => <div className="member-row" key={request.id}><span><strong>{request.displayName}</strong><small>{request.houseId ?? 'No house selected'}</small></span><span className="member-actions"><button onClick={() => void approve(request.id)}>Approve</button><button onClick={() => void reject(request.id)}>Reject</button></span></div>)}</section>
    <form className="panel form-stack" onSubmit={announce}><h2>Batch announcement</h2><label>Title<input name="title" maxLength={120} required /></label><label>Message<textarea name="body" maxLength={1000} required /></label><button>Publish announcement</button></form>
    <form className="panel form-stack" onSubmit={saveReunion}><h2>Reunion details</h2><label>Title<input name="title" defaultValue="Silver Jubilee Reunion" required /></label><label>Venue<input name="venue" required /></label><label>Google Maps link<input name="mapUrl" type="url" required /></label><label>RSVP cutoff<input name="cutoff" type="datetime-local" required /></label><label>Accommodation<textarea name="accommodation" maxLength={3000} /></label><label>Arrival, parking and logistics<textarea name="logistics" maxLength={3000} /></label><label>Instructions<textarea name="instructions" maxLength={3000} /></label><button>Save reunion details</button></form>
    <form className="panel form-stack" onSubmit={addSchedule}><h2>Add schedule event</h2><label>Title<input name="title" required /></label><label>Location<input name="location" required /></label><label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" required /></label><button>Add event</button></form>
    <form className="panel form-stack" onSubmit={addContact}><h2>Add operational contact</h2><label>Name<input name="name" required /></label><label>Role<input name="role" required /></label><label>Phone<input name="phone" type="tel" required /></label><button>Add contact</button></form>
    <form className="panel form-stack" onSubmit={savePaymentConfig}><h2>Payment instructions</h2><label>Collection account label<input name="label" required /></label><label>UPI ID<input name="upiId" required /></label><label>Contribution heads (comma-separated)<input name="heads" defaultValue="Reunion contribution" required /></label><label>Suggested contribution (₹)<input name="amount" type="number" min="0" required /></label><label>Fund target (₹)<input name="target" type="number" min="0" required /></label><label>UPI QR image<input name="qr" type="file" accept="image/jpeg,image/png,image/heic,image/webp" required /></label><button>Save payment instructions</button></form>
    <section className="panel"><h2>Payment claims</h2>{claims.map((claim) => <div className="member-row" key={claim.id}><span><strong>{claim.contributionHead ?? 'Contribution'} · ₹{claim.amountPaise / 100}</strong><small>{claim.memberUid} · UTR {claim.utr} · {claim.status}</small></span><span className="member-actions"><button onClick={() => void reviewClaim(claim.id, 'underReview')}>Clarify</button><button onClick={() => void reviewClaim(claim.id, 'verified')}>Verify</button><button onClick={() => void reviewClaim(claim.id, 'rejected')}>Reject</button></span></div>)}<button onClick={() => void call('rebuildFundSummary', { batchId: PILOT_BATCH_ID })}>Rebuild fund summary</button><button onClick={exportLedger}>Export CSV ledger</button></section>
    <form className="panel form-stack" onSubmit={saveExpense}><h2>Add expense</h2><label>Category<select name="category">{EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>Vendor<input name="vendor" required /></label><label>Amount (₹)<input name="amount" type="number" min="1" step="0.01" required /></label><label>Date<input name="date" type="date" required /></label><label>Notes<textarea name="notes" maxLength={1000} /></label><label>Receipt (optional)<input name="receipt" type="file" accept="image/jpeg,image/png,image/heic,image/webp,application/pdf" /></label><button>Save expense draft</button></form>
    <section className="panel"><h2>Expense review</h2>{expenses.map((expense) => <div className="member-row" key={expense.id}><span><strong>{expense.category} · ₹{expense.amountPaise / 100}</strong><small>{expense.vendor} · {expense.status}</small></span><span className="member-actions"><button onClick={() => void reviewExpense(expense.id, 'approved')}>Approve</button><button onClick={() => void reviewExpense(expense.id, 'rejected')}>Reject</button></span></div>)}</section>
    <section className="panel"><h2>Membership management</h2>{members.map((member) => <div className="member-row" key={member.uid}><span><strong>{member.displayName ?? member.uid}</strong><small>{member.status} · {member.role ?? 'batchmate'}</small></span><span className="member-actions"><select aria-label={`House for ${member.uid}`} defaultValue={member.houseId ?? ''} onChange={(event) => void manage(member.uid, 'assignHouse', event.target.value)}><option value="" disabled>Assign house</option>{HOUSES.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select>{member.status === 'active' ? <button onClick={() => void manage(member.uid, 'suspend')}>Suspend</button> : <button onClick={() => void manage(member.uid, 'reinstate')}>Reinstate</button>}<button onClick={() => void manage(member.uid, 'remove')}>Remove</button><button onClick={() => void call('reopenRsvp', { batchId: PILOT_BATCH_ID, memberUid: member.uid })}>Reopen RSVP</button></span></div>)}</section>{notice && <p role="status">{notice}</p>}</section>
}
