import { redirect } from "next/navigation";
import { homeRoute } from "@/lib/roles";
import { getActor } from "@/server/actor";

/** The root only routes: a signed-in visitor goes home, everyone else to the login page. */
export default async function RootPage() {
  const actor = await getActor();
  redirect(actor ? homeRoute(actor.role) : "/login");
}
