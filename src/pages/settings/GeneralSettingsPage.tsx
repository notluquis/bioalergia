import SettingsForm from "../../components/features/SettingsForm";
import { useSettings } from "../../context/settings-context";

export default function GeneralSettingsPage() {
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      <section className="surface-elevated relative overflow-hidden p-6">
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex flex-1 flex-col gap-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide text-primary">
              Marca activa
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-base-content/60">Organización</p>
              <h2 className="text-2xl font-bold text-base-content drop-shadow-sm">{settings.orgName}</h2>
              {settings.tagline && <p className="text-sm text-base-content/70">{settings.tagline}</p>}
            </div>
            <dl className="grid gap-4 text-xs text-base-content/70 sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-base-content/60">Correo de soporte</dt>
                <dd className="text-base-content">{settings.supportEmail || "No definido"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-base-content/60">Teléfono</dt>
                <dd className="text-base-content">{settings.orgPhone || "No definido"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-base-content/60">Dirección</dt>
                <dd className="text-base-content">{settings.orgAddress || "No registrada"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-base-content/60">Moneda base</dt>
                <dd className="text-base-content">{settings.primaryCurrency || "Sin configurar"}</dd>
              </div>
            </dl>
          </div>
          <div className="surface-recessed flex w-full max-w-60 flex-col items-center gap-4 p-4 text-center">
            <div className="aspect-square w-24 overflow-hidden rounded-2xl border border-base-300 bg-base-200 p-2">
              <img src={settings.logoUrl} alt="Logo actual" className="brand-logo--settings" />
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-base-300 shadow bg-primary" />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-base-300 shadow bg-secondary" />
            </div>
            <p className="text-xs text-base-content/60">Visualiza cómo se combinan los colores y el logo.</p>
          </div>
        </div>
      </section>

      <SettingsForm />
    </div>
  );
}
