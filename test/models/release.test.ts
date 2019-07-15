import { calculateLabelRelease, LabelError } from "../../lib/models/release";
import { PRContext } from "../../lib/models/context";
import { Config } from "../../lib/config";
import { ReleaseType } from "../../lib/models/release";

describe("calculateLabelRelease", () => {
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

  it("returns an invalid release if no version labels are found", () => {
    const release = calculateLabelRelease(context(), config);
    expect(release.kind === "invalid" && release.reason).toBe(LabelError.NoLabels);
  });

  it("returns major with major label", () => {
    const release = calculateLabelRelease(context("major"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Major, skip: false });
  });

  it("returns minor with minor label", () => {
    const release = calculateLabelRelease(context("minor"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Minor, skip: false });
  });

  it("returns minor with patch label or no label", () => {
    let release = calculateLabelRelease(context("patch"), config);
    expect(release.kind === "valid" && release).toMatchObject({ type: ReleaseType.Patch, skip: false });

    // It should also be patch if a skip release is set
    release = calculateLabelRelease(context("skip release"), config);

    expect(release).toMatchObject({
      type: ReleaseType.Patch,
      skip: true,
    });
  });
});
