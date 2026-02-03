import type { ReactFormExtendedApi } from "@tanstack/react-form";

import type { FormValues } from "./schemas";

export type FormApiFor<TFormData> = ReactFormExtendedApi<
  TFormData,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>;

export type ClassificationForm = FormApiFor<FormValues>;
