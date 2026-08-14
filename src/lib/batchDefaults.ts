import type { HouseId } from './types'

export const PILOT_BATCH_ID = 'batch-2002-3711'
export const APP_TIME_ZONE = 'Asia/Kolkata'
export const PASSING_YEAR = 2002
export const HOUSES: ReadonlyArray<{ id: HouseId; name: string; group: 'Junior' | 'Senior' }> = [
  { id: 'shivaji', name: 'Shivaji', group: 'Junior' },
  { id: 'nehru', name: 'Nehru', group: 'Junior' },
  { id: 'karve', name: 'Karve', group: 'Senior' },
  { id: 'rana-pratap', name: 'Rana Pratap', group: 'Senior' },
  { id: 'shastri', name: 'Shastri', group: 'Senior' },
  { id: 'tilak', name: 'Tilak', group: 'Senior' },
]
