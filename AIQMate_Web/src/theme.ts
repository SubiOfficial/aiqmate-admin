// SPEC-036 FR-WEB-040. Fluent UI v9 themes built from AiQMate blue #0058CC, the mobile app's
// primary (app/mobile/src/theme/colors.ts LIGHT_BASE.blue). Shade 80 is the light theme's brand
// fill, so it is the exact app blue.

import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

export const aiqmateBrand: BrandVariants = {
  10: "#020A1A",
  20: "#04172F",
  30: "#062245",
  40: "#082D5B",
  50: "#0A3872",
  60: "#0C4389",
  70: "#0A4EA6",
  80: "#0058CC",
  90: "#1F6FD6",
  100: "#3A82DD",
  110: "#5394E3",
  120: "#6CA6E9",
  130: "#86B8EE",
  140: "#A1CAF3",
  150: "#BCDBF7",
  160: "#D8ECFB",
};

export const lightTheme: Theme = createLightTheme(aiqmateBrand);

export const darkTheme: Theme = {
  ...createDarkTheme(aiqmateBrand),
  // Lighter brand text on dark backgrounds, as Fluent recommends for custom ramps.
  colorBrandForeground1: aiqmateBrand[110],
  colorBrandForeground2: aiqmateBrand[120],
};
