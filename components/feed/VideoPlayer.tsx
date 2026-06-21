"use client";

import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { useFeedStore } from "@/lib/stores/feed-store";
import type { FeedPost } from "@/lib/reddit/types";

/**
 * hls.js-backed video player.
 *
 * v.redd.it serves audio + video as separate DASH/HLS streams; hls.js consumes
 * Reddit's provided HLS manifest and stitches them. Native HLS (Safari) is used
 * when available. Playback is driven by the `active` prop (set by the feed's
 * IntersectionObserver) so only the visible card plays.
 */
export function VideoPlayer({
  post,
  active,
  onError,
}: {
  post: FeedPost;
  active: boolean;
  onError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const muted = useFeedStore((s) => s.muted);
  const toggleMuted = useFeedStore((s) => s.toggleMuted);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  // Attach / detach the HLS source based on `active` (virtualization).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !post.hlsUrl) return;

    if (!active) {
      // Unload to free memory + prevent audio bleed.
      video.pause();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
      return;
    }

    const onErr = () => onError?.();

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(post.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) onErr();
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = post.hlsUrl;
      video.addEventListener("error", onErr);
    } else if (post.fallbackUrl) {
      video.src = post.fallbackUrl;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener("error", onErr);
    };
  }, [active, post.hlsUrl, post.fallbackUrl, onError]);

  // Play / pause on active change.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active && !paused) {
      const p = video.play();
      if (p) p.catch(() => {/* autoplay blocked until interaction */});
    } else {
      video.pause();
    }
  }, [active, paused]);

  // Keep mute in sync with the global preference.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
  };

  // Tap = mute/unmute. Tap-and-hold = pause.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  const onPointerDown = () => {
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      setPaused(true);
    }, 250);
  };
  const onPointerUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (heldRef.current) {
      setPaused(false);
    } else {
      toggleMuted();
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {post.poster && (
        // Poster behind the video for blur-up before first frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.poster}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-contain blur-sm scale-105"
        />
      )}
      <video
        ref={videoRef}
        className="relative h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        poster={post.poster}
      />
      {/* Thin progress bar */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div
          className="h-full bg-white"
          style={{ width: `${progress}%` }}
        />
      </div>
      {paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/50 p-4 text-white">❚❚</div>
        </div>
      )}
    </div>
  );
}
