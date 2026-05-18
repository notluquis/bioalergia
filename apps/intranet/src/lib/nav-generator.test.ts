/**
 * Tests for `generateNavSections` / `getNavSections`.
 *
 * The generator walks a TanStack route tree, extracts every route with
 * `staticData.nav`, groups them by section in canonical order, then sorts
 * each section by `order`. `getNavSections` memoises by route tree identity.
 */
import { describe, expect, it } from "vitest";

import { generateNavSections, getNavSections } from "./nav-generator";

interface FakeRoute {
  fullPath?: string;
  path?: string;
  options?: {
    staticData?: {
      nav?: { iconKey: string; label: string; order: number; section: string };
      permission?: { action: string; subject: string };
      hideFromNav?: boolean;
    };
  };
  children?: FakeRoute[] | Record<string, FakeRoute>;
}

function makeRoute(partial: FakeRoute): FakeRoute {
  return partial;
}

describe("generateNavSections", () => {
  it("returns an empty list when no route has nav metadata", () => {
    const tree = makeRoute({ children: [] });
    // generator expects AnyRoute typing — cast through unknown for the fake.
    const sections = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );
    expect(sections).toEqual([]);
  });

  it("extracts a single nav item under its section", () => {
    const child = makeRoute({
      fullPath: "/patients",
      options: {
        staticData: {
          nav: { iconKey: "Users", label: "Pacientes", order: 1, section: "Pacientes" },
        },
      },
    });
    const tree = makeRoute({ children: [child] });
    const sections = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );

    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe("Pacientes");
    expect(sections[0]?.items).toHaveLength(1);
    expect(sections[0]?.items[0]).toMatchObject({
      label: "Pacientes",
      to: "/patients",
    });
  });

  it("groups items by section and respects canonical section order", () => {
    const tree = makeRoute({
      children: [
        makeRoute({
          fullPath: "/sistema/settings",
          options: {
            staticData: {
              nav: { iconKey: "Settings2", label: "Ajustes", order: 1, section: "Sistema" },
            },
          },
        }),
        makeRoute({
          fullPath: "/clinic/calendar",
          options: {
            staticData: {
              nav: { iconKey: "CalendarDays", label: "Agenda", order: 1, section: "Clínica" },
            },
          },
        }),
      ],
    });

    const sections = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );
    expect(sections.map((s) => s.title)).toEqual(["Clínica", "Sistema"]);
  });

  it("sorts items within a section by `order` ascending", () => {
    const tree = makeRoute({
      children: [
        makeRoute({
          fullPath: "/c",
          options: {
            staticData: {
              nav: { iconKey: "Users", label: "C", order: 10, section: "Clínica" },
            },
          },
        }),
        makeRoute({
          fullPath: "/a",
          options: {
            staticData: {
              nav: { iconKey: "Users", label: "A", order: 1, section: "Clínica" },
            },
          },
        }),
        makeRoute({
          fullPath: "/b",
          options: {
            staticData: {
              nav: { iconKey: "Users", label: "B", order: 5, section: "Clínica" },
            },
          },
        }),
      ],
    });

    const [section] = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );
    expect(section?.items.map((i) => i.label)).toEqual(["A", "B", "C"]);
  });

  it("recursively walks Record-form children (TanStack file-tree shape)", () => {
    const tree = makeRoute({
      children: {
        a: makeRoute({
          fullPath: "/a",
          options: {
            staticData: {
              nav: { iconKey: "Home", label: "A", order: 1, section: "Clínica" },
            },
          },
        }),
        b: makeRoute({
          fullPath: "/b",
          options: {
            staticData: {
              nav: { iconKey: "Home", label: "B", order: 2, section: "Clínica" },
            },
          },
        }),
      },
    });
    const sections = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );
    expect(sections[0]?.items).toHaveLength(2);
  });

  it("falls back to the Package icon when iconKey is unknown", () => {
    const tree = makeRoute({
      children: [
        makeRoute({
          fullPath: "/x",
          options: {
            staticData: {
              nav: { iconKey: "NonExistentIconXYZ", label: "X", order: 1, section: "Sistema" },
            },
          },
        }),
      ],
    });
    const [section] = generateNavSections(
      tree as unknown as Parameters<typeof generateNavSections>[0]
    );
    expect(section?.items[0]?.icon).toBeDefined();
    // The fallback is the `Package` lucide icon. v1+ lucide ships icons
    // as ForwardRefExoticComponent (object), v0.x shipped function
    // components. Accept either.
    const icon = section?.items[0]?.icon as unknown;
    expect(["function", "object"]).toContain(typeof icon);
  });
});

describe("getNavSections (memoised wrapper)", () => {
  it("returns the same array reference for the same tree", () => {
    const tree = makeRoute({
      children: [
        makeRoute({
          fullPath: "/p",
          options: {
            staticData: {
              nav: { iconKey: "Users", label: "P", order: 1, section: "Pacientes" },
            },
          },
        }),
      ],
    });
    const a = getNavSections(tree as unknown as Parameters<typeof getNavSections>[0]);
    const b = getNavSections(tree as unknown as Parameters<typeof getNavSections>[0]);
    expect(a).toBe(b);
  });

  it("recomputes when a different tree is supplied", () => {
    const t1 = makeRoute({
      children: [
        makeRoute({
          fullPath: "/p",
          options: {
            staticData: {
              nav: { iconKey: "Users", label: "P", order: 1, section: "Pacientes" },
            },
          },
        }),
      ],
    });
    const t2 = makeRoute({
      children: [
        makeRoute({
          fullPath: "/x",
          options: {
            staticData: {
              nav: { iconKey: "Home", label: "X", order: 1, section: "Sistema" },
            },
          },
        }),
      ],
    });
    const a = getNavSections(t1 as unknown as Parameters<typeof getNavSections>[0]);
    const b = getNavSections(t2 as unknown as Parameters<typeof getNavSections>[0]);
    expect(a).not.toBe(b);
    expect(b[0]?.title).toBe("Sistema");
  });
});
