import React, { useMemo, useState } from "react";
import {
  Search, X, AlertTriangle, Users, Truck, ShieldCheck, ClipboardCheck, Check, Factory, Container,
} from "lucide-react";
// Sin `bs`: Distribución no muestra bolívares.
import { HOY, num, fecha, cpt, usr, kgDeSolicitud, motivoNoEntrega, motivosDelMomento, estadoSolicitud } from "./datos.jsx";
import { unidadDistribucion, disponibilidadUnidad } from "./distribucionSeed.js";
import {
  ESTADOS_AD, estadoAD, adPlanificada, adCerrada, siguienteAccionAD, tipoAD, tipoADInfo,
  personasDeAD, convocadasDeAD, marcaDe, cuadreJornada, cerrarADPuro, corregirJornadaAD,
} from "./flujo.js";
import { KgL, UnidadesStyles } from "./Unidades.jsx";
import JornadaPersonas, { horaActual, consecuenciaDe } from "./DistribucionCierreAD.jsx";

/** «1 persona», «2 personas»: el número con su palabra en singular o plural. */
const cant = (n, uno, varios) => `${num(n)} ${Number(n) === 1 ? uno : varios}`;

/* ════════════════════════════════════════════════════════════════
   EJECUCIÓN Y CIERRE DE AD · la jornada por momentos

   El camión sale VACÍO a recoger: la gente lleva su bombona al punto, la unidad las
   recoge, se llenan en planta y vuelven al mismo punto. Cada AD pasa por esos momentos
   —planificada → en recolección → en planta → devuelta al punto → cerrada— y en cada uno
   hay una sola cosa que hacer, la que dice `siguienteAccionAD`. Así nadie cierra un AD
   que no salió ni factura bombonas que todavía están en la planta.

   El cierre lo firma Distribución: factura lo devuelto lleno al precio del día de salida,
   emite la BOP y descuenta el inventario. Lo que no se pudo atender pasa a la bandeja de
   replanificación; sólo quien desistió pasa a saldo a favor.
   ════════════════════════════════════════════════════════════════ */

// Primero lo que espera una decisión; lo cerrado, al final.
const ORDEN = { INCIDENCIA: 0, EN_PUNTO: 1, EN_PLANTA: 2, EN_RUTA: 3, REPROGRAMADA: 4, ASIGNADA: 5, CERRADA: 6 };
const ICONO_ACCION = { SALIDA: Truck, RECOLECCION: Container, LLENADO: Factory, CIERRE: ClipboardCheck, RESOLVER: ShieldCheck };
const PASOS = ["ASIGNADA", "EN_RUTA", "EN_PLANTA", "EN_PUNTO", "CERRADA"].map(estadoAD);
const RESULTADO = { ENTREGADA: "Devuelta llena", NO_RECOGIDA: "No se recogió", NO_LLENADA: "Volvió vacía", SALIO_POR_TARIFA: "Salió por la tarifa nueva" };
const fechaNum = (d) => (d ? new Date(d).getTime() || 0 : 0);

/* El momento en que estaba el AD cuando se reportó la incidencia. Las incidencias nuevas lo
   guardan en `estadoPrevio`; una vieja que no lo trae se deduce de lo que ya se registró. */
const momentoPrevio = (r) => {
  if (r.estadoPrevio && !["INCIDENCIA", "SIN_PLANIFICAR"].includes(estadoAD(r.estadoPrevio).id)) return estadoAD(r.estadoPrevio).id;
  if (r.jornada?.devolucion) return "EN_PUNTO";
  if (r.jornada?.recoleccion) return "EN_PLANTA";
  if (r.fechaSalida) return "EN_RUTA";
  return "ASIGNADA";
};

export default function EjecucionAD({
  rutasDistribucion = [], solicitudes = [], parqueEnvases = [], abonos = [], cifras, periodoCerrado = false,
  salidaAD, registrarRecoleccion, registrarLlenado, cerrarAD, actualizarRutaDistribucion, aviso,
}) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("ACTIVAS");
  // Se guarda el id y no la ruta: así cada modal lee siempre la versión viva del AD.
  const [detalle, setDetalle] = useState(null);
  const [salida, setSalida] = useState(null);
  const [jornada, setJornada] = useState(null);
  const [cierre, setCierre] = useState(null);
  const [incidencia, setIncidencia] = useState(null);
  const [resolviendo, setResolviendo] = useState(null);

  const rutaDe = (id) => (id ? rutasDistribucion.find((r) => r.id === id) || null : null);
  const est = (r) => estadoAD(r.estadoRuta).id;
  const planificadas = useMemo(() => rutasDistribucion.filter(adPlanificada), [rutasDistribucion]);
  const cuadres = useMemo(() => new Map(planificadas.map((r) => [r.id, cuadreJornada(r, solicitudes)])), [planificadas, solicitudes]);

  // Las cifras que también muestran otras pantallas salen de `cifras`; lo local es respaldo.
  const ad = cifras?.ad || {};
  const porEstado = ad.porEstado || planificadas.reduce((acc, r) => { acc[est(r)] = (acc[est(r)] || 0) + 1; return acc; }, {});
  const activas = ad.activas ?? planificadas.filter((r) => !adCerrada(r)).length;
  // Recogidas y todavía no devueltas al punto: están en poder de la empresa.
  const enPoder = planificadas.map((r) => cuadres.get(r.id)).filter((c) => c && !c.cerrada && c.hayRecoleccion && !c.hayLlenado && c.recogidas);
  const bombonasEnPoder = enPoder.reduce((a, c) => a + c.recogidas, 0);

  const tabs = [
    ["ACTIVAS", "Activas", activas],
    ...ESTADOS_AD.filter((e) => e.id !== "SIN_PLANIFICAR" && (e.id !== "REPROGRAMADA" || porEstado.REPROGRAMADA))
      .map((e) => [e.id, e.nombre, porEstado[e.id] || 0]),
    ["TODAS", "Todas", ad.planificadas ?? planificadas.length],
  ];
  const lista = planificadas
    .filter((r) => filtro === "TODAS" || (filtro === "ACTIVAS" ? !adCerrada(r) : est(r) === filtro))
    .filter((r) => !q || [r.ad, r.comuna, r.comunidad, r.conductor, r.unidad, tipoADInfo(r).nombre]
      .filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (ORDEN[est(a)] ?? 9) - (ORDEN[est(b)] ?? 9)
      || fechaNum(a.fechaJornada) - fechaNum(b.fechaJornada) || String(a.ad).localeCompare(String(b.ad)));

  /* ── Los momentos de la jornada: cada uno por su manejador, que valida y responde ── */

  function marcarSalida(r, meta) {
    const res = salidaAD ? salidaAD(r.id, meta) : { ok: false, error: "La salida no está disponible en esta vista." };
    if (!res?.ok) return res;
    const n = res.salieronPorTarifa || 0;
    aviso?.(`AD ${r.ad} salió a recolección a las ${meta.hora}${n ? ` · ${n} salieron por la tarifa nueva` : ""}`);
    // Si alguien salió por tarifa el modal queda abierto: es un dato que hay que leer.
    if (!n) setSalida(null);
    return res;
  }

  function registrarMomento(r, modo, marcas, meta) {
    const fn = modo === "llenado" ? registrarLlenado : registrarRecoleccion;
    const res = fn ? fn(r.id, marcas, meta) : { ok: false, error: "El registro no está disponible en esta vista." };
    if (!res?.ok) return res;
    setJornada(null);
    const vacias = Object.values(marcas).filter((m) => m.llenada === false).length;
    aviso?.(modo === "llenado"
      ? `AD ${r.ad} devuelta al punto · ${res.llenadas} llenas y ${vacias} vacías`
      : `AD ${r.ad} en planta · ${res.recogidas} bombonas recogidas`);
    return res;
  }

  function cerrar(r, meta) {
    const res = cerrarAD ? cerrarAD(r.id, meta) : { ok: false, error: "El cierre no está disponible en esta vista." };
    if (!res?.ok) return res;
    const x = res.resumen || {};
    aviso?.(`AD ${r.ad} cerrada · ${x.entregadas} entregadas, ${x.replanificadas} a replanificación, ${cant(x.facturas ?? x.entregadas, "factura emitida", "facturas emitidas")}`);
    return res;
  }

  const bloqueoPeriodo = periodoCerrado
    ? { ok: false, error: "El período está cerrado: no se registran incidencias con fecha de este período." } : null;

  function guardarIncidencia(r, d) {
    if (bloqueoPeriodo) return bloqueoPeriodo;
    const abierta = est(r) === "INCIDENCIA";
    actualizarRutaDistribucion?.(r.id, {
      estadoRuta: "INCIDENCIA",
      // Corregir el reporte de una incidencia abierta no cambia el momento en que estaba.
      estadoPrevio: abierta ? momentoPrevio(r) : est(r),
      incidenciaTipo: d.tipo, obsIncidencia: d.detalle.trim(), horaIncidencia: d.hora,
      incidenciaEn: abierta ? (r.incidenciaEn || HOY) : HOY,
      incidenciaConfirmadaPor: d.confirmadaPor.trim(), incidenciaConfirmadaEn: HOY,
      // Una incidencia nueva no hereda la resolución de la anterior.
      incidenciaResuelta: false, incidenciaResueltaPor: null, incidenciaResueltaEn: null,
      horaResolucion: null, notaResolucion: null, destinoResolucion: null,
    });
    setIncidencia(null);
    aviso?.(abierta ? `Reporte de incidencia corregido · AD ${r.ad}` : `Incidencia registrada en AD ${r.ad}`);
    return { ok: true };
  }

  function resolverIncidencia(r, d) {
    if (bloqueoPeriodo) return bloqueoPeriodo;
    actualizarRutaDistribucion?.(r.id, {
      estadoRuta: d.destino, estadoPrevio: null,
      incidenciaResuelta: true, incidenciaResueltaPor: d.por.trim(), incidenciaResueltaEn: HOY,
      horaResolucion: d.hora, notaResolucion: d.nota.trim(), destinoResolucion: d.destino,
    });
    setResolviendo(null);
    aviso?.(`AD ${r.ad} · incidencia resuelta: ${d.destino === "REPROGRAMADA" ? "queda reprogramada" : `vuelve a «${estadoAD(d.destino).nombre}»`}`);
    return { ok: true };
  }

  function accion(r, id) {
    if (id === "SALIDA") setSalida(r.id);
    else if (id === "RECOLECCION") setJornada({ id: r.id, modo: "recoleccion" });
    else if (id === "LLENADO") setJornada({ id: r.id, modo: "llenado" });
    else if (id === "CIERRE") setCierre(r.id);
    else if (id === "RESOLVER") setResolviendo(r.id);
  }

  const rDetalle = rutaDe(detalle);
  const rSalida = rutaDe(salida);
  const rJornada = rutaDe(jornada?.id);
  const rCierre = rutaDe(cierre);
  const rIncidencia = rutaDe(incidencia);
  const rResolver = rutaDe(resolviendo);

  /* Vista previa del cierre con las MISMAS funciones que cierran (sobre una secuencia de
     descarte): lo que se promete en la confirmación es exactamente lo que va a pasar, también
     con las incidencias por cliente que se anoten o corrijan al cerrar. */
  const previsualizar = useMemo(() => (cambios = {}) => {
    if (!rCierre || est(rCierre) !== "EN_PUNTO") return null;
    let st = { solicitudes, abonos, parque: parqueEnvases, rutas: rutasDistribucion };
    if (Object.keys(cambios).length) {
      const c = corregirJornadaAD(st, rCierre.id, cambios, { fecha: HOY });
      if (!c.ok) return c;
      st = { ...st, rutas: c.rutas };
    }
    return cerrarADPuro(st, rCierre.id, { fecha: HOY }, { bop: 0, serie: 0, abo: 0 });
  }, [rCierre, solicitudes, abonos, parqueEnvases, rutasDistribucion]);
  const personasCierre = useMemo(() => (rCierre ? convocadasDeAD(rCierre, solicitudes) : []), [rCierre, solicitudes]);

  const incid = porEstado.INCIDENCIA || 0;

  return (
    <div className="dx-content">
      <UnidadesStyles />
      <EjecucionStyles />

      <section className="dx-card">
        <div className="dx-card-head">
          <div>
            <h2>Ejecución y cierre de AD</h2>
            <p>La jornada por momentos: el camión sale vacío a recoger las bombonas al punto, las llena en planta y las
              devuelve al mismo punto. Cada AD muestra un solo paso siguiente. El cierre factura lo devuelto lleno al precio
              del día de salida, emite la BOP y descuenta el inventario; lo que no se pudo atender pasa a replanificación.</p>
          </div>
        </div>
        <div className="ea-kpis">
          <div><span>AD activas</span><b>{num(activas)}</b><small>de {num(ad.planificadas ?? planificadas.length)} planificadas</small></div>
          <div><span>En jornada</span><b>{num(ad.enJornada ?? 0)}</b>
            <small>{num(porEstado.EN_PUNTO || 0)} devuelta(s) al punto, lista(s) para cerrar</small></div>
          <div className={incid ? "wr" : ""}><span>Con incidencia</span><b>{num(incid)}</b>
            <small>{incid ? "esperan resolución" : "ninguna abierta"}</small></div>
          <div><span>Personas convocadas</span><b>{num(ad.convocadas ?? 0)}</b><small><KgL kg={ad.kgConvocado || 0} /></small></div>
          <div className="in"><span>Bombonas en poder de la empresa</span><b>{num(bombonasEnPoder)}</b>
            <small>recogidas en {num(enPoder.length)} AD · aún no vuelven al punto</small></div>
          <div className="in"><span>Llenado por cerrar</span><b><KgL kg={cifras?.glp?.llenadoPorCerrar || 0} /></b>
            <small>sale del inventario al cerrar su AD</small></div>
          <div className="ok"><span>AD cerradas</span><b>{num(ad.cerradas ?? porEstado.CERRADA ?? 0)}</b>
            <small>{cant(ad.entregadas ?? 0, "bombona entregada y facturada", "bombonas entregadas y facturadas")}</small></div>
        </div>
      </section>

      <div className="ea-tools">
        <div className="dx-search"><Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar AD, comuna, comunidad, conductor o placa" /></div>
        <div className="ea-tabs">
          {tabs.map(([k, l, n]) => (
            <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l} <em>{num(n)}</em></button>
          ))}
        </div>
      </div>

      <div className="ea-lista">
        {lista.map((r) => (
          <TarjetaAD key={r.id} r={r} c={cuadres.get(r.id)} onDetalle={() => setDetalle(r.id)}
            onIncidencia={() => setIncidencia(r.id)} onAccion={(id) => accion(r, id)} />
        ))}
        {!lista.length && <div className="ea-vacio">Ningún AD coincide con el filtro.</div>}
      </div>

      {rDetalle && <DetalleAD r={rDetalle} solicitudes={solicitudes} onClose={() => setDetalle(null)} />}
      {rSalida && <ModalSalida r={rSalida} c={cuadres.get(rSalida.id)} onClose={() => setSalida(null)}
        onConfirmar={(meta) => marcarSalida(rSalida, meta)} />}
      {rJornada && (
        <JornadaPersonas key={`${rJornada.id}-${jornada.modo}`} ruta={rJornada} solicitudes={solicitudes} parqueEnvases={parqueEnvases}
          modo={jornada.modo} onCancelar={() => setJornada(null)}
          onConfirmar={(marcas, meta) => registrarMomento(rJornada, jornada.modo, marcas, meta)} />
      )}
      {rCierre && <ModalCierreAD key={rCierre.id} r={rCierre} personas={personasCierre} previsualizar={previsualizar} onClose={() => setCierre(null)}
        onConfirmar={(meta) => cerrar(rCierre, meta)} />}
      {rIncidencia && <ModalIncidenciaAD r={rIncidencia} onClose={() => setIncidencia(null)}
        onGuardar={(d) => guardarIncidencia(rIncidencia, d)} />}
      {rResolver && <ModalResolverIncidencia r={rResolver} onClose={() => setResolviendo(null)}
        onGuardar={(d) => resolverIncidencia(rResolver, d)} />}
    </div>
  );
}

/* ── La tarjeta de un AD: quién va, en qué momento está y lo único que sigue ── */
function TarjetaAD({ r, c = {}, onDetalle, onIncidencia, onAccion }) {
  const e = estadoAD(r.estadoRuta);
  const cerrada = e.id === "CERRADA";
  const siguiente = siguienteAccionAD(r);
  const Ico = siguiente ? ICONO_ACCION[siguiente.id] || ClipboardCheck : null;
  // Sin personas convocadas no hay jornada que ejecutar: el botón fallaría.
  const puede = siguiente && (siguiente.id === "RESOLVER" || c.convocadas > 0);
  const u = unidadDistribucion(r.unidad);
  const tipo = tipoAD(r);
  return (
    <article className={`ea-ad ${e.id === "INCIDENCIA" ? "inc" : cerrada ? "ok" : e.id === "EN_PUNTO" ? "listo" : ""}`}>
      <div className="ea-ad-h">
        <div>
          <span className="ea-ad-n">AD {r.ad} <em className={`ea-tipo ${tipo.toLowerCase()}`}>{tipoADInfo(r).nombre}</em></span>
          <b>{r.comunidad}</b>
          <small>{r.comuna}{r.parroquia ? ` · ${r.parroquia}` : ""} · jornada del {fecha(r.fechaJornada || r.fechaPlan)}</small>
        </div>
        <span className={`ea-estado t-${e.tono}`}>{e.nombre}</span>
      </div>

      <div className="ea-ficha">
        <div><span>Unidad</span><b>{u.placa || r.unidad || "—"}</b><small>{u.etiqueta || ""}</small></div>
        <div><span>Conduce</span><b>{r.conductor || "Sin asignar"}</b><small>{r.conductorCedula || ""}</small></div>
        <div><span>Ayudante</span><b>{r.ayudante || "Sin ayudante"}</b><small>{r.ayudanteCedula || ""}</small></div>
        <div><span>Convocadas</span><b>{cant(c.convocadas || 0, "persona", "personas")}</b><small><KgL kg={c.kgConvocado || 0} /></small></div>
        {tipo === "ESPECIAL" && <div><span>Paradas</span><b>{num(r.paradas?.length || 0)} domicilios</b><small>ruta que arma Distribución</small></div>}
      </div>

      <LineaJornada r={r} c={c} />
      {(c.recogidas != null || c.llenadas != null) && <CuadreLinea c={c} />}
      {e.id === "INCIDENCIA" && <NotaIncidencia r={r} />}
      {e.id !== "INCIDENCIA" && r.incidenciaResuelta && (
        <div className="ea-resuelta"><ShieldCheck size={13} />
          <span>Incidencia «{r.incidenciaTipo || r.tipoIncidencia || "reportada"}» resuelta por {r.incidenciaResueltaPor || "—"} el {fecha(r.incidenciaResueltaEn)}
            {r.horaResolucion ? ` a las ${r.horaResolucion}` : ""}{r.notaResolucion ? `: ${r.notaResolucion}` : ""}</span></div>
      )}
      {cerrada && <ResumenCierre r={r} c={c} />}

      <div className="ea-acciones">
        <button className="dx-secondary" onClick={onDetalle}><Users size={13} /> Ver personas</button>
        {!cerrada && (
          <button className="dx-secondary" onClick={onIncidencia}><AlertTriangle size={13} />
            {e.id === "INCIDENCIA" ? " Corregir reporte" : " Registrar incidencia"}</button>
        )}
        {puede && <button className="dx-primary" onClick={() => onAccion(siguiente.id)}><Ico size={13} /> {siguiente.nombre}</button>}
        {siguiente && !puede && <span className="ea-sin">Sin personas convocadas: no hay jornada que ejecutar</span>}
      </div>
    </article>
  );
}

/** Planificada → en recolección → en planta → devuelta al punto → cerrada, con sus cifras. */
function LineaJornada({ r, c = {} }) {
  const e = estadoAD(r.estadoRuta);
  const previo = e.id === "INCIDENCIA" ? estadoAD(momentoPrevio(r)) : null;
  const actual = (previo || e).momento;
  const cerrada = e.id === "CERRADA";
  const j = r.jornada || {};
  const rec = c.recogidas != null;
  const lle = c.llenadas != null;
  const detalle = {
    ASIGNADA: [cant(c.convocadas || 0, "convocada", "convocadas"), r.fechaPlan ? `planificada el ${fecha(r.fechaPlan)}` : ""],
    EN_RUTA: [rec ? `${cant(c.recogidas, "recogida", "recogidas")} · ${num(c.noRecogidas || 0)} no` : "recogiendo en el punto",
      `${r.horaSalida ? `salió ${r.horaSalida}` : ""}${j.recoleccion?.hora ? ` · registrada ${j.recoleccion.hora}` : ""}`],
    EN_PLANTA: [lle ? `${cant(c.llenadas, "llena", "llenas")} · ${cant(c.noLlenadas || 0, "vacía", "vacías")}` : "llenando en planta",
      j.llenado?.hora ? `llenado ${j.llenado.hora}` : ""],
    EN_PUNTO: [lle ? cant(c.devueltas ?? c.recogidas, "devuelta", "devueltas") : "",
      j.despacho ? `despachado por el operador ${j.despacho.hora}` : j.devolucion?.hora ? `al punto ${j.devolucion.hora} · falta que el operador marque despachado` : ""],
    CERRADA: [cerrada ? `${num(c.entregadas || 0)} entregadas` : "", cerrada ? `${fecha(r.cerradaEn)}${r.horaCierre ? ` · ${r.horaCierre}` : ""}` : ""],
  };
  return (
    <div className="ea-linea-wrap">
      <ol className="ea-linea">
        {PASOS.map((p) => {
          const clase = p.momento < actual || cerrada ? "hecho" : p.momento === actual ? (previo ? "inc" : "actual") : "pend";
          const [linea, sub] = p.momento <= actual ? detalle[p.id] : ["", ""];
          return (
            <li key={p.id} className={`ea-paso ${clase}`}>
              <i />
              <b>{p.nombre}{clase === "inc" ? " · con incidencia" : ""}</b>
              {linea && <span>{linea}</span>}
              {sub && <small>{sub}</small>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Salen diez, vuelven diez: las dos igualdades de la jornada. */
function CuadreLinea({ c }) {
  const lle = c.llenadas != null;
  return (
    <div className="ea-cuadre">
      {c.recogidas != null && <span>Convocadas <b>{num(c.convocadas)}</b> = <b>{num(c.recogidas)}</b> recogidas + <b>{num(c.noRecogidas)}</b> no recogidas</span>}
      {lle && <span>Recogidas <b>{num(c.recogidas)}</b> = <b>{num(c.llenadas)}</b> llenas + <b>{num(c.noLlenadas)}</b> vacías</span>}
      {lle && <em className={c.cuadra ? "ok" : "no"}>{c.cuadra
        ? <><Check size={11} /> salen {num(c.recogidas)}, vuelven {num(c.devueltas ?? c.recogidas)}</>
        : <><AlertTriangle size={11} /> no cuadra</>}</em>}
    </div>
  );
}

function NotaIncidencia({ r }) {
  return (
    <div className="ea-inc-nota"><AlertTriangle size={14} />
      <div>
        <b>{r.incidenciaTipo || r.tipoIncidencia || "Incidencia reportada"}{r.horaIncidencia ? ` · ${r.horaIncidencia}` : ""} · estaba «{estadoAD(momentoPrevio(r)).nombre}»</b>
        <span>{r.obsIncidencia || "Sin detalle"}{r.incidenciaConfirmadaPor ? ` — confirmada por ${r.incidenciaConfirmadaPor}` : ""}</span>
      </div>
    </div>
  );
}

function ResumenCierre({ r, c }) {
  return (
    <div className="ea-cierre">
      <div><span>Entregadas</span><b>{num(c.entregadas)}</b><small>devueltas llenas · facturadas</small></div>
      <div><span>A replanificación</span><b>{num(c.replanificadas)}</b><small>bandeja · AD especial</small></div>
      <div><span>A saldo a favor</span><b>{num(c.abonadas)}</b><small>desistieron · su pago quedó a su favor</small></div>
      <div><span>Salida de GLP</span><b><KgL kg={c.kgSalida} /></b></div>
      {/* Distribución no ve bolívares: cuántas facturas, no por cuánto. */}
      <div><span>Facturas emitidas</span><b>{num(c.facturas ?? c.entregadas)}</b><small>precio del {fecha(r.fechaSalida || r.cerradaEn)} · el monto lo ve Comercialización</small></div>
      <div><span>Recibió en el punto</span><b>{r.recepcion?.receptor || "—"}</b>
        <small>{r.recepcion?.cedula || ""}{r.recepcion?.cerradaPor ? ` · cerró ${r.recepcion.cerradaPor}` : ""}</small></div>
    </div>
  );
}

/** Las personas que pasaron por el AD y lo que les pasó en cada momento. */
function DetalleAD({ r, solicitudes = [], onClose }) {
  const [q, setQ] = useState("");
  const personas = useMemo(() => personasDeAD(r, solicitudes), [r, solicitudes]);
  const lista = personas.filter((s) => {
    if (!q) return true;
    const u = usr(s.usuario);
    return `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(q.toLowerCase());
  });
  const j = r.jornada || {};
  const paradas = r.paradas || [];
  const tipo = tipoADInfo(r);
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal ancho" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {tipo.nombre.toUpperCase()} · {estadoAD(r.estadoRuta).nombre.toUpperCase()}</span><h3>{r.comunidad}</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <div className="ea-gente"><Users size={20} />
            <div><b>{cant(personas.length, "persona pasó", "personas pasaron")} por este AD</b><span>{tipo.desc}</span></div></div>

          {paradas.length > 0 && (
            <>
              <h4>Paradas por domicilio</h4>
              {paradas.map((p) => (
                <div className="ea-stop" key={p.orden}><i>{p.orden}</i>
                  <div><b>{p.nombre}</b>
                    <span>{p.direccion} · {p.sector}{p.motivo ? ` · viene de: ${motivoNoEntrega(p.motivo).nombre}` : " · entrega directa"}</span></div></div>
              ))}
            </>
          )}

          <h4>Las personas y su jornada</h4>
          <div className="dx-search ea-buscar"><Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, cédula o solicitud" /></div>
          <div className="ea-tabla-wrap">
            <table className="ea-tabla">
              <thead><tr><th>#</th><th>Persona</th><th>Producto</th><th className="r">GLP</th><th>Recolección</th><th>Planta</th><th>Resultado</th></tr></thead>
              <tbody>
                {lista.slice(0, 300).map((s, i) => {
                  const u = usr(s.usuario);
                  const mk = marcaDe(r, s.id);
                  const h = (s.historialAD || []).filter((x) => x.rutaId === r.id).slice(-1)[0];
                  const salio = h?.resultado === "SALIO_POR_TARIFA";
                  const recoleccion = salio || !j.recoleccion ? "—" : mk.recogida === false ? motivoNoEntrega(mk.motivo).nombre : "Recogida";
                  const planta = salio || !j.llenado || mk.recogida === false ? "—"
                    : mk.llenada === false ? `Vacía · ${motivoNoEntrega(mk.motivo).nombre}` : "Llenada";
                  const noAtendida = !salio && (mk.recogida === false || mk.llenada === false);
                  return (
                    <tr key={s.id} className={noAtendida || salio ? "prob" : ""}>
                      <td className="ea-n">{i + 1}</td>
                      <td><b>{u.nombre}</b><span>{u.doc} · {s.id}</span></td>
                      <td>{cpt(s.concepto).corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""}</td>
                      <td className="r"><KgL kg={kgDeSolicitud(s)} /></td>
                      <td>{recoleccion}</td>
                      <td>{planta}</td>
                      <td>{h ? `${RESULTADO[h.resultado] || h.resultado} · ` : ""}{estadoSolicitud(s.estado).admin}
                        {mk.observacion && <span>Observación: {mk.observacion}</span>}
                        {mk.corregidaAlCierre && <span>Corregida al cerrar el AD</span>}
                        {noAtendida && !adCerrada(r) && <span>al cerrar: {consecuenciaDe(motivoNoEntrega(mk.motivo))}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!lista.length && <div className="ea-vacio chico">Ninguna persona coincide con la búsqueda.</div>}
          {lista.length > 300 && <div className="ea-mas">Mostrando 300 de {num(lista.length)}. Afina la búsqueda para ver el resto.</div>}

          <div className="ea-regla"><ShieldCheck size={16} />
            <span>La responsabilidad de la empresa termina cuando las bombonas vuelven al punto. Si el dueño la retira o
              no, ya no le compete a GasLara.</span></div>
        </div>
      </div>
    </div>
  );
}

/** Salida a recolección: fija el precio del AD, el de este día. */
function ModalSalida({ r, c = {}, onClose, onConfirmar }) {
  const [hora, setHora] = useState(horaActual);
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(null);
  const u = unidadDistribucion(r.unidad);
  const disp = disponibilidadUnidad(u, HOY);
  function confirmar() {
    const res = onConfirmar({ hora });
    if (!res?.ok) { setError(res?.error || "No se pudo marcar la salida."); return; }
    setHecho(res);
  }
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal chico" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>{hecho ? "Salió a recolección" : "Marcar salida a recolección"}</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          {hecho ? (
            <div className="ea-inc-nota ambar"><AlertTriangle size={14} />
              <div><b>{num(hecho.salieronPorTarifa)} persona(s) salieron por la tarifa nueva</b>
                <span>Al fijar el precio de hoy su pago (con su saldo a favor) ya no alcanzaba: quedan por completar y no
                  se recogen en esta jornada. Cuando completen, entran a la próxima.</span></div></div>
          ) : (
            <>
              <div className="ea-conf">
                <div><span>Unidad</span><b>{u.placa || r.unidad}</b><small>{u.etiqueta || ""}</small></div>
                <div><span>Conduce</span><b>{r.conductor || "Sin asignar"}</b><small>ayudante: {r.ayudante || "sin ayudante"}</small></div>
                <div><span>Convocadas</span><b>{num(c.convocadas || 0)}</b><small><KgL kg={c.kgConvocado || 0} /></small></div>
                <div><span>Jornada</span><b>{fecha(r.fechaJornada || r.fechaPlan)}</b><small>{tipoADInfo(r).nombre}</small></div>
              </div>
              {!disp.disponible && (
                <div className="ea-inc-nota"><AlertTriangle size={14} />
                  <div><b>El vehículo no está disponible</b><span>{disp.motivos.join(" · ")}. Reasígnelo antes de salir.</span></div></div>
              )}
              <label className="ea-campo"><span>Hora de salida</span>
                <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></label>
              <div className="ea-regla"><Truck size={16} />
                <span>El camión sale vacío a recoger las bombonas. La salida fija el precio del AD: el de hoy. Si la tarifa
                  subió y a alguien no le alcanza lo pagado ni su saldo a favor, sale de la lista y queda por completar.</span></div>
              {error && <div className="ea-error"><AlertTriangle size={15} /> {error}</div>}
            </>
          )}
        </div>
        <footer>
          {hecho ? <button className="dx-primary" onClick={onClose}><Check size={14} /> Entendido</button> : (
            <>
              <button className="dx-secondary" onClick={onClose}>Cancelar</button>
              <button className="dx-primary" disabled={!hora} onClick={confirmar}><Truck size={14} /> Marcar salida</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Cierre del AD: las incidencias por cliente, el cuadre, lo que se factura y a dónde va
    quien no se atendió. */
function ModalCierreAD({ r, personas: personasAlAbrir = [], previsualizar, onClose, onConfirmar }) {
  const [d, setD] = useState(() => ({ receptor: "", cedula: "", hora: horaActual(), por: "" }));
  const [error, setError] = useState("");
  const [resumen, setResumen] = useState(null);
  // Incidencias por cliente anotadas o corregidas al cerrar: { [solicitudId]: { resultado, observacion } }.
  const [cambios, setCambios] = useState({});
  // La lista queda fija al abrir: cerrado el AD, sus personas dejan de estar «convocadas».
  const [personas] = useState(personasAlAbrir);
  const previa = useMemo(() => (resumen ? null : previsualizar?.(cambios)), [cambios, resumen, previsualizar]);
  const p = previa?.ok ? previa.resumen : null;
  const x = resumen || p;
  function confirmar() {
    if (!d.receptor.trim()) { setError("Indique quién recibe las bombonas en el punto."); return; }
    const res = onConfirmar({ receptor: d.receptor.trim(), cedula: d.cedula.trim() || null, hora: d.hora,
      por: d.por.trim() || "Gerencia de Distribución", correcciones: cambios });
    if (!res?.ok) { setError(res?.error || "No se pudo cerrar el AD."); return; }
    setResumen({ ...res.resumen, correcciones: res.correcciones || 0 });
  }
  const igual = (a, b) => (a === b ? "ok" : "no");
  return (
    <div className="ea-overlay" onClick={resumen ? onClose : undefined}>
      <div className="ea-modal ancho" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>{resumen ? "AD cerrada" : "Cerrar AD"}</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          {!x && <div className="ea-error"><AlertTriangle size={15} /> {previa?.error || "Este AD no está listo para cerrar."}</div>}
          {x && (
            <>
              {!resumen && (
                <p className="ea-p">Las bombonas ya están de vuelta en el punto. Al cerrar se factura lo devuelto lleno al precio
                  del día de salida ({fecha(r.fechaSalida)}), se emite la BOP y sale del inventario; quien no se atendió pasa a
                  la bandeja de replanificación y sólo quien desistió pasa a saldo a favor.</p>
              )}
              {/* El reporte del operador desde la app: él marca despachado, Distribución cierra. */}
              {!resumen && (r.jornada?.despacho ? (() => { const dp = r.jornada.despacho;
                const cuadra = dp.personasEntregadas == null || (dp.personasEntregadas === x.entregadas && dp.personasRecogidas === x.recogidas);
                return <div className={cuadra ? "ea-regla" : "ea-error"}>{cuadra ? <ShieldCheck size={16} /> : <AlertTriangle size={15} />}
                  <span><b>Despachado por el operador</b> {dp.operador} a las {dp.hora}, desde la app: {num(dp.planificados)} cilindros planificados ·
                    {" "}{num(dp.recogidos)} recogidos · {num(dp.entregados)} entregados llenos · {num(dp.vacios)} devueltos vacíos.
                    {cuadra ? " Cuadra con lo que se va a cerrar." : " Con las correcciones de abajo, el cierre ya no coincide con su reporte: queda en la bitácora."}
                    {dp.observacion ? ` Nota del operador: ${dp.observacion}` : ""}</span></div>; })()
                : <div className="ea-error"><AlertTriangle size={15} /> El operador todavía no marcó «Despachado» en la app. Se puede cerrar con lo registrado, pero conviene esperar su reporte.</div>)}
              <IncidenciasCliente r={r} personas={personas} cambios={cambios} setCambios={setCambios} bloqueado={Boolean(resumen)} />
              <div className="ea-ecu">
                <div className={igual(x.convocadas, x.recogidas + x.noRecogidas)}>
                  <span>Convocadas</span><b>{num(x.convocadas)}</b><em>=</em><b>{num(x.recogidas)}</b><span>recogidas</span>
                  <em>+</em><b>{num(x.noRecogidas)}</b><span>no recogidas</span></div>
                <div className={igual(x.recogidas, x.llenadas + x.noLlenadas)}>
                  <span>Recogidas</span><b>{num(x.recogidas)}</b><em>=</em><b>{num(x.llenadas)}</b><span>llenas</span>
                  <em>+</em><b>{num(x.noLlenadas)}</b><span>vacías · todas devueltas al punto</span></div>
              </div>
              <div className="ea-conf">
                {/* Distribución no ve bolívares: cuántas facturas se emiten, no por cuánto. */}
                <div className="ok"><span>{resumen ? "Facturas emitidas" : "Se emiten"}</span><b>{cant(x.facturas ?? x.entregadas, "factura", "facturas")}</b>
                  <small>{cant(x.entregadas, "devuelta llena", "devueltas llenas")} · precio del día de salida · el monto lo ve Comercialización</small></div>
                <div><span>Salida de inventario · BOP</span><b><KgL kg={x.kgSalida} /></b><small>{cant(x.entregadas, "boleta", "boletas")}</small></div>
                <div className="in"><span>A replanificación</span><b>{num(x.replanificadas)}</b>
                  <small>pasan a la bandeja de replanificación (AD especial)</small></div>
                <div className="ab"><span>A saldo a favor</span><b>{num(x.abonadas)}</b>
                  <small>{x.abonadas ? "desistieron: su pago pasa a su saldo a favor" : "nadie desistió"}</small></div>
              </div>
              {Object.keys(x.porMotivo || {}).length > 0 && (
                <div className="ea-motivos">
                  {Object.entries(x.porMotivo).map(([id, n]) => {
                    const mot = motivoNoEntrega(id);
                    return <span key={id}><b>{num(n)}</b> {mot.nombre} <em>→ {consecuenciaDe(mot)}</em></span>;
                  })}
                </div>
              )}
              {resumen ? (
                <div className="ea-regla"><ShieldCheck size={16} />
                  <span>Recibió <b>{d.receptor}</b>{d.cedula ? `, cédula ${d.cedula}` : ""}, a las {d.hora}. Aquí terminó la
                    responsabilidad de la empresa: las bombonas quedaron en el punto.
                    {resumen.correcciones ? ` Se corrigieron al cerrar ${cant(resumen.correcciones, "incidencia", "incidencias")} por cliente; quedan en la bitácora del AD.` : ""}</span></div>
              ) : (
                <>
                  <div className="ea-dos">
                    <label className="ea-campo"><span>Recibe en el punto *</span>
                      <input value={d.receptor} onChange={(e) => { setError(""); setD({ ...d, receptor: e.target.value }); }} placeholder="Nombre de quien recibe" /></label>
                    <label className="ea-campo"><span>Cédula</span>
                      <input value={d.cedula} onChange={(e) => setD({ ...d, cedula: e.target.value })} placeholder="V-00.000.000" /></label>
                    <label className="ea-campo"><span>Hora del cierre</span>
                      <input type="time" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></label>
                    <label className="ea-campo"><span>Cierra</span>
                      <input value={d.por} onChange={(e) => setD({ ...d, por: e.target.value })} placeholder="Gerencia de Distribución" /></label>
                  </div>
                  <div className="ea-regla"><ShieldCheck size={16} />
                    <span>La responsabilidad de la empresa termina cuando las bombonas vuelven al punto. Si el dueño la retira o
                      no, ya no le compete a GasLara.</span></div>
                </>
              )}
            </>
          )}
          {error && <div className="ea-error"><AlertTriangle size={15} /> {error}</div>}
        </div>
        <footer>
          {resumen ? <button className="dx-primary" onClick={onClose}><Check size={14} /> Listo</button> : (
            <>
              <button className="dx-secondary" onClick={onClose}>Volver</button>
              <button className="dx-primary" disabled={!p || !d.receptor.trim() || !d.hora} onClick={confirmar}>
                <ClipboardCheck size={14} /> Confirmar y cerrar AD</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * INCIDENCIAS POR CLIENTE AL CERRAR · qué pasó con cada persona de esta AD.
 * Arranca con lo que se registró en la recolección y en el llenado. Distribución puede anotar
 * lo que el reporte del conductor trajo tarde o corregir lo que se marcó mal: cada cambio
 * rehace lo físico de esta AD y el cuadre de arriba lo refleja antes de confirmar.
 */
function IncidenciasCliente({ r, personas, cambios, setCambios, bloqueado }) {
  const [ver, setVer] = useState("NOVEDAD");
  const [q, setQ] = useState("");
  const original = (s) => { const mk = marcaDe(r, s.id); return { resultado: mk.recogida === false || mk.llenada === false ? mk.motivo : "ENTREGADA", observacion: mk.observacion || "" }; };
  const valor = (s) => cambios[s.id]?.resultado ?? original(s).resultado;
  const obs = (s) => cambios[s.id]?.observacion ?? original(s).observacion;
  function cambiar(s, campo, v) {
    setCambios((c) => {
      const o = original(s);
      const nuevo = { resultado: c[s.id]?.resultado ?? o.resultado, observacion: c[s.id]?.observacion ?? o.observacion, [campo]: v };
      const resto = { ...c };
      // Volver a lo registrado deshace la corrección.
      if (nuevo.resultado === o.resultado && nuevo.observacion.trim() === o.observacion.trim()) delete resto[s.id];
      else resto[s.id] = nuevo;
      return resto;
    });
  }
  const conNovedad = personas.filter((s) => valor(s) !== "ENTREGADA" || obs(s) || cambios[s.id]);
  const qq = q.trim().toLowerCase();
  const lista = (ver === "NOVEDAD" ? conNovedad : personas)
    .filter((s) => { if (!qq) return true; const u = usr(s.usuario); return `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(qq); });
  const corregidas = Object.keys(cambios).length;
  return (
    <div className="ea-inc">
      <div className="ea-inc-h">
        <div><b>Incidencias por cliente</b>
          <span>{bloqueado
            ? "Lo que quedó registrado con cada persona de esta AD."
            : "Lo que pasó con cada persona en el punto y en planta. Si el reporte del conductor trae algo que no se anotó, o se marcó mal, corrígelo aquí antes de cerrar: se rehacen la recolección, el llenado y la devolución de esta AD."}</span></div>
        <div className="ea-tabs">
          <button className={ver === "NOVEDAD" ? "on" : ""} onClick={() => setVer("NOVEDAD")}>Con incidencia <em>{num(conNovedad.length)}</em></button>
          <button className={ver === "TODAS" ? "on" : ""} onClick={() => setVer("TODAS")}>Todas <em>{num(personas.length)}</em></button>
        </div>
      </div>
      {corregidas > 0 && !bloqueado && (
        <div className="ea-inc-aviso"><AlertTriangle size={14} />
          <span>{cant(corregidas, "persona corregida", "personas corregidas")} al cerrar · el cuadre y la facturación de abajo ya lo reflejan</span>
          <button onClick={() => setCambios({})}>Deshacer</button></div>
      )}
      {personas.length > 8 && <div className="dx-search ea-buscar"><Search size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, cédula o solicitud" /></div>}
      {lista.length > 0 && (
        <div className="ea-tabla-wrap ea-inc-tabla">
          <table className="ea-tabla">
            <thead><tr><th>Persona</th><th>Qué pasó</th><th>Observación</th><th>Al cerrar</th></tr></thead>
            <tbody>
              {lista.slice(0, 200).map((s) => {
                const u = usr(s.usuario);
                const v = valor(s);
                const mot = v === "ENTREGADA" ? null : motivoNoEntrega(v);
                const txt = mot ? `${mot.momento === "RECOLECCION" ? "No se recogió" : "Volvió vacía"} · ${mot.nombre}` : "Devuelta llena";
                return (
                  <tr key={s.id} className={mot ? "prob" : ""}>
                    <td><b>{u.nombre}</b><span>{u.doc} · {s.id} · {cpt(s.concepto).corto}</span></td>
                    <td>{bloqueado ? <b>{txt}</b> : (
                      <select value={v} onChange={(e) => cambiar(s, "resultado", e.target.value)}>
                        <option value="ENTREGADA">Devuelta llena · se factura</option>
                        <optgroup label="En el punto · no se recogió">
                          {motivosDelMomento("RECOLECCION").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</optgroup>
                        <optgroup label="En planta · volvió vacía">
                          {motivosDelMomento("PLANTA").map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</optgroup>
                      </select>)}
                      {(cambios[s.id] || marcaDe(r, s.id).corregidaAlCierre) && <span className="ea-corr">corregida al cerrar</span>}</td>
                    <td>{bloqueado ? (obs(s) || "—") : (
                      <input value={obs(s)} onChange={(e) => cambiar(s, "observacion", e.target.value)} placeholder="Opcional" />)}</td>
                    <td className="ea-inc-efecto">{mot ? consecuenciaDe(mot) : "se factura y sale del inventario"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > 200 && <div className="ea-mas">Mostrando 200 de {num(lista.length)}. Busca a la persona por nombre o cédula.</div>}
      {!lista.length && <div className="ea-vacio chico">{ver === "NOVEDAD"
        ? "Nadie tuvo incidencias: todas las bombonas volvieron llenas. Si alguien sí tuvo una, búscalo en «Todas»."
        : "Ninguna persona coincide con la búsqueda."}</div>}
    </div>
  );
}

/* La incidencia la reporta el conductor por radio o teléfono; aquí Distribución la
   tipifica y la firma. Sin tipo y sin quién la confirma no queda constancia útil. */
const TIPOS_INCIDENCIA = [
  "Avería de la unidad",
  "No se pudo acceder al punto",
  "Punto comunal cerrado",
  "Situación de seguridad en la zona",
  "Condiciones climáticas",
  "Falla en planta · el llenado se detuvo",
  "Otro motivo",
];

function ModalIncidenciaAD({ r, onClose, onGuardar }) {
  const abierta = estadoAD(r.estadoRuta).id === "INCIDENCIA";
  const previo = abierta ? momentoPrevio(r) : estadoAD(r.estadoRuta).id;
  const tipoPrevio = r.incidenciaTipo || r.tipoIncidencia;
  // Corregir parte del reporte abierto; una incidencia nueva arranca en blanco.
  const [d, setD] = useState(() => ({
    tipo: abierta && tipoPrevio ? tipoPrevio : TIPOS_INCIDENCIA[0],
    detalle: abierta ? r.obsIncidencia || "" : "",
    hora: abierta && r.horaIncidencia ? r.horaIncidencia : horaActual(),
    confirmadaPor: abierta ? r.incidenciaConfirmadaPor || "" : "",
  }));
  const [error, setError] = useState("");
  const tipos = tipoPrevio && !TIPOS_INCIDENCIA.includes(tipoPrevio) ? [tipoPrevio, ...TIPOS_INCIDENCIA] : TIPOS_INCIDENCIA;
  const ok = d.detalle.trim().length > 5 && d.confirmadaPor.trim().length > 2 && d.hora;
  function guardar() {
    const res = onGuardar(d);
    if (!res?.ok) setError(res?.error || "No se pudo registrar la incidencia.");
  }
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal chico" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>{abierta ? "Corregir el reporte de incidencia" : "Registrar incidencia"}</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <p className="ea-p">El conductor reporta lo que ocurrió. Distribución lo tipifica y lo firma: así la incidencia queda
            con responsable, no como un texto suelto.</p>
          <label className="ea-campo"><span>Qué ocurrió</span>
            <select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>
              {tipos.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="ea-campo"><span>Detalle de lo reportado</span>
            <textarea rows={3} value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })}
              placeholder="Qué informó el conductor y qué se decidió" /></label>
          <div className="ea-dos">
            <label className="ea-campo"><span>Hora del reporte</span>
              <input type="time" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></label>
            <label className="ea-campo"><span>Quién confirma</span>
              <input value={d.confirmadaPor} onChange={(e) => setD({ ...d, confirmadaPor: e.target.value })}
                placeholder="Gerente de Distribución" /></label>
          </div>
          <div className="ea-regla"><AlertTriangle size={16} />
            <span>El AD queda con incidencia en el momento en que estaba («{estadoAD(previo).nombre}»). Al resolverla vuelve a
              ese momento{["EN_PLANTA", "EN_PUNTO"].includes(previo) ? "" : " o se reprograma"}. Nada se factura ni se abona
              mientras siga abierta.</span></div>
          {error && <div className="ea-error"><AlertTriangle size={15} /> {error}</div>}
        </div>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={guardar}><ShieldCheck size={14} /> {abierta ? "Guardar reporte" : "Confirmar incidencia"}</button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Resolver la incidencia devuelve el AD al flujo. Una incidencia resuelta no es un estado:
 * es la decisión de retomar la jornada donde quedó o reprogramarla. Si las bombonas ya se
 * recogieron no hay reprogramación posible: están en poder de la empresa y tienen que volver.
 */
function ModalResolverIncidencia({ r, onClose, onGuardar }) {
  const previo = momentoPrevio(r);
  const recogidas = ["EN_PLANTA", "EN_PUNTO"].includes(previo);
  const destinos = [
    { id: previo, texto: `Vuelve a «${estadoAD(previo).nombre}» · la jornada sigue donde quedó` },
    ...(!recogidas && previo !== "REPROGRAMADA" ? [{ id: "REPROGRAMADA", texto: "Se reprograma · la gente se convoca otro día" }] : []),
  ];
  const [d, setD] = useState(() => ({ destino: previo, nota: "", por: "", hora: horaActual() }));
  const [error, setError] = useState("");
  const ok = d.nota.trim().length > 5 && d.por.trim().length > 2 && d.hora;
  function guardar() {
    const res = onGuardar(d);
    if (!res?.ok) setError(res?.error || "No se pudo resolver la incidencia.");
  }
  return (
    <div className="ea-overlay" onClick={onClose}>
      <div className="ea-modal chico" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>AD {r.ad} · {r.comunidad}</span><h3>Resolver la incidencia</h3></div>
          <button onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <div className="ea-modal-b">
          <NotaIncidencia r={r} />
          <label className="ea-campo"><span>En qué queda el AD</span>
            <select value={d.destino} onChange={(e) => setD({ ...d, destino: e.target.value })}>
              {destinos.map((x) => <option key={x.id} value={x.id}>{x.texto}</option>)}
            </select></label>
          <label className="ea-campo"><span>Cómo se resolvió</span>
            <textarea rows={3} value={d.nota} onChange={(e) => setD({ ...d, nota: e.target.value })} placeholder="Qué se hizo para levantarla" /></label>
          <div className="ea-dos">
            <label className="ea-campo"><span>Quién la resuelve</span>
              <input value={d.por} onChange={(e) => setD({ ...d, por: e.target.value })} placeholder="Gerente de Distribución" /></label>
            <label className="ea-campo"><span>Hora</span>
              <input type="time" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></label>
          </div>
          <div className="ea-regla"><ShieldCheck size={16} />
            <span>{recogidas
              ? "Las bombonas ya se recogieron: están en poder de la empresa y tienen que volver al punto. La jornada se retoma donde quedó."
              : d.destino === "REPROGRAMADA"
                ? "El AD queda reprogramado. Las personas siguen convocadas con su pago vigente: nadie pierde su turno ni su dinero. Al volver a salir se fija el precio de ese día."
                : "El AD vuelve a su momento y sigue su curso normal."}</span></div>
          {error && <div className="ea-error"><AlertTriangle size={15} /> {error}</div>}
        </div>
        <footer>
          <button className="dx-secondary" onClick={onClose}>Cancelar</button>
          <button className="dx-primary" disabled={!ok} onClick={guardar}><ShieldCheck size={14} /> Resolver y devolver al flujo</button>
        </footer>
      </div>
    </div>
  );
}

function EjecucionStyles() {
  return <style>{`
.ea-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin-top:14px}
.ea-kpis>div{background:#F7F9FA;border:1px solid #E4EAED;border-radius:11px;padding:12px 13px;min-width:0}
.ea-kpis span{display:block;font-size:11px;color:#71808A;font-weight:600}
.ea-kpis b{display:block;font-size:22px;font-weight:660;margin:3px 0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ea-kpis b .kgl{font-size:17px!important}
.ea-kpis small{display:block;font-size:11px;color:#84919B;line-height:1.4}
.ea-kpis>div.wr{background:#FDF6EA;border-color:#EFDDBC}.ea-kpis>div.wr b{color:#8A5A16}
.ea-kpis>div.ok{background:#F1F8F4;border-color:#D5E7DC}.ea-kpis>div.ok b{color:#1C7A50}
.ea-kpis>div.in{background:#F2F6FB;border-color:#DCE6F2}.ea-kpis>div.in b{color:#2A5FA6}
.ea-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:16px 0 12px}
.ea-tabs{display:flex;gap:5px;flex-wrap:wrap}
.ea-tabs button{border:0;background:#EDF1F3;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;color:#516069;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.ea-tabs button.on{background:#17623F;color:#fff}
.ea-tabs em{font-style:normal;font-size:11px;font-weight:700;opacity:.7}
.ea-lista{display:flex;flex-direction:column;gap:12px}
.ea-ad{background:#fff;border:1px solid #E3E9ED;border-radius:14px;padding:16px;border-left:3px solid #C3CED5}
.ea-ad.inc{border-left-color:#A83E3E}
.ea-ad.ok{border-left-color:#1C7A50}
.ea-ad.listo{border-left-color:#2A5FA6}
.ea-ad-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
.ea-ad-n{font-size:11px;font-weight:700;color:#26704C;letter-spacing:.04em;display:inline-flex;gap:8px;align-items:center}
.ea-tipo{font-style:normal;font-size:10.5px;font-weight:650;letter-spacing:0;padding:2px 8px;border-radius:99px;background:#EEF2F4;color:#516069}
.ea-tipo.especial{background:#EAF1FA;color:#2A5FA6}
.ea-tipo.institucional,.ea-tipo.comercial{background:#FDF6EA;color:#8A5A16}
.ea-ad-h b{display:block;font-size:16px;font-weight:650;margin:3px 0}
.ea-ad-h small{display:block;font-size:12px;color:#74818B}
.ea-estado{font-size:11px;font-weight:650;padding:5px 10px;border-radius:99px;background:#EEF2F4;color:#516069;white-space:nowrap}
.ea-estado.t-azul{background:#EAF1FA;color:#2A5FA6}
.ea-estado.t-ambar{background:#FDF3E3;color:#9A6410}
.ea-estado.t-rojo{background:#FBECEC;color:#A83E3E}
.ea-estado.t-verde{background:#EDF6F0;color:#1C7A50}
.ea-ficha{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0 12px;padding:12px;background:#F7F9FA;border-radius:10px}
.ea-ficha span{display:block;font-size:10.5px;color:#77848D;font-weight:600}
.ea-ficha b{display:block;font-size:13px;font-weight:600;margin-top:2px;line-height:1.35}
.ea-ficha small{display:block;font-size:11px;color:#8A959D;margin-top:2px;line-height:1.35}
.ea-linea-wrap{overflow-x:auto;margin:0 0 10px}
.ea-linea{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(120px,1fr))}
.ea-paso{position:relative;padding:24px 10px 2px 0}
.ea-paso::before{content:"";position:absolute;top:8px;left:0;right:0;height:3px;background:#E3E9ED}
.ea-paso.hecho::before{background:#1C7A50}
.ea-paso i{position:absolute;top:1px;left:0;width:17px;height:17px;border-radius:50%;background:#fff;border:3px solid #C9D3D9;box-sizing:border-box}
.ea-paso.hecho i{background:#1C7A50;border-color:#1C7A50}
.ea-paso.actual i{border-color:#2A5FA6;box-shadow:0 0 0 4px rgba(42,95,166,.16)}
.ea-paso.inc i{border-color:#A83E3E;box-shadow:0 0 0 4px rgba(168,62,62,.16)}
.ea-paso b{display:block;font-size:11.5px;font-weight:650;color:#252F36}
.ea-paso.pend b{color:#9AA6AE;font-weight:600}
.ea-paso.actual b{color:#2A5FA6}.ea-paso.inc b{color:#A83E3E}
.ea-paso span{display:block;font-size:11.5px;color:#3A464E;margin-top:3px;font-variant-numeric:tabular-nums}
.ea-paso small{display:block;font-size:10.5px;color:#84919B;margin-top:1px}
.ea-cuadre{display:flex;gap:8px 14px;flex-wrap:wrap;align-items:center;font-size:12px;color:#3A464E;background:#F7F9FA;border-radius:9px;padding:8px 11px;margin-bottom:12px}
.ea-cuadre b{font-variant-numeric:tabular-nums;color:#17232C}
.ea-cuadre em{font-style:normal;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px}
.ea-cuadre em.ok{background:#E9F5EE;color:#1B7A4C}.ea-cuadre em.no{background:#FBECEC;color:#A83E3E}
.ea-inc-nota{display:flex;gap:9px;background:#FBECEC;border:1px solid #F2D4D4;border-radius:10px;padding:11px;margin-bottom:12px}
.ea-inc-nota svg{color:#A83E3E;flex:none;margin-top:1px}
.ea-inc-nota b{display:block;font-size:12.5px;color:#A83E3E}
.ea-inc-nota span{display:block;font-size:12px;color:#5B4444;line-height:1.5;margin-top:3px}
.ea-inc-nota.ambar{background:#FDF6EA;border-color:#EFDDBC}.ea-inc-nota.ambar svg,.ea-inc-nota.ambar b{color:#8A5A16}
.ea-resuelta{display:flex;gap:7px;align-items:flex-start;font-size:11.5px;color:#516069;background:#F7F9FA;border-radius:9px;padding:8px 11px;margin-bottom:12px;line-height:1.45}
.ea-resuelta svg{color:#1C7A50;flex:none;margin-top:2px}
.ea-cierre{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;background:#F1F8F4;border-radius:10px;padding:12px;margin-bottom:12px}
.ea-cierre span{display:block;font-size:10.5px;color:#5C7A6B}
.ea-cierre b{display:block;font-size:14px;font-weight:640;margin-top:2px;color:#17623F}
.ea-cierre small{display:block;font-size:10.5px;color:#6F8A7C;margin-top:2px}
.ea-acciones{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end;align-items:center}
.ea-sin{font-size:11.5px;color:#8A959D}
.ea-vacio{text-align:center;padding:50px;color:#78868F;font-size:13px}
.ea-vacio.chico{padding:18px}
.ea-overlay{position:fixed;inset:0;background:rgba(11,18,22,.55);backdrop-filter:blur(5px);z-index:70;display:grid;place-items:center;padding:20px;overflow:auto}
.ea-modal{background:#fff;border-radius:16px;width:min(720px,96vw);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(11,18,22,.3)}
.ea-modal.chico{width:min(580px,96vw)}
.ea-modal.ancho{width:min(1040px,96vw)}
.ea-modal>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid #E7ECEF}
.ea-modal>header span{font-size:10.5px;font-weight:700;color:#26704C;letter-spacing:.05em}
.ea-modal>header h3{font-size:18px;margin:4px 0 0;font-weight:650}
.ea-modal>header button{border:0;background:none;color:#6B7B85;cursor:pointer}
.ea-modal-b{padding:18px 20px;overflow:auto}
.ea-inc{border:1px solid #E3E8EC;border-radius:12px;padding:12px 12px 6px;margin:0 0 14px;background:#FBFCFD}
.ea-inc-h{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap}
.ea-inc-h b{display:block;font-size:13.5px}
.ea-inc-h span{display:block;font-size:11px;color:#6E7C87;line-height:1.5;max-width:560px;margin-top:3px}
.ea-inc-aviso{display:flex;gap:8px;align-items:center;background:#FFF6E6;color:#8A5A12;border-radius:8px;padding:7px 10px;font-size:11.5px;margin-bottom:10px}
.ea-inc-aviso button{margin-left:auto;border:0;background:transparent;color:#8A5A12;font-weight:700;cursor:pointer;text-decoration:underline}
.ea-inc-tabla{max-height:320px;overflow:auto}
.ea-inc select,.ea-inc td input{width:100%;min-width:190px;border:1px solid #D5DDE3;border-radius:7px;padding:6px 8px;font-size:11.5px;background:#fff;font-family:inherit}
.ea-inc .ea-inc-efecto{white-space:normal;min-width:180px;font-size:11px;color:#5F6D76}
.ea-corr{display:inline-block !important;margin-top:4px;font-size:9.5px !important;font-weight:700;color:#A66A16 !important}
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
.ea-buscar{margin-bottom:10px}
.ea-tabla-wrap{overflow:auto;max-height:420px;border:1px solid #E4E9EC;border-radius:10px}
.ea-tabla{width:100%;border-collapse:collapse;font-size:12.5px}
.ea-tabla th,.ea-tabla td{padding:8px 11px;border-bottom:1px solid #EDF1F3;text-align:left;white-space:nowrap;vertical-align:top}
.ea-tabla th{position:sticky;top:0;background:#F5F7F8;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#6D7982;font-weight:700;z-index:1}
.ea-tabla .r{text-align:right}
.ea-tabla tr.prob{background:#FDFAF4}
.ea-tabla td b{display:block}
.ea-tabla td span{display:block;font-size:11px;color:#8A959D;margin-top:2px}
.ea-n{color:#9AA5AD;font-variant-numeric:tabular-nums;font-size:11px}
.ea-mas{font-size:11.5px;color:#78868F;padding-top:9px}
.ea-regla{display:flex;gap:9px;background:#F1F6F3;border:1px solid #D3E3D9;border-radius:10px;padding:12px;margin-top:14px}
.ea-regla svg{color:#1F7A4C;flex:none;margin-top:1px}
.ea-regla span{font-size:12px;color:#3A464E;line-height:1.55}
.ea-p{font-size:12.5px;color:#6B7B85;line-height:1.6;margin:0 0 14px}
.ea-campo{display:block;margin-bottom:12px}
.ea-campo span{display:block;font-size:11px;font-weight:650;color:#516069;margin-bottom:5px}
.ea-campo input,.ea-campo select,.ea-campo textarea{width:100%;box-sizing:border-box;border:1px solid #D9E1E5;border-radius:9px;padding:10px;font-size:13px;font-family:inherit;background:#fff}
.ea-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ea-conf{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.ea-conf>div{background:#F5F8F9;border-radius:10px;padding:11px;border-left:3px solid #C3CED5;min-width:0}
.ea-conf>div.ok{border-left-color:#1C7A50}.ea-conf>div.ok b{color:#17623F}
.ea-conf>div.in{border-left-color:#2A5FA6}.ea-conf>div.in b{color:#2A5FA6}
.ea-conf>div.ab{border-left-color:#A83E3E}.ea-conf>div.ab b{color:#A83E3E}
.ea-conf span{display:block;font-size:11px;color:#6B7B85}
.ea-conf b{display:block;font-size:17px;margin:3px 0 2px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ea-conf small{display:block;font-size:11px;color:#84919B;line-height:1.4}
.ea-ecu{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.ea-ecu>div{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;background:#F1F8F4;border:1px solid #D5E7DC;border-radius:10px;padding:9px 12px;font-size:12px;color:#3A464E}
.ea-ecu>div.no{background:#FBECEC;border-color:#F2D4D4}
.ea-ecu b{font-size:16px;font-variant-numeric:tabular-nums;color:#17232C}
.ea-ecu em{font-style:normal;color:#84919B;font-weight:700}
.ea-motivos{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.ea-motivos span{font-size:12px;color:#3A464E;background:#F5F8F9;border-radius:8px;padding:7px 10px;line-height:1.45}
.ea-motivos b{font-variant-numeric:tabular-nums;margin-right:3px}
.ea-motivos em{font-style:normal;color:#6B7B85}
.ea-error{display:flex;gap:8px;align-items:flex-start;background:#FBECEC;border:1px solid #F2D4D4;color:#A83E3E;border-radius:9px;padding:10px;margin-top:12px;font-size:12.5px;line-height:1.45}
.ea-error svg{flex:none;margin-top:1px}
@media(max-width:900px){.ea-dos,.ea-conf{grid-template-columns:1fr}}
`}</style>;
}
