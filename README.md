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

Next.js 14 (App Router) · Auth.js (custom Reddit provider) · TanStack Query ·
Zustand · Tailwind CSS · hls.js · lucide-react · Supabase _(optional, see below)_.

> **Supabase is currently on hold.** The app runs fully without it: Reddit
> tokens live in the encrypted Auth.js session cookie, and all user settings
> (sort, NSFW, mute, shuffle, resume position) live in the browser via
> `localStorage` / `sessionStorage`. The Supabase code is kept intact but stays
> dormant unless its env vars are provided. See
> [Re-enabling Supabase later](#re-enabling-supabase-later).

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

### 2. Configure environment

```bash
cp .env.example .env.local
# fill in AUTH_SECRET, AUTH_URL, REDDIT_CLIENT_ID/SECRET, REDDIT_USER_AGENT
```

Generate the secret:

```bash
openssl rand -base64 32   # AUTH_SECRET
```

Supabase env vars are intentionally left blank — see
[Re-enabling Supabase later](#re-enabling-supabase-later).

### 3. Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` |
| `AUTH_URL` | ✅ local · auto on Vercel | Base URL. On Vercel, Auth.js auto-detects it — only set for a custom domain. |
| `REDDIT_CLIENT_ID` | ✅ | From reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | ✅ | From reddit.com/prefs/apps |
| `REDDIT_USER_AGENT` | ✅ | e.g. `web:reelddit:0.1.0 (by /u/you)` |
| `TOKEN_ENCRYPTION_KEY` | ⛔ on hold | Only used when Supabase is enabled |
| `SUPABASE_URL` | ⛔ on hold | Leave unset to keep the DB dormant |
| `SUPABASE_SERVICE_ROLE_KEY` | ⛔ on hold | Leave unset to keep the DB dormant |

## Deploying to Vercel

1. Import the repo into Vercel (framework preset: **Next.js**, no special config).
2. Add the **required** env vars above in **Project → Settings → Environment
   Variables** (skip the Supabase ones). `AUTH_URL` can be omitted on the
   default `*.vercel.app` domain.
3. In your Reddit app (reddit.com/prefs/apps), set the redirect URI to your
   deployed callback, e.g.:
   ```
   https://<your-project>.vercel.app/api/auth/callback/reddit
   ```
   (add the `http://localhost:3000/...` one too if you also run locally).
4. Deploy. Visit the site → **Continue with Reddit**.

## Re-enabling Supabase later

When you're off the Supabase limit and want cross-device persistence:

1. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TOKEN_ENCRYPTION_KEY`
   (`openssl rand -base64 32`).
3. Redeploy. The dormant DB layer activates automatically — tokens get
   encrypted-at-rest in Postgres instead of living only in the session cookie.
   No code changes required.

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
