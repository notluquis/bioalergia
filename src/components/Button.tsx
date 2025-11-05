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

  const mergedClassName = `${variantClasses[v]} ${sizeClasses[size]} ${className}`.trim();

  const Component: AsElement = (as as AsElement) ?? (href ? "a" : "button");

  // Build props to forward — include href when provided
  const forwardProps: Record<string, unknown> = { className: mergedClassName, ...(props as Record<string, unknown>) };
  if (href) forwardProps.href = href;

  return React.createElement(Component, forwardProps, children);
}
