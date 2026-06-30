# WhatsApp Flow — ficha del paciente + comprobante (PhotoPicker)

Flow guiado "a prueba de tontos" para que el paciente que se auto-agenda por
Doctoralia (1) suba el comprobante de la transferencia con certeza (PhotoPicker)
y (2) complete su ficha. Los datos se guardan en `IntakeSubmission` y se reenvían
al WhatsApp del staff para que ELLAS creen la ficha + anoten en Doctoralia. **No**
se crea Patient automático.

Endpoint (cifrado, server-to-server): `https://api.bioalergia.cl/api/webhooks/wa-flow`
(fuera del CSRF, como `/api/webhooks/meta`).

Toda la config vive en **DB Settings** — cero env vars nuevas.

## 1. Generar el par de llaves (una vez)

```bash
cd apps/api
node src/scripts/wa-flow-keygen.ts
```

Esto:
- genera un par RSA-2048,
- guarda la privada **cifrada** (AES-256-GCM via `secret-cipher`) en el Setting
  `wa.flow.privateKeyEnc`,
- guarda la pública en el Setting `wa.flow.publicKey`,
- imprime la pública por stdout.

## 2. Registrar la llave pública con Meta

Copiar la pública impresa y subirla al Business phone number (Graph):

```bash
curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/whatsapp_business_encryption" \
  -H "Authorization: Bearer <SYSTEM_USER_TOKEN>" \
  --data-urlencode "business_public_key=$(printf '%s' "<PEM PÚBLICO>")"
```

Verificar: `GET /<PHONE_NUMBER_ID>/whatsapp_business_encryption` debe devolver la
key con estado `VALID`.

## 3. Construir el Flow en Flow Builder

1. WhatsApp Manager → Flows → Create flow → **Endpoint** (data-exchange).
2. Pegar `docs/wa-flow-intake/flow.json` en el editor JSON.
3. Endpoint URI: `https://api.bioalergia.cl/api/webhooks/wa-flow`.
4. "Connect endpoint" → Meta hace un `ping` cifrado; el endpoint responde
   `{ data: { status: "active" } }`. Si la llave no calza, Meta devuelve 421 y
   reintenta tras re-leer la pública.
5. Publicar el flow. Anotar el **Flow ID**.

Las claves de los campos del `flow.json` **deben** calzar con el mapper
(`services/intake.ts::mapFlowDataToIntake`): `nombre, rut, correo, telefono,
fecha_nacimiento, prevision, isapre, direccion, motivo, alergias, condiciones,
medicamentos, es_menor, tutor_nombre, tutor_rut, tutor_telefono, tutor_relacion`
y el PhotoPicker `comprobante`. Si renombras un campo en Flow Builder, actualiza
el mapper.

## 4. Crear el template del aviso al staff

Template UTILITY `abono_staff_ficha` (idioma `es` / `es_CL`):
- **Header**: IMAGE (se llena con el comprobante).
- **Body** con 5 variables nombradas: `paciente`, `rut`, `prevision`, `fecha`,
  `detalle`. Ej:
  > Nueva ficha vía WhatsApp Flow.
  > Paciente: {{paciente}} ({{rut}})
  > Previsión: {{prevision}}
  > Cita: {{fecha}}
  > {{detalle}}

## 5. Settings a configurar (intranet / DB)

| Setting | Valor |
|---|---|
| `wa.flow.privateKeyEnc` | (lo escribe el keygen) |
| `wa.flow.publicKey` | (lo escribe el keygen) |
| `wa.flow.intakeFlowId` | Flow ID del paso 3 |
| `doctoralia.abono.staffNotify.enabled` | `1` |
| `doctoralia.abono.staffNotify.phones` | números E.164 del staff, separados por coma |
| `doctoralia.abono.staffNotify.fichaTemplateName` | `abono_staff_ficha` |
| `doctoralia.abono.staffNotify.templateLanguage` | `es` (o el del template) |
| `doctoralia.abono.whatsapp.phoneNumberId` | el phone number id emisor (reusa el del abono) |

## 6. Disparar el Flow al paciente

`sendFlow` (`services/wa-messages.ts:491`) con:
- `flowId` = `wa.flow.intakeFlowId`,
- `flowToken` = **`AppointmentPaymentToken.id`** ← así el endpoint linkea la
  `IntakeSubmission` al abono/cita y rellena la fecha en el aviso al staff,
- `flowCta` = "Completar ficha", `bodyText` = instrucción al paciente.

Requiere ventana de 24h abierta (es interactive, no template). La solicitud de
abono ya abre conversación; mandar el flow a continuación.

### Prefill opcional (nombre/teléfono)

El endpoint trae un handler `INIT` que rellena `nombre`/`telefono` desde el token.
Sólo se ejecuta si el flow se lanza en modo **data_exchange**. Hoy
`sendFlowMessage` (`modules/wa-cloud/graph/messages.ts:215`) lanza en modo
`navigate`, así que el INIT no corre y el paciente teclea su nombre (campo
requerido igual). Para activar el prefill: cambiar `flow_action` a
`data_exchange` y pasar `flow_action_payload.data` — cambio chico, diferido.

## Flujo en runtime

1. Paciente abre el flow → llena la ficha (RUT, previsión, etc.) → Continuar.
2. Pantalla comprobante → sube 1 foto (PhotoPicker) → Enviar.
3. El submit final pega al endpoint (`data_exchange`, cifrado). El endpoint:
   - `createIntakeFromFlow`: guarda `IntakeSubmission` (RUT normalizado si válido),
   - baja el comprobante del CDN, lo **descifra + valida HMAC/hash**, lo sube a R2
     (`comprobanteR2Key`),
   - `notifyStaffFicha`: reenvía resumen + comprobante (header IMAGE) a cada
     teléfono del staff,
   - responde `SUCCESS` → el paciente ve la pantalla final.
4. Las chiquillas crean la ficha + anotan Doctoralia a mano, como ya operan.

## Verificación

- `ping` desde Flow Builder → "Connect endpoint" OK (status active).
- Enviar el flow a un número de prueba con `flowToken` de un token PENDING →
  llenar + subir imagen → revisar que aparezca la `IntakeSubmission`, el objeto
  en R2 (`intake-comprobante/<id>`), y el aviso en el número de staff de prueba.
- Tests: `flow-crypto.test.ts` (handshake ida/vuelta) + `flow-media.test.ts`
  (descifrado + HMAC) + `intake.test.ts` (mapper).
