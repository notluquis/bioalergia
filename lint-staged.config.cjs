module.exports = {
  "*.{ts,tsx,js,jsx,json,md,css,scss,html}": [
    "pnpm exec biome check --write --no-errors-on-unmatched",
  ],
};
