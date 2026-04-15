'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error natively to the console, or an external APM later
    console.error('Unhandled Application Exception Caught:', error);
  }, [error]);

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
      <div className="empty-state-icon" style={{ color: 'var(--danger)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="page-title" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Something went wrong!</h1>
      <p className="page-subtitle" style={{ maxWidth: '400px', margin: '0 auto 2rem auto', opacity: 0.8 }}>
        PixLog encountered an unexpected error while trying to process your request. Our systems have logged this issue.
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn btn-primary"
          onClick={() => reset()}
          id="error-reset-btn"
        >
          Try Again
        </button>
        <Link href="/" className="btn btn-secondary" id="error-home-btn">
          Return Home
        </Link>
      </div>
    </div>
  );
}
