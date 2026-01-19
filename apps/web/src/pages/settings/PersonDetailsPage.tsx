import { skipToken, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowLeft, Briefcase, Building, Calendar, Mail, MapPin, Phone, User } from "lucide-react";

import { personKeys } from "@/features/people/queries";
import { getPersonFullName, getPersonInitials } from "@/lib/person";

export default function PersonDetailsPage() {
  const { id } = useParams({ from: "/_authed/settings/people/$id" });
  const navigate = useNavigate();

  const { data: person, isLoading } = useQuery(
    id ? personKeys.detail(id) : { queryFn: skipToken, queryKey: ["person-skip"] },
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="btn btn-ghost btn-sm gap-2"
          onClick={() => navigate({ to: "/settings/people" })}
        >
          <ArrowLeft size={16} />
          Volver
        </button>
        <div className="alert alert-warning">No se encontró la persona.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-2"
        onClick={() => navigate({ to: "/settings/people" })}
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info Card */}
        <div className="card bg-base-100 shadow-sm md:col-span-2">
          <div className="card-body">
            <div className="flex items-start gap-6">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content flex w-24 items-center justify-center rounded-full text-3xl">
                  <span>{getPersonInitials(person)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">{getPersonFullName(person)}</h2>
                <div className="text-base-content/70 flex items-center gap-2">
                  <span className="badge badge-ghost">{person.rut}</span>
                  {person.gender && <span className="badge badge-ghost">{person.gender}</span>}
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="bg-base-200 text-base-content/70 rounded-lg p-2">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-base-content/50 text-xs">Email</p>
                  <p className="font-medium">{person.email ?? "No registrado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-base-200 text-base-content/70 rounded-lg p-2">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-base-content/50 text-xs">Teléfono</p>
                  <p className="font-medium">{person.phone ?? "No registrado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-base-200 text-base-content/70 rounded-lg p-2">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-base-content/50 text-xs">Dirección</p>
                  <p className="font-medium">{person.address ?? "No registrada"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-base-200 text-base-content/70 rounded-lg p-2">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-base-content/50 text-xs">Fecha de Nacimiento</p>
                  <p className="font-medium">
                    {person.birthDate
                      ? dayjs(person.birthDate).format("DD MMM YYYY")
                      : "No registrada"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roles Card */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h3 className="card-title text-lg">Roles Activos</h3>
              <div className="mt-2 space-y-3">
                {person.user ? (
                  <div className="bg-primary/10 text-primary flex items-center gap-3 rounded-xl p-3">
                    <User size={20} />
                    <div>
                      <p className="text-sm font-bold">Usuario del Sistema</p>
                      <p className="text-xs opacity-70">{person.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-base-200 flex items-center gap-3 rounded-xl p-3 opacity-50">
                    <User size={20} />
                    <p className="text-sm font-medium">No es usuario</p>
                  </div>
                )}

                {person.employee ? (
                  <div className="bg-secondary/10 text-secondary flex items-center gap-3 rounded-xl p-3">
                    <Briefcase size={20} />
                    <div>
                      <p className="text-sm font-bold">Empleado</p>
                      <p className="text-xs opacity-70">{person.employee.position}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-base-200 flex items-center gap-3 rounded-xl p-3 opacity-50">
                    <Briefcase size={20} />
                    <p className="text-sm font-medium">No es empleado</p>
                  </div>
                )}

                {person.counterpart ? (
                  <div className="bg-accent/10 text-accent flex items-center gap-3 rounded-xl p-3">
                    <Building size={20} />
                    <div>
                      <p className="text-sm font-bold">Contraparte</p>
                      <p className="text-xs opacity-70">{person.counterpart.institution?.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-base-200 flex items-center gap-3 rounded-xl p-3 opacity-50">
                    <Building size={20} />
                    <p className="text-sm font-medium">No es contraparte</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
