import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Building, Plus, Search, User } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { peopleQueries } from "@/features/people/api";
import { getPersonFullName, getPersonInitials } from "@/lib/person";
import { BADGE_SM, PAGE_CONTAINER } from "@/lib/styles";

export default function PersonManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: people } = useSuspenseQuery(peopleQueries.list());

  const filteredPeople = people.filter(
    (p) => (p.names?.toLowerCase() ?? "").includes(search.toLowerCase()) || (p.rut ?? "").includes(search)
  );

  return (
    <div className={PAGE_CONTAINER}>
      {/* Filters */}
      <div className="bg-base-100 flex items-center gap-4 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="text-base-content/40 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Buscar por nombre o RUT..."
            className="w-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Nueva Persona
        </Button>
      </div>

      {/* People List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPeople.length === 0 ? (
          <p className="text-base-content/40 col-span-full text-center">No se encontraron personas</p>
        ) : (
          filteredPeople.map((person) => (
            <div
              key={person.id}
              className="card bg-base-100 border-base-200 border shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="card-body p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="bg-base-200 text-base-content/60 flex w-10 items-center justify-center rounded-full">
                        <span className="text-xs font-bold">{getPersonInitials(person)}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base-content font-bold">{getPersonFullName(person)}</h3>
                      <p className="text-base-content/50 text-xs">{person.rut}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {person.user && (
                    <span className={`${BADGE_SM} badge-primary gap-1 text-white`}>
                      <User size={10} /> Usuario
                    </span>
                  )}
                  {person.employee && (
                    <span className={`${BADGE_SM} badge-secondary gap-1 text-white`}>
                      <Briefcase size={10} /> Empleado
                    </span>
                  )}
                  {person.counterpart && (
                    <span className={`${BADGE_SM} badge-accent gap-1 text-white`}>
                      <Building size={10} /> Contraparte
                    </span>
                  )}
                  {!person.user && !person.employee && !person.counterpart && (
                    <span className={`${BADGE_SM} badge-ghost`}>Sin roles</span>
                  )}
                </div>

                <div className="border-base-200 mt-4 flex justify-end border-t pt-4">
                  <Button variant="ghost" size="xs" onClick={() => navigate({ to: `/settings/people/${person.id}` })}>
                    Ver Detalles
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
