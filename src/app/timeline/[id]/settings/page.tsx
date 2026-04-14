'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import BottomNav from '@/components/layout/BottomNav';
import type { Timeline, TimelineMember, Profile } from '@/types';
import { getInitials } from '@/lib/utils';
import JSZip from 'jszip';
import styles from './settings.module.css';

export default function TimelineSettingsPage() {
  const params = useParams<{ id: string }>();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [members, setMembers] = useState<TimelineMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [origin, setOrigin] = useState('');
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabaseRef = useRef(createClient());

  const isCreator = timeline?.created_by === user?.id;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!params) {return;}
    const supabase = supabaseRef.current;

    const load = async () => {
      try {
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

        const { data: m } = await supabase
          .from('timeline_members')
          .select('*')
          .eq('timeline_id', params.id);

        if (m) {
          const memberUserIds = m.map((member) => member.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', memberUserIds);
          const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

          setMembers(
            m.map((member) => ({
              ...member,
              profile: profileMap.get(member.user_id) || undefined,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params, router]);

  const copyInviteLink = () => {
    if (!timeline) {return;}
    const link = `${origin}/invite/${timeline.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {return;}
    setSearching(true);

    const cleanSearch = searchQuery.replace('@', '').trim();
    const { data } = await supabaseRef.current
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${cleanSearch}%,display_name.ilike.%${cleanSearch}%`)
      .limit(10);

    if (data) {
      const memberIds = members.map((m) => m.user_id);
      setSearchResults(data.filter((p) => !memberIds.includes(p.id)));
    }

    setSearching(false);
  };

  const addMember = async (profileId: string) => {
    if (!params) {return;}
    const supabase = supabaseRef.current;

    const { error } = await supabase.from('timeline_members').insert({
      timeline_id: params.id,
      user_id: profileId,
      role: 'member',
    });

    if (error) {
      showToast('Failed to add member', 'error');
      return;
    }

    showToast('Member added!', 'success');
    setSearchResults((prev) => prev.filter((p) => p.id !== profileId));

    // Refresh members
    const { data: m } = await supabase
      .from('timeline_members')
      .select('*')
      .eq('timeline_id', params.id);

    if (m) {
      const memberUserIds = m.map((member) => member.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberUserIds);
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      setMembers(
        m.map((member) => ({
          ...member,
          profile: profileMap.get(member.user_id) || undefined,
        }))
      );
    }
  };

  const removeMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      showToast("Can't remove yourself", 'error');
      return;
    }

    const { error } = await supabaseRef.current
      .from('timeline_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      showToast('Failed to remove member', 'error');
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    showToast('Member removed', 'success');
  };

  const downloadTimelineZip = async () => {
    if (!params || !timeline) {return;}
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: 100 });

    try {
      const supabase = supabaseRef.current;
      const { data: photos } = await supabase
        .from('photos')
        .select('storage_path, original_filename')
        .eq('timeline_id', params.id);

      if (!photos || photos.length === 0) {
        showToast('No photos to download', 'info');
        setIsDownloading(false);
        setDownloadProgress(null);
        return;
      }

      setDownloadProgress({ current: 0, total: photos.length });

      const zip = new JSZip();
      let completed = 0;
      const usedNames = new Set<string>();

      const getUniqueName = (filename: string) => {
        let name = filename;
        let counter = 1;
        const parts = filename.split('.');
        const ext = parts.length > 1 ? `.${parts.pop()}` : '';
        const base = parts.join('.');
        while (usedNames.has(name)) {
          name = `${base}_${counter}${ext}`;
          counter++;
        }
        usedNames.add(name);
        return name;
      };

      const CONCURRENCY = 4;
      const downloadBatch = async (batch: typeof photos) => {
        const promises = batch.map(async (p) => {
          try {
            const res = await fetch(p.storage_path);
            if (!res.ok) {throw new Error(`Failed to fetch ${p.storage_path}`);}
            const blob = await res.blob();
            const safeName = getUniqueName(p.original_filename);
            zip.file(safeName, blob);
          } catch (e) {
            console.error(e);
          } finally {
            completed++;
            setDownloadProgress({ current: completed, total: photos.length });
          }
        });
        await Promise.all(promises);
      };

      for (let i = 0; i < photos.length; i += CONCURRENCY) {
        await downloadBatch(photos.slice(i, i + CONCURRENCY));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${timeline.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_photos.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('Download complete!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to download timeline';
      showToast(message, 'error');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const leaveTimeline = async () => {
    if (!params || !user) {return;}
    if (isCreator) {
      showToast('Creator cannot leave. Delete the timeline instead.', 'error');
      return;
    }

    if (!confirm('Leave this timeline?')) {return;}

    await supabaseRef.current
      .from('timeline_members')
      .delete()
      .eq('timeline_id', params.id)
      .eq('user_id', user.id);

    showToast('Left timeline', 'success');
    router.push('/');
  };

  const deleteTimeline = async () => {
    if (!params || !isCreator) {return;}
    if (!confirm('Delete this timeline? All photos and comments will be permanently removed.'))
      {return;}
    const supabase = supabaseRef.current;

    // Delete all photos from storage
    const { data: photos } = await supabase
      .from('photos')
      .select('storage_path, thumbnail_path')
      .eq('timeline_id', params.id);

    if (photos) {
      const paths = photos.flatMap((p) =>
        [p.storage_path, p.thumbnail_path].filter(Boolean)
      ).map((url) => {
        // storage_path stores full public URLs; extract relative bucket path
        const marker = '/object/public/photos/';
        const idx = (url as string).indexOf(marker);
        return idx !== -1 ? (url as string).slice(idx + marker.length) : url as string;
      });
      if (paths.length) {
        await supabase.storage.from('photos').remove(paths);
      }
    }

    // Delete timeline (cascades to members, photos, comments)
    await supabase.from('timelines').delete().eq('id', params.id);

    showToast('Timeline deleted', 'success');
    router.push('/');
  };

  if (loading) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60dvh' }}>
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
        <div className={styles.headerRow}>
          <button
            onClick={() => router.push(`/timeline/${params?.id}`)}
            className="btn btn-ghost btn-icon"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <h1 className="page-title">Settings</h1>
        </div>

        {/* Invite section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Invite Members</h2>

          <div className={styles.inviteLink}>
            <div className={styles.linkBox}>
              <code className={styles.code}>
                {origin}/invite/{timeline.invite_code}
              </code>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={copyInviteLink}
              type="button"
              id="copy-invite-btn"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="divider-text" style={{ margin: 'var(--space-4) 0' }}>
            or search by username
          </div>

          <div className={styles.searchRow}>
            <input
              type="text"
              className="input"
              placeholder="Search username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              id="member-search"
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSearch}
              disabled={searching}
              type="button"
            >
              {searching ? <span className="spinner" /> : 'Search'}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className={styles.searchResults}>
              {searchResults.map((profile) => (
                <div key={profile.id} className={styles.resultRow}>
                  <div className="avatar avatar-sm">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      getInitials(profile.display_name)
                    )}
                  </div>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>
                      {profile.display_name}
                    </span>
                    <span className={styles.resultUsername}>
                      @{profile.username}
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addMember(profile.id)}
                    type="button"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Members section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Members ({members.length})
          </h2>
          <div className={styles.membersList}>
            {members.map((member) => (
              <div key={member.id} className={styles.memberRow}>
                <div className="avatar avatar-md">
                  {member.profile?.avatar_url ? (
                    <img src={member.profile.avatar_url} alt="" />
                  ) : (
                    getInitials(member.profile?.display_name || '?')
                  )}
                </div>
                <div className={styles.memberInfo}>
                  <span className={styles.memberName}>
                    {member.profile?.display_name}
                    {member.user_id === user?.id && (
                      <span className={styles.youBadge}>you</span>
                    )}
                  </span>
                  <span className={styles.memberUsername}>
                    @{member.profile?.username}
                  </span>
                </div>
                {member.role === 'creator' ? (
                  <span className="badge badge-accent">Creator</span>
                ) : (
                  isCreator && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        removeMember(member.id, member.user_id)
                      }
                      type="button"
                      style={{ color: 'var(--danger)' }}
                    >
                      Remove
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </section>

      {/* Export section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Export</h2>
          <button
            className="btn btn-secondary btn-full"
            onClick={downloadTimelineZip}
            disabled={isDownloading}
            type="button"
          >
            {isDownloading && downloadProgress ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner spinner-sm" />
                <span>
                  Packing {downloadProgress.current} of {downloadProgress.total}...
                </span>
              </div>
            ) : (
              'Download All Photos (.zip)'
            )}
          </button>
        </section>

        {/* Danger zone */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle} style={{ color: 'var(--danger)' }}>
            Danger Zone
          </h2>
          {!isCreator ? (
            <button
              className="btn btn-danger btn-full"
              onClick={leaveTimeline}
              type="button"
              id="leave-timeline-btn"
            >
              Leave Timeline
            </button>
          ) : (
            <button
              className="btn btn-danger btn-full"
              onClick={deleteTimeline}
              type="button"
              id="delete-timeline-btn"
            >
              Delete Timeline
            </button>
          )}
        </section>
      </div>
      <BottomNav />
    </>
  );
}
