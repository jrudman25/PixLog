'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import PhotoUploader from '@/components/photo/PhotoUploader';
import PhotoCard from '@/components/timeline/PhotoCard';
import PhotoLightbox from '@/components/photo/PhotoLightbox';
import BottomNav from '@/components/layout/BottomNav';
import type { Photo, Timeline, TimelineMember } from '@/types';
import { getDateGroup } from '@/lib/utils';
import styles from './timeline.module.css';

const PAGE_SIZE = 20;

export default function TimelinePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const [params, setParams] = useState<{ id: string } | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [members, setMembers] = useState<TimelineMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isMember, setIsMember] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabaseRef = useRef(createClient());

  // Unwrap params promise
  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  const fetchPhotos = useCallback(
    async (timelineId: string, cursor?: string) => {
      const supabase = supabaseRef.current;
      let query = supabase
        .from('photos')
        .select('*')
        .eq('timeline_id', timelineId)
        .order('taken_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.lt('taken_at', cursor);
      }

      const { data } = await query;

      if (data) {
        // Fetch uploader profiles
        const uploaderIds = [...new Set(data.map((p) => p.uploaded_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', uploaderIds);

        const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

        return data.map((p) => ({
          ...p,
          uploader: profileMap.get(p.uploaded_by) || undefined,
        }));
      }

      return [];
    },
    []
  );

  useEffect(() => {
    if (!params || !user) {return;}
    const supabase = supabaseRef.current;

    const load = async () => {
      try {
        // Fetch timeline info
        const { data: t } = await supabase
          .from('timelines')
          .select('*')
          .eq('id', params.id)
          .single();

        if (!t) {
          router.push('/');
          return;
        }

        setTimeline(t);

        // Check membership
        const { data: membership } = await supabase
          .from('timeline_members')
          .select('*')
          .eq('timeline_id', params.id);

        if (membership) {
          // Fetch profiles for members
          const memberUserIds = membership.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', memberUserIds);
          const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

          setMembers(
            membership.map((m) => ({
              ...m,
              profile: profileMap.get(m.user_id) || undefined,
            }))
          );
          setIsMember(membership.some((m) => m.user_id === user.id));
        }

        // Fetch initial photos
        const initialPhotos = await fetchPhotos(params.id);
        setPhotos(initialPhotos);
        setHasMore(initialPhotos.length === PAGE_SIZE);
      } catch (err) {
        console.error('Failed to load timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params, user, router, fetchPhotos]);

  // Realtime subscription
  useEffect(() => {
    if (!params) {return;}
    const supabase = supabaseRef.current;

    const channel = supabase
      .channel(`timeline-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `timeline_id=eq.${params.id}`,
        },
        async (payload) => {
          // Fetch the full photo with uploader profile
          const { data } = await supabase
            .from('photos')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const { data: uploaderProfile } = await supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', data.uploaded_by)
              .single();

            const photo = { ...data, uploader: uploaderProfile || undefined };
            setPhotos((prev) => {
              if (prev.some((p) => p.id === photo.id)) {return prev;}
              const newPhotos = [photo, ...prev];
              newPhotos.sort(
                (a, b) =>
                  new Date(b.taken_at).getTime() -
                  new Date(a.taken_at).getTime()
              );
              return newPhotos;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'photos',
          filter: `timeline_id=eq.${params.id}`,
        },
        (payload) => {
          setPhotos((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params]);

  // Infinite scroll
  useEffect(() => {
    if (!observerRef.current || !hasMore || loadingMore) {return;}

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && params) {
          setLoadingMore(true);
          const lastPhoto = photos[photos.length - 1];
          if (lastPhoto) {
            const morePhotos = await fetchPhotos(
              params.id,
              lastPhoto.taken_at
            );
            setPhotos((prev) => [...prev, ...morePhotos]);
            setHasMore(morePhotos.length === PAGE_SIZE);
          }
          setLoadingMore(false);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [photos, hasMore, loadingMore, params, fetchPhotos]);

  const handlePhotoUploaded = () => {
    setShowUploader(false);
    showToast('Photo uploaded!', 'success');
  };

  const extractStoragePath = (url: string): string => {
    const marker = '/object/public/photos/';
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length) : url;
  };

  const handleDeletePhoto = async (photoId: string) => {
    const supabase = supabaseRef.current;
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) {return;}

    // Delete from storage (extract relative path from full public URL)
    const pathsToRemove = [photo.storage_path, photo.thumbnail_path]
      .filter(Boolean)
      .map((url) => extractStoragePath(url as string));

    if (pathsToRemove.length) {
      await supabase.storage.from('photos').remove(pathsToRemove);
    }

    // Delete from database
    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      showToast('Failed to delete photo', 'error');
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setSelectedPhoto(null);
    showToast('Photo deleted', 'success');
  };

  // Group photos by date
  const groupedPhotos: { date: string; photos: Photo[] }[] = [];
  let currentGroup = '';

  photos.forEach((photo) => {
    const group = getDateGroup(photo.taken_at);
    if (group !== currentGroup) {
      currentGroup = group;
      groupedPhotos.push({ date: group, photos: [photo] });
    } else {
      groupedPhotos[groupedPhotos.length - 1].photos.push(photo);
    }
  });

  if (loading) {
    return (
      <>
        <div className={styles.loadingContainer}>
          <div className="spinner spinner-lg" />
        </div>
        <BottomNav />
      </>
    );
  }

  if (!timeline) {return null;}

  return (
    <>
      <div className="page-container">
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              onClick={() => router.push('/')}
              className="btn btn-ghost btn-icon"
              id="back-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <div>
              <h1 className={styles.timelineTitle}>{timeline.name}</h1>
              <p className={styles.timelineMeta}>
                {members.length} member{members.length !== 1 ? 's' : ''} ·{' '}
                {photos.length} photo{photos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Link
            href={`/timeline/${params?.id}/settings`}
            className="btn btn-ghost btn-icon"
            id="settings-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </Link>
        </div>

        {/* Upload button */}
        {isMember && (
          <button
            className={styles.uploadBtn}
            onClick={() => setShowUploader(true)}
            id="upload-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload Photos
          </button>
        )}

        {/* Photo feed */}
        {photos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📷</div>
            <h2 className="empty-state-title">No photos yet</h2>
            <p className="empty-state-text">
              Upload your first photo to start building this timeline
            </p>
            {isMember && (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => setShowUploader(true)}
                id="empty-upload-btn"
              >
                Upload Photos
              </button>
            )}
          </div>
        ) : (
          <div className={styles.feed}>
            {groupedPhotos.map((group) => (
              <div key={group.date} className={styles.dateGroup}>
                <div className="date-separator">
                  <div className="date-separator-line" />
                  <span className="date-separator-text">{group.date}</span>
                  <div className="date-separator-line" />
                </div>
                <div className={styles.photoGrid}>
                  {group.photos.map((photo, i) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      onClick={() => setSelectedPhoto(photo)}
                      style={{ animationDelay: `${i * 30}ms` }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Infinite scroll trigger */}
            {hasMore && (
              <div ref={observerRef} className={styles.loadMore}>
                {loadingMore && <div className="spinner" />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUploader && params && (
        <PhotoUploader
          timelineId={params.id}
          onClose={() => setShowUploader(false)}
          onUploaded={handlePhotoUploaded}
        />
      )}

      {/* Photo lightbox */}
      {selectedPhoto && params && (
        <PhotoLightbox
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDeletePhoto}
          canDelete={
            selectedPhoto.uploaded_by === user?.id ||
            timeline?.created_by === user?.id
          }
        />
      )}

      <BottomNav />
    </>
  );
}
