import { parse, Font } from "opentype.js";
import layer from "color-composite";
import { rgb } from "wcag-contrast";
import { NowRequest, NowResponse } from "@now/node";
import fetch from "node-fetch";

interface RGBColor {
  space: "rgb";
  /** [ R, G, B ] */
  values: [number, number, number];
  alpha: number;
}

const BOX_SHADOW: RGBColor = {
  space: "rgb",
  values: [27, 31, 35],
  alpha: 0.12,
};

const FONT_SIZE = 12;
const X_PADDING = 4;
const Y_PADDING = 3;

const lineHeight = FONT_SIZE + 2 * Y_PADDING;
const canvasHeight = lineHeight + 1;

const font: Promise<Font> = fetch(
  "https://github.com/google/fonts/blob/master/apache/roboto/Roboto-Medium.ttf?raw=true",
)
  .then(res => res.buffer())
  // https://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer/31394257#31394257
  .then(b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  .then(buffer => parse(buffer));

const hexToRGB = (hex: string): RGBColor => {
  if (hex.length === 3) {
    hex += hex;
  }

  if (hex.length !== 6) {
    throw new Error("Invalid hex code");
  }

  const num = parseInt(hex, 16);
  if (Number.isNaN(num)) {
    throw new Error("Hex code parsing did not result in a valid number");
  }

  return {
    space: "rgb",
    values: [num >> 16, (num >> 8) & 255, num & 255],
    alpha: 1,
  };
};

const stringifyHex = (color: RGBColor) => {
  const [r, g, b] = color.values;
  return `#${(b | (g << 8) | (r << 16) | (1 << 24)).toString(16).slice(1)}`;
};

const svg = (text: string, width: number, fg: string, bg: string, fill: string) => {
  const paddedWidth = width + 2 * X_PADDING;
  return `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${paddedWidth}" height="${canvasHeight}">
<rect x="0" y="1" width="${paddedWidth}" height="${lineHeight}" rx="3" fill="${bg}" />
<rect x="0" y="0" width="${paddedWidth}" height="${lineHeight}" rx="3" fill="${fg}" />
<text fill="${fill}" x="${X_PADDING}" dy="0.39em" y="9" textLength="${width}" style="font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:12px;font-weight:600;text-rendering:geometricPrecision;">${text}</text>
</svg>
`;
};

const calcWidth = async (text: string) =>
  (await font).getAdvanceWidth(text, FONT_SIZE, {
    kerning: true,
    features: [] as any,
    // @ts-ignore
    hinting: false,
  });

const calcShadow = (color: RGBColor) => stringifyHex(layer([BOX_SHADOW, color]));

const calcFontColor = (color: RGBColor) => {
  const blackContrastScore = rgb(color.values, [0, 0, 0]);
  const whiteContrastScore = rgb(color.values, [255, 255, 255]);

  return blackContrastScore >= whiteContrastScore ? "#000" : "#FFF";
};

export = async (req: NowRequest, res: NowResponse) => {
  const { color, text } = req.query;
  if (color && typeof color === "string" && text && typeof text === "string") {
    const rgbColor = hexToRGB(color);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "s-maxage=31536000, max-age=31536000");
    return res
      .status(200)
      .send(svg(text, await calcWidth(text), stringifyHex(rgbColor), calcShadow(rgbColor), calcFontColor(rgbColor)));
  } else {
    return res.status(400).send("Invalid query parameters, ensure color and text are present");
  }
};
