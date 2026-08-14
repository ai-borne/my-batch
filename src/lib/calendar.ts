export function calendarEventIcs(event: { id: string; title: string; startsAt: Date; endsAt?: Date; location?: string }) {
  const timestamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const text = (value: string) => value.replace(/[\r\n,;]/g, ' ')
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${text(event.id)}@ajinkyans\r\nDTSTART:${timestamp(event.startsAt)}\r\nDTEND:${timestamp(event.endsAt ?? event.startsAt)}\r\nSUMMARY:${text(event.title)}\r\nLOCATION:${text(event.location ?? '')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`
}
