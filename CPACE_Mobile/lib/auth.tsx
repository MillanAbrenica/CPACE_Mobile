// Auth context backed by the Laravel PHP API.
// Persists the bearer token + user, and re-validates the session on launch.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { loadToken, setToken } from './http';
import type { User } from './types';

const STORAGE_KEY = 'cpace.user';

interface AuthState {
  user: User | null;
  loading: boolean; // true while restoring persisted session
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (token && raw) {
          // Show the cached user immediately, then confirm the token still works.
          setUser(JSON.parse(raw));
          try {
            const fresh = await api.me();
            setUser(fresh);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
          } catch (e: any) {
            if (e?.status === 401) {
              // token expired/revoked on the server
              await setToken(null);
              await AsyncStorage.removeItem(STORAGE_KEY);
              setUser(null);
            }
            // network errors keep the cached session (offline-friendly)
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (u: User | null) => {
    setUser(u);
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login: async (email, password) => persist(await api.login(email, password)),
      signup: async (name, email, password) => persist(await api.signup(name, email, password)),
      logout: async () => {
        await api.logout();
        await persist(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
