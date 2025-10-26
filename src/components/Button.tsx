import React from "react";
import { Button as FlowbiteButton } from "flowbite-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg" | "xs";
}

/**
 * Thin wrapper around flowbite-react Button so we can swap implementations easily.
 * Keeps a similar API to the previous Button component (variant/size/className/support for native button props).
 */
export default function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  // Map our variant/size to Tailwind classes so branding is preserved.
  const variantClasses: Record<string, string> = {
    primary: "bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary)]/90",
    secondary: "bg-white text-slate-700 border border-white/60 hover:bg-white/80",
  };

  const sizeClasses: Record<string, string> = {
    xs: "px-2.5 py-1 text-xs",
    sm: "px-3.5 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-[1.75rem] py-3 text-base",
  };

  const mergedClassName = `${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();

  // flowbite-react's Button accepts className and native props; forward props using the component's prop types.
  return (
    <FlowbiteButton className={mergedClassName} {...(props as React.ComponentProps<typeof FlowbiteButton>)}>
      {children}
    </FlowbiteButton>
  );
}
