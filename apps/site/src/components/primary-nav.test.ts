import { describe, expect, it } from "vitest";

import type { NavLink } from "@/data/navigation";

import { isNavItemActive } from "@/lib/nav-active";

const link = (href: string, accent = false): NavLink => ({ label: href, href, accent });

describe("isNavItemActive", () => {
  it("marks the home link active only on the exact root", () => {
    expect(isNavItemActive(link("/"), "/")).toBe(true);
    expect(isNavItemActive(link("/"), "/examenes")).toBe(false);
    expect(isNavItemActive(link("/"), "/inmunoterapia")).toBe(false);
  });

  it("marks a route active on an exact path match", () => {
    expect(isNavItemActive(link("/inmunoterapia"), "/inmunoterapia")).toBe(true);
    expect(isNavItemActive(link("/examenes"), "/examenes")).toBe(true);
  });

  it("marks a route active on nested children", () => {
    expect(isNavItemActive(link("/aprende"), "/aprende/rinitis")).toBe(true);
    expect(isNavItemActive(link("/examenes"), "/examenes/alex2")).toBe(true);
  });

  it("does not match unrelated routes or prefixes", () => {
    expect(isNavItemActive(link("/examenes"), "/inmunoterapia")).toBe(false);
    // `/examenes` must not match `/examenes-foo` (prefix without a slash boundary).
    expect(isNavItemActive(link("/examenes"), "/examenes-foo")).toBe(false);
  });

  it("ignores trailing slashes on both sides", () => {
    expect(isNavItemActive(link("/inmunoterapia"), "/inmunoterapia/")).toBe(true);
    expect(isNavItemActive(link("/polen/"), "/polen")).toBe(true);
  });

  it("never marks anchor links active by path", () => {
    expect(isNavItemActive(link("/#contacto"), "/")).toBe(false);
    expect(isNavItemActive(link("/#faq"), "/#faq")).toBe(false);
  });

  it("still resolves active state for accent links (Tienda / Mi cuenta)", () => {
    expect(isNavItemActive(link("/tienda", true), "/tienda")).toBe(true);
    expect(isNavItemActive(link("/mi-cuenta", true), "/tienda")).toBe(false);
  });
});
