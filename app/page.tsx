import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Entry point. The feed works for everyone — guests included — so go there. */
export default function Home() {
  redirect("/feed");
}
