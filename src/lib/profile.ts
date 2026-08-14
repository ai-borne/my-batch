import type { HouseId } from './types'

export type SocialLinks = { linkedin?: string; instagram?: string; website?: string }
export type MemberProfile = {
  uid: string; displayName: string; city?: string; profession?: string; about?: string; favouriteSchoolMemory?: string
  teacherOrActivity?: string; houseId?: HouseId; avatarPath?: string; socialLinks?: SocialLinks
}

const textLimits = { displayName: 100, city: 100, profession: 100, about: 500, favouriteSchoolMemory: 500, teacherOrActivity: 150 } as const
export const themeOptions = ['system', 'light', 'dark'] as const
export type ThemePreference = typeof themeOptions[number]

export function profileValues(input: Record<string, FormDataEntryValue>): Omit<MemberProfile, 'uid' | 'houseId' | 'avatarPath'> {
  const values = Object.fromEntries(Object.entries(textLimits).map(([key, maximum]) => {
    const value = String(input[key] ?? '').trim()
    if (value.length > maximum) throw new Error(`${key} is too long.`)
    return [key, value]
  })) as Record<keyof typeof textLimits, string>
  if (!values.displayName) throw new Error('Name is required.')
  const socialLinks = socialValues(input)
  return { ...values, ...(Object.keys(socialLinks).length ? { socialLinks } : {}) }
}

function socialValues(input: Record<string, FormDataEntryValue>): SocialLinks {
  return Object.fromEntries(['linkedin', 'instagram', 'website'].flatMap((key) => {
    const value = String(input[key] ?? '').trim()
    if (!value) return []
    let url: URL
    try { url = new URL(value) } catch { throw new Error(`${key} must be a valid HTTPS URL.`) }
    if (url.protocol !== 'https:' || value.length > 300) throw new Error(`${key} must be a valid HTTPS URL.`)
    return [[key, value]]
  })) as SocialLinks
}

export function loadTheme(): ThemePreference { const value = localStorage.getItem('ajinkyans-theme'); return themeOptions.includes(value as ThemePreference) ? value as ThemePreference : 'system' }
export function applyTheme(preference: ThemePreference) { localStorage.setItem('ajinkyans-theme', preference); document.documentElement.dataset.theme = preference }
