/**
 * Card Component - Adapter for HeroUI Card
 */
import { Card as HeroCard } from "@heroui/react";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// Card Shell
const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <HeroCard
      className={cn("border-default-100 border shadow-sm", className)}
      ref={ref}
      {...props}
    />
  ),
);
Card.displayName = "Card";

// Card Header
const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <HeroCard.Header
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      ref={ref}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

// Card Title (Keeping as h3, HeroUI allows composition)
const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      className={cn("text-lg leading-none font-semibold tracking-tight", className)}
      ref={ref}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

// Card Description
const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p className={cn("text-default-500 text-sm", className)} ref={ref} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

// Card Content -> Maps to HeroCard.Content (based on examples) or Card.Body.
// Examples show Card.Content, but generic HeroUI pattern is CardBody.
// We'll trust the checked examples: Card.Content.
const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <HeroCard.Content className={cn("p-6 pt-0", className)} ref={ref} {...props} />
  ),
);
CardContent.displayName = "CardContent";

// Card Footer
const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <HeroCard.Footer className={cn("flex items-center p-6 pt-0", className)} ref={ref} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
