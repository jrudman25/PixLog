'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { extractExif, generateThumbnail } from '@/lib/exif';
import { reverseGeocode } from '@/lib/geocode';
import styles from './PhotoUploader.module.css';

interface PhotoUploaderProps {
  timelineId: string;
  onClose: () => void;
  onUploaded: () => void;
}

interface UploadItem {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export default function PhotoUploader({
  timelineId,
  onClose,
  onUploaded,
}: PhotoUploaderProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const supabase = createClient();

  const handleFiles = (files: FileList) => {
    const newItems: UploadItem[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
        progress: 0,
      }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadAll = async () => {
    if (!user || items.length === 0) {return;}
    setUploading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'done') {continue;}

      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, status: 'uploading', progress: 10 } : it
        )
      );

      try {
        // Extract EXIF
        const exif = await extractExif(item.file);

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, progress: 30 } : it
          )
        );

        // Generate thumbnail
        let thumbnailBlob: Blob | null = null;
        try {
          thumbnailBlob = await generateThumbnail(item.file);
        } catch {
          // Continue without thumbnail
        }

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, progress: 50 } : it
          )
        );

        // Reverse geocode if GPS data available
        let locationName: string | null = null;
        if (exif.latitude && exif.longitude) {
          const geo = await reverseGeocode(exif.latitude, exif.longitude);
          if (geo) {locationName = geo.locationName;}
        }

        // Upload original
        const photoId = crypto.randomUUID();
        const ext = item.file.name.split('.').pop() || 'jpg';
        const storagePath = `${timelineId}/${photoId}/original.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(storagePath, item.file, {
            contentType: item.file.type,
          });

        if (uploadError) {throw uploadError;}

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, progress: 75 } : it
          )
        );

        // Upload thumbnail
        let thumbnailPath: string | null = null;
        if (thumbnailBlob) {
          thumbnailPath = `${timelineId}/${photoId}/thumb.webp`;
          await supabase.storage
            .from('photos')
            .upload(thumbnailPath, thumbnailBlob, {
              contentType: 'image/webp',
            });
        }

        // Get public URLs
        const { data: publicUrl } = supabase.storage
          .from('photos')
          .getPublicUrl(storagePath);

        const thumbUrl = thumbnailPath
          ? supabase.storage.from('photos').getPublicUrl(thumbnailPath).data
              .publicUrl
          : null;

        // Insert photo record
        const { error: insertError } = await supabase.from('photos').insert({
          id: photoId,
          timeline_id: timelineId,
          uploaded_by: user.id,
          storage_path: publicUrl.publicUrl,
          thumbnail_path: thumbUrl,
          original_filename: item.file.name,
          taken_at: exif.takenAt?.toISOString() || new Date().toISOString(),
          latitude: exif.latitude,
          longitude: exif.longitude,
          location_name: locationName,
          width: exif.width || 0,
          height: exif.height || 0,
        });

        if (insertError) {throw insertError;}

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'done', progress: 100 } : it
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed';
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: 'error', error: errorMessage }
              : it
          )
        );
      }
    }

    setUploading(false);

    // Check completion using functional setState to read latest state
    setItems((current) => {
      const allDone = current.every(
        (it) => it.status === 'done' || it.status === 'error'
      );
      if (allDone) {
        setTimeout(() => {
          onUploaded();
        }, 500);
      }
      return current;
    });
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-header">
          <h2 className="modal-title">Upload Photos</h2>
        </div>
        <div className="modal-body">
          {/* Drop zone / file picker */}
          <div
            className={styles.dropZone}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add(styles.dragOver);
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove(styles.dragOver);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove(styles.dragOver);
              if (e.dataTransfer.files) {handleFiles(e.dataTransfer.files);}
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className={styles.dropText}>
              Tap to select or drag photos here
            </p>
            <p className={styles.dropHint}>
              JPEG, PNG, WebP • EXIF data will be extracted automatically
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) {handleFiles(e.target.files);}
              }}
              className="sr-only"
              id="photo-file-input"
            />
          </div>

          {/* Preview grid */}
          {items.length > 0 && (
            <div className={styles.previewGrid}>
              {items.map((item, i) => (
                <div key={i} className={styles.previewItem}>
                  <img
                    src={item.preview}
                    alt=""
                    className={styles.previewImage}
                  />
                  {item.status === 'uploading' && (
                    <div className={styles.progressOverlay}>
                      <div
                        className={styles.progressBar}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.status === 'done' && (
                    <div className={styles.statusOverlay}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  {item.status === 'error' && (
                    <div className={`${styles.statusOverlay} ${styles.errorOverlay}`}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  )}
                  {item.status === 'pending' && (
                    <button
                      className={styles.removeBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(i);
                      }}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={uploading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={uploadAll}
            disabled={uploading || items.length === 0 || items.every((i) => i.status === 'done')}
            type="button"
            id="upload-submit"
            style={{ flex: 1 }}
          >
            {uploading ? (
              <>
                <span className="spinner" /> Uploading...
              </>
            ) : (
              `Upload ${items.filter((i) => i.status === 'pending').length} photo${items.filter((i) => i.status === 'pending').length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </>
  );
}
