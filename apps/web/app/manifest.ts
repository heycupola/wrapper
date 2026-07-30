import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wrapper",
    short_name: "Wrapper",
    description: "Reach an explicitly shared terminal from another device.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0e0e",
    theme_color: "#6e56cf",
    icons: [
      {
        src: "/wrapper-icon-dark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
