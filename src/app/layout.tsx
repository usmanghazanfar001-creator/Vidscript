import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vidscript: Turn your script into animated visuals",
  description: "Turn your script into animated visuals. Add your voice. Publish your video.",
  // favicon.ico, icon.png and apple-icon.png in src/app are picked up automatically by Next.js.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
