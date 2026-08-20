import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wrapper",
    short_name: "Wrapper",
    description: "Reach an explicitly shared terminal from another device.",
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
