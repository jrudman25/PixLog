'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Comment } from '@/types';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import styles from './CommentList.module.css';

interface CommentListProps {
  photoId: string;
}

export default function CommentList({ photoId }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const supabaseRef = useRef(createClient());

  const fetchComments = useCallback(async () => {
    const supabase = supabaseRef.current;
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('photo_id', photoId)
      .order('created_at', { ascending: true });

    if (data) {
      // Fetch profiles for comment authors
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      setComments(
        data.map((c) => ({
          ...c,
          profile: profileMap.get(c.user_id) || undefined,
        }))
      );
    }
    setLoading(false);
  }, [photoId]);

  useEffect(() => {
    fetchComments();
    const supabase = supabaseRef.current;

    // Realtime subscription for comments
    const channel = supabase
      .channel(`comments-${photoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `photo_id=eq.${photoId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [photoId, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);

    const { error } = await supabaseRef.current.from('comments').insert({
      photo_id: photoId,
      user_id: user.id,
      content: newComment.trim(),
    });

    if (!error) {
      setNewComment('');
      await fetchComments();
    }

    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabaseRef.current.from('comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        Comments{' '}
        {comments.length > 0 && (
          <span className={styles.count}>{comments.length}</span>
        )}
      </h3>

      {comments.length > 0 ? (
        <div className={styles.list}>
          {comments.map((comment) => (
            <div key={comment.id} className={styles.comment}>
              <div className="avatar avatar-sm">
                {comment.profile?.avatar_url ? (
                  <img src={comment.profile.avatar_url} alt="" />
                ) : (
                  getInitials(comment.profile?.display_name || '?')
                )}
              </div>
              <div className={styles.commentBody}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>
                    {comment.profile?.display_name || 'Unknown'}
                  </span>
                  <span className={styles.commentTime}>
                    {formatRelativeTime(comment.created_at)}
                  </span>
                  {comment.user_id === user?.id && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(comment.id)}
                      type="button"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className={styles.commentText}>{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyText}>No comments yet</p>
      )}

      {/* Comment input */}
      <form onSubmit={handleSubmit} className={styles.inputRow}>
        <input
          type="text"
          className="input"
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          id="comment-input"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={submitting || !newComment.trim()}
          id="comment-submit"
        >
          {submitting ? (
            <span className="spinner" style={{ width: 14, height: 14 }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
