namespace Models {
  export type EquipmentType = "LAPTOP" | "KIT" | "MULTIMETER";

  export type EquipmentStatus =
    | "IN_CART"
    | "LOANED"
    | "IN_REVIEW"
    | "MAINTENANCE"
    | "PENDING_STORAGE"; 

  export interface Equipment {
    code: string;
    type: EquipmentType;
    status: EquipmentStatus;
    loanCount: number;
  }

  export interface WaitRequest {
    student: string;
    type: EquipmentType;
    time: number;
  }

  export interface ActiveLoan {
    student: string;
    code: string;
    type: EquipmentType;
    startTime: number;
  }

  export interface LogEntry {
    time: number;
    message: string;
    ok: boolean;
  }

  export interface OperationResult {
    ok: boolean;
    message: string;
    violatedRule?: string;
  }
}
