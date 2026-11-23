import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";
import "../styles/globals.css";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DSKY",
  description: "Apollo Guidance Computer DSKY Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={shareTechMono.variable}>
      <head>
        {/* Runtime settings (DSKY_DISPLAY) served by server.ts; must load before the app. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/dsky-env.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
