# Reelddit

A scroll-based, **TikTok-style vertical feed** that turns the subreddits you've
already joined on Reddit into a continuous, swipeable photo/video experience.

No uploads, no likes, no comments, no separate registration — just **Reddit
OAuth login** and smooth, infinite, snap-scrolling media.

> Built per [`redditreelsappspec.md`](./redditreelsappspec.md).

---

## Features

- **Continue with Reddit** OAuth2 login (Auth.js) — your Reddit account _is_ your account.
- **Vertical snap-scroll feed**, one post per screen, dark immersive UI.
- **Mixed feed** across all joined subs (batched `/r/sub1+sub2+.../sort`) or a **single subreddit**.
- **Sort**: Hot / New / Top (hour…all) / Rising, with an optional **shuffle**.
- **hls.js video** playback for `v.redd.it` (handles Reddit's split audio/video streams), autoplay/pause via `IntersectionObserver`.
- **Galleries** with horizontal sub-swipe + dot pagination; **single images** via `next/image` with blur-up.
- **Virtualization** — only the active card ± 1 mount real players (no audio bleed / memory leaks).
- **Infinite pagination** + media **prefetch** via TanStack Query.
- Tap to **mute/unmute** (persisted), tap-and-hold to **pause**, progress bar.
- **Auto-skip** broken/deleted media, **NSFW toggle** (off by default), **subreddit search** autocomplete.
- **Pull-to-refresh**, **resume position** (sessionStorage), **PWA** manifest.
- Read-only overlay: subreddit, author, title, flair, age, upvotes, "Open in Reddit".

## Tech stack

Next.js 14 (App Router) · Auth.js (custom Reddit provider) · Supabase (encrypted
token storage) · TanStack Query · Zustand · Tailwind CSS · hls.js · lucide-react.

## Project structure

```
app/
  page.tsx                      redirect → /feed or /login
  login/                        "Continue with Reddit"
  feed/                         mixed vertical feed
  r/[subreddit]/                single-subreddit feed
  api/auth/[...nextauth]/       Auth.js handler
  api/reddit/feed|subreddits|search   server-side Reddit proxies (fetch + classify)
components/
  feed/      FeedContainer, PostCard, VideoPlayer, ImageView, GalleryView, PostOverlay, SortFilterBar, FeedView
  search/    SubredditSearch (autocomplete palette)
  layout/    TopNav
  ui/        Badge, Skeleton
lib/
  auth.ts                       Auth.js config + Reddit OAuth/refresh
  crypto.ts                     AES-256-GCM token encryption
  db.ts                         Supabase token store
  reddit/ client.ts, classify-media.ts, types.ts
  stores/feed-store.ts          Zustand (index, mute, sort/filter)
  hooks/use-feed.ts             TanStack infinite query
supabase/schema.sql             users + user_preferences tables
```

## Getting started

### 1. Create a Reddit OAuth app

Go to <https://www.reddit.com/prefs/apps> → **create app** → type **web app**.
Set the redirect URI to:

```
http://localhost:3000/api/auth/callback/reddit
```

Note the **client id** (under the app name) and **secret**.

### 2. (Optional) Create a Supabase project

Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor. Grab the
project URL and the **service role** key. _Without Supabase the app still works_
— tokens then live only in the encrypted Auth.js session cookie.

### 3. Configure environment

```bash
cp .env.example .env.local
# fill in AUTH_SECRET, REDDIT_CLIENT_ID/SECRET, REDDIT_USER_AGENT,
# TOKEN_ENCRYPTION_KEY, and (optionally) SUPABASE_URL/SERVICE_ROLE_KEY
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
```

### 4. Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How the feed works

1. `FeedContainer` runs a TanStack `useInfiniteQuery` against `/api/reddit/feed`.
2. The route resolves the user's Reddit token (refreshing if <5 min from expiry),
   calls Reddit's batched multi-subreddit endpoint, runs every post through
   `classify-media.ts`, and returns **only displayable** image/gallery/video posts.
3. Cards snap-scroll; an `IntersectionObserver` tracks the active index.
4. Nearing the end of the batch triggers `fetchNextPage` a few cards early.
5. Only the active card ± 1 mount a real `VideoPlayer`/hls.js instance.

## Security notes

- Reddit tokens are **encrypted at rest** (AES-256-GCM) before hitting Postgres.
- Tokens are only ever read server-side (route handlers / Auth.js callbacks);
  they are never sent to the browser.
- Supabase tables have RLS enabled with deny-by-default policies; only the
  service role (server) touches them.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
