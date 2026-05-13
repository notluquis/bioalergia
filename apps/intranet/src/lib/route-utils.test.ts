import { describe, expect, it } from "vitest";

import {
  auditRouteNavigation,
  extractPermissionsFromRoutes,
  isTechnicalRoute,
  validateRouteNavigation,
} from "./route-utils";

describe("route-utils", () => {
  describe("isTechnicalRoute", () => {
    it.each([
      ["/_layout", true],
      ["/patients/$id", true],
      ["/patients/$id.edit", true],
      ["/patients/edit", true],
      ["/patients/create", true],
      ["/patients/$", true],
      ["/patients/index", true],
      ["/patients/add", true],
      ["/patients", false],
      ["/clinical/agenda", false],
    ])("classifies %s -> %s", (path, expected) => {
      expect(isTechnicalRoute(path)).toBe(expected);
    });
  });

  describe("validateRouteNavigation", () => {
    it("technical routes always valid", () => {
      const v = validateRouteNavigation({
        fullPath: "/_layout",
        hasNav: false,
        hasPermission: false,
      });
      expect(v.isValid).toBe(true);
    });
    it("missing nav with permission is invalid", () => {
      const v = validateRouteNavigation({
        fullPath: "/x",
        hasNav: false,
        hasPermission: true,
      });
      expect(v.isValid).toBe(false);
      expect(v.message).toContain("no nav");
    });
    it("hideFromNav skips nav requirement", () => {
      const v = validateRouteNavigation({
        fullPath: "/x",
        hasNav: false,
        hasPermission: true,
        hideFromNav: true,
      });
      expect(v.isValid).toBe(true);
    });
    it("nav without permission is invalid", () => {
      const v = validateRouteNavigation({
        fullPath: "/x",
        hasNav: true,
        hasPermission: false,
      });
      expect(v.isValid).toBe(false);
      expect(v.message).toContain("no permission");
    });
    it("valid when both present", () => {
      const v = validateRouteNavigation({
        fullPath: "/x",
        hasNav: true,
        hasPermission: true,
      });
      expect(v.isValid).toBe(true);
    });
  });

  describe("auditRouteNavigation", () => {
    function makeRoute(opts: {
      fullPath: string;
      nav?: unknown;
      permission?: unknown;
      hideFromNav?: boolean;
      children?: unknown;
    }) {
      return {
        fullPath: opts.fullPath,
        path: opts.fullPath,
        options: {
          staticData: {
            nav: opts.nav,
            permission: opts.permission,
            hideFromNav: opts.hideFromNav,
          },
        },
        children: opts.children,
      } as never;
    }

    it("traverses array children and bins routes", () => {
      const tree = makeRoute({
        fullPath: "/",
        children: [
          makeRoute({ fullPath: "/_layout" }),
          makeRoute({ fullPath: "/foo", nav: {}, permission: { subject: "x", action: "read" } }),
          makeRoute({ fullPath: "/bar", permission: { subject: "y", action: "read" } }),
          makeRoute({ fullPath: "/baz", nav: {} }),
        ],
      });
      const out = auditRouteNavigation(tree);
      expect(out.technicalRoutes).toContain("/_layout");
      expect(out.validRoutes).toContain("/foo");
      expect(out.missingNav).toContain("/bar");
      expect(out.missingPermission).toContain("/baz");
    });

    it("handles object children", () => {
      const tree = makeRoute({
        fullPath: "/",
        children: {
          a: makeRoute({ fullPath: "/a", nav: {}, permission: { subject: "s", action: "read" } }),
        },
      });
      const out = auditRouteNavigation(tree);
      expect(out.validRoutes).toContain("/a");
    });

    it("handles missing children", () => {
      const out = auditRouteNavigation(makeRoute({ fullPath: "/" }));
      expect(out.missingNav).toEqual([]);
    });
  });

  describe("extractPermissionsFromRoutes", () => {
    function makeRoute(perm: unknown, children?: unknown) {
      return {
        fullPath: "/x",
        options: { staticData: { permission: perm } },
        children,
      } as never;
    }
    it("dedupes permissions by subject:action", () => {
      const tree = makeRoute({ subject: "a", action: "read" }, [
        makeRoute({ subject: "a", action: "read" }),
        makeRoute({ subject: "b", action: "write" }),
      ]);
      const perms = extractPermissionsFromRoutes(tree);
      expect(perms).toHaveLength(2);
    });
    it("returns empty for empty tree", () => {
      const tree = makeRoute(undefined);
      expect(extractPermissionsFromRoutes(tree)).toEqual([]);
    });
  });
});
