import { Alert, Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { ProfileForm, type ProfileFormValues } from "@/features/account/components/ProfileForm";
import { fetchUserProfile, updateOwnProfile } from "@/features/users/api";
import { toast } from "@/lib/toast-interceptor";

/**
 * `/account?tab=perfil` — self-service profile editor.
 *
 * Wraps the reusable `<ProfileForm>` (also used by the onboarding wizard)
 * with the page-level concerns: fetch existing profile, submit via
 * `updateOwnProfile`, surface toast + invalidate the user-profile cache
 * on success.
 *
 * No tab gating here — `_authed/account.tsx` only renders this when the
 * user is authenticated, and every authenticated user can edit their
 * own data.
 */
export function ProfilePanel() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["user", "profile"],
    queryFn: fetchUserProfile,
  });

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateOwnProfile({
        names: values.names.trim(),
        fatherName: values.fatherName.trim() || null,
        motherName: values.motherName.trim() || null,
        loginEmail: values.loginEmail.trim() || null,
        phone: values.phone.trim() || null,
        bankName: values.bankName.trim() || null,
        bankAccountType: values.bankAccountType.trim() || null,
        bankAccountNumber: values.bankAccountNumber.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Perfil actualizado");
      void queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
      void queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Error al guardar el perfil";
      toast.error(message);
    },
  });

  const initialValues = useMemo<null | ProfileFormValues>(() => {
    if (!profileQuery.data) return null;
    const p = profileQuery.data;
    return {
      names: p.names ?? "",
      fatherName: p.fatherName ?? "",
      motherName: p.motherName ?? "",
      loginEmail: p.loginEmail ?? p.email ?? "",
      phone: p.phone ?? "",
      rut: p.rut ?? "",
      bankName: p.bankName ?? "",
      bankAccountType: p.bankAccountType ?? "",
      bankAccountNumber: p.bankAccountNumber ?? "",
    };
  }, [profileQuery.data]);

  if (profileQuery.isPending) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-1/3 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (profileQuery.isError || !initialValues) {
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : "No se pudo cargar el perfil";
    return (
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Error</Alert.Title>
          <Alert.Description>{message}</Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg text-primary drop-shadow-sm">Mi perfil</h2>
        <p className="text-default-600 text-sm">
          Actualiza tus datos personales y bancarios. Para cambiar tu RUT, contacta a un
          administrador.
        </p>
      </div>

      <ProfileForm
        initialValues={initialValues}
        isSubmitting={mutation.isPending}
        onSubmit={(values) => mutation.mutateAsync(values).then(() => undefined)}
      />
    </div>
  );
}
