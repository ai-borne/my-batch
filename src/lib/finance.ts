export const EXPENSE_CATEGORIES = ['venue', 'accommodation', 'food', 'transport', 'programme', 'administration', 'contingency', 'other'] as const
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export const LEDGER_COLUMNS = ['recordType', 'recordId', 'status', 'amountPaise', 'contributionHead', 'category', 'vendor', 'memberUid', 'transactionDate'] as const
export type LedgerRecord = { recordType: 'payment' | 'expense'; recordId: string; status: string; amountPaise: number; contributionHead?: string; category?: string; vendor?: string; memberUid?: string; transactionDate?: string }

export function escapeCsv(value: string | number | undefined) { return `"${String(value ?? '').replaceAll('"', '""')}"` }
export function ledgerCsv(records: LedgerRecord[]) {
  return [LEDGER_COLUMNS, ...records.map((record) => LEDGER_COLUMNS.map((column) => escapeCsv(record[column] ?? '')))].map((row) => row.join(',')).join('\n')
}
export function fundTotals(claims: Array<{ status: string; amountPaise: number; memberUid: string }>, expenses: Array<{ status: string; amountPaise: number }>, targetPaise: number) {
  const verified = claims.filter((claim) => claim.status === 'verified')
  const approved = expenses.filter((expense) => expense.status === 'approved')
  const collectedPaise = verified.reduce((total, claim) => total + claim.amountPaise, 0)
  const expensePaise = approved.reduce((total, expense) => total + expense.amountPaise, 0)
  return { targetPaise, collectedPaise, expensePaise, balancePaise: collectedPaise - expensePaise, verifiedFamilyCount: new Set(verified.map((claim) => claim.memberUid)).size, verifiedPaymentCount: verified.length }
}
