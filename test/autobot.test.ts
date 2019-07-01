import { Autobot, PRContext } from "../lib/autobot";
import { Application } from "probot";

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

    it("rejects on a config error", async () => {
      withConfig(new Error("Failed to grab config"));
      await expect(autobot.onPullRequestReceived(context)).rejects.toBeInstanceOf(Error);
      // @ts-ignore
      expect(autobot.hooks.pr.onError.call).toBeCalled();
      expect.assertions(3);
    });
  });
});
