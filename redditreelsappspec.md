# Reddit Reels — Full Project Specification

A scroll-based, TikTok-style vertical feed app that turns a logged-in user's joined subreddits into a continuous photo/video browsing experience. No uploads, no likes, no comments, no registration — just Reddit OAuth login and smooth, infinite, swipeable media.

---

## 1. Core Concept

- User logs in by linking their Reddit account (OAuth) — that login *is* their account. No separate registration/database of app-specific users beyond storing tokens.
- The app pulls posts from the subreddits the user is already subscribed to on Reddit (or a single subreddit they search into).
- Only posts containing **images, galleries, or videos** are shown — text posts and link posts are filtered out.
- Feed is a full-viewport, vertical snap-scroll experience, exactly like TikTok's For You page, but the "for you" ranking is just Reddit's own sort (Hot/New/Top/Rising) across the user's joined subs.
- No social features: no likes, no comments, no sharing, no follows. Just title, subreddit, author, post age, and upvote count (read-only) overlaid on the media.

---

## 2. Feature List

### Authentication
- "Continue with Reddit" — OAuth2 flow, no email/password, no separate signup.
- Store access token + refresh token (encrypted) tied to the Reddit user ID.
- Silent token refresh before the 1-hour expiry.
- Logout simply clears the session/cookie.

### Feed Experience
- Vertical snap-scroll, one post per screen (CSS scroll-snap or a virtualized list).
- Autoplay video when a card is in view; pause/unload when scrolled away (IntersectionObserver).
- Tap to mute/unmute, with the preference persisted (localStorage).
- Tap-and-hold to pause playback.
- Thin progress bar at the bottom of video cards.
- Overlay UI: subreddit icon + name, post author, title (expandable if long), flair badge, post age (e.g. "3h ago"), read-only upvote count.
- Small "Open in Reddit" icon/link for users who want to engage natively on Reddit.
- Gallery posts: horizontal sub-swipe within the card, with dot pagination indicator.
- Auto-skip posts whose media fails to load (deleted, private, unsupported domain).
- Blur-up placeholder using Reddit's provided thumbnail while full media loads.
- Pull-to-refresh at the top of the feed to fetch newest batch.
- "Resume where you left off" using session storage (last post index/id) — no DB persistence needed.

### Discovery & Filtering
- Feed mode toggle: **Mixed** (interleaved across all joined subs) vs **Single subreddit**.
- Sort options: Hot / New / Top (with time range: day/week/month/year/all) / Rising.
- Subreddit search with autocomplete (Reddit's subreddit search/autocomplete endpoint) — tap a result to jump into that subreddit's feed.
- NSFW toggle, off by default, respecting Reddit's own `over_18` flag.
- Optional shuffle: re-randomize interleaving order of the mixed feed on each refresh.

### Performance / "Smoothness"
- Prefetch the next 2–3 posts' media before they scroll into view.
- Virtualize the feed: only mount/hydrate active video players for the current card ± 1; everything else stays as a lightweight placeholder.
- Infinite pagination using Reddit's `after` cursor via TanStack Query's infinite query.
- Batch-fetch multiple subreddits in one API call using Reddit's multi-subreddit path syntax (`/r/sub1+sub2+sub3/hot`).

### Nice-to-Haves (Phase 2+)
- Double-tap empty screen area to skip to next post.
- Picture-in-picture-style mini player when viewing post details.
- Haptic feedback on scroll snap (mobile web Vibration API).
- PWA install prompt + manifest so it can be added to home screen and feel native.
- Skeleton loaders styled to match each subreddit's accent color (from Reddit's community styling API, if available).

---

## 3. Explicitly Out of Scope

- No video/photo uploading.
- No likes, comments, shares, or saves.
- No following/followers within the app (subscriptions are managed on Reddit itself).
- No live streaming, shop, or duets/stitches.
- No wide-scope search (no user search, no post-content search — subreddit name search only).
- No notifications.

---

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR for initial feed load, route handlers for API proxy |
| Auth | Auth.js (NextAuth) with custom Reddit OAuth provider | Handles OAuth flow, token refresh callbacks, session cookies |
| Database | Supabase (Postgres only — not Supabase Auth) | Minimal: just stores encrypted Reddit tokens per user |
| Data fetching/caching | TanStack Query | Infinite scroll pagination, prefetching, cache management |
| Client state | Zustand | Current card index, mute state, active sort/subreddit filter |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Components | shadcn/ui | Command palette for subreddit search, Tabs/ToggleGroup for sort filters, Sheet/Dialog for details |
| Video playback | hls.js | Required because v.redd.it serves video and audio as separate DASH streams; hls.js consumes Reddit's provided HLS manifest URL |
| Image handling | next/image | Optimization, blur placeholders |

---

## 5. Database Schema (Supabase/Postgres)

Kept intentionally minimal — since there are no likes/comments/follows to persist, the only thing that needs a database is auth.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  reddit_id text unique not null,
  username text not null,
  avatar_url text,
  access_token text not null,   -- encrypted at rest
  refresh_token text not null,  -- encrypted at rest
  token_expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Optional: lightweight preferences table if you want to persist
-- sort/NSFW settings across devices instead of localStorage only
create table user_preferences (
  user_id uuid references users(id) on delete cascade primary key,
  default_sort text default 'hot',       -- hot | new | top | rising
  top_time_range text default 'day',     -- hour|day|week|month|year|all
  nsfw_enabled boolean default false,
  updated_at timestamptz default now()
);
```

No `posts`, `media`, or `subreddits` tables — feed data is fetched live from Reddit's API on every request and never mirrored. This avoids staleness issues and keeps the app's own data footprint tiny.

---

## 6. Reddit API Integration

### OAuth Flow
1. User clicks "Continue with Reddit" → redirected to Reddit's OAuth authorize endpoint with scopes: `identity`, `read`, `mysubreddits`.
2. Reddit redirects back with an authorization code → exchanged server-side for access + refresh tokens.
3. Tokens encrypted and stored in `users` table, keyed by `reddit_id`.
4. Auth.js session cookie issued; subsequent requests use the session to look up the user's Reddit tokens server-side (tokens never exposed to the client).

### Key Endpoints Used
- `GET /api/v1/me` — fetch logged-in user's profile (username, avatar) after login.
- `GET /subreddits/mine/subscriber` — list of subreddits the user has joined (paginated).
- `GET /r/{sub1}+{sub2}+.../hot|new|top|rising` — batched multi-subreddit feed fetch, paginated via `after` cursor.
- `GET /r/{subreddit}/hot|new|top|rising` — single-subreddit browsing.
- `GET /api/subreddit_autocomplete` (or `/subreddits/search`) — subreddit name search for the search feature.
- Token refresh via the standard OAuth2 refresh_token grant against Reddit's access_token endpoint.

### Rate Limits
- ~100 requests/minute **per user access token** (not a global app limit), so per-user usage is comfortable as long as requests are batched (multi-subreddit path) rather than fired per-subreddit.

### Media Classification Logic
Every fetched post needs to be run through a classifier before being added to the feed:

- **Skip** if: no media (`post_hint` absent and not a gallery/video), removed/deleted, or domain isn't a supported media host.
- **Video (native Reddit)**: `is_video: true` → use `secure_media.reddit_video.hls_url` with hls.js (handles the separate audio/video DASH streams Reddit serves).
- **Gallery**: `is_gallery: true` → iterate `media_metadata` for ordered image URLs, render as horizontal sub-swipe.
- **Single image**: `post_hint: "image"` → direct image URL, rendered via `next/image`.
- **External media (imgur, redgifs, gfycat, etc.)**: handle per-domain; some can be embedded directly, others may need to be skipped if no direct media URL is resolvable without scraping.
- Posts that fail classification are silently skipped during feed assembly (not shown as broken cards).

---

## 7. App Architecture

### Route Structure (App Router)
```
app/
  layout.tsx                 — root layout, providers (QueryClient, Zustand, Auth)
  page.tsx                   — redirects to /feed or /login based on session
  login/
    page.tsx                 — "Continue with Reddit" screen
  feed/
    page.tsx                 — main vertical feed (mixed mode default)
  r/[subreddit]/
    page.tsx                 — single-subreddit feed
  api/
    auth/[...nextauth]/route.ts   — Auth.js handler
    reddit/
      feed/route.ts          — server-side proxy: fetch + classify posts, paginated
      subreddits/route.ts    — server-side proxy: user's joined subreddits
      search/route.ts        — server-side proxy: subreddit autocomplete
```

### Key Components
```
components/
  feed/
    FeedContainer.tsx        — virtualized scroll-snap list, manages active index
    PostCard.tsx             — single post: routes to VideoPlayer / ImageView / GalleryView
    VideoPlayer.tsx          — hls.js-backed player, autoplay/pause via IntersectionObserver
    GalleryView.tsx          — horizontal swipe + dot indicator
    PostOverlay.tsx          — title/author/subreddit/age/upvotes UI layer
    SortFilterBar.tsx        — Hot/New/Top/Rising + time range, shadcn Tabs/ToggleGroup
  search/
    SubredditSearch.tsx      — shadcn Command palette, autocomplete
  layout/
    TopNav.tsx                — search trigger, mode toggle, NSFW toggle
lib/
  reddit/
    client.ts                — authenticated fetch wrapper with token refresh
    classify-media.ts        — post → media type classifier
    types.ts                 — Reddit API response types
  stores/
    feed-store.ts             — Zustand: active index, mute state, sort/filter state
```

### Data Flow for the Feed
1. `FeedContainer` uses TanStack Query's `useInfiniteQuery` hitting `/api/reddit/feed`.
2. The route handler looks up the user's tokens (refreshing if near expiry), calls Reddit's batched multi-subreddit endpoint with the current sort/`after` cursor, runs results through `classify-media.ts`, and returns only displayable posts.
3. `FeedContainer` renders `PostCard`s in a scroll-snap container; an `IntersectionObserver` (or scroll position calc) tracks which card is active.
4. When the active index nears the end of the loaded batch, the next page is prefetched automatically (TanStack Query's `fetchNextPage` triggered a few cards early).
5. Only the active card ± 1 mount a real `VideoPlayer`/hls.js instance; others render a static thumbnail to keep memory/CPU low.

---

## 8. Design System Notes

- **Layout**: full-bleed, full-viewport cards (`h-screen w-screen`), dark theme by default (matches TikTok/Instagram Reels convention and makes media pop).
- **Typography**: bold, high-contrast white text with a subtle bottom gradient scrim behind the overlay text for legibility over any media.
- **Motion**: scroll-snap (`scroll-snap-type: y mandatory` on container, `scroll-snap-align: start` on cards) for native-feeling momentum; avoid heavy JS-driven scroll hijacking if CSS snap suffices.
- **Iconography**: lucide-react (ships with shadcn), minimal icon set — mute/unmute, external-link, search, filter.
- **shadcn components to use**: `Command` (search), `Tabs`/`ToggleGroup` (sort filters), `Sheet` (filter/settings drawer), `Avatar` (subreddit/author icons), `Skeleton` (loading states), `Badge` (flair/NSFW tags).

---

## 9. Build Phases

**Phase 1 — Foundation**
- Next.js + Tailwind + shadcn scaffold
- Reddit OAuth via Auth.js, Supabase token storage
- Basic feed fetch (single sort, no filters) rendering images only

**Phase 2 — Video & Smoothness**
- hls.js video playback for `v.redd.it` posts
- IntersectionObserver-driven autoplay/pause
- Virtualization (mount only active ± 1 cards)
- Prefetching next page/media

**Phase 3 — Discovery**
- Sort filter bar (Hot/New/Top/Rising + time range)
- Subreddit search + single-subreddit browsing route
- Mixed vs single mode toggle, NSFW toggle

**Phase 4 — Polish**
- Gallery sub-swipe support
- Pull-to-refresh, resume-position on return
- PWA manifest, haptics, blur-up placeholders
- Edge case handling (deleted posts, unsupported domains, rate-limit backoff)

---

## 10. Known Technical Risks (validate early)

1. **v.redd.it audio/video are separate streams** — confirm hls.js correctly stitches Reddit's `hls_url` manifest before building the rest of the player UI around it.
2. **Per-domain media resolution** (imgur/redgifs/gfycat) — these aren't native Reddit-hosted media and may need separate handling or may need to be excluded if they can't be reliably resolved to a direct media URL.
3. **Token refresh timing** — must refresh proactively (e.g., when `token_expires_at` is within 5 minutes) to avoid mid-scroll 401s.
4. **Virtualization correctness** — improperly unmounting video players can cause memory leaks or audio bleed (two videos playing at once) if the IntersectionObserver logic isn't tight.
