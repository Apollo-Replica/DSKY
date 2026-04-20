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
      <body>{children}</body>
    </html>
  );
}
