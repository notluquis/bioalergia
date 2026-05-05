import { describe, expect, it } from "vitest";
import { parseDteXml } from "../xml-parser";

const SIMPLE_DTE_XML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0">
  <Documento ID="F001T33">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>1001</Folio>
        <FchEmis>2026-01-15</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76123456-7</RUTEmisor>
        <RznSoc>Bioalergia SpA</RznSoc>
      </Emisor>
      <Receptor>
        <RUTRecep>12345678-9</RUTRecep>
        <RznSocRecep>Cliente SA</RznSocRecep>
      </Receptor>
      <Totales>
        <MntNeto>84034</MntNeto>
        <IVA>15966</IVA>
        <MntTotal>100000</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Consulta médica</NmbItem>
      <QtyItem>1</QtyItem>
      <PrcItem>84034</PrcItem>
      <MontoItem>84034</MontoItem>
    </Detalle>
  </Documento>
</DTE>`;

const ENVIO_DTE_XML = `<?xml version="1.0"?>
<EnvioDTE>
  <SetDTE>
    <DTE>
      <Documento ID="F002T39">
        <Encabezado>
          <IdDoc>
            <TipoDTE>39</TipoDTE>
            <Folio>500</Folio>
            <FchEmis>2026-03-20</FchEmis>
          </IdDoc>
          <Emisor>
            <RUTEmisor>76123456-7</RUTEmisor>
            <RznSoc>Bioalergia SpA</RznSoc>
          </Emisor>
          <Receptor>
            <RUTRecep>11111111-1</RUTRecep>
            <RznSocRecep>Paciente Anónimo</RznSocRecep>
          </Receptor>
          <Totales>
            <MntExe>50000</MntExe>
            <MntTotal>50000</MntTotal>
          </Totales>
        </Encabezado>
        <Detalle>
          <NroLinDet>1</NroLinDet>
          <NmbItem>Atención de urgencia</NmbItem>
          <IndExe>1</IndExe>
          <QtyItem>1</QtyItem>
          <PrcItem>50000</PrcItem>
          <MontoItem>50000</MontoItem>
        </Detalle>
        <Detalle>
          <NroLinDet>2</NroLinDet>
          <NmbItem>Medicamentos</NmbItem>
          <IndExe>1</IndExe>
          <QtyItem>2</QtyItem>
          <PrcItem>5000</PrcItem>
          <MontoItem>10000</MontoItem>
        </Detalle>
      </Documento>
    </DTE>
  </SetDTE>
</EnvioDTE>`;

describe("parseDteXml", () => {
  describe("bare DTE wrapper", () => {
    it("parses header fields correctly", () => {
      const result = parseDteXml(SIMPLE_DTE_XML);
      expect(result.header.tipoDTE).toBe(33);
      expect(result.header.folio).toBe(1001);
      expect(result.header.fechaEmision).toBe("2026-01-15");
      expect(result.header.rutEmisor).toBe("76123456-7");
      expect(result.header.razonSocialEmisor).toBe("Bioalergia SpA");
      expect(result.header.rutReceptor).toBe("12345678-9");
      expect(result.header.razonSocialReceptor).toBe("Cliente SA");
    });

    it("parses amount fields", () => {
      const result = parseDteXml(SIMPLE_DTE_XML);
      expect(result.header.montoNeto).toBe(84034);
      expect(result.header.iva).toBe(15966);
      expect(result.header.montoTotal).toBe(100000);
    });

    it("parses single line item", () => {
      const result = parseDteXml(SIMPLE_DTE_XML);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0]?.itemName).toBe("Consulta médica");
      expect(result.lineItems[0]?.quantity).toBe(1);
      expect(result.lineItems[0]?.unitPrice).toBe(84034);
      expect(result.lineItems[0]?.amount).toBe(84034);
      expect(result.lineItems[0]?.isExempt).toBe(false);
    });
  });

  describe("EnvioDTE wrapper", () => {
    it("extracts document from nested EnvioDTE structure", () => {
      const result = parseDteXml(ENVIO_DTE_XML);
      expect(result.header.tipoDTE).toBe(39);
      expect(result.header.folio).toBe(500);
      expect(result.header.montoExento).toBe(50000);
    });

    it("parses multiple line items", () => {
      const result = parseDteXml(ENVIO_DTE_XML);
      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0]?.isExempt).toBe(true);
      expect(result.lineItems[1]?.itemName).toBe("Medicamentos");
      expect(result.lineItems[1]?.quantity).toBe(2);
      expect(result.lineItems[1]?.amount).toBe(10000);
    });
  });

  it("throws when no Documento element found", () => {
    expect(() => parseDteXml("<Foo><Bar>x</Bar></Foo>")).toThrow("No <Documento>");
  });
});
