import SettingsForm from "../../components/SettingsForm";
import { useSettings } from "../../context/settings-context";

export default function GeneralSettingsPage() {
  const { settings } = useSettings();

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/80 p-6 shadow-[0_24px_60px_-36px_rgba(14,100,183,0.45)]">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb)/0.14), rgba(var(--brand-secondary-rgb)/0.21))`,
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex flex-1 flex-col gap-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/75 px-4 py-2 text-xs font-semibold tracking-wide text-[var(--brand-primary)]">
              Marca activa
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500/80">Organización</p>
              <h2 className="text-2xl font-bold text-slate-800 drop-shadow-sm">{settings.orgName}</h2>
              {settings.tagline && <p className="text-sm text-slate-600/90">{settings.tagline}</p>}
            </div>
            <dl className="grid gap-4 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">Correo de soporte</dt>
                <dd className="text-slate-700">{settings.supportEmail || "No definido"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">Teléfono</dt>
                <dd className="text-slate-700">{settings.orgPhone || "No definido"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">Dirección</dt>
                <dd className="text-slate-700">{settings.orgAddress || "No registrada"}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-slate-500">Moneda base</dt>
                <dd className="text-slate-700">{settings.primaryCurrency || "Sin configurar"}</dd>
              </div>
            </dl>
          </div>
          <div className="flex w-full max-w-[240px] flex-col items-center gap-4 rounded-2xl border border-white/50 bg-white/75 p-4 text-center shadow-inner">
            <div className="aspect-square w-24 overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-2">
              <img src={settings.logoUrl} alt="Logo actual" className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 shadow bg-[var(--brand-primary)]" />
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 shadow bg-[var(--brand-secondary)]" />
            </div>
            <p className="text-[11px] text-slate-500">Visualiza cómo se combinan los colores y el logo.</p>
          </div>
        </div>
      </section>

      <SettingsForm />
    </div>
  );
}
