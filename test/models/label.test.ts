import { findLabelFromHash, labelToString, Label } from "../../lib/models/label";
import { Config } from "../../lib/models/config";

describe("labelToString", () => {
  it("Should return a string if given a string", () => {
    expect(labelToString("textLabel")).toBe("textLabel");
  });

  it("Should return the name if an object", () => {
    expect(labelToString({ name: "nameText" } as Label)).toBe("nameText");
  });

  it("Should use default if provided and no other label text found", () => {
    expect(labelToString({} as Label, "defaultText")).toBe("defaultText");
  });

  it("Should throw if no label text can be found", () => {
    expect(() => labelToString({} as Label)).toThrow();
  });
});

describe("findLabelFromHash", () => {
  const labelText = "test-label";
  const labelMD5Hash = "1dac6ef503248d2d0ae93db7005b7279";

  it("Should return a label whose name matches a given hash", () => {
    expect(findLabelFromHash(labelMD5Hash, ({ labels: { test: labelText } } as unknown) as Config)).toBe("test-label");
  });

  it("Should return undefined if no matching label found", () => {
    expect(findLabelFromHash(labelMD5Hash, ({ labels: {} } as unknown) as Config)).toBeUndefined();
  });
});
