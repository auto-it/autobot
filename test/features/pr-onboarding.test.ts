import { didChecklistChange, messageWrapper, onBoardingMessage } from "../../lib/features/pr-onboarding";
import { PRContext } from "../../lib/models/context";

const uncheckedBody = messageWrapper(onBoardingMessage(["- [ ] <!-- autobot:testList:testId --> test"]));
const checkedBody = messageWrapper(onBoardingMessage(["- [x] <!-- autobot:testList:testId --> test"]));

const body = (text: string) => ({
  body: {
    from: text,
  },
});

const context = (body: string, changes: object) =>
  ({
    payload: {
      pull_request: {
        body,
      },
      changes,
    },
  } as PRContext);

describe("didChecklistChange", () => {
  it("should return false if the title was edited", () => {
    expect(didChecklistChange(context("foo", { title: "test" }))).toBe(false);
  });

  it("should return false when there are no changes to the on-boarding message", () => {
    expect(didChecklistChange(context("a\n" + uncheckedBody, body("b\n" + uncheckedBody)))).toBe(false);
  });

  it("should return true when the checklist changed", () => {
    expect(didChecklistChange(context(uncheckedBody, body(checkedBody)))).toBe(true);
  });
});
