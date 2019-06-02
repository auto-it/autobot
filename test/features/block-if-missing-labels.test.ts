import { BlockIfMissingLabels, LabelError, ReleaseType } from "../../src/features/block-if-missing-labels";

describe("BlockIfMissingLabels", () => {
  describe("isMissingRequiredLabels", () => {
    const context = (...labels: string[]) => ({
      payload: {
        pull_request: {
          labels: labels.map(label => ({ name: label })),
        },
      },
    });
    let config: object;
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

    it("sets the release state to an error if no version labels are found", async () => {
      const feature = new BlockIfMissingLabels();
      // @ts-ignore
      await feature.isMissingRequiredLabels(context(), config);
      // @ts-ignore
      expect(feature.releaseState).toBe(LabelError.NoLabels);
    });

    it("sets the release state to an error if multiple version labels are found", async () => {
      const feature = new BlockIfMissingLabels();
      // @ts-ignore
      await feature.isMissingRequiredLabels(context("major", "patch"), config);
      // @ts-ignore
      expect(feature.releaseState).toBe(LabelError.ConflictingLabels);
    });

    it("sets the release state to major", async () => {
      const feature = new BlockIfMissingLabels();
      // @ts-ignore
      await feature.isMissingRequiredLabels(context("major"), config);
      // @ts-ignore
      expect(feature.releaseState).toEqual({
        type: ReleaseType.Major,
        skip: false,
      });
    });
    it("sets the release state to minor", async () => {
      const feature = new BlockIfMissingLabels();
      // @ts-ignore
      await feature.isMissingRequiredLabels(context("minor"), config);
      // @ts-ignore
      expect(feature.releaseState).toEqual({
        type: ReleaseType.Minor,
        skip: false,
      });
    });
    it("sets the release state to patch", async () => {
      const feature = new BlockIfMissingLabels();
      // @ts-ignore
      await feature.isMissingRequiredLabels(context("patch"), config);
      // @ts-ignore
      expect(feature.releaseState).toEqual({
        type: ReleaseType.Patch,
        skip: false,
      });

      // It should also be patch if a skip release is set
      // @ts-ignore
      await feature.isMissingRequiredLabels(context("skip release"), config);
      // @ts-ignore
      expect(feature.releaseState).toEqual({
        type: ReleaseType.Patch,
        skip: true,
      });
    });
  });
});
