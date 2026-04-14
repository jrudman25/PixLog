'use client';

import type { Photo } from '@/types';
import { formatDateShort, formatTime, getInitials } from '@/lib/utils';
import styles from './PhotoCard.module.css';

interface PhotoCardProps {
  photo: Photo;
  onClick: () => void;
  style?: React.CSSProperties;
}

export default function PhotoCard({ photo, onClick, style }: PhotoCardProps) {
  const imageUrl = photo.thumbnail_path || photo.storage_path;

  return (
    <button
      className={styles.card}
      onClick={onClick}
      style={style}
      id={`photo-${photo.id}`}
      type="button"
    >
      <div
        className={styles.imageContainer}
        style={{ aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : '4/3' }}
      >
        <img src={imageUrl} alt={photo.caption || 'Photo'} className={styles.image} loading="lazy" style={{ objectPosition: 'center top' }} />
        {!!(photo.comment_count && photo.comment_count > 0) && (
          <div className={styles.commentBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>{photo.comment_count}</span>
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.infoLeft}>
          {photo.uploader && (
            <div className="avatar avatar-sm">
              {photo.uploader.avatar_url ? (
                <img src={photo.uploader.avatar_url} alt="" />
              ) : (
                getInitials(photo.uploader.display_name)
              )}
            </div>
          )}
          <div>
            <span className={styles.date}>
              {formatDateShort(photo.taken_at)}
            </span>
            {photo.location_name && (
              <span className={styles.location}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {photo.location_name}
              </span>
            )}
          </div>
        </div>
        <span className={styles.time}>{formatTime(photo.taken_at)}</span>
      </div>
      {photo.caption && <p className={styles.caption}>{photo.caption}</p>}
    </button>
  );
}
