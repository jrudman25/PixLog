'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import BottomNav from '@/components/layout/BottomNav';
import { getInitials } from '@/lib/utils';
import pkg from '../../../package.json';
import styles from './profile.module.css';

export default function ProfilePage() {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      window.location.href = '/auth/login';
    }
  }, [loading, user, profile]);

  if (loading || !user || !profile) {
    return (
      <>
        <div className={styles.loadingContainer}>
          <div className="spinner spinner-lg" />
        </div>
        <BottomNav />
      </>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/login');
  };

  return (
    <>
      <div className="page-container">
        <div className={styles.header}>
          <div className={styles.avatarLarge}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              getInitials(profile.display_name)
            )}
          </div>
          <h1 className={styles.displayName}>{profile.display_name}</h1>
          <p className={styles.username}>@{profile.username}</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>{user.email}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Joined</span>
            <span className={styles.infoValue}>
              {new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>App Version</span>
            <span className={styles.infoValue}>v{pkg.version}</span>
          </div>
        </div>

        <button
          className="btn btn-danger btn-full"
          onClick={handleSignOut}
          type="button"
          id="signout-btn"
        >
          Sign Out
        </button>
      </div>
      <BottomNav />
    </>
  );
}
