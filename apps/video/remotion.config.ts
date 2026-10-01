import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(12);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
/* WebGL for the 3D mark; ANGLE is the GPU-backed renderer on macOS. */
Config.setChromiumOpenGlRenderer("angle");
