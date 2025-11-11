import React from "react";

type AsElement = string;

interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "sm" | "md" | "lg" | "xs";
  as?: AsElement;
  href?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

/**
 * Polymorphic Button across the dashboard.
 * Provides Apple-inspired geometry + motion, but allows overrides via `className`.
 */
export default function Button({ variant, size = "md", className = "", as, href, children, ...props }: ButtonProps) {
  const v = variant ?? "primary";
  const variantClasses: Record<string, string> = {
    primary:
      "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary via-primary/80 to-secondary/90 px-5 py-2 text-sm font-semibold tracking-wide text-white shadow-2xl border border-transparent",
    secondary:
      "inline-flex items-center justify-center rounded-2xl border border-base-200/60 bg-base-200/40 px-4 py-2 text-sm font-semibold tracking-wide text-base-content shadow-sm backdrop-blur-sm hover:border-base-200 hover:bg-base-100/60",
    ghost:
      "inline-flex items-center justify-center rounded-2xl bg-transparent px-3 py-2 text-sm font-semibold tracking-wide text-base-content/80 hover:text-base-content hover:bg-base-100/40",
    link: "inline-flex items-center justify-center text-sm font-semibold tracking-wide text-primary underline-offset-4 hover:underline",
  };

  const sizeClasses: Record<string, string> = {
    xs: "text-xs px-3 py-1.5",
    sm: "text-sm px-4 py-2",
    md: "text-sm px-5 py-2.5",
    lg: "text-base px-6 py-3",
  };

  const appleTransitions =
    "transition-transform duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 active:translate-y-0.5 focus-visible:ring focus-visible:ring-primary/40 focus-visible:outline-none";

  const mergedClassName = `${variantClasses[v]} ${sizeClasses[size]} ${appleTransitions} ${className}`.trim();
  const Component: AsElement = (as as AsElement) ?? (href ? "a" : "button");
  const forwardProps: Record<string, unknown> = { className: mergedClassName, ...(props as Record<string, unknown>) };
  if (href) forwardProps.href = href;

  return React.createElement(Component, forwardProps, children);
}
