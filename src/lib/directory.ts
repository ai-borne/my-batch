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
export type DirectoryResult = { members: DirectoryMember[]; nextCursor: DirectoryCursor | null; hasMore: boolean }
export type DirectoryHouse = { id: string; name: string; group: string; accent: string; crestLabel: string; memberCount: number }

export function normalizeDirectoryQuery(query: DirectoryQuery): DirectoryQuery {
  const filters = Object.fromEntries(Object.entries(query.filters ?? {}).filter(([key, value]) => DIRECTORY_FILTERS.includes(key as DirectoryFilter) && value?.trim()).map(([key, value]) => [key, value!.trim().toLocaleLowerCase()]))
  const limit = Number.isInteger(query.limit) ? Math.min(Math.max(query.limit, 1), 50) : 25
  const search = query.search?.trim().toLocaleLowerCase() || undefined
  const sort = search || Object.keys(filters).length ? 'displayName' : DIRECTORY_SORTS.includes(query.sort ?? 'displayName') ? query.sort ?? 'displayName' : 'displayName'
  return { ...query, search, filters, sort, limit }
}

export function directorySearchFields(profile: Pick<DirectoryMember, 'displayName' | 'city' | 'profession' | 'houseId'>) {
  return {
    directoryDisplayName: profile.displayName.trim().toLocaleLowerCase(),
    directoryCity: profile.city?.trim().toLocaleLowerCase() || null,
    directoryProfession: profile.profession?.trim().toLocaleLowerCase() || null,
    directoryHouseId: profile.houseId ?? null,
  }
}
