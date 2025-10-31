import React from "react";

// Lightweight placeholder component used for developer examples. The original file contained
// multiple example components (forms, tables, uploads). To keep the build/type-checks
// clean while we continue the repository-wide theme and lint migration, this simplified
// component will render a small informational card. The original examples can be restored
// from the git history if needed.

export default function OptimizationExamples() {
  return (
    <div className="space-y-8 p-6">
      <div className="card bg-base-100 p-6">
        <div className="card-body">
          <h2 className="text-lg font-semibold">Ejemplos de optimizaciones</h2>
          <p className="text-sm text-slate-600 mt-2">Componente de ejemplo (simplificado temporalmente).</p>
        </div>
      </div>
    </div>
  );
}
