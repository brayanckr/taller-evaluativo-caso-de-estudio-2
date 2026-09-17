/// <reference path="../core/LabSystem.ts" />

namespace UI {
  import EquipmentType = Models.EquipmentType;

  const sistema = new Core.LabSystem(4, 4); // K=4 equipos por carro, H=4 horas de mora
  let horaActual = 480; // 08:00 en minutos del día, punto de partida de la jornada

  const SAMPLE_DATA: { codigo: string; tipo: EquipmentType }[] = [
    { codigo: "PORT-01", tipo: "PORTATIL" },
    { codigo: "PORT-02", tipo: "PORTATIL" },
    { codigo: "PORT-03", tipo: "PORTATIL" },
    { codigo: "PORT-04", tipo: "PORTATIL" },
    { codigo: "PORT-05", tipo: "PORTATIL" },
    { codigo: "KIT-01", tipo: "KIT" },
    { codigo: "KIT-02", tipo: "KIT" },
    { codigo: "KIT-03", tipo: "KIT" },
    { codigo: "MULT-01", tipo: "MULTIMETRO" },
    { codigo: "MULT-02", tipo: "MULTIMETRO" },
    { codigo: "MULT-03", tipo: "MULTIMETRO" },
    { codigo: "MULT-04", tipo: "MULTIMETRO" },
    { codigo: "MULT-05", tipo: "MULTIMETRO" },
  ];

  function $(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`No existe el elemento #${id}`);
    return el;
  }

  function fmtHora(min: number): string {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function avanzarHora(minutos: number): void {
    horaActual += minutos;
    $("reloj").textContent = `${fmtHora(horaActual)} (min ${horaActual})`;
  }

  function mostrarMensaje(texto: string, ok: boolean, regla?: string): void {
    const box = $("mensaje");
    box.textContent = regla ? `${texto} [Regla violada: ${regla}]` : texto;
    box.className = ok ? "mensaje ok" : "mensaje error";
  }

  // ---------------- navigation ----------------

  function irA(pantalla: string): void {
    document.querySelectorAll<HTMLElement>(".pantalla").forEach((p) => (p.hidden = p.dataset["pantalla"] !== pantalla));
    document.querySelectorAll<HTMLElement>(".tab").forEach((t) => t.classList.toggle("activo", t.dataset["tab"] === pantalla));
    renderTodo();
  }

  // ---------------- rendering ----------------

  function renderTodo(): void {
    renderInventario();
    renderMostrador();
    renderCarros();
    renderRevision();
    renderBitacora();
    renderMetricas();
  }

  function renderInventario(): void {
    const filtroTipo = ($("filtroTipo") as HTMLSelectElement).value;
    const filtroEstado = ($("filtroEstado") as HTMLSelectElement).value;
    let items = sistema.getInventario();
    if (filtroTipo !== "TODOS") items = items.filter((e) => e.tipo === filtroTipo);
    if (filtroEstado !== "TODOS") items = items.filter((e) => e.estado === filtroEstado);

    const tbody = $("tablaInventario");
    tbody.innerHTML = items
      .map(
        (e) => `<tr>
          <td>${e.codigo}</td><td>${e.tipo}</td>
          <td><span class="badge badge-${e.estado}">${e.estado.replace("_", " ")}</span></td>
          <td>${e.prestamos}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="4" class="vacio">Sin equipos que coincidan con el filtro.</td></tr>`;
  }

  function buscarEquipo(): void {
    const codigo = ($("buscarCodigo") as HTMLInputElement).value.trim();
    const resultado = $("resultadoBusqueda");
    if (!codigo) {
      resultado.textContent = "";
      return;
    }
    const { equipo, posicionEnCarro } = sistema.buscar(codigo);
    if (!equipo) {
      resultado.textContent = `${codigo} no existe en el inventario.`;
      return;
    }
    resultado.textContent =
      posicionEnCarro !== null
        ? `${equipo.codigo}: estado ${equipo.estado}, posición ${posicionEnCarro} desde el tope del carro.`
        : `${equipo.codigo}: estado ${equipo.estado} (no está en un carro).`;
  }

  function renderMostrador(): void {
    const tipos = sistema.getTipos();
    const colasHtml = tipos
      .map((t) => {
        const cola = sistema.getEspera(t);
        return `<div class="cola-tipo">
          <h4>${t}</h4>
          <div class="cola-visual">
            ${
              cola.length
                ? cola
                    .map(
                      (r, i) =>
                        `<div class="ficha ${i === 0 ? "frente" : ""}">${r.estudiante}${i === 0 ? "<small>FRENTE</small>" : ""}</div>`
                    )
                    .join('<span class="flecha">→</span>')
                : '<span class="vacio">Cola vacía</span>'
            }
          </div>
          <p class="contador">Esperando: ${cola.length} · Disponibles en carro: ${sistema.getCarro(t).length}</p>
        </div>`;
      })
      .join("");
    $("colasEspera").innerHTML = colasHtml;

    const selects = document.querySelectorAll<HTMLSelectElement>(".select-tipo");
    selects.forEach((sel) => {
      if (sel.options.length === 0) {
        sistema.getTipos().forEach((t) => sel.add(new Option(t, t)));
      }
    });
  }

  function renderCarros(): void {
    const cont = $("carros");
    cont.innerHTML = sistema
      .getTipos()
      .map((t) => {
        const pila = sistema.getCarro(t);
        return `<div class="carro">
          <h4>${t} <small>(${pila.length}/${sistema.getCapacidad()})</small></h4>
          <div class="carro-visual">
            ${
              pila.length
                ? pila.map((e, i) => `<div class="equipo-pila ${i === 0 ? "tope" : ""}">${e.codigo}${i === 0 ? "<small>TOPE</small>" : ""}</div>`).join("")
                : '<span class="vacio">Carro vacío</span>'
            }
          </div>
        </div>`;
      })
      .join("");
  }

  function renderCarroAuxiliarPreview(): void {
    // El movimiento paso a paso del carro auxiliar se explica en el mensaje de resultado
    // (RFE-03): el sistema no anima cada paso, pero informa el conteo de movimientos.
  }

  function renderRevision(): void {
    const revision = sistema.getRevision();
    $("colaRevision").innerHTML = revision.length
      ? revision.map((e, i) => `<div class="ficha ${i === 0 ? "frente" : ""}">${e.codigo}${i === 0 ? "<small>FRENTE</small>" : ""}</div>`).join('<span class="flecha">→</span>')
      : '<span class="vacio">Cola de revisión vacía</span>';

    const guardar = sistema.getPorGuardar();
    $("colaGuardar").innerHTML = guardar.length
      ? guardar.map((e, i) => `<div class="ficha ${i === 0 ? "frente" : ""}">${e.codigo}${i === 0 ? "<small>FRENTE</small>" : ""}</div>`).join('<span class="flecha">→</span>')
      : '<span class="vacio">Sin equipos pendientes por guardar</span>';
  }

  function renderBitacora(): void {
    const log = sistema.getBitacora();
    $("bitacora").innerHTML = log.length
      ? log.map((l) => `<li class="${l.ok ? "log-ok" : "log-error"}">[${fmtHora(l.hora)}] ${l.mensaje}</li>`).join("")
      : `<li class="vacio">Sin operaciones registradas.</li>`;
  }

  function renderMetricas(): void {
    const m = sistema.reporte(horaActual);
    const tipos = sistema.getTipos();
    $("metricas").innerHTML = `
      <div class="metrica-grupo">
        <h4>Ocupación de carros</h4>
        ${tipos.map((t) => `<p>${t}: ${m.ocupacionCarros[t].usados}/${m.ocupacionCarros[t].capacidad}</p>`).join("")}
      </div>
      <div class="metrica-grupo">
        <h4>Equipos por estado</h4>
        ${Object.entries(m.porEstado).map(([k, v]) => `<p>${k.replace("_", " ")}: ${v}</p>`).join("") || "<p>Sin datos</p>"}
      </div>
      <div class="metrica-grupo">
        <h4>Atención de solicitudes</h4>
        <p>Inmediatas: ${m.solicitudesInmediatas}</p>
        <p>Con espera: ${m.solicitudesConEspera}</p>
        <p>Espera promedio: ${m.esperaPromedioMin.toFixed(1)} min</p>
      </div>
      <div class="metrica-grupo">
        <h4>Préstamo dirigido</h4>
        <p>Realizados: ${m.prestamosDirigidos}</p>
        <p>Movimientos totales: ${m.movimientosDirigidosTotal}</p>
      </div>
      <div class="metrica-grupo">
        <h4>Mantenimiento y mora</h4>
        <p>Devoluciones con daño: ${m.devolucionesConDano}</p>
        <p>En mantenimiento: ${m.equiposEnMantenimiento}</p>
        <p>Mantenimiento preventivo (R8): ${m.mantenimientoPreventivo}</p>
        <p>Préstamos en mora ahora: ${m.equiposEnMoraActual}</p>
      </div>
      <div class="metrica-grupo">
        <h4>Equipo más prestado</h4>
        <p>${m.equipoMasPrestado ? `${m.equipoMasPrestado.codigo} (${m.equipoMasPrestado.prestamos} préstamos)` : "Sin préstamos aún"}</p>
      </div>
    `;
  }

  // ---------------- actions wired to buttons ----------------

  function accionCargarDatos(): void {
    const r = sistema.cargarInventario(SAMPLE_DATA);
    mostrarMensaje(r.mensaje, r.ok);
    renderTodo();
  }

  function accionAltaEquipo(): void {
    const codigo = ($("altaCodigo") as HTMLInputElement).value.trim();
    const tipo = ($("altaTipo") as HTMLSelectElement).value as EquipmentType;
    if (!codigo) return;
    const r = sistema.cargarInventario([{ codigo, tipo }]);
    mostrarMensaje(r.mensaje, r.ok);
    ($("altaCodigo") as HTMLInputElement).value = "";
    renderTodo();
  }

  function accionSolicitar(): void {
    const estudiante = ($("solEstudiante") as HTMLInputElement).value.trim();
    const tipo = ($("solTipo") as HTMLSelectElement).value as EquipmentType;
    if (!estudiante) return;
    const r = sistema.solicitar(estudiante, tipo, horaActual);
    mostrarMensaje(r.mensaje, r.ok, r.reglaViolada);
    renderTodo();
  }

  function accionDevolver(): void {
    const codigo = ($("devCodigo") as HTMLInputElement).value.trim();
    if (!codigo) return;
    const r = sistema.devolver(codigo, horaActual);
    mostrarMensaje(r.mensaje, r.ok, r.reglaViolada);
    ($("devCodigo") as HTMLInputElement).value = "";
    renderTodo();
  }

  function accionPrestamoDirigido(): void {
    const codigo = ($("dirCodigo") as HTMLInputElement).value.trim();
    const estudiante = ($("dirEstudiante") as HTMLInputElement).value.trim();
    if (!codigo || !estudiante) return;
    const r = sistema.prestarDirigido(codigo, estudiante, horaActual);
    mostrarMensaje(r.mensaje + (r.movimientos !== undefined ? ` (${r.movimientos} movimientos)` : ""), r.ok);
    renderTodo();
  }

  function accionRevisar(resultado: "OK" | "DANO"): void {
    const r = sistema.revisar(resultado, horaActual);
    mostrarMensaje(r.mensaje, r.ok);
    renderTodo();
  }

  function accionGuardarPendiente(): void {
    const r = sistema.guardarPendiente(horaActual);
    mostrarMensaje(r.mensaje, r.ok);
    renderTodo();
  }

  function accionAvanzarTiempo(): void {
    avanzarHora(30);
    renderTodo();
  }

  // ---------------- bootstrap ----------------

  export function iniciar(): void {
    $("reloj").textContent = `${fmtHora(horaActual)} (min ${horaActual})`;

    document.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      tab.addEventListener("click", () => irA(tab.dataset["tab"]!));
    });

    $("btnCargarDatos").addEventListener("click", accionCargarDatos);
    $("btnAvanzarTiempo").addEventListener("click", accionAvanzarTiempo);
    $("btnAlta").addEventListener("click", accionAltaEquipo);
    $("filtroTipo").addEventListener("change", renderInventario);
    $("filtroEstado").addEventListener("change", renderInventario);
    $("buscarCodigo").addEventListener("input", buscarEquipo);
    $("btnSolicitar").addEventListener("click", accionSolicitar);
    $("btnDevolver").addEventListener("click", accionDevolver);
    $("btnDirigido").addEventListener("click", accionPrestamoDirigido);
    $("btnRevisarOk").addEventListener("click", () => accionRevisar("OK"));
    $("btnRevisarDano").addEventListener("click", () => accionRevisar("DANO"));
    $("btnGuardarPendiente").addEventListener("click", accionGuardarPendiente);

    renderTodo();
  }
}

window.addEventListener("DOMContentLoaded", UI.iniciar);
