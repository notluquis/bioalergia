export interface EmployeeWorkData {
  avgDailyMinutes: number;
  dailyBreakdown: Record<string, number>;
  employeeId: number;
  fullName: string;
  monthlyBreakdown: Record<string, number>;
  monthlyGrossSalary: Record<string, number>;
  monthlyNetSalary: Record<string, number>;
  overtimePercentage: number;
  role: string;
  // New metrics
  totalDays: number;

  totalMinutes: number;
  totalOvertimeMinutes: number;
  weeklyBreakdown: Record<string, number>;
}

export interface ReportData {
  comparison?: {
    difference: number;
    employee1Id: number;
    employee2Id: number;
  };
  granularity: ReportGranularity;
  period: {
    end: string;
    start: string;
  };
  selectedEmployees: EmployeeWorkData[];
}

export type ReportGranularity = "day" | "month" | "week";
