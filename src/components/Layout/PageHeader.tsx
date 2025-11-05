import React from "react";

interface PageHeaderProps {
  /**
   * Page title
   */
  title: string;
  /**
   * Optional subtitle/description
   */
  description?: string;
  /**
   * Action buttons (e.g., "Create", "Export")
   */
  actions?: React.ReactNode;
  /**
   * Breadcrumbs or back navigation
   */
  breadcrumbs?: React.ReactNode;
}

/**
 * PageHeader - Standardized page header with title, description, and actions
 * Mobile: stacks vertically
 * Desktop: horizontal layout with actions aligned right
 */
export default function PageHeader({ title, description, actions, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:gap-6">
      {breadcrumbs && <div className="text-sm">{breadcrumbs}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary leading-8">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-base-content/70 leading-6">{description}</p>}
        </div>

        {actions && <div className="flex flex-wrap gap-2 sm:gap-4">{actions}</div>}
      </div>
    </header>
  );
}
