'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import styles from './setup.module.css';

export default function ProfileSetupPage() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace('/auth/login?refresh=1');
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) {
      setError('Please sign in before setting up your profile.');
      setLoading(false);
      router.push('/auth/login?refresh=1');
      return;
    }

    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (sanitized.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    if (sanitized.length > 20) {
      setError('Username must be 20 characters or less');
      setLoading(false);
      return;
    }

    // Check if username is taken
    const { data: existing } = await supabaseRef.current
      .from('profiles')
      .select('id')
      .eq('username', sanitized)
      .maybeSingle();

    if (existing && existing.id !== user?.id) {
      setError('Username is already taken');
      setLoading(false);
      return;
    }

    const { error: upsertError } = await supabaseRef.current.from('profiles').upsert({
      id: user?.id,
      username: sanitized,
      display_name: displayName || user?.user_metadata?.display_name || sanitized,
    });

    if (upsertError) {
      setError(upsertError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    showToast('Profile created!', 'success');
    router.push('/');
    router.refresh();
  };

  if (authLoading || !user) {
    return (
      <div className={styles.container}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Set up your profile</h1>
          <p className={styles.subtitle}>
            Choose a username so others can find and invite you
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="input-group">
            <label htmlFor="username" className="input-label">
              Username
            </label>
            <div className={styles.usernameInput}>
              <span className={styles.prefix}>@</span>
              <input
                id="username"
                type="text"
                className="input"
                placeholder="yourname"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                  )
                }
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                style={{ paddingLeft: '2rem' }}
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="display-name" className="input-label">
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              className="input"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            id="setup-submit"
          >
            {loading ? <span className="spinner" /> : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
