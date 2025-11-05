## PostCSS / daisyUI / Tailwind warnings seen during build

During production builds you may see PostCSS warnings such as:

- Unknown at rule: `@property`
- Complex selectors in `:is()` cannot be transformed to an equivalent selector
- Handling of `revert-layer` is unsupported by this PostCSS plugin and will cause style differences between browser versions

These originate from third-party vendor CSS shipped by Tailwind / DaisyUI and some modern CSS features that PostCSS (and the project's PostCSS plugins) do not fully transform.

Options to address or reduce the warnings:

1) Accept them as informational (recommended short-term)
   - The warnings are non-blocking and don't stop the build.
   - They originate in vendor CSS and often don't affect runtime behaviour in modern browsers.

2) Upgrade toolchain (medium effort)
   - Upgrade `tailwindcss` and `postcss`/`postcss-preset-env` to versions that better support these features.
   - Upgrade `daisyui` if a newer version avoids use of `@property` or newer CSS features.

3) Add a stricter PostCSS config (low-medium effort)
   - Adjust `postcss.config.cjs` to control `postcss-preset-env` feature flags.
   - Example: set `stage` or disable specific transforms; however, this may not remove all warnings.

4) Vendor-fix (higher effort)
   - Fork or patch the specific vendor CSS files (not recommended unless you maintain a fork).

Summary recommendation
- Leave as-is for now (non-blocking). If you want to fully silence these warnings for CI cleanliness, plan a short upgrade of `postcss`/`tailwindcss`/`daisyui` in a separate PR and validate UI in browsers.
