import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wrapper",
    short_name: "Wrapper",
    description: "Reach an explicitly shared terminal from another device.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef0f2",
    theme_color: "#14171c",
    icons: [
      {
        src: "/wrapper-icon-dark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
