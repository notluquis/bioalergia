import { Building2, Info } from "lucide-react";
import { APP_VERSION, BUILD_TIMESTAMP } from "../../version";
import SettingsForm from "../../components/features/SettingsForm";

export default function GeneralSettingsPage() {
  const buildLabel = BUILD_TIMESTAMP
    ? new Date(BUILD_TIMESTAMP).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })
    : "Desconocido";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-base-content">Configuración General</h1>
        <p className="text-sm text-base-content/60">Información de la empresa y estado del sistema.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Company Info Card */}
        <div className="surface-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Empresa</h2>
              <p className="text-xs text-base-content/60">Datos de la organización</p>
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">Nombre de la Empresa</span>
            </label>
            <input type="text" className="input input-bordered" defaultValue="Bioalergia" disabled />
            <label className="label">
              <span className="label-text-alt text-warning">Contactar a soporte para cambiar</span>
            </label>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">RUT Empresa</span>
            </label>
            <input type="text" className="input input-bordered" defaultValue="76.123.456-7" disabled />
          </div>
        </div>

        {/* System Info Card */}
        <div className="surface-elevated rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center text-info">
              <Info size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">Sistema</h2>
              <p className="text-xs text-base-content/60">Información técnica</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-base-200/50 rounded-lg">
              <span className="text-sm font-medium">Versión</span>
              <span className="badge badge-ghost">v{APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-base-200/50 rounded-lg">
              <span className="text-sm font-medium">Build</span>
              <span className="badge badge-ghost">{buildLabel}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-base-200/50 rounded-lg">
              <span className="text-sm font-medium">Entorno</span>
              <span className="badge badge-success gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                Producción
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-base-200/50 rounded-lg">
              <span className="text-sm font-medium">Estado API</span>
              <span className="text-success text-sm font-bold">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Branding Settings */}
      <div className="surface-elevated rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-4">Identidad y Marca</h2>
        <SettingsForm />
      </div>
    </div>
  );
}
