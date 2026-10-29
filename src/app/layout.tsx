import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
  title: "LaTeX Studio — Editor con vista previa y exportación a PDF/DOCX",
  description:
    "Escribe LaTeX, compílalo en tiempo real y expórtalo a PDF o Microsoft Word (.docx) con Tectonic y Pandoc.",
};

export const viewport: Viewport = {
  themeColor: "#070a10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="h-dvh overflow-hidden bg-studio-950 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
