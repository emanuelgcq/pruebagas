import React, { useState } from "react";
import {
  Search, X, AlertTriangle, Users, Truck, MapPin, ShieldCheck, ClipboardCheck,
} from "lucide-react";
import { HOY, cpt, bs, num } from "./datos.jsx";
import { cilindrosFila, kgFila, unidadDistribucion } from "./distribucionSeed.js";
import { KgL, UnidadesStyles } from "./Unidades.jsx";
import CierreAD from "./DistribucionCierreAD.jsx";
import { ListaPersonasAD, CuadreChips, cuadreAD, PersonasStyles } from "./DistribucionPersonas.jsx";

/* ════════════════════════════════════════════════════════════════
   EJECUCIÓN Y CIERRE DE AD · panel del gerente de Distribución

   Sustituye a la app móvil del repartidor, retirada el 01/09/2026. El conductor ya no
   cierra nada: ejecuta la ruta que Distribución le planificó y reporta lo que ocurrió.
   Quien confirma las incidencias y firma el cierre —con su facturación, su salida de
   inventario y sus abonos— es el gerente que respondió por esa AD.

   Aquí vive la misma información que mostraba la app: qué lleva cada unidad, quién
   conduce, con qué ayudante, cuántas personas, qué paradas definió la planificación y
   en qué estado va la ruta. Lo que cambia es quién decide, y desde dónde.
   ════════════════════════════════════════════════════════════════ */

const ESTADO_RUTA = {
  ASIGNADA: "Asignada", PREPARANDO: "Preparando carga", LISTA_SALIDA: "Lista para salida",
  EN_RUTA: "En ruta", PARCIAL: "Entrega parcial", ENTREGADA: "Entregada",
  CERRADA: "Cerrada", INCIDENCIA: "Incidencia", REPROGRAMADA: "Reprogramada",
};
const CERRADAS = ["ENTREGADA", "CERRADA", "PARCIAL"];

export default function EjecucionAD({
  rutas = [], solicitudes = [], parqueEnvases = [], actualizar = () => {},
  cerrarAD = () => ({ ok: false }), aviso,
}) {
  const [detalle, setDetalle] = useState(null);
  const [cerrando, setCerrando] = useState(null);
  const [incidencia, setIncidencia] = useState(null);
  const [resolviendo, setResolviendo] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("ACTIVAS");

  const conAD = rutas.filter((r) => r.ad && String(r.ad) !== "0" && r.estadoRuta !== "SIN_PLANIFICAR");
  const pedidosDe = (r) => solicitudes.filter((s) => s.rutaId === r.id && ["EN_AD", "PAGADA"].includes(s.estado));

  const activas = conAD.filter((r) => !CERRADAS.includes(r.estadoRuta));
  const enRuta = conAD.filter((r) => r.estadoRuta === "EN_RUTA");
  const conIncidencia = conAD.filter((r) => r.estadoRuta === "INCIDENCIA");
  const cerradas = conAD.filter((r) => CERRADAS.includes(r.estadoRuta));

  const grupos = { ACTIVAS: activas, EN_RUTA: enRuta, INCIDENCIA: conIncidencia, CERRADAS: cerradas, TODAS: conAD };
  const lista = (grupos[filtro] || conAD).filter((r) => !q
    || [r.ad, r.comuna, r.comunidad, r.conductor, r.unidad].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));

  const cilindrosActivos = activas.reduce((a, r) => a + cilindrosFila(r), 0);
  const kgActivos = activas.reduce((a, r) => a + kgFila(r), 0);
  const personasActivas = activas.reduce((a, r) => a + pedidosDe(r).length, 0);

  function iniciar(r) {
    actualizar(r.id, { estadoRuta: "EN_RUTA", horaSalida: "08:15" });
    aviso?.(`AD ${r.ad} en ruta · el conductor salió del CDT`);
  }

  /* Resolver la incidencia devuelve la AD al flujo: o vuelve a ruta para seguir la
     jornada, o se reprograma para otro día. Lo que no puede es quedarse marcada para
     siempre. El tablero anterior daba por resuelto sin escribir nada, así que al
     recargar la incidencia volvía a estar abierta. */
  function resolverIncidencia(r, d) {
    actualizar(r.id, {
      estadoRuta: d.destino, incidenciaResuelta: true,
      incidenciaResueltaPor: d.por, incidenciaResueltaEn: HOY,
      notaResolucion: d.nota,
    });
    setResolviendo(null);
    aviso?.(d.destino === "EN_RUTA"
      ? "AD " + r.ad + " vuelve a ruta · incidencia resuelta"
      : "AD " + r.ad + " reprogramada · incidencia resuelta");
  }

  function guardarIncidencia(r, d) {
    actualizar(r.id, {
      estadoRuta: "INCIDENCIA", horaIncidencia: d.hora || "11:24",
      obsIncidencia: d.detalle, tipoIncidencia: d.tipo,
      incidenciaConfirmadaPor: d.confirmadaPor, incidenciaConfirmadaEn: HOY,
    });
    setIncidencia(null); setDetalle(null);
    aviso?.(`Incidencia confirmada en AD ${r.ad}`);
  }

  function cerrar(resultados, recepcion) {
    const r = cerrarAD(cerrando, resultados, recepcion);
    setCerrando(null);
    aviso?.(r.ok
      ? `AD cerrada · ${r.entregadas} entregadas, ${r.noEntregadas} no entregadas, Bs ${bs(r.facturado || 0)} facturados`
      : (r.error || "No se pudo cerrar la AD"));
  }

  return (
    <div className="dx-content">
      <UnidadesStyles />
      <EjecucionStyles />
      <PersonasStyles />

      <section className="dx-card">
        <div className="dx-card-head">
          <div>
            <h2>Ejecución y cierre de AD</h2>
            <p>El conductor ejecuta la ruta y reporta lo que ocurrió. Distribución confirma las
              incidencias y firma el cierre: es el acto que emite las facturas, descuenta el
              inventario y abona a quien no recibió.</p>
          </div>
        </div>
        <div className="ea-kpis">
          <div><span>AD activas</span><b>{num(activas.length)}</b><small>de {num(conAD.length)} planificadas</small></div>
          <div><span>En ruta ahora</span><b>{num(enRuta.length)}</b><small>salieron del CDT</small></div>
          <div className={conIncidencia.length ? "wr" : ""}><span>Con incidencia</span><b>{num(conIncidencia.length)}</b>
            <small>{conIncidencia.length ? "esperan confirmación" : "ninguna reportada"}</small></div>
          <div><span>Personas por atender</span><b>{num(personasActivas)}</b><small>en las AD activas</small></div>
          <div><span>Carga en calle</span><b>{num(cilindrosActivos)}</b><small><KgL kg={kgActivos} /></small></div>
          <div className="ok"><span>AD cerradas</span><b>{num(cerradas.length)}</b><small>ya facturadas</small></div>
        </div>
      </section>

      <div className="ea-tools">
        <div className="dx-search"><Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar AD, comuna, comunidad, conductor o placa" /></div>
        <div className="ea-tabs">
          {[["ACTIVAS", "Activas", activas.length], ["EN_RUTA", "En ruta", enRuta.length],
            ["INCIDENCIA", "Con incidencia", conIncidencia.length], ["CERRADAS", "Cerradas", cerradas.length],
            ["TODAS", "Todas", conAD.length]].map(([k, l, n]) => (
              <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l} <em>{n}</em></button>
            ))}
        </div>
      </div>

      <div className="ea-lista">
        {lista.map((r) => {
          const ps = pedidosDe(r);
          const cerrada = CERRADAS.includes(r.estadoRuta);
          const u = unidadDistribucion(r.unidad) || {};
          return (
            <article className={`ea-ad ${r.estadoRuta === "INCIDENCIA" ? "inc" : cerrada ? "ok" : ""}`} key={r.id}>
              <div className="ea-ad-h">
                <div>
                  <span className="ea-ad-n">AD {r.ad}</span>
                  <b>{r.comunidad}</b>
                  <small>{r.comuna}{r.parroquia ? ` · ${r.parroquia}` : ""}</small>
                </div>
                <span className={`ea-estado ${String(r.estadoRuta).toLowerCase()}`}>
                  {ESTADO_RUTA[r.estadoRuta] || r.estadoRuta}</span>
              </div>

              {/* La misma ficha que el conductor veía en el teléfono */}
              <div className="ea-ficha">
                <div><span>Conduce</span><b>{r.conductor || "Sin asignar"}</b><small>{r.conductorCedula || ""}</small></div>
                <div><span>Unidad</span><b>{u.placa || r.unidad || "—"}</b><small>{u.etiqueta || ""}</small></div>
                <div><span>Ayudante</span><b>{r.ayudante || "Sin ayudante"}</b></div>
                <div><span>Personas</span><b>{num(ps.length)}</b>
                  <small>{num(ps.filter((s) => s.estado === "EN_AD").length)} convocadas a la jornada</small></div>
                <div><span>Carga</span><b>{cilindrosFila(r)} cil.</b><small><KgL kg={kgFila(r)} /></small></div>
                <div><span>Transportista</span><b>{r.transportistaTipo === "EPSDC" ? "EPSDC" : "GasLara"}</b>
                  <small>{r.epsdc || ""}</small></div>
              </div>

              <div className="ea-load">
                {[10, 18, 27, 43].filter((k) => r.cilindros?.[k]).map((k) => (
                  <span key={k}>{k} kg <b>{r.cilindros[k]}</b></span>
                ))}
              </div>

              {r.estadoRuta === "INCIDENCIA" && r.obsIncidencia && (
                <div className="ea-inc-nota"><AlertTriangle size={14} />
                  <div>
                    <b>{r.tipoIncidencia || "Incidencia reportada"}{r.horaIncidencia ? ` · ${r.horaIncidencia}` : ""}</b>
                    <span>{r.obsIncidencia}
                      {r.incidenciaConfirmadaPor ? ` — confirmada por ${r.incidenciaConfirmadaPor}` : ""}</span>
                  </div></div>
              )}

              {cerrada && r.cierreDetalle && (
                <div className="ea-cierre">
                  <div><span>Entregadas</span><b>{r.cierreDetalle.entregadas}</b></div>
                  <div><span>No entregadas</span><b>{r.cierreDetalle.noEntregadas}</b></div>
                  <div><span>Bombonas malas</span><b>{r.cierreDetalle.reposiciones}</b></div>
                  <div><span>Salida de GLP</span><b><KgL kg={r.cierreDetalle.kgSalida} /></b></div>
                  <div><span>Facturado</span><b>Bs {bs(r.cierreDetalle.facturado)}</b></div>
                  <div><span>Recibió</span><b>{r.recepcion?.receptor || "—"}</b></div>
                </div>
              )}

              <div className="ea-acciones">
                <button className="dx-secondary" onClick={() => setDetalle(r)}>
                  <MapPin size={13} /> Ver paradas y personas</button>
                {!cerrada && ["ASIGNADA", "LISTA_SALIDA", "PREPARANDO", "REPROGRAMADA"].includes(r.estadoRuta) && (
                  <button className="dx-secondary" onClick={() => iniciar(r)}><Truck size={13} /> Marcar salida</button>
                )}
                {!cerrada && r.estadoRuta !== "INCIDENCIA" && (
                  <button className="dx-secondary" onClick={() => setIncidencia(r)}>
                    <AlertTriangle size={13} /> Registrar incidencia</button>
                )}
                {!cerrada && r.estadoRuta === "INCIDENCIA" && (
                  <>
                    <button className="dx-secondary" onClick={() => setIncidencia(r)}>Actualizar</button>
                    <button className="dx-secondary" onClick={() => setResolviendo(r)}>
                      <ShieldCheck size={13} /> Resolver incidencia</button>
                  </>
                )}
                {!cerrada && ps.length > 0 && (
                  <button className="dx-primary" onClick={() => setCerrando(r)}>
                    <ClipboardCheck size={13} /> Cerrar AD</button>
                )}
                {!cerrada && !ps.length && <span className="ea-sin">Sin pedidos asociados: no hay nada que cerrar</span>}
              </div>
            </article>
          );
        })}
        {!lista.length && <div className="ea-vacio">Ninguna AD coincide con el filtro.</div>}
      </div>

      {detalle && <DetalleAD ruta={detalle} pedidos={pedidosDe(detalle)} solicitudes={solicitudes}
        parqueEnvases={parqueEnvases} onClose={() => setDetalle(null)} />}
      {incidencia && <ModalIncidenciaAD r={incidencia} onClose={() => setIncidencia(null)}
        onSave={(d) => guardarIncidencia(incidencia, d)} />}
      {resolviendo && <ModalResolverIncidencia r={resolviendo} onClose={() => setResolviendo(null)}
        onSave={(d) => resolverIncidencia(resolviendo, d)} />}
      {cerrando && (
        <div className="ea-overlay">
          <div className="ea-cierre-wrap">
            <CierreAD ruta={cerrando} pedidos={pedidosDe(cerrando)} parqueEnvases={parqueEnvases}
              onCerrar={cerrar} onCancelar={() => setCerrando(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Las paradas que definió la planificación y la gente de cada una. */
function DetalleAD({ ruta, pedidos, solicitudes = [], parqueEnvases = [], onClose }) {
  const stops = ruta.paradas?.length ? ruta.paradas
    : [{ comuna: ruta.comuna, comunidad: ruta.comunidad, pedidos: pedidos.length, kg: kgFila(ruta) }];
  const porTamano = [10, 18, 27, 43].map((k) => ({
    k, plan: ruta.cilindros?.[k] || 0, personas: pedidos.filter((p) => cpt(p.concepto).kg === k).length,
  })).filter((x) => x.plan || x.personas);

  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {ruta.ad} · RUTA PLANIFICADA</span><h3>{ruta.comunidad}</h3></div>
          <button onClick={onClose}><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <div className="ea-gente"><Users size={20} />
            <div><b>{num(pedidos.length)} personas en esta AD</b>
              <span>cada una con su pedido, su pago y su envase</span></div></div>

          <div className="ea-load">
            {porTamano.map((x) => <span key={x.k}>{x.k} kg <b>{x.personas || x.plan}</b></span>)}
          </div>

          <h4>Las personas de esta AD</h4>
          <ListaPersonasAD ruta={ruta} solicitudes={solicitudes} parqueEnvases={parqueEnvases} compacta />

          <h4>Paradas definidas por la planificación</h4>
          {stops.map((p, i) => (
            <div className="ea-stop" key={i}><i>{i + 1}</i>
              <div><b>{p.comunidad}</b>
                <span>{p.comuna} · {p.pedidos || "—"} pedidos · <KgL kg={p.kg || 0} /></span></div></div>
          ))}

          <div className="ea-regla"><ShieldCheck size={16} />
            <span>La venta se registra al despachar a este punto. La comuna recibe en custodia y
              responde ante la empresa por lo que no entregue.</span></div>
        </div>
      </div>
    </div>
  );
}

/* La incidencia la reporta el conductor por radio o teléfono; aquí Distribución la
   tipifica y la firma. Sin tipo y sin quién la confirma no queda constancia útil. */
const TIPOS_INCIDENCIA = [
  "Avería de la unidad",
  "No se pudo acceder al punto",
  "Punto comunal cerrado",
  "Nadie autorizado para recibir",
  "Situación de seguridad en la zona",
  "Condiciones climáticas",
  "La carga no corresponde a lo planificado",
  "Otro motivo",
];

function ModalIncidenciaAD({ r, onClose, onSave }) {
  const [d, setD] = useState({
    tipo: r.tipoIncidencia || TIPOS_INCIDENCIA[0],
    detalle: r.obsIncidencia || "",
    hora: r.horaIncidencia || "11:24",
    confirmadaPor: r.incidenciaConfirmadaPor || "",
  });
  const ok = d.detalle.trim().length > 5 && d.confirmadaPor.trim().length > 2;
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal chico" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>Confirmar incidencia</h3></div>
          <button onClick={onClose}><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <p className="ea-p">El conductor reporta lo que le ocurrió en la calle. Distribución lo
            tipifica y lo firma: así la incidencia queda con responsable, no como un texto suelto.</p>
          <label className="ea-campo"><span>Qué ocurrió</span>
            <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              {TIPOS_INCIDENCIA.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="ea-campo"><span>Detalle de lo reportado</span>
            <textarea rows={3} value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })}
              placeholder="Qué informó el conductor y qué se decidió" /></label>
          <div className="ea-dos">
            <label className="ea-campo"><span>Hora del reporte</span>
              <input value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></label>
            <label className="ea-campo"><span>Quién confirma</span>
              <input value={d.confirmadaPor} onChange={(e) => setD({ ...d, confirmadaPor: e.target.value })}
                placeholder="Gerente de Distribución" /></label>
          </div>
          <div className="ea-regla"><AlertTriangle size={16} />
            <span>La AD queda marcada con incidencia y sigue abierta. El cierre —y con él la
              facturación— solo ocurre cuando se resuelva y se confirme persona por persona.</span></div>
        </div>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={() => onSave(d)}>
            <ShieldCheck size={14} /> Confirmar incidencia</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Cerrar una incidencia y devolver la AD al flujo.
 *
 * El tablero de incidencias anterior tenía un botón «Resolver» que solo movía un Set en
 * memoria: al recargar la incidencia volvía a estar abierta. Resolver aquí escribe, y
 * obliga a decir en qué queda la AD — porque una incidencia resuelta no es un estado,
 * es una decisión sobre si el camión sigue hoy o vuelve otro día.
 */
function ModalResolverIncidencia({ r, onClose, onSave }) {
  const [d, setD] = useState({ destino: "EN_RUTA", nota: "", por: "" });
  const ok = d.nota.trim().length > 5 && d.por.trim().length > 2;
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal chico" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>Resolver la incidencia</h3></div>
          <button onClick={onClose}><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <div className="ea-inc-nota"><AlertTriangle size={14} /><div>
            <b>{r.tipoIncidencia || "Incidencia"}{r.horaIncidencia ? ` · ${r.horaIncidencia}` : ""}</b>
            <span>{r.obsIncidencia}
              {r.incidenciaConfirmadaPor ? ` — confirmada por ${r.incidenciaConfirmadaPor}` : ""}</span>
          </div></div>

          <p className="ea-p">Una incidencia resuelta no es un estado: es una decisión sobre si
            la jornada sigue hoy o se retoma otro día. Hay que decir en cuál de las dos queda.</p>

          <label className="ea-campo"><span>En qué queda la AD</span>
            <select value={d.destino} onChange={(e) => setD({ ...d, destino: e.target.value })}>
              <option value="EN_RUTA">Vuelve a ruta · la jornada continúa hoy</option>
              <option value="REPROGRAMADA">Se reprograma · la gente se convoca otro día</option>
            </select></label>
          <label className="ea-campo"><span>Cómo se resolvió</span>
            <textarea rows={3} value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })}
              placeholder="Qué se hizo para levantarla" /></label>
          <label className="ea-campo"><span>Quién la resuelve</span>
            <input value={d.por} onChange={(e) => setD({ ...d, por: e.target.value })}
              placeholder="Gerente de Distribución" /></label>

          <div className="ea-regla"><ShieldCheck size={16} />
            <span>{d.destino === "EN_RUTA"
              ? "La AD vuelve a estado En ruta y puede cerrarse normalmente cuando el camión regrese con las bombonas llenas."
              : "La AD queda reprogramada. Las personas siguen convocadas con su pago vigente: nadie pierde su turno ni su dinero."}</span></div>
        </div>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={() => onSave(d)}>
            <ShieldCheck size={14} /> Resolver y devolver al flujo</button>
        </footer>
      </div>
    </div>
  );
}

function EjecucionStyles() {
  return <style>{`
.ea-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:14px}
.ea-kpis>div{background:#F7F9FA;border:1px solid #E4EAED;border-radius:11px;padding:12px 13px}
.ea-kpis span{display:block;font-size:11px;color:#71808A;font-weight:600}
.ea-kpis b{display:block;font-size:23px;font-weight:660;margin:3px 0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ea-kpis small{display:block;font-size:11px;color:#84919B;line-height:1.4}
.ea-kpis>div.wr{background:#FDF6EA;border-color:#EFDDBC}
.ea-kpis>div.wr b{color:#8A5A16}
.ea-kpis>div.ok{background:#F1F8F4;border-color:#D5E7DC}
.ea-kpis>div.ok b{color:#1C7A50}
.ea-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0 12px}
.ea-tabs{display:flex;gap:5px;flex-wrap:wrap}
.ea-tabs button{border:0;background:#EDF1F3;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;color:#516069;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.ea-tabs button.on{background:#17623F;color:#fff}
.ea-tabs em{font-style:normal;font-size:11px;font-weight:700;opacity:.7}
.ea-lista{display:flex;flex-direction:column;gap:12px}
.ea-ad{background:#fff;border:1px solid #E3E9ED;border-radius:14px;padding:16px;border-left:3px solid #C3CED5}
.ea-ad.inc{border-left-color:#A83E3E}
.ea-ad.ok{border-left-color:#1C7A50}
.ea-ad-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ea-ad-n{font-size:11px;font-weight:700;color:#26704C;letter-spacing:.04em}
.ea-ad-h b{display:block;font-size:16px;font-weight:650;margin:3px 0}
.ea-ad-h small{display:block;font-size:12px;color:#74818B}
.ea-estado{font-size:11px;font-weight:650;padding:5px 10px;border-radius:99px;background:#EEF2F4;color:#516069;white-space:nowrap}
.ea-estado.en_ruta{background:#EAF1FA;color:#2A5FA6}
.ea-estado.incidencia{background:#FBECEC;color:#A83E3E}
.ea-estado.entregada,.ea-estado.cerrada,.ea-estado.parcial{background:#EDF6F0;color:#1C7A50}
.ea-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0;padding:12px;background:#F7F9FA;border-radius:10px}
.ea-ficha span{display:block;font-size:10.5px;color:#77848D;font-weight:600}
.ea-ficha b{display:block;font-size:13px;font-weight:600;margin-top:2px;line-height:1.35}
.ea-ficha small{display:block;font-size:11px;color:#8A959D;margin-top:2px;line-height:1.35}
.ea-load{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.ea-load span{background:#EEF3F5;border-radius:8px;padding:7px 11px;font-size:11.5px;color:#516069}
.ea-load b{font-weight:700;color:#252F36;margin-left:4px}
.ea-inc-nota{display:flex;gap:9px;background:#FBECEC;border:1px solid #F2D4D4;border-radius:10px;padding:11px;margin-bottom:12px}
.ea-inc-nota svg{color:#A83E3E;flex:none;margin-top:1px}
.ea-inc-nota b{display:block;font-size:12.5px;color:#A83E3E}
.ea-inc-nota span{display:block;font-size:12px;color:#5B4444;line-height:1.5;margin-top:3px}
.ea-cierre{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;background:#F1F8F4;border-radius:10px;padding:12px;margin-bottom:12px}
.ea-cierre span{display:block;font-size:10.5px;color:#5C7A6B}
.ea-cierre b{display:block;font-size:14px;font-weight:640;margin-top:2px;color:#17623F}
.ea-acciones{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.ea-sin{font-size:11.5px;color:#8A959D}
.ea-vacio{text-align:center;padding:50px;color:#78868F;font-size:13px}
.ea-overlay{position:fixed;inset:0;background:rgba(11,18,22,.55);backdrop-filter:blur(5px);z-index:70;display:grid;place-items:center;padding:20px;overflow:auto}
.ea-cierre-wrap{width:min(1180px,97vw);max-height:94vh;overflow:auto;border-radius:16px;box-shadow:0 24px 70px rgba(11,18,22,.35)}
.ea-modal{background:#fff;border-radius:16px;width:min(720px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(11,18,22,.3)}
.ea-modal.chico{width:min(560px,96vw)}
.ea-modal>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid #E7ECEF}
.ea-modal>header span{font-size:10.5px;font-weight:700;color:#26704C;letter-spacing:.05em}
.ea-modal>header h3{font-size:18px;margin:4px 0 0;font-weight:650}
.ea-modal>header button{border:0;background:none;color:#6B7B85;cursor:pointer}
.ea-modal-b{padding:18px 20px;overflow:auto}
.ea-modal-b h4{font-size:12.5px;margin:16px 0 8px;font-weight:650}
.ea-modal>footer{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid #E7ECEF}
.ea-gente{display:flex;gap:11px;align-items:center;background:#EDF5F0;border:1px solid #D6E7DD;border-radius:10px;padding:13px;margin-bottom:12px}
.ea-gente svg{color:#17623F;flex:none}
.ea-gente b{display:block;font-size:14px}
.ea-gente span{display:block;font-size:12px;color:#5C7A6B;margin-top:2px}
.ea-stop{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;border-top:1px solid #EDF0F2;padding:10px 2px}
.ea-stop i{width:24px;height:24px;border-radius:7px;background:#EDF5F0;color:#17623F;display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:700}
.ea-stop b{display:block;font-size:12.5px}
.ea-stop span{display:block;font-size:11.5px;color:#74818B;margin-top:2px}
.ea-regla{display:flex;gap:9px;background:#F1F6F3;border:1px solid #D3E3D9;border-radius:10px;padding:12px;margin-top:14px}
.ea-regla svg{color:#1F7A4C;flex:none;margin-top:1px}
.ea-regla span{font-size:12px;color:#3A464E;line-height:1.55}
.ea-p{font-size:12.5px;color:#6B7B85;line-height:1.6;margin:0 0 14px}
.ea-campo{display:block;margin-bottom:12px}
.ea-campo span{display:block;font-size:11px;font-weight:650;color:#516069;margin-bottom:5px}
.ea-campo input,.ea-campo select,.ea-campo textarea{width:100%;box-sizing:border-box;border:1px solid #D9E1E5;border-radius:9px;padding:10px;font-size:13px;font-family:inherit;background:#fff}
.ea-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media(max-width:900px){.ea-dos{grid-template-columns:1fr}}
`}</style>;
}
