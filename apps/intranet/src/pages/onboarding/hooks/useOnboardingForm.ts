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

interface OnboardingValues {
  names: string;
  rut: string;
  phone: string;
  address: string;
  fatherName: string;
  motherName: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  password: string;
  confirmPassword: string;
  mfaCode: string;
}

export function useOnboardingForm() {
  const queryClient = useQueryClient();
  const { data: userProfile } = useSuspenseQuery({
    queryKey: ["user", "profile"],
    queryFn: fetchUserProfile,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<MfaSecretData | null>(null);

  const [defaultValues] = useState<OnboardingValues>(() => ({
    names: userProfile?.names ?? "",
    rut: userProfile?.rut ?? "",
    phone: userProfile?.phone ?? "",
    address: userProfile?.address ?? "",
    fatherName: userProfile?.fatherName ?? "",
    motherName: userProfile?.motherName ?? "",
    bankName: userProfile?.bankName ?? "",
    bankAccountType: userProfile?.bankAccountType ?? "",
    bankAccountNumber: userProfile?.bankAccountNumber ?? "",
    password: "",
    confirmPassword: "",
    mfaCode: "",
  }));

  const form = useForm({
    defaultValues,
  });

  const mfaSetup = useMutation({
    mutationFn: () => setupMfa(),
    onSuccess: (data) => {
      setMfaSecret({ qrCodeUrl: data.qrCodeUrl, secret: data.secret });
    },
    onError: (mutationError) => {
      const msg = mutationError instanceof Error ? mutationError.message : "Error configurando MFA";
      setError(msg);
    },
  });

  const mfaVerify = useMutation({
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
    onError: (mutationError) => {
      const msg = mutationError instanceof Error ? mutationError.message : "Código MFA inválido";
      setError(msg);
    },
  });

  const passkeyRegister = useMutation({
    mutationFn: async () => {
      const options = await fetchPasskeyRegistrationOptions();
      if (!options?.challenge) {
        throw new Error("No se pudieron obtener opciones de passkey");
      }

      const { startRegistration } = await import("@simplewebauthn/browser");
      const attestation = await startRegistration({ optionsJSON: options });

      const verifyResult = await verifyPasskeyRegistration({
        body: attestation,
        challenge: options.challenge,
      });

      if (verifyResult.status !== "ok") {
        throw new Error(verifyResult.message ?? "Error al verificar passkey");
      }
      return verifyResult;
    },
    onError: (mutationError) => {
      const msg =
        mutationError instanceof Error ? mutationError.message : "No se pudo registrar el Passkey";
      setError(msg);
    },
  });

  const finalSubmit = useMutation({
    mutationFn: async () => {
      const names = (form.getFieldValue("names") ?? "").trim();
      const motherName = (form.getFieldValue("motherName") ?? "").trim();
      const cleanNames = motherName ? `${names} ${motherName}` : names;

      await setupUser({
        names: cleanNames,
        rut: form.getFieldValue("rut") ?? "",
        phone: form.getFieldValue("phone") ?? "",
        address: form.getFieldValue("address") ?? "",
        fatherName: form.getFieldValue("fatherName") ?? "",
        motherName: form.getFieldValue("motherName") ?? "",
        bankName: form.getFieldValue("bankName") ?? "",
        bankAccountType: form.getFieldValue("bankAccountType") ?? "",
        bankAccountNumber: form.getFieldValue("bankAccountNumber") ?? "",
        password: form.getFieldValue("password") ?? "",
      });

      await queryClient.refetchQueries({ queryKey: ["user", "profile"] });
    },
    onError: (mutationError) => {
      const msg =
        mutationError instanceof Error ? mutationError.message : "Error completando onboarding";
      setError(msg);
    },
  });

  const handleNext = useCallback(() => {
    setError(null);
    setCurrentStep((prev) => (prev < 5 ? prev + 1 : prev));
  }, []);

  const handlePrev = useCallback(() => {
    setError(null);
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleProfileChange = useCallback(
    (field: string, value: string) => {
      form.setFieldValue(field as keyof OnboardingValues, value);
      setError(null);
    },
    [form],
  );

  useEffect(() => {
    if (currentStep === 4 && !mfaSecret && !mfaSetup.isPending) {
      mfaSetup.mutate();
    }
  }, [currentStep, mfaSecret, mfaSetup]);

  const isLoading =
    mfaSetup.isPending || mfaVerify.isPending || passkeyRegister.isPending || finalSubmit.isPending;

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
    mutations: {
      mfaSetup,
      mfaVerify,
      passkeyRegister,
      finalSubmit,
    },
    form,
  };
}
