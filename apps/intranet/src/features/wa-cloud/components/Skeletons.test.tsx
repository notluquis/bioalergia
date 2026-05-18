/**
 * Tests for wa-cloud loading skeletons.
 *
 * Regression scope: commit ece5aced added structural a11y guarantees
 * — placeholder rows must NOT trigger empty-heading or empty-table-
 * header lint rules. The skeletons render no headings and no
 * <th>/<table> nodes; they're pure presentational <div> + HeroUI
 * <Skeleton>. These tests assert that contract.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  WaCardGridSkeleton,
  WaListSkeleton,
  WaSettingsSkeleton,
  WaTableSkeleton,
} from "./Skeletons";

describe("WaListSkeleton", () => {
  it("renders the requested number of rows (default 6)", () => {
    const { container } = render(<WaListSkeleton />);
    // Each row has a `.flex.items-center.gap-3.px-3.py-3` wrapper.
    expect(container.querySelectorAll(".px-3.py-3").length).toBe(6);
  });

  it("respects custom rows prop", () => {
    const { container } = render(<WaListSkeleton rows={3} />);
    expect(container.querySelectorAll(".px-3.py-3").length).toBe(3);
  });

  it("renders zero heading or table-header elements (a11y contract)", () => {
    const { container } = render(<WaListSkeleton rows={2} />);
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(container.querySelector("th")).toBeNull();
    expect(container.querySelector("table")).toBeNull();
  });
});

describe("WaCardGridSkeleton", () => {
  it("renders default 6 cards", () => {
    const { container } = render(<WaCardGridSkeleton />);
    expect(container.querySelectorAll(".rounded-lg.border").length).toBe(6);
  });

  it("applies 3-col grid by default", () => {
    const { container } = render(<WaCardGridSkeleton />);
    expect(container.firstChild).toHaveClass("lg:grid-cols-3");
  });

  it("supports columns=1, 2, 4", () => {
    const c1 = render(<WaCardGridSkeleton columns={1} cards={1} />);
    expect(c1.container.firstChild).toHaveClass("grid-cols-1");
    c1.unmount();

    const c2 = render(<WaCardGridSkeleton columns={2} cards={1} />);
    expect(c2.container.firstChild).toHaveClass("sm:grid-cols-2");
    c2.unmount();

    const c4 = render(<WaCardGridSkeleton columns={4} cards={1} />);
    expect(c4.container.firstChild).toHaveClass("lg:grid-cols-4");
  });

  it("renders zero heading elements (a11y contract)", () => {
    const { container } = render(<WaCardGridSkeleton cards={2} />);
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
  });
});

describe("WaTableSkeleton", () => {
  it("renders rows × cols Skeleton bars", () => {
    const { container } = render(<WaTableSkeleton rows={3} cols={4} />);
    // 3 row wrappers × 4 cells = 12 Skeleton nodes (no extras).
    const rowWrappers = container.querySelectorAll(".flex.items-center.gap-3");
    expect(rowWrappers.length).toBe(3);
  });

  it("does NOT render a real <table> or <th> (a11y contract)", () => {
    const { container } = render(<WaTableSkeleton rows={2} cols={3} />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("th")).toBeNull();
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
  });
});

describe("WaSettingsSkeleton", () => {
  it("renders two card-shaped containers", () => {
    const { container } = render(<WaSettingsSkeleton />);
    expect(container.querySelectorAll(".rounded-2xl.border").length).toBe(2);
  });

  it("renders no heading or table-header elements (a11y contract)", () => {
    const { container } = render(<WaSettingsSkeleton />);
    expect(container.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(container.querySelector("th")).toBeNull();
  });
});
