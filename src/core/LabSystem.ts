/// <reference path="../tda/LinkedList.ts" />
/// <reference path="../tda/Queue.ts" />
/// <reference path="../tda/Stack.ts" />
/// <reference path="../models/Models.ts" />

namespace Core {
  import Equipment = Models.Equipment;
  import EquipmentType = Models.EquipmentType;
  import WaitRequest = Models.WaitRequest;
  import ActiveLoan = Models.ActiveLoan;
  import LogEntry = Models.LogEntry;
  import OperationResult = Models.OperationResult;

  const TYPES: EquipmentType[] = ["LAPTOP", "KIT", "MULTIMETER"];

  export interface Metrics {
    byStatus: Record<string, number>;
    byType: Record<string, { total: number; inCart: number }>;
    cartOccupancy: Record<string, { used: number; capacity: number }>;
    immediateRequests: number;
    queuedRequests: number;
    averageWaitMin: number;
    directedLoans: number;
    totalDirectedMoves: number;
    damagedReturns: number;
    equipmentInMaintenance: number;
    currentlyOverdueLoans: number;
    mostLoanedEquipment: { code: string; loanCount: number } | null;
    preventiveMaintenanceCount: number;
  }

  export class LabSystem {
    private inventory = new TDA.LinkedList<Equipment>();
    private carts: Record<EquipmentType, TDA.Stack<Equipment>> = {
      LAPTOP: new TDA.Stack<Equipment>(),
      KIT: new TDA.Stack<Equipment>(),
      MULTIMETER: new TDA.Stack<Equipment>(),
    };
    private waitQueues: Record<EquipmentType, TDA.Queue<WaitRequest>> = {
      LAPTOP: new TDA.Queue<WaitRequest>(),
      KIT: new TDA.Queue<WaitRequest>(),
      MULTIMETER: new TDA.Queue<WaitRequest>(),
    };
    private reviewQueue = new TDA.Queue<Equipment>();
    private storageQueue = new TDA.Queue<Equipment>();
    private activeLoans = new Map<string, ActiveLoan>(); // code -> loan
    private log: LogEntry[] = [];

    private waitMinutesSum = 0;
    private servedWaitCount = 0;
    private immediateRequests = 0;
    private queuedRequests = 0;
    private directedLoans = 0;
    private totalDirectedMoves = 0;
    private damagedReturns = 0;
    private preventiveMaintenanceCount = 0;

    constructor(private cartCapacity: number = 5, private overdueHours: number = 4) {}


    private overdueMinutes(): number {
      return this.overdueHours * 60;
    }

    private log_(message: string, ok: boolean, time: number): void {
      this.log.unshift({ time, message, ok });
    }

    private hasEquipmentOfType(student: string, type: EquipmentType): boolean {
      for (const loan of this.activeLoans.values()) {
        if (loan.student === student && loan.type === type) return true;
      }
      return false;
    }

    private isAlreadyWaiting(student: string, type: EquipmentType): boolean {
      return this.waitQueues[type].some((r) => r.student === student);
    }

    private isOverdue(student: string, currentTime: number): boolean {
      for (const loan of this.activeLoans.values()) {
        if (loan.student === student && currentTime - loan.startTime > this.overdueMinutes()) {
          return true;
        }
      }
      return false;
    }

    // ---------- RF-01 ----------

    loadInventory(data: { code: string; type: EquipmentType }[]): OperationResult {
      for (const item of data) {
        const equipment: Equipment = { code: item.code, type: item.type, status: "IN_CART", loanCount: 0 };
        this.inventory.append(equipment);
        if (this.carts[item.type].size < this.cartCapacity) {
          this.carts[item.type].push(equipment);
        } else {
          equipment.status = "PENDING_STORAGE";
          this.storageQueue.enqueue(equipment);
        }
      }
      this.log_(`Inventory loaded: ${data.length} items.`, true, 0);
      return { ok: true, message: `${data.length} items were loaded.` };
    }

    // ---------- RF-02 ----------

    request(student: string, type: EquipmentType, time: number): OperationResult {
      if (this.isOverdue(student, time)) {
        const msg = `${student} is overdue and cannot request equipment.`;
        this.log_(msg, false, time);
        return { ok: false, message: msg, violatedRule: "R6" };
      }
      if (this.hasEquipmentOfType(student, type)) {
        const msg = `${student} already has a ${type} on loan.`;
        this.log_(msg, false, time);
        return { ok: false, message: msg, violatedRule: "R1" };
      }
      if (this.isAlreadyWaiting(student, type)) {
        const msg = `${student} is already in the ${type} wait queue.`;
        this.log_(msg, false, time);
        return { ok: false, message: msg, violatedRule: "R1" };
      }

      if (!this.carts[type].isEmpty()) {
        const equipment = this.loanInternal(type, student, time);
        this.immediateRequests++;
        const msg = `${student} received ${equipment!.code} immediately.`;
        this.log_(msg, true, time);
        return { ok: true, message: msg };
      }

      this.waitQueues[type].enqueue({ student, type, time });
      this.queuedRequests++;
      const msg = `No ${type} available. ${student} joined the wait queue.`;
      this.log_(msg, true, time);
      return { ok: true, message: msg };
    }

    // ---------- RF-03 ----------

    private loanInternal(type: EquipmentType, student: string, time: number): Equipment | null {
      const equipment = this.carts[type].pop();
      if (!equipment) return null;
      equipment.status = "LOANED";
      equipment.loanCount++;
      this.activeLoans.set(equipment.code, { student, code: equipment.code, type, startTime: time });
      return equipment;
    }

    loan(type: EquipmentType, student: string, time: number): OperationResult {
      if (this.carts[type].isEmpty()) {
        return { ok: false, message: `The ${type} cart is empty.`, violatedRule: "R2" };
      }
      const equipment = this.loanInternal(type, student, time);
      const msg = `${student} received ${equipment!.code}.`;
      this.log_(msg, true, time);
      return { ok: true, message: msg };
    }

    // ---------- RF-04 ----------

    directedLoan(code: string, student: string, time: number): OperationResult & { moves?: number } {
      const equipment = this.inventory.find((e) => e.code === code);
      if (!equipment || equipment.status !== "IN_CART") {
        const msg = `${code} is not available in a cart.`;
        this.log_(msg, false, time);
        return { ok: false, message: msg };
      }
      const cart = this.carts[equipment.type];
      const aux = new TDA.Stack<Equipment>();
      let moves = 0;
      let found = false;

      while (!cart.isEmpty()) {
        const current = cart.pop()!;
        moves++;
        if (current.code === code) {
          found = true;
          break;
        }
        aux.push(current);
      }

      // Restore the cart to its original order (minus the retrieved item).
      while (!aux.isEmpty()) {
        cart.push(aux.pop()!);
        moves++;
      }

      if (!found) {
        const msg = `${code} was not found in the cart (order restored).`;
        this.log_(msg, false, time);
        return { ok: false, message: msg, moves };
      }

      equipment.status = "LOANED";
      equipment.loanCount++;
      this.activeLoans.set(equipment.code, { student, code: equipment.code, type: equipment.type, startTime: time });
      this.directedLoans++;
      this.totalDirectedMoves += moves;

      const msg = `Directed loan: ${student} received ${code} (${moves} moves).`;
      this.log_(msg, true, time);
      return { ok: true, message: msg, moves };
    }

    // ---------- RF-05 ----------

    returnEquipment(code: string, time: number): OperationResult {
      const loan = this.activeLoans.get(code);
      const equipment = this.inventory.find((e) => e.code === code);
      if (!loan || !equipment) {
        const msg = `${code} has no active loan.`;
        this.log_(msg, false, time);
        return { ok: false, message: msg };
      }
      const duration = time - loan.startTime;
      const overdue = duration > this.overdueMinutes();
      this.activeLoans.delete(code);
      equipment.status = "IN_REVIEW";
      this.reviewQueue.enqueue(equipment);

      const msg = overdue
        ? `${code} returned OVERDUE (${duration} min) and sent to review.`
        : `${code} returned (${duration} min) and sent to review.`;
      this.log_(msg, true, time);
      return { ok: true, message: msg };
    }

    // ---------- RF-06 ----------

    review(result: "OK" | "DAMAGED", time: number): OperationResult {
      const equipment = this.reviewQueue.dequeue();
      if (!equipment) {
        return { ok: false, message: "The review queue is empty." };
      }

      if (result === "DAMAGED") {
        equipment.status = "MAINTENANCE";
        this.damagedReturns++;
        const msg = `${equipment.code} is damaged and moved to MAINTENANCE.`;
        this.log_(msg, true, time);
        return { ok: true, message: msg };
      }

      // R8: preventive maintenance after 5 accumulated loans.
      if (equipment.loanCount >= 5) {
        equipment.status = "MAINTENANCE";
        this.preventiveMaintenanceCount++;
        const msg = `${equipment.code} reached ${equipment.loanCount} loans and moved to preventive MAINTENANCE (R8).`;
        this.log_(msg, true, time);
        return { ok: true, message: msg };
      }

      // R7: capacity check before returning to the cart.
      if (this.carts[equipment.type].size < this.cartCapacity) {
        equipment.status = "IN_CART";
        this.carts[equipment.type].push(equipment);
        const msg = `${equipment.code} approved and stored in the ${equipment.type} cart.`;
        this.log_(msg, true, time);
        this.serveWaiting(equipment.type, time);
        return { ok: true, message: msg };
      }

      equipment.status = "PENDING_STORAGE";
      this.storageQueue.enqueue(equipment);
      const msg = `${equipment.code} approved but the ${equipment.type} cart is full; it joins the pending-storage queue (R7).`;
      this.log_(msg, true, time);
      return { ok: true, message: msg };
    }

    /** Manually frees a pending item into its cart once there is room. */
    storePending(time: number): OperationResult {
      const equipment = this.storageQueue.peekFront();
      if (!equipment) return { ok: false, message: "No equipment is pending storage." };
      if (this.carts[equipment.type].size >= this.cartCapacity) {
        return { ok: false, message: `The ${equipment.type} cart is still full.` };
      }
      this.storageQueue.dequeue();
      equipment.status = "IN_CART";
      this.carts[equipment.type].push(equipment);
      const msg = `${equipment.code} stored in the ${equipment.type} cart.`;
      this.log_(msg, true, time);
      this.serveWaiting(equipment.type, time);
      return { ok: true, message: msg };
    }

    // ---------- RF-07 ----------

    serveWaiting(type: EquipmentType, time: number): OperationResult {
      if (this.waitQueues[type].isEmpty() || this.carts[type].isEmpty()) {
        return { ok: false, message: "No one is waiting, or the cart is empty." };
      }
      const request = this.waitQueues[type].dequeue()!;
      const equipment = this.loanInternal(type, request.student, time);
      const wait = time - request.time;
      this.waitMinutesSum += wait;
      this.servedWaitCount++;
      const msg = `${request.student} was served from the ${type} wait queue (waited ${wait} min) and received ${equipment!.code}.`;
      this.log_(msg, true, time);
      return { ok: true, message: msg };
    }

    // ---------- RF-08 ----------

    find(code: string): { equipment: Equipment | null; positionInCart: number | null } {
      const equipment = this.inventory.find((e) => e.code === code) ?? null;
      if (!equipment || equipment.status !== "IN_CART") {
        return { equipment, positionInCart: null };
      }
      const cart = this.carts[equipment.type];
      const aux = new TDA.Stack<Equipment>();
      let position = 0;
      let found = false;

      while (!cart.isEmpty()) {
        const current = cart.pop()!;
        position++;
        aux.push(current);
        if (current.code === code) {
          found = true;
          break;
        }
      }
      while (!aux.isEmpty()) {
        cart.push(aux.pop()!);
      }

      return { equipment, positionInCart: found ? position : null };
    }

    // ---------- RF-09 ----------

    report(currentTime: number): Metrics {
      const items = this.inventory.toArray();
      const byStatus: Record<string, number> = {};
      const byType: Record<string, { total: number; inCart: number }> = {};
      let mostLoaned: { code: string; loanCount: number } | null = null;

      for (const t of TYPES) byType[t] = { total: 0, inCart: 0 };

      for (const eq of items) {
        byStatus[eq.status] = (byStatus[eq.status] ?? 0) + 1;
        byType[eq.type].total++;
        if (eq.status === "IN_CART") byType[eq.type].inCart++;
        if (!mostLoaned || eq.loanCount > mostLoaned.loanCount) {
          mostLoaned = { code: eq.code, loanCount: eq.loanCount };
        }
      }

      const cartOccupancy: Record<string, { used: number; capacity: number }> = {};
      for (const t of TYPES) {
        cartOccupancy[t] = { used: this.carts[t].size, capacity: this.cartCapacity };
      }

      let overdueNow = 0;
      for (const loan of this.activeLoans.values()) {
        if (currentTime - loan.startTime > this.overdueMinutes()) overdueNow++;
      }

      return {
        byStatus,
        byType,
        cartOccupancy,
        immediateRequests: this.immediateRequests,
        queuedRequests: this.queuedRequests,
        averageWaitMin: this.servedWaitCount ? this.waitMinutesSum / this.servedWaitCount : 0,
        directedLoans: this.directedLoans,
        totalDirectedMoves: this.totalDirectedMoves,
        damagedReturns: this.damagedReturns,
        equipmentInMaintenance: byStatus["MAINTENANCE"] ?? 0,
        currentlyOverdueLoans: overdueNow,
        mostLoanedEquipment: mostLoaned && mostLoaned.loanCount > 0 ? mostLoaned : null,
        preventiveMaintenanceCount: this.preventiveMaintenanceCount,
      };
    }

    // ---------- read-only views for the UI (RFE-01: UI never touches the TDAs) ----------

    getInventory(): Equipment[] {
      return this.inventory.toArray();
    }

    getCart(type: EquipmentType): Equipment[] {
      return this.carts[type].toArray(); // top of the stack first
    }

    getCapacity(): number {
      return this.cartCapacity;
    }

    getOverdueHours(): number {
      return this.overdueHours;
    }

    getWaitQueue(type: EquipmentType): WaitRequest[] {
      return this.waitQueues[type].toArray(); // front first
    }

    getReviewQueue(): Equipment[] {
      return this.reviewQueue.toArray();
    }

    getPendingStorage(): Equipment[] {
      return this.storageQueue.toArray();
    }

    getActiveLoans(): ActiveLoan[] {
      return Array.from(this.activeLoans.values());
    }

    getLog(): LogEntry[] {
      return this.log;
    }

    getTypes(): EquipmentType[] {
      return TYPES;
    }
  }
}
