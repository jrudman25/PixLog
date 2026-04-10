'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { generateInviteCode } from '@/lib/utils';
import BottomNav from '@/components/layout/BottomNav';
import styles from './new.module.css';

export default function NewTimelinePage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabaseRef = useRef(createClient());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const inviteCode = generateInviteCode();

    const { data: timeline, error } = await supabaseRef.current
      .from('timelines')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        created_by: user.id,
        invite_code: inviteCode,
      })
      .select()
      .single();

    if (error) {
      showToast(error.message, 'error');
      setLoading(false);
      return;
    }

    // Add creator as a member
    await supabaseRef.current.from('timeline_members').insert({
      timeline_id: timeline.id,
      user_id: user.id,
      role: 'creator',
    });

    showToast('Timeline created!', 'success');
    router.push(`/timeline/${timeline.id}`);
  };

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">New Timeline</h1>
          <p className="page-subtitle">
            Create a shared timeline for photos and memories
          </p>
        </div>

        <form onSubmit={handleCreate} className={styles.form}>
          <div className="input-group">
            <label htmlFor="timeline-name" className="input-label">
              Timeline name
            </label>
            <input
              id="timeline-name"
              type="text"
              className="input"
              placeholder="e.g. Summer 2026, Road Trip, Wedding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="timeline-desc" className="input-label">
              Description{' '}
              <span style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <textarea
              id="timeline-desc"
              className="input textarea"
              placeholder="What's this timeline about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || !name.trim()}
            id="create-timeline-submit"
          >
            {loading ? <span className="spinner" /> : 'Create Timeline'}
          </button>
        </form>
      </div>
      <BottomNav />
    </>
  );
}
