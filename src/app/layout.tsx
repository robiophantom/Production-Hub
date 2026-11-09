import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Company A Production Hub",
    template: "%s · Company A Production Hub",
  },
  description:
    "Production tracking, TNA planning, delay prediction and buyer reporting for Company A's knitwear export operation.",
  applicationName: "Company A Production Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Production Hub",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        {children}
        <ServiceWorkerRegistration />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
