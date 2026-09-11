import React, { useMemo, useState } from "react";
import { Truck, CheckCircle2, AlertTriangle, CarFront, UserRound, Users, X } from "lucide-react";
import {
  UNIDADES_DISTRIBUCION, OPERADORES_DISTRIBUCION, AYUDANTES_DISTRIBUCION, unidadDistribucion, operadorDistribucion,
  disponibilidadUnidad, operadoresParaUnidad,
} from "./distribucionSeed.js";
import { HOY, num, fecha } from "./datos.jsx";
import { adActiva, adEnJornada, estadoAD, cuadreJornada } from "./flujo.js";

/* AgendaDistribucion se retiro el 01/09/2026.
   Repartia las AD en nueve franjas horarias calculadas con el indice de la ruta
   modulo nueve: la hora no salia de ningun dato. La hora real vive en `horaSalida`
   —se llena al marcar salida— y se ve en la columna «Jornada y salida» de AD del dia. */

/* PreparacionCarga se retiro con el flujo por momentos: el camión sale VACÍO a recoger las
   bombonas que la gente lleva al punto, así que no hay carga que cuadrar antes de salir.
   Lo que se recoge, se llena y se devuelve se registra en Ejecución y cierre. */

/* ── Utilidades compartidas con Distribucion.jsx ─────────────────────────────────── */

/* El input de fecha trabaja en AAAA-MM-DD; el sistema, con fechas locales. */
const dos = (n) => String(n).padStart(2, "0");
export const aISO = (d) => { const v = d instanceof Date ? d : new Date(d); return `${v.getFullYear()}-${dos(v.getMonth() + 1)}-${dos(v.getDate())}`; };
export const deISO = (s) => { const [a, m, d] = String(s || "").split("-").map(Number); return a ? new Date(a, (m || 1) - 1, d || 1) : HOY; };

/** Conductor por defecto de una unidad: su titular si está habilitado; si no, el primero que pueda llevarla. */
export const conductorDe = (u) => {
  const ops = operadoresParaUnidad(u.id);
  return ops.some((o) => o.id === u.operadorDefault) ? u.operadorDefault : (ops[0]?.id || "");
};

/** Una unidad sirve para planificar si puede salir de verdad y tiene quién la conduzca. */
export const unidadLista = (u) => disponibilidadUnidad(u, HOY).disponible && operadoresParaUnidad(u.id).length > 0;

/**
 * Las opciones del selector de vehículo. Las que no pueden salir se ven, pero deshabilitadas
 * y con su motivo: el planificador sabe por qué no está y no la elige por error.
 */
export function OpcionesUnidad() {
  return UNIDADES_DISTRIBUCION.filter((u) => !u.granel).map((u) => {
    const d = disponibilidadUnidad(u, HOY);
    const motivo = !d.disponible ? `no disponible: ${d.motivos.join(" · ")}`
      : !operadoresParaUnidad(u.id).length ? "sin conductor habilitado" : "";
    return <option key={u.id} value={u.placa} disabled={Boolean(motivo)}>{u.placa} · {u.etiqueta}{motivo ? ` — ${motivo}` : ""}</option>;
  });
}

/* ── Flota y operadores ─────────────────────────────────────────────────────────── */

export function FlotaDistribucion({ rutas = [], solicitudes = [] }) {
  const [tab, setTab] = useState("vehiculos");
  // La ocupación sale sólo de las AD activas: una cerrada ya no compromete a nadie.
  const activas = useMemo(() => rutas.filter(adActiva), [rutas]);
  const kgDe = useMemo(() => new Map(activas.map((r) => [r.id, cuadreJornada(r, solicitudes).kgConvocado])), [activas, solicitudes]);
  const listaAD = (rs, conPlaca) => rs.map((r) => `AD ${r.ad} · ${conPlaca ? r.unidad : estadoAD(r.estadoRuta).nombre}`).join(" | ");

  return <div className="de-page"><DEStyles />
    <div className="de-tabs">
      <button className={tab === "vehiculos" ? "on" : ""} onClick={() => setTab("vehiculos")}><CarFront size={14} />Vehículos</button>
      <button className={tab === "operadores" ? "on" : ""} onClick={() => setTab("operadores")}><UserRound size={14} />Conductores</button>
      <button className={tab === "ayudantes" ? "on" : ""} onClick={() => setTab("ayudantes")}><Users size={14} />Ayudantes</button>
    </div>

    {tab === "vehiculos" && <>
      <div className="de-warning ok"><CheckCircle2 size={16} /><div><b>Disponible no es sólo estar estacionado.</b>
        <span>Una unidad sólo sale con certificación GLP y póliza vigentes, mantenimiento al día, conductor habilitado y ayudante.</span></div></div>
      <div className="de-fleet">{UNIDADES_DISTRIBUCION.map((u) => {
        const d = disponibilidadUnidad(u, HOY);
        const ops = operadoresParaUnidad(u.id);
        const rs = activas.filter((r) => unidadDistribucion(r.unidad).placa === u.placa);
        const kg = rs.reduce((a, r) => a + (kgDe.get(r.id) || 0), 0);
        const pct = u.capacidad ? Math.round(kg / u.capacidad * 100) : 0;
        const enJornada = rs.find(adEnJornada);
        const estado = !d.disponible ? "No disponible" : !ops.length ? "Sin conductor" : enJornada ? estadoAD(enJornada.estadoRuta).nombre : rs.length ? "Con AD planificada" : "Disponible";
        return <article key={u.id} className={d.disponible && ops.length ? "" : "de-nodisp"}>
          <div className="de-fleeticon"><Truck size={20} /></div>
          <div className="de-fleetmain"><span>{u.etiqueta}</span><h3>{u.placa}</h3>
            <p>Código interno {u.codigoInterno} · capacidad {num(u.capacidad)} kg por viaje · ayudante {d.ayudante.nombre}</p>
            <p>Certificación GLP hasta {fecha(u.certificacionVence)} · póliza hasta {fecha(u.polizaVence)} · {u.mantenimiento === "TALLER" ? "en taller" : "mantenimiento al día"}</p>
            {!u.granel && <div className="de-capmini"><i><em style={{ width: `${Math.min(100, pct)}%` }} /></i>
              <span>{num(kg)} kg convocados en AD activas · {pct}% de un viaje</span></div>}
            {!d.disponible && <div className="de-motivos">{d.motivos.map((m) => <span key={m}>{m}</span>)}</div>}
          </div>
          <div className="de-fleetright"><b>{estado}</b><span>{rs.length ? listaAD(rs) : "Sin AD activa"}</span></div>
        </article>;
      })}</div>
    </>}

    {tab === "operadores" && <div className="de-fleet">{OPERADORES_DISTRIBUCION.map((o) => {
      const rs = activas.filter((r) => r.operadorId === o.id);
      const puede = UNIDADES_DISTRIBUCION.filter((u) => operadoresParaUnidad(u.id).some((x) => x.id === o.id)).map((u) => u.placa);
      return <article key={o.id} className={o.activo ? "" : "de-nodisp"}>
        <div className="de-fleeticon"><UserRound size={20} /></div>
        <div className="de-fleetmain"><span>{o.tipo === "EPSDC" ? `EPSDC ${o.epsdc || ""}` : "Fuerza propia"}</span><h3>{o.nombre}</h3>
          <p>{o.cedula} · habilitado para {puede.join(", ") || "—"}</p></div>
        <div className="de-fleetright"><b>{!o.activo ? "No disponible" : rs.length ? "Con AD activa" : "Disponible"}</b><span>{rs.length ? listaAD(rs, true) : "Sin AD activa"}</span></div>
      </article>;
    })}</div>}

    {tab === "ayudantes" && <div className="de-fleet">{AYUDANTES_DISTRIBUCION.map((a) => {
      const us = UNIDADES_DISTRIBUCION.filter((u) => u.ayudanteDefault === a.id);
      const rs = activas.filter((r) => r.ayudanteId === a.id);
      return <article key={a.id} className={a.activo ? "" : "de-nodisp"}>
        <div className="de-fleeticon"><Users size={20} /></div>
        <div className="de-fleetmain"><span>Ayudante de conductor</span><h3>{a.nombre}</h3>
          <p>{a.cedula} · {us.length ? `unidad habitual ${us.map((u) => u.placa).join(", ")}` : "sin unidad fija"}</p>
          {!a.activo && <div className="de-motivos"><span>{a.motivo || "No disponible"}</span></div>}</div>
        <div className="de-fleetright"><b>{!a.activo ? "No disponible" : rs.length ? "Con AD activa" : "Disponible"}</b><span>{rs.length ? listaAD(rs, true) : "Sin AD activa"}</span></div>
      </article>;
    })}</div>}
  </div>;
}

/* ReplanificarDistribucion se retiro el 01/09/2026.
   Era la misma lista de AD con otras columnas. Reasignar es ahora una accion por fila en
   AD del dia —mientras el AD no ha salido— que abre este modal. */

/**
 * REASIGNAR UN AD PLANIFICADO · vehículo, conductor, ruta y fecha de la jornada.
 * Sólo mientras está planificada o reprogramada: después de la salida ya hay precio fijado
 * y gente recogida. El ayudante es el de la unidad, y cada cambio queda en la bitácora del AD.
 */
export function Reasignar({ r, onClose, onSave }) {
  const actual = unidadDistribucion(r.unidad);
  const diaActual = aISO(r.fechaJornada || r.fechaPlan || HOY);
  const [placa, setPlaca] = useState(actual.placa);
  const u = unidadDistribucion(placa);
  const d = disponibilidadUnidad(u, HOY);
  const ops = operadoresParaUnidad(u.id);
  const [op, setOp] = useState(ops.some((x) => x.id === r.operadorId) ? r.operadorId : conductorDe(u));
  const [ruta, setRuta] = useState(r.ruta || "");
  const [dia, setDia] = useState(diaActual);
  // Otra unidad puede exigir otro conductor (fuerza propia o su EPSDC): se propone el suyo.
  const cambiarUnidad = (p) => { setPlaca(p); setOp(conductorDe(unidadDistribucion(p))); };
  const o = operadorDistribucion(op);
  const ay = d.ayudante;
  const conConductor = ops.some((x) => x.id === op);
  const cambios = [
    u.placa !== actual.placa && `vehículo ${actual.placa} → ${u.placa}`,
    op !== r.operadorId && `conductor ${r.conductor || "—"} → ${o.nombre}`,
    ay.id !== r.ayudanteId && `ayudante ${r.ayudante || "—"} → ${ay.nombre}`,
    ruta !== (r.ruta || "") && `ruta ${r.ruta || "—"} → ${ruta || "—"}`,
    dia !== diaActual && `jornada ${fecha(r.fechaJornada || r.fechaPlan)} → ${fecha(deISO(dia))}`,
  ].filter(Boolean);
  const valido = d.disponible && conConductor && cambios.length > 0;

  function guardar() {
    if (!valido) return;
    onSave({
      unidad: u.placa, placa: u.placa, unidadCodigoInterno: u.codigoInterno, transportistaTipo: u.tipo, epsdc: u.epsdc || null,
      operadorId: o.id, conductor: o.nombre, conductorCedula: o.cedula,
      ayudanteId: ay.id, ayudante: ay.nombre, ayudanteCedula: ay.cedula,
      ruta, fechaJornada: deISO(dia),
      // Cambiar el día es reprogramar: el AD lo muestra y el portal avisa la nueva fecha.
      ...(dia !== diaActual ? { estadoRuta: "REPROGRAMADA" } : {}),
      bitacoraCambios: [...(r.bitacoraCambios || []), { fecha: HOY, por: "Gerencia de Distribución", texto: `Reasignada · ${cambios.join(" · ")}` }],
    });
  }

  return <div className="de-modal"><DEStyles /><div>
    <header><div><span>EDITAR PLANIFICACIÓN</span><h2>AD {r.ad}</h2></div><button onClick={onClose}><X size={17} /></button></header>
    <main>
      <label>Vehículo · las que no pueden salir aparecen deshabilitadas<select value={placa} onChange={(e) => cambiarUnidad(e.target.value)}><OpcionesUnidad /></select></label>
      <label>Conductor<select value={op} onChange={(e) => setOp(e.target.value)}>
        {ops.length ? ops.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.cedula}</option>) : <option value="">Sin conductor habilitado</option>}
      </select></label>
      <label>Ayudante de la unidad<input readOnly value={`${ay.nombre} · ${ay.cedula}`} /></label>
      <label>Ruta<input value={ruta} onChange={(e) => setRuta(e.target.value)} /></label>
      <label>Fecha de la jornada<input type="date" value={dia} min={aISO(HOY)} onChange={(e) => setDia(e.target.value)} /></label>
      {!d.disponible
        ? <div className="de-warning bad"><AlertTriangle size={16} /><div><b>{u.placa} no puede salir</b><span>{d.motivos.join(" · ")}</span></div></div>
        : !conConductor
          ? <div className="de-warning bad"><AlertTriangle size={16} /><div><b>Falta el conductor</b><span>Ningún conductor habilitado puede llevar {u.placa}.</span></div></div>
          : <div className="de-warning ok"><CheckCircle2 size={16} /><div><b>{cambios.length ? "Queda en la bitácora del AD" : "Sin cambios"}</b>
              <span>{cambios.length ? cambios.join(" · ") : `${u.placa} · ${o.nombre} · ${ay.nombre}`}{dia !== diaActual ? " · el AD pasa a Reprogramada" : ""}</span></div></div>}
    </main>
    <footer><button onClick={onClose}>Cancelar</button><button className="pri" disabled={!valido} onClick={guardar}>Guardar cambio</button></footer>
  </div></div>;
}

/* IncidenciasDistribucion se retiro el 01/09/2026.
   Mezclaba tres incidencias inventadas en duro con las reales, y su boton «Resolver»
   solo movia un Set en memoria: al recargar volvian a estar abiertas. Registrar y
   resolver incidencias vive ahora en Ejecucion y cierre, donde escribe en la ruta. */

function DEStyles() {
  return <style>{`
.de-page{display:flex;flex-direction:column;gap:14px}
.de-warning{display:flex;gap:8px;background:#fff6e7;border:1px solid #eed8b2;border-radius:9px;padding:9px;margin-top:10px;color:#82561d}
.de-warning.ok{background:#edf7f1;border-color:#d6e8dc;color:#276344}
.de-warning.bad{background:#fbe9e9;border-color:#f0c9c9;color:#8e3434}
.de-warning b,.de-warning span{display:block;font-size:9px}
.de-modal button,.de-tabs button{border:0;border-radius:8px;background:#edf2f4;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}
.de-modal .pri{background:#17623f;color:white}.de-modal .pri:disabled{opacity:.45;cursor:not-allowed}
.de-tabs{display:flex;gap:5px}.de-tabs button{display:flex;gap:5px;align-items:center}.de-tabs button.on{background:#17623f;color:white}
.de-fleet{display:flex;flex-direction:column;gap:8px}
.de-fleet article{background:white;border:1px solid #e2e8eb;border-radius:12px;padding:11px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}
.de-fleeticon{width:36px;height:36px;border-radius:10px;background:#edf5f0;color:#17623f;display:grid;place-items:center}
.de-fleetmain span,.de-fleetmain p,.de-fleetright span{font-size:9px;color:#74818b;margin:0}.de-fleetmain p+p{margin-top:2px}
.de-fleetmain h3{font-size:13px;margin:2px 0}
.de-capmini{max-width:360px}.de-capmini i{display:block;height:5px;background:#e7edef;border-radius:99px;overflow:hidden;margin:6px 0}.de-capmini em{display:block;height:100%;background:#2f9863}
.de-fleetright{text-align:right;max-width:340px}.de-fleetright b{display:block;font-size:10px}
.de-nodisp{background:#FFFAF3!important;border-color:#EED8B2!important}
.de-motivos{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.de-motivos span{font-size:8px;background:#FFF1D7;color:#A16418;border-radius:999px;padding:4px 7px;font-weight:700}
.de-modal{position:fixed;inset:0;background:#0007;z-index:90;display:grid;place-items:center;padding:15px}
.de-modal>div{background:white;width:min(540px,96vw);border-radius:14px;overflow:hidden}
.de-modal header,.de-modal footer{padding:12px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e6eaed}
.de-modal footer{border-top:1px solid #e6eaed;border-bottom:0;justify-content:flex-end;gap:6px}
.de-modal header span{font-size:8px;color:#2a704d}.de-modal header h2{margin:3px 0 0;font-size:16px}
.de-modal main{padding:14px;display:grid;gap:9px}.de-modal label{font-size:9px;color:#6b7882}
.de-modal select,.de-modal input{display:block;width:100%;box-sizing:border-box;border:1px solid #d9e1e6;border-radius:8px;padding:8px;margin-top:4px}
.de-modal input[readonly]{background:#f5f7f8;color:#4d5b66}
`}</style>;
}
