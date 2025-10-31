import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MobileCarouselWrapper } from "@/components/mobile-carousel-wrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Food Database",
  description: "Curated weeknight-friendly dinner recipes that use accessible pantry staples and cook in under an hour.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MobileCarouselWrapper>{children}</MobileCarouselWrapper>
      </body>
    </html>
  );
}
