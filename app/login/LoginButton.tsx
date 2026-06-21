"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function LoginButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={() => {
        setLoading(true);
        signIn("reddit", { callbackUrl: "/feed" });
      }}
      disabled={loading}
      className="flex items-center gap-3 rounded-full bg-reddit px-7 py-3.5 text-base font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-70"
    >
      {loading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : (
        <RedditGlyph />
      )}
      Continue with Reddit
    </button>
  );
}

function RedditGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.01 11.06c.02.16.03.32.03.48 0 2.46-2.86 4.45-6.39 4.45-3.53 0-6.39-1.99-6.39-4.45 0-.16.01-.32.03-.48a1.31 1.31 0 1 1 1.44-2.12c1.18-.85 2.81-1.4 4.62-1.46l.79-3.71 2.58.55a.94.94 0 1 1-.13.6l-2.31-.49-.71 3.32c1.79.07 3.4.62 4.57 1.46a1.31 1.31 0 1 1 1.27 2.12zM9.25 12.5a.94.94 0 1 0 .01 1.88.94.94 0 0 0-.01-1.88zm5.5 0a.94.94 0 1 0 0 1.88.94.94 0 0 0 0-1.88zm-.39 2.96a.47.47 0 0 0-.66.02c-.43.43-1.32.47-1.71.47-.39 0-1.28-.04-1.71-.47a.47.47 0 1 0-.67.66c.68.68 1.78.73 2.38.73.6 0 1.7-.05 2.38-.73a.47.47 0 0 0-.02-.68z" />
    </svg>
  );
}
