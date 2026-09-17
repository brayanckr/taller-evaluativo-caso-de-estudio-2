namespace Models {
  export type EquipmentType = "PORTATIL" | "KIT" | "MULTIMETRO";

  export type EquipmentStatus =
    | "EN_CARRO"
    | "PRESTADO"
    | "EN_REVISION"
    | "MANTENIMIENTO"
    | "POR_GUARDAR"; // waiting for free slot in the cart 

  export interface Equipment {
    codigo: string;
    tipo: EquipmentType;
    estado: EquipmentStatus;
    prestamos: number;
  }

  export interface WaitRequest {
    estudiante: string;
    tipo: EquipmentType;
    hora: number;
  }

  export interface ActiveLoan {
    estudiante: string;
    codigo: string;
    tipo: EquipmentType;
    horaInicio: number;
  }

  export interface LogEntry {
    hora: number;
    mensaje: string;
    ok: boolean;
  }

  export interface OperationResult {
    ok: boolean;
    mensaje: string;
    reglaViolada?: string;
  }
}
