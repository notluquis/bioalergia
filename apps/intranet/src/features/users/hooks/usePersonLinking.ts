import type { PersonWithExtras } from "@/features/people/api";

interface AddUserFormState {
  email: string;
  fatherName: string;
  linkToPerson: boolean;
  mfaEnforced: boolean;
  motherName: string;
  names: string;
  passkeyOnly: boolean;
  personId: number | undefined;
  position: string;
  role: string;
  rut: string;
}

type FormApi = {
  getFieldValue<K extends keyof AddUserFormState>(field: K): AddUserFormState[K];
  setFieldValue(field: string, value: unknown): void;
};

export function usePersonLinking(form: FormApi, availablePeople: PersonWithExtras[]) {
  const handleLinkPerson = (pid: number | undefined) => {
    const person = availablePeople.find((p) => p.id === pid);

    if (person) {
      form.setFieldValue("email", person.email ?? form.getFieldValue("email"));
      form.setFieldValue("fatherName", "");
      form.setFieldValue("linkToPerson", true);
      form.setFieldValue("motherName", "");
      form.setFieldValue("names", "");
      form.setFieldValue("personId", pid);
      form.setFieldValue("position", person.employee?.position ?? form.getFieldValue("position"));
      form.setFieldValue("rut", "");
    } else {
      form.setFieldValue("linkToPerson", false);
      form.setFieldValue("personId", undefined);
    }
  };

  return { handleLinkPerson };
}
