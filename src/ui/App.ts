/// <reference path="../core/LabSystem.ts" />

namespace UI {
  import EquipmentType = Models.EquipmentType;

  const system = new Core.LabSystem(4, 4); // K=4 items per cart, H=4 overdue hours
  let currentTime = 480; 

  const SAMPLE_DATA: { code: string; type: EquipmentType }[] = [
    { code: "LAP-01", type: "LAPTOP" },
    { code: "LAP-02", type: "LAPTOP" },
    { code: "LAP-03", type: "LAPTOP" },
    { code: "LAP-04", type: "LAPTOP" },
    { code: "LAP-05", type: "LAPTOP" },
    { code: "KIT-01", type: "KIT" },
    { code: "KIT-02", type: "KIT" },
    { code: "KIT-03", type: "KIT" },
    { code: "MULT-01", type: "MULTIMETER" },
    { code: "MULT-02", type: "MULTIMETER" },
    { code: "MULT-03", type: "MULTIMETER" },
    { code: "MULT-04", type: "MULTIMETER" },
    { code: "MULT-05", type: "MULTIMETER" },
  ];

  function $(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element #${id} does not exist`);
    return el;
  }

  function formatTime(min: number): string {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function advanceTime(minutes: number): void {
    currentTime += minutes;
    $("clock").textContent = `${formatTime(currentTime)} (min ${currentTime})`;
  }

  function showMessage(text: string, ok: boolean, rule?: string): void {
    const box = $("message");
    box.textContent = rule ? `${text} [Violated rule: ${rule}]` : text;
    box.className = ok ? "message ok" : "message error";
  }


  function goTo(screen: string): void {
    document.querySelectorAll<HTMLElement>(".screen").forEach((p) => (p.hidden = p.dataset["screen"] !== screen));
    document.querySelectorAll<HTMLElement>(".tab").forEach((t) => t.classList.toggle("active", t.dataset["tab"] === screen));
    renderAll();
  }


  function renderAll(): void {
    renderInventory();
    renderDesk();
    renderCarts();
    renderReview();
    renderLog();
    renderMetrics();
  }

  function renderInventory(): void {
    const typeFilter = ($("filterType") as HTMLSelectElement).value;
    const statusFilter = ($("filterStatus") as HTMLSelectElement).value;
    let items = system.getInventory();
    if (typeFilter !== "ALL") items = items.filter((e) => e.type === typeFilter);
    if (statusFilter !== "ALL") items = items.filter((e) => e.status === statusFilter);

    const tbody = $("inventoryTable");
    tbody.innerHTML = items
      .map(
        (e) => `<tr>
          <td>${e.code}</td><td>${e.type}</td>
          <td><span class="badge badge-${e.status}">${e.status.replace("_", " ")}</span></td>
          <td>${e.loanCount}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="4" class="empty">No equipment matches the filter.</td></tr>`;
  }

  function findEquipment(): void {
    const code = ($("searchCode") as HTMLInputElement).value.trim();
    const resultBox = $("searchResult");
    if (!code) {
      resultBox.textContent = "";
      return;
    }
    const { equipment, positionInCart } = system.find(code);
    if (!equipment) {
      resultBox.textContent = `${code} does not exist in the inventory.`;
      return;
    }
    resultBox.textContent =
      positionInCart !== null
        ? `${equipment.code}: status ${equipment.status}, position ${positionInCart} from the top of the cart.`
        : `${equipment.code}: status ${equipment.status} (not currently in a cart).`;
  }

  function renderDesk(): void {
    const types = system.getTypes();
    const queuesHtml = types
      .map((t) => {
        const queue = system.getWaitQueue(t);
        return `<div class="queue-type">
          <h4>${t}</h4>
          <div class="queue-visual">
            ${
              queue.length
                ? queue
                    .map(
                      (r, i) =>
                        `<div class="chip ${i === 0 ? "front" : ""}">${r.student}${i === 0 ? "<small>FRONT</small>" : ""}</div>`
                    )
                    .join('<span class="arrow">&rarr;</span>')
                : '<span class="empty">Empty queue</span>'
            }
          </div>
          <p class="counter">Waiting: ${queue.length} &middot; Available in cart: ${system.getCart(t).length}</p>
        </div>`;
      })
      .join("");
    $("waitQueues").innerHTML = queuesHtml;

    const selects = document.querySelectorAll<HTMLSelectElement>(".select-type");
    selects.forEach((sel) => {
      if (sel.options.length === 0) {
        system.getTypes().forEach((t) => sel.add(new Option(t, t)));
      }
    });
  }

  function renderCarts(): void {
    const container = $("carts");
    container.innerHTML = system
      .getTypes()
      .map((t) => {
        const stack = system.getCart(t);
        return `<div class="cart">
          <h4>${t} <small>(${stack.length}/${system.getCapacity()})</small></h4>
          <div class="cart-visual">
            ${
              stack.length
                ? stack.map((e, i) => `<div class="stack-item ${i === 0 ? "top" : ""}">${e.code}${i === 0 ? "<small>TOP</small>" : ""}</div>`).join("")
                : '<span class="empty">Empty cart</span>'
            }
          </div>
        </div>`;
      })
      .join("");
  }

  function renderReview(): void {
    const review = system.getReviewQueue();
    $("reviewQueue").innerHTML = review.length
      ? review.map((e, i) => `<div class="chip ${i === 0 ? "front" : ""}">${e.code}${i === 0 ? "<small>FRONT</small>" : ""}</div>`).join('<span class="arrow">&rarr;</span>')
      : '<span class="empty">Review queue is empty</span>';

    const pending = system.getPendingStorage();
    $("storageQueue").innerHTML = pending.length
      ? pending.map((e, i) => `<div class="chip ${i === 0 ? "front" : ""}">${e.code}${i === 0 ? "<small>FRONT</small>" : ""}</div>`).join('<span class="arrow">&rarr;</span>')
      : '<span class="empty">No equipment pending storage</span>';
  }

  function renderLog(): void {
    const log = system.getLog();
    $("log").innerHTML = log.length
      ? log.map((l) => `<li class="${l.ok ? "log-ok" : "log-error"}">[${formatTime(l.time)}] ${l.message}</li>`).join("")
      : `<li class="empty">No operations recorded.</li>`;
  }

  function renderMetrics(): void {
    const m = system.report(currentTime);
    const types = system.getTypes();
    $("metrics").innerHTML = `
      <div class="metric-group">
        <h4>Cart occupancy</h4>
        ${types.map((t) => `<p>${t}: ${m.cartOccupancy[t].used}/${m.cartOccupancy[t].capacity}</p>`).join("")}
      </div>
      <div class="metric-group">
        <h4>Equipment by status</h4>
        ${Object.entries(m.byStatus).map(([k, v]) => `<p>${k.replace("_", " ")}: ${v}</p>`).join("") || "<p>No data</p>"}
      </div>
      <div class="metric-group">
        <h4>Requests served</h4>
        <p>Immediate: ${m.immediateRequests}</p>
        <p>Queued: ${m.queuedRequests}</p>
        <p>Average wait: ${m.averageWaitMin.toFixed(1)} min</p>
      </div>
      <div class="metric-group">
        <h4>Directed loans</h4>
        <p>Performed: ${m.directedLoans}</p>
        <p>Total moves: ${m.totalDirectedMoves}</p>
      </div>
      <div class="metric-group">
        <h4>Maintenance and overdue loans</h4>
        <p>Damaged returns: ${m.damagedReturns}</p>
        <p>In maintenance: ${m.equipmentInMaintenance}</p>
        <p>Preventive maintenance (R8): ${m.preventiveMaintenanceCount}</p>
        <p>Currently overdue loans: ${m.currentlyOverdueLoans}</p>
      </div>
      <div class="metric-group">
        <h4>Most loaned equipment</h4>
        <p>${m.mostLoanedEquipment ? `${m.mostLoanedEquipment.code} (${m.mostLoanedEquipment.loanCount} loans)` : "No loans yet"}</p>
      </div>
    `;
  }

  // ---------------- actions wired to buttons ----------------

  function actionLoadData(): void {
    const r = system.loadInventory(SAMPLE_DATA);
    showMessage(r.message, r.ok);
    renderAll();
  }

  function actionAddEquipment(): void {
    const code = ($("addCode") as HTMLInputElement).value.trim();
    const type = ($("addType") as HTMLSelectElement).value as EquipmentType;
    if (!code) return;
    const r = system.loadInventory([{ code, type }]);
    showMessage(r.message, r.ok);
    ($("addCode") as HTMLInputElement).value = "";
    renderAll();
  }

  function actionRequest(): void {
    const student = ($("reqStudent") as HTMLInputElement).value.trim();
    const type = ($("reqType") as HTMLSelectElement).value as EquipmentType;
    if (!student) return;
    const r = system.request(student, type, currentTime);
    showMessage(r.message, r.ok, r.violatedRule);
    renderAll();
  }

  function actionReturn(): void {
    const code = ($("retCode") as HTMLInputElement).value.trim();
    if (!code) return;
    const r = system.returnEquipment(code, currentTime);
    showMessage(r.message, r.ok, r.violatedRule);
    ($("retCode") as HTMLInputElement).value = "";
    renderAll();
  }

  function actionDirectedLoan(): void {
    const code = ($("dirCode") as HTMLInputElement).value.trim();
    const student = ($("dirStudent") as HTMLInputElement).value.trim();
    if (!code || !student) return;
    const r = system.directedLoan(code, student, currentTime);
    showMessage(r.message + (r.moves !== undefined ? ` (${r.moves} moves)` : ""), r.ok);
    renderAll();
  }

  function actionReview(result: "OK" | "DAMAGED"): void {
    const r = system.review(result, currentTime);
    showMessage(r.message, r.ok);
    renderAll();
  }

  function actionStorePending(): void {
    const r = system.storePending(currentTime);
    showMessage(r.message, r.ok);
    renderAll();
  }

  function actionAdvanceTime(): void {
    advanceTime(30);
    renderAll();
  }

  // ---------------- bootstrap ----------------

  export function start(): void {
    $("clock").textContent = `${formatTime(currentTime)} (min ${currentTime})`;

    document.querySelectorAll<HTMLElement>(".tab").forEach((tab) => {
      tab.addEventListener("click", () => goTo(tab.dataset["tab"]!));
    });

    $("btnLoadData").addEventListener("click", actionLoadData);
    $("btnAdvanceTime").addEventListener("click", actionAdvanceTime);
    $("btnAdd").addEventListener("click", actionAddEquipment);
    $("filterType").addEventListener("change", renderInventory);
    $("filterStatus").addEventListener("change", renderInventory);
    $("searchCode").addEventListener("input", findEquipment);
    $("btnRequest").addEventListener("click", actionRequest);
    $("btnReturn").addEventListener("click", actionReturn);
    $("btnDirected").addEventListener("click", actionDirectedLoan);
    $("btnReviewOk").addEventListener("click", () => actionReview("OK"));
    $("btnReviewDamaged").addEventListener("click", () => actionReview("DAMAGED"));
    $("btnStorePending").addEventListener("click", actionStorePending);

    renderAll();
  }
}

window.addEventListener("DOMContentLoaded", UI.start);
