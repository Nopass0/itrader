import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User, LoginCredentials } from '@/types';
import apiClient from '@/lib/api';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post('/auth/login', credentials);
          
          if (response.success && response.data) {
            const { token, user } = response.data;
            apiClient.setToken(token);
            set({ user, token, isLoading: false, error: null });
            return true;
          } else {
            set({ isLoading: false, error: response.error || 'Ошибка аутентификации' });
            return false;
          }
        } catch (error: any) {
          set({ isLoading: false, error: error.message || 'Ошибка аутентификации' });
          return false;
        }
      },

      logout: () => {
        apiClient.clearToken();
        set({ user: null, token: null, error: null });
      },

      checkAuth: async () => {
        const token = get().token;
        if (!token) return false;
        
        try {
          const response = await apiClient.get('/auth/me');
          
          if (response.success && response.data) {
            set({ user: response.data.user });
            return true;
          } else {
            get().logout();
            return false;
          }
        } catch (error) {
          get().logout();
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);