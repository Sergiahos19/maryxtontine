import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavigationControls } from "@/components/layout/navigation-controls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MARYX | Gestion des cotisations",
  description: "Plateforme professionnelle de gestion des cotisations MARYX.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100 transition-colors duration-200">
        {children}
        <NavigationControls />
      </body>
    </html>
  );
}
