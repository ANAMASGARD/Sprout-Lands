import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sproutLands = localFont({
  src: "../public/assets/sprout/font/SproutLands.ttf",
  variable: "--font-sprout",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sprout Mystery — Teemo and the Missing Moonbell",
  description:
    "A cute pastel pixel-art mystery puzzle game built with Next.js. Help Teemo solve four puzzles to find the Moonbell.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sproutLands.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#a6d8d3] font-pixel">{children}</body>
    </html>
  );
}
