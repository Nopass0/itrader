import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User, LoginCredentials } from '@/types';
import socketApi from '@/services/socket-api';
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
            await socketApi.setToken(token);
            set({ user, token, isLoading: false, error: null });
            return true;
          } else {
            // Socket API login
            const response = await socketApi.login(credentials.username, credentials.password);

            if (response.success && response.data) {
              const { token, user } = response.data;
              await socketApi.setToken(token);
              set({ user, token, isLoading: false, error: null });
              return true;
            } else {
              set({ isLoading: false, error: response.error?.message || 'Authentication failed' });
              return false;
            }
          }
        } catch (error: any) {
          set({ isLoading: false, error: error.message || 'Authentication failed' });
          return false;
        }
      },

      logout: async () => {
        try {
          if (!get().isMockMode) {
            await socketApi.logout();
          }
        } catch (error) {
          console.error('Logout error:', error);
        }
        
        socketApi.clearToken();
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

          // Socket API auth check
          const response = await socketApi.accounts.getCurrentUser();

          if (response.success && response.data) {
            // Only update user if it's significantly different to avoid unnecessary re-renders
            const currentUser = get().user;
            if (!currentUser || 
                currentUser.id !== response.data.id ||
                currentUser.username !== response.data.username) {
              set({ user: response.data });
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
        // Set token in Socket API when store is rehydrated
        if (state?.token) {
          // We can't await here, but setToken will handle it internally
          socketApi.setToken(state.token);
        }
      },
    }
  )
);