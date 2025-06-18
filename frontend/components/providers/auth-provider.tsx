"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { useRouter, usePathname } from 'next/navigation';
import socketApi from '@/services/socket-api';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/panel', '/dashboard'];

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const { user, token, checkAuth, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize auth only once on mount
  useEffect(() => {
    const initializeAuth = async () => {
      // If we have a token stored, set it in the Socket API
      if (token) {
        await socketApi.setToken(token);
        
        // Only check auth validity for protected routes
        const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
        if (isProtectedRoute) {
          const isValid = await checkAuth();
          if (!isValid) {
            router.replace('/login');
            setIsInitialized(true);
            return;
          }
        }
      }

      setIsInitialized(true);
    };

    initializeAuth();
  }, []); // Empty dependencies - only run once on mount, ignore eslint warning

  // Handle route changes after initialization
  useEffect(() => {
    if (!isInitialized) return;

    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isAuthRoute = pathname === '/login' || pathname === '/register';

    if (isProtectedRoute && !token) {
      router.replace('/login');
    } else if (isAuthRoute && token && user) {
      router.replace('/panel');
    }
  }, [isInitialized, pathname, token, user, router]);

  // Listen for authentication events
  useEffect(() => {
    const handleAuthEvent = () => {
      logout();
      router.replace('/login');
    };

    window.addEventListener('auth:unauthorized', handleAuthEvent);
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleAuthEvent);
    };
  }, [logout, router]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}