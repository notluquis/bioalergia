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

export function useStartBulkReprocess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { maxImports?: number }) =>
      clinicalRecordsORPCClient.startBulkReprocess(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useBulkJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: [...KEY, "bulk-job", jobId],
    enabled: Boolean(jobId),
    queryFn: () => clinicalRecordsORPCClient.getBulkJob({ jobId: jobId! }),
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (!job) return false;
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        return false;
      }
      return 1500;
    },
  });
}

export function useActiveBulkJob() {
  return useQuery({
    queryKey: [...KEY, "active-bulk-job"],
    queryFn: () => clinicalRecordsORPCClient.getActiveBulkJob({}),
    refetchInterval: (query) => {
      const job = query.state.data?.job;
      if (!job) return 5000;
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        return 30_000;
      }
      return 1500;
    },
  });
}

export function useCancelBulkJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => clinicalRecordsORPCClient.cancelBulkJob({ jobId }),
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
