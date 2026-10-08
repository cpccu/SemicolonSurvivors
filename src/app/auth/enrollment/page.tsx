import type { Metadata } from "next";
import { EnrollmentImport } from "@/modules/identity/components/enrollment-import";

export const metadata: Metadata = { title: "Enrollment import · CampusOS", robots: { index: false, follow: false } };
export default function EnrollmentPage() { return <EnrollmentImport />; }
