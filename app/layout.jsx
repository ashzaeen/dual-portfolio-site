import "../styles/globals.css";
import { fontVariables } from "./fonts";
import { PostHogProvider } from "./providers";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata = {
  metadataBase: new URL("https://www.ashzaeen.com"),
  title: "Ashzaeen Fatmi Khan",
  description:
    "CS + Math at UTA · AI research at the Robotic Vision Lab · builder, writer, traveler.",
  openGraph: {
    title: "Ashzaeen Fatmi Khan",
    description:
      "CS + Math at UTA · AI research at the Robotic Vision Lab · builder, writer, traveler.",
    url: "https://www.ashzaeen.com",
    siteName: "Ashzaeen Fatmi Khan",
    images: [{ url: "/opengraph-image.png" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ashzaeen Fatmi Khan",
    description:
      "CS + Math at UTA · AI research at the Robotic Vision Lab · builder, writer, traveler.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    // fontVariables must be on <html>: tokens.css references --font-cormorant/lora/etc. from :root.
    <html lang="en" className={fontVariables}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=JetBrains+Mono:wght@300;400;500;700&family=Lora:ital,wght@0,400;0,500;1,400;1,500&family=Caveat:wght@400;600;700&family=Kalam:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
