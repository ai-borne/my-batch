export type DisplayAuthor = { displayName: string; avatarPath: string | null; houseId: string | null }

export function displayNameFor(author: Partial<DisplayAuthor>): string {
  return author.displayName?.trim() || 'Batchmate'
}
