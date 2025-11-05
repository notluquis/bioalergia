import { useAuth } from "../context/AuthContext";
import TransactionUploadForm from "../features/transactions/components/TransactionUploadForm";
import PayoutUploadForm from "../features/transactions/components/PayoutUploadForm";
import Alert from "../components/Alert";

export default function Upload() {
  const { hasRole } = useAuth();

  const canUpload = hasRole("GOD", "ADMIN", "ANALYST");

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">Subir CSV a la base de datos</h1>
        <p className="text-sm text-base-content">
          Envía el reporte de Mercado Pago directamente a tu base de datos MySQL en HostGator. Detectamos las filas
          duplicadas usando la fecha, la dirección, el monto y el archivo de origen.
        </p>
      </div>

      {!canUpload ? (
        <Alert variant="error">No tienes permisos para subir movimientos. Solicita acceso a un administrador.</Alert>
      ) : (
        <div className="space-y-4">
          <TransactionUploadForm />
          <PayoutUploadForm />
        </div>
      )}
    </section>
  );
}
