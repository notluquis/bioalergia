export default {
  "*.{ts,tsx,js,jsx}": ["oxlint --fix --quiet --no-ignore"],
  "*.{ts,tsx,js,jsx,json,md,css,scss,html}": ["oxfmt --write"],
};
