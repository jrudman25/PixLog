import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PhotoLightbox from '../PhotoLightbox';

// Mock dependencies
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'test-user-123' } })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock('@/components/providers/ToastProvider', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}));

// Provide a fake CommentList so it doesn't crash from missing Supabase contexts
vi.mock('@/components/comments/CommentList', () => ({
  default: () => <div data-testid="mock-comment-list" />,
}));

describe('PhotoLightbox', () => {
  const mockPhoto = {
    id: 'photo-1',
    timeline_id: 'timeline-1',
    uploaded_by: 'test-user-123',
    storage_path: 'https://example.com/photo.jpg',
    thumbnail_path: null,
    original_filename: 'test.jpg',
    taken_at: '2023-01-01T12:00:00.000Z',
    latitude: null,
    longitude: null,
    location_name: 'Test Location',
    width: 800,
    height: 600,
    caption: 'A test caption',
    created_at: '2023-01-01T12:00:00.000Z',
    updated_at: '2023-01-01T12:00:00.000Z',
  };

  it('renders gracefully out of the box', () => {
    const handleClose = vi.fn();
    const handleDelete = vi.fn();

    render(
      <PhotoLightbox
        photo={mockPhoto}
        onClose={handleClose}
        onDelete={handleDelete}
        canDelete={true}
      />
    );

    expect(screen.getByAltText('A test caption')).toBeDefined();
    expect(screen.getByText('A test caption')).toBeDefined();
    expect(screen.getByText('Test Location')).toBeDefined();
    expect(screen.getByTestId('mock-comment-list')).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    const handleClose = vi.fn();
    const handleDelete = vi.fn();

    render(
      <PhotoLightbox
        photo={mockPhoto}
        onClose={handleClose}
        onDelete={handleDelete}
        canDelete={true}
      />
    );

    // Grab the first ghost button (usually the close button at the top left)
    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it('prompts confirmation when delete is initially clicked', () => {
    const handleClose = vi.fn();
    const handleDelete = vi.fn();

    render(
      <PhotoLightbox
        photo={mockPhoto}
        onClose={handleClose}
        onDelete={handleDelete}
        canDelete={true}
      />
    );

    const specificDeleteBtn = document.querySelector('#delete-photo-btn');
    if (specificDeleteBtn) {
      fireEvent.click(specificDeleteBtn);
    }
    
    // Check if the confirmation banner appeared instead of firing delete instantly
    expect(screen.getByText('Delete?')).toBeDefined();
    expect(handleDelete).not.toHaveBeenCalled();
  });
});
