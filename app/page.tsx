import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Entry point: send to the feed if signed in, otherwise to login. */
export default async function Home() {
  const session = await auth();
  if (session) redirect("/feed");
  redirect("/login");
}
