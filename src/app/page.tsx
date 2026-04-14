'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';
import type { TimelineWithMeta } from '@/types';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import styles from './home.module.css';

export default function HomePage() {
  const { user, profile, loading } = useAuth();
  const [timelines, setTimelines] = useState<TimelineWithMeta[]>([]);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (loading) {return;}
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (user && !profile?.username) {
      router.push('/profile/setup');
      return;
    }

    const supabase = supabaseRef.current;

    const fetchTimelines = async () => {
      try {
        // Get timelines the user is a member of
        const { data: memberships } = await supabase
          .from('timeline_members')
          .select('timeline_id')
          .eq('user_id', user.id);

        if (!memberships?.length) {
          if (mounted.current) { setFetching(false); }
          return;
        }

        const timelineIds = memberships.map((m) => m.timeline_id);

        const { data: timelineData } = await supabase
          .from('timelines')
          .select('*')
          .in('id', timelineIds)
          .order('updated_at', { ascending: false });

        if (timelineData) {
          // Get counts and creator info for each timeline
          const timelinesWithMeta: TimelineWithMeta[] = await Promise.all(
            timelineData.map(async (t) => {
              const [{ count: memberCount }, { count: photoCount }, { data: creator }, { data: latestPhoto }] =
                await Promise.all([
                  supabase
                    .from('timeline_members')
                    .select('*', { count: 'exact', head: true })
                    .eq('timeline_id', t.id),
                  supabase
                    .from('photos')
                    .select('*', { count: 'exact', head: true })
                    .eq('timeline_id', t.id),
                  supabase
                    .from('profiles')
                    .select('id, username, display_name, avatar_url')
                    .eq('id', t.created_by)
                    .single(),
                  supabase
                    .from('photos')
                    .select('thumbnail_path, storage_path')
                    .eq('timeline_id', t.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                ]);

              return {
                ...t,
                creator: creator || undefined,
                member_count: memberCount || 0,
                photo_count: photoCount || 0,
                cover_image_url: t.cover_image_url || latestPhoto?.thumbnail_path || latestPhoto?.storage_path || null,
              };
            })
          );

          if (mounted.current) {
            setTimelines(timelinesWithMeta);
          }
        }
      } catch (err) {
        console.error('Failed to fetch timelines:', err);
      } finally {
        if (mounted.current) {
          setFetching(false);
        }
      }
    };

    fetchTimelines();

    return () => {
      mounted.current = false;
    };
  }, [user, profile, loading, router]);

  if (loading || fetching) {
    return (
      <>
        <div className={styles.loadingContainer}>
          <div className="spinner spinner-lg" />
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="page-container">
        <div className={styles.header}>
          <div>
            <h1 className="page-title">Your Timelines</h1>
            <p className="page-subtitle">
              {timelines.length > 0
                ? `${timelines.length} timeline${timelines.length !== 1 ? 's' : ''}`
                : 'Create your first timeline'}
            </p>
          </div>
          <Link
            href="/timeline/new"
            className="btn btn-primary"
            id="create-timeline-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </Link>
        </div>

        {timelines.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📸</div>
            <h2 className="empty-state-title">No timelines yet</h2>
            <p className="empty-state-text">
              Create a timeline and start sharing photos with friends and family
            </p>
            <Link
              href="/timeline/new"
              className="btn btn-primary btn-lg"
              id="empty-create-btn"
            >
              Create Timeline
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {timelines.map((timeline, i) => (
              <Link
                key={timeline.id}
                href={`/timeline/${timeline.id}`}
                className={styles.timelineCard}
                id={`timeline-card-${i}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className={styles.cardCover}>
                  {timeline.cover_image_url ? (
                    <img
                      src={timeline.cover_image_url}
                      alt=""
                      className={styles.coverImage}
                    />
                  ) : (
                    <div className={styles.coverPlaceholder}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{timeline.name}</h3>
                  {timeline.description && (
                    <p className={styles.cardDesc}>{timeline.description}</p>
                  )}
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {timeline.photo_count}
                    </span>
                    <span className={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" />
                        <path d="M16 3.13a4 4 0 010 7.75" />
                      </svg>
                      {timeline.member_count}
                    </span>
                    <span className={styles.metaTime}>
                      {formatRelativeTime(timeline.updated_at)}
                    </span>
                  </div>
                </div>
                {timeline.creator && (
                  <div className={styles.cardCreator}>
                    <div className="avatar avatar-sm">
                      {timeline.creator.avatar_url ? (
                        <img
                          src={timeline.creator.avatar_url}
                          alt=""
                        />
                      ) : (
                        getInitials(timeline.creator.display_name)
                      )}
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}
