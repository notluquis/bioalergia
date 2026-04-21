import { describe, expect, it } from "vitest";

import { decodeEmailBody, htmlToText, parseDoctoraliaEmail } from "../whatsapp/email-parser";

const realDoctoraliaHtmlQuotedPrintable = `<!DOCTYPE html><html><body>
<h1>Tiene una nueva reserva de cita desde Doctoralia</h1>
<table>
  <tr>
    <td>Paciente</td>
    <td>Daniela Isidora Bustos aguilera (982173854 Ruth.marlene1141@gmail.com)</td>
  </tr>
  <tr>
    <td>Fecha y hora</td>
    <td>Jueves, 9 de abril de 2026 a las 11:45=E2=80=AFa.&nbsp;m.</td>
  </tr>
  <tr>
    <td>Servicio</td>
    <td>Visitas Sucesivas Inmun=C3=B3logo Alerg=C3=B3logo (40 min)</td>
  </tr>
  <tr>
    <td>Profesional</td>
    <td>Jos=C3=A9 Manuel Mart=C3=ADnez Mart=C3=ADnez</td>
  </tr>
  <tr>
    <td>Direcci=C3=B3n</td>
    <td>Bioalergia</td>
  </tr>
</table>
</body></html>`;

function parse(html: string) {
  const decoded = decodeEmailBody({
    bodyBuffer: new TextEncoder().encode(html),
    charset: "utf-8",
    encoding: "quoted-printable",
  });
  return parseDoctoraliaEmail(htmlToText(decoded));
}

describe("doctoralia email parser", () => {
  it("decodes and parses real quoted-printable doctoralia.cl booking emails", () => {
    const parsed = parse(realDoctoraliaHtmlQuotedPrintable);

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      appointmentDoctor: "José Manuel Martínez Martínez",
      appointmentService: "Visitas Sucesivas Inmunólogo Alergólogo (40 min)",
      clinicAddress: "Bioalergia",
      eventType: "BOOKING",
      patientEmail: "Ruth.marlene1141@gmail.com",
      patientName: "Daniela Isidora Bustos aguilera",
      patientPhone: "+56982173854",
      previousAppointmentDate: null,
    });
    // 9 de abril de 2026 a las 11:45 a.m. hora Chile → UTC-4 (DST terminó el 4-abr-2026)
    // => 2026-04-09T15:45:00.000Z
    expect(parsed?.appointmentDate?.toISOString()).toBe("2026-04-09T15:45:00.000Z");
  });

  it("parses Chile wall-clock times as the same UTC instant regardless of runtime TZ", () => {
    // La hora publicada en el correo (10:15 a.m.) está en hora Chile.
    // Sin importar la TZ del proceso (Railway=UTC, dev local=Santiago), la
    // instancia UTC resultante debe ser idéntica. Antes del fix, el mismo
    // parser producía distintos Date dependiendo de `process.env.TZ`.
    const html = realDoctoraliaHtmlQuotedPrintable.replace(
      "11:45=E2=80=AFa.&nbsp;m.",
      "10:15=E2=80=AFa.&nbsp;m.",
    );

    const parsed = parse(html);
    expect(parsed?.appointmentDate?.toISOString()).toBe("2026-04-09T14:15:00.000Z");
  });

  it("handles DST-sensitive dates (pre-transition vs post-transition)", () => {
    // 26 de marzo (UTC-3, verano DST) → 12:30 Chile = 15:30 UTC
    const marchHtml = realDoctoraliaHtmlQuotedPrintable.replace(
      "Jueves, 9 de abril de 2026 a las 11:45=E2=80=AFa.&nbsp;m.",
      "Jueves, 26 de marzo de 2026 a las 12:30=E2=80=AFp.&nbsp;m.",
    );
    expect(parse(marchHtml)?.appointmentDate?.toISOString()).toBe("2026-03-26T15:30:00.000Z");

    // 24 de abril (UTC-4, invierno estándar) → 10:15 Chile = 14:15 UTC
    const aprilHtml = realDoctoraliaHtmlQuotedPrintable.replace(
      "Jueves, 9 de abril de 2026 a las 11:45=E2=80=AFa.&nbsp;m.",
      "Viernes, 24 de abril de 2026 a las 10:15=E2=80=AFa.&nbsp;m.",
    );
    expect(parse(aprilHtml)?.appointmentDate?.toISOString()).toBe("2026-04-24T14:15:00.000Z");
  });

  it("handles 24h format without am/pm", () => {
    const html = realDoctoraliaHtmlQuotedPrintable.replace(
      "Jueves, 9 de abril de 2026 a las 11:45=E2=80=AFa.&nbsp;m.",
      "Jueves, 9 de abril de 2026 a las 16:00",
    );
    // 16:00 Chile (abril, UTC-4) = 20:00 UTC
    expect(parse(html)?.appointmentDate?.toISOString()).toBe("2026-04-09T20:00:00.000Z");
  });
});
