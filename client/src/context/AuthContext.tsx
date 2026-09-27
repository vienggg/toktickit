import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, parseApiError } from '../api';

export type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string;
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
      setError('Unable to reach the server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const message = await parseApiError(res, 'Invalid email or password.');
        return { ok: false as const, message };
      }
      const data = await res.json();
      setUser(data.user);
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Unable to reach the server. Please try again.' };
    }
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
