/***********************
 * DASHBOARD - MODO CLASE
 * - Config arriba
 * - Validación de CSV/columnas
 * - Mensajes visibles en pantalla
 ************************/

/* ========= CONFIG (TOCAR AQUÍ) ========= */
const CONFIG = {
  debug: true, // true: muestra mensajes y logs; false: más limpio

  files: {
    kpis: "data/kpis.csv",
    beneficioNivel: "data/beneficio_por_nivel.csv",
    ventasEstado: "data/ventas_por_estado.csv",
    topProductos: "data/top_productos_beneficio.csv",
    detalle: "data/detalle.csv",
  },

  // Cabeceras esperadas en cada CSV
  schema: {
    kpis: ["num_registros", "total_unidades", "beneficio_total", "beneficio_medio"],
    beneficioNivel: ["nivel", "beneficio_total"],
    ventasEstado: ["estado", "num_ventas", "unidades"],
    topProductos: ["producto", "beneficio_total", "unidades"],
    detalle: ["estado", "nivel", "producto", "unidades", "beneficio_total"],
  },

  // Qué columnas usar para filtros (en detalle.csv)
  filters: {
    estadoCol: "estado",
    nivelCol: "nivel",
  },

  // Qué columnas usar para recalcular KPIs filtrados (en detalle.csv)
  kpiFromDetalle: {
    unidadesCol: "unidades",
    beneficioCol: "beneficio_total",
  },
};
/* ========= FIN CONFIG ========= */


/* ========= UI: mensajes en pantalla ========= */
function uiBox() {
  return document.getElementById("mensajes");
}
function uiClear() {
  const box = uiBox();
  if (!box) return;
  box.style.display = "none";
  box.innerHTML = "";
}
function uiMsg(type, title, text) {
  const box = uiBox();
  if (!box) return;

  const color = type === "error" ? "#b00020" : type === "warn" ? "#8a6d00" : "#1a5e20";
  box.style.display = "block";
  box.style.border = `2px solid ${color}`;
  box.style.padding = "12px";
  box.style.margin = "12px 0";
  box.style.background = "#fff";

  box.innerHTML += `
    <div style="margin-bottom:10px;">
      <div style="font-weight:bold; color:${color};">${escapeHtml(title)}</div>
      <div>${escapeHtml(text)}</div>
    </div>
  `;
}
function logDebug(...args) {
  if (CONFIG.debug) console.log(...args);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

/* ========= CSV loading + parse ========= */
async function fetchCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${res.status}). ¿Existe el archivo y el nombre es correcto?`);
  const text = await res.text();
  return parseSimpleCSV(text);
}

// CSV sencillo: una fila por línea, separador coma, comillas opcionales
function parseSimpleCSV(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(stripQuotes).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line).map(stripQuotes);
    const row = {};
    headers.forEach((h, idx) => row[h] = (cols[idx] ?? "").trim());
    rows.push(row);
  }
  return rows;
}

function stripQuotes(s) {
  return String(s).replace(/^"(.*)"$/, "$1");
}

// divide respetando comillas
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/* ========= Validación de datos ========= */
function assertColumns(rows, expectedCols, label) {
  if (!rows.length) {
    uiMsg("error", `CSV vacío: ${label}`, `El archivo se ha cargado pero no tiene filas. Revisa que tenga cabecera + datos y saltos de línea.`);
    return false;
  }
  const cols = Object.keys(rows[0]);
  const missing = expectedCols.filter(c => !cols.includes(c));
  if (missing.length) {
    uiMsg(
      "error",
      `Columnas no coinciden: ${label}`,
      `Faltan columnas: ${missing.join(", ")}. Cabeceras encontradas: ${cols.join(", ")}`
    );
    return false;
  }
  return true;
}

/* ========= DOM helpers ========= */
function setKPI(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderTable(tableId, rows, columns, headersMap) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (!rows.length) {
    table.innerHTML = "<tr><td>No hay datos</td></tr>";
    return;
  }

  let html = "<thead><tr>";
  columns.forEach(c => html += `<th>${escapeHtml(headersMap[c] ?? c)}</th>`);
  html += "</tr></thead><tbody>";

  rows.forEach(r => {
    html += "<tr>";
    columns.forEach(c => html += `<td>${escapeHtml(r[c] ?? "")}</td>`);
    html += "</tr>";
  });

  html += "</tbody>";
  table.innerHTML = html;
}

function uniqueValues(rows, key) {
  return Array.from(new Set(rows.map(r => r[key]).filter(v => v !== undefined && v !== "")));
}

function fillSelect(selectId, values, allLabel) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = allLabel;
  sel.appendChild(optAll);

  values.sort().forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
}

function applyFilters(rows, estado, nivel) {
  const estadoCol = CONFIG.filters.estadoCol;
  const nivelCol = CONFIG.filters.nivelCol;

  return rows.filter(r => {
    const okEstado = !estado || r[estadoCol] === estado;
    const okNivel = !nivel || r[nivelCol] === nivel;
    return okEstado && okNivel;
  });
}

/* ========= Charts ========= */
let chart1 = null;
let chart2 = null;

function renderChartBeneficioNivel(rows) {
  const labels = rows.map(r => r["nivel"]);
  const data = rows.map(r => Number(r["beneficio_total"]));

  const ctx = document.getElementById("chartBeneficioNivel");
  if (!ctx || !window.Chart) {
    uiMsg("warn", "Chart.js no disponible", "No se puede dibujar la gráfica. ¿Hay internet para cargar Chart.js?");
    return;
  }
  if (chart1) chart1.destroy();

  chart1 = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Beneficio total", data }] }
  });
}

function renderChartVentasEstado(rows) {
  const labels = rows.map(r => r["estado"]);
  const data = rows.map(r => Number(r["num_ventas"]));

  const ctx = document.getElementById("chartVentasEstado");
  if (!ctx || !window.Chart) return;
  if (chart2) chart2.destroy();

  chart2 = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Número de ventas", data }] }
  });
}

/* ========= MAIN ========= */
async function init() {
  uiClear();
  uiMsg("info", "Cargando dashboard…", "Si algo falla, aquí verás el motivo (CSV inexistente, columnas mal nombradas, etc.).");

  // 1) Cargar CSV agregados
  const [kpis, beneficioNivel, ventasEstado, topProductos] = await Promise.all([
    fetchCSV(CONFIG.files.kpis),
    fetchCSV(CONFIG.files.beneficioNivel),
    fetchCSV(CONFIG.files.ventasEstado),
    fetchCSV(CONFIG.files.topProductos),
  ]);

  logDebug("kpis:", kpis);
  logDebug("beneficioNivel:", beneficioNivel);
  logDebug("ventasEstado:", ventasEstado);
  logDebug("topProductos:", topProductos);

  // 2) Validar columnas
  const okKpis = assertColumns(kpis, CONFIG.schema.kpis, "kpis.csv");
  const okBN = assertColumns(beneficioNivel, CONFIG.schema.beneficioNivel, "beneficio_por_nivel.csv");
  const okVE = assertColumns(ventasEstado, CONFIG.schema.ventasEstado, "ventas_por_estado.csv");
  const okTP = assertColumns(topProductos, CONFIG.schema.topProductos, "top_productos_beneficio.csv");

  if (!(okKpis && okBN && okVE && okTP)) {
    uiMsg("error", "Dashboard detenido", "Corrige los errores de columnas/archivos y recarga la página.");
    return;
  }

  // 3) Pintar KPIs iniciales
  setKPI("kpiRegistros", kpis[0]["num_registros"]);
  setKPI("kpiUnidades", kpis[0]["total_unidades"]);
  setKPI("kpiBeneficioTotal", kpis[0]["beneficio_total"]);
  setKPI("kpiBeneficioMedio", kpis[0]["beneficio_medio"]);

  // 4) Gráficas
  renderChartBeneficioNivel(beneficioNivel);
  renderChartVentasEstado(ventasEstado);

  // 5) Tablas
  renderTable(
    "tablaTopProductos",
    topProductos,
    ["producto", "beneficio_total", "unidades"],
    { producto: "Producto", beneficio_total: "Beneficio total", unidades: "Unidades" }
  );

  renderTable(
    "tablaVentasEstado",
    ventasEstado,
    ["estado", "num_ventas", "unidades"],
    { estado: "Estado", num_ventas: "Nº ventas", unidades: "Unidades" }
  );

  // 6) Cargar detalle para filtros y KPIs dinámicos
  let detalle = [];
  try {
    detalle = await fetchCSV(CONFIG.files.detalle);
  } catch (e) {
    uiMsg("warn", "Sin detalle.csv", "No se han activado filtros ni KPIs dinámicos. Sube data/detalle.csv.");
    uiMsg("info", "Dashboard cargado (sin filtros)", "Lo demás funciona: tablas y gráficas agregadas.");
    return;
  }

  logDebug("detalle:", detalle);

  const okDetalle = assertColumns(detalle, CONFIG.schema.detalle, "detalle.csv");
  if (!okDetalle) {
    uiMsg("error", "Filtros desactivados", "detalle.csv no tiene las columnas esperadas según CONFIG.schema.detalle.");
    uiMsg("info", "Dashboard cargado (sin filtros)", "Lo demás funciona: tablas y gráficas agregadas.");
    return;
  }

  // 7) Construir filtros
  const filtroEstado = document.getElementById("filtroEstado");
  const filtroNivel = document.getElementById("filtroNivel");
  const btnReset = document.getElementById("btnReset");

  fillSelect("filtroEstado", uniqueValues(detalle, CONFIG.filters.estadoCol), "Todos los estados");
  fillSelect("filtroNivel", uniqueValues(detalle, CONFIG.filters.nivelCol), "Todos los niveles");

  function updateFiltered() {
    const estado = filtroEstado.value;
    const nivel = filtroNivel.value;
    const filtrado = applyFilters(detalle, estado, nivel);

    const num = filtrado.length;
    const unidades = filtrado.reduce((acc, r) => acc + Number(r[CONFIG.kpiFromDetalle.unidadesCol] || 0), 0);
    const beneficio = filtrado.reduce((acc, r) => acc + Number(r[CONFIG.kpiFromDetalle.beneficioCol] || 0), 0);

    setKPI("kpiRegistros", num);
    setKPI("kpiUnidades", unidades);
    setKPI("kpiBeneficioTotal", beneficio.toFixed(2));
    setKPI("kpiBeneficioMedio", num ? (beneficio / num).toFixed(2) : "0.00");

    if (CONFIG.debug) {
      uiMsg("info", "Filtro aplicado", `Estado="${estado || "Todos"}" | Nivel="${nivel || "Todos"}" | Filas=${num}`);
    }
  }

  filtroEstado.addEventListener("change", updateFiltered);
  filtroNivel.addEventListener("change", updateFiltered);
  btnReset.addEventListener("click", () => {
    filtroEstado.value = "";
    filtroNivel.value = "";
    updateFiltered();
  });

  // 8) Primer cálculo
  uiClear();
  uiMsg("info", "Dashboard cargado", "Si cambias filtros, verás cómo cambian los KPIs.");
  updateFiltered();
}

init().catch(err => {
  console.error(err);
  uiClear();
  uiMsg("error", "Error fatal al iniciar", err.message || String(err));
});
