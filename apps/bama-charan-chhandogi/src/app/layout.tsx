import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Merriweather } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShipNotes — Sprint Standups to GitHub Issues + Slack",
  description:
    "Autonomous engineering standup intelligence. Transforms raw developer voice notes into verified GitHub Issues and team digests via WhipScribe API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${merriweather.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#fafcf9] text-[#111827] antialiased selection:bg-[#d5e8da] selection:text-[#1e4d35]">
        {children}
      </body>
    </html>
  );
}
