// Minimal typings for the slices of Reddit's API we actually consume.

export type SortOption = "hot" | "new" | "top" | "rising";
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";
export type FeedMode = "mixed" | "single";

/** A single image variant within a gallery / preview. */
export interface RedditImageSource {
  url: string;
  width: number;
  height: number;
}

/** Raw Reddit post ("t3") data — only fields we read are typed. */
export interface RedditPostData {
  id: string;
  name: string; // fullname, e.g. t3_abc
  title: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  permalink: string;
  url: string;
  domain: string;
  created_utc: number;
  ups: number;
  num_comments: number;
  over_18: boolean;
  stickied?: boolean;
  spoiler?: boolean;
  removed_by_category?: string | null;
  link_flair_text?: string | null;
  post_hint?: string;
  is_video?: boolean;
  is_gallery?: boolean;
  is_self?: boolean;
  thumbnail?: string;

  preview?: {
    images: {
      source: RedditImageSource;
      resolutions: RedditImageSource[];
    }[];
    reddit_video_preview?: { hls_url?: string; fallback_url?: string };
  };

  secure_media?: {
    reddit_video?: {
      hls_url?: string;
      fallback_url?: string;
      dash_url?: string;
      duration?: number;
      width?: number;
      height?: number;
    };
  } | null;

  media?: {
    reddit_video?: {
      hls_url?: string;
      fallback_url?: string;
    };
  } | null;

  gallery_data?: { items: { media_id: string; id: number }[] };
  media_metadata?: Record<
    string,
    {
      status: string;
      e: string; // "Image", "AnimatedImage", etc.
      m: string; // mime type
      s?: { u?: string; gif?: string; mp4?: string; x: number; y: number };
      p?: { u: string; x: number; y: number }[];
    }
  >;
}

export interface RedditListingChild {
  kind: string; // "t3"
  data: RedditPostData;
}

export interface RedditListing {
  kind: "Listing";
  data: {
    after: string | null;
    before: string | null;
    children: RedditListingChild[];
  };
}

export interface SubredditInfo {
  name: string; // "askreddit"
  displayName: string; // "AskReddit"
  prefixed: string; // "r/AskReddit"
  title: string;
  iconUrl: string | null;
  subscribers: number;
  over18: boolean;
}

// ---- Normalized media shapes the client renders ----

export type MediaKind = "video" | "image" | "gallery";

export interface GalleryImage {
  url: string;
  width: number;
  height: number;
}

/** A post that passed classification and is renderable in the feed. */
export interface FeedPost {
  id: string;
  fullname: string;
  title: string;
  author: string;
  subreddit: string;
  subredditPrefixed: string;
  permalink: string; // full reddit.com URL
  createdUtc: number;
  ups: number;
  numComments: number;
  over18: boolean;
  flair: string | null;

  kind: MediaKind;

  // image
  imageUrl?: string;
  // blur-up placeholder (low-res preview / thumbnail)
  placeholder?: string;
  width?: number;
  height?: number;

  // video
  hlsUrl?: string;
  fallbackUrl?: string;
  poster?: string;

  // gallery
  gallery?: GalleryImage[];
}

export interface FeedResponse {
  posts: FeedPost[];
  after: string | null;
}
