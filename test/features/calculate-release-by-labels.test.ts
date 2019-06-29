import { CalculateReleaseByLabels } from "../../src/features/calculate-release-by-labels";
import { PRContext } from "../../src/autobot";
import { Config } from "../../src/config";
import { LabelError } from "../../src/features/calculate-release-by-labels";
import { ReleaseType } from "../../src/models/release";

describe("CalculateReleaseByLabels", () => {
  const context = (...labels: string[]) =>
    ({
      payload: {
        pull_request: {
          labels: labels.map(label => ({ name: label })),
        },
      },
    } as PRContext);

  let config: Config;
  beforeEach(() => {
    config = {
      labels: {
        major: "major",
        minor: "minor",
        patch: "patch",
        "skip-release": "skip release",
      },
      skipReleaseLabels: [],
    };
  });

  it("returns an invalid release if no version labels are found", async () => {
    const feature = new CalculateReleaseByLabels();

    // @ts-ignore
    const { calculateRelease } = await feature;

    const release = await calculateRelease(context(), config);
    expect(release.kind === "invalid" && release.reason).toBe(LabelError.NoLabels);
  });

  it("returns major with major label", async () => {
    const feature = new CalculateReleaseByLabels();

    // @ts-ignore
    const { calculateRelease } = await feature;

    const release = await calculateRelease(context("major"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Major, skip: false });
  });

  it("returns minor with minor label", async () => {
    const feature = new CalculateReleaseByLabels();

    // @ts-ignore
    const { calculateRelease } = await feature;

    const release = await calculateRelease(context("minor"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Minor, skip: false });
  });

  it("returns minor with patch label or no label", async () => {
    const feature = new CalculateReleaseByLabels();

    // @ts-ignore
    const { calculateRelease } = await feature;

    let release = await calculateRelease(context("patch"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Patch, skip: false });

    // It should also be patch if a skip release is set
    release = await calculateRelease(context("skip release"), config);

    expect(release).toMatchObject({
      type: ReleaseType.Patch,
      skip: true,
    });
  });
});
