import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loadSession: () => void;
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadSession: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('infracanvas_token');
    const userStr = localStorage.getItem('infracanvas_user');
    if (token && userStr) {
      try {
        set({ token, user: JSON.parse(userStr) });
      } catch (e) {
        localStorage.removeItem('infracanvas_token');
        localStorage.removeItem('infracanvas_user');
      }
    }
  },

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
      localStorage.setItem('infracanvas_token', data.token);
      localStorage.setItem('infracanvas_user', JSON.stringify(data.user));

      set({ token: data.token, user: data.user, isLoading: false });
      return true;
    } catch (err: any) {
      let errMsg = err.message || 'Login failed';
      if (errMsg === 'Failed to fetch' || errMsg.includes('fetch failed') || errMsg.includes('NetworkError')) {
        errMsg = 'Cannot connect to the backend server. Please verify the API service is running and try again.';
      }
      set({ error: errMsg, isLoading: false });
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
      let errMsg = err.message || 'Signup failed';
      if (errMsg === 'Failed to fetch' || errMsg.includes('fetch failed') || errMsg.includes('NetworkError')) {
        errMsg = 'Cannot connect to the backend server. Please verify the API service is running and try again.';
      }
      set({ error: errMsg, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('infracanvas_token');
    localStorage.removeItem('infracanvas_user');
    set({ token: null, user: null, error: null });
  },
}));
