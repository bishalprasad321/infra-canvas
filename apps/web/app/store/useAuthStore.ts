import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  plan: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  upgradePlan: (newPlan: string) => Promise<boolean>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const networkErrorMessage = (err: any, fallback: string) => {
  const msg = err.message || fallback;
  if (msg === 'Failed to fetch' || msg.includes('fetch failed') || msg.includes('NetworkError')) {
    return 'Cannot connect to the backend server. Please verify the API service is running and try again.';
  }
  return msg;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),
      clearError: () => set({ error: null }),

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || 'Invalid credentials');
          }

          const data = await res.json();
          set({ token: data.token, user: data.user, isLoading: false });
          return true;
        } catch (err: any) {
          set({ error: networkErrorMessage(err, 'Login failed'), isLoading: false });
          return false;
        }
      },

      signup: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || 'Signup failed');
          }

          // Auto login after signup
          set({ isLoading: false });
          return get().login(email, password);
        } catch (err: any) {
          set({ error: networkErrorMessage(err, 'Signup failed'), isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({ token: null, user: null, error: null });
      },

      upgradePlan: async (newPlan) => {
        const token = get().token;
        if (!token) return false;
        try {
          const res = await fetch(`${API_URL}/api/auth/upgrade`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ plan: newPlan }),
          });

          if (!res.ok) {
            throw new Error('Failed to upgrade plan');
          }

          const data = await res.json();
          set({ token: data.token, user: data.user });
          return true;
        } catch (err: any) {
          console.error("Upgrade error", err);
          return false;
        }
      },
    }),
    {
      name: 'infracanvas-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
