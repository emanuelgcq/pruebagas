import React, { useMemo, useState } from "react";
import {
  LayoutDashboard, FileText, History, ShieldCheck, AlertTriangle, CheckCircle2, Receipt, Search, Printer, Download,
  Lock, Route, FileSpreadsheet, Truck, Inbox, Wallet,
} from "lucide-react";
import {
  LOGO_GASLARA, EMPRESA, HOY, PERIODO, CDTS, ESTADOS_SOLICITUD, bs, num, fecha, fechaCorta, fechaLarga,
  diasEntre, esFechaPeriodo, finDeCiclo, usr, cpt, cdtOf, comunaOf, estadoSolicitud, motivoNoEntrega, kgDeSolicitud, descargar,
} from "./datos.jsx";
import {
  ESTADOS_AD, estadoAD, adPlanificada, adCerrada, tipoADInfo, personasDeAD, marcaDe, cuadreJornada, siguienteAccionAD,
} from "./flujo.js";
import { KgL, UnidadesStyles, kgYL } from "./Unidades.jsx";
import { VisorDocumento, archivoDocumento, origenFactura, origenBoleta, clienteFactura } from "./Documentos.jsx";

/* ═══════════════════════════════════════════════════════════════════
   CENTRO DE GESTIÓN · la cara ejecutiva. Sólo consulta: no registra nada.
   Todas sus cifras salen de `props.cifras` (la misma función que leen el panel, el cierre,
   los saldos, Distribución, el portal y la portada) y sus reportes se arman con los datos
   vivos del sistema. Aquí no hay fórmulas propias: si una cifra cambia en otra pantalla,
   cambia aquí igual.
   ═══════════════════════════════════════════════════════════════════ */

const MM = String(PERIODO.mes + 1).padStart(2, "0");
const CODIGO_MES = `${MM}${String(PERIODO.anio).slice(-2)}`;
const CODIGO_DIA = `${String(HOY.getDate()).padStart(2, "0")}${String(HOY.getMonth() + 1).padStart(2, "0")}${String(HOY.getFullYear()).slice(-2)}`;

/* Dos conteos que usan el tablero y los reportes: uno solo para ambos. */
const reclamosAbiertos = (reclamos = []) => reclamos.filter((r) => r.estado !== "RESUELTO");
const boletasDelPeriodo = (boletas = []) => boletas.filter((b) => b.fecha instanceof Date && esFechaPeriodo(b.fecha));

export default function CentroGestion(props) {
  const [view, setView] = useState("ejecutivo");
  const [visor, setVisor] = useState(null);
  const nav = [["ejecutivo", "Dashboard ejecutivo", LayoutDashboard], ["documentos", "Centro de reportes", FileText], ["auditoria", "Auditoría global", History], ["roles", "Roles y permisos", ShieldCheck]];
  const botones = nav.map(([id, l, I]) => <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}><I size={16}/>{l}</button>);
  return <>
    <div className="cg"><Styles/><UnidadesStyles/>
      <aside>
        <div className="cg-brand"><img src={LOGO_GASLARA} alt="GasLara"/><div><b>Centro de gestión</b><span>{EMPRESA.nombre}</span></div></div>
        <p>Vista ejecutiva de sólo consulta. Reúne lo que ocurre en el Portal, Comercialización, Distribución y la planta con las mismas cifras que ven esas pantallas.</p>
        <nav>{botones}</nav>
        <div className="cg-note"><Lock size={14}/><span>Datos de demostración<br/><b>{PERIODO.label}</b></span></div>
      </aside>
      <main>
        <header><div><span>VISIÓN CONSOLIDADA</span><h1>{nav.find((x) => x[0] === view)[1]}</h1></div><div className="cg-date">{fechaLarga(HOY)}</div></header>
        {/* Bajo 1000 px la barra lateral se esconde: la navegación pasa a estas pestañas. */}
        <nav className="cg-tabs">{botones}</nav>
        {view === "ejecutivo" && <Ejecutivo {...props}/>}
        {view === "documentos" && <Reportes {...props} onVer={(doc, contexto) => setVisor({ doc, contexto })}/>}
        {view === "auditoria" && <Auditoria bitacora={props.bitacora}/>}
        {view === "roles" && <Roles/>}
      </main>
    </div>
    {/* Fuera de la grilla a propósito: al imprimir, el visor oculta todo lo que no lo contiene. */}
    {visor && <VisorDocumento doc={visor.doc} contexto={visor.contexto || {}} onClose={() => setVisor(null)}/>}
  </>;
}

/* ═══════════  DASHBOARD EJECUTIVO  ═══════════ */

function Ejecutivo({ cifras, reclamos = [], boletas = [], disponibles = {} }) {
  const d = cifras.dinero, g = cifras.glp, ad = cifras.ad, rp = cifras.replanificacion, so = cifras.solicitudes;
  const recAbiertos = reclamosAbiertos(reclamos).length;
  const adIncidencia = ad.porEstado.INCIDENCIA || 0;
  const incidencias = adIncidencia + recAbiertos;
  const listasParaCerrar = ad.porEstado.EN_PUNTO || 0;
  const plazo = fecha(finDeCiclo(HOY));
  // Los cuatro componentes del dinero en poder de la empresa; el total también viene de cifras.
  const poder = [
    ["Pendiente por despachar", d.pendienteDespacho.bs, `${num(d.pendienteDespacho.n)} pedidos pagados · ${kgYL(d.pendienteDespacho.kg)}`, "cg-c1"],
    ["Servicios por prestar", d.serviciosPorPrestar.bs, `${num(d.serviciosPorPrestar.n)} servicios pagados sin culminar`, "cg-c2"],
    ["Por completar · recibido", d.porCompletar.recibido, `${num(d.porCompletar.n)} pedidos · faltan Bs ${bs(d.porCompletar.faltante)}`, "cg-c3"],
    ["Saldo a favor", d.saldoFavor.bs, `${num(d.saldoFavor.usuarios)} usuarios · se descuenta solo`, "cg-c4"],
  ];
  const pct = (v) => (d.enPoderDeLaEmpresa > 0 ? Math.max(0, (v / d.enPoderDeLaEmpresa) * 100) : 0);
  const glp = [
    ["Inventario físico", g.fisico, "En los tanques de los CDT"],
    ["Comprometido", g.comprometido, "Pagado y sin despachar: sigue en el CDT"],
    ["Disponible real", g.disponible, "Físico menos comprometido"],
    ["Llenado por cerrar", g.llenadoPorCerrar, "Ya en bombonas de AD sin cerrar: sale al cerrar el AD"],
  ];
  const statsAD = [
    ["Planificadas", ad.planificadas, `${num(ad.especiales)} especiales por usuario`],
    ["Activas", ad.activas, "sin cerrar"],
    ["En jornada", ad.enJornada, "recolección, planta o punto"],
    ["Cerradas", ad.cerradas, "facturadas al cierre"],
    ["Entregadas", ad.entregadas, "pedidos devueltos llenos"],
    ["Por planificar", ad.porPlanificar, `comunidades · ${num(ad.personasPorPlanificar)} personas`],
  ];
  const alertas = [
    { n: rp.n, t: `${num(rp.n)} pedidos por replanificar`, s: `${num(rp.prioridad)} con prioridad por falla de la empresa. Distribución los atiende en un AD especial por usuario antes del ${plazo}; si vence el plazo, lo pagado pasa a saldo a favor.` },
    { n: ad.porPlanificar, t: `${num(ad.porPlanificar)} comunidades con pedidos pagados sin AD`, s: `${num(ad.personasPorPlanificar)} personas pagadas esperan su jornada. A un AD sólo entran pedidos pagados completos.` },
    { n: d.porCompletar.n, t: `${num(d.porCompletar.n)} pedidos por completar`, s: `Faltan Bs ${bs(d.porCompletar.faltante)}. Entran a una jornada cuando cubren la diferencia; si vence el ciclo, lo pagado pasa a saldo a favor.` },
    { n: listasParaCerrar, t: `${num(listasParaCerrar)} AD devueltas al punto, listas para cerrar`, s: "Al cerrarlas se factura al precio del día de salida, se emite la BOP y sale el inventario." },
    { n: incidencias, t: `${num(incidencias)} incidencias abiertas`, s: `${num(adIncidencia)} AD con incidencia · ${num(recAbiertos)} reclamos sin resolver.` },
    { n: 0, t: "Trazabilidad punta a punta", s: "Solicitud → pago verificado por la API → AD → recolección → llenado → devolución al punto → cierre (factura, BOP y salida de inventario). La responsabilidad de la empresa termina en el punto." },
  ];

  return <div className="cg-page">
    <div className="cg-kpis">
      <K l="Facturado del período" v={`Bs ${bs(d.facturadoPeriodo.total)}`} s={`${num(d.facturadoPeriodo.docs)} documentos · ${PERIODO.label} · libro de ventas`}/>
      <K l="Pendiente por despachar" v={`Bs ${bs(d.pendienteDespacho.bs)}`} s={`${num(d.pendienteDespacho.n)} pedidos pagados · ${kgYL(d.pendienteDespacho.kg)}`}/>
      <K l="Por completar" v={`Bs ${bs(d.porCompletar.recibido)}`} s={`recibido en ${num(d.porCompletar.n)} pedidos · faltan Bs ${bs(d.porCompletar.faltante)}`}/>
      <K l="Saldo a favor" v={`Bs ${bs(d.saldoFavor.bs)}`} s={`${num(d.saldoFavor.usuarios)} usuarios · se descuenta en su próximo pedido`}/>
    </div>
    <div className="cg-kpis">
      <K l="GLP disponible" v={<KgL kg={g.disponible}/>} s={`${kgYL(g.comprometido)} comprometidos`}/>
      <K l="AD en jornada" v={num(ad.enJornada)} s={`${num(ad.activas)} activas · ${num(ad.cerradas)} cerradas`}/>
      <K l="Por replanificar" v={num(rp.n)} s={`${num(rp.prioridad)} con prioridad · plazo ${plazo}`}/>
      <K l="Incidencias abiertas" v={num(incidencias)} s={`${num(adIncidencia)} AD con incidencia · ${num(recAbiertos)} reclamos`}/>
    </div>

    <div className="cg-grid2">
      <Card t="Dinero en poder de la empresa" s="Dinero de los usuarios que la empresa todavía debe despachar, prestar o descontar. No es ingreso: el ingreso es lo facturado.">
        <div className="cg-poder"><b>Bs {bs(d.enPoderDeLaEmpresa)}</b><span>pendiente por despachar + servicios por prestar + por completar + saldo a favor</span></div>
        <div className="cg-stack">{poder.map(([l, v, , c]) => <i key={l} className={c} style={{ width: `${pct(v)}%` }} title={`${l} · Bs ${bs(v)}`}/>)}</div>
        <div className="cg-legend">{poder.map(([l, v, s, c]) => <div key={l}><i className={c}/><span>{l}<small>{s}</small></span><b>Bs {bs(v)}</b></div>)}</div>
      </Card>
      <Card t="Inventario GLP" s="El pago compromete el GLP; sólo el cierre del AD lo saca del inventario físico.">
        <div className="cg-bars">{glp.map(([l, v, s]) => <div key={l}><div><span>{l}<small>{s}</small></span><KgL kg={v}/></div><i><em style={{ width: `${g.fisico > 0 ? Math.min(100, (v / g.fisico) * 100) : 0}%` }}/></i></div>)}</div>
        <div className="cg-sub">Disponible por CDT</div>
        <div className="cg-cdts">{CDTS.map((c) => <div key={c.id}><span>{c.corto}</span><KgL kg={Number(disponibles[c.id] || 0)}/></div>)}</div>
      </Card>
    </div>

    <div className="cg-grid3">
      <Card t="Atenciones de distribución (AD)" s="Cada AD pasa por los momentos de la jornada hasta su cierre.">
        <div className="cg-stats">{statsAD.map(([l, v, s]) => <div key={l}><b>{num(v)}</b><span>{l}</span><small>{s}</small></div>)}</div>
        <div className="cg-chips">{ESTADOS_AD.filter((e) => ad.porEstado[e.id]).map((e) => <span key={e.id} className={e.tono}>{e.nombre}<b>{num(ad.porEstado[e.id])}</b></span>)}</div>
      </Card>
      <Card t="Pedidos por estado" s={`${num(so.total)} solicitudes · la API resuelve el pago, nadie concilia a mano`}>
        <Barras filas={ESTADOS_SOLICITUD.map((e) => [e.admin, so.porEstado[e.key] || 0])}/>
      </Card>
      <Card t="Documentos del período" s={`Respaldo documental de ${PERIODO.label.toLowerCase()}`}>
        <div className="cg-minidocs">{[["Facturas", d.facturadoPeriodo.docs], ["BOP", boletasDelPeriodo(boletas).length], ["AD planificadas", ad.planificadas], ["Solicitudes", so.total]].map(([l, v]) => <div key={l}><FileText size={14}/><span>{l}</span><b>{num(v)}</b></div>)}</div>
      </Card>
    </div>

    <section className="cg-card"><div className="cg-title"><div><h2>Atención gerencial inmediata</h2><p>Lo que pide una decisión o un seguimiento hoy, con las cifras del sistema.</p></div></div>
      <div className="cg-alerts">{alertas.map((a) => <div key={a.t} className={a.n > 0 ? "" : "ok"}>{a.n > 0 ? <AlertTriangle size={17}/> : <CheckCircle2 size={17}/>}<div><b>{a.t}</b><span>{a.s}</span></div></div>)}</div>
    </section>
  </div>;
}

/* ═══════════  CENTRO DE REPORTES  ═══════════
   Cada reporte es un documento del visor (`Documentos.jsx`): se ve, se imprime y se exporta
   a CSV desde las mismas filas. Sin búsqueda se muestran los reportes y los documentos más
   recientes; la búsqueda recorre todas las facturas, BOP y AD del sistema. */

const col = (t, tipo = "texto") => ({ t, tipo });
const RESULTADO_AD = { ENTREGADA: "Devuelta llena · facturada", NO_RECOGIDA: "No se recogió", NO_LLENADA: "Volvió vacía", SALIO_POR_TARIFA: "Salió por tarifa nueva" };
// Primero lo que pide atención (incidencias), luego lo más avanzado de la jornada y al final lo cerrado.
const rangoAD = (r) => (estadoAD(r.estadoRuta).id === "INCIDENCIA" ? 9 : adCerrada(r) ? -1 : estadoAD(r.estadoRuta).momento);
const ordenarAD = (a, b) => rangoAD(b) - rangoAD(a) || (b.cerradaEn || 0) - (a.cerradaEn || 0) || String(a.ad).localeCompare(String(b.ad));

function libroVentas(facturas, cifras) {
  const t = cifras.dinero.facturadoPeriodo;
  const fs = facturas.filter((f) => f.fecha instanceof Date && esFechaPeriodo(f.fecha))
    .sort((a, b) => a.fecha - b.fecha || String(a.serie).localeCompare(String(b.serie)));
  return { tipo: "reporte", data: {
    modulo: "Comercialización", titulo: `Libro de ventas · ${PERIODO.label}`, codigo: `LV-${CODIGO_MES}`, archivo: `libro-ventas-${PERIODO.anio}-${MM}`, horizontal: true,
    subtitulo: "Facturas del período: cierre de AD, servicios de la O.A.U., talonario y ventas sin contrato.",
    resumen: [{ l: "Documentos", v: num(t.docs) }, { l: "Base imponible", v: `Bs ${bs(t.base)}` }, { l: "IVA", v: `Bs ${bs(t.iva)}` }, { l: "Total facturado", v: `Bs ${bs(t.total)}` }],
    columnas: [col("Fecha", "fecha"), col("Factura"), col("Control"), col("Cliente"), col("RIF / C.I."), col("Concepto"), col("Cant.", "entero"),
      col("Base Bs", "bs"), col("IVA Bs", "bs"), col("Total Bs", "bs"), col("Origen")],
    filas: fs.map((f) => {
      const c = clienteFactura(f);
      return [f.fecha, f.serie, f.control, c.nombre, c.doc, cpt(f.concepto).nombre, Number(f.cantidad || 0),
        Number(f.base || 0), Number(f.iva || 0), Number(f.total || 0), origenFactura(f).corto];
    }),
    // Los totales son los del libro que muestra el tablero: la misma cifra, no otra suma.
    totales: ["TOTALES", null, null, null, null, null, null, t.base, t.iva, t.total, null],
  } };
}

function libroBOP(boletas) {
  const bops = boletasDelPeriodo(boletas).sort((a, b) => a.fecha - b.fecha || String(a.id).localeCompare(String(b.id)));
  return { tipo: "reporte", data: {
    modulo: "Comercialización", titulo: `Boletas de operación · ${PERIODO.label}`, codigo: `BOP-${CODIGO_MES}`, archivo: `boletas-${PERIODO.anio}-${MM}`, horizontal: true,
    subtitulo: "Toda salida física deja su BOP: la del cierre del AD, la del servicio culminado y la de la venta sin contrato.",
    nota: "La salida física total del período, con las ventas de talonario, está en el acta de cierre.",
    columnas: [col("Fecha", "fecha"), col("BOP"), col("Origen"), col("Solicitud / factura"), col("Usuario"), col("Concepto"), col("Cant.", "entero"), col("Salida GLP", "kg"), col("CDT")],
    filas: bops.map((b) => [b.fecha, b.id, origenBoleta(b).corto, b.sol || b.factura || "—", usr(b.usuario).nombre, cpt(b.concepto).nombre,
      Number(b.cantidad || 0), Number(b.kg || 0), cdtOf(b.cdt).corto]),
    totales: null,
  } };
}

function reporteSaldos(saldos, cifras) {
  const s = cifras.dinero.saldoFavor;
  const filas = Object.entries(saldos).filter(([, v]) => v > 0.009).sort((a, b) => b[1] - a[1]).map(([id, v]) => {
    const u = usr(id);
    return [id, u.nombre, u.doc, u.comuna ? comunaOf(u.comuna).nombre : (u.comunidad || u.sector || "—"), v];
  });
  return { tipo: "reporte", data: {
    modulo: "Comercialización", titulo: "Saldos a favor", codigo: `SAF-${CODIGO_DIA}`, archivo: `saldos-a-favor-${CODIGO_DIA}`,
    subtitulo: `Al ${fecha(HOY)} · el menor saldo posible: casi siempre nace de un error del usuario.`,
    resumen: [{ l: "Usuarios con saldo", v: num(s.usuarios) }, { l: "Saldo a favor", v: `Bs ${bs(s.bs)}` }],
    nota: "El saldo es nominal: se descuenta solo en el próximo pedido y para cubrir diferencias de tarifa. No hay reembolsos en efectivo.",
    columnas: [col("Código"), col("Usuario"), col("Documento"), col("Comuna"), col("Saldo Bs", "bs")],
    filas, totales: ["TOTAL", null, null, null, s.bs],
  } };
}

function libroAD(ads, solicitudes, cifras) {
  const a = cifras.ad;
  return { tipo: "reporte", data: {
    modulo: "Distribución", titulo: `Libro de AD · ${fecha(HOY)}`, codigo: `LAD-${CODIGO_DIA}`, archivo: `libro-ad-${CODIGO_DIA}`, horizontal: true,
    subtitulo: "Cada AD con su momento: planificada → en recolección → en planta → devuelta al punto → cerrada.",
    resumen: [
      { l: "AD planificadas", v: num(a.planificadas), s: `${num(a.especiales)} especiales por usuario` },
      { l: "Activas", v: num(a.activas), s: `${num(a.enJornada)} en jornada` },
      { l: "Cerradas", v: num(a.cerradas) },
      { l: "Convocadas en AD activas", v: num(a.convocadas), s: kgYL(a.kgConvocado) },
    ],
    columnas: [col("AD"), col("Tipo"), col("Comuna"), col("Comunidad / paradas"), col("Jornada", "fecha"), col("Unidad"), col("Conductor"), col("Estado"),
      col("Convocadas", "entero"), col("Recogidas", "entero"), col("Llenadas", "entero"), col("Entregadas", "entero"), col("A replanificación", "entero"),
      col("GLP convocado / entregado", "kg")],
    filas: [...ads].sort(ordenarAD).map((r) => {
      const c = cuadreJornada(r, solicitudes);
      const cerrada = adCerrada(r);
      return [String(r.ad), tipoADInfo(r).nombre, r.comuna, r.comunidad, r.fechaJornada || r.fechaPlan, r.unidad, r.conductor, estadoAD(r.estadoRuta).nombre,
        c.convocadas, c.recogidas ?? "—", c.llenadas ?? "—", cerrada ? c.entregadas : "—", cerrada ? c.replanificadas : "—", cerrada ? c.kgSalida : c.kgConvocado];
    }),
    totales: null,
  } };
}

/** Hoja de un AD: cada persona con lo que pasó en la recolección, en planta y al cierre. */
function hojaAD(r, solicitudes) {
  const c = cuadreJornada(r, solicitudes);
  const cerrada = adCerrada(r);
  const j = r.jornada || {};
  const sig = siguienteAccionAD(r);
  const motivo = (m) => motivoNoEntrega(m).nombre;
  let salieron = 0;
  // personasDeAD también trae a quien tiene la ruta de su comunidad pero nunca entró al AD (no
  // estaba pagado completo al planificarse): la hoja muestra sólo a quien estuvo convocado.
  const todas = personasDeAD(r, solicitudes);
  const convocadas = todas.filter((s) => (s.estado === "EN_AD" && s.rutaId === r.id) || (s.historialAD || []).some((x) => x.rutaId === r.id));
  const filas = convocadas.map((s, i) => {
    const u = usr(s.usuario);
    const mk = marcaDe(r, s.id);
    const h = [...(s.historialAD || [])].reverse().find((x) => x.rutaId === r.id);
    // Quien salió por la tarifa nueva dejó el AD antes de la salida: no tiene recolección.
    const salio = h?.resultado === "SALIO_POR_TARIFA";
    if (salio) salieron += 1;
    const rec = salio || !j.recoleccion ? "—" : mk.recogida === false ? `No · ${motivo(mk.motivo)}` : "Sí";
    const lle = salio || !j.llenado || mk.recogida === false ? "—" : mk.llenada === false ? `No · ${motivo(mk.motivo)}` : "Sí";
    return [i + 1, s.id, u.nombre, u.doc, cpt(s.concepto).corto, kgDeSolicitud(s), rec, lle,
      h ? RESULTADO_AD[h.resultado] || h.resultado : estadoAD(r.estadoRuta).nombre, estadoSolicitud(s.estado).admin];
  });
  const resumen = cerrada
    ? [{ l: "Convocadas", v: num(c.convocadas) }, { l: "Entregadas", v: num(c.entregadas), s: kgYL(c.kgSalida) }, { l: "A replanificación", v: num(c.replanificadas) }, { l: "Abonadas", v: num(c.abonadas) }]
    : [{ l: "Convocadas", v: num(c.convocadas), s: kgYL(c.kgConvocado) }, { l: "Recogidas", v: c.recogidas == null ? "—" : num(c.recogidas) },
      { l: "Llenadas", v: c.llenadas == null ? "—" : num(c.llenadas) }, { l: "Devueltas al punto", v: c.devueltas == null ? "—" : num(c.devueltas) }];
  // La lista trae a todos los que pasaron por el AD; quien salió por la tarifa no cuenta como convocado.
  const fuera = (salieron ? ` ${num(salieron)} pedido(s) salieron por la tarifa nueva antes de la salida y quedaron por completar.` : "")
    + (todas.length > convocadas.length ? ` ${num(todas.length - convocadas.length)} pedido(s) de la comunidad tienen esta ruta pero no entraron al AD: no estaban pagados completos.` : "");
  const nota = cerrada
    ? `Cerrada el ${fecha(r.cerradaEn)}${r.horaCierre ? ` a las ${r.horaCierre}` : ""}${r.recepcion?.receptor ? ` · recibió en el punto ${r.recepcion.receptor}` : ""} · facturado Bs ${bs(c.facturado)}. La responsabilidad de la empresa terminó con la devolución al punto.${fuera}`
    : `${estadoAD(r.estadoRuta).nombre}${sig ? ` · siguiente paso: ${sig.nombre.toLowerCase()}` : ""}. Toda bombona recogida vuelve al mismo punto: llena, o vacía si no se pudo llenar.${fuera}`;
  return { tipo: "reporte", data: {
    modulo: "Distribución", titulo: `AD ${r.ad} · ${r.comunidad || r.comuna || ""}`, codigo: `AD-${r.ad}`, archivo: `ad-${r.ad}`, horizontal: true,
    subtitulo: [tipoADInfo(r).nombre, r.comuna, `jornada ${fecha(r.fechaJornada || r.fechaPlan)}`, r.unidad, r.conductor].filter(Boolean).join(" · "),
    resumen, nota,
    columnas: [col("#", "entero"), col("Solicitud"), col("Persona"), col("Cédula"), col("Pedido"), col("GLP", "kg"), col("Recolección"), col("Planta"),
      col("Resultado en este AD"), col("Estado actual")],
    filas, totales: null,
  } };
}

function reporteBandeja(bandeja, cifras) {
  const rp = cifras.replanificacion;
  return { tipo: "reporte", data: {
    modulo: "Distribución", titulo: "Bandeja de replanificación", codigo: `REP-${CODIGO_DIA}`, archivo: `replanificacion-${CODIGO_DIA}`, horizontal: true,
    subtitulo: "Pedidos con un problema en la jornada: siguen vivos y se atienden en un AD especial por usuario.",
    resumen: [{ l: "Por replanificar", v: num(rp.n) }, { l: "Con prioridad", v: num(rp.prioridad), s: "falla imputable a la empresa" }, { l: "Plazo del ciclo", v: fecha(finDeCiclo(HOY)) }],
    nota: "Sólo pasa a saldo a favor si el usuario desistió, si Distribución decide no replanificar o si vence el plazo del ciclo.",
    columnas: [col("Solicitud"), col("Persona"), col("Cédula"), col("Pedido"), col("Motivo"), col("Momento"), col("Imputable a"), col("AD de origen"),
      col("Desde", "fecha"), col("Plazo", "fecha"), col("Días al plazo", "entero"), col("Prioridad")],
    filas: bandeja.map((s) => {
      const u = usr(s.usuario), p = s.problema || {};
      return [s.id, u.nombre, u.doc, cpt(s.concepto).corto, s.motivoProblema?.nombre || p.nombre || "—", p.momento === "PLANTA" ? "Planta" : "Recolección",
        p.imputable === "EMPRESA" ? "Empresa" : "Usuario", p.adOrigen || "—", p.fecha, s.plazo, s.diasAlPlazo, s.prioridad ? "Sí" : "—"];
    }),
    totales: null,
  } };
}

function reporteIncidencias(ads, reclamos, cifras) {
  const conIncidencia = ads.filter((r) => estadoAD(r.estadoRuta).id === "INCIDENCIA");
  const abiertos = reclamosAbiertos(reclamos);
  return { tipo: "reporte", data: {
    modulo: "Centro de gestión", titulo: "Incidencias abiertas", codigo: `INC-${CODIGO_DIA}`, archivo: `incidencias-${CODIGO_DIA}`,
    subtitulo: `Al ${fecha(HOY)} · AD con incidencia y reclamos sin resolver.`,
    resumen: [{ l: "AD con incidencia", v: num(cifras.ad.porEstado.INCIDENCIA || 0) }, { l: "Reclamos abiertos", v: num(abiertos.length) }],
    columnas: [col("Tipo"), col("Referencia"), col("Fecha", "fecha"), col("Detalle"), col("Estado")],
    filas: [
      ...conIncidencia.map((r) => ["AD con incidencia", String(r.ad), r.incidenciaEn || r.fechaSalida || r.fechaPlan,
        `${r.comunidad || r.comuna || ""} · ${r.obsIncidencia || r.incidenciaTipo || "sin detalle"}`, "Abierta"]),
      ...abiertos.map((x) => ["Reclamo", x.id, x.fecha, `${usr(x.usuario).nombre} · ${x.asunto}`,
        `${x.estado === "EN_PROCESO" ? "En proceso" : "Recibido"} · prioridad ${String(x.prioridad || "—").toLowerCase()}`]),
    ],
    totales: null,
  } };
}

function reporteBitacora(eventos, alcance) {
  return { tipo: "reporte", data: {
    modulo: "Centro de gestión", titulo: "Bitácora del sistema", codigo: `BIT-${CODIGO_DIA}`, archivo: `bitacora-${CODIGO_DIA}`, horizontal: true,
    subtitulo: `${alcance} · reglas de pago, jornadas, cierres, replanificaciones, saldos y reclamos.`,
    columnas: [col("Fecha", "fecha"), col("Hora"), col("Módulo"), col("Evento"), col("Referencia"), col("Detalle")],
    filas: eventos.map((e) => [e.fecha, e.hora, e.modulo, e.evento, e.referencia, e.detalle]),
    totales: null,
  } };
}

function bajar(item) {
  const a = archivoDocumento(item.doc(), item.contexto || {});
  descargar(a.nombre, a.contenido);
}

function Reportes(props) {
  const { cifras, facturas = [], boletas = [], rutasDistribucion = [], solicitudes = [], bandeja = [], reclamos = [], saldos = {}, bitacora = [],
    existencias = {}, compromisos = {}, disponibles = {}, periodoCerrado = false, onVer } = props;
  const [q, setQ] = useState("");
  const ads = useMemo(() => rutasDistribucion.filter(adPlanificada), [rutasDistribucion]);
  const d = cifras.dinero, a = cifras.ad;
  const contextoActa = { facturas, solicitudes, existencias, compromisos, disponibles, cdtF: "TODOS", alcance: "Consolidado", periodoCerrado };

  const informes = [
    { grupo: "Comercialización", icono: FileSpreadsheet, nombre: `Acta de cierre · ${PERIODO.label}`, codigo: `ACT-${CODIGO_MES}`,
      detalle: periodoCerrado ? "Período cerrado" : "Preliminar · el período sigue abierto", doc: () => ({ tipo: "acta" }), contexto: contextoActa },
    { grupo: "Comercialización", icono: Receipt, nombre: `Libro de ventas · ${PERIODO.label}`, codigo: `LV-${CODIGO_MES}`,
      detalle: `${num(d.facturadoPeriodo.docs)} documentos · Bs ${bs(d.facturadoPeriodo.total)}`, doc: () => libroVentas(facturas, cifras) },
    { grupo: "Comercialización", icono: FileText, nombre: `Boletas de operación · ${PERIODO.label}`, codigo: `BOP-${CODIGO_MES}`,
      detalle: `${num(boletasDelPeriodo(boletas).length)} BOP del período`, doc: () => libroBOP(boletas) },
    { grupo: "Comercialización", icono: Wallet, nombre: "Saldos a favor", codigo: `SAF-${CODIGO_DIA}`,
      detalle: `${num(d.saldoFavor.usuarios)} usuarios · Bs ${bs(d.saldoFavor.bs)}`, doc: () => reporteSaldos(saldos, cifras) },
    { grupo: "Distribución", icono: Route, nombre: `Libro de AD · ${fecha(HOY)}`, codigo: `LAD-${CODIGO_DIA}`,
      detalle: `${num(a.planificadas)} AD · ${num(a.activas)} activas · ${num(a.cerradas)} cerradas`, doc: () => libroAD(ads, solicitudes, cifras) },
    { grupo: "Distribución", icono: Inbox, nombre: "Bandeja de replanificación", codigo: `REP-${CODIGO_DIA}`,
      detalle: `${num(cifras.replanificacion.n)} pedidos · ${num(cifras.replanificacion.prioridad)} con prioridad`, doc: () => reporteBandeja(bandeja, cifras) },
    { grupo: "Centro de gestión", icono: AlertTriangle, nombre: "Incidencias abiertas", codigo: `INC-${CODIGO_DIA}`,
      detalle: `${num(a.porEstado.INCIDENCIA || 0)} AD · ${num(reclamosAbiertos(reclamos).length)} reclamos`, doc: () => reporteIncidencias(ads, reclamos, cifras) },
    { grupo: "Centro de gestión", icono: History, nombre: "Bitácora del sistema", codigo: `BIT-${CODIGO_DIA}`,
      detalle: `${num(bitacora.length)} eventos registrados`, doc: () => reporteBitacora(bitacora, "Todo el registro") },
  ];

  const documentos = useMemo(() => [
    ...facturas.map((f) => {
      const c = clienteFactura(f);
      return { grupo: "Facturas", icono: Receipt, nombre: `Factura ${f.serie}`, codigo: f.control || "—", fecha: f.fecha,
        detalle: `${fecha(f.fecha)} · ${c.nombre} · Bs ${bs(f.total)} · ${origenFactura(f).corto}`, busca: `${f.sol || ""} ${f.ad || ""} ${c.doc || ""}`,
        doc: () => ({ tipo: "factura", data: f }) };
    }),
    ...boletas.map((b) => ({ grupo: "Boletas de operación", icono: FileText, nombre: b.id, codigo: origenBoleta(b).corto, fecha: b.fecha,
      detalle: `${fecha(b.fecha)} · ${usr(b.usuario).nombre} · ${cpt(b.concepto).corto}`, busca: `${b.sol || ""} ${b.ad || ""} ${b.factura || ""}`,
      doc: () => ({ tipo: "boleta", data: b }) })),
    ...ads.map((r) => ({ grupo: "Atenciones de distribución (AD)", icono: Truck, nombre: `AD ${r.ad} · ${r.comunidad || r.comuna || ""}`, codigo: estadoAD(r.estadoRuta).nombre, ruta: r,
      detalle: `${tipoADInfo(r).nombre} · jornada ${fecha(r.fechaJornada || r.fechaPlan)} · ${r.unidad || "—"}`, busca: `${r.id} ${r.comuna || ""} ${r.conductor || ""}`,
      doc: () => hojaAD(r, solicitudes) })),
  ], [facturas, boletas, ads, solicitudes]);

  const recientes = useMemo(() => {
    const porFecha = (x, y) => (y.fecha || 0) - (x.fecha || 0);
    return [
      ...documentos.filter((x) => x.grupo === "Facturas").sort(porFecha).slice(0, 4),
      ...documentos.filter((x) => x.grupo === "Boletas de operación").sort(porFecha).slice(0, 4),
      ...documentos.filter((x) => x.ruta).sort((x, y) => ordenarAD(x.ruta, y.ruta)).slice(0, 6),
    ];
  }, [documentos]);

  const qq = q.trim().toLowerCase();
  const coincide = (x) => `${x.grupo} ${x.nombre} ${x.codigo} ${x.detalle} ${x.busca || ""}`.toLowerCase().includes(qq);
  const lista = qq ? [...informes, ...documentos].filter(coincide) : [...informes, ...recientes];
  const visibles = qq ? lista.slice(0, 60) : lista;
  const grupos = [...new Set(visibles.map((x) => x.grupo))];
  const esDocumento = (g) => ["Facturas", "Boletas de operación", "Atenciones de distribución (AD)"].includes(g);

  return <div className="cg-page"><section className="cg-card">
    <div className="cg-title"><div><h2>Centro de documentos y reportes</h2><p>Reportes armados con los datos vivos del sistema. Cada uno se ve e imprime en la misma hoja de la que sale su CSV.</p></div>
      <div className="cg-search"><Search size={14}/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar factura, BOP, AD, solicitud o cliente…"/></div></div>
    {qq && <div className="cg-audit-summary"><span>{num(lista.length)} resultados{lista.length > visibles.length ? ` · se muestran ${num(visibles.length)}` : ""}</span></div>}
    {grupos.map((g) => <div className="cg-docgroup" key={g}><h3>{g}{!qq && esDocumento(g) ? <small> · los más recientes; la búsqueda recorre todos</small> : null}</h3><div>
      {visibles.filter((x) => x.grupo === g).map((x) => {
        const I = x.icono || FileText;
        return <article key={`${x.grupo}-${x.nombre}-${x.codigo}`}><I size={18}/><div><b>{x.nombre}</b><span title={`${x.codigo} · ${x.detalle}`}>{x.codigo} · {x.detalle}</span></div>
          <button onClick={() => onVer(x.doc(), x.contexto)}><Printer size={13}/>Ver / imprimir</button>
          <button onClick={() => bajar(x)}><Download size={13}/>CSV</button></article>;
      })}
    </div></div>)}
    {!visibles.length && <p className="cg-vacio">No hay documentos que coincidan con “{q}”.</p>}
    <div className="cg-rule"><ShieldCheck size={16}/><span><b>Nómina</b> emite sus propios reportes (constancias, prestaciones, vacaciones) desde su módulo: es un backoffice aislado y sus datos no pasan por esta biblioteca.</span></div>
  </section></div>;
}

/* ═══════════  AUDITORÍA GLOBAL  ═══════════
   La bitácora es la del sistema (`props.bitacora`): los eventos que realmente ocurrieron. */

const PERIODOS_AUD = [["HOY", "Hoy"], ["SEMANA", "Últimos 7 días"], ["MES", PERIODO.label], ["TODO", "Todo el registro"]];
const enPeriodo = (f, p) => {
  if (p === "TODO") return true;
  const v = f instanceof Date ? f : new Date(f);
  if (Number.isNaN(v.getTime())) return false;
  if (p === "MES") return esFechaPeriodo(v);
  const dias = diasEntre(v, HOY);
  return p === "HOY" ? dias === 0 : dias >= 0 && dias <= 6;
};

function Auditoria({ bitacora = [] }) {
  const [mod, setMod] = useState("TODOS"), [periodo, setPeriodo] = useState("HOY"), [max, setMax] = useState(80);
  const modulos = useMemo(() => [...new Set(bitacora.map((e) => e.modulo).filter(Boolean))].sort(), [bitacora]);
  const rows = useMemo(() => bitacora.filter((e) => (mod === "TODOS" || e.modulo === mod) && enPeriodo(e.fecha, periodo)), [bitacora, mod, periodo]);
  const etiqueta = PERIODOS_AUD.find((p) => p[0] === periodo)[1];
  const exportar = () => {
    const a = archivoDocumento(reporteBitacora(rows, `${mod === "TODOS" ? "Todos los módulos" : mod} · ${etiqueta}`));
    descargar(a.nombre, a.contenido);
  };
  return <div className="cg-page"><section className="cg-card">
    <div className="cg-title"><div><h2>Actividad del sistema</h2><p>Bitácora transversal con los eventos reales: qué ocurrió, en qué módulo, cuándo y sobre qué documento.</p></div>
      <div className="cg-filters">
        <select value={mod} onChange={(e) => { setMod(e.target.value); setMax(80); }}><option value="TODOS">Todos los módulos</option>{modulos.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <select value={periodo} onChange={(e) => { setPeriodo(e.target.value); setMax(80); }}>{PERIODOS_AUD.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
        <button onClick={exportar} disabled={!rows.length}><Download size={13}/>CSV</button>
      </div></div>
    <div className="cg-audit-summary"><span>{num(rows.length)} eventos</span><span>Período: {etiqueta.toLowerCase()}</span><span>Registro no destructivo · sale de los datos del sistema</span></div>
    {rows.length
      ? <div className="cg-timeline">{rows.slice(0, max).map((e, i) => <div key={`${e.referencia}-${e.evento}-${i}`}><time>{fechaCorta(e.fecha)}<small>{e.hora && e.hora !== "—" ? e.hora : ""}</small></time><i/><div><b>{e.evento}</b><span>{e.modulo} · {e.referencia}{e.detalle ? ` · ${e.detalle}` : ""}</span></div></div>)}</div>
      : <p className="cg-vacio">No hay eventos {mod === "TODOS" ? "" : `de ${mod} `}en este período.</p>}
    {rows.length > max && <button className="cg-mas" onClick={() => setMax((m) => m + 120)}>Mostrar más · quedan {num(rows.length - max)}</button>}
  </section></div>;
}

/* ═══════════  ROLES Y PERMISOS  ═══════════ */

function Roles() {
  const cols = ["Consultar", "Crear", "Modificar", "Aprobar", "Cerrar", "Exportar", "Ver Bs"];
  const roles = [
    ["Ciudadano", "Portal del usuario: pide y paga su bombona, sigue su pedido, descarga su factura y registra reclamos. Ve sólo lo suyo.", [1, 1, 0, 0, 0, 1, 1]],
    ["Coordinador de comuna", "Rol dentro del portal: consulta a los miembros y la jornada de su comuna. No compra ni recibe bombonas por ellos.", [1, 0, 0, 0, 0, 0, 0]],
    ["Comercialización", "Taquilla, padrón, libro de ventas, saldos a favor y cierre del período.", [1, 1, 1, 0, 1, 1, 1]],
    ["Gerencia de Distribución", "Planifica el AD; registra recolección, llenado y devolución; cierra el AD y replanifica.", [1, 1, 1, 0, 1, 1, 0]],
    ["Operador de planta", "Registra las entradas y salidas de gandola.", [1, 1, 0, 0, 0, 0, 0]],
    ["Nómina", "Backoffice aislado: expedientes, novedades, cálculo legal y prestaciones.", [1, 1, 1, 1, 1, 1, 1]],
    ["Gerencia · Centro de gestión", "Consulta: dashboard ejecutivo, reportes, auditoría y roles.", [1, 0, 0, 0, 0, 1, 1]],
  ];
  return <div className="cg-page"><section className="cg-card">
    <div className="cg-title"><div><h2>Matriz de roles y permisos</h2><p>Qué puede hacer cada cara del prototipo y qué información sensible ve.</p></div></div>
    <div className="cg-perms"><table><thead><tr><th>Rol</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{roles.map(([r, alcance, permisos]) => <tr key={r}><td><b>{r}</b><small>{alcance}</small></td>{permisos.map((v, i) => <td key={cols[i]}>{v ? <CheckCircle2 size={15}/> : <span>—</span>}</td>)}</tr>)}</tbody></table></div>
    <div className="cg-rule"><ShieldCheck size={16}/><span><b>Reglas que la matriz no rompe:</b> la API verifica cada pago y aplica la regla automática, así que ningún rol aprueba ni concilia pagos a mano; Comercialización sólo revierte, con motivo, una referencia rechazada por repetida. Distribución ve banco, referencia y fecha de pago para la trazabilidad, pero no importes en bolívares. El conductor y la EPSDC no son usuarios del sistema: Distribución registra lo que ocurre en la jornada. Nómina queda aislada como backoffice.</span></div>
  </section></div>;
}

/* ═══════════  PIEZAS  ═══════════ */

function K({ l, v, s }) { return <div><span>{l}</span><b>{v}</b><small>{s}</small></div>; }
function Card({ t, s, children }) { return <section className="cg-card"><div className="cg-title"><div><h2>{t}</h2><p>{s}</p></div></div>{children}</section>; }
function Barras({ filas }) {
  const m = Math.max(...filas.map((x) => x[1]), 1);
  return <div className="cg-bars">{filas.map(([l, v]) => <div key={l}><div><span>{l}</span><b>{num(v)}</b></div><i><em style={{ width: `${Math.min(100, (v / m) * 100)}%` }}/></i></div>)}</div>;
}

function Styles(){return <style>{`
.cg{min-height:100vh;background:#f4f7f8;color:#17232c;font-family:Inter,Segoe UI,system-ui,sans-serif;display:grid;grid-template-columns:238px 1fr}
.cg>aside{background:#111b22;color:white;padding:20px 15px;display:flex;flex-direction:column;gap:16px;position:sticky;top:46px;height:calc(100vh - 46px);align-self:start}
.cg-brand{display:flex;gap:9px;align-items:center}.cg-brand img{width:64px;background:white;border-radius:8px;padding:4px}.cg-brand b,.cg-brand span{display:block}.cg-brand b{font-size:16px}.cg-brand span{font-size:10.5px;color:#9aaab5}
.cg>aside>p{font-size:12px;color:#aebbc4;line-height:1.55;margin:0}
.cg>aside nav{display:flex;flex-direction:column;gap:6px}
.cg>aside nav button,.cg-tabs button{border:0;background:transparent;color:#bdc8cf;border-radius:9px;padding:10px;display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;cursor:pointer;text-align:left}
.cg>aside nav button.on{background:#eaf4ee;color:#174b32}
.cg-note{margin-top:auto;border-top:1px solid #293740;padding-top:12px;display:flex;gap:7px;color:#a9b6be;font-size:11px;line-height:1.45}
.cg>main{padding:22px 24px;min-width:0}
.cg>main>header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.cg>main>header span{font-size:10.5px;letter-spacing:.08em;color:#27704c;font-weight:800}.cg>main>header h1{font-size:24px;margin:4px 0}
.cg-date{font-size:12px;border:1px solid #dce4e8;background:white;padding:8px 10px;border-radius:9px;white-space:nowrap}
.cg-tabs{display:none;gap:4px;overflow-x:auto;margin:-6px 0 14px;padding:4px;background:#e9eef0;border-radius:11px;scrollbar-width:none}
.cg-tabs button{color:#50606a;white-space:nowrap;flex:0 0 auto}.cg-tabs button.on{background:#fff;color:#174b32;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.cg-page{display:flex;flex-direction:column;gap:13px}
.cg-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
.cg-kpis>div,.cg-card{background:white;border:1px solid #e0e6ea;border-radius:14px}
.cg-kpis>div{padding:13px}.cg-kpis span,.cg-kpis small{display:block;font-size:11px;color:#75828b}.cg-kpis small{line-height:1.45}
.cg-kpis b{display:block;font-size:20px;margin:4px 0}
.cg .cg-kpis b{font-size:23px;overflow-wrap:anywhere}
.cg-grid2{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:12px}
.cg-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cg-card{padding:14px;min-width:0}
.cg-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap}.cg-title h2{font-size:14px;margin:0}.cg-title p{font-size:11px;color:#75828b;margin:3px 0 0}
.cg-poder{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}.cg-poder b{font-size:26px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.cg-poder span{font-size:12px;color:#75828b}
.cg-stack{display:flex;height:14px;border-radius:99px;overflow:hidden;background:#edf1f3}.cg-stack i{display:block;height:100%}
.cg-c1{background:#2f9863}.cg-c2{background:#3d7fb8}.cg-c3{background:#c98a1b}.cg-c4{background:#8a6fc4}
.cg-legend{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.cg-legend>div{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:center}
.cg-legend i{width:10px;height:10px;border-radius:3px;display:block}
.cg-legend span{font-size:12.5px;font-weight:600}.cg-legend small{display:block;font-size:11px;color:#75828b;font-weight:400;margin-top:1px}
.cg-legend b{font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.cg-bars{display:flex;flex-direction:column;gap:11px}
.cg-bars>div>div{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px}
.cg-bars span{font-weight:600}.cg-bars small{display:block;font-size:11px;color:#75828b;font-weight:400;margin-top:1px}
.cg-bars>div>div>b{font-variant-numeric:tabular-nums}
.cg-bars i{display:block;height:7px;background:#edf1f3;border-radius:99px;overflow:hidden;margin-top:5px}.cg-bars em{display:block;height:100%;background:#2f9863}
.cg-sub{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7b85;margin:16px 0 7px}
.cg-cdts{display:grid;grid-template-columns:1fr 1fr;gap:7px}.cg-cdts>div{background:#f6f8f9;border-radius:9px;padding:9px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}.cg-cdts span{font-size:11.5px;color:#6b7b85}
.cg-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.cg-stats>div{background:#f5f7f8;border-radius:10px;padding:10px 8px;text-align:center}
.cg-stats b,.cg-stats span,.cg-stats small{display:block}.cg-stats b{font-size:21px;font-variant-numeric:tabular-nums}.cg-stats span{font-size:11.5px;font-weight:600;margin-top:2px}.cg-stats small{font-size:10.5px;color:#71808a;margin-top:2px;line-height:1.35}
.cg-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.cg-chips span{font-size:11px;border-radius:99px;padding:4px 9px;background:#eef2f4;color:#50606a;display:inline-flex;gap:5px;align-items:baseline}
.cg-chips .verde{background:#e7f4ec;color:#246747}.cg-chips .azul{background:#eaf1fa;color:#2a5fa6}.cg-chips .ambar{background:#fff2e2;color:#a86714}.cg-chips .rojo{background:#fbecec;color:#a83e3e}
.cg-minidocs{display:grid;grid-template-columns:1fr 1fr;gap:7px}.cg-minidocs>div{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;background:#f6f8f9;border-radius:8px;padding:9px}.cg-minidocs span,.cg-minidocs b{font-size:12px}
.cg-alerts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cg-alerts>div{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:start;background:#fbfcfc;border:1px solid #eef2f4;border-radius:10px;padding:10px}
.cg-alerts svg{color:#b66f18;margin-top:1px}.cg-alerts .ok svg{color:#26704c}
.cg-alerts b,.cg-alerts span{display:block}.cg-alerts b{font-size:13px}.cg-alerts span{font-size:12px;color:#74818a;margin-top:3px;line-height:1.5}
.cg-search{display:flex;gap:6px;align-items:center;border:1px solid #dce3e7;border-radius:8px;padding:7px;min-width:280px}.cg-search input{border:0;outline:0;width:100%;font-size:13px;background:transparent}
.cg-docgroup h3{font-size:12.5px;margin:16px 0 8px}.cg-docgroup h3 small{font-weight:500;color:#75828b}
.cg-docgroup>div{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.cg-docgroup article{border:1px solid #e4e9ec;border-radius:9px;padding:9px;display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:7px;align-items:center}
.cg-docgroup article>svg{color:#28734f}
.cg-docgroup b,.cg-docgroup span{display:block}.cg-docgroup b{font-size:12.5px}
.cg-docgroup span{font-size:11px;color:#75828b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cg-docgroup button,.cg-filters button,.cg-mas{border:0;background:#eef2f4;border-radius:7px;padding:6px 8px;font-size:11px;font-weight:600;display:flex;gap:4px;align-items:center;cursor:pointer;color:#31424e;white-space:nowrap}
.cg-docgroup button:hover,.cg-filters button:hover,.cg-mas:hover{background:#e3e9ec}.cg-filters button:disabled{opacity:.45;cursor:not-allowed}
.cg-timeline{display:flex;flex-direction:column}
.cg-timeline>div{display:grid;grid-template-columns:64px 18px 1fr;min-height:53px}
.cg-timeline time{font-size:12px;font-weight:800;padding-top:3px}.cg-timeline time small{display:block;font-size:11px;font-weight:500;color:#74818a;margin-top:1px}
.cg-timeline i{position:relative}.cg-timeline i:before{content:"";position:absolute;left:8px;top:8px;bottom:-7px;width:1px;background:#dfe6e9}.cg-timeline i:after{content:"";position:absolute;left:4px;top:5px;width:8px;height:8px;background:#2f9863;border-radius:50%}
.cg-timeline b,.cg-timeline span{display:block}.cg-timeline b{font-size:12.5px}.cg-timeline span{font-size:11.5px;color:#74818a;margin-top:2px;line-height:1.45}
.cg-filters{display:flex;gap:6px;flex-wrap:wrap}.cg-filters select{border:1px solid #dbe2e6;border-radius:7px;padding:6px;font-size:12px}
.cg-audit-summary{display:flex;gap:7px;margin-bottom:11px;flex-wrap:wrap}.cg-audit-summary span{font-size:11px;background:#F2F5F4;color:#63736B;border-radius:999px;padding:5px 9px}
.cg-mas{margin:12px auto 0}
.cg-vacio{font-size:13px;color:#74818a;text-align:center;padding:28px 10px;margin:0}
.cg-perms{overflow:auto;border:1px solid #e3e8eb;border-radius:9px}
.cg-perms table{width:100%;border-collapse:collapse;font-size:12px}
.cg-perms th,.cg-perms td{padding:9px;border-bottom:1px solid #e9edef;text-align:center}
.cg-perms th:first-child,.cg-perms td:first-child{text-align:left}.cg-perms td:first-child{min-width:260px}
.cg-perms td:first-child small{display:block;font-size:11px;color:#75828b;font-weight:400;margin-top:2px;line-height:1.4}
.cg-perms th{background:#f5f7f8;font-size:11px}.cg-perms svg{color:#278159}
.cg-rule{margin-top:12px;background:#edf6f1;border:1px solid #d7e8de;border-radius:9px;padding:10px;display:flex;gap:8px;font-size:12px;color:#315e48;line-height:1.55}.cg-rule svg{flex:none;margin-top:2px}
@media(max-width:1250px){.cg-grid3{grid-template-columns:1fr 1fr}.cg-docgroup>div{grid-template-columns:1fr}}
@media(max-width:1000px){.cg{grid-template-columns:1fr}.cg>aside{display:none}.cg-tabs{display:flex}.cg-kpis,.cg-grid3{grid-template-columns:1fr 1fr}.cg-grid2{grid-template-columns:1fr}}
@media(max-width:640px){.cg>main{padding:16px 12px}.cg-kpis,.cg-grid3,.cg-alerts,.cg-cdts{grid-template-columns:1fr}.cg .cg-search{min-width:0;width:100%}.cg-docgroup article{grid-template-columns:auto minmax(0,1fr)}.cg-docgroup article button{grid-column:2;justify-self:start}.cg>main>header{flex-direction:column}}
`}</style>}
