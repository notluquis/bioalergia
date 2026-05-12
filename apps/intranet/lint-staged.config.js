import path from "node:path";

const IGNORED = [/\/routeTree\.gen\.ts$/, /\/dist\//, /\/\.turbo\//];

const filterLintable = (files) => files.filter((f) => !IGNORED.some((re) => re.test(f)));

export default {
  "*.{ts,tsx,js,jsx}": (files) => {
    const targets = filterLintable(files);
    if (targets.length === 0) return [];
    return [
      `oxlint --fix --quiet ${targets.map((f) => path.relative(process.cwd(), f)).join(" ")}`,
    ];
  },
  "*.{ts,tsx,js,jsx,json,md,css,scss,html}": (files) => {
    const targets = filterLintable(files);
    if (targets.length === 0) return [];
    return [`oxfmt --write ${targets.map((f) => path.relative(process.cwd(), f)).join(" ")}`];
  },
};
