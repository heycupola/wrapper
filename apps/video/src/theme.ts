import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { createContext, useContext } from "react";

const mono = loadGeistMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

export type ThemeName = "dark" | "light";

/* Scene palettes from apps/web/BRAND.md. Blue is reserved for a live session. */
const palettes = {
  dark: {
    canvas: "#0D0F12",
    surface: "#15181D",
    surfaceMuted: "#1C2026",
    ink: "#F6F7F9",
    inkMuted: "#A8ADB5",
    inkFaint: "#62666E",
    border: "#2B3038",
    line: "#2B3038",
    live: "#7AA7FF",
    mark: "#FAFAF9",
    markInk: "#0E0E0E",
    shadow: "rgba(0, 0, 0, 0.55)",
  },
  light: {
    canvas: "#F6F6F2",
    surface: "#FFFFFF",
    surfaceMuted: "#ECEDE8",
    ink: "#121316",
    inkMuted: "#62666E",
    inkFaint: "#8A8E95",
    border: "#DCDDDA",
    line: "#C9CBC6",
    live: "#356DE8",
    mark: "#121316",
    markInk: "#FAFAF9",
    shadow: "rgba(18, 19, 22, 0.16)",
  },
} as const;

export type Palette = (typeof palettes)[ThemeName];

/* Terminal and phone surfaces follow the theme, like the product UI. */
const devices = {
  dark: {
    terminal: "#0B0D10",
    body: "#15181D",
    keyboard: "#15181D",
    key: "#1C2026",
    keyDown: "#2B3038",
    card: "#1C2026",
    island: "#15181D",
    ink: "#F6F7F9",
    inkMuted: "#A8ADB5",
    inkFaint: "#62666E",
    border: "#2B3038",
    live: "#7AA7FF",
    mark: "#FAFAF9",
    markInk: "#0E0E0E",
  },
  light: {
    terminal: "#FFFFFF",
    body: "#E4E5E0",
    keyboard: "#ECEDE8",
    key: "#FFFFFF",
    keyDown: "#DCDDDA",
    card: "#F3F3EF",
    island: "#0E0E0E",
    ink: "#121316",
    inkMuted: "#62666E",
    inkFaint: "#9A9DA3",
    border: "#DCDDDA",
    live: "#356DE8",
    mark: "#121316",
    markInk: "#FAFAF9",
  },
} as const;

export type Device = (typeof devices)[ThemeName];

export function useDevice(): Device {
  return devices[useContext(ThemeContext)];
}

const ThemeContext = createContext<ThemeName>("dark");
export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): ThemeName {
  return useContext(ThemeContext);
}

export function usePalette(): Palette {
  return palettes[useContext(ThemeContext)];
}

/* "3d" stages the film with a moving perspective camera; "2d" keeps it flat. */
export type Dimension = "3d" | "2d";

const DimensionContext = createContext<Dimension>("3d");
export const DimensionProvider = DimensionContext.Provider;

export function useDimension(): Dimension {
  return useContext(DimensionContext);
}

export const font = {
  sans: `"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, ${inter.fontFamily}, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, "SFMono-Regular", Menlo, monospace`,
} as const;
