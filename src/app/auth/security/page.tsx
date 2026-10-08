import type { Metadata } from "next";
import { AccountSecurity } from "@/modules/identity/components/account-security";

export const metadata: Metadata = {
  title: "Account security · CampusOS", robots: { index: false, follow: false }, referrer: "no-referrer",
};

export default function SecurityPage() { return <AccountSecurity />; }
