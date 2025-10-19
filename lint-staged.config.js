export default {
  "*.{ts,tsx,js,jsx}": ["eslint --max-warnings=0 --fix"],
  "*.{ts,tsx,js,jsx,json,md,css}": ["prettier --write --ignore-unknown"],
};
