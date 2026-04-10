export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Timeline {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineMember {
  id: string;
  timeline_id: string;
  user_id: string;
  role: 'creator' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface Photo {
  id: string;
  timeline_id: string;
  uploaded_by: string;
  storage_path: string;
  thumbnail_path: string | null;
  original_filename: string;
  taken_at: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  width: number;
  height: number;
  caption: string | null;
  created_at: string;
  updated_at: string;
  uploader?: Profile;
  comment_count?: number;
}

export interface Comment {
  id: string;
  photo_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface TimelineWithMeta extends Timeline {
  member_count?: number;
  photo_count?: number;
  creator?: Profile;
}
