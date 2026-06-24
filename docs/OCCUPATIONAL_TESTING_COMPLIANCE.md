# Salud ocupacional — testeo de drogas/alcohol: compliance stage-C

Diseño del sistema de **resultado individual** (stage-C), derivado de investigación
legal de fuentes primarias chilenas. **No es asesoría legal**; es un diseño
compliance-by-design con defaults conservadores donde la ley calla. Los puntos
que aún requieren decisión humana están listados al final (§Residuales).

## Fuentes primarias

- **ISP** — *"Tamizaje de Drogas de Abuso en Orina en el Laboratorio Clínico"*
  (Res. Exenta MINSAL 172/2015; reaprob. Res. ISP 3705/2017; rev. **Res. 0250-2024**).
  Es **guía técnica / soft law**: el mandato de testear viene de la ley laboral; la
  ejecución técnica sigue esta guía (estándar de cuidado de facto).
- **DT** — ORD. **3032/47** (12-jul-2010): el resultado individual va **solo al
  trabajador**; cláusulas RIOHS que lo remiten al empleador "deberán eliminarse".
- **Código del Trabajo** Art. 5/153/154/**154 bis** (deber de reserva).
- **Ley 20.584 Art. 13 + DS 41/2012 Art. 11-12**: ficha clínica = **15 años desde la
  última entrada**.
- **Ley 21.719** (datos sensibles, consentimiento separado por finalidad, ARCO+).
- **DS 132/2004 minería** Art. 40-41; **DS 44/2024** (SST, NO mandata testeo);
  transporte (Ley 18.290 / control policial; "company testing" aún en proyecto,
  Boletín 16872-15, NO ley).

## Hard gates (en `services/occupational-testing.ts`, no en la UI)

| # | Gate | Implementación |
|---|---|---|
| G1 | Sin POSITIVO sin confirmatorio GC-MS/LC-MS-MS | tamizaje solo `NEGATIVE`/`PRESUMPTIVE_POSITIVE`; positivo final solo vía confirmatorio (enum `GC_MS\|LC_MS_MS`) + revisión médica |
| G2 | Sin divulgación individual al empleador sin consentimiento separado | `discloseToEmployer` exige `OccConsent` EMPLOYER_DISCLOSURE vivo; detalle de sustancia exige SUBSTANCE_LEVEL_DISCLOSURE adicional; el empleador nunca recibe el resultado crudo |
| G3 | Confirmatorio sobre el mismo espécimen primario | `recordConfirmatory` valida que la muestra pertenezca al mismo order |
| G4 | Cadena de custodia inviolable | `OccCustodyEvent` append-only (`@@allow('read,create')`, sin update/delete) |
| G5 | Consentimiento de testeo ≠ de divulgación | filas `OccConsent` distintas por `purpose` |
| G6 | Retención 15 años desde la última entrada | `OccTestOrder.lastEntryAt` (clock DS 41 Art. 11) |

Además: orden bajo un programa hereda el **gate RIOHS** del stage-B (no se puede
ordenar testeo si el programa no tiene atestación RIOHS).

## Datos clave codificados

- **Cutoffs de tamizaje ISP** (`ISP_SCREENING_CUTOFFS`, SAMHSA+EWDTS): opiáceos
  **2000 ng/mL** (no 300), cannabinoides 50, cocaína 150, anfetaminas/MDMA 500,
  PCP 25, barbitúricos/benzodiazepinas 200, metadona/propoxifeno 300.
- **Confirmatorio**: ISP **no fija** cutoff → se captura por laboratorio
  (`confirmCutoffNgMl` en `analytes`), no se hardcodea.
- **Sujeto seudónimo**: el envase lleva `subjectCode` (barra), nunca nombre/RUT;
  el link a `Person` (PII) queda null salvo consent `IDENTITY_LINK`.
- **Muestra B** = la `CONTRAMUESTRA` sellada/congelada (ISP §5.5) — el derecho a
  contra-análisis se ejerce contra ella.
- **Revisión médica** (`OccMedicalReview`): best-practice, NO estatutaria en Chile
  (no hay MRO obligatorio). El copy legal NO debe representarla como exigida por ley;
  la receta declarada (campo custodia ISP #8) puede explicar un positivo confirmado.

## Matriz de divulgación al empleador

| Escenario | El empleador recibe |
|---|---|
| Default (sin consent individual) | **Solo agregado/despersonalizado** (stage-B) |
| Presuntivo (pre-confirmación) | **Nada** — no es un resultado |
| Con consent EMPLOYER_DISCLOSURE | apto/no-apto (fitness); sustancia solo con consent SUBSTANCE_LEVEL adicional |
| Confirmado positivo, sin consent | solo fitness/agregado; el detalle clínico queda con el trabajador |

## Residuales — decisiones humanas pendientes (defaults conservadores aplicados)

Construido sin abogada con los defaults más protectores; estos puntos conviene
confirmarlos eventualmente (la ley calla o requiere una elección operativa):

1. **Ventana de contramuestra + plazo de contra-análisis**: ISP dice "no existe
   reglamentación". Default sugerido: contramuestra congelada ≥90 días; falta fijar
   el número vinculante.
2. **Destrucción del espécimen físico**: el "3 meses" es práctica de alcoholemia
   forense, no regla de droga-test. Confirmar.
3. **Wording de la revisión médica**: implementada como best-practice; el copy NO
   debe decir "exigida por ley".
4. **Cutoffs confirmatorios + laboratorio confirmante**: definir el lab (autorización
   SEREMI/ISP + ISO 15189 + PEEC) y sus cutoffs validados.
5. **Menores / trabajador <18**: ley efectivamente silente; default = consentimiento
   de tutor + sin auto-divulgación.
6. **Ordinales exactos de la Ley 21.719** (datos sensibles, brecha, sanciones):
   verificar contra el texto consolidado de BCN antes de cualquier presentación legal.
7. **EIPD ocupacional** (Art. 16 bis desfavorece tratamiento de datos de salud en lo
   laboral sin autorización legal): documentar RIOHS + finalidad lícita; no apoyarse
   solo en consentimiento. Falta el documento EIPD ocupacional formal.
8. **Brecha**: fuga de resultados = sanción tope (gravísima) + notificación dual
   (Agencia + cada trabajador) sin dilaciones indebidas (~72h diligencia). Cablear al
   runbook de seguridad.
