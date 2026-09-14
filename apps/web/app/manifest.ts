import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wrapper",
    short_name: "Wrapper",
    description:
      "Keep the real terminal on your computer. Open it from your phone only when you share.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f2",
    theme_color: "#f6f6f2",
    icons: [
      {
        src: "/wrapper-icon-light.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
