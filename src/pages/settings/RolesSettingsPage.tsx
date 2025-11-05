import RoleMappingManager from "../../features/roles/components/RoleMappingManager";

export default function RolesSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="bg-base-100 space-y-2 p-6">
        <h2 className="text-lg font-semibold text-primary drop-shadow-sm">Permisos y accesos</h2>
        <p className="text-sm text-base-content/90">
          Define qué puede ver cada cargo dentro de la plataforma para mantener el control de la información sensible.
        </p>
      </section>

      <RoleMappingManager />
    </div>
  );
}
