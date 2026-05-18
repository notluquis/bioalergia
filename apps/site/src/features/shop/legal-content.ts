// Textos legales centralizados. Cumplimiento SERNAC + Ley 21.719 + ISP.
// Para cambios mayores editar acá una sola vez — todas las páginas leen
// desde este módulo. Más adelante se puede migrar a tabla `Setting` si
// se requiere edición desde intranet sin redeploy.

export const LEGAL = {
  retracto: {
    title: "Derecho de retracto · 10 días",
    body: `Conforme al Artículo 3 bis de la Ley 19.496 (Ley del Consumidor), tienes derecho a retractarte de tu compra en línea dentro de los 10 días corridos contados desde la recepción del producto, sin necesidad de expresar causa.

Para ejercer este derecho:
1. Comunícate con nosotros por WhatsApp o email (contacto@bioalergia.cl) indicando tu número de pedido.
2. Devuelve el producto en su empaque original, sin uso, en perfecto estado.
3. Coordinamos la logística inversa con Chilexpress (sin costo adicional para ti).
4. Reembolsamos el monto pagado (incluido el envío original) dentro de los 10 días hábiles siguientes a la recepción del producto en nuestras instalaciones, por el mismo medio de pago.

EXCEPCIONES (no aplican retracto):
- Productos perecibles o de higiene íntima abierta.
- Medicamentos de venta bajo receta (cuando aplique).
- Productos personalizados o hechos a pedido.

Si el producto presenta vicios o defectos, aplica la GARANTÍA LEGAL (no este derecho de retracto) — ver /legal/garantia.`,
  },
  garantia: {
    title: "Garantía legal · 6 meses",
    body: `Todos nuestros productos cuentan con la garantía legal de 6 meses establecida por la Ley 19.496 (Ley Pro Consumidor) desde la fecha de recepción.

Si tu producto presenta:
- Defectos de fabricación
- No corresponde a la descripción publicada
- No cumple con el fin para el cual fue adquirido

PUEDES OPTAR ENTRE:
1. **Reparación gratuita** (cuando aplique)
2. **Cambio por un producto idéntico** (sujeto a stock)
3. **Devolución íntegra** del precio pagado

Para iniciar un proceso de garantía:
- Email: contacto@bioalergia.cl
- WhatsApp: +56 9 3254 5883
- Adjunta foto del problema + número de pedido

Resolvemos en máximo 5 días hábiles desde recepción del reclamo.`,
  },
  pagos: {
    title: "Pago seguro · MercadoPago",
    body: `Procesamos todos los pagos a través de MercadoPago Chile, certificado PCI DSS Nivel 1. Aceptamos:

- Tarjetas de crédito (Visa, MasterCard, American Express, Diners)
- Tarjetas de débito (Webpay)
- Cuenta MercadoPago
- Hasta 12 cuotas sin interés (según promoción del banco emisor)

DATOS DE TARJETA: No almacenamos información de tu tarjeta. La tokenización ocurre dentro del SDK oficial de MercadoPago en tu navegador. Bioalergia nunca recibe ni guarda el número de tarjeta.

3D SECURE 2.0: Habilitamos validación adicional según el banco para reducir contracargos y proteger tu compra.

PROBLEMAS CON UN PAGO: contáctanos en contacto@bioalergia.cl con tu número de orden — resolvemos en 24h hábiles.`,
  },
  isp: {
    title: "Comercio supervisado · Productos farmacéuticos",
    body: `Bioalergia opera un centro médico privado con química farmacéutica responsable y autorización sanitaria vigente.

NUESTRO CATÁLOGO INCLUYE:
- Productos dermocosméticos (no requieren registro ISP individual).
- Productos de higiene y cuidado personal.

PRODUCTOS BAJO RECETA MÉDICA:
Para medicamentos OTC o de venta bajo receta médica, NO realizamos venta directa a través de redes sociales ni mensajería (WhatsApp solo para consulta). La venta de medicamentos sigue el Reglamento de Comercio Electrónico de Medicamentos del ISP (Resolución pendiente de despliegue).

CONSULTA PROFESIONAL:
Para dudas sobre productos farmacéuticos, contacta directamente a nuestro centro:
- Email: contacto@bioalergia.cl
- Teléfono: +56 9 3254 5883
- Dirección: Concepción, Chile

Si necesitas un producto bajo receta, primero agenda una consulta médica con uno de nuestros especialistas.`,
  },
  cookies: {
    title: "Política de cookies · Ley 21.719",
    body: `En cumplimiento de la Ley 21.719 de Protección de Datos Personales (vigente diciembre 2026), te informamos sobre las cookies que utilizamos.

COOKIES NECESARIAS (siempre activas):
- Sesión de navegación (csrf_token, cart token) — sin ellas la tienda no funciona.
- Preferencia de tema oscuro/claro.

COOKIES OPCIONALES (requieren tu consentimiento):
- Analíticas (PostHog) — entendemos qué páginas son útiles para mejorarlas. No identifican personas por nombre.
- Marketing (Meta Pixel, Google Analytics) — atribución de campañas publicitarias.

PUEDES CAMBIAR TU PREFERENCIA en cualquier momento desde el banner inferior (limpiar localStorage para que reaparezca).

DATOS PERSONALES: Solo recolectamos lo mínimo necesario (nombre, email, dirección de envío, RUT si pides factura). No vendemos ni cedemos a terceros. Ejerce tus derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) escribiendo a contacto@bioalergia.cl.`,
  },
} as const;
