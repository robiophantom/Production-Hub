import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Company A Production Hub",
    short_name: "Production Hub",
    description:
      "Production tracking, TNA milestones, delay prediction and buyer reporting for Company A.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F9FF",
    theme_color: "#2563EB",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "My production", url: "/supervisor" },
      { name: "Production board", url: "/board" },
    ],
  };
}
