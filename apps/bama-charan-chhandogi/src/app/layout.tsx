import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShipNotes — Sprint Standup → GitHub Issues + Slack",
  description:
    "Record your sprint standup. Get GitHub Issues, a Slack digest, and a team changelog — automatically. Powered by WhipScribe.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
