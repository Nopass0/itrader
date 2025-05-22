import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User, LoginCredentials } from '@/types';
import apiClient from '@/lib/api';
import { MockService } from '@/services/mockService';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  isMockMode: boolean;
  setMockMode: (isMock: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      isMockMode: false,

      setMockMode: (isMock: boolean) => {
        set({ isMockMode: isMock });
      },

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // Check if we're in mock mode
          if (get().isMockMode) {
            // Use mock service for login
            const { user, token } = await MockService.login(credentials.username, credentials.password);

            // Set the authentication state
            apiClient.setToken(token);
            set({ user, token, isLoading: false, error: null });
            return true;
          } else {
            // Regular API login
            const response = await apiClient.post('/auth/login', credentials);

            if (response.success && response.data) {
              const { token, user } = response.data as any;
              apiClient.setToken(token);
              set({ user, token, isLoading: false, error: null });
              return true;
            } else {
              set({ isLoading: false, error: response.error || 'Ошибка аутентификации' });
              return false;
            }
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
        const { token, user, isMockMode } = get();
        if (!token) return false;

        try {
          // If we're in mock mode, assume the token is valid if we have a user
          if (isMockMode) {
            return !!user;
          }

          // Regular API auth check
          const response = await apiClient.get('/auth/me');

          if (response.success && response.data) {
            // Only update user if it's different to avoid unnecessary re-renders
            if (!user || user.id !== (response.data as any).id) {
              set({ user: response.data as any });
            }
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
      partialize: (state) => ({ user: state.user, token: state.token, isMockMode: state.isMockMode }),
      onRehydrateStorage: () => (state) => {
        // Set token in API client when store is rehydrated
        if (state?.token) {
          apiClient.setToken(state.token);
        }
      },
    }
  )
);