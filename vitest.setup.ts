import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Automatically cleanup DOM after each test to prevent memory leaks and state pollution
afterEach(() => {
  cleanup();
});
