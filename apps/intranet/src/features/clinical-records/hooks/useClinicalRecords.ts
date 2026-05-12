import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicalRecordsORPCClient } from "../orpc";

const KEY = ["clinical-records"] as const;

export function useClinicalRecordImports(
  input: Parameters<typeof clinicalRecordsORPCClient.listImports>[0]
) {
  return useQuery({
    queryKey: [...KEY, "imports", input],
    queryFn: () => clinicalRecordsORPCClient.listImports(input),
    staleTime: 30_000,
  });
}

export function useClinicalRecordImport(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "import", id],
    enabled: Boolean(id),
    queryFn: () => clinicalRecordsORPCClient.getImport({ id: id! }),
  });
}

export function useReprocessClinicalRecordImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clinicalRecordsORPCClient.reprocessImport({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useApproveClinicalRecordImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patientId: number; notes?: string }) =>
      clinicalRecordsORPCClient.approveImport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRejectClinicalRecordImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; notes?: string }) =>
      clinicalRecordsORPCClient.rejectImport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function usePatientClinicalRecords(patientId: number | null) {
  return useQuery({
    queryKey: [...KEY, "by-patient", patientId],
    enabled: Boolean(patientId),
    queryFn: () => clinicalRecordsORPCClient.listForPatient({ patientId: patientId! }),
    staleTime: 60_000,
  });
}
