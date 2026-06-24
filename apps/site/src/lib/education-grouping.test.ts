import { describe, expect, it } from "vitest";

import { groupTopicsByCategory } from "./education-grouping";

type Topic = { slug: string; category: string };

const topics: Topic[] = [
  { slug: "a", category: "Respiratoria" },
  { slug: "b", category: "Piel" },
  { slug: "c", category: "Respiratoria" },
];

describe("groupTopicsByCategory", () => {
  it("groups topics by category following the given order", () => {
    const order = ["Respiratoria", "Piel"];
    expect(groupTopicsByCategory(topics, order)).toEqual([
      { category: "Respiratoria", topics: [topics[0], topics[2]] },
      { category: "Piel", topics: [topics[1]] },
    ]);
  });

  it("drops categories with no matching topics", () => {
    const order = ["Respiratoria", "Alimentaria", "Piel"];
    const result = groupTopicsByCategory(topics, order);
    expect(result.map((g) => g.category)).toEqual(["Respiratoria", "Piel"]);
  });

  it("respects category order even when it differs from topic order", () => {
    const order = ["Piel", "Respiratoria"];
    expect(groupTopicsByCategory(topics, order).map((g) => g.category)).toEqual([
      "Piel",
      "Respiratoria",
    ]);
  });

  it("returns an empty array when no topics match any category", () => {
    expect(groupTopicsByCategory(topics, ["Ocular"])).toEqual([]);
  });

  it("returns an empty array for empty inputs", () => {
    expect(groupTopicsByCategory([], ["Respiratoria"])).toEqual([]);
  });
});
