# Web public assets

Drop landing-page media here. Recommended filenames:

- `wrapper-demo.mp4`: product demo video (autoplay, muted, looped). Keep it short
  (10-20s), H.264/MP4, 16:10 or 5:4, ideally under ~8MB for fast load.
- `wrapper-demo-poster.png`: poster frame shown before the video loads.

Until these exist, the hero renders a MacBook host terminal and the Wrapper
iPhone app inside Figma device chrome.
To enable the video, configure:

```bash
NEXT_PUBLIC_WRAPPER_DEMO_VIDEO_URL=/wrapper-demo.mp4
NEXT_PUBLIC_WRAPPER_DEMO_POSTER_URL=/wrapper-demo-poster.png
```

The video fades over the MacBook screen only after it can play. Leaving these
variables unset avoids missing-asset requests and keeps the device mockups as the
hero. Visitors who prefer reduced motion always keep the static mockups.
