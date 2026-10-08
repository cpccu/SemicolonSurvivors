import type { Metadata } from "next";
import { PasswordSetup } from "@/modules/identity/components/password-setup";

export const metadata: Metadata = { title: "Password setup · CampusOS", robots: { index: false, follow: false } };
export default function PasswordPage() { return <PasswordSetup />; }
