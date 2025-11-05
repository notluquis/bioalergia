import React from "react";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Section title
   */
  title?: string;
  /**
   * Optional description below title
   */
  description?: string;
  /**
   * Action buttons for section header
   */
  actions?: React.ReactNode;
}

/**
 * Section - Semantic section wrapper with optional title/description
 */
export default function Section({ title, description, actions, children, className = "", ...props }: SectionProps) {
  return (
    <section className={`space-y-6 ${className}`.trim()} {...props}>
      {(title || description || actions) && (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold text-primary leading-7">{title}</h2>}
            {description && <p className="text-xs text-base-content/90 leading-5">{description}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </header>
      )}

      {children}
    </section>
  );
}
