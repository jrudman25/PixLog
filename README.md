# PixLog

A collaborative, mobile-first photo timeline app. Create shared timelines, invite friends, and upload photos that are automatically sorted by date using EXIF metadata.

## Features

- **Shared Timelines** — Create timelines and invite others via link or username search
- **Smart Photo Upload** — EXIF metadata extraction (date, GPS), auto-thumbnails, reverse geocoding
- **Chronological Feed** — Infinite-scroll vertical feed grouped by date
- **Real-time Updates** — New photos and comments appear instantly via Supabase Realtime
- **Comments** — Comment on any photo with real-time sync
- **Metadata Editing** — Correct dates, locations, and captions after upload
- **Member Management** — Creator controls who can access the timeline
- **PWA** — Installable on mobile with home screen prompt
- **Dark Mode** — Minimal dark theme with accent colors

## Tech Stack

| Layer         | Technology                                        | Why                                                                            |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router)    | Server-first rendering, file-based routing, built-in image optimization        |
| **UI**        | [React 19](https://react.dev/) + TypeScript       | Concurrent features, type safety                                               |
| **Styling**   | Vanilla CSS (custom properties)                   | Full control, zero runtime overhead, no class-name collisions via CSS Modules  |
| **Database**  | [Supabase](https://supabase.com/) (Postgres)      | Row-Level Security, auto-generated REST API, real-time subscriptions           |
| **Auth**      | Supabase Auth                                     | Email/password + OAuth (Google, Apple), session management via `@supabase/ssr` |
| **Storage**   | Supabase Storage                                  | Direct upload from browser, public CDN URLs, bucket-level access policies      |
| **Real-time** | Supabase Realtime                                 | Postgres Change Data Capture over WebSocket, zero config                       |
| **EXIF**      | [exifr](https://github.com/nickel-fang/exifr)     | Lightweight client-side EXIF parser for date, GPS, dimensions                  |
| **Geocoding** | [OpenStreetMap Nominatim](https://nominatim.org/) | Free reverse geocoding — GPS coords to human-readable location                 |

## Architecture

### Client-Side Data Flow

```
User uploads photo
  → exifr extracts EXIF (date, GPS, dimensions)
  → Canvas API generates 600px WebP thumbnail
  → Nominatim reverse-geocodes GPS → location name
  → Supabase Storage receives original + thumbnail
  → Supabase Postgres receives photo record
  → Realtime broadcasts INSERT to all connected clients
  → Other users see the photo appear in their feed instantly
```

### Auth Flow

```
Login/Signup → Supabase Auth (email or OAuth)
  → Auth callback exchanges code for session
  → Proxy refreshes session on every request
  → Auth context provides user/profile to all client components
  → Protected routes redirect unauthenticated users
```

### Database Security

All tables use Postgres Row-Level Security (RLS). A `SECURITY DEFINER` helper function (`is_timeline_member`) breaks recursive policy loops on the `timeline_members` table. Key rules:

- **Photos**: Only timeline members can read or insert; only the uploader or timeline creator can delete
- **Comments**: Scoped through photos → timeline_members join; only the author can delete their own
- **Members**: Self-referencing SELECT uses the helper function to avoid infinite recursion

### Design System

The app uses a single `globals.css` file with CSS custom properties for theming:

- **Colors**: HSL-based palette with `--bg-*`, `--text-*`, `--accent`, `--danger`, `--success`
- **Spacing**: 4px-based scale (`--space-1` through `--space-8`)
- **Typography**: Inter via `next/font/google` (self-hosted, zero CLS)
- **Components**: Buttons (`.btn`), inputs (`.input`), modals (`.modal`), avatars (`.avatar`), toasts
- **Animations**: `fadeIn`, `slideUp`, `scaleIn` keyframes with `--transition-base` timing
- **Layout**: Mobile-first with `--max-width: 480px` content area, glassmorphism bottom nav

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── auth/               # Login, signup, OAuth callback
│   ├── profile/            # Profile view, username setup
│   ├── timeline/           # Feed, creation, settings
│   └── invite/             # Join via invite link
├── components/
│   ├── providers/          # Auth context, Toast notifications
│   ├── layout/             # BottomNav, PWA InstallBanner
│   ├── photo/              # PhotoUploader, PhotoLightbox
│   ├── timeline/           # PhotoCard
│   └── comments/           # CommentList (realtime)
├── hooks/                  # useInstallPrompt (PWA)
├── lib/
│   ├── supabase/           # Browser + server client singletons
│   ├── exif.ts             # EXIF extraction + Canvas thumbnails
│   ├── geocode.ts          # Rate-limited Nominatim reverse geocoding
│   └── utils.ts            # Date formatting, invite codes, initials
├── proxy.ts            # Session refresh + route protection
└── types/                  # Shared TypeScript interfaces
```

### Key Implementation Details

- **Supabase client singleton**: `createClient()` caches the browser client at module level and components access it via `useRef` to avoid re-render loops in `useEffect` dependency arrays
- **Infinite scroll**: `IntersectionObserver` on a sentinel div triggers cursor-based pagination (`taken_at < cursor`)
- **EXIF thumbnails**: Client-side Canvas API generates 600px WebP blobs before upload, avoiding server-side processing
- **Real-time**: Supabase `postgres_changes` channel subscriptions on `photos` and `comments` tables auto-update the UI
- **PWA install**: `useSyncExternalStore` reads `display-mode: standalone` media query without triggering cascading renders

