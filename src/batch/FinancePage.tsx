import { FormEvent, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore/lite'
import { getBlob, ref, uploadBytes } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { firebaseServices } from '../lib/firebase'
import { PILOT_BATCH_ID } from '../lib/membership'

type Config = { upiId?: string; accountLabel?: string; defaultFamilyAmountPaise?: number; qrStoragePath?: string }
type Summary = { targetPaise?: number; collectedPaise?: number; expensePaise?: number; balancePaise?: number; verifiedFamilyCount?: number }
type Expense = { id: string; category: string; amountPaise: number; expenseDate?: { toDate: () => Date }; receiptStoragePath?: string }
const formatInr = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

export function FinancePage() {
  const [config, setConfig] = useState<Config>({}); const [summary, setSummary] = useState<Summary>({}); const [expenses, setExpenses] = useState<Expense[]>([]); const [notice, setNotice] = useState(''); const [showQr, setShowQr] = useState(false); const [qrUrl, setQrUrl] = useState('')
  useEffect(() => {
    const db = firebaseServices().db
    void Promise.all([getDoc(doc(db, `batches/${PILOT_BATCH_ID}/paymentConfig/current`)), getDoc(doc(db, `batches/${PILOT_BATCH_ID}/fundSummary/public`)), getDocs(query(collection(db, `batches/${PILOT_BATCH_ID}/expenses`), where('status', '==', 'approved')))]).then(([payment, fund, expenseDocs]) => {
      setConfig(payment.data() ?? {})
      setSummary(fund.data() ?? {})
      setExpenses(expenseDocs.docs.map((item) => ({ id: item.id, ...item.data() } as Expense)))
    })
  }, [])
  useEffect(() => () => { if (qrUrl) URL.revokeObjectURL(qrUrl) }, [qrUrl])
  async function openQr() { if (!config.qrStoragePath) return setNotice('The QR code will be added by a Coordinator.'); try { const blob = await getBlob(ref(firebaseServices().storage, config.qrStoragePath)); setQrUrl(URL.createObjectURL(blob)); setShowQr(true) } catch { setNotice('Unable to load the QR code.') } }
  async function copyUpi() { if (!config.upiId) return; await navigator.clipboard.writeText(config.upiId); setNotice('UPI ID copied.') }
  function openUpi() { if (!config.upiId) return setNotice('Payment instructions will be added by a Coordinator.'); window.location.assign(`upi://pay?pa=${encodeURIComponent(config.upiId)}&am=${((config.defaultFamilyAmountPaise ?? 0) / 100).toFixed(2)}&cu=INR`) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const screenshot = form.get('screenshot') as File
    try {
      const result = await httpsCallable<{ batchId: string; amountPaise: number; utr: string; paymentDate: string; contributionHead: string }, { claimId: string }>(firebaseServices().functions, 'submitPaymentClaim')({ batchId: PILOT_BATCH_ID, amountPaise: Math.round(Number(form.get('amount')) * 100), utr: String(form.get('utr')), paymentDate: String(form.get('paymentDate')), contributionHead: String(form.get('contributionHead')) })
      if (screenshot?.size) { const path = `batches/${PILOT_BATCH_ID}/payments/${result.data.claimId}/evidence/${Date.now()}-${screenshot.name}`; await uploadBytes(ref(firebaseServices().storage, path), screenshot); await httpsCallable(firebaseServices().functions, 'attachPaymentEvidence')({ batchId: PILOT_BATCH_ID, claimId: result.data.claimId, screenshotStoragePath: path }) }
      event.currentTarget.reset(); setNotice('Payment claim submitted for Coordinator review.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to submit the payment claim.') }
  }
  return <section className="page-stack"><div><p className="eyebrow">Reunion fund</p><h1>Transparent, together.</h1></div><section className="panel"><div className="finance-summary"><span><small>Collected</small><strong>{formatInr(summary.collectedPaise)}</strong></span><span><small>Expenses</small><strong>{formatInr(summary.expensePaise)}</strong></span><span><small>Balance</small><strong>{formatInr(summary.balancePaise)}</strong></span></div><p className="muted">{summary.verifiedFamilyCount ?? 0} verified contributing families · Target {formatInr(summary.targetPaise)}</p></section><section className="panel"><h2>Pay the reunion fund</h2><p className="muted">Pay directly to {config.accountLabel ?? 'the designated collection account'}. Never share a UPI PIN, password, or card details.</p><div className="member-actions"><button type="button" onClick={openUpi}>Open UPI app</button><button type="button" onClick={() => void copyUpi()} disabled={!config.upiId}>Copy UPI ID</button><button type="button" onClick={() => void openQr()}>Show QR</button></div>{showQr && qrUrl && <img className="payment-qr" src={qrUrl} alt="Coordinator UPI payment QR code" />}</section><form className="panel form-stack" onSubmit={submit}><h2>Submit payment claim</h2><p className="muted">Your UTR and screenshot are visible only to Coordinators.</p><label>Contribution head<input name="contributionHead" defaultValue="Reunion contribution" maxLength={80} required /></label><label>Amount paid (₹)<input name="amount" type="number" min="1" step="0.01" required /></label><label>UTR / transaction ID<input name="utr" maxLength={100} required /></label><label>Payment date<input name="paymentDate" type="date" required /></label><label>Screenshot (optional)<input name="screenshot" type="file" accept="image/jpeg,image/png,image/heic,image/webp" /></label><button type="submit">Submit for review</button></form><section className="panel"><h2>Approved expenses</h2><div className="directory">{expenses.map((expense) => <div className="member-row" key={expense.id}><span><strong>{expense.category}</strong><small>{expense.expenseDate?.toDate().toLocaleDateString('en-IN') ?? 'Date pending'}</small></span><strong>{formatInr(expense.amountPaise)}</strong></div>)}{!expenses.length && <p className="muted">No approved expenses yet.</p>}</div></section>{notice && <p role="status">{notice}</p>}</section>
}
