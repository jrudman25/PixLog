'use client';

import { useState } from 'react';
import type { Photo } from '@/types';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/providers/ToastProvider';
import { formatDate, formatTime } from '@/lib/utils';
import CommentList from '@/components/comments/CommentList';
import styles from './PhotoLightbox.module.css';

interface PhotoLightboxProps {
  photo: Photo;
  onClose: () => void;
  onDelete: (_photoId: string) => void;
  canDelete: boolean;
}

export default function PhotoLightbox({
  photo,
  onClose,
  onDelete,
  canDelete,
}: PhotoLightboxProps) {
  const [editing, setEditing] = useState(false);
  const [takenAt, setTakenAt] = useState(
    new Date(photo.taken_at).toISOString().slice(0, 16)
  );
  const [locationName, setLocationName] = useState(
    photo.location_name || ''
  );
  const [caption, setCaption] = useState(photo.caption || '');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = createClient();

  const canEdit = photo.uploaded_by === user?.id;

  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('photos')
      .update({
        taken_at: new Date(takenAt).toISOString(),
        location_name: locationName.trim() || null,
        caption: caption.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', photo.id);

    if (error) {
      showToast('Failed to update', 'error');
    } else {
      showToast('Updated!', 'success');
      setEditing(false);
    }

    setSaving(false);
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className={styles.lightbox}>
        {/* Header */}
        <div className={styles.header}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={styles.headerActions}>
            {canEdit && (
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setEditing(!editing)}
                type="button"
                id="edit-photo-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canDelete && (
              showDeleteConfirm ? (
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Delete?</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowDeleteConfirm(false)} type="button">No</button>
                  <button className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }} onClick={() => onDelete(photo.id)} type="button">Yes</button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  type="button"
                  id="delete-photo-btn"
                  style={{ color: 'var(--danger)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>

        {/* Image */}
        <div className={styles.imageContainer}>
          <img
            src={photo.storage_path}
            alt={photo.caption || 'Photo'}
            className={styles.image}
          />
        </div>

        {/* Metadata */}
        <div className={styles.metaSection}>
          {editing ? (
            <div className={styles.editForm}>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-date">Date & Time</label>
                <input
                  id="edit-date"
                  type="datetime-local"
                  className="input"
                  value={takenAt}
                  onChange={(e) => setTakenAt(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-location">Location</label>
                <input
                  id="edit-location"
                  type="text"
                  className="input"
                  placeholder="e.g. Paris, France"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="edit-caption">Caption</label>
                <textarea
                  id="edit-caption"
                  className="input textarea"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditing(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  type="button"
                  style={{ flex: 1 }}
                >
                  {saving ? <span className="spinner" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.metaRow}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>
                  {formatDate(photo.taken_at)} at {formatTime(photo.taken_at)}
                </span>
              </div>
              {photo.location_name && (
                <div className={styles.metaRow}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{photo.location_name}</span>
                </div>
              )}
              {photo.caption && (
                <p className={styles.caption}>{photo.caption}</p>
              )}
              {photo.uploader && (
                <div className={styles.metaRow} style={{ color: 'var(--text-tertiary)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Uploaded by {photo.uploader.display_name}</span>
                </div>
              )}
            </>
          )}
        </div>

        <hr className="divider" />

        {/* Comments */}
        <div className={styles.commentsSection}>
          <CommentList photoId={photo.id} />
        </div>
      </div>
    </>
  );
}
