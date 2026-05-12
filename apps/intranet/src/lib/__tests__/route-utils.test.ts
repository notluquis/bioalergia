import { describe, expect, it } from "vitest";
import { isTechnicalRoute, validateRouteNavigation } from "../route-utils";

describe("isTechnicalRoute", () => {
  it("returns false for normal page routes", () => {
    expect(isTechnicalRoute("/patients")).toBe(false);
    expect(isTechnicalRoute("/finance/transactions")).toBe(false);
  });

  it("returns true for layout routes (underscore prefix)", () => {
    expect(isTechnicalRoute("/_auth")).toBe(true);
    expect(isTechnicalRoute("/_layout/patients")).toBe(true);
  });

  it("returns true for dynamic segments", () => {
    expect(isTechnicalRoute("/patients/$id")).toBe(true);
    expect(isTechnicalRoute("/posts/$postId")).toBe(true);
  });

  it("returns true for edit routes", () => {
    expect(isTechnicalRoute("/patients/$id.edit")).toBe(true);
    expect(isTechnicalRoute("/patients/edit")).toBe(true);
  });

  it("returns true for create routes", () => {
    expect(isTechnicalRoute("/patients/create")).toBe(true);
  });

  it("returns true for add routes", () => {
    expect(isTechnicalRoute("/patients/add")).toBe(true);
    expect(isTechnicalRoute("/patients/$id.add")).toBe(true);
  });

  it("returns true for index routes", () => {
    expect(isTechnicalRoute("/patients/index")).toBe(true);
  });

  it("returns true for catch-all routes", () => {
    expect(isTechnicalRoute("/patients/$")).toBe(true);
  });
});

describe("validateRouteNavigation", () => {
  it("is valid for technical routes regardless of metadata", () => {
    const result = validateRouteNavigation({
      fullPath: "/patients/$id",
      hasNav: false,
      hasPermission: false,
    });
    expect(result.isValid).toBe(true);
  });

  it("is valid when page route has both nav and permission", () => {
    const result = validateRouteNavigation({
      fullPath: "/patients",
      hasNav: true,
      hasPermission: true,
    });
    expect(result.isValid).toBe(true);
  });

  it("invalid when page route has permission but no nav", () => {
    const result = validateRouteNavigation({
      fullPath: "/patients",
      hasNav: false,
      hasPermission: true,
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("no nav");
  });

  it("valid when page route has permission and explicit hideFromNav", () => {
    const result = validateRouteNavigation({
      fullPath: "/patients",
      hasNav: false,
      hasPermission: true,
      hideFromNav: true,
    });
    expect(result.isValid).toBe(true);
  });

  it("invalid when page route has nav but no permission", () => {
    const result = validateRouteNavigation({
      fullPath: "/patients",
      hasNav: true,
      hasPermission: false,
    });
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("no permission");
  });
});
