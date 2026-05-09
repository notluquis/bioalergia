declare module "talisman/metrics/jaro-winkler.js" {
  /**
   * Returns the Jaro-Winkler similarity score between two strings.
   * Range: 0 (no similarity) – 1 (identical).
   */
  function jaroWinkler(a: string, b: string): number;
  export default jaroWinkler;
}

declare module "talisman/metrics/monge-elkan.js" {
  /**
   * Monge-Elkan similarity.
   *
   * @param similarity - Inner similarity function applied to element pairs.
   * @param source     - Source token array.
   * @param target     - Target token array.
   * @returns          Asymmetric Monge-Elkan score in [0, 1].
   */
  function mongeElkan(
    similarity: (a: string, b: string) => number,
    source: string[],
    target: string[],
  ): number;

  /**
   * Symmetric variant: average of mongeElkan(a,b) and mongeElkan(b,a).
   */
  function symmetric(
    similarity: (a: string, b: string) => number,
    source: string[],
    target: string[],
  ): number;

  export default mongeElkan;
  export { symmetric };
}
