import { PRContext } from "../autobot";
import randomColor from "random-color";

const domain = "https://autobot.auto-it.now.sh";

export type LabelConfig =
  | string
  | {
      name?: string;
      title: string;
      description: string;
      color?: string;
    };

export interface NormalizedLabel {
  name: string;
  description: string;
  color: string;
}

export const renderLabel = (color: string, text: string) =>
  `<img align="center" src="${domain}/l/label?color=${color}&text=${text}"/>`;

// TODO: This should normalize the label to ensure it has all the info needed to be rendered
export const populateLabel = async (
  labelType: string,
  label: LabelConfig,
  context: PRContext,
): Promise<NormalizedLabel> => {
  const { owner, repo } = context.repo();
  const { data: labels } = await context.github.issues.listLabelsForRepo({ owner, repo });
  const labelText = typeof label === "string" ? label : label.name || labelType;
  const fullLabel = labels.find(l => l.name === label);

  if (fullLabel) {
    const { name, description, color } = fullLabel;
    return { name, description, color };
  } else {
    const color = randomColor().hexString();
    await context.github.issues.createLabel({ owner, repo, name: labelText, color });
    return { name: labelText, description: "", color };
  }
};
