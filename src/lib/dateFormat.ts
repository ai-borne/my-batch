import { APP_TIME_ZONE } from './batchDefaults'

export function formatIndianDate(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: APP_TIME_ZONE, dateStyle: 'medium' }).format(value)
}

export function formatIndianDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-IN', { timeZone: APP_TIME_ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(value)
}
