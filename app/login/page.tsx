import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginButton } from "./LoginButton";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/feed");

  return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-8 bg-gradient-to-b from-neutral-900 to-black px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-5xl font-extrabold tracking-tight text-white">
          reel<span className="text-reddit">ddit</span>
        </h1>
        <p className="max-w-sm text-balance text-white/60">
          A swipeable, vertical feed of Reddit media. Sign in to pull in the
          subreddits you already follow — or just start browsing.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <LoginButton />
        <Link
          href="/feed"
          className="text-sm font-medium text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          Browse as guest
        </Link>
      </div>

      <p className="max-w-xs text-xs text-white/30">
        Signing in only reads your subscriptions and public posts — we never post
        on your behalf. Guests browse public subreddits and can save their own
        list locally.
      </p>
    </main>
  );
}
