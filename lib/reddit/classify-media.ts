import { decodeHtml } from "@/lib/utils";
import type {
  FeedPost,
  GalleryImage,
  RedditImageSource,
  RedditPostData,
} from "./types";

/**
 * Run a raw Reddit post through the media classifier.
 *
 * Returns a normalized `FeedPost` if the post contains displayable media
 * (image / gallery / native video), or `null` if it should be skipped
 * (text post, removed/deleted, or an unsupported external host).
 */
export function classifyPost(p: RedditPostData): FeedPost | null {
  // Hard skips: removed/deleted or pure self/text posts.
  if (p.removed_by_category) return null;
  if (p.is_self) return null;

  const base = {
    id: p.id,
    fullname: p.name,
    title: decodeHtml(p.title ?? ""),
    author: p.author,
    subreddit: p.subreddit,
    subredditPrefixed: p.subreddit_name_prefixed ?? `r/${p.subreddit}`,
    permalink: `https://www.reddit.com${p.permalink}`,
    createdUtc: p.created_utc,
    ups: p.ups ?? 0,
    numComments: p.num_comments ?? 0,
    over18: !!p.over_18,
    flair: p.link_flair_text || null,
  };

  // --- Native Reddit video (v.redd.it) ---
  const rv = p.secure_media?.reddit_video ?? p.media?.reddit_video;
  if (p.is_video && rv?.hls_url) {
    return {
      ...base,
      kind: "video",
      hlsUrl: decodeHtml(rv.hls_url),
      fallbackUrl: rv.fallback_url ? decodeHtml(rv.fallback_url) : undefined,
      poster: bestPreview(p),
    };
  }

  // GIF-style video previews served as HLS (e.g. some imgur/gfycat links).
  const rvp = p.preview?.reddit_video_preview;
  if (rvp?.hls_url) {
    return {
      ...base,
      kind: "video",
      hlsUrl: decodeHtml(rvp.hls_url),
      fallbackUrl: rvp.fallback_url ? decodeHtml(rvp.fallback_url) : undefined,
      poster: bestPreview(p),
    };
  }

  // --- Gallery ---
  if (p.is_gallery && p.gallery_data && p.media_metadata) {
    const images: GalleryImage[] = [];
    for (const item of p.gallery_data.items) {
      const meta = p.media_metadata[item.media_id];
      if (!meta || meta.status !== "valid") continue;
      // Prefer an mp4 (animated) then the source image url.
      const u = meta.s?.mp4 || meta.s?.gif || meta.s?.u;
      if (!u) continue;
      images.push({
        url: decodeHtml(u),
        width: meta.s?.x ?? 0,
        height: meta.s?.y ?? 0,
      });
    }
    if (images.length === 0) return null;
    return {
      ...base,
      kind: "gallery",
      gallery: images,
      placeholder: bestPreview(p, true),
    };
  }

  // --- Single image (native or resolvable external) ---
  const img = resolveImage(p);
  if (img) {
    return {
      ...base,
      kind: "image",
      imageUrl: img.url,
      width: img.width,
      height: img.height,
      placeholder: bestPreview(p, true),
    };
  }

  // Unsupported / unresolvable (text, link, redgifs embed without direct url…).
  return null;
}

/** Resolve a direct, displayable image URL for a post (or null). */
function resolveImage(p: RedditPostData): RedditImageSource | null {
  // Reddit-native image.
  if (p.post_hint === "image" && p.url) {
    const source = p.preview?.images?.[0]?.source;
    return {
      url: decodeHtml(p.url),
      width: source?.width ?? 0,
      height: source?.height ?? 0,
    };
  }

  // Direct image URL by extension (covers i.redd.it, i.imgur.com, etc.).
  if (/\.(jpe?g|png|webp|gif)$/i.test(p.url ?? "")) {
    const source = p.preview?.images?.[0]?.source;
    return {
      url: decodeHtml(p.url),
      width: source?.width ?? 0,
      height: source?.height ?? 0,
    };
  }

  // Fall back to Reddit's own preview render if present.
  const source = p.preview?.images?.[0]?.source;
  if (source?.url) {
    return { url: decodeHtml(source.url), width: source.width, height: source.height };
  }

  return null;
}

/** Pick a low/medium-res preview URL for blur-up / poster usage. */
function bestPreview(p: RedditPostData, lowRes = false): string | undefined {
  const resolutions = p.preview?.images?.[0]?.resolutions;
  if (resolutions && resolutions.length > 0) {
    const pick = lowRes
      ? resolutions[0]
      : resolutions[Math.min(resolutions.length - 1, 3)];
    return decodeHtml(pick.url);
  }
  if (p.thumbnail && /^https?:\/\//.test(p.thumbnail)) {
    return p.thumbnail;
  }
  return undefined;
}

/** Classify a whole listing, dropping non-displayable posts. */
export function classifyListing(
  children: { data: RedditPostData }[],
  opts: { nsfw: boolean }
): FeedPost[] {
  const out: FeedPost[] = [];
  const seen = new Set<string>();
  for (const child of children) {
    const data = child.data;
    if (!opts.nsfw && data.over_18) continue;
    const post = classifyPost(data);
    if (post && !seen.has(post.id)) {
      seen.add(post.id);
      out.push(post);
    }
  }
  return out;
}
