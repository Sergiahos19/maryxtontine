import type { Metadata, Viewport } from "next";
import { Geist, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "MARYX | Tontine et cotisations",
  description: "Cotisez chaque jour, suivez votre solde et téléchargez vos relevés MARYX.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#020b1d" },
  ],
};

// Applique le thème enregistré avant le premier rendu pour éviter un flash de couleur.
const themeScript = `try{if(localStorage.getItem("maryx-theme-v1")==="light")document.documentElement.classList.add("light")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${sora.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
