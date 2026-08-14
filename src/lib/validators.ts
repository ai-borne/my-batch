import type { HouseId } from './types'

export function isHouseId(value: unknown): value is HouseId {
  return typeof value === 'string' && ['shivaji', 'nehru', 'karve', 'rana-pratap', 'shastri', 'tilak'].includes(value)
}

export function isNonEmptyText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum
}

export function isPositivePaise(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 1_000_000_000
}
