import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { initializeServices } from '@/lib/init'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "Nether Chat",
  description: "Chat with your favorite AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Call it when the app starts
  initializeServices().catch(console.error)

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
