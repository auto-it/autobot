import { fetchExtendedURLConfig } from "../../lib/models/config";
import nock from "nock";

const mockRequest = (url: string) => nock(url).defaultReplyHeaders({ "access-control-allow-origin": "*" });

describe("Extended configs", () => {
  describe("when fetched from a URL", () => {
    const url = "http://test-url";
    it("makes a request to the given url and parses the resulting JSON", async () => {
      const payload = { name: "Bob", email: "bob@builders.com" };

      mockRequest(url)
        .get("/auto.json")
        .reply(200, JSON.stringify(payload));

      expect(await fetchExtendedURLConfig(`${url}/auto.json`)).toEqual(payload);
    });

    it("throws an error if there's a non 200 response code", async () => {
      mockRequest(url)
        .get("/auto.json")
        .reply(404, "Couldn't not find file");

      await expect(fetchExtendedURLConfig(`${url}/auto.json`)).rejects.toBeInstanceOf(Error);
    });

    it("throws an error if the response isn't valid json", async () => {
      mockRequest(url)
        .get("/auto.json")
        .reply(200, "{ uh oh }");
      await expect(fetchExtendedURLConfig(`${url}/auto.json`)).rejects.toBeInstanceOf(Error);
    });
  });
});
