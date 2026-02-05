import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import {
  enableMfa,
  fetchPasskeyRegistrationOptions,
  setupMfa,
  verifyPasskeyRegistration,
} from "@/features/auth/api";
import { fetchUserProfile, setupUser } from "@/features/users/api";
import { validateRut } from "@/lib/rut";

// ========== VALIDATION SCHEMAS ==========
export const profileSchema = z.object({
  names: z.string().min(1, "El nombre es requerido"),
  rut: z
    .string()
    .min(1, "El RUT es requerido")
    .refine(validateRut, "El RUT ingresado no es válido"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  fatherName: z.string().optional().default(""),
  motherName: z.string().optional().default(""),
});

export const financialSchema = z.object({
  bankName: z.string().optional().default(""),
  bankAccountType: z.string().optional().default(""),
  bankAccountNumber: z.string().optional().default(""),
});

export const passwordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const mfaSchema = z.object({
  mfaCode: z.string().length(6, "El código debe tener 6 dígitos").regex(/^\d+$/, "Solo números"),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type FinancialFormData = z.infer<typeof financialSchema>;
export type PasswordFormData = z.infer<typeof passwordSchema>;
export type MfaFormData = z.infer<typeof mfaSchema>;

export interface MfaSecretData {
  qrCodeUrl: string;
  secret: string;
}

type FormFieldName =
  | "names"
  | "rut"
  | "phone"
  | "address"
  | "fatherName"
  | "motherName"
  | "bankName"
  | "bankAccountType"
  | "bankAccountNumber"
  | "password"
  | "confirmPassword"
  | "mfaCode";

// ========== MUTATION HELPERS ==========
function useMfaSetupMutation(
  setMfaSecret: (data: MfaSecretData) => void,
  setError: (error: string | null) => void,
) {
  return useMutation({
    mutationFn: () => setupMfa(),
    onSuccess: (data) => {
      setMfaSecret({ qrCodeUrl: data.qrCodeUrl, secret: data.secret });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Error configurando MFA";
      setError(msg);
    },
  });
}

function useMfaVerifyMutation(
  mfaSecret: MfaSecretData | null,
  setCurrentStep: (fn: (prev: number) => number) => void,
  setError: (error: string | null) => void,
) {
  return useMutation({
    mutationFn: async (code: string) => {
      if (!mfaSecret) {
        throw new Error("MFA secret no configurado");
      }
      return enableMfa({
        secret: mfaSecret.secret,
        token: code,
      });
    },
    onSuccess: () => {
      setCurrentStep((prev) => prev + 1);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Código MFA inválido";
      setError(msg);
    },
  });
}

function usePasskeyRegisterMutation(setError: (error: string | null) => void) {
  return useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyRegistrationOptions();
      if (!options?.challenge) {
        throw new Error("No se pudieron obtener opciones de passkey");
      }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const attResp = await startRegistration({ optionsJSON: options });

      const verifyData = await verifyPasskeyRegistration({
        body: attResp,
        challenge: options.challenge,
      });

      if (verifyData.status !== "ok") {
        throw new Error(verifyData.message ?? "Error al verificar passkey");
      }

      return verifyData;
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "No se pudo registrar el Passkey";
      setError(msg);
    },
  });
}

function useFinalSubmitMutation(
  getValues: (fields: FormFieldName[]) => Record<string, unknown>,
  queryClient: ReturnType<typeof useQueryClient>,
  setError: (error: string | null) => void,
) {
  return useMutation({
    mutationFn: async () => {
      const vals = getValues(["names", "motherName", "password"]);
      let cleanNames = (vals.names as string).trim();
      if (vals.motherName) {
        cleanNames = `${cleanNames} ${vals.motherName}`;
      }

      const allValues = getValues([
        "names",
        "rut",
        "phone",
        "address",
        "fatherName",
        "motherName",
        "bankName",
        "bankAccountType",
        "bankAccountNumber",
        "password",
      ]);

      await setupUser({
        ...allValues,
        names: cleanNames,
        password: allValues.password,
      });

      queryClient.refetchQueries({ queryKey: ["user", "profile"] });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Error completando onboarding";
      setError(msg);
    },
  });
}

function buildOnboardingReturnValue(
  form: ReturnType<typeof useForm>,
  currentStep: number,
  error: string | null,
  mfaSecret: MfaSecretData | null,
  isLoading: boolean,
  handleNext: () => void,
  handlePrev: () => void,
  handleProfileChange: (field: string, value: string) => void,
  mutations: Record<string, unknown>,
) {
  return {
    currentStep,
    error,
    mfaSecret,
    isLoading,
    profile: {
      names: (form.getFieldValue("names") ?? "") as string,
      rut: (form.getFieldValue("rut") ?? "") as string,
      phone: (form.getFieldValue("phone") ?? "") as string,
      address: (form.getFieldValue("address") ?? "") as string,
      fatherName: (form.getFieldValue("fatherName") ?? "") as string,
      motherName: (form.getFieldValue("motherName") ?? "") as string,
      bankName: (form.getFieldValue("bankName") ?? "") as string,
      bankAccountType: (form.getFieldValue("bankAccountType") ?? "") as string,
      bankAccountNumber: (form.getFieldValue("bankAccountNumber") ?? "") as string,
    },
    password: (form.getFieldValue("password") ?? "") as string,
    confirmPassword: (form.getFieldValue("confirmPassword") ?? "") as string,
    mfaCode: (form.getFieldValue("mfaCode") ?? "") as string,
    setPassword: (value: string) => form.setFieldValue("password", value),
    setConfirmPassword: (value: string) => form.setFieldValue("confirmPassword", value),
    setMfaCode: (value: string) => form.setFieldValue("mfaCode", value),
    handleNext,
    handlePrev,
    handleProfileChange,
    mutations: mutations as {
      mfaSetup: ReturnType<typeof useMutation>;
      mfaVerify: ReturnType<typeof useMutation>;
      passkeyRegister: ReturnType<typeof useMutation>;
      finalSubmit: ReturnType<typeof useMutation>;
    },
    form,
  };
}

function initializeFormState(userProfile: unknown) {
  return useForm({
    defaultValues: {
      names: (userProfile as Record<string, unknown>)?.names ?? "",
      rut: (userProfile as Record<string, unknown>)?.rut ?? "",
      phone: (userProfile as Record<string, unknown>)?.phone ?? "",
      address: (userProfile as Record<string, unknown>)?.address ?? "",
      fatherName: (userProfile as Record<string, unknown>)?.fatherName ?? "",
      motherName: (userProfile as Record<string, unknown>)?.motherName ?? "",
      bankName: (userProfile as Record<string, unknown>)?.bankName ?? "",
      bankAccountType: (userProfile as Record<string, unknown>)?.bankAccountType ?? "",
      bankAccountNumber: (userProfile as Record<string, unknown>)?.bankAccountNumber ?? "",
      password: "",
      confirmPassword: "",
      mfaCode: "",
    },
  });
}

function createMutations(
  mfaSecret: MfaSecretData | null,
  setMfaSecret: (data: MfaSecretData) => void,
  setCurrentStep: (fn: (prev: number) => number) => void,
  setError: (error: string | null) => void,
  getFormValues: (fields: FormFieldName[]) => Record<string, unknown>,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return {
    mfaSetup: useMfaSetupMutation(setMfaSecret, setError),
    mfaVerify: useMfaVerifyMutation(mfaSecret, setCurrentStep, setError),
    passkeyRegister: usePasskeyRegisterMutation(setError),
    finalSubmit: useFinalSubmitMutation(getFormValues, queryClient, setError),
  };
}

function createHandlers(
  currentStep: number,
  form: unknown,
  setError: (error: string | null) => void,
  setCurrentStep: (fn: (prev: number) => number) => void,
) {
  return {
    handleNext: useCallback(() => {
      setError(null);
      if (currentStep < 5) {
        setCurrentStep((prev) => prev + 1);
      }
    }, [currentStep, setError, setCurrentStep]),
    handlePrev: useCallback(() => {
      setError(null);
      if (currentStep > 0) {
        setCurrentStep((prev) => prev - 1);
      }
    }, [currentStep, setError, setCurrentStep]),
    handleProfileChange: useCallback(
      (field: string, value: string) => {
        (form as unknown as Record<string, (field: string, value: string) => void>).setFieldValue?.(
          field as FormFieldName,
          value,
        );
        setError(null);
      },
      [form, setError],
    ),
  };
}

// ========== FORM HOOK ==========
export function useOnboardingForm() {
  const queryClient = useQueryClient();
  const { data: userProfile } = useSuspenseQuery({
    queryKey: ["user", "profile"],
    queryFn: fetchUserProfile,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<MfaSecretData | null>(null);
  const form = initializeFormState(userProfile) as unknown as ReturnType<typeof useForm>;
  const getFormValues = useCallback(
    (fields: FormFieldName[]) => {
      const result: Record<string, unknown> = {};
      fields.forEach((field) => {
        result[field] = form.getFieldValue(field);
      });
      return result;
    },
    [form],
  );
  const mutations = createMutations(
    mfaSecret,
    setMfaSecret,
    setCurrentStep,
    setError,
    getFormValues,
    queryClient,
  );
  const { handleNext, handlePrev, handleProfileChange } = createHandlers(
    currentStep,
    form,
    setError,
    setCurrentStep,
  );
  useEffect(() => {
    if (currentStep === 4 && !mfaSecret && !mutations.mfaSetup.isPending) {
      mutations.mfaSetup.mutate();
    }
  }, [currentStep, mfaSecret, mutations]);
  const isLoading =
    mutations.mfaSetup.isPending ||
    mutations.mfaVerify.isPending ||
    mutations.passkeyRegister.isPending ||
    mutations.finalSubmit.isPending;
  return buildOnboardingReturnValue(
    form,
    currentStep,
    error,
    mfaSecret,
    isLoading,
    handleNext,
    handlePrev,
    handleProfileChange,
    mutations,
  );
}
