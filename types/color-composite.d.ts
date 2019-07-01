interface RGBColor {
  space: "rgb";
  /** [ R, G, B ] */
  values: [number, number, number];
  alpha: number;
}

declare module "color-composite" {
  export default function(layers: RGBColor[]): RGBColor;
}
