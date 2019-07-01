import nock from "nock";
// Requiring our app implementation
import myProbotApp from "../lib/app";
import { Probot } from "probot";
// Requiring our fixtures
import payload from "./fixtures/issues.opened";
const issueCreatedBody = { body: "Thanks for opening this issue!" };

nock.disableNetConnect();

describe.skip("My Probot app", () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({ id: 123, cert: "test" });
    // Load our app into probot
    const app = probot.load(myProbotApp);

    // just return a test token
    app.app = {
      getSignedJsonWebToken: () => "test",
      getInstallationAccessToken: () => Promise.resolve("none"),
    };
  });

  test("creates a comment when an issue is opened", async done => {
    // Test that we correctly return a test token
    nock("https://api.github.com")
      .post("/app/installations/2/access_tokens")
      .reply(200, { token: "test" });

    // Test that a comment is posted
    nock("https://api.github.com")
      .post("/repos/hiimbex/testing-things/issues/1/comments", (body: any) => {
        done(expect(body).toMatchObject(issueCreatedBody));
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ id: "123", name: "issues", payload });
  });
});

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about using TypeScript in your tests, Jest recommends:
// https://github.com/kulshekhar/ts-jest

// For more information about testing with Nock see:
// https://github.com/nock/nock
