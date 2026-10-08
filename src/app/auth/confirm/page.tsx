import type { Metadata } from "next";
import { LinkConfirmation } from "@/modules/identity/components/link-confirmation";

export const metadata: Metadata = { title: "Confirm account link · CampusOS", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : "";
  const type = typeof params.type === "string" ? params.type : "";
  // GET renders a review screen only; the managed token is verified by the explicit POST.
  return <LinkConfirmation tokenHash={tokenHash.slice(0, 129)} type={type.slice(0, 20)} />;
}
