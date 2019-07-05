import { Autobot, PRContext } from "../lib/autobot";
import { Application } from "probot";
import { AppPlugin } from "../lib/plugin";

const app = (Symbol("app") as unknown) as Application;
const context = ({} as unknown) as PRContext;

describe("autobot", () => {
  describe("start", () => {
    it("creates a new autobot instance", () => {
      const autobot = Autobot.start(app, []);
      expect(autobot).toBeInstanceOf(Autobot);
    });

    it("calls the onStart hook with the correct arguments", () => {
      const autobot = Autobot.start(app, []);
      // @ts-ignore
      expect(autobot.hooks.app.onStart.call).toBeCalledWith(app);

      // Ensures the default mock impl of call from tapable was called w/ the correct args
      expect.assertions(2);
    });

    it("intializes app scope plugins", () => {
      class TestAppPlugin extends AppPlugin {
        public name = "TestAppPlugin";
        public apply(hooks: import("../lib/autobot").Hooks): void {
          hooks["app"].onStart.tap(this.name, () => {});
        }
      }
      const autobot = Autobot.start(app, [TestAppPlugin]);
      // @ts-ignore
      expect(autobot.hooks.app.onStart.tap).toBeCalled();
    });

    it.todo("doesn't initialize PR plugins on start");
  });

  describe("onPullRequestReceived", () => {
    const autobot = Autobot.start(app, []);
    // @ts-ignore
    autobot.getConfig = jest.fn().mockImplementation(() => Promise.resolve({}));

    type ConfigResult = Promise<never | object>;
    const withConfig = (fnOrObj: (() => ConfigResult) | any) => {
      if (typeof fnOrObj === "function") {
        // @ts-ignore
        (autobot.getConfig as jest.Mock<any, any>).mockImplementationOnce(fnOrObj);
      } else if (fnOrObj instanceof Error) {
        // @ts-ignore
        (autobot.getConfig as jest.Mock<any, any>).mockImplementationOnce(() => Promise.reject(fnOrObj));
      } else {
        // @ts-ignore
        (autobot.getConfig as jest.Mock<any, any>).mockImplementationOnce(() => Promise.resolve(fnOrObj));
      }
    };

    it.todo("intializies PR plugins");

    it.todo("doesn't initialize a PR with an unmatching action");

    it("rejects on a config error", async () => {
      withConfig(new Error("Failed to grab config"));
      await expect(autobot.onPullRequestReceived(context)).rejects.toBeInstanceOf(Error);
      // @ts-ignore
      expect(autobot.hooks.pr.onError.call).toBeCalled();
      expect.assertions(3);
    });
  });
});
