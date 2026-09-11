import React, { useMemo, useState } from "react";
import {
  Users, Search, CheckCircle2, Truck, AlertTriangle, History, ShieldCheck, Clock,
} from "lucide-react";
import {
  CLIENTE_PORTAL, USUARIOS, comunaOf, cdtOf, cpt, usr, num, fecha, estadoSolicitud, motivoNoEntrega,
  kgDeSolicitud,
} from "./datos.jsx";
import {
  estadoAD, marcaDe, tipoAD, tipoADInfo, adPlanificada, adActiva, personasDeAD, cuadreJornada,
} from "./flujo.js";

/* ════════════════════════════════════════════════════════════════
   ROL COMUNA · dentro del portal del usuario

   El Portal Comuna dejó de ser una cara aparte el 01/09/2026. Nunca fue un sistema
   distinto: es el mismo portal visto por alguien con un permiso más. El coordinador
   de una comuna es, antes que nada, un usuario con su contrato y su bombona; lo que
   cambia es que además ve cómo va su comuna.

   La comuna ya no es consignataria. La responsabilidad de GasLara termina cuando las
   bombonas vuelven al punto comunal: si cada dueño retira la suya o no, ya no le compete
   a la empresa. Por eso aquí no se registra ninguna entrega persona por persona. Lo que
   el coordinador necesita es saber quién de su comuna tiene pedido, en qué momento va la
   jornada (recolección, llenado, devolución) y a quién no se pudo atender. Todo sale de
   las solicitudes y las AD vivas: estas pantallas no guardan estado propio.
   ════════════════════════════════════════════════════════════════ */

const COM = comunaOf(CLIENTE_PORTAL.comuna);

/* Estados en que un pedido todavía avanza. Culminado, abonado o con el pago rechazado ya no. */
const ESTADOS_VIVOS = ["SIN_PAGO", "POR_COMPLETAR", "PAGADA", "EN_AD", "POR_REPLANIFICAR"];
const esVivo = (s) => ESTADOS_VIVOS.includes(s.estado) && s.pago?.estado !== "RECHAZADO";
const porResolver = (s) => ["POR_COMPLETAR", "POR_REPLANIFICAR"].includes(s?.estado) || s?.pago?.estado === "RECHAZADO";
const CHIP_TONO = { verde: "ok", azul: "act", ambar: "wait", gris: "", rojo: "bad" };
// Las AD del flujo se numeran sin prefijo; las del histórico anterior traen "AD-".
const nombreAD = (ad) => (/^AD/i.test(String(ad)) ? String(ad) : `AD ${ad}`);
const masReciente = (a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0);
const fechaAD = (r) => r.fechaJornada || r.fechaPlan || null;

/** Lo que el coordinador necesita saber del pedido de un miembro, dicho en tercera persona. */
function momentoMiembro(s, ruta) {
  if (!s) return { texto: "Sin pedidos de bombona", tono: "" };
  if (s.pago?.estado === "RECHAZADO") return { texto: "Pago rechazado: la referencia ya respaldaba otro pedido", tono: "bad" };
  if (s.estado === "EN_AD" && ruta) {
    const mk = marcaDe(ruta, s.id);
    if (mk.recogida === false) return { texto: `AD ${ruta.ad} · no se recogió: ${motivoNoEntrega(mk.motivo).nombre}`, tono: "bad" };
    if (mk.llenada === false) return { texto: `AD ${ruta.ad} · volvió vacía: ${motivoNoEntrega(mk.motivo).nombre}`, tono: "bad" };
    const e = estadoAD(ruta.estadoRuta);
    const lugar = tipoAD(ruta) === "ESPECIAL" ? " · por domicilio" : "";
    return { texto: `AD ${ruta.ad} · ${e.nombre}${lugar}`, tono: e.id === "EN_PUNTO" ? "ok" : e.id === "INCIDENCIA" ? "bad" : "act" };
  }
  if (s.estado === "POR_REPLANIFICAR") {
    const p = s.problema || {};
    return { texto: `${p.nombre || "Problema en la jornada"}${p.adOrigen ? ` (AD ${p.adOrigen})` : ""} · plazo ${fecha(p.plazo)}`, tono: "wait" };
  }
  if (s.estado === "POR_COMPLETAR") {
    return { texto: s.tarifaPendiente ? "La tarifa cambió: falta la diferencia" : "Transfirió de menos: falta completar", tono: "wait" };
  }
  if (s.estado === "PAGADA") return { texto: "Pagado · espera que se planifique su AD", tono: "" };
  if (s.estado === "CULMINADO") {
    const ad = (s.historialAD || []).filter((h) => h.resultado === "ENTREGADA").slice(-1)[0]?.ad || s.ad;
    return { texto: `Devuelta llena al punto${ad ? ` · ${nombreAD(ad)}` : ""}`, tono: "ok" };
  }
  if (s.estado === "ABONADA") return { texto: s.motivoNoCompra || estadoSolicitud(s.estado).adminDesc, tono: "" };
  return { texto: estadoSolicitud(s.estado).adminDesc, tono: "" };
}

/**
 * Las filas que comparten las vistas: cada miembro con su pedido vigente y el momento
 * real en que está. Depende de las solicitudes y de las AD vivas, así que lo que registra
 * Distribución (recolección, llenado, cierre) se ve aquí en el mismo instante. El padrón
 * entra también: un usuario dado de alta en la comuna aparece sin recargar.
 */
export function useFilasComuna(solicitudes = [], rutas = [], padron = null) {
  return useMemo(() => {
    const porRuta = new Map(rutas.map((r) => [r.id, r]));
    const miembros = (padron?.length ? padron : USUARIOS).filter((u) => u.comuna === COM.id);
    return miembros.map((u) => {
      const bombonas = solicitudes.filter((s) => s.usuario === u.id && cpt(s.concepto).bombona).sort(masReciente);
      const vivos = bombonas.filter(esVivo);
      const vigente = vivos[0] || bombonas[0] || null;
      const ruta = vigente?.rutaId ? porRuta.get(vigente.rutaId) || null : null;
      return { u, vigente, vivos, ruta, momento: momentoMiembro(vigente, ruta) };
    });
  }, [solicitudes, rutas, padron]);
}

/** Las AD por las que pasaron los miembros: las que los tienen convocados y las que ya
 *  cerraron (quedan en el historial de cada pedido). La más reciente primero. */
function adsDeComuna(filas, solicitudes, rutas) {
  const ids = new Set(filas.map((x) => x.u.id));
  const deMiembros = solicitudes.filter((s) => ids.has(s.usuario));
  const vistas = new Set(deMiembros.flatMap((s) => [s.rutaId, ...(s.historialAD || []).map((h) => h.rutaId)]).filter(Boolean));
  return rutas
    .filter((r) => vistas.has(r.id) && adPlanificada(r))
    .map((r) => ({ r, miembros: personasDeAD(r, deMiembros) }))
    .filter((x) => x.miembros.length)
    .sort((a, b) => new Date(fechaAD(b.r) || 0) - new Date(fechaAD(a.r) || 0) || String(b.r.ad).localeCompare(String(a.r.ad)));
}

/** Lo que pasó con la bombona de una persona en esta jornada, según lo que registró Distribución. */
function resultadoEnAD(r, s) {
  const salio = (s.historialAD || []).some((h) => h.rutaId === r.id && h.resultado === "SALIO_POR_TARIFA");
  if (salio) return { punto: ["Salió del AD por la tarifa nueva", "wait"], planta: ["—", ""] };
  const j = r.jornada || {};
  const mk = marcaDe(r, s.id);
  if (!j.recoleccion) return { punto: ["Pendiente", ""], planta: ["—", ""] };
  if (mk.recogida === false) return { punto: [`No se recogió · ${motivoNoEntrega(mk.motivo).nombre}`, "bad"], planta: ["—", ""] };
  if (!j.llenado) return { punto: ["Recogida", "ok"], planta: ["Pendiente", ""] };
  if (mk.llenada === false) return { punto: ["Recogida", "ok"], planta: [`Volvió vacía · ${motivoNoEntrega(mk.motivo).nombre}`, "bad"] };
  return { punto: ["Recogida", "ok"], planta: ["Llenada · devuelta al punto", "ok"] };
}

export const NAV_COMUNA = [
  { id: "com-miembros", label: "Miembros de la comuna", icon: Users },
  { id: "com-recepcion", label: "Recepción de jornada", icon: Truck },
  { id: "com-jornadas", label: "Histórico de jornadas", icon: History },
];

function CabeceraComuna() {
  return (
    <div className="rc-cab">
      <ShieldCheck size={17} />
      <div>
        <b>Coordinas {COM.nombre}</b>
        <span>Ves los pedidos de los miembros y cada momento de la jornada en {COM.punto}:
          recolección, llenado en planta y devolución al punto. La responsabilidad de GasLara
          termina cuando las bombonas vuelven al punto; el retiro de cada persona no se registra.
          Coordina {COM.coordinador} · {cdtOf(COM.cdt).nombre}.</span>
      </div>
    </div>
  );
}

function EstadoMiembro({ s }) {
  if (s.pago?.estado === "RECHAZADO") return <span className="rc-chip bad">Pago rechazado</span>;
  const e = estadoSolicitud(s.estado);
  return <span className={`rc-chip ${CHIP_TONO[e.tono] || ""}`}>{e.admin}</span>;
}

export function MiembrosComuna({ filas }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const enAD = filas.filter((x) => x.vigente?.estado === "EN_AD");
  const kgEnAD = enAD.reduce((a, x) => a + kgDeSolicitud(x.vigente), 0);
  const lista = filas.filter((x) => (
    (!q || `${x.u.nombre} ${x.u.doc} ${x.u.contrato}`.toLowerCase().includes(q.toLowerCase()))
    && (filtro === "TODOS"
      || (filtro === "EN_AD" && x.vigente?.estado === "EN_AD")
      || (filtro === "PAGADA" && x.vigente?.estado === "PAGADA")
      || (filtro === "RESOLVER" && porResolver(x.vigente))
      || (filtro === "SIN" && !x.vivos.length))
  ));

  return (
    <>
      <RolComunaStyles />
      <CabeceraComuna />
      <div className="rc-kpis">
        <K icon={Users} l="Miembros" v={filas.length} s={`registrados en ${COM.nombre}`} />
        <K icon={Truck} l="Convocados en un AD" v={enAD.length} s={`${num(kgEnAD)} kg en jornada`} />
        <K icon={CheckCircle2} l="Pagados por planificar" v={filas.filter((x) => x.vigente?.estado === "PAGADA").length} s="esperan que se planifique su AD" />
        <K icon={AlertTriangle} l="Por resolver" v={filas.filter((x) => porResolver(x.vigente)).length} s="por completar, por replanificar o con el pago rechazado" />
      </div>

      <section className="rc-card">
        <div className="rc-tools">
          <div className="rc-search"><Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, cédula o contrato" /></div>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="EN_AD">Convocados en un AD</option>
            <option value="PAGADA">Pagados por planificar</option>
            <option value="RESOLVER">Por resolver</option>
            <option value="SIN">Sin pedido en curso</option>
          </select>
        </div>
        <div className="rc-scroll">
          <table>
            <thead><tr>
              <th>Usuario</th><th>Documento</th><th>Contrato</th><th>Pedido</th><th>Estado</th><th>Momento</th>
            </tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.u.id}>
                  <td><b>{x.u.nombre}</b><span>{x.u.dir}</span></td>
                  <td>{x.u.doc}</td>
                  <td>{x.u.contrato}</td>
                  <td>{x.vigente
                    ? <><b>{cpt(x.vigente.concepto).corto}{x.vigente.cantidad > 1 ? ` × ${num(x.vigente.cantidad)}` : ""}</b>
                        <span>{x.vigente.id} · {fecha(x.vigente.fecha)}</span></>
                    : "—"}</td>
                  <td>{x.vigente ? <EstadoMiembro s={x.vigente} /> : "—"}</td>
                  <td><span className={`rc-chip ${x.momento.tono}`}>{x.momento.texto}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!lista.length && <div className="rc-vacio">Ningún miembro coincide con el filtro.</div>}
      </section>
    </>
  );
}

/**
 * RECEPCIÓN DE JORNADA · el AD real de la comuna, tomado de las solicitudes de sus miembros.
 * Las cifras son las del cuadre del AD (`cuadreJornada`): las mismas que ve Distribución.
 */
export function RecepcionComuna({ filas, solicitudes = [], rutas = [] }) {
  // Sólo jornadas comunales: el AD especial va por domicilio y no pasa por el punto.
  const jornadas = useMemo(() => adsDeComuna(filas, solicitudes, rutas).filter((x) => tipoAD(x.r) === "JORNADA"),
    [filas, solicitudes, rutas]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  // La que se muestra: la elegida; si no, la que está en curso; si no, la última que cerró.
  const actual = jornadas.find((x) => x.r.id === sel) || jornadas.find((x) => adActiva(x.r)) || jornadas[0] || null;

  if (!actual) {
    const esperan = filas.filter((x) => x.vigente?.estado === "PAGADA").length;
    return (
      <>
        <RolComunaStyles />
        <CabeceraComuna />
        <section className="rc-card">
          <div className="rc-vacio">
            <Truck size={26} />
            <p>Tu comuna todavía no tiene una jornada planificada. Aparece aquí en cuanto Distribución planifique el AD
              {esperan ? `: ${esperan} miembro${esperan > 1 ? "s" : ""} con el pago verificado la esperan` : ""}.</p>
          </div>
        </section>
      </>
    );
  }

  const r = actual.r;
  const e = estadoAD(r.estadoRuta);
  const c = cuadreJornada(r, solicitudes);
  const j = r.jornada || {};
  const personas = personasDeAD(r, solicitudes)
    .map((s) => ({ s, u: usr(s.usuario), ...resultadoEnAD(r, s) }))
    .filter((x) => !q || `${x.u.nombre} ${x.u.doc}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.u.nombre.localeCompare(b.u.nombre));
  const hitos = [
    { t: "Planificada", f: r.fechaPlan, h: null, d: `${tipoADInfo(r).nombre} · jornada el ${fecha(r.fechaJornada)}` },
    { t: "Salida a recolección", f: r.fechaSalida, h: r.horaSalida, d: r.fechaSalida ? `Unidad ${r.unidad}` : "Sale vacía a recoger" },
    { t: "Recolección en el punto", f: j.recoleccion?.fecha, h: j.recoleccion?.hora, d: j.recoleccion?.por || "Cada quien lleva su bombona vacía" },
    { t: "Llenado en planta", f: j.llenado?.fecha, h: j.llenado?.hora, d: j.llenado ? "Las que no admiten llenado vuelven vacías" : "Las malas no se llenan" },
    { t: "Devolución al punto", f: j.devolucion?.fecha, h: j.devolucion?.hora, d: "Salen diez, vuelven diez: llenas y vacías" },
    { t: "AD cerrada", f: r.cerradaEn, h: r.horaCierre, d: r.cerradaEn ? `Recibió en el punto ${r.recepcion?.receptor || "—"}` : "Distribución factura lo devuelto lleno" },
  ];
  const siguiente = hitos.findIndex((x) => !x.f);

  return (
    <>
      <RolComunaStyles />
      <CabeceraComuna />
      <div className="rc-kpis">
        <K icon={Users} l="Convocadas" v={c.convocadas} s={c.kgConvocado != null ? `${num(c.kgConvocado)} kg pagados` : "personas con pedido pagado"} />
        <K icon={Truck} l="Recogidas en el punto" v={c.recogidas} s={c.recogidas != null ? `${num(c.noRecogidas)} no se recogieron` : "falta la recolección"} />
        <K icon={CheckCircle2} l="Llenadas en planta" v={c.llenadas} s={c.llenadas != null ? `${num(c.noLlenadas)} no admitieron llenado` : "falta el llenado"} />
        <K icon={History} l="Devueltas al punto" v={c.devueltas} s={c.devueltas != null ? (c.cuadra ? "todo lo recogido volvió al punto" : "no cuadra con lo recogido") : "falta la devolución"} />
      </div>

      <section className="rc-card">
        <div className="rc-head">
          <div><span>JORNADA {fecha(r.fechaJornada)}</span><h3>AD {r.ad} · {r.comunidad || COM.punto}</h3>
            <p>{tipoADInfo(r).desc}.</p></div>
          {jornadas.length > 1
            ? <select value={r.id} onChange={(ev) => setSel(ev.target.value)}>
                {jornadas.map((x) => <option key={x.r.id} value={x.r.id}>AD {x.r.ad} · {fecha(fechaAD(x.r))} · {estadoAD(x.r.estadoRuta).nombre}</option>)}
              </select>
            : <em className={`rc-chip ${CHIP_TONO[e.tono] || ""}`}>{e.nombre}</em>}
        </div>
        <div className="rc-datos">
          <div><span>AD</span><b>{r.ad}</b></div>
          <div><span>Fecha de la jornada</span><b>{fecha(r.fechaJornada)}</b></div>
          <div><span>Momento</span><b>{e.nombre}</b></div>
          <div><span>Unidad</span><b>{r.unidad || "—"}</b></div>
          <div><span>Conductor</span><b>{r.conductor || "—"}</b></div>
          <div><span>Ayudante</span><b>{r.ayudante || "—"}</b></div>
        </div>
        <div className="rc-momentos">
          {hitos.map((x, i) => (
            <div key={x.t} className={x.f ? "hecho" : i === siguiente && e.id !== "INCIDENCIA" ? "ahora" : ""}>
              <i>{x.f ? <CheckCircle2 size={12} /> : <Clock size={12} />} {x.t}</i>
              <b>{x.f ? `${fecha(x.f)}${x.h && x.h !== "—" ? ` · ${x.h}` : ""}` : "Pendiente"}</b>
              <span>{x.d}</span>
            </div>
          ))}
        </div>
        {e.id === "INCIDENCIA" && (
          <div className="rc-nota bad"><AlertTriangle size={15} />
            <span>El AD tiene una incidencia{r.obsIncidencia ? `: ${r.obsIncidencia}` : ""}. Distribución informa la nueva fecha.</span></div>
        )}

        <div className="rc-sub">
          <h4>Personas de la jornada · {num(personas.length)}</h4>
          <div className="rc-search"><Search size={15} />
            <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Buscar persona" /></div>
        </div>
        <div className="rc-scroll">
          <table>
            <thead><tr><th>Persona</th><th>Bombona</th><th>En el punto</th><th>En planta</th></tr></thead>
            <tbody>
              {personas.map((x) => (
                <tr key={x.s.id}>
                  <td><b>{x.u.nombre}</b><span>{x.u.doc}</span></td>
                  <td><b>{cpt(x.s.concepto).corto}</b><span>{x.s.id}</span></td>
                  <td><span className={`rc-chip ${x.punto[1]}`}>{x.punto[0]}</span></td>
                  <td>{x.planta[0] === "—" ? "—" : <span className={`rc-chip ${x.planta[1]}`}>{x.planta[0]}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!personas.length && <div className="rc-vacio">Nadie coincide con la búsqueda.</div>}
        <div className="rc-nota"><CheckCircle2 size={15} />
          <span>Cuando las bombonas vuelven al punto termina la responsabilidad de GasLara: cada dueño retira
            la suya y ese retiro no se registra. Quien no se pudo atender pasa a replanificación, y la factura
            de las devueltas llenas sale al cerrar el AD.</span></div>
      </section>
    </>
  );
}

/** HISTÓRICO · las AD reales por las que pasaron los miembros, con su cuadre. */
export function JornadasComuna({ filas, solicitudes = [], rutas = [] }) {
  const ads = useMemo(() => adsDeComuna(filas, solicitudes, rutas), [filas, solicitudes, rutas]);
  return (
    <>
      <RolComunaStyles />
      <CabeceraComuna />
      <section className="rc-card">
        <div className="rc-head">
          <div><h3>Histórico de jornadas</h3>
            <p>Las AD por las que pasaron los miembros de tu comuna, con el cuadre de cada una: lo convocado,
              lo recogido en el punto, lo llenado en planta y lo que volvió.</p></div>
        </div>
        <div className="rc-history">
          {ads.map(({ r, miembros }) => {
            const c = cuadreJornada(r, solicitudes);
            const e = estadoAD(r.estadoRuta);
            return (
              <article key={r.id}>
                <div><span>{fecha(fechaAD(r))} · {tipoADInfo(r).nombre}</span><b>AD {r.ad}</b>
                  <em className={`rc-chip ${CHIP_TONO[e.tono] || ""}`}>{e.nombre}</em></div>
                <div><span>De tu comuna</span><b>{num(miembros.length)}</b></div>
                <div><span>Convocadas</span><b>{num(c.convocadas)}</b></div>
                <div><span>Recogidas</span><b>{c.recogidas == null ? "—" : num(c.recogidas)}</b></div>
                <div><span>Llenadas</span><b>{c.llenadas == null ? "—" : num(c.llenadas)}</b></div>
                <div><span>Devueltas</span><b>{c.devueltas == null ? "—" : num(c.devueltas)}</b></div>
                {c.cerrada && <small>{num(c.replanificadas || 0)} a replanificación · {num(c.abonadas || 0)} cerradas con saldo a favor</small>}
              </article>
            );
          })}
        </div>
        {!ads.length && <div className="rc-vacio">Todavía no hay AD registradas para los miembros de tu comuna.</div>}
      </section>
    </>
  );
}

function K({ icon: I, l, v, s }) {
  return <div className="rc-k"><I size={17} /><span>{l}</span><b>{v == null ? "—" : num(v)}</b><small>{s}</small></div>;
}

function RolComunaStyles() {
  return <style>{`
.rc-cab{display:flex;gap:11px;background:#EDF5F0;border:1px solid #D6E7DD;border-radius:12px;padding:14px;margin-bottom:16px}
.rc-cab svg{color:#17623F;flex:none;margin-top:1px}
.rc-cab b{display:block;font-size:13.5px;font-weight:650;color:#17623F;line-height:1.4}
.rc-cab span{display:block;font-size:12.5px;color:#3A464E;line-height:1.6;margin-top:4px}
.rc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:11px;margin-bottom:16px}
.rc-k{background:#fff;border:1px solid #E0E6E9;border-radius:13px;padding:14px}
.rc-k svg{color:#20714A}
.rc-k span{display:block;font-size:11px;color:#75828B;font-weight:600;margin-top:6px}
.rc-k b{display:block;font-size:23px;font-weight:660;margin:3px 0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.rc-k small{display:block;font-size:11.5px;color:#75828B;line-height:1.4}
.rc-card{background:#fff;border:1px solid #E0E6E9;border-radius:13px;padding:16px}
.rc-tools,.rc-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.rc-head>div>span{font-size:11px;font-weight:700;color:#26704C;letter-spacing:.04em}
.rc-head h3{font-size:16px;margin:4px 0;font-weight:650}
.rc-head p{font-size:12.5px;color:#74818B;margin:0;line-height:1.55;max-width:640px}
.rc-search{display:flex;align-items:center;gap:7px;border:1px solid #DBE3E7;border-radius:9px;padding:9px 11px;min-width:270px}
.rc-search input{border:0;outline:0;width:100%;font-size:13px;font-family:inherit}
.rc-tools select,.rc-head select{border:1px solid #DBE3E7;border-radius:9px;padding:9px 11px;background:#fff;font-size:13px;font-family:inherit}
.rc-scroll{overflow:auto;border:1px solid #E4E9EC;border-radius:10px}
.rc-scroll table{width:100%;border-collapse:collapse;font-size:12.5px}
.rc-scroll th,.rc-scroll td{padding:11px 12px;border-bottom:1px solid #E9EDEF;text-align:left;white-space:nowrap}
.rc-scroll th{background:#F5F7F8;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#6D7982;font-weight:700}
.rc-scroll td b,.rc-scroll td span:not(.rc-chip){display:block}
.rc-scroll td span:not(.rc-chip){font-size:11.5px;color:#74818B;margin-top:2px}
.rc-chip{display:inline-flex;padding:5px 9px;border-radius:99px;font-size:11px;font-weight:650;font-style:normal;background:#EEF2F4;color:#516069;white-space:nowrap}
.rc-chip.ok{background:#E8F5ED;color:#216B48}
.rc-chip.act{background:#E7F0F7;color:#1B5E8A}
.rc-chip.wait{background:#FFF1DC;color:#925F19}
.rc-chip.bad{background:#FBE9E9;color:#944141}
.rc-datos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}
.rc-datos>div{background:#F5F7F8;border-radius:9px;padding:10px 11px;min-width:0}
.rc-datos span{display:block;font-size:11px;color:#75828B}
.rc-datos b{display:block;font-size:13.5px;margin-top:3px;font-weight:620}
.rc-momentos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:0 0 16px}
.rc-momentos>div{border:1px solid #E4E9EC;border-radius:10px;padding:11px 12px;background:#FAFBFB}
.rc-momentos>div.hecho{background:#EDF7F1;border-color:#D3E8DC}
.rc-momentos>div.ahora{background:#EAF1F8;border-color:#CFE0EC}
.rc-momentos i{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6D7982;display:flex;align-items:center;gap:5px}
.rc-momentos>div.hecho i{color:#216B48}
.rc-momentos>div.ahora i{color:#1B5E8A}
.rc-momentos b{display:block;font-size:13px;margin-top:5px;font-variant-numeric:tabular-nums}
.rc-momentos span{display:block;font-size:11.5px;color:#74818B;margin-top:3px;line-height:1.4}
.rc-sub{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:4px 0 10px;flex-wrap:wrap}
.rc-sub h4{margin:0;font-size:13.5px;font-weight:650}
.rc-nota{display:flex;gap:9px;align-items:flex-start;background:#EDF5F0;border:1px solid #D6E7DD;border-radius:10px;padding:12px;margin-top:14px;font-size:12px;color:#315E48;line-height:1.5}
.rc-nota svg{flex:none;margin-top:1px}
.rc-nota.bad{background:#FBE9E9;border-color:#F0CFCF;color:#944141;margin:0 0 14px}
.rc-history{display:flex;flex-direction:column;gap:8px}
.rc-history article{display:grid;grid-template-columns:1.7fr repeat(5,.75fr);gap:12px;align-items:center;border:1px solid #E4E9EC;border-radius:10px;padding:12px 13px}
.rc-history span,.rc-history b{display:block;font-size:11.5px}
.rc-history span{color:#74818B}
.rc-history b{font-size:14px;margin-top:2px;font-variant-numeric:tabular-nums}
.rc-history em{margin-top:5px}
.rc-history small{grid-column:1/-1;font-size:11.5px;color:#74818B;border-top:1px dashed #E4E9EC;padding-top:8px}
.rc-vacio{text-align:center;padding:36px;color:#78868F;font-size:13px}
.rc-vacio svg{display:block;margin:0 auto 10px;color:#9AA7AE}
.rc-vacio p{margin:0 auto;max-width:520px;line-height:1.55}
@media(max-width:820px){.rc-history article{grid-template-columns:1fr 1fr}.rc-search{min-width:0;flex:1}}
`}</style>;
}
