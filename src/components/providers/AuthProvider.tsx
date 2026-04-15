'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabaseRef.current
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch profile:', error);
        return null;
      }

      return data || null;
    } catch (err) {
      console.error('Network exception fetching profile:', err);
      return null;
    }
  }, []);

  const syncAuthState = useCallback(
    async (currentUser: User | null, showLoading: boolean) => {
      const requestId = ++requestIdRef.current;

      if (mountedRef.current) {
        if (showLoading) {
          setLoading(true);
        }

        setUser(currentUser);

        if (!currentUser) {
          setProfile(null);
        } else {
          setProfile((currentProfile) =>
            currentProfile?.id === currentUser.id ? currentProfile : null
          );
        }
      }

      if (!currentUser) {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
        }
        return;
      }

      const nextProfile = await fetchProfile(currentUser.id);

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setProfile(nextProfile);
      setLoading(false);
    },
    [fetchProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      const nextProfile = await fetchProfile(user.id);

      if (mountedRef.current) {
        setProfile(nextProfile);
      }
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    mountedRef.current = true;

    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        await syncAuthState(session?.user ?? null, true);
      } catch (err) {
        console.error('Error fetching session:', err);

        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    void getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        void syncAuthState(
          session?.user ?? null,
          event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED'
        );
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [syncAuthState]);

  const signOut = async () => {
    await supabaseRef.current.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
