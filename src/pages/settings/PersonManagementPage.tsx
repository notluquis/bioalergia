import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, User, Briefcase, Building } from "lucide-react";

import type { Person } from "@/types/schema";

import { useNavigate } from "react-router-dom";

export default function PersonManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: people, isLoading } = useQuery<Person[]>({
    queryKey: ["people", "list"],
    queryFn: async () => {
      const res = await fetch("/api/people");
      if (!res.ok) throw new Error("Failed to fetch people");
      return res.json();
    },
  });

  const filteredPeople =
    people?.filter(
      (p) => (p.names?.toLowerCase() ?? "").includes(search.toLowerCase()) || (p.rut ?? "").includes(search)
    ) || [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Personas</h1>
          <p className="text-base-content/60">Base de datos central de personas y entidades.</p>
        </div>
        <button className="btn btn-primary gap-2">
          <Plus size={18} />
          Nueva Persona
        </button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-4 rounded-2xl bg-base-100 p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Buscar por nombre o RUT..."
            className="input input-sm w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* People List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="col-span-full text-center text-base-content/40">Cargando personas...</p>
        ) : filteredPeople.length === 0 ? (
          <p className="col-span-full text-center text-base-content/40">No se encontraron personas</p>
        ) : (
          filteredPeople.map((person) => (
            <div
              key={person.id}
              className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow border border-base-200"
            >
              <div className="card-body p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="w-10 rounded-full bg-base-200 text-base-content/60 flex items-center justify-center">
                        <span className="text-xs font-bold">{person.names.substring(0, 2).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-base-content">
                        {person.names} {person.fatherName}
                      </h3>
                      <p className="text-xs text-base-content/50">{person.rut}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {person.user && (
                    <span className="badge badge-sm badge-primary gap-1 text-white">
                      <User size={10} /> Usuario
                    </span>
                  )}
                  {person.employee && (
                    <span className="badge badge-sm badge-secondary gap-1 text-white">
                      <Briefcase size={10} /> Empleado
                    </span>
                  )}
                  {person.counterpart && (
                    <span className="badge badge-sm badge-accent gap-1 text-white">
                      <Building size={10} /> Contraparte
                    </span>
                  )}
                  {!person.user && !person.employee && !person.counterpart && (
                    <span className="badge badge-sm badge-ghost">Sin roles</span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-base-200 flex justify-end">
                  <button className="btn btn-xs btn-ghost" onClick={() => navigate(`/settings/people/${person.id}`)}>
                    Ver Detalles
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
