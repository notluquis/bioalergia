import React from "react";
import { useLocation, useNavigation, useNavigate } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import ThemeToggle from "../ui/ThemeToggle";
import ConnectionIndicator from "../features/ConnectionIndicator";

const TITLES: Record<string, string> = {
  "/": "Panel financiero",
  // Finanzas
  "/finanzas/movements": "Movimientos registrados",
  "/finanzas/balances": "Saldos diarios",
  "/finanzas/counterparts": "Contrapartes",
  "/finanzas/participants": "Participantes",
  "/finanzas/loans": "Préstamos y créditos",
  // Servicios
  "/services": "Servicios recurrentes",
  "/services/agenda": "Agenda de servicios",
  "/services/create": "Crear servicio",
  "/services/templates": "Plantillas de servicios",
  // Calendario
  "/calendar/summary": "Eventos de calendario",
  "/calendar/schedule": "Calendario interactivo",
  "/calendar/daily": "Detalle diario",
  "/calendar/heatmap": "Mapa de calor",
  "/calendar/classify": "Clasificar eventos",
  "/calendar/history": "Historial de sincronización",
  // Operaciones (Inventario + RRHH)
  "/inventory/items": "Gestión de Inventario",
  "/inventory/supplies": "Solicitud de Insumos",
  "/hr/employees": "Trabajadores",
  "/hr/timesheets": "Horas y pagos",
  "/hr/audit": "Auditoría de horarios",
  // Settings
  "/settings": "Configuración",
  "/settings/general": "Identidad y marca",
  "/settings/accesos": "Accesos y conexiones",
  "/settings/inventario": "Parámetros de inventario",
  "/settings/roles": "Roles y permisos",
  "/settings/balances-diarios": "Balance diario de prestaciones",
};

export default function Header() {
  const location = useLocation();
  const navigationState = useNavigation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isNavigating = navigationState.state === "loading";

  const title = React.useMemo(() => {
    if (/^\/services\/.+\/edit$/.test(location.pathname)) {
      return "Editar servicio";
    }
    return TITLES[location.pathname] ?? "Bioalergia Finanzas";
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="surface-elevated flex items-center justify-between rounded-3xl px-6 py-4 shadow-md">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-base-content drop-shadow-sm">{title}</h1>
        {isNavigating && (
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando...
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <ConnectionIndicator />
        <Button
          variant="ghost"
          className="btn-circle border border-base-300/60 text-base-content hover:border-primary/60 hover:text-primary"
          onClick={handleLogout}
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
