import path from "node:path";
import { config } from "dotenv";

// Load env before anything else
config({ path: path.resolve(process.cwd(), ".env") });
// Also try relative path if run from deep folder, but process.cwd() is usually root in these tools
// Just in case:
config({ path: "../../../../.env" });

function parseCurrency(str: string) {
  return parseFloat(
    str
      .replace(/[^\d,]/g, "")
      .replace(",", ".")
      .replace(/\.(?=.*\.)/g, ""),
  );
}

function parseDate(str: string) {
  const [day, month, year] = str.split("/");
  return new Date(`${year}-${month}-${day}`);
}

/*
DATA
*/
const RAW_BCI = `Crédito D12400101797
Estado de cuenta
N° de Crédito cursado	:	D12400101797	Canal	:	090
Monto Solicitado	:	$11.304.563	N° de cuota pagada	:	5/48
Fecha de curse
:	18/08/2025	Fecha Próximo pago	:	19/01/2026
Monto Pagado	:	$ 1.272.868	Monto cuota	:	$ 320.704
Debe Aún	:	$ 14.110.998	Tasa	:	1,32%
Detalle cuotas
1/48 17/09/2025 $ 310.756 $ 310.756
2/48 17/10/2025 $ 320.704 $ 322.996
3/48 17/11/2025 $ 320.704 $ 321.377
4/48 17/12/2025 $ 320.704 $ 320.704
5/48 19/01/2026 $ 320.704 --
6/48 17/02/2026 $ 320.704 --
7/48 17/03/2026 $ 320.704 --
8/48 17/04/2026 $ 320.704 --
9/48 18/05/2026 $ 320.704 --
10/48 17/06/2026 $ 320.704 --
11/48 17/07/2026 $ 320.704 --
12/48 17/08/2026 $ 320.704 --
13/48 17/09/2026 $ 320.704 --
14/48 19/10/2026 $ 320.704 --
15/48 17/11/2026 $ 320.704 --
16/48 17/12/2026 $ 320.704 --
17/48 18/01/2027 $ 320.704 --
18/48 17/02/2027 $ 320.704 --
19/48 17/03/2027 $ 320.704 --
20/48 19/04/2027 $ 320.704 --
21/48 17/05/2027 $ 320.704 --
22/48 17/06/2027 $ 320.704 --
23/48 19/07/2027 $ 320.704 --
24/48 17/08/2027 $ 320.704 --
25/48 17/09/2027 $ 320.704 --
26/48 18/10/2027 $ 320.704 --
27/48 17/11/2027 $ 320.704 --
28/48 17/12/2027 $ 320.704 --
29/48 17/01/2028 $ 320.704 --
30/48 17/02/2028 $ 320.704 --
31/48 17/03/2028 $ 320.704 --
32/48 17/04/2028 $ 320.704 --
33/48 17/05/2028 $ 320.704 --
34/48 19/06/2028 $ 320.704 --
35/48 17/07/2028 $ 320.704 --
36/48 17/08/2028 $ 320.704 --
37/48 20/09/2028 $ 320.704 --
38/48 17/10/2028 $ 320.704 --
39/48 17/11/2028 $ 320.704 --
40/48 18/12/2028 $ 320.704 --
41/48 17/01/2029 $ 320.704 --
42/48 19/02/2029 $ 320.704 --
43/48 19/03/2029 $ 320.704 --
44/48 17/04/2029 $ 320.704 --
45/48 17/05/2029 $ 320.704 --
46/48 18/06/2029 $ 320.704 --
47/48 17/07/2029 $ 320.704 --
48/48 17/08/2029 $ 320.726 --`;

const _RAW_ITAU = `Dividendos de las operaciones
Nº dividendo Fecha vencimiento Fecha pago Monto dividendo Monto en UF
1 12/01/2026 $ 0 UF 16,24
2 10/02/2026 $ 0 UF 9,68
Propiedad
Dirección AV. LAS MARGARITAS 1945 DPTO. DEPTO 116 Comuna San Pedro
Ciudad Santiago Monto asegurado UF 2.158,00
Datos del crédito
Monto inicial UF 1.821,00 Fecha de escritura 29/08/2025
Saldo actual UF 1.817,19 Valor tasación UF 2.677,00
Dividendos Pactados 300
Pagados 0`;

const RAW_FALABELLA = `Monto Líquido $12.900.000
Monto Otorgado $13.004.032
Cost Total del Crédito $19.078.974
Monto de la cuota mensual $397.479
Número de cuotas 48
CAE 20.71%
Tasa de interés (mensual) 1.66%
1 $397.479 22/09/2025 Pagada vigente
2 $397.479 22/10/2025 Pagada vigente
3 $397.479 24/11/2025 Pagada vigente
4 $397.479 22/12/2025 Pagada vigente
5 $397.479 22/01/2026 Vigente
6 $397.479 23/02/2026 Vigente
7 $397.479 23/03/2026 Vigente
8 $397.479 22/04/2026 Vigente
9 $397.479 22/05/2026 Vigente
10 $397.479 22/06/2026 Vigente
11 $397.479 22/07/2026 Vigente
12 $397.479 24/08/2026 Vigente
13 $397.479 22/09/2026 Vigente
14 $397.479 22/10/2026 Vigente
15 $397.479 23/11/2026 Vigente
16 $397.479 22/12/2026 Vigente
17 $397.479 22/01/2027 Vigente
18 $397.479 22/02/2027 Vigente
19 $397.479 22/03/2027 Vigente
20 $397.479 22/04/2027 Vigente
21 $397.479 24/05/2027 Vigente
22 $397.479 22/06/2027 Vigente
23 $397.479 22/07/2027 Vigente
24 $397.479 23/08/2027 Vigente
25 $397.479 22/09/2027 Vigente
26 $397.479 22/10/2027 Vigente
27 $397.479 22/11/2027 Vigente
28 $397.479 22/12/2027 Vigente
29 $397.479 24/01/2028 Vigente
30 $397.479 22/02/2028 Vigente
31 $397.479 22/03/2028 Vigente
32 $397.479 24/04/2028 Vigente
33 $397.479 22/05/2028 Vigente
34 $397.479 22/06/2028 Vigente
35 $397.479 24/07/2028 Vigente
36 $397.479 22/08/2028 Vigente
37 $397.479 22/09/2028 Vigente
38 $397.479 23/10/2028 Vigente
39 $397.479 22/11/2028 Vigente
40 $397.479 22/12/2028 Vigente
41 $397.479 22/01/2029 Vigente
42 $397.479 22/02/2029 Vigente
43 $397.479 22/03/2029 Vigente
44 $397.479 23/04/2029 Vigente
45 $397.479 22/05/2029 Vigente
46 $397.479 22/06/2029 Vigente
47 $397.479 23/07/2029 Vigente
48 $397.461 22/08/2029 Vigente`;

async function main() {
  console.log("Inserting Personal Finance Data...");

  // Dynamic import to ensure process.env is populated before client is initialized
  const { db } = await import("../../../../packages/db/src/client");

  // 1. BCI
  try {
    const bciCreditNumber = "D12400101797";
    console.log("Processing BCI:", bciCreditNumber);

    // Create Credit Header
    const bciCredit = await db.personalCredit.create({
      data: {
        bankName: "BCI",
        creditNumber: bciCreditNumber,
        description: "Crédito Consumo BCI",
        totalAmount: 11304563 as any, // From "Monto Solicitado"
        interestRate: 1.32 as any,
        startDate: parseDate("18/08/2025"), // Fecha de curse
        totalInstallments: 48,
        status: "ACTIVE",
      },
    });

    // Parse BCI Rows
    const bciRegex = /(\d+)\/48\s+(\d{2}\/\d{2}\/\d{4})\s+\$\s+([\d.]+)\s+(?:--|\$\s+([\d.]+))/g;
    let match: RegExpExecArray | null;
    while ((match = bciRegex.exec(RAW_BCI)) !== null) {
      const [_, num, dateStr, amountStr, paidAmountStr] = match;
      const amount = parseCurrency(amountStr);
      const paidAmount = paidAmountStr ? parseCurrency(paidAmountStr) : null;

      await db.personalCreditInstallment.create({
        data: {
          creditId: bciCredit.id,
          installmentNumber: parseInt(num, 10),
          dueDate: parseDate(dateStr),
          amount: amount as any,
          paidAmount: paidAmount as any,
          status: paidAmount ? "PAID" : "PENDING",
        },
      });
    }
  } catch (e) {
    console.error("Error BCI:", e);
  }

  // 2. Falabella
  try {
    const falaCreditNumber = "200015344542";
    console.log("Processing Falabella:", falaCreditNumber);

    const falaCredit = await db.personalCredit.create({
      data: {
        bankName: "Falabella",
        creditNumber: falaCreditNumber,
        description: "Crédito Consumo Falabella",
        totalAmount: 12900000 as any, // Monto Liquido
        interestRate: 1.66 as any,
        startDate: parseDate("21/08/2025"),
        totalInstallments: 48,
        status: "ACTIVE",
      },
    });

    const falaRegex = /(\d+)\s+\$([\d.]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(Vigente|Pagada vigente)/g;
    let matchF: RegExpExecArray | null;
    while ((matchF = falaRegex.exec(RAW_FALABELLA)) !== null) {
      const [_, num, amountStr, dateStr, statusStr] = matchF;
      const amount = parseCurrency(amountStr);
      const isPaid = statusStr.includes("Pagada");

      await db.personalCreditInstallment.create({
        data: {
          creditId: falaCredit.id,
          installmentNumber: parseInt(num, 10),
          dueDate: parseDate(dateStr),
          amount: amount as any,
          status: isPaid ? "PAID" : "PENDING",
          paidAmount: isPaid ? (amount as any) : null, // Estimating
        },
      });
    }
  } catch (e) {
    console.error("Error Falabella:", e);
  }

  // 3. Itaú (Hypothetical Parsing based on snippet)
  try {
    const itauCreditNumber = "ITAU-HIP-001"; // Generic ID
    console.log("Processing Itaú:", itauCreditNumber);

    const itauCredit = await db.personalCredit.create({
      data: {
        bankName: "Itaú",
        creditNumber: itauCreditNumber,
        description: "Hipoteca Depto 116",
        totalAmount: 1821.0 as any, // UF
        currency: "UF",
        startDate: parseDate("29/08/2025"),
        totalInstallments: 300,
        status: "ACTIVE",
      },
    });

    // Not enough data rows in snippet for full schedule, just creating the header + first 2 sample rows
    await db.personalCreditInstallment.createMany({
      data: [
        {
          creditId: itauCredit.id,
          installmentNumber: 1,
          dueDate: parseDate("12/01/2026"),
          amount: 16.24 as any,
          status: "PENDING",
        },
        {
          creditId: itauCredit.id,
          installmentNumber: 2,
          dueDate: parseDate("10/02/2026"),
          amount: 9.68 as any,
          status: "PENDING",
        },
      ],
    });
  } catch (e) {
    console.error("Error Itaú:", e);
  }

  console.log("Done!");
}

main();
