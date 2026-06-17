// Pure education-topic grouping, extracted from routes/aprende/index.tsx so it
// is unit-testable without a React renderer. Behavior is byte-identical to the
// original inline `groupedTopics` expression.

/** Minimal structural shape grouping depends on — a topic with a category. */
export type Categorized<C> = { category: C };

export type TopicGroup<C, T> = { category: C; topics: T[] };

/**
 * Groups `topics` by category following `categoryOrder`, dropping any category
 * with no matching topics. Mirrors
 * `CATEGORY_ORDER.map((category) => ({ category, topics: educationTopics.filter(...) })).filter((g) => g.topics.length > 0)`.
 */
export function groupTopicsByCategory<C, T extends Categorized<C>>(
  topics: readonly T[],
  categoryOrder: readonly C[]
): TopicGroup<C, T>[] {
  return categoryOrder
    .map((category) => ({
      category,
      topics: topics.filter((topic) => topic.category === category),
    }))
    .filter((group) => group.topics.length > 0);
}
