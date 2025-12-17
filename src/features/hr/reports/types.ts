export type ReportGranularity = "day" | "week" | "month";

export interface EmployeeWorkData {
  employeeId: number;
  fullName: string;
  role: string;
  totalMinutes: number;
  totalOvertimeMinutes: number;
  // New metrics
  totalDays: number;
  avgDailyMinutes: number;
  overtimePercentage: number;

  dailyBreakdown: Record<string, number>;
  weeklyBreakdown: Record<string, number>;
  monthlyBreakdown: Record<string, number>;
}

export interface ReportData {
  granularity: ReportGranularity;
  period: {
    start: string;
    end: string;
  };
  selectedEmployees: EmployeeWorkData[];
  comparison?: {
    employee1Id: number;
    employee2Id: number;
    difference: number;
  };
}
