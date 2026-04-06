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

describe("doctoralia email parser", () => {
  it("decodes and parses real quoted-printable doctoralia.cl booking emails", () => {
    const decodedBody = decodeEmailBody({
      bodyBuffer: new TextEncoder().encode(realDoctoraliaHtmlQuotedPrintable),
      charset: "utf-8",
      encoding: "quoted-printable",
    });

    const parsed = parseDoctoraliaEmail(htmlToText(decodedBody));

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      appointmentDoctor: "José Manuel Martínez Martínez",
      appointmentService: "Visitas Sucesivas Inmunólogo Alergólogo (40 min)",
      clinicAddress: "Bioalergia",
      eventType: "BOOKING",
      isFirstAppointment: false,
      patientEmail: "Ruth.marlene1141@gmail.com",
      patientName: "Daniela Isidora Bustos aguilera",
      patientPhone: "982173854",
      previousAppointmentDate: null,
    });
    expect(parsed?.appointmentDate).toBeInstanceOf(Date);
    expect(parsed?.appointmentDate?.getFullYear()).toBe(2026);
    expect(parsed?.appointmentDate?.getMonth()).toBe(3);
    expect(parsed?.appointmentDate?.getDate()).toBe(9);
  });
});
