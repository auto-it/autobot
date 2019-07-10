import slugify from "slugify";

slugify.extend({ "-": "_" });

export const slug = (str: string) =>
  slugify(str, {
    replacement: "_",
    lower: true,
    remove: /[^\w]/g,
  });
