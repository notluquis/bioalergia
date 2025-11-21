import React from "react";
import { cn } from "@/lib/utils";

type AsElement = React.ElementType;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "link" | "outline" | "error" | "success";
  size?: "sm" | "md" | "lg" | "xs";
  as?: AsElement;
  href?: string;
  isLoading?: boolean;
}

/**
 * Polymorphic Button component.
 * Uses DaisyUI classes + custom Apple-like design tokens.
 */
export default function Button({
  variant = "primary",
  size = "md",
  className,
  as,
  href,
  children,
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  const Component = as || (href ? "a" : "button");

  const baseClasses = "btn no-animation transition-all duration-200 ease-apple font-medium tracking-wide";

  const variantClasses = {
    primary: "btn-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 border-transparent",
    secondary: "btn-secondary text-secondary-content shadow-sm hover:bg-secondary/80 border-transparent",
    ghost: "btn-ghost hover:bg-base-content/10",
    link: "btn-link text-primary underline-offset-4 hover:text-primary/80",
    outline:
      "btn-outline border-base-content/20 hover:bg-base-content/5 hover:border-base-content/40 text-base-content",
    error: "btn-error text-white shadow-sm shadow-error/20",
    success: "btn-success text-white shadow-sm shadow-success/20",
  };

  const sizeClasses = {
    xs: "btn-xs px-3 text-xs rounded-lg",
    sm: "btn-sm px-4 text-sm rounded-xl",
    md: "btn-md px-6 text-[15px] rounded-2xl",
    lg: "btn-lg px-8 text-lg rounded-3xl",
  };

  // Apple-like specific overrides
  const appleEffects = "active:scale-[0.97] hover:-translate-y-[1px]";

  return (
    <Component
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        !isLoading && !disabled && appleEffects,
        isLoading && "cursor-wait opacity-80",
        className
      )}
      href={href}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="loading loading-spinner loading-sm mr-2"></span>}
      {children}
    </Component>
  );
}
