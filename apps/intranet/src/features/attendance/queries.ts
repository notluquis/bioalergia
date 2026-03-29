import { queryOptions } from "@tanstack/react-query";
import { attendanceORPCClient } from "./orpc";

export const attendanceQueries = {
  status: () =>
    queryOptions({
      queryKey: ["attendance", "status"],
      queryFn: () => attendanceORPCClient.status({}),
      refetchInterval: 60_000, // re-fetch every minute
    }),

  list: (params: {
    employeeId?: number;
    from?: string;
    to?: string;
    completionStatus?: "all" | "complete" | "incomplete";
  }) =>
    queryOptions({
      queryKey: ["attendance", "list", params],
      queryFn: () => attendanceORPCClient.listMarks(params),
    }),

  officeNetworks: () =>
    queryOptions({
      queryKey: ["attendance", "office-networks"],
      queryFn: () => attendanceORPCClient.listOfficeNetworks({}),
    }),
};
