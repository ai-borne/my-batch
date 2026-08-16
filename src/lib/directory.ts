export const DIRECTORY_FILTERS = ['house', 'city', 'profession'] as const
export const DIRECTORY_SORTS = ['displayName', 'house'] as const

export type DirectoryFilter = typeof DIRECTORY_FILTERS[number]
export type DirectorySort = typeof DIRECTORY_SORTS[number]
export type DirectoryCursor = { displayName: string; uid: string }
export type DirectoryQuery = {
  search?: string
  filters?: Partial<Record<DirectoryFilter, string>>
  sort?: DirectorySort
  cursor?: DirectoryCursor
  limit: number
}
export type DirectoryMember = { uid: string; displayName: string; houseId: string | null; city: string | null; profession: string | null; avatarPath: string | null }
export type DirectoryResult = { members: DirectoryMember[]; nextCursor: DirectoryCursor | null; totalCount: number }

export function normalizeDirectoryQuery(query: DirectoryQuery): DirectoryQuery {
  const filters = Object.fromEntries(Object.entries(query.filters ?? {}).filter(([key, value]) => DIRECTORY_FILTERS.includes(key as DirectoryFilter) && value?.trim()).map(([key, value]) => [key, value!.trim().toLocaleLowerCase()]))
  return { ...query, search: query.search?.trim().toLocaleLowerCase() || undefined, filters, sort: DIRECTORY_SORTS.includes(query.sort ?? 'displayName') ? query.sort : 'displayName' }
}
