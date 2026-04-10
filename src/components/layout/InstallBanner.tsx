'use client';

import { useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import styles from './InstallBanner.module.css';

export default function InstallBanner() {
  const { isInstallable, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) {return null;}

  return (
    <div className={styles.banner} id="install-banner">
      <div className={styles.content}>
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="var(--accent)" />
          <path d="M8 12l8-5 8 5v10l-8 5-8-5V12z" stroke="white" strokeWidth="1.5" fill="none" />
          <circle cx="16" cy="16" r="3" fill="white" opacity="0.8" />
        </svg>
        <div>
          <p className={styles.title}>Install PixLog</p>
          <p className={styles.subtitle}>Add to your home screen for the best experience</p>
        </div>
      </div>
      <div className={styles.actions}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDismissed(true)}
          type="button"
        >
          Later
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={install}
          type="button"
          id="install-btn"
        >
          Install
        </button>
      </div>
    </div>
  );
}
