import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShipNotes — Sprint Standup to GitHub Issues + Slack",
  description:
    "Autonomous engineering standup intelligence. Transforms raw developer voice notes into verified GitHub Issues and team digests via WhipScribe API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-indigo-500/20 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
