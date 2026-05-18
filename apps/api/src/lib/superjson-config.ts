import { Decimal } from "decimal.js";
import superjson from "superjson";

let configured = false;

export function configureSuperjson(): typeof superjson {
  if (configured) {
    return superjson;
  }

  superjson.registerCustom<Decimal, string>(
    {
      isApplicable: (value): value is Decimal => Decimal.isDecimal(value),
      serialize: (value) => value.toJSON(),
      deserialize: (value) => new Decimal(value),
    },
    "decimal.js"
  );

  configured = true;
  return superjson;
}
