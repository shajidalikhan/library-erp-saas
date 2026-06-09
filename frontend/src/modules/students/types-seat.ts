export interface StudentMySeatShift {
  name: string;
  startTime: string;
  endTime: string;
  type: string;
}

export interface StudentMySeat {
  seatNumber: string;
  floor: string;
  zone: string;
  seatType: string;
  shifts?: StudentMySeatShift[];
  shiftType?: string | null;
  status: string;
  occupied: boolean;
  notes: string | null;
  branchName: string | null;
  branchCode: string | null;
  assignedAt: string | null;
}
