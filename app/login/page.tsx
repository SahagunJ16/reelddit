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
          Your joined subreddits as an endless, swipeable vertical feed. No
          uploads, no likes, no noise — just media.
        </p>
      </div>

      <LoginButton />

      <p className="max-w-xs text-xs text-white/30">
        We only read your subscriptions and public posts. We never post on your
        behalf. Logging out clears your session.
      </p>
    </main>
  );
}
