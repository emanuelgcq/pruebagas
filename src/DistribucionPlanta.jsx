import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, Fuel, Truck, Gauge, X, Save, Search, Download, AlertTriangle,
  CheckCircle2, Factory, Droplets, Users, MapPin, Wallet, CircleDollarSign, ClipboardList, History,
  Container, Undo2,
} from "lucide-react";
import {
  CDTS, cdtOf, HOY, PERIODO, num, bs, fecha, fechaCorta, fechaGuion, sumarDias, esFechaPeriodo, descargar, csv,
  kgALitros, litrosAKg, KG_POR_LITRO_GLP, TIPOS_MOV_PLANTA, tipoMovPlanta, llenadoPorCerrarDe,
  CODIGOS_GENERICOS, codigoGenerico, montos, TOPE_UNIDADES_GENERICO, BANCOS, cpt, EMPRESA,
} from "./datos.jsx";
import { UNIDADES_DISTRIBUCION, OPERADORES_DISTRIBUCION, operadorDistribucion } from "./distribucionSeed.js";
import { adCerrada } from "./flujo.js";
import { KgL, NotaFactor, UnidadesStyles } from "./Unidades.jsx";

const KGS_CIL = [10, 15, 18, 21, 27, 43];
const esHoy = (d) => fechaGuion(d) === fechaGuion(HOY);
/** Hora del reloj: ningún registro nace con una hora escrita a mano. */
const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const cilindrosDe = (movs) => movs.reduce((a, m) => a + Object.values(m.cilindros || {}).reduce((s, v) => s + Number(v || 0), 0), 0);
// Tolerancia para decir que dos registros del mismo despacho pesan lo mismo (no es un factor).
const TOLERANCIA_KG = 0.5;
const UNIDAD_GRANEL = UNIDADES_DISTRIBUCION.find((u) => u.granel) || UNIDADES_DISTRIBUCION[0];
const OPERADOR_GRANEL = OPERADORES_DISTRIBUCION.find((o) => o.granel) || OPERADORES_DISTRIBUCION[0];

/* ════════════════════════════════════════════════════════════════
   MOVIMIENTO DE PLANTA · registro del operador de planta
   Aquí se registran las gandolas: lo único que mueve el tanque del CDT de una vez.
   Los movimientos de la jornada —recolección, llenado y devolución de las bombonas de
   los usuarios— los produce el AD desde «Ejecución y cierre»: se leen aquí, no se cargan
   a mano, y por eso cuadran con el AD por construcción.
   ════════════════════════════════════════════════════════════════ */

export function MovimientoPlanta({
  movPlanta = [], existencias = {}, rutasDistribucion = [], cifras, crearMovimientoPlanta, aviso,
}) {
  const [cdtF, setCdtF] = useState("TODOS");
  const [tipoF, setTipoF] = useState("TODOS");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(false);

  // El llenado de un AD cerrado ya salió del inventario con su BOP: deja de estar por cerrar.
  const adsCerradas = useMemo(() => new Set(rutasDistribucion.filter(adCerrada).map((r) => String(r.ad))), [rutasDistribucion]);
  const estadoDe = (m) => (m.tipo === "LLENADO"
    ? (adsCerradas.has(String(m.ad)) ? "Cerrado con el AD" : "Por cerrar")
    : m.estado === "CONFIRMADA" ? "Confirmada" : "Pendiente");

  const lista = movPlanta.filter((m) => {
    const okC = cdtF === "TODOS" || m.cdt === cdtF;
    const okT = tipoF === "TODOS" || m.tipo === tipoF;
    const okQ = !q || `${m.documento} ${m.contraparte} ${m.vehiculo} ${m.operador} ${m.ad || ""}`.toLowerCase().includes(q.toLowerCase());
    return okC && okT && okQ;
  }).sort((a, b) => (b.fecha - a.fecha) || String(b.hora).localeCompare(String(a.hora)));

  const enAlcance = movPlanta.filter((m) => cdtF === "TODOS" || m.cdt === cdtF);
  const deTipo = (tipo) => enAlcance.filter((m) => m.tipo === tipo);
  const kgDe = (movs) => movs.reduce((a, m) => a + Number(m.kg || 0), 0);
  const entradas = deTipo("ENTRADA_GANDOLA");
  const entraGandola = kgDe(entradas);
  const saleGandola = kgDe(deTipo("SALIDA_GANDOLA"));
  const recolectadasHoy = deTipo("RECOLECCION").filter((m) => esHoy(m.fecha));
  const bombonasRecolectadas = cilindrosDe(recolectadasHoy);
  const bombonasDevueltas = cilindrosDe(deTipo("DEVOLUCION").filter((m) => esHoy(m.fecha)));
  /* El llenado por cerrar y la existencia son cifras de todo el sistema: salen de `cifras`.
     Filtrado por CDT, de la misma función del núcleo que las alimenta. */
  const porCerrarCdt = llenadoPorCerrarDe(movPlanta, rutasDistribucion);
  const llenadoPorCerrar = cdtF === "TODOS"
    ? Number(cifras?.glp?.llenadoPorCerrar ?? Object.values(porCerrarCdt).reduce((a, v) => a + v, 0))
    : Number(porCerrarCdt[cdtF] || 0);
  const stock = cdtF === "TODOS"
    ? Number(cifras?.glp?.fisico ?? CDTS.reduce((a, c) => a + Number(existencias[c.id] || 0), 0))
    : Number(existencias[cdtF] || 0);

  function registrar(d) {
    const res = crearMovimientoPlanta ? crearMovimientoPlanta(d) : { ok: false, error: "El registro no está disponible en esta vista." };
    if (!res?.ok) return res;
    setModal(false);
    aviso?.(`Movimiento registrado · ${tipoMovPlanta(d.tipo).nombre} · ${res.documento || d.documento}`);
    return res;
  }

  function exportar() {
    const par = (etiqueta, kg) => [etiqueta, `${Number(kg).toFixed(2)} kg`, `${kgALitros(kg).toFixed(2)} L`];
    descargar(`movimiento-de-planta-${fechaGuion(HOY)}.csv`, csv([
      ["MOVIMIENTO DE PLANTA · CONTROL DE ENTRADAS Y SALIDAS"], [EMPRESA.nombre], ["Corte", fechaGuion(HOY)],
      ["Factor", `1 litro de GLP = ${KG_POR_LITRO_GLP} kg`], [],
      ["Movimiento", "Fecha", "Hora", "Tipo", "Medio", "CDT", "Documento", "Contraparte", "AD",
        ...KGS_CIL.map((k) => `${k} kg`), "Kg", "Litros", "Vehículo", "Operador", "Cédula", "Estado", "Observación"],
      ...lista.map((m) => {
        const t = tipoMovPlanta(m.tipo);
        const kg = Number(m.kg || 0);
        return [m.id, fechaGuion(m.fecha), m.hora, t.nombre, t.medio === "GANDOLA" ? "Gandola" : "Jornada", cdtOf(m.cdt).corto,
          m.documento, m.contraparte, m.ad || "", ...KGS_CIL.map((k) => m.cilindros?.[k] || ""),
          kg.toFixed(2), kgALitros(kg).toFixed(2), m.vehiculo, m.operador, m.cedula, estadoDe(m), m.nota];
      }),
      [], ["RESUMEN", cdtF === "TODOS" ? "Todos los CDT" : cdtOf(cdtF).corto],
      par("Recibido por gandola", entraGandola),
      par("Despachado por gandola", saleGandola),
      ["Bombonas recolectadas hoy", bombonasRecolectadas],
      par("Llenado por cerrar", llenadoPorCerrar),
      ["Bombonas devueltas al punto hoy", bombonasDevueltas],
      par("Existencia física", stock),
    ]));
    aviso?.("Movimiento de planta exportado");
  }

  return (
    <div className="dp">
      <PlantaStyles />
      <UnidadesStyles />
      <div className="dp-hero">
        <div>
          <span>OPERADOR DE PLANTA</span>
          <h2>Movimiento de planta</h2>
          <p>Todo el gas que entra y sale del CDT. Aquí se registran las gandolas, que mueven la existencia del tanque de una
            vez. Las bombonas de la jornada —recolección, llenado y devolución al punto— las registra el AD desde «Ejecución y
            cierre» y aparecen aquí solas, con las mismas cifras del AD.</p>
        </div>
        <div className="dp-hero-side">
          <button className="dx-primary" onClick={() => setModal(true)}><ClipboardList size={14} /> Registrar gandola</button>
          <small><NotaFactor /></small>
        </div>
      </div>

      <div className="dp-kpis">
        <DPK icon={ArrowDownToLine} label="Recibido por gandola" value={<KgL kg={entraGandola} />} note={`al tanque · ${entradas.length} descarga(s)`} tone="ok" />
        <DPK icon={ArrowUpFromLine} label="Despachado por gandola" value={<KgL kg={saleGandola} />} note="a granel y a planta móvil" tone="warn" />
        <DPK icon={Container} label="Bombonas recolectadas hoy" value={num(bombonasRecolectadas)}
          note={`vacías de los usuarios · ${new Set(recolectadasHoy.map((m) => m.ad)).size} AD`} />
        <DPK icon={Fuel} label="Llenado por cerrar" value={<KgL kg={llenadoPorCerrar} />} note="sale del inventario al cerrar su AD" tone={llenadoPorCerrar > 0 ? "warn" : "ok"} />
        <DPK icon={Undo2} label="Devueltas al punto hoy" value={num(bombonasDevueltas)} note="llenas y vacías: salen y vuelven todas" />
        <DPK icon={Gauge} label="Existencia física" value={<KgL kg={stock} />} note="en tanque" tone="ok" />
      </div>

      <div className="dp-regla">
        <Factory size={17} />
        <div>
          <b>Cómo afecta cada movimiento al inventario.</b>
          <span>La <b>gandola</b> mueve la existencia del CDT de una vez, porque el movimiento ocurre en la planta. La <b>jornada</b> no:
            el camión sale vacío a recoger, la recolección y la devolución no mueven GLP, y el llenado queda <b>por cerrar</b> hasta
            que se cierra su AD, cuando la BOP produce la salida. Así el mismo kilo nunca se descuenta dos veces.</span>
        </div>
      </div>

      <section className="dx-card">
        <div className="dx-card-head">
          <div><h2>Registro de movimientos <span className="dp-cnt">{lista.length}</span></h2>
            <p>Ordenados del más reciente al más antiguo.</p></div>
          <div className="dp-toolbar">
            <select value={cdtF} onChange={(e) => setCdtF(e.target.value)}>
              <option value="TODOS">Todos los CDT</option>
              {CDTS.map((c) => <option key={c.id} value={c.id}>{c.corto}</option>)}
            </select>
            <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}>
              <option value="TODOS">Todo movimiento</option>
              {TIPOS_MOV_PLANTA.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <div className="dx-search"><Search size={14} /><input placeholder="Buscar documento, AD, contraparte o vehículo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="dx-secondary" onClick={exportar}><Download size={14} /> CSV</button>
          </div>
        </div>
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead><tr>
              <th>Movimiento</th><th>Fecha / hora</th><th>Tipo</th><th>CDT</th><th>Documento</th>
              <th>Contraparte</th><th>Cilindros</th><th className="dp-r">GLP · kg y L</th>
              <th>Vehículo / operador</th><th>Estado</th>
            </tr></thead>
            <tbody>
              {lista.map((m) => {
                const t = tipoMovPlanta(m.tipo);
                const gandola = t.medio === "GANDOLA";
                // Sólo la gandola lleva signo: el llenado de la jornada no descuenta hasta el cierre del AD.
                const clase = t.afectaStock ? (t.signo > 0 ? "in" : "out") : "neu";
                const cil = KGS_CIL.filter((k) => m.cilindros?.[k]).map((k) => `${m.cilindros[k]}×${k} kg`).join(" · ");
                const estado = estadoDe(m);
                return (
                  <tr key={m.id}>
                    <td><b>{m.id}</b></td>
                    <td>{fechaCorta(m.fecha)}<span>{m.hora}</span></td>
                    <td><span className={`dp-tag ${clase}`}>
                      {clase === "in" ? <ArrowDownToLine size={10} /> : clase === "out" ? <ArrowUpFromLine size={10} /> : <Container size={10} />} {t.nombre}
                    </span><span>{gandola ? "Gandola · mueve el tanque" : `Jornada · AD ${m.ad || "—"}`}</span></td>
                    <td>{cdtOf(m.cdt).corto}</td>
                    <td><b>{m.documento}</b></td>
                    <td>{m.contraparte}</td>
                    <td>{gandola ? <span className="dp-muted">granel</span> : <span className="dp-cil">{cil || "—"}</span>}</td>
                    <td className={`dp-r dp-num ${clase === "in" ? "pos" : clase === "out" ? "neg" : ""}`}>
                      {Number(m.kg) > 0
                        ? <>{t.afectaStock ? (t.signo > 0 ? "+" : "−") : ""}<KgL kg={m.kg} /></>
                        : <span className="dp-muted">no mueve GLP</span>}</td>
                    <td><b>{m.vehiculo}</b><span>{m.operador}</span></td>
                    <td><span className={`dp-estado ${estado === "Por cerrar" || estado === "Pendiente" ? "wait" : "ok"}`}>{estado}</span></td>
                  </tr>
                );
              })}
              {!lista.length && <tr><td colSpan={10} className="dp-empty">Sin movimientos con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {modal && <ModalMovimiento onClose={() => setModal(false)} onGuardar={registrar} />}
    </div>
  );
}

/* Sólo gandolas: la recolección, el llenado y la devolución los produce la jornada. */
const TIPOS_GANDOLA = TIPOS_MOV_PLANTA.filter((t) => t.medio === "GANDOLA");

function ModalMovimiento({ onClose, onGuardar }) {
  const [d, setD] = useState(() => ({
    tipo: TIPOS_GANDOLA[0].id, cdt: CDTS[0].id, hora: horaActual(), documento: "", contraparte: "",
    kg: "", litros: "", vehiculo: "", operadorId: OPERADOR_GRANEL.id, nota: "",
  }));
  const [error, setError] = useState("");
  const t = tipoMovPlanta(d.tipo);
  const kg = Number(d.kg || 0);
  const op = operadorDistribucion(d.operadorId);
  const ok = kg > 0 && d.documento.trim() && d.hora;
  const set = (cambios) => { setError(""); setD((x) => ({ ...x, ...cambios })); };
  // Kilos y litros se convierten entre sí con el factor único del sistema.
  const setKg = (v) => set({ kg: v, litros: v ? kgALitros(Number(v)).toFixed(2) : "" });
  const setLitros = (v) => set({ litros: v, kg: v ? litrosAKg(Number(v)).toFixed(2) : "" });

  function guardar() {
    const res = onGuardar({
      tipo: d.tipo, cdt: d.cdt, hora: d.hora, documento: d.documento.trim(), contraparte: d.contraparte.trim() || "—",
      kg, cilindros: null, vehiculo: d.vehiculo.trim() || "—", operador: op.nombre, cedula: op.cedula, nota: d.nota.trim(),
    });
    if (!res?.ok) setError(res?.error || "No se pudo registrar el movimiento.");
  }

  return (
    <div className="dx-modal-bg dp-bg" onClick={onClose}>
      <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><small>Operador de planta</small><h2>Registrar gandola</h2></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <main>
          <div className="dp-hint">Aquí se registran sólo las gandolas. La recolección, el llenado y la devolución de las bombonas
            los produce la jornada desde «Ejecución y cierre de AD»: no se cargan a mano, y por eso cuadran con el AD.</div>
          <div className="dp-form2">
            <label><span>Tipo de movimiento</span>
              <select value={d.tipo} onChange={(e) => set({ tipo: e.target.value })}>
                {TIPOS_GANDOLA.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select></label>
            <label><span>CDT</span>
              <select value={d.cdt} onChange={(e) => set({ cdt: e.target.value })}>
                {CDTS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></label>
          </div>
          <div className="dp-hint">{t.desc}. {t.signo > 0 ? "Suma" : "Resta"} a la existencia física del CDT en el momento.</div>

          <div className="dp-form2">
            <label><span>Hora</span><input type="time" value={d.hora} onChange={(e) => set({ hora: e.target.value })} /></label>
            <label><span>Documento de la gandola *</span>
              <input value={d.documento} onChange={(e) => set({ documento: e.target.value })} placeholder="GAN-000000" /></label>
          </div>
          <label className="dp-full"><span>{t.signo > 0 ? "Proveedor" : "Destino"}</span>
            <input value={d.contraparte} onChange={(e) => set({ contraparte: e.target.value })}
              placeholder={t.signo > 0 ? "Planta proveedora" : "Cliente de granel o planta móvil"} /></label>

          <div className="dp-sep">Cantidad a granel</div>
          <div className="dp-form2">
            <label><span>Kilogramos</span><input inputMode="decimal" value={d.kg} onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ""))} /></label>
            <label><span>Litros del medidor</span><input inputMode="decimal" value={d.litros} onChange={(e) => setLitros(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          </div>
          <div className="dp-total"><span>Se registra</span><b><KgL kg={kg} /></b></div>

          <div className="dp-sep">Responsable</div>
          <div className="dp-form2">
            <label><span>Vehículo</span>
              <input list="dp-vehiculos-granel" value={d.vehiculo} onChange={(e) => set({ vehiculo: e.target.value })}
                placeholder={t.signo > 0 ? "Placa de la gandola del proveedor" : `Unidad de granel · ${UNIDAD_GRANEL.placa}`} />
              <datalist id="dp-vehiculos-granel">
                {UNIDADES_DISTRIBUCION.filter((u) => u.granel).map((u) => <option key={u.id} value={u.placa}>{u.etiqueta}</option>)}
              </datalist></label>
            <label><span>Operador</span>
              <select value={d.operadorId} onChange={(e) => set({ operadorId: e.target.value })}>
                {OPERADORES_DISTRIBUCION.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {o.cedula}</option>)}
              </select></label>
          </div>
          <label className="dp-full"><span>Observación</span>
            <textarea rows={2} value={d.nota} onChange={(e) => set({ nota: e.target.value })} /></label>
          {error && <div className="dp-error"><AlertTriangle size={14} /> {error}</div>}
        </main>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={guardar}><Save size={14} /> Registrar</button>
        </footer>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   GRANEL
   Negocio distinto al envasado: tanque del cliente, medición en sitio y despacho por gandola.
   ════════════════════════════════════════════════════════════════ */

/* Los niveles clasifican al cliente por volumen mensual contratado. Determinan prioridad
   de reposición y frecuencia de visita. La regla de corte debe confirmarla la Gerencia. */
export const NIVELES_GRANEL = [
  { id: "N1", nombre: "Nivel I · Alto consumo", desdeKg: 3000, frecuencia: "Semanal", prioridad: 1, color: "#1C7A50" },
  { id: "N2", nombre: "Nivel II · Consumo medio", desdeKg: 1000, frecuencia: "Quincenal", prioridad: 2, color: "#2D65B0" },
  { id: "N3", nombre: "Nivel III · Bajo consumo", desdeKg: 0, frecuencia: "Mensual", prioridad: 3, color: "#8A5A16" },
];
export const nivelGranel = (kgMes) => NIVELES_GRANEL.find((n) => kgMes >= n.desdeKg) || NIVELES_GRANEL[NIVELES_GRANEL.length - 1];

const CLIENTES_GRANEL = [
  { id: "GR-001", nombre: "Parque Viviendo Hugo Chávez", tipo: "Residencial", rif: "J-40118422-3", cdt: "CDT-JL",
    direccion: "Av. Intercomunal, Barquisimeto", contacto: "Consejo de administración", tel: "0251-441.20.18",
    tanqueL: 9000, nivelPct: 34, consumoMesKg: 4800 },
  { id: "GR-002", nombre: "Cecosesola", tipo: "Comercial", rif: "J-08501122-0", cdt: "CDT-JL",
    direccion: "Av. Libertador, Barquisimeto", contacto: "Coordinación de servicios", tel: "0251-236.55.10",
    tanqueL: 6000, nivelPct: 58, consumoMesKg: 3600 },
  { id: "GR-003", nombre: "Corrugadora Lara", tipo: "Industrial", rif: "J-30221904-7", cdt: "CDT-JGI",
    direccion: "Zona Industrial II, Cabudare", contacto: "Jefatura de planta", tel: "0251-269.71.44",
    tanqueL: 12000, nivelPct: 21, consumoMesKg: 6200 },
  { id: "GR-004", nombre: "Panificadora Pan Celestial", tipo: "Comercial", rif: "J-40772110-5", cdt: "CDT-JGI",
    direccion: "Calle 5, Cabudare", contacto: "Administración", tel: "0412-770.19.33",
    tanqueL: 2000, nivelPct: 72, consumoMesKg: 1400 },
  { id: "GR-005", nombre: "Ambulatorio Rural Duaca", tipo: "Institucional", rif: "G-20077744-1", cdt: "CDT-JL",
    direccion: "Av. Principal, Duaca", contacto: "Dirección médica", tel: "0251-880.44.21",
    tanqueL: 1500, nivelPct: 46, consumoMesKg: 620 },
  { id: "GR-006", nombre: "Ruezga 2 · Bloque 20", tipo: "Residencial", rif: "J-41028833-9", cdt: "CDT-JL",
    direccion: "Ruezga Norte, Barquisimeto", contacto: "Comité de vivienda", tel: "0414-390.11.84",
    tanqueL: 4000, nivelPct: 12, consumoMesKg: 2100 },
];

/* El granel se mide en litros: lo que marca el medidor de la gandola es volumen. Los kg no
   se anotan aparte: salen del litraje con el factor único del sistema. Por eso el despacho
   de hoy (DG-4471) y su movimiento de planta (GAN-140418) pesan lo mismo en las dos
   pantallas. Las fechas cuentan hacia atrás desde el día de la demo. */
const DESPACHOS_GRANEL = [
  { id: "DG-4471", cliente: "GR-001", haceDias: 0, litros: 3175, medidorInicio: 812450, medidorFin: 815625, tempC: 29, estado: "CERRADO", documentoPlanta: "GAN-140418" },
  { id: "DG-4468", cliente: "GR-003", haceDias: 2, litros: 1984, medidorInicio: 810466, medidorFin: 812450, tempC: 31, estado: "CERRADO" },
  { id: "DG-4465", cliente: "GR-002", haceDias: 4, litros: 2381, medidorInicio: 808085, medidorFin: 810466, tempC: 28, estado: "CERRADO" },
  { id: "DG-4462", cliente: "GR-006", haceDias: 6, litros: 1667, medidorInicio: 806418, medidorFin: 808085, tempC: 30, estado: "CERRADO" },
  { id: "DG-4459", cliente: "GR-004", haceDias: 8, litros: 992, medidorInicio: 805426, medidorFin: 806418, tempC: 27, estado: "CERRADO" },
  { id: "DG-4456", cliente: "GR-005", haceDias: 10, litros: 397, medidorInicio: 805029, medidorFin: 805426, tempC: 29, estado: "CERRADO" },
].map((d) => ({
  ...d, fecha: sumarDias(HOY, -d.haceDias), kg: litrosAKg(d.litros),
  vehiculo: UNIDAD_GRANEL.placa, operador: OPERADOR_GRANEL.nombre,
}));
const ESTADOS_DESPACHO = { CERRADO: { nombre: "Cerrado", tono: "ok" }, EN_CURSO: { nombre: "En curso", tono: "wait" } };
const estadoDespacho = (id) => ESTADOS_DESPACHO[id] || { nombre: id || "—", tono: "wait" };

export function GranelDistribucion({ movPlanta = [], aviso }) {
  const [tab, setTab] = useState("clientes");
  const [sel, setSel] = useState(null);

  /* Un despacho de granel y su movimiento de planta tienen que decir lo mismo: si el
     movimiento no está, o pesa distinto, se ve aquí. */
  const movPorDoc = useMemo(() => new Map(movPlanta.map((m) => [m.documento, m])), [movPlanta]);
  const concordancia = (d) => {
    if (!d.documentoPlanta) return null;
    const m = movPorDoc.get(d.documentoPlanta);
    return { doc: d.documentoPlanta, registrado: Boolean(m), cuadra: Boolean(m) && Math.abs(Number(m.kg || 0) - d.kg) < TOLERANCIA_KG };
  };
  const textoConcordancia = (c) => (c.cuadra ? "cuadra con planta" : c.registrado ? "no cuadra con planta" : "no está en planta");

  const clientes = CLIENTES_GRANEL.map((c) => {
    const n = nivelGranel(c.consumoMesKg);
    const disponibleKg = litrosAKg(c.tanqueL * (c.nivelPct / 100));
    const diasAutonomia = c.consumoMesKg ? Math.round((disponibleKg / c.consumoMesKg) * 30) : null;
    return { ...c, nivel: n, disponibleKg, diasAutonomia, critico: c.nivelPct <= 25 };
  }).sort((a, b) => a.nivel.prioridad - b.nivel.prioridad || a.nivelPct - b.nivelPct);

  const criticos = clientes.filter((c) => c.critico);
  const periodo = PERIODO.label.toLowerCase();
  const delPeriodo = DESPACHOS_GRANEL.filter((d) => esFechaPeriodo(d.fecha));
  const kgMes = delPeriodo.reduce((a, d) => a + d.kg, 0);
  const litrosMes = delPeriodo.reduce((a, d) => a + d.litros, 0);

  function exportar() {
    descargar(`granel-${fechaGuion(HOY)}.csv`, csv([
      ["MÓDULO DE GRANEL"], [EMPRESA.nombre], ["Corte", fechaGuion(HOY)], ["Factor", `1 litro de GLP = ${KG_POR_LITRO_GLP} kg`], [],
      ["CLIENTES"],
      ["Código", "Cliente", "Tipo", "RIF", "CDT", "Nivel", "Frecuencia", "Tanque L", "Nivel %", "Disponible kg", "Disponible L", "Consumo mes kg", "Días de autonomía"],
      ...clientes.map((c) => [c.id, c.nombre, c.tipo, c.rif, cdtOf(c.cdt).corto, c.nivel.nombre, c.nivel.frecuencia,
        c.tanqueL, c.nivelPct, c.disponibleKg.toFixed(2), kgALitros(c.disponibleKg).toFixed(2), c.consumoMesKg, c.diasAutonomia ?? ""]),
      [], ["HISTÓRICO DE DESPACHOS"],
      ["Despacho", "Fecha", "Cliente", "Litros", "Kg", "Medidor inicio", "Medidor fin", "Temp °C", "Vehículo", "Operador", "Movimiento de planta", "Estado"],
      ...DESPACHOS_GRANEL.map((d) => {
        const c = CLIENTES_GRANEL.find((x) => x.id === d.cliente);
        const conc = concordancia(d);
        return [d.id, fechaGuion(d.fecha), c?.nombre, d.litros, d.kg.toFixed(2), d.medidorInicio, d.medidorFin, d.tempC, d.vehiculo, d.operador,
          conc ? `${conc.doc} · ${textoConcordancia(conc)}` : "", estadoDespacho(d.estado).nombre];
      }),
      [], [`TOTAL ${PERIODO.label.toUpperCase()}`, "", "", litrosMes, kgMes.toFixed(2)],
    ]));
    aviso?.("Información de granel exportada");
  }

  return (
    <div className="dp">
      <PlantaStyles />
      <UnidadesStyles />
      <div className="dp-hero">
        <div>
          <span>GLP A GRANEL</span>
          <h2>Granel</h2>
          <p>Es un negocio distinto al envasado: el cliente tiene tanque propio, la medición se hace en sitio
             con el medidor de la gandola y el volumen depende de la temperatura. Por eso lleva su propio
             control y su histórico de despachos.</p>
        </div>
        <div className="dp-hero-side">
          <button className="dx-secondary" onClick={exportar}><Download size={14} /> CSV</button>
          <small><KgL litros={litrosMes} orden="L" /> despachados en {periodo}</small>
        </div>
      </div>

      <div className="dp-kpis">
        <DPK icon={Users} label="Clientes granel" value={clientes.length} note="con tanque instalado" />
        <DPK icon={Droplets} label={`Despachado en ${periodo}`} value={<KgL litros={litrosMes} orden="L" />} note={`${delPeriodo.length} despachos`} tone="ok" />
        <DPK icon={AlertTriangle} label="Tanques críticos" value={criticos.length} note="nivel igual o menor a 25%" tone={criticos.length ? "warn" : "ok"} />
        <DPK icon={Fuel} label="Consumo mensual contratado" value={<KgL kg={clientes.reduce((a, c) => a + c.consumoMesKg, 0)} />}
          note={`suma de los ${clientes.length} clientes`} />
      </div>

      <div className="dp-tabs">
        <button className={tab === "clientes" ? "on" : ""} onClick={() => setTab("clientes")}><Users size={14} /> Clientes y niveles</button>
        <button className={tab === "historico" ? "on" : ""} onClick={() => setTab("historico")}><History size={14} /> Histórico de despachos</button>
      </div>

      {tab === "clientes" && (
        <>
          <div className="dp-niveles">
            {NIVELES_GRANEL.map((n) => {
              const cs = clientes.filter((c) => c.nivel.id === n.id);
              return (
                <div className="dp-nivel" key={n.id} style={{ borderLeftColor: n.color }}>
                  <span>{n.nombre}</span>
                  <b>{cs.length} cliente(s)</b>
                  <small>Desde <KgL kg={n.desdeKg} />/mes · reposición {n.frecuencia.toLowerCase()}</small>
                </div>
              );
            })}
          </div>
          <div className="dp-aclara">
            <AlertTriangle size={15} />
            <span>El requerimiento pide <b>tipo de usuario por nivel</b> sin definir el criterio. Aquí se modela por
              volumen mensual contratado, que determina prioridad y frecuencia de reposición. Si la Gerencia se refiere
              a otro criterio — nivel del tanque o nivel tarifario — el corte se ajusta sin tocar el resto del módulo.</span>
          </div>

          <section className="dx-card">
            <div className="dx-card-head"><div><h2>Clientes de granel</h2><p>Ordenados por prioridad de reposición y nivel de tanque.</p></div></div>
            <div className="dx-table-wrap">
              <table className="dx-table">
                <thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>CDT</th><th>Nivel</th><th>Tanque</th><th>Nivel actual</th><th className="dp-r">Disponible</th><th className="dp-r">Autonomía</th><th></th></tr></thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className={c.critico ? "dp-critico" : ""}>
                      <td><b>{c.id}</b></td>
                      <td><b>{c.nombre}</b><span>{c.rif} · {c.direccion}</span></td>
                      <td>{c.tipo}</td>
                      <td>{cdtOf(c.cdt).corto}</td>
                      <td><span className="dp-tag neu" style={{ color: c.nivel.color }}>{c.nivel.id}</span><span>{c.nivel.frecuencia}</span></td>
                      <td><b><KgL litros={c.tanqueL} orden="L" /></b></td>
                      <td><div className="dp-barra"><i style={{ width: `${c.nivelPct}%`, background: c.critico ? "#B4571F" : "#2E9963" }} /></div><span>{c.nivelPct}%</span></td>
                      <td className="dp-r dp-num"><KgL kg={c.disponibleKg} /></td>
                      <td className="dp-r">{c.diasAutonomia != null ? <span className={`dp-estado ${c.diasAutonomia <= 7 ? "wait" : "ok"}`}>{c.diasAutonomia} días</span> : "—"}</td>
                      <td className="dp-r"><button className="dx-secondary" onClick={() => setSel(c)}>Ver ficha</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "historico" && (
        <section className="dx-card">
          <div className="dx-card-head"><div><h2>Histórico de despachos a granel</h2>
            <p>Cada despacho conserva lectura de medidor, temperatura, conversión litro–kilo y su movimiento de planta.</p></div></div>
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead><tr><th>Despacho</th><th>Fecha</th><th>Cliente</th><th className="dp-r">Litros</th><th className="dp-r">Kg</th><th>Medidor</th><th className="dp-r">Temp.</th><th>Vehículo / operador</th><th>Movimiento de planta</th><th>Estado</th></tr></thead>
              <tbody>
                {DESPACHOS_GRANEL.map((d) => {
                  const c = CLIENTES_GRANEL.find((x) => x.id === d.cliente);
                  const conc = concordancia(d);
                  const est = estadoDespacho(d.estado);
                  return (
                    <tr key={d.id}>
                      <td><b>{d.id}</b></td>
                      <td>{fechaCorta(d.fecha)}</td>
                      <td><b>{c?.nombre}</b><span>{c?.tipo}</span></td>
                      <td className="dp-r dp-num">{num(d.litros)}</td>
                      <td className="dp-r dp-num">{num(d.kg)}</td>
                      <td><span className="dp-cil">{num(d.medidorInicio)} → {num(d.medidorFin)}</span></td>
                      <td className="dp-r">{d.tempC} °C</td>
                      <td><b>{d.vehiculo}</b><span>{d.operador}</span></td>
                      <td>{conc
                        ? <><b>{conc.doc}</b><span className={`dp-conc ${conc.cuadra ? "ok" : "no"}`}>
                            {conc.cuadra ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {textoConcordancia(conc)}</span></>
                        : <span className="dp-muted">anterior al registro de planta</span>}</td>
                      <td><span className={`dp-estado ${est.tono}`}>{est.nombre}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={3}><b>TOTAL · {PERIODO.label.toUpperCase()}</b></td><td className="dp-r dp-num">{num(litrosMes)}</td><td className="dp-r dp-num">{num(kgMes)}</td><td colSpan={5} /></tr></tfoot>
            </table>
          </div>
          <div className="dp-aclara">
            <Droplets size={15} />
            <span>El volumen del GLP se dilata con la temperatura. El prototipo registra el dato para dejar visible
              la variable, pero aplica el factor fijo de {KG_POR_LITRO_GLP} kg por litro, el mismo de Movimiento de planta: el
              despacho y su gandola pesan lo mismo en las dos pantallas. En producción la conversión debería corregirse por
              temperatura y por composición de la mezcla.</span>
          </div>
        </section>
      )}

      {sel && <FichaGranel c={sel} despachos={DESPACHOS_GRANEL.filter((d) => d.cliente === sel.id)} onClose={() => setSel(null)} />}
    </div>
  );
}

function FichaGranel({ c, despachos, onClose }) {
  return (
    <div className="dx-modal-bg dp-bg" onClick={onClose}>
      <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
        <header><div><small>Cliente de granel · {c.nivel.nombre}</small><h2>{c.nombre}</h2></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button></header>
        <main>
          <div className="dp-ficha">
            <div><span>Código</span><b>{c.id}</b></div>
            <div><span>RIF</span><b>{c.rif}</b></div>
            <div><span>Tipo</span><b>{c.tipo}</b></div>
            <div><span>CDT</span><b>{cdtOf(c.cdt).corto}</b></div>
            <div><span>Contacto</span><b>{c.contacto}</b></div>
            <div><span>Teléfono</span><b>{c.tel}</b></div>
            <div className="dp-full2"><span>Dirección</span><b>{c.direccion}</b></div>
          </div>
          <div className="dp-sep">Tanque</div>
          <div className="dp-ficha">
            <div><span>Capacidad</span><b><KgL litros={c.tanqueL} orden="L" /></b></div>
            <div><span>Nivel actual</span><b>{c.nivelPct}%</b></div>
            <div><span>Disponible</span><b><KgL kg={c.disponibleKg} /></b></div>
            <div><span>Autonomía estimada</span><b>{c.diasAutonomia != null ? `${c.diasAutonomia} días` : "—"}</b></div>
          </div>
          <div className="dp-sep">Últimos despachos</div>
          <div className="dx-table-wrap">
            <table className="dx-table">
              <thead><tr><th>Despacho</th><th>Fecha</th><th className="dp-r">Litros</th><th className="dp-r">Kg</th><th>Operador</th></tr></thead>
              <tbody>
                {despachos.length ? despachos.map((d) => (
                  <tr key={d.id}><td><b>{d.id}</b></td><td>{fechaCorta(d.fecha)}</td>
                    <td className="dp-r dp-num">{num(d.litros)}</td><td className="dp-r dp-num">{num(d.kg)}</td><td>{d.operador}</td></tr>
                )) : <tr><td colSpan={5} className="dp-empty">Sin despachos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
        <footer><button className="dx-secondary" onClick={onClose}>Cerrar</button></footer>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PLANTA MÓVIL
   Llena cilindros en la calle, vende a personas sin código y maneja efectivo.
   ════════════════════════════════════════════════════════════════ */

/** El código de la jornada lleva su fecha (PM-ddmmaa-nn): se arma de la fecha, no se escribe. */
const idJornadaPM = (f, n) => {
  const [dd, mm, aaaa] = fechaGuion(f).split("-");
  return `PM-${dd}${mm}${aaaa.slice(2)}-${String(n).padStart(2, "0")}`;
};

/* La jornada de hoy cargó la unidad con el despacho por gandola GAN-140423 del CDT: su
   carga tiene que ser la misma que registra Movimiento de planta. */
export const JORNADAS_PM = [
  { n: 1, haceDias: 0, unidad: "PM-01", placa: "H27PM4", cdt: "CDT-JGI",
    municipio: "Jiménez", parroquia: "Juan Bautista Rodríguez", punto: "Plaza Bolívar de Quíbor",
    operador: "Rafael Antonio Torres", cedula: "V-16.208.491", ayudante: "Jesús Colmenárez", ayudanteCedula: "V-21.554.108",
    cargaKg: 3200, llenadosKg: 2740, retornoKg: 460, documentoCarga: "GAN-140423",
    llenados: { 10: 168, 18: 42, 27: 6 }, conCodigo: 143, sinCodigo: 73,
    efectivoBs: 214880, transferenciasBs: 118420, estado: "EN_JORNADA" },
  { n: 2, haceDias: 1, unidad: "PM-01", placa: "H27PM4", cdt: "CDT-JL",
    municipio: "Iribarren", parroquia: "Tamaca", punto: "Cancha de Santa Cruz",
    operador: "Rafael Antonio Torres", cedula: "V-16.208.491", ayudante: "Jesús Colmenárez", ayudanteCedula: "V-21.554.108",
    cargaKg: 3000, llenadosKg: 2910, retornoKg: 90,
    llenados: { 10: 201, 18: 36, 27: 9 }, conCodigo: 176, sinCodigo: 70,
    efectivoBs: 241300, transferenciasBs: 96500, estado: "CERRADA" },
  { n: 1, haceDias: 2, unidad: "PM-02", placa: "K48PM9", cdt: "CDT-JGI",
    municipio: "Palavecino", parroquia: "José Gregorio Bastidas", punto: "Sector La Morita",
    operador: "Carlos Eduardo Pérez", cedula: "V-14.217.604", ayudante: "Deiby Sequera", ayudanteCedula: "V-24.118.770",
    cargaKg: 2600, llenadosKg: 2480, retornoKg: 120,
    llenados: { 10: 158, 18: 34, 27: 5 }, conCodigo: 134, sinCodigo: 63,
    efectivoBs: 189420, transferenciasBs: 84100, estado: "CERRADA" },
].map((j) => {
  const f = sumarDias(HOY, -j.haceDias);
  return { ...j, fecha: f, id: idJornadaPM(f, j.n) };
});

export function PlantaMovil({ crearVentaGenerica, facturas = [], movPlanta = [], aviso }) {
  const [sel, setSel] = useState(JORNADAS_PM[0].id);
  const j = JORNADAS_PM.find((x) => x.id === sel) || JORNADAS_PM[0];
  const [modal, setModal] = useState(false);
  const cerrada = j.estado === "CERRADA";

  const unidades = [...new Set(JORNADAS_PM.map((x) => x.unidad))];
  const totalSinCodigo = JORNADAS_PM.reduce((a, x) => a + x.sinCodigo, 0);
  const totalAtendidos = JORNADAS_PM.reduce((a, x) => a + x.conCodigo + x.sinCodigo, 0);
  const totalLlenado = JORNADAS_PM.reduce((a, x) => a + x.llenadosKg, 0);
  const cilindrosJornada = [10, 18, 27].reduce((a, k) => a + (j.llenados[k] || 0), 0);
  const rendimiento = j.cargaKg ? (j.llenadosKg / j.cargaKg) * 100 : 0;
  // La carga de la unidad es un despacho por gandola: debe estar en Movimiento de planta con los mismos kilos.
  const carga = j.documentoCarga ? movPlanta.find((m) => m.documento === j.documentoCarga) : null;
  const cargaCuadra = Boolean(carga) && Math.abs(Number(carga.kg || 0) - j.cargaKg) < TOLERANCIA_KG;
  // Las ventas sin código de esta jornada que ya entraron al libro de ventas.
  const ventas = facturas.filter((f) => f.origen === "SIN_CONTRATO" && f.canal === "PLANTA_MOVIL"
    && codigoGenerico(f.codigoGenerico)?.cdt === j.cdt && fechaGuion(f.fecha) === fechaGuion(j.fecha));
  const cilindrosVendidos = ventas.reduce((a, f) => a + Number(f.cantidad || 0), 0);
  const ventasPM = facturas.filter((f) => f.origen === "SIN_CONTRATO" && f.canal === "PLANTA_MOVIL");

  function vender(d) {
    if (cerrada) return { ok: false, error: "La jornada está cerrada: su arqueo ya se hizo y no admite ventas nuevas." };
    const res = crearVentaGenerica ? crearVentaGenerica(d) : { ok: false, error: "La venta no está disponible en esta vista." };
    if (!res?.ok) return res;
    setModal(false);
    aviso?.(`Venta sin código registrada${res.factura?.serie ? ` · ${res.factura.serie}` : ""} · entra al libro de ventas`);
    return res;
  }

  function exportar() {
    descargar(`planta-movil-${fechaGuion(HOY)}.csv`, csv([
      ["DISTRIBUCIÓN CON PLANTA MÓVIL"], [EMPRESA.nombre], ["Corte", fechaGuion(HOY)], ["Factor", `1 litro de GLP = ${KG_POR_LITRO_GLP} kg`], [],
      ["Jornada", "Fecha", "Unidad", "Placa", "CDT", "Municipio", "Parroquia", "Punto",
       "Operador", "Ayudante", "Carga kg", "Carga L", "Llenado kg", "Llenado L", "Retorno kg", "Retorno L", "Rendimiento %",
       "10 kg", "18 kg", "27 kg", "Con código", "Sin código", "Estado"],
      ...JORNADAS_PM.map((x) => [x.id, fechaGuion(x.fecha), x.unidad, x.placa, cdtOf(x.cdt).corto, x.municipio, x.parroquia, x.punto,
        `${x.operador} · ${x.cedula}`, `${x.ayudante} · ${x.ayudanteCedula}`,
        x.cargaKg, kgALitros(x.cargaKg).toFixed(2), x.llenadosKg, kgALitros(x.llenadosKg).toFixed(2), x.retornoKg, kgALitros(x.retornoKg).toFixed(2),
        ((x.llenadosKg / x.cargaKg) * 100).toFixed(1),
        x.llenados[10] || 0, x.llenados[18] || 0, x.llenados[27] || 0, x.conCodigo, x.sinCodigo,
        x.estado === "CERRADA" ? "Cerrada" : "En jornada"]),
    ]));
    aviso?.("Jornadas de planta móvil exportadas");
  }

  return (
    <div className="dp">
      <PlantaStyles />
      <UnidadesStyles />
      <div className="dp-hero">
        <div>
          <span>DISTRIBUCIÓN CON PLANTA MÓVIL</span>
          <h2>Planta móvil</h2>
          <p>La unidad llena cilindros en la calle, atiende usuarios con y sin código, y cobra en efectivo y por
             transferencia. Es la operación que hoy queda más fuera del sistema, y la que más gana con registrarse.
             Distribución registra lo físico; los bolívares y el arqueo de caja los ve Comercialización.</p>
        </div>
        <div className="dp-hero-side">
          <button className="dx-primary" disabled={cerrada} onClick={() => setModal(true)}
            title={cerrada ? "La jornada seleccionada está cerrada" : undefined}><Wallet size={14} /> Venta sin código</button>
          <small>{cerrada ? "Sólo en una jornada en curso" : `Tope de ${TOPE_UNIDADES_GENERICO} unidades por venta`}</small>
          <button className="dx-secondary" onClick={exportar}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div className="dp-kpis">
        <DPK icon={Truck} label="Unidades móviles" value={unidades.length} note={`${JORNADAS_PM.length} jornadas registradas`} />
        <DPK icon={Users} label="Usuarios atendidos" value={num(totalAtendidos)} note={`${num(totalSinCodigo)} sin código de usuario`} />
        <DPK icon={Fuel} label="GLP llenado" value={<KgL kg={totalLlenado} />} note={`${JORNADAS_PM.length} jornadas`} tone="ok" />
        <DPK icon={Wallet} label="Ventas sin código" value={num(ventasPM.length)} note="registradas · el cobro y el arqueo los ve Comercialización" tone="warn" />
      </div>

      <div className="dp-regla">
        <MapPin size={17} />
        <div>
          <b>La venta sin código entra al inventario y al libro de ventas.</b>
          <span>Cada cilindro llenado en la calle descuenta GLP y genera ingreso. Registrarlo contra un código
            genérico es lo que evita que esa operación quede fuera del control. Al cierre de la jornada Comercialización
            hace el arqueo del efectivo contra estos cilindros: es la parte más expuesta de toda la operación.</span>
        </div>
      </div>

      <section className="dx-card">
        <div className="dx-card-head">
          <div><h2>Jornadas de planta móvil</h2><p>Selecciona una jornada para ver su detalle.</p></div>
          <select className="dp-select" value={sel} onChange={(e) => setSel(e.target.value)}>
            {JORNADAS_PM.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.punto}</option>)}
          </select>
        </div>

        <div className="dp-jornada">
          <div><span>Jornada</span><b>{j.id}</b><small>{fecha(j.fecha)}</small></div>
          <div><span>Unidad</span><b>{j.unidad} · {j.placa}</b><small>{cdtOf(j.cdt).corto}</small></div>
          <div><span>Ubicación</span><b>{j.punto}</b><small>{j.parroquia}, {j.municipio}</small></div>
          <div><span>Operador</span><b>{j.operador}</b><small>{j.cedula}</small></div>
          <div><span>Ayudante</span><b>{j.ayudante}</b><small>{j.ayudanteCedula}</small></div>
          <div><span>Estado</span><b>{cerrada ? "Cerrada" : "En jornada"}</b><small>{cilindrosJornada} cilindros llenados</small></div>
        </div>

        <div className="dp-dos">
          <div className="dp-panel">
            <h3>Balance de gas</h3>
            <div className="dp-balance">
              <div><span>Cargado en la unidad</span><b><KgL kg={j.cargaKg} /></b>
                {j.documentoCarga && (
                  <small className={`dp-conc ${cargaCuadra ? "ok" : "no"}`}>
                    {cargaCuadra ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {j.documentoCarga} · {cargaCuadra
                      ? "cuadra con Movimiento de planta" : carga ? "no cuadra con planta" : "no está en planta"}</small>
                )}</div>
              <div><span>Llenado a usuarios</span><b><KgL kg={j.llenadosKg} /></b></div>
              <div><span>Retorno a planta</span><b><KgL kg={j.retornoKg} /></b><small>se concilia al cerrar</small></div>
            </div>
            <div className="dp-barra grande"><i style={{ width: `${Math.min(100, rendimiento)}%` }} /></div>
            <small className="dp-muted">Rendimiento de la carga: {rendimiento.toFixed(1)}%</small>
            <div className="dp-llenados">
              {[10, 18, 27].map((k) => <span key={k}>{k} kg<b>{j.llenados[k] || 0}</b></span>)}
              <span>Total<b>{cilindrosJornada}</b></span>
            </div>
          </div>

          <div className="dp-panel">
            <h3>Usuarios y ventas</h3>
            <div className="dp-arqueo">
              <div className="tot"><span>Arqueo de caja</span><b>{cerrada ? "Hecho por Comercialización" : "Al cerrar la jornada"}</b></div>
            </div>
            <div className="dp-usuarios">
              <div><span>Con código de usuario</span><b>{j.conCodigo}</b></div>
              <div><span>Sin código</span><b>{j.sinCodigo}</b></div>
              <div><span>Proporción sin código</span><b>{((j.sinCodigo / (j.conCodigo + j.sinCodigo)) * 100).toFixed(1)}%</b></div>
            </div>
            {(!cerrada || ventas.length > 0) && (
              <div className="dp-ventas">
                <span>Ventas sin código registradas en el sistema</span>
                <b>{ventas.length} {ventas.length === 1 ? "venta" : "ventas"} · {cilindrosVendidos} {cilindrosVendidos === 1 ? "cilindro" : "cilindros"}</b>
                {ventas.slice(0, 5).map((f) => (
                  <small key={f.id}>{f.serie} · {f.compradorNombre} · {cpt(f.concepto).corto} × {f.cantidad}</small>
                ))}
                {!ventas.length && <small>Aún ninguna: cada venta registrada aquí entra al libro de ventas con su boleta.</small>}
              </div>
            )}
            <div className="dp-aclara compacto">
              <AlertTriangle size={14} />
              <span>Si la unidad vende en la calle hay efectivo. Comercialización lo cuadra contra lo llenado aquí: sin ese
                arqueo no hay forma de saber si el gas que salió coincide con el dinero que entró.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dx-card">
        <div className="dx-card-head"><div><h2>Histórico de jornadas</h2><p>Comparación de carga, llenado y usuarios atendidos.</p></div></div>
        <div className="dx-table-wrap">
          <table className="dx-table">
            <thead><tr><th>Jornada</th><th>Fecha</th><th>Unidad</th><th>Punto</th><th className="dp-r">Carga</th><th className="dp-r">Llenado</th><th className="dp-r">Retorno</th><th className="dp-r">Atendidos</th><th className="dp-r">Sin código</th><th className="dp-r">Cilindros</th><th>Estado</th></tr></thead>
            <tbody>
              {JORNADAS_PM.map((x) => (
                <tr key={x.id} className={x.id === sel ? "dp-sel" : ""}>
                  <td><b>{x.id}</b></td>
                  <td>{fechaCorta(x.fecha)}</td>
                  <td><b>{x.unidad}</b><span>{x.placa}</span></td>
                  <td><b>{x.punto}</b><span>{x.parroquia}, {x.municipio}</span></td>
                  <td className="dp-r dp-num"><KgL kg={x.cargaKg} /></td>
                  <td className="dp-r dp-num"><KgL kg={x.llenadosKg} /></td>
                  <td className="dp-r dp-muted"><KgL kg={x.retornoKg} /></td>
                  <td className="dp-r dp-num">{x.conCodigo + x.sinCodigo}</td>
                  <td className="dp-r dp-num">{x.sinCodigo}</td>
                  <td className="dp-r dp-num">{[10, 18, 27].reduce((a, k) => a + (x.llenados[k] || 0), 0)}</td>
                  <td><span className={`dp-estado ${x.estado === "CERRADA" ? "ok" : "wait"}`}>{x.estado === "CERRADA" ? "Cerrada" : "En jornada"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && !cerrada && <ModalVentaPM jornada={j} onClose={() => setModal(false)} onGuardar={vender} />}
    </div>
  );
}

function ModalVentaPM({ jornada, onClose, onGuardar }) {
  const genericos = CODIGOS_GENERICOS.filter((g) => g.cdt === jornada.cdt && g.canal === "PLANTA");
  const [d, setD] = useState(() => ({
    codigoGenerico: genericos[0]?.id || "", cantidad: "1",
    compradorNombre: "", compradorDoc: "", banco: "EFECTIVO", referencia: "",
  }));
  const [error, setError] = useState("");
  const set = (cambios) => { setError(""); setD((x) => ({ ...x, ...cambios })); };
  const g = codigoGenerico(d.codigoGenerico);
  const cantidad = Number(d.cantidad || 0);
  const dentroDelTope = Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= TOPE_UNIDADES_GENERICO;
  // El mismo cálculo que la factura: montos() con el código genérico y la fecha de hoy.
  const m = g && dentroDelTope ? montos(g.concepto, cantidad, g.id, HOY) : null;
  const efectivo = d.banco === "EFECTIVO";
  const ok = Boolean(m) && d.compradorNombre.trim().length > 4 && d.compradorDoc.trim().length > 4 && (efectivo || d.referencia.trim());

  function guardar() {
    const res = onGuardar({
      codigoGenerico: g.id, cantidad, compradorNombre: d.compradorNombre.trim(), compradorDoc: d.compradorDoc.trim(),
      banco: d.banco, referencia: d.referencia.trim() || null, canal: "PLANTA_MOVIL",
    });
    if (!res?.ok) setError(res?.error || "No se pudo registrar la venta.");
  }

  return (
    <div className="dx-modal-bg dp-bg" onClick={onClose}>
      <div className="dp-modal chico" onClick={(e) => e.stopPropagation()}>
        <header><div><small>Planta móvil · {jornada.id}</small><h2>Venta a usuario sin código</h2></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button></header>
        <main>
          <div className="dp-hint">La venta descuenta inventario y entra al libro de ventas contra un código genérico.
            Se exige identificación del comprador aunque no tenga contrato, y hay tope de {TOPE_UNIDADES_GENERICO} unidades por venta.</div>
          <div className="dp-form2">
            <label><span>Código genérico</span>
              <select value={d.codigoGenerico} onChange={(e) => set({ codigoGenerico: e.target.value })}>
                {genericos.map((x) => <option key={x.id} value={x.id}>{x.corto}</option>)}
              </select></label>
            <label><span>Cantidad · máximo {TOPE_UNIDADES_GENERICO}</span>
              <input type="number" min="1" max={TOPE_UNIDADES_GENERICO} step="1" value={d.cantidad}
                onChange={(e) => set({ cantidad: e.target.value })} /></label>
          </div>
          {!dentroDelTope && (
            <div className="dp-error"><AlertTriangle size={14} /> La cantidad va de 1 a {TOPE_UNIDADES_GENERICO} unidades por venta: el tope evita
              que el código genérico se vuelva el destino de lo que no se quiere justificar.</div>
          )}
          <div className="dp-form2">
            <label><span>Nombre del comprador</span>
              <input value={d.compradorNombre} onChange={(e) => set({ compradorNombre: e.target.value })} /></label>
            <label><span>Cédula</span>
              <input value={d.compradorDoc} onChange={(e) => set({ compradorDoc: e.target.value })} placeholder="V-00.000.000" /></label>
          </div>
          <div className="dp-form2">
            <label><span>Forma de pago</span>
              <select value={d.banco} onChange={(e) => set({ banco: e.target.value })}>
                <option value="EFECTIVO">Efectivo</option>
                {BANCOS.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select></label>
            <label><span>Referencia</span>
              <input value={d.referencia} onChange={(e) => set({ referencia: e.target.value })}
                placeholder={efectivo ? "No aplica en efectivo" : "Número de operación"} /></label>
          </div>
          <div className="dp-hint">{m ? `${cpt(g.concepto).corto} × ${cantidad}. ` : ""}El monto lo calcula el sistema con la tarifa del día y queda en la
            factura del comprador; Comercialización lo concilia en el arqueo. En Distribución no se muestran bolívares.</div>
          {error && <div className="dp-error"><AlertTriangle size={14} /> {error}</div>}
        </main>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={guardar}><Save size={14} /> Registrar venta</button>
        </footer>
      </div>
    </div>
  );
}

/* ── Piezas compartidas ── */

function DPK({ icon: Ico, label, value, note, tone = "" }) {
  return <div className={`dp-k ${tone}`}><Ico size={17} /><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}

function PlantaStyles() {
  return <style>{`
.dp{display:flex;flex-direction:column;gap:14px}
.dp-hero{background:#fff;border:1px solid #E0E6EB;border-radius:16px;padding:18px 20px;display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.dp-hero>div:first-child>span{font-size:9px;font-weight:800;color:#26704C;letter-spacing:.05em}
.dp-hero h2{margin:6px 0;font-size:21px}
.dp-hero p{margin:0;color:#6E7C87;font-size:11.5px;line-height:1.6;max-width:740px}
.dp-hero-side{display:flex;flex-direction:column;gap:7px;align-items:flex-end;flex:none}
.dp-hero-side small{font-size:9.5px;color:#7C8892}
.dp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:10px}
.dp-k{background:#fff;border:1px solid #E0E6EB;border-radius:14px;padding:13px;display:flex;flex-direction:column;gap:4px}
.dp-k>svg{color:#17623F;margin-bottom:2px}
.dp-k span{font-size:10px;color:#71808A}
.dp-k b{font-size:19px;line-height:1.15}
.dp-k small{font-size:9.5px;color:#84919B}
.dp-k.ok b{color:#1C7A50}.dp-k.warn b{color:#A2701A}
.dp-regla,.dp-aclara{display:flex;gap:10px;align-items:flex-start;background:#EDF6F1;border:1px solid #D7E8DE;border-radius:13px;padding:12px 14px;color:#2F5B45}
.dp-regla>div>b,.dp-regla>div>span{display:block}
.dp-regla>div>b{font-size:12px;margin-bottom:3px}
.dp-regla>div>span{font-size:10.5px;line-height:1.55}
.dp-aclara{background:#FFF6E7;border-color:#EED8B2;color:#82561D;font-size:10.5px;line-height:1.5}
.dp-aclara.compacto{margin-top:10px;padding:10px;font-size:10px}
.dp-toolbar{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.dp-toolbar select,.dp-select{border:1px solid #DCE4E9;border-radius:9px;padding:8px;background:#fff;font:inherit;font-size:11px}
.dp-cnt{font-size:11px;color:#7A8791;font-weight:600}
.dp-r{text-align:right}
.dp-num{font-variant-numeric:tabular-nums;font-weight:600}
.dp-num.pos{color:#1C7A50}.dp-num.neg{color:#A24848}
.dp-muted{color:#84919B}
.dp-tag{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:800}
.dp-tag.in{background:#E7F4EC;color:#1C7A50}
.dp-tag.out{background:#FFF1E0;color:#A2701A}
.dp-tag.neu{background:#EEF2F5;color:#5D6974}
.dp-cil{font-size:9.5px;color:#5D6B76}
.dp-estado{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:8.5px;font-weight:800}
.dp-estado.ok{background:#E7F4EC;color:#21704A}
.dp-estado.wait{background:#FFF2DD;color:#9D651A}
.dp-conc{display:inline-flex!important;align-items:center;gap:4px;font-size:10.5px;font-weight:650;margin-top:3px}
.dp-conc.ok{color:#1C7A50}.dp-conc.no{color:#A24848}
.dp-empty{text-align:center!important;color:#74818B;padding:30px!important}
.dp-critico{background:#FFFAF3}
.dp-sel{background:#F1F7F4}
.dp-barra{height:7px;background:#EDF1F3;border-radius:99px;overflow:hidden;margin-bottom:3px;min-width:70px}
.dp-barra i{display:block;height:100%;background:#2E9963;border-radius:99px}
.dp-barra.grande{height:10px;margin:10px 0 4px}
.dp-tabs{display:flex;gap:6px}
.dp-tabs button{border:1px solid #E0E6EB;background:#fff;color:#4B5A66;border-radius:10px;padding:9px 13px;font-size:11px;font-weight:700;display:flex;gap:6px;align-items:center;cursor:pointer}
.dp-tabs button.on{background:#17623F;border-color:#17623F;color:#fff}
.dp-niveles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.dp-nivel{background:#fff;border:1px solid #E0E6EB;border-left-width:4px;border-radius:13px;padding:13px}
.dp-nivel span{display:block;font-size:10px;font-weight:800;color:#4B5A66}
.dp-nivel b{display:block;font-size:18px;margin:5px 0 3px}
.dp-nivel small{display:block;font-size:9.5px;color:#7C8892}
.dp-jornada{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin-bottom:14px}
.dp-jornada>div{background:#F5F8F9;border-radius:11px;padding:11px}
.dp-jornada span{display:block;font-size:9px;color:#71808A}
.dp-jornada b{display:block;font-size:12px;margin:3px 0}
.dp-jornada small{display:block;font-size:9.5px;color:#84919B}
.dp-dos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.dp-panel{border:1px solid #E4EAEE;border-radius:13px;padding:14px}
.dp-panel h3{margin:0 0 11px;font-size:13px}
.dp-balance,.dp-usuarios{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.dp-balance>div,.dp-usuarios>div,.dp-arqueo>div{background:#F5F8F9;border-radius:10px;padding:10px}
.dp-balance span,.dp-usuarios span,.dp-arqueo span{display:block;font-size:9px;color:#71808A}
.dp-balance b,.dp-usuarios b,.dp-arqueo b{display:block;font-size:15px;margin-top:3px}
.dp-balance small{display:block;font-size:9px;color:#84919B;margin-top:2px}
.dp-arqueo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.dp-arqueo .tot{grid-column:1/3;background:#EDF6F1;border:1px solid #D7E8DE}
.dp-arqueo .tot b{color:#17623F;font-size:19px}
.dp-usuarios{margin-top:10px}
.dp-ventas{margin-top:10px;background:#F2F6FB;border:1px solid #DCE6F2;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:3px}
.dp-ventas span{font-size:9.5px;color:#4B5A66;font-weight:700}
.dp-ventas b{font-size:14px;color:#2A5FA6}
.dp-ventas small{font-size:10px;color:#5D6B76;line-height:1.4}
.dp-llenados{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}
.dp-llenados span{background:#F5F8F9;border-radius:9px;padding:8px;font-size:9px;color:#71808A;text-align:center}
.dp-llenados b{display:block;font-size:15px;color:#17232C;margin-top:3px}
/* El fondo lo pone la capa de diseño; la posición va aquí para no depender de otra hoja. */
.dp-bg{position:fixed;inset:0;display:grid;place-items:center;padding:18px;z-index:60;background:rgba(15,22,28,.48)}
.dp-modal{width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.22)}
.dp-modal.chico{width:min(560px,96vw)}
.dp-modal>header{padding:15px 18px;border-bottom:1px solid #E6EBEF;display:flex;justify-content:space-between;align-items:flex-start}
.dp-modal>header small{font-size:9px;color:#6D7A85;font-weight:800}
.dp-modal>header h2{margin:3px 0 0;font-size:18px}
.dp-modal>header button{border:1px solid #DDE4E9;background:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer}
.dp-modal>main{padding:16px 18px;overflow:auto;flex:1}
.dp-modal>footer{padding:12px 18px;border-top:1px solid #E6EBEF;display:flex;justify-content:flex-end;gap:7px}
.dp-form2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.dp-modal label span,.dp-full span{display:block;font-size:9.5px;color:#697783;margin-bottom:5px}
.dp-modal input,.dp-modal select,.dp-modal textarea{width:100%;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:9px;font:inherit;font-size:11.5px;background:#fff}
.dp-full{display:block;margin-bottom:10px}
.dp-sep{font-size:9.5px;font-weight:800;color:#26704C;letter-spacing:.05em;text-transform:uppercase;margin:16px 0 9px;padding-bottom:6px;border-bottom:1px solid #E6ECEF}
.dp-hint{background:#F4F7F9;border:1px solid #E0E7EC;color:#4B5A66;border-radius:9px;padding:9px;font-size:10px;line-height:1.5;margin-bottom:10px}
.dp-error{display:flex;gap:7px;align-items:flex-start;background:#FBECEC;border:1px solid #F2D4D4;color:#A83E3E;border-radius:9px;padding:9px;font-size:11px;line-height:1.45;margin:10px 0}
.dp-error svg{flex:none;margin-top:1px}
.dp-total{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#EDF6F1;border:1px solid #D7E8DE;border-radius:11px;padding:12px;margin-top:10px}
.dp-total span{font-size:10px;color:#3F6B54}
.dp-total b{font-size:19px;color:#17623F;white-space:nowrap}
.dp-ficha{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.dp-ficha>div{background:#F5F8F9;border-radius:10px;padding:10px}
.dp-ficha span{display:block;font-size:9px;color:#71808A}
.dp-ficha b{display:block;font-size:11.5px;margin-top:3px}
.dp-ficha .dp-full2{grid-column:1/5}
@media(max-width:1000px){.dp-hero{flex-direction:column}.dp-hero-side{align-items:flex-start}.dp-niveles,.dp-dos,.dp-balance,.dp-usuarios{grid-template-columns:1fr}.dp-jornada{grid-template-columns:1fr 1fr}.dp-form2,.dp-ficha{grid-template-columns:1fr 1fr}}
`}</style>;
}
