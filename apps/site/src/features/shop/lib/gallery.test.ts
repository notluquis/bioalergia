import { describe, expect, it } from "vitest";

import { relatedProducts, sortGalleryImages } from "./gallery";

describe("sortGalleryImages", () => {
  it("returns an empty array for no images", () => {
    expect(sortGalleryImages([])).toEqual([]);
  });

  it("moves primary images before non-primary ones", () => {
    const imgs = [
      { id: 1, is_primary: false },
      { id: 2, is_primary: true },
      { id: 3, is_primary: false },
    ];
    expect(sortGalleryImages(imgs).map((i) => i.id)).toEqual([2, 1, 3]);
  });

  it("does not mutate the input array", () => {
    const imgs = [
      { id: 1, is_primary: false },
      { id: 2, is_primary: true },
    ];
    sortGalleryImages(imgs);
    expect(imgs.map((i) => i.id)).toEqual([1, 2]);
  });

  it("keeps order when all are non-primary", () => {
    const imgs = [
      { id: 1, is_primary: false },
      { id: 2, is_primary: false },
    ];
    expect(sortGalleryImages(imgs).map((i) => i.id)).toEqual([1, 2]);
  });
});

describe("relatedProducts", () => {
  it("excludes the product with the given id", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(relatedProducts(items, 2).map((p) => p.id)).toEqual([1, 3]);
  });

  it("caps the result at four products", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];
    expect(relatedProducts(items, 99).map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it("excludes then caps (four remaining after exclusion)", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    expect(relatedProducts(items, 1).map((p) => p.id)).toEqual([2, 3, 4, 5]);
  });

  it("returns an empty array for no items", () => {
    expect(relatedProducts([], 1)).toEqual([]);
  });
});
