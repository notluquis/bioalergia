import { Chip } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Building, Plus, Search, User } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { peopleQueries } from "@/features/people/api";
import { getPersonFullName, getPersonInitials } from "@/lib/person";
import { PAGE_CONTAINER } from "@/lib/styles";

export default function PersonManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: people } = useSuspenseQuery(peopleQueries.list());

  const filteredPeople = people.filter(
    (p) =>
      (p.names?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (p.rut ?? "").includes(search),
  );

  return (
    <div className={PAGE_CONTAINER}>
      {/* Filters */}
      <div className="bg-background flex items-center gap-4 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="text-default-300 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="w-full pl-9"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Buscar por nombre o RUT..."
            type="text"
            value={search}
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
          <p className="text-default-300 col-span-full text-center">
            No se encontraron personas
          </p>
        ) : (
          filteredPeople.map((person) => (
            <div
              className="card bg-background border-default-100 border shadow-sm transition-shadow hover:shadow-md"
              key={person.id}
            >
              <div className="card-body p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                      <div className="bg-default-50 text-default-500 flex w-10 items-center justify-center rounded-full">
                        <span className="text-xs font-bold">{getPersonInitials(person)}</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-foreground font-bold">{getPersonFullName(person)}</h3>
                      <p className="text-default-400 text-xs">{person.rut}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {person.user && (
                    <Chip className="gap-1 text-white" color="accent" size="sm" variant="primary">
                      <User size={10} /> Usuario
                    </Chip>
                  )}
                  {person.employee && (
                    <Chip className="gap-1 text-white" color="danger" size="sm" variant="primary">
                      <Briefcase size={10} /> Empleado
                    </Chip>
                  )}
                  {person.counterpart && (
                    <Chip className="gap-1 text-white" color="success" size="sm" variant="primary">
                      <Building size={10} /> Contraparte
                    </Chip>
                  )}
                  {!person.user && !person.employee && !person.counterpart && (
                    <Chip size="sm" variant="secondary">
                      Sin roles
                    </Chip>
                  )}
                </div>

                <div className="border-default-100 mt-4 flex justify-end border-t pt-4">
                  <Button
                    onClick={() => navigate({ to: `/settings/people/${person.id}` })}
                    size="xs"
                    variant="ghost"
                  >
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
