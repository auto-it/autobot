import dedent from "dedent";
import { createChecklist, parseChecklists } from "../../lib/models/checklist";

describe("createChecklist", () => {
  it("creates a checklist", () => {
    const checklist = createChecklist("auto", "semver", [
      {
        id: "major",
        checked: false,
        body: "major",
      },
      {
        id: "minor",
        checked: true,
        body: "minor",
      },
    ]);
    expect(checklist).toBe(dedent`
      -[ ] <!-- auto:semver:major --> major
      -[x] <!-- auto:semver:minor --> minor 
    `);
  });
});

describe("parseChecklists", () => {
  it("returns a checklist from a text string", () => {
    const testString = dedent`
    blah blah
    -[ ] <!-- auto:semver:major --> Does a major release
    blah
    `;

    expect(parseChecklists(testString)).toEqual({
      auto: {
        semver: {
          id: "semver",
          namespace: "auto",
          items: [
            {
              id: "major",
              checked: false,
              body: "Does a major release",
            },
          ],
        },
      },
    });
  });

  it("combines checks into a single checklist", () => {
    const testString = dedent`
    -[ ] <!-- auto:semver:major --> abc
    -[ ] <!-- auto:semver:minor --> abc
    -[x] <!-- auto:changelog:docs --> abc
    `;

    expect(parseChecklists(testString)).toEqual({
      auto: {
        semver: {
          id: "semver",
          namespace: "auto",
          items: [
            {
              id: "major",
              checked: false,
              body: "abc",
            },
            {
              id: "minor",
              checked: false,
              body: "abc",
            },
          ],
        },
        changelog: {
          id: "changelog",
          namespace: "auto",
          items: [
            {
              id: "docs",
              checked: true,
              body: "abc",
            },
          ],
        },
      },
    });
  });
});
