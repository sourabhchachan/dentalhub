import { create } from 'zustand'
interface AuthState {
  role: 'receptionist' | 'doctor' | 'admin' | null
  userId: string | null
  staffId: string | null
  name: string | null
  setAuth: (role: AuthState['role'], userId: string, staffId: string, name: string) => void
  clearAuth: () => void
}
export const useAuthStore = create<AuthState>((set) => ({
  role: null, userId: null, staffId: null, name: null,
  setAuth: (role, userId, staffId, name) => set({ role, userId, staffId, name }),
  clearAuth: () => set({ role: null, userId: null, staffId: null, name: null }),
}))
