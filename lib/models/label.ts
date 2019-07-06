import { PRContext } from "../autobot";

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
export const populateLabel = async (label: LabelConfig, context: PRContext): NormalizedLabel => {
  const { owner, repo } = context.repo();
  const { data: labels } = await context.github.issues.listLabelsForRepo({ owner, repo });
  if (typeof label === "string") {
    const fullLabel = labels.find(l => l.name === label);
    if (fullLabel) {
      const { name, description, color } = fullLabel;
      return { name, description, color };
    }
  } else {
    // This case really shouldn't happen because the label _should_ be normalized before it's passed to this function
    if (!label.name) throw new Error("Label must include a name");
  }
};
