'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import styles from './invite.module.css';

export default function InvitePage({
  params: paramsPromise,
}: {
  params: Promise<{ code: string }>;
}) {
  const [params, setParams] = useState<{ code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [timelineName, setTimelineName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (!params) return;

    if (!user) {
      router.push(`/auth/login?redirect=/invite/${params.code}`);
      return;
    }

    if (!profile?.username) {
      router.push('/profile/setup');
      return;
    }

    const checkInvite = async () => {
      const supabase = supabaseRef.current;
      const { data: timeline } = await supabase
        .from('timelines')
        .select('id, name')
        .eq('invite_code', params.code)
        .single();

      if (!timeline) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      setTimelineName(timeline.name);

      // Check if already a member
      const { data: existing } = await supabase
        .from('timeline_members')
        .select('id')
        .eq('timeline_id', timeline.id)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        router.push(`/timeline/${timeline.id}`);
        return;
      }

      setLoading(false);
    };

    checkInvite();
  }, [params, user, profile, router]);

  const handleJoin = async () => {
    if (!params || !user) return;
    setJoining(true);

    const supabase = supabaseRef.current;
    const { data: timeline } = await supabase
      .from('timelines')
      .select('id')
      .eq('invite_code', params.code)
      .single();

    if (!timeline) {
      setError('Invalid invite');
      setJoining(false);
      return;
    }

    const { error: joinError } = await supabase
      .from('timeline_members')
      .insert({
        timeline_id: timeline.id,
        user_id: user.id,
        role: 'member',
      });

    if (joinError) {
      showToast('Failed to join', 'error');
      setJoining(false);
      return;
    }

    showToast('Joined timeline!', 'success');
    router.push(`/timeline/${timeline.id}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className="empty-state-icon">😕</div>
          <h1 className={styles.title}>{error}</h1>
          <p className={styles.subtitle}>
            This invite link may have expired or been removed
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => router.push('/')}
            type="button"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <h1 className={styles.title}>You&apos;re invited!</h1>
        <p className={styles.subtitle}>
          Join <strong>{timelineName}</strong> and start sharing photos
        </p>
        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleJoin}
          disabled={joining}
          type="button"
          id="join-btn"
        >
          {joining ? <span className="spinner" /> : 'Join Timeline'}
        </button>
      </div>
    </div>
  );
}
