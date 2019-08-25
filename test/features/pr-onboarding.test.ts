import {
  didMessageChange,
  didChecklistsChange,
  messageWrapper,
  onBoardingMessage,
  isOnboarding,
} from "../../lib/features/pr-onboarding";
import { PRContext } from "../../lib/models/context";

const uncheckedBody = messageWrapper(onBoardingMessage(["- [ ] <!-- autobot:testList:testId --> test"]));
const checkedBody = messageWrapper(onBoardingMessage(["- [x] <!-- autobot:testList:testId --> test"]));

const body = (text: string) => ({
  body: {
    from: text,
  },
});

const context = (body: string, changes: object = {}) =>
  ({
    payload: {
      pull_request: {
        body,
      },
      changes,
    },
  } as PRContext);

describe("didBodyChange", () => {
  it("returns false if the title was edited", () => {
    expect(didMessageChange(context("foo", { title: "test" }))).toBe(false);
  });

  it("returns false when there are no changes to the on-boarding message", () => {
    expect(didMessageChange(context("a\n" + uncheckedBody, body("b\n" + uncheckedBody)))).toBe(false);
  });

  it("returns true when the contents of the message changed", () => {
    expect(didMessageChange(context(uncheckedBody, body(checkedBody)))).toBe(true);
  });
});

describe("didChecklistsChange", () => {
  it("returns false if no checklist changes", () => {
    expect(didChecklistsChange(uncheckedBody, uncheckedBody)).toBe(false);
  });

  it("returns true if the checklist changed", () => {
    expect(didChecklistsChange(uncheckedBody, checkedBody)).toBe(true);
  });
});

describe("isOnboarding", () => {
  it("returns true if the pr body has an on-boarding message", () => {
    expect(isOnboarding(context(uncheckedBody))).toBe(true);
  });

  it("returns false if the PR body doesn't contain an on-boarding message", () => {
    expect(isOnboarding(context("Hello world, this is a PR"))).toBe(false);
  });
});
