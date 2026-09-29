import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Application Command Center",
  description: "A private workspace for discovering, reviewing, and tracking job applications.",
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
