import { NowRequest, NowResponse } from "@now/node";
// @ts-ignore
import Octicons from "@primer/octicons";

export = async (req: NowRequest, res: NowResponse) => {
  const { icon, size = "1" } = req.query;
  if (!icon || !size || typeof icon !== "string" || typeof size !== "string") {
    return res.status(400);
  } else if (!(icon in Octicons)) {
    return res.status(422).send("Specified octicon not found");
  } else {
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "s-maxage=31536000, max-age=31536000");
    return res.status(200).send(Octicons[icon].toSVG({ height: 16 * parseInt(size) }));
  }
};
