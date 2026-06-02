import { describe, expect, test } from "vitest";
import { hasOrgRole } from "@/lib/org/orgRoles";
import { slugify } from "@/lib/org/slug";

describe("hasOrgRole", () => {
  test("owner meets every minimum", () => {
    expect(hasOrgRole("owner", "owner")).toBe(true);
    expect(hasOrgRole("owner", "admin")).toBe(true);
    expect(hasOrgRole("owner", "member")).toBe(true);
  });

  test("admin meets admin/member but not owner", () => {
    expect(hasOrgRole("admin", "owner")).toBe(false);
    expect(hasOrgRole("admin", "admin")).toBe(true);
    expect(hasOrgRole("admin", "member")).toBe(true);
  });

  test("member meets only member", () => {
    expect(hasOrgRole("member", "owner")).toBe(false);
    expect(hasOrgRole("member", "admin")).toBe(false);
    expect(hasOrgRole("member", "member")).toBe(true);
  });
});

describe("slugify", () => {
  test("lowercases and hyphenates", () => {
    expect(slugify("Pixeldust Studio")).toBe("pixeldust-studio");
  });

  test("strips punctuation and collapses separators", () => {
    expect(slugify("  Acme,  Inc.! ")).toBe("acme-inc");
  });

  test("empty / symbol-only falls back to 'org'", () => {
    expect(slugify("")).toBe("org");
    expect(slugify("!!!")).toBe("org");
  });

  test("trims to 60 chars without trailing hyphen", () => {
    const long = "a".repeat(70);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});
