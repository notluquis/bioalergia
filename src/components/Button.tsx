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
 * Polymorphic project Button primitive.
 * - `as` allows rendering as 'a', 'label', etc.
 * - `href` is forwarded when rendering anchors.
 * - Apple-like smooth transitions and subtle scale effects
 * Keeps variant/size API and preserves existing className overrides.
 */
export default function Button({ variant, size = "md", className = "", as, href, children, ...props }: ButtonProps) {
  const v = variant ?? "primary";
  const variantClasses: Record<string, string> = {
    primary: "btn btn-primary",
    secondary: "btn btn-ghost",
    ghost: "btn btn-ghost",
    link: "btn btn-link",
  };

  const sizeClasses: Record<string, string> = {
    xs: "btn-xs",
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
  };

  // Apple-like transitions: smooth scale on hover/active, shadow lift
  const appleTransitions =
    "transition-all duration-[var(--duration-quick)] ease-[var(--ease-apple)] hover:scale-[1.02] active:scale-[0.98]";

  const mergedClassName = `${variantClasses[v]} ${sizeClasses[size]} ${appleTransitions} ${className}`.trim();

  const Component: AsElement = (as as AsElement) ?? (href ? "a" : "button");

  // Build props to forward — include href when provided
  const forwardProps: Record<string, unknown> = { className: mergedClassName, ...(props as Record<string, unknown>) };
  if (href) forwardProps.href = href;

  return React.createElement(Component, forwardProps, children);
}
