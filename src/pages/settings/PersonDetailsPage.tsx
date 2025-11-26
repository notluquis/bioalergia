import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Building, Briefcase } from "lucide-react";
import dayjs from "dayjs";
import PageLoader from "../../components/ui/PageLoader";

export default function PersonDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: person,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["person", id],
    queryFn: async () => {
      const res = await fetch(`/api/people/${id}`);
      if (!res.ok) throw new Error("Failed to fetch person details");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) return <PageLoader />;
  if (error || !person)
    return (
      <div className="p-6 text-center">
        <p className="text-error">Error al cargar los detalles de la persona.</p>
        <button className="btn btn-ghost mt-4" onClick={() => navigate("/settings/people")}>
          <ArrowLeft className="mr-2" /> Volver
        </button>
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button className="btn btn-ghost btn-circle" onClick={() => navigate("/settings/people")}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-base-content">Detalles de Persona</h1>
          <p className="text-sm text-base-content/60">Información completa y relaciones.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info Card */}
        <div className="card bg-base-100 shadow-sm md:col-span-2">
          <div className="card-body">
            <div className="flex items-start gap-6">
              <div className="avatar placeholder">
                <div className="w-24 rounded-full bg-primary text-primary-content text-3xl flex items-center justify-center">
                  <span>{person.names.substring(0, 2).toUpperCase()}</span>
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">
                  {person.names} {person.fatherName} {person.motherName}
                </h2>
                <div className="flex items-center gap-2 text-base-content/70">
                  <span className="badge badge-ghost">{person.rut}</span>
                  {person.gender && <span className="badge badge-ghost">{person.gender}</span>}
                </div>
              </div>
            </div>

            <div className="divider" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-base-200 text-base-content/70">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-xs text-base-content/50">Email</p>
                  <p className="font-medium">{person.email || "No registrado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-base-200 text-base-content/70">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-xs text-base-content/50">Teléfono</p>
                  <p className="font-medium">{person.phone || "No registrado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-base-200 text-base-content/70">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-xs text-base-content/50">Dirección</p>
                  <p className="font-medium">{person.address || "No registrada"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-base-200 text-base-content/70">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-xs text-base-content/50">Fecha de Nacimiento</p>
                  <p className="font-medium">
                    {person.birthDate ? dayjs(person.birthDate).format("DD MMM YYYY") : "No registrada"}
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
              <div className="space-y-3 mt-2">
                {person.user ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 text-primary">
                    <User size={20} />
                    <div>
                      <p className="font-bold text-sm">Usuario del Sistema</p>
                      <p className="text-xs opacity-70">{person.user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 opacity-50">
                    <User size={20} />
                    <p className="text-sm font-medium">No es usuario</p>
                  </div>
                )}

                {person.employee ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 text-secondary">
                    <Briefcase size={20} />
                    <div>
                      <p className="font-bold text-sm">Empleado</p>
                      <p className="text-xs opacity-70">{person.employee.position}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 opacity-50">
                    <Briefcase size={20} />
                    <p className="text-sm font-medium">No es empleado</p>
                  </div>
                )}

                {person.counterpart ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 text-accent">
                    <Building size={20} />
                    <div>
                      <p className="font-bold text-sm">Contraparte</p>
                      <p className="text-xs opacity-70">{person.counterpart.institution?.name}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-base-200 opacity-50">
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
