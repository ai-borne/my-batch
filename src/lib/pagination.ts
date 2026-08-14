export const PAGE_SIZE = 25

export type CursorPage = { hasMore: boolean; cursor?: string }

export function pageState(items: Array<{ id: string }>, nextCursor?: string): CursorPage {
  return items.length === PAGE_SIZE && nextCursor ? { hasMore: true, cursor: nextCursor } : { hasMore: false }
}
