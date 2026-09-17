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

  const TYPES: EquipmentType[] = ["PORTATIL", "KIT", "MULTIMETRO"];

  export interface Metrics {
    porEstado: Record<string, number>;
    porTipo: Record<string, { total: number; enCarro: number }>;
    ocupacionCarros: Record<string, { usados: number; capacidad: number }>;
    solicitudesInmediatas: number;
    solicitudesConEspera: number;
    esperaPromedioMin: number;
    prestamosDirigidos: number;
    movimientosDirigidosTotal: number;
    devolucionesConDano: number;
    equiposEnMantenimiento: number;
    equiposEnMoraActual: number;
    equipoMasPrestado: { codigo: string; prestamos: number } | null;
    mantenimientoPreventivo: number;
  }


  export class LabSystem {
    private inventory = new TDA.LinkedList<Equipment>();
    private carts: Record<EquipmentType, TDA.Stack<Equipment>> = {
      PORTATIL: new TDA.Stack<Equipment>(),
      KIT: new TDA.Stack<Equipment>(),
      MULTIMETRO: new TDA.Stack<Equipment>(),
    };
    private waitQueues: Record<EquipmentType, TDA.Queue<WaitRequest>> = {
      PORTATIL: new TDA.Queue<WaitRequest>(),
      KIT: new TDA.Queue<WaitRequest>(),
      MULTIMETRO: new TDA.Queue<WaitRequest>(),
    };
    private reviewQueue = new TDA.Queue<Equipment>();
    private storageQueue = new TDA.Queue<Equipment>();
    private activeLoans = new Map<string, ActiveLoan>(); // codigo -> loan
    private log: LogEntry[] = [];

    private sumaEsperaMin = 0;
    private conteoEsperasAtendidas = 0;
    private solicitudesInmediatas = 0;
    private solicitudesConEspera = 0;
    private prestamosDirigidos = 0;
    private movimientosDirigidosTotal = 0;
    private devolucionesConDano = 0;
    private mantenimientoPreventivo = 0;

    constructor(private capacidadCarro: number = 5, private horasMora: number = 4) {}

    // ---------- helpers ----------

    private minutosMora(): number {
      return this.horasMora * 60;
    }

    private registrar(mensaje: string, ok: boolean, hora: number): void {
      this.log.unshift({ hora, mensaje, ok });
    }

    private tieneEquipoDeTipo(estudiante: string, tipo: EquipmentType): boolean {
      for (const loan of this.activeLoans.values()) {
        if (loan.estudiante === estudiante && loan.tipo === tipo) return true;
      }
      return false;
    }

    private yaEnEspera(estudiante: string, tipo: EquipmentType): boolean {
      return this.waitQueues[tipo].some((r) => r.estudiante === estudiante);
    }

    private estaEnMora(estudiante: string, horaActual: number): boolean {
      for (const loan of this.activeLoans.values()) {
        if (loan.estudiante === estudiante && horaActual - loan.horaInicio > this.minutosMora()) {
          return true;
        }
      }
      return false;
    }

    //RF-01

    cargarInventario(datos: { codigo: string; tipo: EquipmentType }[]): OperationResult {
      for (const item of datos) {
        const equipo: Equipment = { codigo: item.codigo, tipo: item.tipo, estado: "EN_CARRO", prestamos: 0 };
        this.inventory.append(equipo);
        if (this.carts[item.tipo].size < this.capacidadCarro) {
          this.carts[item.tipo].push(equipo);
        } else {
          equipo.estado = "POR_GUARDAR";
          this.storageQueue.enqueue(equipo);
        }
      }
      this.registrar(`Inventario cargado: ${datos.length} equipos.`, true, 0);
      return { ok: true, mensaje: `Se cargaron ${datos.length} equipos.` };
    }

    //RF-02 

    solicitar(estudiante: string, tipo: EquipmentType, hora: number): OperationResult {
      if (this.estaEnMora(estudiante, hora)) {
        const msg = `${estudiante} está en mora y no puede solicitar equipos.`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg, reglaViolada: "R6" };
      }
      if (this.tieneEquipoDeTipo(estudiante, tipo)) {
        const msg = `${estudiante} ya tiene un equipo de tipo ${tipo}.`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg, reglaViolada: "R1" };
      }
      if (this.yaEnEspera(estudiante, tipo)) {
        const msg = `${estudiante} ya está en la cola de espera de ${tipo}.`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg, reglaViolada: "R1" };
      }

      if (!this.carts[tipo].isEmpty()) {
        const equipo = this.prestarInterno(tipo, estudiante, hora);
        this.solicitudesInmediatas++;
        const msg = `${estudiante} recibió ${equipo!.codigo} de inmediato.`;
        this.registrar(msg, true, hora);
        return { ok: true, mensaje: msg };
      }

      this.waitQueues[tipo].enqueue({ estudiante, tipo, hora });
      this.solicitudesConEspera++;
      const msg = `No hay ${tipo} disponible. ${estudiante} entró a la cola de espera.`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg };
    }

    // RF-03 

    private prestarInterno(tipo: EquipmentType, estudiante: string, hora: number): Equipment | null {
      const equipo = this.carts[tipo].pop();
      if (!equipo) return null;
      equipo.estado = "PRESTADO";
      equipo.prestamos++;
      this.activeLoans.set(equipo.codigo, { estudiante, codigo: equipo.codigo, tipo, horaInicio: hora });
      return equipo;
    }

    prestar(tipo: EquipmentType, estudiante: string, hora: number): OperationResult {
      if (this.carts[tipo].isEmpty()) {
        return { ok: false, mensaje: `El carro de ${tipo} está vacío.`, reglaViolada: "R2" };
      }
      const equipo = this.prestarInterno(tipo, estudiante, hora);
      const msg = `${estudiante} recibió ${equipo!.codigo}.`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg };
    }

    // RF-04 

    prestarDirigido(codigo: string, estudiante: string, hora: number): OperationResult & { movimientos?: number } {
      const equipo = this.inventory.find((e) => e.codigo === codigo);
      if (!equipo || equipo.estado !== "EN_CARRO") {
        const msg = `${codigo} no está disponible en un carro.`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg };
      }
      const cart = this.carts[equipo.tipo];
      const aux = new TDA.Stack<Equipment>();
      let movimientos = 0;
      let encontrado = false;

      while (!cart.isEmpty()) {
        const actual = cart.pop()!;
        movimientos++;
        if (actual.codigo === codigo) {
          encontrado = true;
          break;
        }
        aux.push(actual);
      }
.
      while (!aux.isEmpty()) {
        cart.push(aux.pop()!);
        movimientos++;
      }

      if (!encontrado) {
        const msg = `${codigo} no se encontró en el carro (orden restaurado).`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg, movimientos };
      }

      equipo.estado = "PRESTADO";
      equipo.prestamos++;
      this.activeLoans.set(equipo.codigo, { estudiante, codigo: equipo.codigo, tipo: equipo.tipo, horaInicio: hora });
      this.prestamosDirigidos++;
      this.movimientosDirigidosTotal += movimientos;

      const msg = `Préstamo dirigido: ${estudiante} recibió ${codigo} (${movimientos} movimientos).`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg, movimientos };
    }

    // RF-05 

    devolver(codigo: string, hora: number): OperationResult {
      const loan = this.activeLoans.get(codigo);
      const equipo = this.inventory.find((e) => e.codigo === codigo);
      if (!loan || !equipo) {
        const msg = `${codigo} no tiene un préstamo activo.`;
        this.registrar(msg, false, hora);
        return { ok: false, mensaje: msg };
      }
      const duracion = hora - loan.horaInicio;
      const enMora = duracion > this.minutosMora();
      this.activeLoans.delete(codigo);
      equipo.estado = "EN_REVISION";
      this.reviewQueue.enqueue(equipo);

      const msg = enMora
        ? `${codigo} devuelto EN MORA (${duracion} min) y enviado a revisión.`
        : `${codigo} devuelto (${duracion} min) y enviado a revisión.`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg };
    }

    // RF-06

    revisar(resultado: "OK" | "DANO", hora: number): OperationResult {
      const equipo = this.reviewQueue.dequeue();
      if (!equipo) {
        return { ok: false, mensaje: "La cola de revisión está vacía." };
      }

      if (resultado === "DANO") {
        equipo.estado = "MANTENIMIENTO";
        this.devolucionesConDano++;
        const msg = `${equipo.codigo} tiene daño y pasó a MANTENIMIENTO.`;
        this.registrar(msg, true, hora);
        return { ok: true, mensaje: msg };
      }

      if (equipo.prestamos >= 5) {
        equipo.estado = "MANTENIMIENTO";
        this.mantenimientoPreventivo++;
        const msg = `${equipo.codigo} alcanzó ${equipo.prestamos} préstamos y pasó a MANTENIMIENTO preventivo (R8).`;
        this.registrar(msg, true, hora);
        return { ok: true, mensaje: msg };
      }

      if (this.carts[equipo.tipo].size < this.capacidadCarro) {
        equipo.estado = "EN_CARRO";
        this.carts[equipo.tipo].push(equipo);
        const msg = `${equipo.codigo} aprobado y guardado en el carro de ${equipo.tipo}.`;
        this.registrar(msg, true, hora);
        this.atenderEspera(equipo.tipo, hora);
        return { ok: true, mensaje: msg };
      }

      equipo.estado = "POR_GUARDAR";
      this.storageQueue.enqueue(equipo);
      const msg = `${equipo.codigo} aprobado pero el carro de ${equipo.tipo} está lleno; entra a la cola por guardar (R7).`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg };
    }

    guardarPendiente(hora: number): OperationResult {
      const equipo = this.storageQueue.peekFront();
      if (!equipo) return { ok: false, mensaje: "No hay equipos pendientes por guardar." };
      if (this.carts[equipo.tipo].size >= this.capacidadCarro) {
        return { ok: false, mensaje: `El carro de ${equipo.tipo} sigue lleno.` };
      }
      this.storageQueue.dequeue();
      equipo.estado = "EN_CARRO";
      this.carts[equipo.tipo].push(equipo);
      const msg = `${equipo.codigo} guardado en el carro de ${equipo.tipo}.`;
      this.registrar(msg, true, hora);
      this.atenderEspera(equipo.tipo, hora);
      return { ok: true, mensaje: msg };
    }

    // RF-07 

    atenderEspera(tipo: EquipmentType, hora: number): OperationResult {
      if (this.waitQueues[tipo].isEmpty() || this.carts[tipo].isEmpty()) {
        return { ok: false, mensaje: "No hay solicitud en espera o el carro está vacío." };
      }
      const solicitud = this.waitQueues[tipo].dequeue()!;
      const equipo = this.prestarInterno(tipo, solicitud.estudiante, hora);
      const espera = hora - solicitud.hora;
      this.sumaEsperaMin += espera;
      this.conteoEsperasAtendidas++;
      const msg = `${solicitud.estudiante} fue atendido desde la cola de espera de ${tipo} (esperó ${espera} min) y recibió ${equipo!.codigo}.`;
      this.registrar(msg, true, hora);
      return { ok: true, mensaje: msg };
    }

    // RF-08 

    buscar(codigo: string): { equipo: Equipment | null; posicionEnCarro: number | null } {
      const equipo = this.inventory.find((e) => e.codigo === codigo) ?? null;
      if (!equipo || equipo.estado !== "EN_CARRO") {
        return { equipo, posicionEnCarro: null };
      }
      const cart = this.carts[equipo.tipo];
      const aux = new TDA.Stack<Equipment>();
      let posicion = 0;
      let encontrado = false;

      while (!cart.isEmpty()) {
        const actual = cart.pop()!;
        posicion++;
        aux.push(actual);
        if (actual.codigo === codigo) {
          encontrado = true;
          break;
        }
      }
      while (!aux.isEmpty()) {
        cart.push(aux.pop()!);
      }

      return { equipo, posicionEnCarro: encontrado ? posicion : null };
    }

    // RF-09 

    reporte(horaActual: number): Metrics {
      const items = this.inventory.toArray();
      const porEstado: Record<string, number> = {};
      const porTipo: Record<string, { total: number; enCarro: number }> = {};
      let masPrestado: { codigo: string; prestamos: number } | null = null;

      for (const t of TYPES) porTipo[t] = { total: 0, enCarro: 0 };

      for (const eq of items) {
        porEstado[eq.estado] = (porEstado[eq.estado] ?? 0) + 1;
        porTipo[eq.tipo].total++;
        if (eq.estado === "EN_CARRO") porTipo[eq.tipo].enCarro++;
        if (!masPrestado || eq.prestamos > masPrestado.prestamos) {
          masPrestado = { codigo: eq.codigo, prestamos: eq.prestamos };
        }
      }

      const ocupacionCarros: Record<string, { usados: number; capacidad: number }> = {};
      for (const t of TYPES) {
        ocupacionCarros[t] = { usados: this.carts[t].size, capacidad: this.capacidadCarro };
      }

      let enMoraActual = 0;
      for (const loan of this.activeLoans.values()) {
        if (horaActual - loan.horaInicio > this.minutosMora()) enMoraActual++;
      }

      return {
        porEstado,
        porTipo,
        ocupacionCarros,
        solicitudesInmediatas: this.solicitudesInmediatas,
        solicitudesConEspera: this.solicitudesConEspera,
        esperaPromedioMin: this.conteoEsperasAtendidas ? this.sumaEsperaMin / this.conteoEsperasAtendidas : 0,
        prestamosDirigidos: this.prestamosDirigidos,
        movimientosDirigidosTotal: this.movimientosDirigidosTotal,
        devolucionesConDano: this.devolucionesConDano,
        equiposEnMantenimiento: porEstado["MANTENIMIENTO"] ?? 0,
        equiposEnMoraActual: enMoraActual,
        equipoMasPrestado: masPrestado && masPrestado.prestamos > 0 ? masPrestado : null,
        mantenimientoPreventivo: this.mantenimientoPreventivo,
      };
    }


    getInventario(): Equipment[] {
      return this.inventory.toArray();
    }

    getCarro(tipo: EquipmentType): Equipment[] {
      return this.carts[tipo].toArray(); // top of the stack first
    }

    getCapacidad(): number {
      return this.capacidadCarro;
    }

    getHorasMora(): number {
      return this.horasMora;
    }

    getEspera(tipo: EquipmentType): WaitRequest[] {
      return this.waitQueues[tipo].toArray(); // front first
    }

    getRevision(): Equipment[] {
      return this.reviewQueue.toArray();
    }

    getPorGuardar(): Equipment[] {
      return this.storageQueue.toArray();
    }

    getPrestamosActivos(): ActiveLoan[] {
      return Array.from(this.activeLoans.values());
    }

    getBitacora(): LogEntry[] {
      return this.log;
    }

    getTipos(): EquipmentType[] {
      return TYPES;
    }
  }
}
