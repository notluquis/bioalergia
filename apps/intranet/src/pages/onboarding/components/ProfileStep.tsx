import { ProfileForm, type ProfileFormValues } from "@/features/account/components/ProfileForm";

interface ProfileStepProps {
  profile: {
    loginEmail: string;
    names: string;
    rut: string;
    phone: string;
    fatherName: string;
    motherName: string;
  };
  onProfileChange: (field: string, value: string) => void;
  onNext: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Onboarding wizard step 1 — thin wrapper around the reusable
 * `<ProfileForm>`. The form's identity surface (names, RUT, phone,
 * etc.) is shared with `/account?tab=perfil`; the wizard hides the
 * financial section here because it surfaces as a dedicated step 2
 * (`FinancialStep`).
 *
 * Wizard state stays the source of truth: on submit we sync each field
 * up to `onProfileChange` then advance via `onNext`. RUT is editable
 * during onboarding (wizard provides it because the user is still
 * configuring); the shared form renders it read-only in the post-setup
 * `/account` flow.
 */
export function ProfileStep(props: ProfileStepProps) {
  const { profile, onProfileChange, onNext, isLoading } = props;

  const initialValues: ProfileFormValues = {
    names: profile.names,
    fatherName: profile.fatherName,
    motherName: profile.motherName,
    loginEmail: profile.loginEmail,
    phone: profile.phone,
    rut: profile.rut,
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
  };

  const handleSubmit = async (values: ProfileFormValues): Promise<void> => {
    onProfileChange("names", values.names.trim());
    onProfileChange("fatherName", values.fatherName.trim());
    onProfileChange("motherName", values.motherName.trim());
    onProfileChange("loginEmail", values.loginEmail.trim());
    onProfileChange("phone", values.phone.trim());
    onProfileChange("rut", values.rut);
    onNext();
  };

  return (
    <ProfileForm
      allowRutEdit
      hideFinancial
      initialValues={initialValues}
      isSubmitting={isLoading}
      onSubmit={handleSubmit}
      submitLabel="Siguiente"
    />
  );
}
