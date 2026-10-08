import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `My Campus Today | CampusOS · ${CAMPUS_INSTITUTION_LABEL}`, template: `%s | CampusOS · ${CAMPUS_INSTITUTION_LABEL}` },
  description: `A considered campus utility for ${CAMPUS_INSTITUTION_LABEL}, covering information, deadlines, and student tasks.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F8FA",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
