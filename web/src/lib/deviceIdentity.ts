const STORAGE_KEY = 'prok-vacation-device-user'

export const FAMILY_USERS = ['Prok', 'Hanna', 'Max', 'Troy'] as const

export type FamilyUser = (typeof FAMILY_USERS)[number]

export function getDeviceUser(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v?.trim() || null
  } catch {
    return null
  }
}

export function setDeviceUser(name: string): void {
  localStorage.setItem(STORAGE_KEY, name.trim())
}

export function clearDeviceUser(): void {
  localStorage.removeItem(STORAGE_KEY)
}
