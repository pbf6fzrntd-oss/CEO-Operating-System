import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEO Operating System",
  description: "Your private executive workspace for priorities, meetings, decisions, and follow-through.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
