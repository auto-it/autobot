import { hash } from "../../lib/utils/hash";

it("should hash a string", () => {
  expect(hash("test-label")).toBe("1dac6ef503248d2d0ae93db7005b7279");
});
