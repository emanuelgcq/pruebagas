import React, { useState, useMemo, useEffect } from "react";

import {
  LayoutDashboard, ClipboardList, FileText, Receipt, Gauge,
  Lock, Plus, X, ChevronRight, Check, ArrowRight, AlertTriangle, Search,
  Building2, CircleDot, Download, Printer, MessageSquareWarning,
  Eye, CheckCircle2, Zap, Send, Landmark, Truck, Clock3,
  Wallet, BookText, ShoppingBag, Tag as TagIcon, UserCog,
  ShieldAlert, Undo2, Wrench,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, PERIODO, HOY, CDTS, CONCEPTOS, GRUPOS, USUARIOS, BANCOS, EPSDCS, KG_POR_LITRO_GLP,
  cpt, usr, tpd, cdtOf, comunaOf, epsdcOf, segmentoUsuario,
  bs, num, fecha, fechaCorta, fechaLarga, descargar, csv, montos, kgALitros, kgDeSolicitud,
  resumenCierreMensual, esFechaPeriodo, finDeCiclo, llenadoPorCerrarDe, saldosDe, aplicarSaldo,
  estadoSolicitud, cubiertoDe, faltanteDe, dineroAplicadoDe,
  bitacoraPagos, patronesSospechosos, reglaPago, aplicarReglaPago, esAbonada,
  CANALES_PAGO, canalPago, puedeSolicitar, validarCanje, envasesDe,
  INCIDENCIAS_PREVIAS, incidenciaPrevia, gruposIncidenciaPrevia,
} from "./datos.jsx";
import { cifrasSistema, fichaUsuario360, adCerrada } from "./flujo.js";
import { VisorDocumento } from "./Documentos.jsx";
import Usuario360Modal from "./Usuario360.jsx";
import { PreCierre, vencenAlCerrar, textoCierre } from "./ComercializacionExtra.jsx";
import {
  LibroVentas, SaldosAFavor, ListaPrecios, PadronUsuarios, VentasSinContrato, GestionStyles,
  etiquetaOrigen, CLASE_ORIGEN, receptorDe, parseBs, mesArchivo,
} from "./ComercializacionGestion.jsx";
import { KgL, KgLBloque, NotaFactor, UnidadesStyles, kgYL } from "./Unidades.jsx";

/* ── Utilidades del módulo ── */
const suma = (arr, f) => arr.reduce((a, x) => a + Number(f(x) || 0), 0);
const pctTxt = (v, dec = 1) => `${Number(v || 0).toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
const nombreBanco = (id) => (id === "EFECTIVO" ? "Efectivo" : BANCOS.find((b) => b.id === id)?.nombre || id || "");
/* Los archivos llevan el mes legible: la clave interna del período cuenta los meses desde cero. */
const MES_ARCHIVO = mesArchivo();
const dos = (n) => String(n).padStart(2, "0");
const CORTE_ARCHIVO = `${HOY.getFullYear()}-${dos(HOY.getMonth() + 1)}-${dos(HOY.getDate())}`;

/* Venta transportada por una EPSDC: lo entregado en un AD cerrado con unidad de un tercero.
   El porcentaje del servicio sale del contrato de cada EPSDC, no de una cifra fija. */
const esVentaEPSDC = (s) => s.transportistaTipo === "EPSDC" && Boolean(s.boleta) && s.estado === "CULMINADO";
const pctServicio = (s) => Number(epsdcOf(s.epsdc).servicioPct || 0);
const PCTS_EPSDC = [...new Set(EPSDCS.map((e) => e.servicioPct))];
const ETIQUETA_PCT_EPSDC = PCTS_EPSDC.length === 1 ? pctTxt(PCTS_EPSDC[0] * 100, 0) : "según contrato";

/**
 * Las cifras de un CDT salen de la MISMA función que las del sistema (`cifrasSistema`),
 * aplicada a lo que es de ese CDT. Así el panel filtrado y el consolidado nunca usan
 * fórmulas distintas, y la suma de los CDT da el consolidado.
 */
function cifrasDeCdt(cdtId, { solicitudes = [], abonos = [], facturas = [], rutas = [], movPlanta = [], existencias = {}, compromisos = {}, disponibles = {} }) {
  const sols = solicitudes.filter((s) => s.cdt === cdtId);
  // Un AD es del CDT si alguna de sus personas lo es: las que siguen en ella y las que salieron al cerrar.
  const rutaIds = new Set(sols.flatMap((s) => [s.rutaId, ...(s.historialAD || []).map((h) => h.rutaId)]).filter(Boolean));
  const soloCdt = (m) => ({ [cdtId]: Number(m[cdtId] || 0) });
  return cifrasSistema({
    solicitudes: sols,
    // El saldo a favor es de la persona: cuenta en el CDT que la atiende.
    abonos: abonos.filter((a) => usr(a.usuario).cdt === cdtId),
    facturas: facturas.filter((f) => f.cdt === cdtId),
    rutas: rutas.filter((r) => rutaIds.has(r.id)),
    movPlanta: movPlanta.filter((m) => m.cdt === cdtId),
    existencias: soloCdt(existencias), compromisos: soloCdt(compromisos), disponibles: soloCdt(disponibles),
  });
}

export default function Comercializacion({
  solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles,
  periodoCerrado, cierrePeriodo = null, cerrarPeriodo, crearManual, rutasDistribucion = [], movPlanta = [],
  responderReclamo, tomarReclamo, cifras,
  abonos = [], saldos = {}, padron = [], parqueEnvases = [],
  registrarAbono, registrarIncidenciaPrevia, culminarServicio, crearVentaGenerica, actualizarUsuario,
  crearUsuario, definirEstadoUsuario,
  crearSolicitudManual, completarPago, revertirResolucionPago, cajasPM = {},
}) {
  const [vista, setVista] = useState("panel");
  // Segmento con que se abre Solicitudes cuando se llega desde un acceso del panel.
  const [segSol, setSegSol] = useState(null);
  const [cdtF, setCdtF] = useState("TODOS");
  const [modal, setModal] = useState(null);
  const [doc, setDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 3400); };
  const ir = (destino, segmento = null) => { setSegSol(segmento); setVista(destino); };

  const enCdt = (arr) => arr.filter((x) => cdtF === "TODOS" || x.cdt === cdtF);
  const solV = useMemo(() => enCdt(solicitudes), [solicitudes, cdtF]);
  const facV = useMemo(() => enCdt(facturas), [facturas, cdtF]);
  const bopV = useMemo(() => enCdt(boletas), [boletas, cdtF]);
  const movV = useMemo(() => enCdt(movs), [movs, cdtF]);
  const movPlantaV = useMemo(() => enCdt(movPlanta), [movPlanta, cdtF]);
  const abonosV = useMemo(() => (cdtF === "TODOS" ? abonos : abonos.filter((a) => usr(a.usuario).cdt === cdtF)), [abonos, cdtF]);
  const saldosV = useMemo(() => (cdtF === "TODOS" ? saldos : saldosDe(abonosV)), [saldos, abonosV, cdtF]);

  /* UNA SOLA FUENTE DE CIFRAS. El consolidado es el que calcula App (`cifras`); el de cada
     CDT es la misma función aplicada a lo del CDT. Ninguna pantalla de este módulo suma por
     su cuenta lo que ya calcula el núcleo. */
  const cifrasPorCdt = useMemo(() => Object.fromEntries(CDTS.map((c) => [c.id, cifrasDeCdt(c.id, {
    solicitudes, abonos, facturas, rutas: rutasDistribucion, movPlanta, existencias, compromisos, disponibles,
  })])), [solicitudes, abonos, facturas, rutasDistribucion, movPlanta, existencias, compromisos, disponibles]);
  const cifrasTodas = useMemo(() => cifras || cifrasSistema({
    solicitudes, abonos, facturas, rutas: rutasDistribucion, movPlanta, existencias, compromisos, disponibles,
  }), [cifras, solicitudes, abonos, facturas, rutasDistribucion, movPlanta, existencias, compromisos, disponibles]);
  const cifrasV = cdtF === "TODOS" ? cifrasTodas : cifrasPorCdt[cdtF];
  // Lo único que la regla de pago no cierra sola: la repetición entre varios pagos.
  const patrones = useMemo(() => patronesSospechosos(solV), [solV]);

  /* ── Exportaciones ── */
  function expDocumentos() {
    descargar(`documentos-fiscales-al-${CORTE_ARCHIVO}.csv`, csv([
      ["DOCUMENTOS FISCALES EMITIDOS", EMPRESA.nombre, EMPRESA.rif], ["Corte", fecha(HOY)],
      ["Alcance", cdtF === "TODOS" ? "Todos los CDT" : cdtOf(cdtF).nombre], [],
      ["Serie", "Nro control", "Fecha", "CDT", "Rif/CI", "Razón social", "Contrato", "Concepto", "Cantidad",
       "Base imponible", "Exento", "IVA", "Total", "Origen", "AD", "Banco", "Referencia"],
      ...facV.map((f) => {
        const r = receptorDe(f);
        return [f.serie, f.control, fecha(f.fecha), cdtOf(f.cdt).corto, r.doc, r.nombre, r.contrato, cpt(f.concepto).nombre, f.cantidad,
          (f.exento ? 0 : f.base).toFixed(2), (f.exento ? f.base : 0).toFixed(2), Number(f.iva || 0).toFixed(2),
          Number(f.total || 0).toFixed(2), etiquetaOrigen(f.origen), f.ad || "", nombreBanco(f.pago?.banco), f.pago?.referencia || ""];
      }),
      [], ["TOTALES", "", "", "", "", "", "", "", "",
        suma(facV.filter((f) => !f.exento), (f) => f.base).toFixed(2), suma(facV.filter((f) => f.exento), (f) => f.base).toFixed(2),
        suma(facV, (f) => f.iva).toFixed(2), suma(facV, (f) => f.total).toFixed(2)],
    ]));
    aviso("Documentos fiscales descargados");
  }

  function expCierre() {
    const cierre = resumenCierreMensual(facV, solV);
    const t = cierre.totales;
    const d = cifrasV.dinero, g = cifrasV.glp;
    descargar(`cierre-mensual-${MES_ARCHIVO}.csv`, csv([
      ["CIERRE MENSUAL DE COMERCIALIZACIÓN"], [EMPRESA.nombre, EMPRESA.rif], [PERIODO.label],
      ["Alcance", cdtF === "TODOS" ? "Todos los CDT" : cdtOf(cdtF).nombre], ["Emitido", fecha(HOY)],
      ["Estado", periodoCerrado ? textoCierre(cierrePeriodo) : "PRELIMINAR"], [],
      ["CUADRE GENERAL · las mismas cifras del panel"],
      ["Facturado del período Bs", d.facturadoPeriodo.total.toFixed(2), "Documentos", d.facturadoPeriodo.docs, "Base Bs", d.facturadoPeriodo.base.toFixed(2), "IVA Bs", d.facturadoPeriodo.iva.toFixed(2)],
      ["Pendiente por despachar Bs", d.pendienteDespacho.bs.toFixed(2), "Pedidos", d.pendienteDespacho.n, "GLP kg", d.pendienteDespacho.kg.toFixed(2), "GLP L", kgALitros(d.pendienteDespacho.kg).toFixed(2)],
      ["Servicios por prestar Bs", d.serviciosPorPrestar.bs.toFixed(2), "Pedidos", d.serviciosPorPrestar.n],
      ["Por completar · recibido Bs", d.porCompletar.recibido.toFixed(2), "Pedidos", d.porCompletar.n, "Faltante Bs", d.porCompletar.faltante.toFixed(2)],
      ["Saldo a favor Bs", d.saldoFavor.bs.toFixed(2), "Usuarios", d.saldoFavor.usuarios],
      ["Dinero de usuarios en poder de la empresa Bs", Number(d.enPoderDeLaEmpresa).toFixed(2)],
      ["Inventario físico kg", g.fisico.toFixed(2), "Comprometido kg", g.comprometido.toFixed(2), "Disponible real kg", g.disponible.toFixed(2), "Llenado por cerrar kg", g.llenadoPorCerrar.toFixed(2)],
      ["Inventario físico L", kgALitros(g.fisico).toFixed(2), "Comprometido L", kgALitros(g.comprometido).toFixed(2), "Disponible real L", kgALitros(g.disponible).toFixed(2), "Llenado por cerrar L", kgALitros(g.llenadoPorCerrar).toFixed(2)],
      ["Salida por BOP y talonario del período kg", t.kgDespachado.toFixed(2), "L", kgALitros(t.kgDespachado).toFixed(2)], [],
      ["Concepto de ingreso",
       "Docs. facturados", "Cant. facturada", "Base facturada Bs", "IVA facturado Bs", "Total facturado Bs",
       "Pedidos pendientes por despachar", "Cant. pendiente", "Base pendiente Bs", "IVA pendiente Bs", "Total pendiente Bs",
       "GLP despachado kg", "GLP despachado L", "GLP comprometido kg", "GLP comprometido L"],
      ...GRUPOS.flatMap((grupo) => [[grupo.toUpperCase()], ...cierre.filas.filter((r) => r.grupo === grupo).map((r) => [
        r.nombre, r.docsEntregados, r.cantidadEntregada, r.baseEntregada.toFixed(2), r.ivaEntregado.toFixed(2), r.totalEntregado.toFixed(2),
        r.docsPendientes, r.cantidadPendiente, r.basePendiente.toFixed(2), r.ivaPendiente.toFixed(2), r.totalPendiente.toFixed(2),
        r.kgDespachado.toFixed(2), kgALitros(r.kgDespachado).toFixed(2), r.kgComprometido.toFixed(2), kgALitros(r.kgComprometido).toFixed(2),
      ])]),
      ["TOTALES", t.docsEntregados, t.cantidadEntregada, t.baseEntregada.toFixed(2), t.ivaEntregado.toFixed(2), t.totalEntregado.toFixed(2),
       t.docsPendientes, t.cantidadPendiente, t.basePendiente.toFixed(2), t.ivaPendiente.toFixed(2), t.totalPendiente.toFixed(2),
       t.kgDespachado.toFixed(2), kgALitros(t.kgDespachado).toFixed(2), t.kgComprometido.toFixed(2), kgALitros(t.kgComprometido).toFixed(2)],
      [], ["REGLAS DE CUADRE"],
      ["1", "El pago no descuenta inventario: queda como pendiente por despachar y GLP comprometido hasta que se cierra su AD."],
      ["2", "El cierre del AD genera la BOP, la salida de inventario y la factura al precio del día de salida."],
      ["3", "Lo pendiente por despachar se muestra en el cierre, pero no se suma a lo facturado del período."],
      ["4", "Disponible real = inventario físico − inventario comprometido. El llenado por cerrar ya está dentro del físico."],
      ["5", "Al cerrar el período, lo que sigue por replanificar o por completar pasa al saldo a favor de su dueño."],
    ]));
    aviso("Cierre mensual descargado · mismos valores de pantalla y acta");
  }

  function expInventario() {
    const porCerrar = llenadoPorCerrarDe(movPlantaV, rutasDistribucion);
    descargar(`inventario-glp-${MES_ARCHIVO}.csv`, csv([
      ["MOVIMIENTOS DE INVENTARIO GLP", PERIODO.label], ["Corte", fecha(HOY)], [],
      ["Movimiento", "Fecha", "CDT", "Comuna", "Documento", "Concepto", "Origen de salida", "Kg", "Litros"],
      ...movV.map((m) => [m.id, fecha(m.fecha), cdtOf(m.cdt).corto, m.comuna ? comunaOf(m.comuna).nombre : "—", m.doc, cpt(m.concepto).nombre,
        m.tipo === "SALIDA_MANUAL" ? "Talonario o venta sin contrato" : "BOP del cierre de AD", m.kg, kgALitros(Math.abs(m.kg)).toFixed(2)]),
      [], ["EXISTENCIAS", `Conversión: 1 litro de GLP = ${String(KG_POR_LITRO_GLP).replace(".", ",")} kg`],
      ["CDT", "Inicial kg", "Existencia física kg", "Existencia física L", "Comprometido kg", "Comprometido L",
       "Disponible real kg", "Disponible real L", "Llenado por cerrar kg", "Llenado por cerrar L"],
      ...CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF).map((c) => {
        const ex = Number(existencias[c.id] || 0), co = Number(compromisos[c.id] || 0), di = Number(disponibles[c.id] || 0), ll = Number(porCerrar[c.id] || 0);
        return [c.nombre, c.inicial, ex.toFixed(2), kgALitros(ex).toFixed(2), co.toFixed(2), kgALitros(co).toFixed(2),
          di.toFixed(2), kgALitros(di).toFixed(2), ll.toFixed(2), kgALitros(ll).toFixed(2)];
      }),
    ]));
    aviso("Movimientos descargados");
  }

  function expEPSDC() {
    const l = solV.filter(esVentaEPSDC);
    descargar(`resumen-venta-transportada-epsdc-${MES_ARCHIVO}.csv`, csv([
      ["RESUMEN DE LA VENTA TRANSPORTADA POR EPSDC", PERIODO.label],
      [`Soporte del pago del servicio de transporte de cada EPSDC (${ETIQUETA_PCT_EPSDC} de la venta transportada)`], [],
      ["AD", "Fecha", "EPSDC", "Operador", "Unidad", "Comuna", "Usuario", "Tipo despacho", "Kg GLP", "Litros", "Venta transportada Bs", "% servicio", "Servicio Bs"],
      ...l.map((s) => [s.ad, fecha(s.entrega), epsdcOf(s.epsdc).nombre, s.operador || "", s.unidad || "", comunaOf(s.comuna).nombre,
        usr(s.usuario).nombre, tpd(s.tipoDespacho).nombre, kgDeSolicitud(s), kgALitros(kgDeSolicitud(s)).toFixed(2), Number(s.total || 0).toFixed(2),
        (pctServicio(s) * 100).toFixed(0), (Number(s.total || 0) * pctServicio(s)).toFixed(2)]),
      [], ["TOTALES", `${new Set(l.map((s) => s.ad)).size} AD`, "", "", "", "", "", "",
        suma(l, kgDeSolicitud), kgALitros(suma(l, kgDeSolicitud)).toFixed(2), suma(l, (s) => s.total).toFixed(2), "",
        suma(l, (s) => Number(s.total || 0) * pctServicio(s)).toFixed(2)],
    ]));
    aviso("Resumen EPSDC descargado");
  }

  function expReclamos() {
    descargar(`reclamos-${MES_ARCHIVO}.csv`, csv([
      ["RECLAMOS DE USUARIOS", PERIODO.label], [],
      ["Reclamo", "Fecha", "Usuario", "Contrato", "Tipo", "Prioridad", "Asunto", "Detalle", "Estatus", "Atendió", "Respuesta", "Cerrado"],
      ...reclamos.map((r) => [r.id, fecha(r.fecha), usr(r.usuario).nombre, usr(r.usuario).contrato, r.tipo,
        r.prioridad, r.asunto, r.detalle, r.estado, r.atendio || "", r.respuesta || "", r.cerrado ? fecha(r.cerrado) : ""]),
    ]));
    aviso("Reclamos descargados");
  }

  const recAbiertos = reclamos.filter((r) => r.estado !== "RESUELTO").length;
  const adsEPSDC = new Set(solV.filter(esVentaEPSDC).map((s) => s.ad)).size;
  const ventasGenericas = facV.filter((f) => f.origen === "SIN_CONTRATO").length;
  const porCompletarN = cifrasV.solicitudes.porCompletar;

  /* El menú va agrupado por oficio, no en una lista plana de once entradas donde el
     libro de ventas —que es el soporte contable oficial— quedaba escondido como pestaña
     de «Documentos».

     El orden sigue el día de trabajo: primero lo que se hace a diario (operación), luego
     lo que se administra, y al final lo contable, que se consulta al cerrar. Estar de
     último no lo esconde: cada pieza tiene su entrada y su rótulo de grupo.
     La consignación comunal ya no existe: la responsabilidad de la empresa termina cuando
     las bombonas vuelven al punto. */
  const nav = [
    { grupo: null, items: [
      { id: "panel", label: "Panel", icon: LayoutDashboard },
    ]},
    { grupo: "Operación comercial", items: [
      // Lo que pide atención: pedidos por completar y patrones de pago que la regla no cierra sola.
      { id: "solicitudes", label: "Solicitudes", icon: ClipboardList, badge: porCompletarN + patrones.length,
        titulo: `${num(porCompletarN)} por completar · ${num(patrones.length)} patrones de pago por revisar` },
      { id: "inventario", label: "Inventario GLP", icon: Gauge },
      { id: "epsdc", label: `EPSDC · ${ETIQUETA_PCT_EPSDC}`, icon: Truck, badge: adsEPSDC, titulo: `${num(adsEPSDC)} AD cerradas con unidad EPSDC` },
    ]},
    { grupo: "Administración", items: [
      { id: "padron", label: "Padrón de usuarios", icon: UserCog },
      { id: "precios", label: "Lista de precios", icon: TagIcon },
      { id: "reclamos", label: "Reclamos", icon: MessageSquareWarning, badge: recAbiertos },
    ]},
    { grupo: "Contabilidad", items: [
      { id: "libro", label: "Libro de ventas", icon: BookText, pie: "Soporte contable oficial" },
      { id: "documentos", label: "Facturas y boletas", icon: Receipt },
      { id: "sincontrato", label: "Ventas sin contrato", icon: ShoppingBag, badge: ventasGenericas },
      { id: "saldos", label: "Saldos a favor", icon: Wallet, badge: cifrasV.dinero.saldoFavor.usuarios },
      { id: "cierre", label: "Cierre del período", icon: Lock },
    ]},
  ];
  const navPlano = nav.flatMap((g) => g.items);

  return (
    <div className={`gl ${doc ? "printing" : ""}`}>
      <Estilos />
      <GestionStyles />
      <UnidadesStyles />

      <aside className="side">
        <div className="brand">
          <img src={LOGO_GASLARA} alt="GasLara" className="brand-img" />
          <div className="brand-sub">Módulo de comercialización</div>
        </div>
        <nav>
          {nav.map((g, gi) => (
            <div className="navgrupo" key={g.grupo || `g${gi}`}>
              {g.grupo && <div className="navgrupo-h">{g.grupo}</div>}
              {g.items.map((n) => (
                <button key={n.id} className={`navbtn ${vista === n.id ? "on" : ""}`} onClick={() => ir(n.id)} title={n.titulo}>
                  <n.icon size={16} /><span>{n.label}</span>{n.badge > 0 && <em className="navbadge">{n.badge}</em>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="periodo-lbl">Período activo</div>
          <div className="periodo-val">{PERIODO.label}</div>
          <div className={`periodo-est ${periodoCerrado ? "cerr" : ""}`}>
            <CircleDot size={11} /> {periodoCerrado ? `Cerrado${cierrePeriodo?.en ? ` el ${fechaCorta(cierrePeriodo.en)}` : ""}` : "Abierto"}
          </div>
          <img src={LOGO_LARA} alt="Gobierno de Lara" className="lara" />
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <h1>{(navPlano.find((n) => n.id === vista) || navPlano[0]).label}</h1>
            <p>{fechaLarga(HOY)} · {cdtF === "TODOS" ? `Consolidado de ${CDTS.length} centros de distribución` : cdtOf(cdtF).nombre}</p>
          </div>
          <div className="top-r">
            <div className="select-wrap">
              <Building2 size={14} />
              <select value={cdtF} onChange={(e) => setCdtF(e.target.value)}>
                <option value="TODOS">Todos los CDT</option>
                {CDTS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
        </header>

        <div className="body">
          {vista === "panel" && <Panel {...{ facV, movV, movPlantaV, existencias, compromisos, disponibles, reclamos, cdtF, solV, ir }}
            cifras={cifrasV} cifrasPorCdt={cifrasPorCdt} rutas={rutasDistribucion} />}
          {vista === "solicitudes" && <VistaSolicitudes key={segSol || "TODAS"} segmento={segSol} cifras={cifrasV} patrones={patrones}
            {...{ solV, setDoc, boletas, facturas, parqueEnvases, saldos }}
            todas={solicitudes} onIncidencia={registrarIncidenciaPrevia} onRevertir={revertirResolucionPago}
            onCrearManual={crearSolicitudManual} onCompletarPago={completarPago} onCulminarServicio={culminarServicio} />}
          {vista === "saldos" && <SaldosAFavor abonos={abonosV} saldos={saldosV} solicitudes={solV} cifras={cifrasV}
            onRegistrar={registrarAbono} />}
          {vista === "libro" && <LibroVentas facturas={facV} todas={facturas} cdtF={cdtF} periodoCerrado={periodoCerrado} />}
          {vista === "sincontrato" && <VentasSinContrato facturas={facV} solicitudes={solV} onVender={crearVentaGenerica} cajasPM={cajasPM} />}
          {vista === "documentos" && <VistaDocumentos {...{ facV, bopV, setDoc, setModal }} onExport={expDocumentos} />}
          {vista === "inventario" && <VistaInventario {...{ existencias, compromisos, disponibles, cdtF }} glp={cifrasV.glp}
            movs={movV} movPlanta={movPlantaV} boletas={bopV} rutas={rutasDistribucion} onExport={expInventario} />}
          {vista === "precios" && <ListaPrecios />}
          {vista === "epsdc" && <VistaEPSDC sols={solV} onExport={expEPSDC} />}
          {vista === "reclamos" && <VistaReclamos {...{ reclamos, setModal, tomarReclamo, onExport: expReclamos }} />}
          {vista === "padron" && <PadronUsuarios padron={padron} solicitudes={solicitudes} saldos={saldos}
            facturas={facturas} reclamos={reclamos} onActualizar={actualizarUsuario}
            onCrear={crearUsuario} onDefinirEstado={definirEstadoUsuario}
            onVerFicha={(u) => setModal({ tipo: "ficha", u })} />}
          {vista === "cierre" && <VistaCierre {...{ facV, solV, existencias, compromisos, disponibles, movPlanta, periodoCerrado,
            cierrePeriodo, cerrarPeriodo, setDoc, cdtF }} cifrasV={cifrasV} cifrasTodas={cifrasTodas} solicitudes={solicitudes}
            facturas={facturas} boletas={boletas} rutas={rutasDistribucion} onExport={expCierre} />}
        </div>
      </main>

      {modal === "manual" && <ModalManual onClose={() => setModal(null)} onSave={(d) => {
        const r = crearManual(d);
        if (r?.ok) { setModal(null); aviso("Factura manual integrada al consolidado"); }
        return r;
      }} />}
      {modal?.tipo === "reclamo" && <ModalReclamo r={modal.r} onClose={() => setModal(null)}
        onSave={(txt, cerrar) => { responderReclamo(modal.r, txt, cerrar); setModal(null); aviso(`Respuesta enviada · ${modal.r.id}`); }} />}
      {modal?.tipo === "ficha" && <FichaUsuario u={modal.u} {...{ solicitudes, facturas, abonos, reclamos }} rutas={rutasDistribucion}
        onClose={() => setModal(null)} setDoc={setDoc} />}
      {doc && <VisorDocumento doc={doc} onClose={() => setDoc(null)} contexto={{ facturas: facV, solicitudes: solV,
        alcance: cdtF === "TODOS" ? `Consolidado ${CDTS.length} CDT` : cdtOf(cdtF).nombre, existencias, compromisos, disponibles, cdtF, periodoCerrado }} />}
      {toast && <div className="toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ═══════════  PANEL  ═══════════
   Dos clases de cifra que no se mezclan:
   · FLUJO — lo facturado. Depende del rango Día / Semana / Mes.
   · STOCK — pendiente por despachar, por completar, saldo a favor, inventario y AD. Es la
     foto de hoy y no tiene rango.
   Todas salen de `cifras`: el panel no tiene fórmulas propias. */

const RANGOS = [["DIA", "Día"], ["SEMANA", "Semana"], ["MES", "Mes"]];
const resumenFacturas = (fs) => ({ docs: fs.length, base: suma(fs, (f) => f.base), iva: suma(fs, (f) => f.iva), total: suma(fs, (f) => f.total) });
const ESTADOS_DONA = ["CULMINADO", "EN_AD", "PAGADA", "POR_REPLANIFICAR", "POR_COMPLETAR", "SIN_PAGO", "ABONADA"];
const COLOR_ESTADO = { CULMINADO: "#1C6B47", EN_AD: "#2D65B0", PAGADA: "#2B9566", POR_REPLANIFICAR: "#C0562B", POR_COMPLETAR: "#D08A24", SIN_PAGO: "#8C98A3", ABONADA: "#5D6974" };

/* Una variación sólo dice algo si hay con qué comparar. Sin base previa, o con una base
   ínfima frente a lo de ahora, el porcentaje sale absurdo (↑102.963%): se dice «sin
   base» en vez de publicarlo. */
function variacion(actual, previo, docsPrevios) {
  if (!(previo > 0) || docsPrevios < 3 || previo < actual * 0.1) return null;
  return ((actual - previo) / previo) * 100;
}

function Panel({ facV, movV, movPlantaV, existencias, compromisos, disponibles, reclamos, cdtF, solV, ir, cifras, cifrasPorCdt, rutas = [] }) {
  const [rango, setRango] = useState("MES");

  const rangoInfo = useMemo(() => {
    const fin = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate(), 23, 59, 59, 999);
    let inicio;
    if (rango === "DIA") inicio = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate());
    else if (rango === "SEMANA") inicio = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - 6);
    else inicio = new Date(PERIODO.anio, PERIODO.mes, 1);
    const etiqueta = rango === "DIA" ? fecha(HOY) : rango === "SEMANA" ? `${fecha(inicio)} – ${fecha(fin)}` : PERIODO.label;
    // El tramo anterior de igual duración, para comparar lo facturado.
    const prevFin = new Date(inicio.getTime() - 1);
    const prevInicio = new Date(prevFin.getTime() - (fin.getTime() - inicio.getTime()));
    return { inicio, fin, etiqueta, prevInicio, prevFin };
  }, [rango]);

  // En «Mes» se usa exactamente el corte de `cifras` y del libro de ventas: el período.
  const enRango = (d) => (rango === "MES" ? esFechaPeriodo(d) : !!d && d >= rangoInfo.inicio && d <= rangoInfo.fin);
  const facRango = facV.filter((f) => enRango(f.fecha));
  const fact = rango === "MES" ? cifras.dinero.facturadoPeriodo : resumenFacturas(facRango);
  const factPrev = resumenFacturas(facV.filter((f) => f.fecha && f.fecha >= rangoInfo.prevInicio && f.fecha <= rangoInfo.prevFin));
  const vTotal = variacion(fact.total, factPrev.total, factPrev.docs);
  const vDocs = variacion(fact.docs, factPrev.docs, factPrev.docs);

  const d = cifras.dinero;
  const g = cifras.glp;
  const ad = cifras.ad;
  const pe = cifras.solicitudes.porEstado || {};
  const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  const porCerrar = useMemo(() => llenadoPorCerrarDe(movPlantaV, rutas), [movPlantaV, rutas]);
  const log = useMemo(() => bitacoraPagos(solV), [solV]);
  const recAbiertos = reclamos.filter((r) => r.estado !== "RESUELTO");

  const buckets = useMemo(() => {
    const out = [];
    const cursor = new Date(rangoInfo.inicio);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= rangoInfo.fin) {
      const ini = new Date(cursor);
      const fin = new Date(cursor); fin.setHours(23, 59, 59, 999);
      const key = `${ini.getFullYear()}-${ini.getMonth()}-${ini.getDate()}`;
      const label = rango === "MES" ? String(ini.getDate()) : `${String(ini.getDate()).padStart(2, "0")}/${String(ini.getMonth() + 1).padStart(2, "0")}`;
      out.push({ key, label, ini, fin });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [rango, rangoInfo.inicio.getTime(), rangoInfo.fin.getTime()]);

  const entre = (x, b) => !!x && x >= b.ini && x <= b.fin;
  const serieFact = buckets.map((b) => ({ ...b, facturado: suma(facV.filter((f) => entre(f.fecha, b)), (f) => f.total) }));
  // El kardex de cada día: entradas por gandola, salidas (BOP, talonario y gandola) y llenado de la jornada.
  const serieGlp = buckets.map((b) => ({
    ...b,
    entradas: suma(movPlantaV.filter((m) => m.tipo === "ENTRADA_GANDOLA" && entre(m.fecha, b)), (m) => m.kg),
    salidas: suma(movV.filter((m) => entre(m.fecha, b)), (m) => Math.abs(m.kg))
      + suma(movPlantaV.filter((m) => m.tipo === "SALIDA_GANDOLA" && entre(m.fecha, b)), (m) => m.kg),
    llenado: suma(movPlantaV.filter((m) => m.tipo === "LLENADO" && entre(m.fecha, b)), (m) => m.kg),
  }));
  const totGlp = { entradas: suma(serieGlp, (x) => x.entradas), salidas: suma(serieGlp, (x) => x.salidas) };

  const porSegmento = ["RESIDENCIAL", "COMERCIAL", "INSTITUCIONAL"].map((seg) => ({
    label: seg, ...resumenFacturas(facRango.filter((f) => segmentoUsuario(f.usuario) === seg)),
  }));
  const porConcepto = CONCEPTOS.map((c) => {
    const fs = facRango.filter((f) => f.concepto === c.id);
    return { ...c, total: suma(fs, (f) => f.total), docs: fs.length };
  }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 7);
  // Cada CDT con sus propias cifras: facturado en el rango contra lo pendiente por despachar hoy.
  const porCDT = cdtsAlcance.map((c) => ({
    label: c.corto, a: suma(facRango.filter((f) => f.cdt === c.id), (f) => f.total),
    b: cifrasPorCdt[c.id]?.dinero.pendienteDespacho.bs || 0,
  }));
  const dona = ESTADOS_DONA.map((k) => ({ k, label: estadoSolicitud(k).admin, value: pe[k] || 0, color: COLOR_ESTADO[k] }));
  const hoyTxt = fechaCorta(HOY);
  const etiquetaFact = rango === "MES" ? "Facturado del período" : rango === "DIA" ? "Facturado hoy" : "Facturado · últimos 7 días";

  return (
    <div className="cm-dash">
      <div className="cm-dash-head">
        <div>
          <div className="cm-dash-eyebrow">Gestión comercial · {rangoInfo.etiqueta}</div>
          <h2>Panel ejecutivo de Comercialización</h2>
          <p>Facturación, dinero de los usuarios, inventario y AD desde una sola fuente de cifras. El rango mide
            lo facturado; lo demás es la foto del {fecha(HOY)}.</p>
        </div>
        <div className="cm-range">
          {RANGOS.map(([k, l]) => <button key={k} className={rango === k ? "on" : ""} onClick={() => setRango(k)}>{l}</button>)}
        </div>
      </div>

      <div className="cm-top-kpis">
        <DashMetric label={etiquetaFact} value={`Bs ${bs(fact.total)}`} tone="money" click={() => ir("libro")}
          note={`${num(fact.docs)} documentos · base Bs ${bs(fact.base)} · IVA Bs ${bs(fact.iva)}${rango === "MES" ? " · igual al libro de ventas" : ""}`} />
        <DashMetric label={`Pendiente por despachar · al ${hoyTxt}`} value={`Bs ${bs(d.pendienteDespacho.bs)}`} tone="warn"
          click={() => ir("solicitudes", "PAGADA")}
          note={<>{num(d.pendienteDespacho.n)} pedidos pagados · <KgL kg={d.pendienteDespacho.kg} /> de GLP</>} />
        <DashMetric label={`Por completar · al ${hoyTxt}`} value={`Bs ${bs(d.porCompletar.recibido)}`} tone="soft"
          click={() => ir("solicitudes", "POR_COMPLETAR")}
          note={`${num(d.porCompletar.n)} pedidos con su pago aplicado · faltan Bs ${bs(d.porCompletar.faltante)}`} />
        <DashMetric label={`Saldo a favor · al ${hoyTxt}`} value={`Bs ${bs(d.saldoFavor.bs)}`} tone="blue" click={() => ir("saldos")}
          note={`${num(d.saldoFavor.usuarios)} usuarios · se descuenta solo en su próximo pedido`} />
      </div>

      <section className="cm-poder">
        <div className="cm-poder-h">
          <Landmark size={18} />
          <div><span>Dinero de usuarios en poder de la empresa · al {fecha(HOY)}</span><b>Bs {bs(d.enPoderDeLaEmpresa)}</b></div>
        </div>
        <div className="cm-poder-suma">
          <div><span>Pendiente por despachar</span><b>Bs {bs(d.pendienteDespacho.bs)}</b></div>
          <i>+</i>
          <div><span>Servicios por prestar</span><b>Bs {bs(d.serviciosPorPrestar.bs)}</b><small>{num(d.serviciosPorPrestar.n)} pagados</small></div>
          <i>+</i>
          <div><span>Por completar · recibido</span><b>Bs {bs(d.porCompletar.recibido)}</b></div>
          <i>+</i>
          <div><span>Saldo a favor</span><b>Bs {bs(d.saldoFavor.bs)}</b></div>
        </div>
        <p>Cobrado y todavía sin venta: la venta nace al cerrar el AD o al culminar el servicio. No hay reembolsos;
          lo que no se despacha termina como saldo a favor del usuario.</p>
      </section>

      <div className="cm-period-strip">
        <span>Facturación contra el tramo anterior · {fecha(rangoInfo.prevInicio)} – {fecha(rangoInfo.prevFin)}</span>
        <Variacion v={vTotal} label="Monto facturado" />
        <Variacion v={vDocs} label="Documentos emitidos" />
      </div>

      <section className="cm-chart cm-money-chart">
        <ChartHead title="Facturación por día" subtitle={`Cierre de AD, servicios O.A.U., talonario y ventas sin contrato · ${rangoInfo.etiqueta}`}
          right={<button className="cm-chart-link" onClick={() => ir("libro")}>Libro de ventas <ChevronRight size={13} /></button>} />
        <GroupedBars data={serieFact} series={[{ key: "facturado", label: "Facturado", cls: "blue" }]} money single />
        <div className="cm-money-foot">
          <div><span>Documentos</span><b>{num(fact.docs)}</b></div>
          <div><span>Base imponible</span><b>Bs {bs(fact.base)}</b></div>
          <div><span>IVA facturado</span><b>Bs {bs(fact.iva)}</b></div>
        </div>
      </section>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Inventario GLP por CDT" subtitle={`Físico, comprometido, disponible y llenado por cerrar · al ${hoyTxt}`}
            right={<button className="cm-chart-link" onClick={() => ir("inventario")}>Ver inventario <ChevronRight size={13} /></button>} />
          <InventoryBars cdts={cdtsAlcance} existencias={existencias} compromisos={compromisos} disponibles={disponibles} porCerrar={porCerrar} />
          <div className="cm-inventory-total">
            <span>Inventario físico</span><b><KgL kg={g.fisico} /></b>
            <span>Comprometido</span><b><KgL kg={g.comprometido} /></b>
            <span>Disponible</span><b><KgL kg={g.disponible} /></b>
            <span>Llenado por cerrar</span><b><KgL kg={g.llenadoPorCerrar} /></b>
          </div>
        </section>

        <section className="cm-chart">
          <ChartHead title="Solicitudes y AD" subtitle={`Cada solicitud en su estado · al ${hoyTxt}`}
            right={<button className="cm-chart-link" onClick={() => ir("solicitudes", "EN_AD")}>Seguimiento <ChevronRight size={13} /></button>} />
          <div className="cm-donut-wrap">
            <DonutChart values={dona.map((x) => x.value)} colors={dona.map((x) => x.color)} center={cifras.solicitudes.total} centerLabel="solicitudes" />
            <div className="cm-donut-legend">
              {dona.map((x) => <DonutRow key={x.k} label={x.label} value={x.value} total={cifras.solicitudes.total} color={x.color} />)}
            </div>
          </div>
          <div className="cm-ad-strip">
            <div><span>AD activas</span><b>{num(ad.activas)}</b><small>{num(ad.enJornada)} en jornada</small></div>
            <div><span>AD cerradas</span><b>{num(ad.cerradas)}</b><small>{num(ad.entregadas)} entregas</small></div>
            <div><span>Por planificar</span><b>{num(ad.porPlanificar)}</b><small>{num(ad.personasPorPlanificar)} personas pagadas</small></div>
            <div><span>Por replanificar</span><b>{num(cifras.replanificacion.n)}</b><small>{num(cifras.replanificacion.prioridad)} con prioridad</small></div>
          </div>
        </section>
      </div>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Movimiento de GLP" subtitle={`Entradas por gandola, salidas (BOP, talonario y gandola) y llenado de la jornada · ${rangoInfo.etiqueta}`}
            right={<div className="cm-head-r"><Legend items={[["Entradas", "#1c7a50"], ["Salidas", "#d08a24"], ["Llenado", "#2d65b0"]]} /><NotaFactor /></div>} />
          <GroupedBars data={serieGlp} kg series={[{ key: "entradas", label: "Entradas", cls: "green" }, { key: "salidas", label: "Salidas", cls: "amber" }, { key: "llenado", label: "Llenado", cls: "blue" }]} />
          <div className="cm-money-foot">
            <div><span>Entradas del rango</span><b><KgL kg={totGlp.entradas} /></b></div>
            <div><span>Salidas del rango</span><b><KgL kg={totGlp.salidas} /></b></div>
            <div><span>Llenado por cerrar · hoy</span><b><KgL kg={g.llenadoPorCerrar} /></b></div>
          </div>
        </section>

        <section className="cm-chart">
          <ChartHead title="Facturación por segmento" subtitle={`Residencial, comercial e institucional · ${rangoInfo.etiqueta}`} />
          <SegmentBars rows={porSegmento} />
        </section>
      </div>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Ingresos por concepto" subtitle={`Top de conceptos facturados · ${rangoInfo.etiqueta}`} />
          <RankBars rows={porConcepto.map((c) => ({ label: c.nombre, value: c.total, note: `${c.docs} docs.` }))} />
        </section>
        <section className="cm-chart">
          <ChartHead title="Desempeño por CDT" subtitle={`Facturado · ${rangoInfo.etiqueta} · contra lo pendiente por despachar al ${hoyTxt}`} />
          <CompareBars rows={porCDT} />
        </section>
      </div>

      <div className="conc-bar cm-conc">
        <div className="conc-ico"><Zap size={18} /></div>
        <div><b>Pagos resueltos por la API · nadie concilia a mano</b>
          <span>{num(log.exactos)} exactos · {num(log.resueltas.length)} resueltos por regla (de más, de menos o
            referencia repetida) · {num(log.revertidas)} revertidos por reclamo. Cada referencia queda trazable en la
            ficha 360° del usuario.</span></div>
        <button className="conc-monto conc-link" onClick={() => ir("solicitudes", "REGLA")}>{pctTxt(log.tasaAuto)} automático <ChevronRight size={14} /></button>
      </div>

      <div className="cm-mini-actions">
        <button onClick={() => ir("solicitudes", "PAGADA")}><Clock3 size={15} /><span>Pagadas · por planificar</span><b>{num(pe.PAGADA || 0)}</b></button>
        <button onClick={() => ir("inventario")}><Gauge size={15} /><span>Disponible real</span><b><KgL kg={g.disponible} /></b></button>
        <button onClick={() => ir("solicitudes", "EN_AD")}><ClipboardList size={15} /><span>Convocadas en AD</span><b>{num(pe.EN_AD || 0)}</b></button>
        <button onClick={() => ir("reclamos")}><MessageSquareWarning size={15} /><span>Reclamos abiertos</span><b>{num(recAbiertos.length)}</b></button>
      </div>
    </div>
  );
}

function Variacion({ v, label }) {
  return (
    <div>
      {v == null ? <b className="sin-base">— sin base</b> : <b>{v >= 0 ? "↑" : "↓"} {pctTxt(Math.abs(v))}</b>}
      <small>{label}{v == null ? " · el tramo anterior no tiene con qué comparar" : ""}</small>
    </div>
  );
}
function DashMetric({ label, value, note, tone = "default", click }) { return <button className={`cm-dash-metric ${tone} ${click ? "click" : ""}`} onClick={click}><span>{label}</span><b>{value}</b><small>{note}</small></button>; }
function ChartHead({ title, subtitle, right }) { return <div className="cm-chart-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{right}</div>; }
function Legend({ items }) { return <div className="cm-legend">{items.map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>; }
function GroupedBars({ data, series, money = false, kg = false, single = false }) {
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key] || 0))));
  // Ningún kilo sin su litro: el globo de una barra de GLP dice las dos medidas.
  const txt = (v) => (money ? `Bs ${bs(v)}` : kg ? kgYL(v) : num(v));
  return <div className={`cm-group-bars ${data.length > 10 ? "dense" : ""} ${single ? "single" : ""}`}>{data.map((d) => <div className="cm-gcol" key={d.key}><div className="cm-gbars">{series.map((s) => { const v = Number(d[s.key] || 0); return <div key={s.key} className={`cm-gbar ${s.cls}`} style={{ height: `${Math.max(v > 0 ? 4 : 0, (v / max) * 100)}%` }} title={`${s.label}: ${txt(v)}`} />; })}</div><span>{d.label}</span></div>)}</div>;
}
function InventoryBars({ cdts, existencias, compromisos, disponibles, porCerrar = {} }) {
  return <div className="cm-inv-list">{cdts.map((c) => {
    const fis = Number(existencias[c.id] || 0), comp = Number(compromisos[c.id] || 0), disp = Math.max(0, Number(disponibles[c.id] || 0));
    const lln = Number(porCerrar[c.id] || 0), cap = Math.max(c.capacidad || 1, fis);
    return <div className="cm-inv-row" key={c.id}>
      <div className="cm-inv-name"><b>{c.corto}</b><span><KgL kg={fis} /> físicos</span></div>
      <div className="cm-inv-track"><div className="cm-inv-disp" style={{ width: `${Math.min(100, (disp / cap) * 100)}%` }} /><div className="cm-inv-comp" style={{ width: `${Math.min(100, (comp / cap) * 100)}%` }} /></div>
      <div className="cm-inv-val"><b><KgL kg={disp} /></b><span>disponibles{lln > 0 && <> · <KgL kg={lln} /> llenados por cerrar</>}</span></div>
    </div>;
  })}</div>;
}
function DonutChart({ values, colors, center, centerLabel }) { const sum = Math.max(1, values.reduce((a, b) => a + b, 0)); let acc = 0; const stops = values.map((v, i) => { const a = acc / sum * 360; acc += v; const b = acc / sum * 360; return `${colors[i]} ${a}deg ${b}deg`; }).join(","); return <div className="cm-donut" style={{ background: `conic-gradient(${stops})` }}><div><b>{num(center)}</b><span>{centerLabel}</span></div></div>; }
function DonutRow({ label, value, total, color }) { return <div className="cm-donut-row"><i style={{ background: color }} /><div><span>{label}</span><b>{num(value)}</b></div><em>{total ? pctTxt((value / total) * 100) : "0%"}</em></div>; }
function SegmentBars({ rows }) { const max = Math.max(1, ...rows.map((r) => r.total)); return <div className="cm-seg-list">{rows.map((r) => <div className="cm-seg" key={r.label}><div className="cm-seg-head"><span>{r.label}</span><b>Bs {bs(r.total)}</b></div><div className="cm-seg-track"><div style={{ width: `${(r.total / max) * 100}%` }} /></div><small>{r.docs} documentos · IVA Bs {bs(r.iva)}</small></div>)}</div>; }
function RankBars({ rows }) { const max = Math.max(1, ...rows.map((r) => r.value)); return <div className="cm-rank">{rows.length ? rows.map((r, i) => <div className="cm-rank-row" key={`${r.label}-${i}`}><span className="cm-rank-n">{i + 1}</span><div className="cm-rank-main"><div><span>{r.label}</span><small>{r.note}</small></div><div className="cm-rank-track"><div style={{ width: `${(r.value / max) * 100}%` }} /></div></div><b>Bs {bs(r.value)}</b></div>) : <div className="empty">Sin facturación para el filtro seleccionado.</div>}</div>; }
function CompareBars({ rows }) { const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b])); return <div className="cm-compare">{rows.map((r) => <div className="cm-compare-row" key={r.label}><span>{r.label}</span><div><div className="cm-compare-bar"><i className="a" style={{ width: `${(r.a / max) * 100}%` }} /><em>Facturado Bs {bs(r.a)}</em></div><div className="cm-compare-bar"><i className="b" style={{ width: `${(r.b / max) * 100}%` }} /><em>Pendiente por despachar Bs {bs(r.b)}</em></div></div></div>)}</div>; }

const Kpi = ({ label, valor, pie, tono, click }) => (
  <div className={`kpi ${tono} ${click ? "clickable" : ""}`} onClick={click}>
    <div className="kpi-l">{label}</div><div className="kpi-v">{valor}</div><div className="kpi-p">{pie}</div>
  </div>
);
/* El nombre, el color y la explicación del estado salen del catálogo único de estados. */
const TONO_CHIP = { gris: "st-gris", ambar: "st-pag", verde: "st-cul", azul: "st-con" };
const EstadoChip = ({ estado }) => {
  const e = estadoSolicitud(estado);
  return <span className={`chip ${TONO_CHIP[e.tono] || "st-gris"}`} title={e.adminDesc}>{e.admin}</span>;
};

/* ═══════════════════════════════════════════════════════════════
   SOLICITUDES · el padrón único de pedidos
   Antes el mismo conjunto estaba troceado en cinco entradas de menú —
   seguimiento, recaudación por despachar, despachos especiales,
   conciliación e incidencias — que solo se diferenciaban por el filtro.
   Aquí residen todas, y los filtros son filtros, no módulos.
   ═══════════════════════════════════════════════════════════════ */

/* Cómo se llama, en la pantalla, cada cosa que la regla no puede cerrar sola. */
const TIPO_PATRON = {
  REFERENCIA_COMPARTIDA: {
    titulo: "Un comprobante, varios códigos",
    desc: "La misma referencia bancaria la reportaron personas distintas. Eso no es un error de tecleo.",
  },
  REINTENTO_INSISTENTE: {
    titulo: "Insisten con el mismo comprobante",
    desc: "Volvieron a mandar la referencia que ya se les rechazó. Probablemente no entienden por qué.",
  },
  RECHAZOS_REPETIDOS: {
    titulo: "Códigos con varios rechazos",
    desc: "Acumulan más de un pago rechazado en el ciclo. O tienen un problema de datos, o están probando.",
  },
};

const SEGMENTOS_SOL = [
  ["TODAS", "Todas"], ["SIN_PAGO", "Sin pago"], ["POR_COMPLETAR", "Por completar"],
  ["PAGADA", "Pagadas · por planificar"], ["EN_AD", "En AD"], ["POR_REPLANIFICAR", "Por replanificar"],
  ["CULMINADO", "Entregadas"], ["ABONADA", "Abonadas"], ["REGLA", "Resueltas por regla"], ["ESPECIAL", "Despachos especiales"],
];
/* Sólo se revierte una referencia rechazada por repetida: es lo único que la regla le niega
   al usuario sin que él pueda arreglarlo. Un pago corto no se revierte: se completa. */
const esDuplicadaRechazada = (s) => s.pago?.estado === "RECHAZADO" && s.pago.regla === "REFERENCIA_DUPLICADA" && !s.pago.revertida;
/* Referencias que ya respaldan un pedido: la misma lista con que la API rechaza una
   referencia repetida (el pago vigente de cada pedido y los complementos con que se completó). */
const referenciasEnUso = (sols) => new Set(sols.flatMap((s) => [
  s.pago?.estado !== "RECHAZADO" ? s.pago?.referencia : null,
  ...((s.pago?.complementos || []).map((c) => c.referencia)),
]).filter(Boolean));
const bsOGuion = (v) => (Number(v) > 0.009 ? `Bs ${bs(v)}` : "—");

function VistaSolicitudes({ solV, todas = [], cifras, patrones = [], segmento, setDoc, boletas = [], facturas = [], parqueEnvases = [], saldos = {},
  onIncidencia, onRevertir, onCrearManual, onCompletarPago, onCulminarServicio }) {
  const [q, setQ] = useState(""); const [f, setF] = useState(segmento || "TODAS");
  const [pagina, setPagina] = useState(1);
  const [abonar, setAbonar] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [verPatrones, setVerPatrones] = useState(false);
  const [revertir, setRevertir] = useState(null);
  const [culminar, setCulminar] = useState(null);
  const [completar, setCompletar] = useState(null);
  const porPagina = 50;

  const conc = useMemo(() => bitacoraPagos(solV), [solV]);
  // Agrupados por tipo: si se listaran de corrido, los de severidad alta coparían la
  // pantalla y los otros dos tipos no se verían nunca.
  const grupoPatrones = useMemo(() => patrones.reduce((acc, p) => {
    (acc[p.tipo] ||= []).push(p); return acc;
  }, {}), [patrones]);

  const grupos = useMemo(() => {
    const por = (k) => solV.filter((s) => s.estado === k);
    return {
      TODAS: solV, SIN_PAGO: por("SIN_PAGO"), POR_COMPLETAR: por("POR_COMPLETAR"), PAGADA: por("PAGADA"),
      EN_AD: por("EN_AD"), POR_REPLANIFICAR: por("POR_REPLANIFICAR"), CULMINADO: por("CULMINADO"), ABONADA: por("ABONADA"),
      REGLA: solV.filter((s) => s.pago?.regla && s.pago.regla !== "EXACTO"),
      ESPECIAL: solV.filter((s) => s.tipoDespacho !== "COMERCIAL"),
    };
  }, [solV]);
  const pe = cifras.solicitudes.porEstado || {};
  const facPorSol = useMemo(() => new Map(facturas.filter((x) => x.sol).map((x) => [x.sol, x])), [facturas]);
  const bopPorId = useMemo(() => new Map(boletas.map((b) => [b.id, b])), [boletas]);
  // Quién tiene hoy la referencia que a este pedido se le rechazó por repetida.
  const titularDe = (s) => {
    const ref = s.pago?.referencia;
    return ref ? todas.find((x) => x.id !== s.id && ((x.pago?.referencia === ref && x.pago.estado !== "RECHAZADO")
      || (x.pago?.complementos || []).some((c) => c.referencia === ref))) : null;
  };

  const lista = useMemo(() => (grupos[f] || solV).filter((s) => {
    if (!q) return true;
    const u = usr(s.usuario);
    const t = q.toLowerCase();
    return u.nombre.toLowerCase().includes(t) || s.id.toLowerCase().includes(t)
      || String(s.ad || "").toLowerCase().includes(t) || String(u.doc || "").toLowerCase().includes(t)
      || String(u.contrato || "").includes(q) || String(s.pago?.referencia || "").includes(q);
  }), [grupos, f, q, solV]);

  useEffect(() => setPagina(1), [q, f]);
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const visibles = lista.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <>
      <div className="kpis">
        <Kpi label="Solicitudes en el sistema" valor={num(cifras.solicitudes.total)} pie="todas viven en esta pantalla" tono="azul" />
        <Kpi label="Por completar" valor={num(pe.POR_COMPLETAR || 0)} pie={`faltan Bs ${bs(cifras.dinero.porCompletar.faltante)}`} tono="ambar" click={() => setF("POR_COMPLETAR")} />
        {/* Los servicios pagados también esperan aquí, pero no reservan GLP ni pasan por un AD. */}
        <Kpi label="Pagadas · por planificar" valor={num(pe.PAGADA || 0)}
          pie={cifras.dinero.serviciosPorPrestar.n > 0
            ? `${num((pe.PAGADA || 0) - cifras.dinero.serviciosPorPrestar.n)} de gas con GLP reservado · ${num(cifras.dinero.serviciosPorPrestar.n)} servicios por prestar`
            : "pago verificado · GLP reservado"}
          tono="verde" click={() => setF("PAGADA")} />
        <Kpi label="En AD" valor={num(pe.EN_AD || 0)} pie="convocadas a una jornada" tono="gris" click={() => setF("EN_AD")} />
        <Kpi label="Por replanificar" valor={num(pe.POR_REPLANIFICAR || 0)} pie={`${num(cifras.replanificacion.prioridad)} con prioridad · las atiende Distribución`} tono="rojo" click={() => setF("POR_REPLANIFICAR")} />
        <Kpi label="Entregadas" valor={num(pe.CULMINADO || 0)} pie="facturadas al cerrar el AD o el servicio" tono="verde" click={() => setF("CULMINADO")} />
      </div>

      <div className="conc-bar">
        <div className="conc-ico"><Zap size={18} /></div>
        <div>
          <b>El pago lo resuelve la regla, no una persona</b>
          <span>La API confirma contra el banco y aplica la regla: {num(conc.exactos)} pagos cuadraron exactos y
            {" "}{num(conc.resueltas.length)} se resolvieron por regla — de más (el excedente va al saldo), de menos
            (queda por completar) o referencia repetida (se rechaza) — sin que nadie aprobara nada.
            {conc.revertidas > 0 ? ` ${num(conc.revertidas)} revertidas por reclamo.` : ""}</span>
        </div>
        <div className="conc-monto">{pctTxt(conc.tasaAuto)} automático</div>
      </div>

      {patrones.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2><ShieldAlert size={16} /> Requieren mirada humana <span className="cnt">{num(patrones.length)}</span></h2>
              <span className="card-note">Una regla decide sobre un pago aislado. Esto es repetición entre varios pagos — la regla no la ve, y es lo único de esta pantalla que alguien tiene que atender.</span>
            </div>
            <button className="btn sm" onClick={() => setVerPatrones((v) => !v)}>
              {verPatrones ? "Ocultar" : "Ver los casos"}
            </button>
          </div>
          {verPatrones && Object.entries(grupoPatrones).map(([tipo, casos]) => (
            <div className="pat-grupo" key={tipo}>
              <div className="pat-grupo-h">
                <b>{TIPO_PATRON[tipo]?.titulo || tipo}</b>
                <span className="cnt">{num(casos.length)}</span>
                <em>{TIPO_PATRON[tipo]?.desc}</em>
              </div>
              <div className="pat-lista">
                {casos.slice(0, 3).map((p) => (
                  <article className={`pat ${p.severidad}`} key={p.id}>
                    <div className="pat-h">
                      <span className="tag warn">{p.severidad === "alta" ? "Atender" : "Revisar"}</span>
                      <b>{p.titulo}</b>
                    </div>
                    <p>{p.detalle}</p>
                    <div className="pat-sols">
                      {p.solicitudes.slice(0, 6).map((s) => (
                        <button key={s.id} className="link mono" onClick={() => { setF("TODAS"); setQ(s.id); }}>{s.id}</button>
                      ))}
                      {p.solicitudes.length > 6 && <span className="muted">+{p.solicitudes.length - 6} más</span>}
                    </div>
                    <footer><ArrowRight size={12} /> {p.accion}</footer>
                  </article>
                ))}
                {casos.length > 3 && (
                  <div className="pat-mas muted">
                    y {num(casos.length - 3)} caso(s) más de este tipo. Búscalos por referencia
                    o por código en la lista de abajo.
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {f === "REGLA" && conc.porRegla.length > 0 && (
        <section className="card">
          <div className="card-h"><div><h2>Qué decidió el sistema y por qué</h2>
            <span className="card-note">Bitácora de consulta. Estas resoluciones ya se aplicaron.</span></div></div>
          <div className="inc-grid">
            {conc.porRegla.map((r) => (
              <div className={`inc-motivo ${r.severidad}`} key={r.id}>
                <b>{r.nombre}</b>
                <em>{r.total}</em>
                <span>{r.desc}</span>
                <small>{r.efecto}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <div><h2>Solicitudes <span className="cnt">{num(lista.length)}</span></h2>
            <span className="card-note">Todo pedido del sistema vive aquí. Las crea el portal —o la taquilla— y la API resuelve el pago; esta pantalla las consulta y atiende lo que queda pendiente.</span></div>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar solicitud, AD, usuario, contrato o referencia" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm primary" onClick={() => setNueva(true)}><Plus size={14} /> Registrar en taquilla</button>
          </div>
        </div>
        <div className="tabs seg">
          {SEGMENTOS_SOL.map(([k, l]) => (
            <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>
              {l} <em>{num((grupos[k] || []).length)}</em>
            </button>
          ))}
        </div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr>
            <th>Solicitud</th><th>AD</th><th>Fecha</th><th>Usuario</th><th>Concepto</th>
            <th className="r">Cant.</th><th>Tipo</th><th>Pago</th><th className="r">Total Bs</th>
            <th>Documentos</th><th>Estatus</th><th></th>
          </tr></thead>
          <tbody>
            {visibles.map((s) => {
              const c = cpt(s.concepto), u = usr(s.usuario), td = tpd(s.tipoDespacho);
              const fac = facPorSol.get(s.id);
              const bop = s.boleta ? bopPorId.get(s.boleta) : null;
              return (
                <tr key={s.id} className={u.portal ? "portal" : ""}>
                  <td className="mono strong">{s.id}{u.portal && <span className="pin" title="Usuario con portal activo">●</span>}</td>
                  <td className="mono">{s.ad || <span className="muted">—</span>}</td>
                  <td className="muted">{fechaCorta(s.fecha)}</td>
                  <td><div className="u-name">{u.nombre}</div><div className="u-doc">Contrato {u.contrato} · {s.comuna ? comunaOf(s.comuna).nombre : "—"} · {cdtOf(s.cdt).corto}</div></td>
                  <td className="c-name">{c.nombre}</td>
                  <td className="r mono">{num(s.cantidad)}</td>
                  <td>{s.tipoDespacho === "COMERCIAL" ? <span className="tag">Comercial</span> : <span className="tag alt">{td.nombre}</span>}</td>
                  <td><PagoCelda s={s} /></td>
                  <td className="r mono">{td.factura ? bs(s.total) : <span className="muted">—</span>}</td>
                  <td className="mono docs">
                    {s.boleta
                      ? (bop ? <button className="link" onClick={() => setDoc({ tipo: "boleta", data: bop })}>{s.boleta}</button> : <span>{s.boleta}</span>)
                      : <span className="muted">—</span>}
                    {fac && <button className="link" onClick={() => setDoc({ tipo: "factura", data: fac })}>{fac.serie}</button>}
                  </td>
                  <td><EstadoChip estado={s.estado} /></td>
                  <td className="r">
                    <div className="inc-acciones">
                      {s.pago?.regla && s.pago.regla !== "EXACTO" && (
                        <span className={`tag ${reglaPago(s.pago.regla).severidad === "alta" ? "warn" : "alt"}`}
                          title={s.pago.detalleRegla}>{reglaPago(s.pago.regla).nombre}</span>
                      )}
                      {esDuplicadaRechazada(s) &&
                        <button className="btn sm" onClick={() => setRevertir(s)}><Undo2 size={13} /> Revertir</button>}
                      {s.pago?.revertida && <span className="tag" title={`${s.pago.notaReversion || ""} — ${s.pago.revertidaPor || ""}`}>Revertida</span>}
                      {s.estado === "SIN_PAGO" && s.pago?.estado !== "RECHAZADO" && <span className="tag alt">Esperando pago</span>}
                      {s.estado === "POR_COMPLETAR" && s.tarifaPendiente && (
                        <span className="tag warn" title={`La tarifa cambió el ${fecha(s.tarifaPendiente.desde)}${s.tarifaAnterior ? ` · antes costaba Bs ${bs(s.tarifaAnterior.total)}` : ""}`}>Tarifa nueva</span>
                      )}
                      {s.estado === "POR_COMPLETAR" &&
                        <button className="btn sm primary" onClick={() => setCompletar(s)}><Wallet size={13} /> Completar pago</button>}
                      {/* Un servicio no sale en una AD: se culmina cuando el técnico lo prestó, y
                          ahí nace su boleta y su factura como en cualquier despacho. */}
                      {s.estado === "PAGADA" && !c.inv &&
                        <button className="btn sm primary" onClick={() => setCulminar(s)}><Wrench size={13} /> Servicio prestado</button>}
                      {["PAGADA", "POR_COMPLETAR"].includes(s.estado) && !s.ad && (s.incidencia?.consecuencia === "RETIENE" ? (
                        <>
                          <span className="tag warn tag-largo" title={`${s.incidencia.nota ? `${s.incidencia.nota} — ` : ""}registrada por ${s.incidencia.por}${s.incidencia.en ? ` el ${fecha(s.incidencia.en)}` : ""}`}>
                            Retenida: {s.incidencia.nombre}{s.incidencia.nota ? ` · ${s.incidencia.nota}` : ""}
                          </span>
                          <button className="btn sm" onClick={() => setAbonar(s)}>Cambiar</button>
                        </>
                      ) : <button className="btn sm" onClick={() => setAbonar(s)}><MessageSquareWarning size={13} /> Incidencia</button>)}
                      {s.estado === "POR_REPLANIFICAR" && <ProblemaTag p={s.problema} />}
                      {s.estado === "EN_AD" && <span className="tag">En jornada</span>}
                      {s.estado === "CULMINADO" && <span className="tag">{s.factura ? (s.servicio ? "Servicio facturado" : "Facturada al cerrar el AD") : "Despachada con boleta"}</span>}
                      {esAbonada(s) && <span className="tag alt" title={s.decisionAbono?.nota || ""}>{s.motivoNoCompra || "Abonada"}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lista.length && <div className="empty">No hay solicitudes con estos filtros.</div>}
      {paginas > 1 && (
        <div className="paginador">
          <span>Mostrando {visibles.length} de {num(lista.length)} solicitudes · página {pagina} de {paginas}</span>
          <div>
            <button className="btn sm" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
            <button className="btn sm" disabled={pagina >= paginas} onClick={() => setPagina((p) => Math.min(paginas, p + 1))}>Siguiente</button>
          </div>
        </div>
      )}
      </section>
      {abonar && <ModalIncidencia s={abonar} onClose={() => setAbonar(null)}
        onSave={(motivoId, nota, quien) => {
          const r = onIncidencia?.(abonar, motivoId, nota, quien);
          setAbonar(null);
          setAviso(r?.ok ? { tipo: "incidencia", solicitud: abonar, ...r }
            : { tipo: "incidencia", ok: false, error: r?.error || "No se pudo registrar la incidencia." });
        }} />}
      {culminar && <ModalServicio s={culminar} onClose={() => setCulminar(null)}
        onSave={(d) => {
          const r = onCulminarServicio?.(culminar, d);
          setCulminar(null);
          setAviso(r?.ok ? { tipo: "servicio", solicitud: culminar, ...r }
            : { tipo: "servicio", ok: false, error: r?.error || "No se pudo culminar el servicio." });
        }} />}
      {revertir && <ModalRevertir s={revertir} otra={titularDe(revertir)} onClose={() => setRevertir(null)}
        onSave={(nota, quien) => {
          const r = onRevertir?.(revertir, nota, quien);
          setRevertir(null);
          setAviso(r?.ok ? { tipo: "reversion", ok: true, solicitud: revertir, estado: r.estado }
            : { tipo: "reversion", ok: false, error: r?.error || "No se pudo revertir." });
        }} />}
      {completar && <ModalCompletarPago s={completar} saldo={Number(saldos[completar.usuario] || 0)} usadas={referenciasEnUso(todas)}
        onClose={() => setCompletar(null)}
        onSave={(d) => {
          const r = onCompletarPago?.(completar.id, d);
          if (r?.ok) { setCompletar(null); setAviso({ tipo: "completar", ...r }); }
          return r;
        }} />}
      {nueva && <ModalSolicitudManual parqueEnvases={parqueEnvases} todas={todas} saldos={saldos}
        onClose={() => setNueva(false)}
        onSave={(d) => {
          const r = onCrearManual?.(d);
          if (r?.ok) { setNueva(false); setAviso({ tipo: "taquilla", ...r }); }
          return r;
        }} />}
      {aviso && <ResultadoAviso aviso={aviso} onClose={() => setAviso(null)} />}
    </>
  );
}

/* Cómo se pagó: referencia, banco o canal, y lo que falte si quedó por completar. */
function PagoCelda({ s }) {
  const p = s.pago || {};
  if (p.estado === "NO_APLICA") return <span className="muted">No requiere pago</span>;
  if (!p.referencia) {
    return <span className="muted">{Number(s.saldoAplicado) > 0 ? "Con saldo a favor" : s.estado === "SIN_PAGO" ? "Sin pago" : "—"}</span>;
  }
  const rechazado = p.estado === "RECHAZADO";
  const via = p.banco ? nombreBanco(p.banco) : canalPago(p.canal).nombre;
  const complementos = (p.complementos || []).length;
  return (
    <div>
      <span className={rechazado ? "pago-bad" : "pago-ok"} title={`${via} · ref ${p.referencia}${p.detalleRegla ? ` · ${p.detalleRegla}` : ""}`}>
        {rechazado ? <X size={11} /> : <Zap size={11} />} {p.referencia}
      </span>
      {s.estado === "POR_COMPLETAR" && <div className="u-doc falta">faltan Bs {bs(faltanteDe(s))}</div>}
      {complementos > 0 && <div className="u-doc">+{complementos} complemento{complementos > 1 ? "s" : ""}</div>}
    </div>
  );
}

/* Por qué un pedido espera replanificación: qué pasó, en qué AD y hasta cuándo hay plazo. */
function ProblemaTag({ p }) {
  if (!p) return <span className="tag warn">Por replanificar</span>;
  const prioridad = p.imputable === "EMPRESA" || p.prioridad;
  return (
    <span className={`tag ${prioridad ? "warn" : "alt"} tag-largo`} title={p.nota || p.nombre}>
      {prioridad ? "Prioridad · " : ""}{p.nombre}{p.adOrigen ? ` · AD ${p.adOrigen}` : ""}{p.plazo ? ` · plazo ${fechaCorta(p.plazo)}` : ""}
    </span>
  );
}

/* Lo que devolvió el sistema, contado tal cual: estado final, regla, saldo aplicado,
   excedente y lo que falte. Nada se da por hecho antes de ver la respuesta. */
const EYEBROW_AVISO = { taquilla: "Registro en taquilla", completar: "Completar pago", incidencia: "Incidencia", servicio: "Servicio prestado", reversion: "Reversión" };
const ERROR_AVISO = { taquilla: "No se pudo registrar", completar: "No se pudo completar el pago", incidencia: "No se pudo registrar la incidencia", servicio: "No se pudo culminar el servicio", reversion: "No se pudo revertir" };

function ResultadoAviso({ aviso, onClose }) {
  const { tipo } = aviso;
  const s = aviso.solicitud;
  let titulo = ERROR_AVISO[tipo];
  let cuerpo = <div className="cg2-err">{aviso.error}</div>;

  if (aviso.ok && tipo === "taquilla") {
    const e = estadoSolicitud(s.estado);
    const rechazada = s.pago?.estado === "RECHAZADO";
    titulo = rechazada ? "Registrada · pago rechazado" : s.estado === "POR_COMPLETAR" ? "Registrada · falta completar el pago" : "Solicitud registrada";
    cuerpo = (
      <>
        <div className="rec-meta">
          <div><span>Solicitud</span><b>{s.id}</b></div>
          <div><span>Regla aplicada</span><b>{aviso.regla ? reglaPago(aviso.regla).nombre : "No requiere pago"}</b></div>
          <div><span>Estado</span><b>{e.admin}</b></div>
          <div><span>Saldo a favor aplicado</span><b>{bsOGuion(aviso.devengado)}</b></div>
          <div><span>Excedente al saldo</span><b>{bsOGuion(aviso.excedente)}</b></div>
          <div><span>Falta por completar</span><b>{bsOGuion(aviso.faltante)}</b></div>
        </div>
        <div className={`inv-regla ${s.estado === "PAGADA" ? "" : "alt"}`} style={{ marginTop: 12 }}>
          {s.estado === "PAGADA" ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
          <div>
            <b>{aviso.regla ? reglaPago(aviso.regla).efecto : e.adminDesc}</b>
            <span>{aviso.detalle ? `${aviso.detalle}. ` : ""}
              {s.estado === "PAGADA" && "El GLP queda reservado y el pedido entra a la próxima AD de su comuna."}
              {s.estado === "POR_COMPLETAR" && `Lo recibido quedó aplicado. Cuando traiga la diferencia se completa desde su fila con «Completar pago»; si no se completa antes del ${fecha(finDeCiclo(HOY))}, pasa a su saldo a favor.`}
              {rechazada && "La referencia ya respalda otro pedido. Si el usuario demuestra que el pago es suyo, se revierte desde su fila."}
            </span>
          </div>
        </div>
        {aviso.avisoEnvase && (
          <div className="inv-regla alt" style={{ marginTop: 10 }}><AlertTriangle size={17} /><div>
            <b>Aviso del parque de envases · no bloquea el pedido</b><span>{aviso.avisoEnvase}</span>
          </div></div>
        )}
      </>
    );
  } else if (aviso.ok && tipo === "completar") {
    titulo = aviso.completo ? "Pago completado" : "Pago aplicado · aún falta";
    cuerpo = (
      <>
        <div className="rec-meta">
          <div><span>Solicitud</span><b>{s.id}</b></div>
          <div><span>Estado</span><b>{estadoSolicitud(s.estado).admin}</b></div>
          <div><span>Saldo a favor aplicado</span><b>{bsOGuion(aviso.devengado)}</b></div>
          <div><span>Excedente al saldo</span><b>{bsOGuion(aviso.excedente)}</b></div>
          <div><span>Falta</span><b>{bsOGuion(aviso.faltante)}</b></div>
        </div>
        <div className={`inv-regla ${aviso.completo ? "" : "alt"}`} style={{ marginTop: 12 }}>
          {aviso.completo ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}
          <div><b>{aviso.completo ? "Queda pagada: el GLP se reserva y entra a la próxima AD" : "Sigue por completar"}</b>
            <span>{aviso.completo ? "Sale de «por completar» y pasa a «pendiente por despachar»." : `Lo recibido quedó aplicado al pedido. Faltan Bs ${bs(aviso.faltante)}.`}
              {Number(aviso.excedente) > 0.009 ? ` Lo que sobró (Bs ${bs(aviso.excedente)}) quedó en su saldo a favor.` : ""}</span></div>
        </div>
      </>
    );
  } else if (aviso.ok && tipo === "incidencia") {
    titulo = aviso.cierra ? "Pedido cerrado y abonado" : "Pedido retenido";
    cuerpo = (
      <>
        <div className="rec-meta">
          <div><span>Solicitud</span><b>{s.id}</b></div>
          <div><span>Incidencia</span><b>{aviso.motivo.nombre}</b></div>
          <div><span>Queda</span><b>{aviso.cierra ? "Abonada · cerrada" : `${estadoSolicitud(s.estado).admin} · retenida`}</b></div>
          <div><span>Abonado</span><b>{aviso.cierra ? bsOGuion(aviso.monto) : "—"}</b></div>
        </div>
        <div className={`inv-regla ${aviso.cierra ? "" : "alt"}`} style={{ marginTop: 12 }}>
          {aviso.cierra ? <Wallet size={17} /> : <Clock3 size={17} />}
          <div>
            <b>{aviso.cierra ? "El dinero queda a favor del usuario" : "El pedido sigue vivo"}</b>
            <span>{aviso.cierra
              ? (Number(aviso.monto) > 0.009
                ? `Bs ${bs(aviso.monto)} pasaron al saldo del código ${s.usuario}. No es un reembolso: se descuenta solo en su próximo pedido, contra la tarifa vigente.`
                : "No había dinero aplicado que abonar.")
              : "Conserva su estado y su dinero, con la constancia de por qué está detenido y quién lo registró. Cuando se resuelva, sigue su curso normal."}</span>
          </div>
        </div>
      </>
    );
  } else if (aviso.ok && tipo === "servicio") {
    titulo = "Servicio culminado y facturado";
    cuerpo = (
      <>
        <div className="rec-meta">
          <div><span>Solicitud</span><b>{s.id}</b></div>
          <div><span>Boleta</span><b className="mono">{aviso.boleta}</b></div>
          <div><span>Factura</span><b className="mono">{aviso.serie || "No aplica"}</b></div>
          <div><span>Facturado</span><b>{aviso.factura ? `Bs ${bs(aviso.total)}` : "—"}</b></div>
        </div>
        <div className="inv-regla" style={{ marginTop: 12 }}><BookText size={17} /><div>
          <b>El servicio quedó culminado y asentado</b>
          <span>{aviso.factura
            ? `La factura ${aviso.serie} ya está en el libro de ventas con fecha de hoy. El pedido sale de "servicios por prestar".`
            : "Se emitió la boleta como soporte. Por el tipo de despacho no corresponde factura."}</span>
        </div></div>
      </>
    );
  } else if (aviso.ok && tipo === "reversion") {
    titulo = "Rechazo revertido";
    cuerpo = (
      <>
        <div className="rec-meta">
          <div><span>Solicitud</span><b>{s.id}</b></div>
          <div><span>Queda</span><b>{estadoSolicitud(aviso.estado).admin}</b></div>
        </div>
        <div className="inv-regla" style={{ marginTop: 12 }}><Undo2 size={17} /><div>
          <b>El pago se acepta como suyo</b>
          <span>{aviso.estado === "PAGADA"
            ? "El GLP queda reservado y el pedido entra a la próxima AD."
            : "Lo transferido no cubre el pedido: queda por completar la diferencia."} La reversión queda en la bitácora con su motivo y quién la hizo.</span>
        </div></div>
      </>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-h"><div>
          <div className="mh-eyebrow">{EYEBROW_AVISO[tipo]}</div>
          <h3>{titulo}</h3></div></div>
        <div className="modal-b">{cuerpo}</div>
        <div className="modal-f"><button className="btn primary" onClick={onClose}>Entendido</button></div>
      </div>
    </div>
  );
}

/* Canal, banco, monto y referencia: lo mismo en la taquilla y al completar un pago.
   El banco sólo aparece en los canales que pasan por un banco; el efectivo en campo se
   controla por arqueo de caja. El monto se escribe como se escribe aquí: 1.300,50. */
function CamposCobro({ d, setD, porPagar }) {
  const canal = canalPago(d.canal);
  const porBanco = canal.conciliable;
  const monto = d.monto === "" ? porPagar : parseBs(d.monto);
  return (
    <>
      <div className="row2">
        <label className="campo"><span>Canal</span>
          <select value={d.canal} onChange={(e) => {
            const nuevo = e.target.value;
            setD({ ...d, canal: nuevo, banco: nuevo === "PAGO_MOVIL" ? "PM" : d.banco === "PM" ? "BDV" : d.banco });
          }}>
            {CANALES_PAGO.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></label>
        {porBanco ? (
          <label className="campo"><span>Banco</span>
            <select value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })}>
              {BANCOS.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select></label>
        ) : <div className="cg2-hint">{canal.desc}.</div>}
      </div>
      <div className="row2">
        <label className="campo"><span>Monto recibido Bs</span>
          <input inputMode="decimal" value={d.monto} placeholder={bs(porPagar)}
            onChange={(e) => setD({ ...d, monto: e.target.value.replace(/[^\d.,]/g, "") })} /></label>
        <label className="campo"><span>Referencia{porBanco ? "" : " (opcional)"}</span>
          <input value={d.referencia} onChange={(e) => setD({ ...d, referencia: e.target.value })}
            placeholder={porBanco ? "Número de la operación bancaria" : "Número del recibo de caja"} /></label>
      </div>
      {d.monto !== "" && !Number.isFinite(monto) && <div className="cg2-err">El monto no es válido. Escríbalo así: 1.300,50</div>}
      {porBanco && d.referencia.trim().length < 4 && (
        <div className="cg2-hint">La referencia bancaria es obligatoria: es lo que la API revisa para no aceptar dos veces el mismo pago.</div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REGISTRO EN TAQUILLA · la única vía manual
   El portal crea las solicitudes solo. Esto existe para quien llega al CDT sin
   usarlo: el operador anota todo y queda constancia de quién lo hizo y por qué.
   La regla de pago se aplica igual — nadie decide a mano lo que la regla resuelve.
   ═══════════════════════════════════════════════════════════════ */

function ModalSolicitudManual({ parqueEnvases = [], todas = [], saldos = {}, onClose, onSave }) {
  const MOTIVOS = [
    "El usuario no tiene acceso al portal",
    "Compra presencial en el CDT",
    "Pago recibido en taquilla",
    "Corrección de un registro anterior",
    "Otro motivo",
  ];
  const [d, setD] = useState({
    usuario: USUARIOS[1].id, concepto: "BOMB_18", cantidad: "1", canal: "TAQUILLA",
    banco: "BDV", referencia: "", monto: "", motivoRegistro: MOTIVOS[0],
    operador: "M. Álvarez", observacion: "",
  });
  const [err, setErr] = useState(null);
  const usadas = useMemo(() => referenciasEnUso(todas), [todas]);
  const u = usr(d.usuario);
  const c = cpt(d.concepto);
  const residencial = segmentoUsuario(u) === "RESIDENCIAL";
  // El residencial lleva una bombona por núcleo y ciclo: no se le pregunta cuántas.
  const pideCantidad = Boolean(c.granel) || !residencial;
  const cantidad = pideCantidad ? Number(d.cantidad) : 1;
  const cantidadOk = Number.isInteger(cantidad) && cantidad > 0;
  const porBanco = canalPago(d.canal).conciliable;
  const saldo = Number(saldos[u.id] || 0);
  const m = montos(d.concepto, cantidadOk ? cantidad : 1, u.id, HOY);
  // Igual que la API: primero el saldo a favor; la regla se aplica sobre lo que falta.
  const reparto = aplicarSaldo(m.total, saldo);
  const cubierto = reparto.porPagar <= 0.009;
  const recibido = d.monto === "" ? reparto.porPagar : parseBs(d.monto);
  const referencia = d.referencia.trim();
  const cupo = puedeSolicitar(u, todas, d.concepto, cantidadOk ? cantidad : 1);
  const canje = c.bombona ? validarCanje(envasesDe(parqueEnvases, u.id), c.kg) : { ok: true };
  // Previsión honesta: la misma regla que aplicará la API, contra todas las referencias en uso.
  const prevision = cubierto
    ? { regla: "EXACTO", detalle: "Cubierto por completo con su saldo a favor" }
    : Number.isFinite(recibido)
      ? aplicarReglaPago({ montoRecibido: recibido, totalFacturado: reparto.porPagar, referencia: referencia || null, referenciasVistas: usadas })
      : null;
  const motivoOk = d.motivoRegistro !== "Otro motivo" || d.observacion.trim().length > 5;
  const montoOk = cubierto || (Number.isFinite(recibido) && recibido > 0);
  const refOk = cubierto || !porBanco || referencia.length >= 4;
  const ok = cupo.ok && cantidadOk && montoOk && refOk && motivoOk;

  function registrar() {
    const r = onSave({
      usuario: u.id, concepto: d.concepto, cantidad, canal: d.canal, banco: !cubierto && porBanco ? d.banco : null,
      referencia: cubierto ? null : referencia || null, montoRecibido: cubierto ? 0 : recibido,
      motivoRegistro: d.motivoRegistro, observacion: d.observacion.trim(), operador: d.operador.trim() || "Comercialización",
      // El mismo criterio de la factura manual: la institución compra como institucional.
      tipoDespacho: u.tipo === "Institución" ? "INSTITUCION" : "COMERCIAL",
    });
    if (!r?.ok) setErr(r?.error || "No se pudo registrar la solicitud.");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Registro manual</div><h3>Nueva solicitud en taquilla</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="cg2-hint">Esta vía es la excepción. El portal genera las solicitudes solo y la API
            resuelve el pago; aquí se anota todo y se aplica lo mismo: tope por núcleo, saldo a favor primero y regla de pago.</div>

          <div className="row2">
            <label className="campo"><span>Usuario</span>
              <select value={d.usuario} onChange={(e) => setD({ ...d, usuario: e.target.value })}>
                {USUARIOS.map((x) => <option key={x.id} value={x.id}>{x.nombre} — contrato {x.contrato}</option>)}
              </select></label>
            <label className="campo"><span>Producto</span>
              <select value={d.concepto} onChange={(e) => setD({ ...d, concepto: e.target.value })}>
                {CONCEPTOS.filter((x) => !x.distribucionOnly).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select></label>
          </div>
          <div className="row2">
            {pideCantidad ? (
              <label className="campo"><span>{c.granel ? "Kilogramos" : c.bombona ? "Cilindros" : "Cantidad"}</span>
                <input type="number" min="1" step="1" value={d.cantidad} onChange={(e) => setD({ ...d, cantidad: e.target.value })} /></label>
            ) : (
              <div className="cg2-hint">{c.bombona ? "Uso residencial: una bombona por núcleo familiar y ciclo." : "Un trámite por solicitud."}</div>
            )}
            <div className="cg2-hint">
              {c.inv ? <>GLP del pedido: <KgL kg={c.kg * (cantidadOk ? cantidad : 0)} />. </> : "Servicio: no mueve inventario. "}
              Saldo a favor disponible: {saldo > 0.009 ? `Bs ${bs(saldo)}` : "ninguno"}.
            </div>
          </div>

          {!cupo.ok && <div className="cg2-err">{cupo.motivo}</div>}
          {pideCantidad && !cantidadOk && <div className="cg2-err">La cantidad debe ser un número entero mayor que cero.</div>}
          {!canje.ok && (
            <div className="inv-regla alt"><AlertTriangle size={17} /><div>
              <b>Aviso del parque de envases · no bloquea el registro</b><span>{canje.motivo}</span>
            </div></div>
          )}

          <div className="cg2-sep">Cobro</div>
          {cubierto
            ? <div className="cg2-hint">Su saldo a favor cubre el pedido completo: no hay nada que cobrar.</div>
            : <CamposCobro d={d} setD={setD} porPagar={reparto.porPagar} />}

          <div className="cg2-sep">Constancia del registro</div>
          <label className="campo"><span>Por qué se registra a mano</span>
            <select value={d.motivoRegistro} onChange={(e) => setD({ ...d, motivoRegistro: e.target.value })}>
              {MOTIVOS.map((x) => <option key={x}>{x}</option>)}
            </select></label>
          <div className="row2">
            <label className="campo"><span>Quién registra</span>
              <input value={d.operador} onChange={(e) => setD({ ...d, operador: e.target.value })} /></label>
            <label className="campo"><span>Observación</span>
              <input value={d.observacion} onChange={(e) => setD({ ...d, observacion: e.target.value })}
                placeholder={d.motivoRegistro === "Otro motivo" ? "Obligatoria" : "Opcional"} /></label>
          </div>

          <div className="preview">
            <div className="preview-h">Tarifa de hoy · {c.nombre}{pideCantidad && cantidadOk ? ` × ${num(cantidad)}` : ""}</div>
            <div className="preview-monto">Bs {bs(m.total)}</div>
            <div className="preview-det">
              Base {bs(m.base)} · IVA {m.exento ? "exonerado" : bs(m.iva)}
              {reparto.devengado > 0 ? ` · saldo a favor aplicado Bs ${bs(reparto.devengado)}` : ""} · por cobrar Bs {bs(reparto.porPagar)}
            </div>
          </div>
          {prevision && (
            <div className={`inv-regla ${["EXACTO", "MONTO_MAYOR"].includes(prevision.regla) ? "" : "alt"}`} style={{ marginTop: 10 }}><Zap size={17} /><div>
              <b>Si se registra así, la regla aplicará: {reglaPago(prevision.regla).nombre}</b>
              <span>{reglaPago(prevision.regla).efecto}. {prevision.detalle}.</span>
            </div></div>
          )}
          {err && <div className="cg2-err">{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={registrar}>
            <Check size={14} /> Registrar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * COMPLETAR UN PAGO · el pedido quedó corto: transfirió de menos o subió la tarifa.
 * Primero se descuenta solo el saldo a favor; lo que falte se cobra y la regla lo
 * resuelve igual que siempre. Nada se abona ni se cancela: el pedido espera la diferencia.
 */
function ModalCompletarPago({ s, saldo = 0, usadas, onClose, onSave }) {
  const [d, setD] = useState({ canal: "TAQUILLA", banco: "BDV", referencia: "", monto: "" });
  const [err, setErr] = useState(null);
  const u = usr(s.usuario);
  const faltante = faltanteDe(s);
  const reparto = aplicarSaldo(faltante, saldo);
  const cubierto = reparto.porPagar <= 0.009;
  const porBanco = canalPago(d.canal).conciliable;
  const recibido = d.monto === "" ? reparto.porPagar : parseBs(d.monto);
  const referencia = d.referencia.trim();
  // La misma lista con que la API rechaza: también cuenta el primer pago de este pedido.
  const duplicada = !cubierto && Boolean(referencia) && Boolean(usadas?.has(referencia));
  const montoOk = cubierto || (Number.isFinite(recibido) && recibido > 0);
  const refOk = cubierto || !porBanco || referencia.length >= 4;
  const valido = !cubierto && Number.isFinite(recibido);
  const resta = valido ? Math.max(0, reparto.porPagar - recibido) : 0;
  const sobra = valido ? Math.max(0, recibido - reparto.porPagar) : 0;

  function confirmar() {
    const r = onSave({
      montoRecibido: cubierto ? 0 : recibido, referencia: cubierto ? null : referencia || null,
      banco: !cubierto && porBanco ? d.banco : null, canal: d.canal,
    });
    if (!r?.ok) setErr(r?.error || "No se pudo completar el pago.");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Por completar</div>
          <h3>Completar el pago de {s.id}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Pedido</span><b>{cpt(s.concepto).corto} × {num(s.cantidad)}</b></div>
            <div><span>Total a la tarifa vigente</span><b>Bs {bs(s.total)}</b></div>
            <div><span>Ya cubierto</span><b>Bs {bs(cubiertoDe(s))}</b></div>
            <div><span>Falta</span><b>Bs {bs(faltante)}</b></div>
            <div><span>Saldo a favor</span><b>{bsOGuion(saldo)}</b></div>
          </div>
          <p className="modal-nota">{s.tarifaPendiente
            ? `La tarifa cambió el ${fecha(s.tarifaPendiente.desde)}${s.tarifaAnterior ? `: el pedido costaba Bs ${bs(s.tarifaAnterior.total)} y hoy cuesta Bs ${bs(s.total)}` : ""}. Lo pagado sigue aplicado; sólo falta la diferencia.`
            : `${s.pago?.detalleRegla || "Llegó menos de lo que cuesta el pedido"}. Lo recibido sigue aplicado; sólo falta la diferencia.`}</p>

          {reparto.devengado > 0 && (
            <div className="inv-regla"><Wallet size={17} /><div>
              <b>Primero se descuenta su saldo a favor: Bs {bs(reparto.devengado)}</b>
              <span>{cubierto ? "Con eso el pedido queda pagado: no hay nada que cobrar." : `Después de aplicarlo quedan Bs ${bs(reparto.porPagar)} por cobrar.`}</span>
            </div></div>
          )}
          {!cubierto && (
            <>
              <CamposCobro d={d} setD={setD} porPagar={reparto.porPagar} />
              {valido && duplicada && (
                <div className="inv-regla alt"><AlertTriangle size={17} /><div>
                  <b>Se rechazará: la referencia {referencia} ya respalda un pago registrado</b>
                  <span>El pedido seguiría por completar y no se toca su saldo. Pida el número de la nueva operación.</span>
                </div></div>
              )}
              {valido && !duplicada && (
                <div className={`inv-regla ${resta > 0.009 ? "alt" : ""}`}>
                  {resta > 0.009 ? <Clock3 size={17} /> : <CheckCircle2 size={17} />}
                  <div><b>{resta > 0.009 ? `Seguirá por completar: faltarán Bs ${bs(resta)}` : "Queda pagada y entra a la próxima AD"}</b>
                    <span>{sobra > 0.009 ? `Sobran Bs ${bs(sobra)}: la regla los pasa a su saldo a favor.`
                      : resta > 0.009 ? "Lo recibido se aplica igual; el pedido sigue esperando la diferencia."
                      : "El GLP queda reservado y el dinero pasa a «pendiente por despachar»."}</span></div>
                </div>
              )}
            </>
          )}
          {err && <div className="cg2-err">{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!(montoOk && refOk)} onClick={confirmar}>
            <Check size={14} /> {cubierto ? "Aplicar el saldo a favor" : "Registrar el pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SERVICIO PRESTADO · el cierre que faltaba para lo que no sale en gandola.
 *
 * Una visita técnica o un cambio de válvula no entran a un AD, así que no tenían forma
 * de culminarse: el pedido quedaba pagado para siempre. Esto dispara la misma cadena
 * contable —boleta, factura, libro de ventas— y pide lo único que sustenta un servicio:
 * quién lo prestó, cuándo y qué encontró.
 */
function ModalServicio({ s, onClose, onSave }) {
  const [d, setD] = useState({ atendio: "", receptor: "", informe: "", canal: "O.A.U." });
  const c = cpt(s.concepto);
  const u = usr(s.usuario);
  const td = tpd(s.tipoDespacho);
  const hoy = montos(s.concepto, s.cantidad, s.usuario, HOY);
  const ok = d.atendio.trim().length > 3;
  const CANALES = ["O.A.U.", "Visita a domicilio", "Taller de renovadora", "Taquilla del CDT"];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Servicio prestado</div>
          <h3>Culminar {c.corto.toLowerCase()}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Solicitud</span><b>{s.id}</b></div>
            <div><span>Servicio</span><b>{c.nombre}</b></div>
            <div><span>Solicitado</span><b>{fechaCorta(s.fecha)}</b></div>
          </div>

          <p className="modal-nota">Este concepto no mueve inventario: no hay cilindro que despachar
            ni ruta que cerrar. Se culmina cuando el trabajo está hecho, y ahí se factura.</p>

          <label className="campo"><span>Quién prestó el servicio</span>
            <input value={d.atendio} onChange={(e) => setD({ ...d, atendio: e.target.value })}
              placeholder="Nombre del técnico o del funcionario que atendió" /></label>
          <div className="grid2">
            <label className="campo"><span>Dónde se atendió</span>
              <select value={d.canal} onChange={(e) => setD({ ...d, canal: e.target.value })}>
                {CANALES.map((x) => <option key={x}>{x}</option>)}
              </select></label>
            <label className="campo"><span>Quién recibió <em className="op">(opcional)</em></span>
              <input value={d.receptor} onChange={(e) => setD({ ...d, receptor: e.target.value })}
                placeholder="Persona que recibió conforme" /></label>
          </div>
          <label className="campo"><span>Informe de lo realizado <em className="op">(opcional)</em></span>
            <textarea rows={2} value={d.informe} onChange={(e) => setD({ ...d, informe: e.target.value })}
              placeholder="Qué se encontró y qué se hizo. Queda en la boleta." /></label>

          <div className="inv-regla" style={{ marginTop: 12 }}><Receipt size={17} /><div>
            <b>Al confirmar se emite la boleta y {td.factura ? "la factura" : "el soporte de despacho"}</b>
            <span>
              {td.factura
                ? `Se factura Bs ${bs(hoy.total)} — la tarifa de hoy, no la del día en que lo pidió — y el asiento entra al libro de ventas con fecha de hoy.`
                : `${td.nombre}: no genera factura, pero sí boleta como soporte del servicio prestado.`}
              {Math.abs(hoy.total - Number(s.total || 0)) > 0.01 &&
                ` Cuando lo solicitó costaba Bs ${bs(s.total)}.`}
            </span>
          </div></div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave(d)}>
            <Check size={14} /> Culminar y facturar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * REVERTIR UN RECHAZO POR REFERENCIA REPETIDA.
 *
 * Es la única puerta que Comercialización tiene sobre un pago, y por eso pide motivo y
 * nombre: acepta como bueno un pago que la regla descartó porque su referencia ya
 * respaldaba otro pedido. Un pago corto no se revierte: queda por completar y se completa.
 */
function ModalRevertir({ s, otra, onClose, onSave }) {
  const MOTIVOS = [
    "El usuario mostró el comprobante y el pago es suyo",
    "El banco confirmó que la operación es de este usuario",
    "La referencia se cargó mal en el portal",
    "Error del registro en taquilla",
    "Otro motivo",
  ];
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [quien, setQuien] = useState("");
  const u = usr(s.usuario);
  const texto = motivo === "Otro motivo" ? detalle.trim() : motivo;
  const ok = texto.length > 4 && quien.trim().length > 2;
  // Lo que cubre el pago una vez aceptado: lo transferido más el saldo que se había aplicado.
  const cubre = Math.min(Number(s.total || 0), Number(s.pago.montoRecibido || 0) + Number(s.saldoAplicado || 0));
  const completo = cubre >= Number(s.total || 0) - 0.01;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Reversión</div>
          <h3>Revertir un rechazo por referencia repetida</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Solicitud</span><b>{s.id}</b></div>
            <div><span>Referencia</span><b className="mono">{s.pago.referencia || "—"}</b></div>
            <div><span>Transferido</span><b>Bs {bs(s.pago.montoRecibido || 0)}</b></div>
          </div>
          <div className="inv-regla" style={{ margin: "12px 0" }}><ShieldAlert size={17} /><div>
            <b>Qué decidió el sistema</b>
            <span>{s.pago.detalleRegla} — {reglaPago("REFERENCIA_DUPLICADA").desc}</span>
          </div></div>
          {otra && (
            <div className="cg2-correlativo bad">
              <AlertTriangle size={17} /><div>
                <b>Esa referencia respalda hoy a {otra.id}</b>
                <span>{usr(otra.usuario).nombre} · {estadoSolicitud(otra.estado).admin}. Revertir es afirmar que son dos
                  operaciones distintas: confírmelo con el comprobante y con el banco antes de seguir.</span>
              </div>
            </div>
          )}
          <p className="modal-nota">Al revertir, la solicitud queda {completo
            ? "pagada: el GLP se reserva y entra a la próxima AD."
            : `por completar: lo transferido no cubre el pedido y faltarán Bs ${bs(Number(s.total || 0) - cubre)}.`}</p>
          <label className="campo"><span>Por qué se revierte</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
            </select></label>
          {motivo === "Otro motivo" && (
            <label className="campo"><span>Detalle</span>
              <textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)}
                placeholder="Describa qué se verificó y con qué soporte" /></label>
          )}
          <label className="campo"><span>Quién revierte</span>
            <input value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Nombre del operador" /></label>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave(texto, quien.trim())}>
            <Undo2 size={14} /> Revertir el rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * INCIDENCIA SOBRE UN PEDIDO QUE NO ESTÁ EN NINGUNA AD (pagado o por completar).
 *
 * Sustituye al modal «No compró», que hablaba de una entrega que nunca se intentó y
 * siempre terminaba abonando. Aquí la consecuencia la fija el motivo y se muestra antes
 * de confirmar: hay incidencias que cierran el pedido y otras que lo dejan vivo. Lo que
 * se abona es el dinero aplicado al pedido, no su precio.
 */
function ModalIncidencia({ s, onClose, onSave }) {
  const [motivo, setMotivo] = useState(INCIDENCIAS_PREVIAS[0].id);
  const [nota, setNota] = useState("");
  const [quien, setQuien] = useState("");
  const u = usr(s.usuario);
  const m = incidenciaPrevia(motivo);
  const cierra = m.consecuencia === "CIERRA";
  const monto = dineroAplicadoDe(s);
  const ok = quien.trim().length > 2;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Incidencia</div>
          <h3>Registrar una incidencia</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Solicitud</span><b>{s.id}</b></div>
            <div><span>Producto</span><b>{cpt(s.concepto).corto} × {s.cantidad}</b></div>
            <div><span>Dinero aplicado</span><b>Bs {bs(monto)} de Bs {bs(s.total)}</b></div>
          </div>

          <p className="modal-nota">{s.estado === "POR_COMPLETAR"
            ? "Este pedido espera completar su pago y no está en ninguna AD."
            : "Este pedido está pagado y todavía no está convocado en ninguna AD."} Lo que ocurra
            en la jornada lo marca Distribución; aquí sólo se registra lo que pasa antes.</p>

          <label className="campo"><span>Qué ocurrió</span>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              {gruposIncidenciaPrevia().map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </optgroup>
              ))}
            </select></label>

          <div className={`inv-regla ${cierra ? "" : "alt"}`} style={{ margin: "12px 0" }}>
            {cierra ? <Wallet size={17} /> : <Clock3 size={17} />}
            <div>
              <b>{cierra
                ? (monto > 0.009 ? `Se cierra el pedido y se abonan Bs ${bs(monto)} al código ${s.usuario}` : "Se cierra el pedido · no hay dinero aplicado que abonar")
                : "El pedido queda retenido, no se cierra"}</b>
              <span>
                {m.desc}{" "}
                {cierra
                  ? `Se libera${kgDeSolicitud(s) > 0 && s.estado === "PAGADA" ? " el GLP comprometido y" : ""} el cupo del ciclo. El dinero no se devuelve en efectivo: queda a su favor y se descuenta solo en su próximo pedido.`
                  : "Conserva su estado y su dinero. Queda la constancia de por qué está detenido y quién lo registró."}
                {m.marcaPadron && " Además marca el registro del usuario para verificación de datos."}
              </span>
            </div>
          </div>

          <label className="campo"><span>Observación <em className="op">(opcional)</em></span>
            <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
              placeholder="Detalle que ayude a entender el caso después" /></label>
          <label className="campo"><span>Quién registra</span>
            <input value={quien} onChange={(e) => setQuien(e.target.value)} placeholder="Nombre del operador" /></label>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave(m.id, nota, quien.trim())}>
            {cierra ? <><Wallet size={14} /> {monto > 0.009 ? `Cerrar y abonar Bs ${bs(monto)}` : "Cerrar el pedido"}</> : <><Clock3 size={14} /> Retener el pedido</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════  FACTURAS Y BOLETAS  ═══════════
   Cada documento dice de dónde nació —cierre de AD, servicio O.A.U., talonario o venta
   sin contrato— con el mismo nombre que usa el libro de ventas. */

const OrigenTag = ({ origen }) => <span className={`tag ${CLASE_ORIGEN[origen] || ""}`}>{etiquetaOrigen(origen)}</span>;

function VistaBoletas({ boletas, setDoc }) {
  return (
    <section className="card">
      <div className="card-h"><div><h2>Boletas de operación <span className="cnt">{num(boletas.length)}</span></h2>
        <span className="card-note">Nacen al cerrar cada AD, al culminar un servicio en la O.A.U. y al registrar una venta sin contrato · documento no editable</span></div></div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Boleta</th><th>Origen</th><th>AD</th><th>Solicitud</th><th>Fecha</th><th>CDT</th><th>Usuario</th><th>Concepto</th><th>Tipo</th><th className="r">Salida GLP</th><th></th></tr></thead>
          <tbody>
            {boletas.map((b) => (
              <tr key={b.id}>
                <td className="mono strong">{b.id}</td>
                <td><OrigenTag origen={b.origen} /></td>
                <td className="mono muted">{b.ad || "—"}</td>
                <td className="mono muted">{b.sol || "—"}</td>
                <td className="muted">{fechaCorta(b.fecha)}</td>
                <td>{cdtOf(b.cdt).corto}</td>
                <td className="u-name sm">{usr(b.usuario).nombre}</td>
                <td className="c-name">{cpt(b.concepto).nombre}</td>
                <td>{tpd(b.tipoDespacho).factura ? <span className="tag">{tpd(b.tipoDespacho).nombre}</span> : <span className="tag alt">{tpd(b.tipoDespacho).nombre}</span>}</td>
                <td className="r mono">{b.kg > 0 ? <KgL kg={b.kg} /> : <span className="muted">sin inventario</span>}</td>
                <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "boleta", data: b })}><Eye size={13} /> Ver</button></td>
              </tr>
            ))}
            {!boletas.length && <tr><td colSpan={11} className="empty">No hay boletas en el alcance seleccionado.</td></tr>}
          </tbody>
          <tfoot><tr>
            <td colSpan={9}>TOTAL SALIDA DE GLP · {num(boletas.length)} boletas</td>
            <td className="r"><KgL kg={boletas.reduce((a, b) => a + Number(b.kg || 0), 0)} /></td>
            <td />
          </tr></tfoot>
        </table>
      </div>
    </section>
  );
}

/* Las facturas emitidas, en su propia pestaña. Antes solo se llegaba a ellas por el
   libro de ventas, y el libro es un asiento contable — no un buscador de documentos. */
function VistaFacturas({ facturas, setDoc }) {
  const [q, setQ] = useState("");
  const lista = facturas.filter((f) => {
    if (!q) return true;
    const r = receptorDe(f);
    return `${f.serie} ${f.control} ${r.nombre} ${r.doc} ${cpt(f.concepto).nombre}`.toLowerCase().includes(q.toLowerCase());
  });
  const t = lista.reduce((a, f) => ({
    kg: a.kg + kgDeSolicitud({ concepto: f.concepto, cantidad: f.cantidad }),
    total: a.total + Number(f.total || 0),
  }), { kg: 0, total: 0 });

  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Facturas emitidas <span className="cnt">{num(lista.length)}</span></h2>
          <span className="card-note">Nacen al cerrar un AD, al culminar un servicio en la O.A.U., del talonario del CDT o de una venta sin contrato. No se editan.</span></div>
        <div className="toolbar">
          <div className="search"><Search size={14} /><input placeholder="Buscar serie, control, cliente o concepto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
      </div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Serie</th><th>Control</th><th>Fecha</th><th>Cliente</th><th>Concepto</th>
            <th className="r">Cant.</th><th className="r">GLP</th><th>Origen</th><th className="r">Total Bs</th><th></th></tr></thead>
          <tbody>
            {lista.slice(0, 200).map((f) => {
              const r = receptorDe(f);
              return (
                <tr key={f.id}>
                  <td className="mono strong">{f.serie}</td>
                  <td className="mono muted">{f.control}</td>
                  <td className="muted">{fechaCorta(f.fecha)}</td>
                  <td><div className="u-name sm">{r.nombre}</div><div className="u-doc">{r.doc}</div></td>
                  <td className="c-name">{cpt(f.concepto).nombre}</td>
                  <td className="r mono">{num(f.cantidad)}</td>
                  <td className="r mono">{cpt(f.concepto).inv
                    ? <KgL kg={kgDeSolicitud({ concepto: f.concepto, cantidad: f.cantidad })} />
                    : <span className="muted">servicio</span>}</td>
                  <td><OrigenTag origen={f.origen} /></td>
                  <td className="r mono strong">{bs(f.total)}</td>
                  <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Eye size={13} /> Ver</button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr>
            <td colSpan={6}>TOTALES · {num(lista.length)} facturas</td>
            <td className="r"><KgL kg={t.kg} /></td>
            <td />
            <td className="r mono strong">Bs {bs(t.total)}</td>
            <td />
          </tr></tfoot>
        </table>
      </div>
      {lista.length > 200 && <div className="paginador"><span>Mostrando las primeras 200 de {num(lista.length)}. Afina la búsqueda para ver el resto.</span></div>}
    </section>
  );
}

/* El libro de ventas y las ventas sin contrato salieron de aquí a su propia entrada del
   menú: son piezas contables y estaban escondidas como pestañas. Queda lo que sí es
   documental —las boletas, las facturas y el control documental. */
function VistaDocumentos({ facV, bopV, setDoc, setModal, onExport }) {
  const [tab, setTab] = useState("boletas");
  const TABS = [
    ["boletas", "Boletas de operación", FileText, bopV.length],
    ["facturas", "Facturas emitidas", Receipt, facV.length],
    ["control", "Control documental", ShieldAlert, null],
  ];
  return (
    <>
      <div className="doc-tabs">
        {TABS.map(([k, l, Ico, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            <Ico size={15} /> {l} {n != null && <em>{num(n)}</em>}
          </button>
        ))}
      </div>
      {tab === "boletas" && <VistaBoletas boletas={bopV} setDoc={setDoc} />}
      {tab === "facturas" && <VistaFacturas facturas={facV} setDoc={setDoc} />}
      {tab === "control" && <ControlDocumental facturas={facV} setDoc={setDoc} setModal={setModal} onExport={onExport} />}
    </>
  );
}

const ORIGENES_FACTURA = ["AUTOMATICA", "SERVICIO", "MANUAL", "SIN_CONTRATO"];

function ControlDocumental({ facturas, setDoc, setModal, onExport }) {
  const [q, setQ] = useState("");
  const tot = (a) => suma(a, (f) => f.total);
  const lista = facturas.filter((f) => {
    if (!q) return true;
    const r = receptorDe(f);
    return `${f.serie} ${f.control} ${r.nombre} ${r.doc}`.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <>
      <div className="split cinco">
        {ORIGENES_FACTURA.map((o) => {
          const fs = facturas.filter((f) => f.origen === o);
          return <div className="split-box" key={o}><div className="split-l">{etiquetaOrigen(o)}</div><div className="split-v">Bs {bs(tot(fs))}</div><div className="split-p">{num(fs.length)} documentos</div></div>;
        })}
        <div className="split-box total"><div className="split-l">Total consolidado</div><div className="split-v">Bs {bs(tot(facturas))}</div><div className="split-p">{num(facturas.length)} documentos · todos los períodos</div></div>
      </div>
      <section className="card">
        <div className="card-h"><div><h2>Anulaciones y sustituciones <span className="cnt">0</span></h2>
          <span className="card-note">Un documento asentado no se borra: se corrige con nota de crédito o se sustituye, y el original queda en el histórico.</span></div></div>
        <div className="empty">No hay anulaciones ni sustituciones registradas. Cuando se emita una nota de crédito o una
          factura sustituta, aparecerá aquí junto a su documento original.</div>
      </section>
      <section className="card">
        <div className="card-h">
          <h2>Todos los documentos <span className="cnt">{num(lista.length)}</span></h2>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar serie, control o cliente" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={() => setModal("manual")}><Plus size={14} /> Factura manual</button>
            <button className="btn sm" onClick={onExport}><Download size={14} /> Exportar</button>
          </div>
        </div>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Serie</th><th>Nro. control</th><th>Origen</th><th>Fecha</th><th>Cliente</th><th>Concepto</th><th className="r">Total Bs</th><th></th></tr></thead>
          <tbody>{lista.slice(0, 80).map((f) => (
            <tr key={f.id}>
              <td className="mono strong">{f.serie}</td>
              <td className="mono muted">{f.control}</td>
              <td><OrigenTag origen={f.origen} /></td>
              <td className="muted">{fechaCorta(f.fecha)}</td>
              <td className="u-name sm">{receptorDe(f).nombre}</td>
              <td className="c-name">{cpt(f.concepto).nombre}</td>
              <td className="r mono strong">{bs(f.total)}</td>
              <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Eye size={13} /> Ver</button></td>
            </tr>
          ))}</tbody>
        </table></div>
        {lista.length > 80 && <div className="mas">Mostrando 80 de {num(lista.length)} · exporta para el detalle completo</div>}
      </section>
    </>
  );
}

/* ═══════════  INVENTARIO  ═══════════ */

/**
 * KARDEX DE GLP · lo que de verdad movió la existencia.
 * Entradas y salidas por gandola (movimiento de planta) y salidas por BOP o talonario
 * (`movs`). Las BOP de un mismo cierre de AD van en una línea. El llenado de la jornada se
 * anota aparte: no baja la existencia hasta que el AD se cierra y nace la BOP. El saldo
 * corre desde la existencia inicial de cada CDT y debe terminar en la existencia física.
 */
function kardexGLP({ movs = [], movPlanta = [], boletas = [], rutas = [], cdts = [], existencias = {} }) {
  const ids = new Set(cdts.map((c) => c.id));
  const bop = new Map(boletas.map((b) => [b.id, b]));
  const cerradas = new Map(rutas.filter(adCerrada).map((r) => [String(r.ad), r]));
  const filas = [];
  const cierres = new Map();
  movs.forEach((m) => {
    if (!ids.has(m.cdt)) return;
    const kg = Math.abs(Number(m.kg || 0));
    if (m.tipo === "SALIDA") {
      const ad = bop.get(m.doc)?.ad ? String(bop.get(m.doc).ad) : null;
      const clave = ad ? `BOP|${m.cdt}|${ad}|${m.fecha ? m.fecha.getTime() : 0}` : `BOP|${m.id}`;
      const g = cierres.get(clave) || { key: clave, fecha: m.fecha, hora: cerradas.get(ad)?.horaCierre || null, cdt: m.cdt, ad, docs: [], kg: 0 };
      g.docs.push(m.doc); g.kg += kg;
      cierres.set(clave, g);
      return;
    }
    const generica = String(m.doc || "").startsWith("GEN-");
    filas.push({ key: m.id, fecha: m.fecha, hora: null, cdt: m.cdt, clase: "warn",
      movimiento: generica ? "Venta sin contrato" : "Salida por talonario", documento: m.doc,
      contraparte: generica ? "Consumidor final · código genérico" : "Factura manual del CDT", salida: kg, estado: "Asentada" });
  });
  cierres.forEach((g) => {
    const docs = [...g.docs].sort();
    filas.push({ key: g.key, fecha: g.fecha, hora: g.hora, cdt: g.cdt, clase: "alt",
      movimiento: g.ad ? "Salida por BOP · cierre de AD" : "Salida por BOP",
      documento: docs.length > 1 ? `${docs.length} BOP · ${docs[0]} a ${docs[docs.length - 1]}` : docs[0],
      contraparte: g.ad ? `AD ${g.ad}` : "—", salida: g.kg, estado: "AD cerrada" });
  });
  movPlanta.forEach((m) => {
    if (!ids.has(m.cdt)) return;
    const kg = Number(m.kg || 0);
    const base = { key: m.id, fecha: m.fecha, hora: m.hora, cdt: m.cdt, documento: m.documento, contraparte: m.contraparte };
    const estado = m.estado === "CONFIRMADA" ? "Confirmada" : m.estado || "—";
    if (m.tipo === "ENTRADA_GANDOLA") filas.push({ ...base, clase: "ok", movimiento: "Recepción por gandola", entrada: kg, estado });
    else if (m.tipo === "SALIDA_GANDOLA") filas.push({ ...base, clase: "warn", movimiento: "Despacho por gandola", salida: kg, estado });
    else if (m.tipo === "LLENADO") {
      const cerrado = cerradas.has(String(m.ad));
      filas.push({ ...base, clase: "", movimiento: "Llenado de la jornada", llenado: kg, porCerrar: !cerrado,
        estado: cerrado ? "Conciliado con su BOP" : "Por cerrar" });
    }
  });
  const orden = (h) => (h && /^\d{1,2}:\d{2}$/.test(h) ? h.padStart(5, "0") : "99:99");
  filas.sort((a, b) => ((a.fecha || 0) - (b.fecha || 0)) || orden(a.hora).localeCompare(orden(b.hora)) || String(a.key).localeCompare(String(b.key)));
  const inicial = suma(cdts, (c) => c.inicial);
  let saldo = inicial;
  filas.forEach((f) => { saldo += Number(f.entrada || 0) - Number(f.salida || 0); f.saldo = saldo; });
  const fisico = suma(cdts, (c) => existencias[c.id]);
  return {
    filas: filas.reverse(), inicial, saldo, fisico, cuadra: Math.abs(saldo - fisico) < 1,
    entradas: suma(filas, (f) => f.entrada), salidas: suma(filas, (f) => f.salida),
  };
}

function VistaInventario({ existencias, compromisos, disponibles, glp, movs, movPlanta, boletas, rutas, cdtF, onExport }) {
  const [verTodo, setVerTodo] = useState(false);
  const lista = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  const porCerrar = useMemo(() => llenadoPorCerrarDe(movPlanta, rutas), [movPlanta, rutas]);
  const kardex = useMemo(() => kardexGLP({ movs, movPlanta, boletas, rutas, cdts: lista, existencias }),
    [movs, movPlanta, boletas, rutas, cdtF, existencias]);
  const filasK = verTodo ? kardex.filas : kardex.filas.slice(0, 40);

  return (
    <>
      <div className="inv-regla"><Gauge size={17} /><div><b>Pago ≠ salida de inventario.</b><span>Una persona puede pagar hoy y recibir
        semanas después. El pago compromete GLP; la existencia física sólo baja cuando Distribución cierra el AD: ahí nacen
        la BOP, la factura y la salida. El llenado de la jornada queda «por cerrar» hasta ese cierre.</span></div></div>

      {/* Las cifras del inventario, cada una en sus dos unidades y todas de `cifras.glp`. El GLP
          se compra por litro y se factura por kilo: quien mira esta pantalla necesita las dos. */}
      <div className="inv-totales">
        <KgLBloque label="Existencia física" kg={glp.fisico} />
        <KgLBloque label="Comprometido por pedidos pagados" kg={glp.comprometido} tono="warn" />
        <KgLBloque label="Disponible para planificar" kg={glp.disponible} tono="ok" />
        <KgLBloque label="Llenado por cerrar · ya dentro del físico" kg={glp.llenadoPorCerrar} />
      </div>

      <section className="card">
        <div className="card-h"><div><h2>Disponibilidad real por CDT</h2><span className="card-note"><NotaFactor /></span></div><button className="btn sm" onClick={onExport}><Download size={14} /> Exportar</button></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>CDT</th><th className="r">Existencia física</th><th className="r">Comprometido</th><th className="r">Disponible</th><th className="r">Llenado por cerrar</th><th>Capacidad física</th></tr></thead><tbody>
          {lista.map((c) => {
            const ex = Number(existencias[c.id] || 0);
            const pct = c.capacidad ? (ex / c.capacidad) * 100 : 0;
            return <tr key={c.id}>
              <td><div className="u-name">{c.nombre}</div><div className="u-doc">{c.sector}</div></td>
              <td className="r mono strong"><KgL kg={ex} /></td>
              <td className="r mono"><KgL kg={compromisos[c.id] || 0} tono="warn" /></td>
              <td className="r mono"><KgL kg={disponibles[c.id] || 0} tono="ok" /></td>
              <td className="r mono">{porCerrar[c.id] ? <KgL kg={porCerrar[c.id]} /> : <span className="muted">—</span>}</td>
              <td><div className="mini-cap"><span style={{ width: `${Math.min(100, pct)}%` }} /></div>
                <div className="u-doc">{Math.round(pct)}% de <KgL kg={c.capacidad} /></div></td></tr>;
          })}
        </tbody>
        <tfoot><tr>
          <td>TOTALES · {lista.length} CDT</td>
          <td className="r"><KgL kg={glp.fisico} /></td>
          <td className="r"><KgL kg={glp.comprometido} /></td>
          <td className="r"><KgL kg={glp.disponible} /></td>
          <td className="r"><KgL kg={glp.llenadoPorCerrar} /></td>
          <td />
        </tr></tfoot>
        </table></div>
      </section>

      <section className="card">
        <div className="card-h">
          <div><h2>Kardex de GLP <span className="cnt">{num(kardex.filas.length)}</span></h2>
            <span className="card-note">Entradas y salidas por gandola, salidas por BOP (una línea por cierre de AD) y por talonario. El llenado de la jornada se anota aparte: no baja la existencia hasta que el AD se cierra.</span></div>
        </div>
        <div className={`cg2-correlativo ${kardex.cuadra ? "ok" : "bad"} kardex-cuadre`}>
          {kardex.cuadra ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          <div><b>{kardex.cuadra ? "El kardex cuadra con la existencia física" : "El kardex no cuadra con la existencia física"}</b>
            <span>Inicial {kgYL(kardex.inicial)} + entradas {kgYL(kardex.entradas)} − salidas {kgYL(kardex.salidas)} = {kgYL(kardex.saldo)} ·
              existencia física {kgYL(kardex.fisico)}.</span></div>
        </div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Fecha · hora</th><th>Movimiento</th><th>Documento</th><th>CDT</th><th>Origen / destino</th><th className="r">Entrada</th><th className="r">Salida</th><th className="r">Llenado</th><th className="r">Saldo físico</th><th>Estado</th></tr></thead><tbody>
          {filasK.map((k) => (
            <tr key={k.key}>
              <td className="muted">{fechaCorta(k.fecha)}{k.hora && k.hora !== "—" ? ` · ${k.hora}` : ""}</td>
              <td><span className={`tag ${k.clase}`}>{k.movimiento}</span></td>
              <td className="mono">{k.documento}</td>
              <td>{cdtOf(k.cdt).corto}</td>
              <td className="c-name">{k.contraparte}</td>
              <td className="r">{k.entrada ? <KgL kg={k.entrada} tono="ok" /> : <span className="muted">—</span>}</td>
              <td className="r">{k.salida ? <KgL kg={k.salida} tono="neg" /> : <span className="muted">—</span>}</td>
              <td className="r">{k.llenado ? <KgL kg={k.llenado} tono="warn" /> : <span className="muted">—</span>}</td>
              <td className="r mono strong"><KgL kg={k.saldo} /></td>
              <td>{k.porCerrar ? <span className="chip st-pag">Por cerrar</span> : <span className="muted">{k.estado}</span>}</td>
            </tr>
          ))}
          {!kardex.filas.length && <tr><td colSpan={10} className="empty">Sin movimientos de GLP en el alcance.</td></tr>}
        </tbody></table></div>
        {kardex.filas.length > 40 && (
          <div className="mas">{verTodo ? `Mostrando los ${num(kardex.filas.length)} movimientos` : `Mostrando los 40 más recientes de ${num(kardex.filas.length)}`}
            {" "}· <button className="link" onClick={() => setVerTodo((v) => !v)}>{verTodo ? "ver menos" : "ver todos"}</button></div>
        )}
      </section>

      <section className="card">
        <div className="card-h">
          <h2>Salidas físicas por documento <span className="cnt">{num(movs.length)}</span></h2>
          <span className="card-note">Cada BOP y cada factura de talonario, una por una. No aparecen pagos pendientes: todavía no han salido del CDT.</span>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Movimiento</th><th>Fecha</th><th>CDT</th><th>Comuna</th><th>Documento</th><th>Concepto</th><th>Tipo</th><th className="r">Salida de GLP</th></tr></thead>
            <tbody>{movs.slice(0, 60).map((m) => <tr key={m.id}><td className="mono muted">{m.id}</td><td className="muted">{fechaCorta(m.fecha)}</td><td>{cdtOf(m.cdt).corto}</td><td className="c-name">{m.comuna ? comunaOf(m.comuna).nombre : "—"}</td><td className="mono strong">{m.doc}</td><td className="c-name">{cpt(m.concepto).nombre}</td><td><span className={`tag ${m.tipo === "SALIDA_MANUAL" ? "warn" : "alt"}`}>{m.tipo === "SALIDA_MANUAL" ? "Talonario o venta sin contrato" : "Salida por BOP"}</span></td><td className="r mono"><KgL kg={Math.abs(m.kg)} tono="neg" /></td></tr>)}</tbody>
            <tfoot><tr>
              <td colSpan={7}>TOTAL DE SALIDAS · {num(movs.length)} documentos</td>
              <td className="r"><KgL kg={movs.reduce((a, m) => a + Math.abs(Number(m.kg || 0)), 0)} /></td>
            </tr></tfoot>
          </table>
        </div>
        {movs.length > 60 && <div className="mas">Mostrando 60 de {num(movs.length)} documentos · exporta para el detalle completo</div>}
      </section>
    </>
  );
}

/* ═══════════  EPSDC  ═══════════
   El servicio de cada EPSDC es un porcentaje de la venta que transportó, y ese porcentaje
   es el de su contrato. Se cuentan AD distintas, no personas. */

const CICLO_LIQUIDACION = ["PENDIENTE", "REVISADA", "APROBADA", "PAGADA"];

function VistaEPSDC({ sols, onExport }) {
  const lista = sols.filter(esVentaEPSDC);
  const venta = suma(lista, (s) => s.total);
  const servicio = suma(lista, (s) => Number(s.total || 0) * pctServicio(s));
  const kg = suma(lista, kgDeSolicitud);
  const ads = new Set(lista.map((s) => s.ad)).size;
  const grupos = Object.values(lista.reduce((acc, s) => {
    const id = s.epsdc || EPSDCS[0].id;
    const g = (acc[id] ||= { id, ads: new Set(), venta: 0, servicio: 0, kg: 0 });
    g.ads.add(s.ad); g.venta += Number(s.total || 0); g.servicio += Number(s.total || 0) * pctServicio(s); g.kg += kgDeSolicitud(s);
    return acc;
  }, {}));
  // Simulación del ciclo documental: toda liquidación empieza pendiente, sin pagos inventados.
  const [liqEstados, setLiqEstados] = useState({});
  const avanzarLiq = (id) => setLiqEstados((prev) => {
    const i = CICLO_LIQUIDACION.indexOf(prev[id] || "PENDIENTE");
    return { ...prev, [id]: CICLO_LIQUIDACION[Math.min(CICLO_LIQUIDACION.length - 1, i + 1)] };
  });
  return (
    <>
      <div className="kpis">
        <Kpi label="Venta transportada EPSDC" valor={`Bs ${bs(venta)}`} pie={`${num(ads)} AD cerradas · ${num(lista.length)} entregas`} tono="verde" />
        <Kpi label={`Servicio EPSDC · ${ETIQUETA_PCT_EPSDC}`} valor={`Bs ${bs(servicio)}`} pie="el porcentaje de cada contrato sobre su venta" tono="ambar" />
        <Kpi label="GLP transportado" valor={<KgL kg={kg} />} pie="facturado por kilo, medido por litro" tono="gris" />
      </div>
      <section className="card">
        <div className="card-h"><div><h2>Liquidaciones EPSDC</h2><span className="card-note">Simulación del ciclo documental: Pendiente → Revisada → Aprobada → Pagada. La base son únicamente las AD cerradas.</span></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>EPSDC</th><th className="r">AD cerradas</th><th className="r">GLP transportado</th><th className="r">Venta transportada Bs</th><th className="r">Servicio</th><th className="r">Servicio Bs</th><th>Estado</th><th>Pago / soporte</th><th></th></tr></thead><tbody>
          {grupos.map((g) => {
            const e = epsdcOf(g.id);
            const est = liqEstados[g.id] || "PENDIENTE";
            const pagada = est === "PAGADA";
            return <tr key={g.id}>
              <td><div className="u-name">{e.nombre}</div><div className="u-doc">{e.rif}</div></td>
              <td className="r mono strong">{num(g.ads.size)}</td>
              <td className="r mono"><KgL kg={g.kg} /></td>
              <td className="r mono strong">{bs(g.venta)}</td>
              <td className="r mono">{pctTxt(Number(e.servicioPct || 0) * 100, 0)}</td>
              <td className="r mono strong">{bs(g.servicio)}</td>
              <td><span className={`chip ${pagada ? "st-cul" : est === "APROBADA" ? "st-con" : est === "REVISADA" ? "st-ad" : "st-pag"}`}>{est}</span></td>
              <td>{pagada ? <span className="u-doc">Marcada pagada en esta sesión · {fecha(HOY)}</span> : <span className="muted">Pendiente de comprobante</span>}</td>
              <td><button className="btn sm ghost" disabled={pagada} onClick={() => avanzarLiq(g.id)}>{pagada ? "Cerrada" : "Avanzar estado"}</button></td>
            </tr>;
          })}
          {!grupos.length && <tr><td colSpan={9} className="empty">Ningún AD cerrado con unidad EPSDC en el alcance.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="card">
        <div className="card-h">
          <div><h2>Resumen de la venta transportada por EPSDC</h2>
            <span className="card-note">Control generado desde los AD cerrados con una unidad EPSDC. No se carga manualmente.</span></div>
          <button className="btn sm" onClick={onExport}><Download size={14} /> Descargar soporte</button>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>AD</th><th>Fecha</th><th>EPSDC</th><th>Operador / unidad</th><th>Comuna</th><th>Usuario</th><th>Tipo</th><th className="r">GLP</th><th className="r">Venta Bs</th><th className="r">Servicio Bs</th><th>Soporte</th></tr></thead>
            <tbody>{lista.map((s) => <tr key={s.id}>
              <td><div className="mono strong">{s.ad}</div><div className="u-doc">{s.boleta}</div></td>
              <td className="muted">{fechaCorta(s.entrega)}</td>
              <td><div className="u-name">{epsdcOf(s.epsdc).nombre}</div><div className="u-doc">{epsdcOf(s.epsdc).rif}</div></td>
              <td><div className="u-name sm">{s.operador || "—"}</div><div className="u-doc">{s.unidad || "—"}</div></td>
              <td className="c-name">{comunaOf(s.comuna).nombre}</td>
              <td><div className="u-name sm">{usr(s.usuario).nombre}</div></td>
              <td><span className="tag alt">{tpd(s.tipoDespacho).nombre}</span></td>
              <td className="r mono"><KgL kg={kgDeSolicitud(s)} /></td>
              <td className="r mono strong">{bs(s.total)}</td>
              <td className="r mono strong">{bs(Number(s.total || 0) * pctServicio(s))}<div className="u-doc">{pctTxt(pctServicio(s) * 100, 0)}</div></td>
              <td><span className="pago-ok"><Check size={11} /> AD + BOP</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="cerrado-bar"><Truck size={15} /> Base del cálculo: el porcentaje de servicio de cada EPSDC sobre la venta transportada en sus AD cerradas.</div>
      </section>
    </>
  );
}

/* ═══════════  RECLAMOS  ═══════════ */

const EST_REC = { RECIBIDO: ["Recibido", "st-pag"], EN_PROCESO: ["En proceso", "st-ad"], RESUELTO: ["Resuelto", "st-cul"] };
const PRI = { ALTA: "pri-alta", MEDIA: "pri-media", BAJA: "pri-baja" };

function VistaReclamos({ reclamos, setModal, tomarReclamo, onExport }) {
  const [f, setF] = useState("ABIERTOS");
  const lista = reclamos.filter((r) => f === "TODOS" || (f === "ABIERTOS" ? r.estado !== "RESUELTO" : r.estado === "RESUELTO"));
  const abiertos = reclamos.filter((r) => r.estado !== "RESUELTO");
  const altas = abiertos.filter((r) => r.prioridad === "ALTA");
  const tipos = [...new Set(reclamos.map((r) => r.tipo))]
    .map((t) => ({ t, n: reclamos.filter((r) => r.tipo === t).length })).sort((a, b) => b.n - a.n);
  const maxT = Math.max(...tipos.map((x) => x.n), 1);

  return (
    <>
      <div className="kpis">
        <Kpi label="Reclamos abiertos" valor={abiertos.length} pie="pendientes de respuesta" tono="rojo" />
        <Kpi label="Prioridad alta" valor={altas.length} pie="fugas, defectos y pagos" tono="ambar" />
        <Kpi label="Resueltos" valor={reclamos.length - abiertos.length} pie="con respuesta de la empresa" tono="verde" />
        <Kpi label="Total del período" valor={reclamos.length} pie="todos los canales" tono="gris" />
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-h">
            <h2>Bandeja de atención al usuario <span className="cnt">{lista.length}</span></h2>
            <div className="toolbar">
              <div className="tabs">
                {[["ABIERTOS", "Abiertos"], ["RESUELTOS", "Resueltos"], ["TODOS", "Todos"]].map(([k, l]) => (
                  <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>
                ))}
              </div>
              <button className="btn sm" onClick={onExport}><Download size={14} /> Exportar</button>
            </div>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th>Reclamo</th><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Asunto</th><th>Prior.</th><th>Estatus</th><th></th></tr></thead>
              <tbody>
                {lista.map((r) => {
                  const u = usr(r.usuario);
                  return (
                    <tr key={r.id} className={u.portal ? "portal" : ""}>
                      <td className="mono strong">{r.id}{u.portal && <span className="pin" title="Usuario con portal activo">●</span>}</td>
                      <td className="muted">{fechaCorta(r.fecha)}</td>
                      <td><div className="u-name">{u.nombre}</div><div className="u-doc">Contrato {u.contrato}</div></td>
                      <td className="c-name">{r.tipo}</td>
                      <td className="c-name asunto">{r.asunto}</td>
                      <td><span className={`pri ${PRI[r.prioridad]}`}>{r.prioridad}</span></td>
                      <td><span className={`chip ${EST_REC[r.estado][1]}`}>{EST_REC[r.estado][0]}</span></td>
                      <td className="r">
                        <button className={`btn sm ${r.estado !== "RESUELTO" ? "primary" : ""}`}
                          onClick={() => { tomarReclamo(r); setModal({ tipo: "reclamo", r }); }}>
                          {r.estado === "RESUELTO" ? "Ver" : "Responder"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h2>Reclamos por tipo</h2></div>
          <div className="bars">
            {tipos.map((x) => (
              <div className="bar-row" key={x.t}>
                <div><span className="bar-name">{x.t}</span></div>
                <div className="bar-track"><div className="bar-fill rojo" style={{ width: `${(x.n / maxT) * 100}%` }} /></div>
                <div className="bar-val">{x.n}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function ModalReclamo({ r, onClose, onSave }) {
  const [txt, setTxt] = useState(r.respuesta || "");
  const u = usr(r.usuario);
  const ok = txt.trim().length > 9;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Atención al usuario</div><h3>{r.id} · {r.asunto}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Contrato</span><b>{u.contrato}</b></div>
            <div><span>Tipo</span><b>{r.tipo}</b></div>
            <div><span>Prioridad</span><b>{r.prioridad}</b></div>
          </div>
          <div className="burb usuario"><div className="burb-l">Reporte del usuario · {fecha(r.fecha)}</div>{r.detalle}</div>
          {r.respuesta && r.estado === "RESUELTO" && (
            <div className="burb empresa"><div className="burb-l">Respuesta enviada · {r.atendio}{r.cerrado ? ` · ${fecha(r.cerrado)}` : ""}</div>{r.respuesta}</div>
          )}
          {r.estado !== "RESUELTO" && (
            <label className="campo"><span>Respuesta al usuario</span>
              <textarea rows={4} placeholder="La verá en su portal, en la sección de reclamos"
                value={txt} onChange={(e) => setTxt(e.target.value)} /></label>
          )}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cerrar</button>
          {r.estado !== "RESUELTO" && <>
            <button className="btn" disabled={!ok} onClick={() => onSave(txt, false)}>Responder sin cerrar</button>
            <button className="btn primary" disabled={!ok} onClick={() => onSave(txt, true)}><Send size={14} /> Responder y resolver</button>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════  FICHA 360°  ═══════════
   La arma el núcleo (`fichaUsuario360`) con los datos reales: la misma trazabilidad que ve
   Distribución —solicitud → pago → AD → recolección → llenado → devolución → factura—,
   aquí con importes. La pantalla sólo le pone nombre al CDT. */

function FichaUsuario({ u, solicitudes, facturas, abonos, rutas, reclamos, onClose, setDoc }) {
  const ficha = useMemo(() => fichaUsuario360(u.id, { solicitudes, facturas, abonos, rutas, reclamos }, {
    modo: "comercializacion",
    onOpenFactura: (f) => { onClose(); setDoc({ tipo: "factura", data: f }); },
  }), [u.id, solicitudes, facturas, abonos, rutas, reclamos]);
  return <Usuario360Modal mode="comercializacion" {...ficha}
    perfil={{ ...ficha.perfil, cdt: cdtOf(ficha.perfil.cdt).nombre }} onClose={onClose} />;
}

/* ═══════════  CIERRE DEL PERÍODO  ═══════════
   Cerrar el período es cerrar el ciclo: vence el plazo de lo que sigue por replanificar o
   por completar —su dinero pasa al saldo a favor— y ya no se registra nada con fecha del
   período. Es irreversible en la sesión y se cierra para todos los CDT a la vez; el filtro
   de CDT sólo cambia la tabla del cierre mensual. */

function VistaCierre({ facV, solV, existencias, compromisos, disponibles, movPlanta, cifrasV, cifrasTodas, solicitudes, facturas, boletas, rutas,
  periodoCerrado, cierrePeriodo, cerrarPeriodo, onExport, setDoc, cdtF }) {
  const [tab, setTab] = useState("precierre");
  const [confirmar, setConfirmar] = useState(false);
  const vencen = useMemo(() => vencenAlCerrar(solicitudes, cifrasTodas), [solicitudes, cifrasTodas]);

  function cerrar(por) {
    if (!cerrarPeriodo) return { ok: false, error: "El cierre del período no está disponible." };
    const r = cerrarPeriodo({ por });
    if (r?.ok) setConfirmar(false);
    return r;
  }

  return (
    <>
      <div className="doc-tabs">
        <button className={tab === "precierre" ? "on" : ""} onClick={() => setTab("precierre")}>
          <CheckCircle2 size={15} /> Validaciones previas
        </button>
        <button className={tab === "cierre" ? "on" : ""} onClick={() => setTab("cierre")}>
          <Lock size={15} /> Cierre mensual
        </button>
      </div>
      {tab === "precierre" && <PreCierre cifras={cifrasTodas} vencen={vencen}
        {...{ solicitudes, facturas, boletas, rutas, existencias, compromisos, disponibles, movPlanta, cdtF, periodoCerrado, cierrePeriodo, onExport }}
        onCerrar={() => setConfirmar(true)} />}
      {tab === "cierre" && <TablaCierre cifras={cifrasV} {...{ facV, solV, periodoCerrado, cierrePeriodo, onExport, setDoc }}
        onCerrar={() => setConfirmar(true)} />}
      {confirmar && <ModalCerrarPeriodo vencen={vencen} cifras={cifrasTodas} onClose={() => setConfirmar(false)} onConfirm={cerrar} />}
    </>
  );
}

/** Confirmación del cierre: dice, con cifras, lo que va a pasar antes de que pase. */
function ModalCerrarPeriodo({ vencen, cifras, onClose, onConfirm }) {
  const [por, setPor] = useState("");
  const [err, setErr] = useState(null);
  const ok = por.trim().length > 2;
  const pend = cifras.dinero.pendienteDespacho;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Cierre del período</div>
          <h3>Cerrar {PERIODO.label}</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="cg2-correlativo bad">
            <AlertTriangle size={17} /><div>
              <b>Es irreversible en esta sesión</b>
              <span>Una vez cerrado, el período no se reabre. Para volver al inicio de la demo hay que recargar la página.</span>
            </div>
          </div>
          <p className="modal-nota">Al cerrar ocurre esto, en todos los CDT a la vez:</p>
          <ul className="cierre-consecuencias">
            <li><b>{num(vencen.replan.n)} pedidos por replanificar</b> (Bs {bs(vencen.replan.bs)}) vencen su plazo: su dinero pasa al saldo a favor de cada usuario.</li>
            <li><b>{num(vencen.porCompletar.n)} pedidos por completar</b> (Bs {bs(vencen.porCompletar.bs)} recibidos; faltaban Bs {bs(vencen.porCompletar.faltante)}) se cierran: lo recibido pasa al saldo a favor.</li>
            <li>Los <b>{num(pend.n)} pedidos pagados</b> sin despachar y las <b>{num(cifras.ad.activas)} AD abiertas</b> siguen vivos para el período siguiente: no se facturan ni vencen.</li>
            <li>Desde ese momento <b>no se registra ninguna operación con fecha de {PERIODO.label.toLowerCase()}</b>: taquilla, pagos, AD, ventas, facturas manuales ni saldos.</li>
          </ul>
          <label className="campo"><span>Quién cierra</span>
            <input value={por} onChange={(e) => setPor(e.target.value)} placeholder="Nombre y cargo de quien autoriza el cierre" /></label>
          {err && <div className="cg2-err">{err}</div>}
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => {
            const r = onConfirm(por.trim());
            if (!r?.ok) setErr(r?.error || "No se pudo cerrar el período.");
          }}><Lock size={14} /> Cerrar el período</button>
        </div>
      </div>
    </div>
  );
}

function TablaCierre({ facV, solV, cifras, periodoCerrado, cierrePeriodo, onExport, onCerrar, setDoc }) {
  const cierre = useMemo(() => resumenCierreMensual(facV, solV), [facV, solV]);
  const t = cierre.totales;
  const d = cifras.dinero;
  const g = cifras.glp;

  return (
    <>
      {!periodoCerrado && d.pendienteDespacho.n > 0 && (
        <div className="warn-bar"><Clock3 size={16} />
          <span>Quedan <strong>{num(d.pendienteDespacho.n)} pedidos pagados sin despachar</strong> (Bs {bs(d.pendienteDespacho.bs)} · <KgL kg={d.pendienteDespacho.kg} />).
            El cierre no los toca: siguen comprometidos y pasan al período siguiente, y su GLP permanece en el inventario físico hasta que su AD se cierre.</span></div>
      )}

      <div className="split cierre-kpis">
        <div className="split-box total"><div className="split-l">Facturado del período</div><div className="split-v">Bs {bs(d.facturadoPeriodo.total)}</div><div className="split-p">{num(d.facturadoPeriodo.docs)} documentos · base {bs(d.facturadoPeriodo.base)} · IVA {bs(d.facturadoPeriodo.iva)}</div></div>
        <div className="split-box"><div className="split-l">Pendiente por despachar</div><div className="split-v">Bs {bs(d.pendienteDespacho.bs)}</div><div className="split-p">{num(d.pendienteDespacho.n)} pedidos pagados · por completar Bs {bs(d.porCompletar.recibido)}</div></div>
        <div className="split-box"><div className="split-l">GLP físico / comprometido</div><div className="split-v"><KgL kg={g.fisico} /> <span className="split-sep">/</span> <KgL kg={g.comprometido} /></div><div className="split-p">Disponible real: <KgL kg={g.disponible} /> · llenado por cerrar: <KgL kg={g.llenadoPorCerrar} /></div></div>
        <div className="split-box"><div className="split-l">Salida por BOP y talonario</div><div className="split-v"><KgL kg={t.kgDespachado} /></div><div className="split-p">salida física del período</div></div>
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Cierre mensual de comercialización · {PERIODO.label}</h2>
            <span className="card-note">Una sola tabla concilia lo facturado, lo pendiente por despachar y el inventario. Lo pendiente no se suma a lo facturado hasta que su AD se cierra.</span></div>
          <div className="toolbar">
            <button className="btn sm" onClick={onExport}><Download size={14} /> Descargar cierre</button>
            <button className="btn sm" onClick={() => setDoc({ tipo: "acta" })}><Printer size={14} /> Acta de cierre</button>
            {periodoCerrado
              ? <span className="chip st-con"><Lock size={11} /> Período cerrado</span>
              : <button className="btn sm primary" onClick={onCerrar}><Lock size={14} /> Cerrar período</button>}
          </div>
        </div>
        <div className="cierre-leyenda">
          <span><b>Facturado:</b> venta cerrada, con su BOP.</span>
          <span><b>Pendiente por despachar:</b> dinero cobrado cuyo gas sigue en el CDT.</span>
          <span><b>Inventario:</b> por fila se compara salida física contra GLP comprometido; el stock común del CDT se reconcilia al pie.</span>
        </div>
        <div className="scroll cierre-scroll">
          <table className="tbl cierre cierre-unificado">
            <thead>
              <tr className="head-groups">
                <th rowSpan={2}>Concepto de ingreso</th>
                <th colSpan={5} className="grp-ent">Facturado</th>
                <th colSpan={5} className="grp-pend">Pendiente por despachar</th>
                <th colSpan={4} className="grp-inv">Inventario GLP</th>
              </tr>
              <tr>
                <th className="r">Docs.</th><th className="r">Cant.</th><th className="r">Base Bs</th><th className="r">IVA Bs</th><th className="r">Total Bs</th>
                <th className="r">Pedidos</th><th className="r">Cant.</th><th className="r">Base Bs</th><th className="r">IVA Bs</th><th className="r">Total Bs</th>
                <th className="r">Desp. kg</th><th className="r">Desp. L</th><th className="r">Pend. kg</th><th className="r">Pend. L</th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((grupo) => (
                <React.Fragment key={grupo}>
                  <tr className="grp"><td colSpan={15}>{grupo}</td></tr>
                  {cierre.filas.filter((r) => r.grupo === grupo).map((r) => (
                    <tr key={r.key}>
                      <td className="c-name pad">{r.nombre}{r.fiscal && <span className="tag mini">{r.fiscal}</span>}</td>
                      <td className="r mono muted">{r.docsEntregados}</td>
                      <td className="r mono muted">{num(r.cantidadEntregada)}</td>
                      <td className="r mono">{bs(r.baseEntregada)}</td>
                      <td className="r mono">{bs(r.ivaEntregado)}</td>
                      <td className="r mono strong">{bs(r.totalEntregado)}</td>
                      <td className="r mono muted pend-cell">{r.docsPendientes}</td>
                      <td className="r mono muted pend-cell">{num(r.cantidadPendiente)}</td>
                      <td className="r mono pend-cell">{bs(r.basePendiente)}</td>
                      <td className="r mono pend-cell">{bs(r.ivaPendiente)}</td>
                      <td className="r mono strong pend-cell">{bs(r.totalPendiente)}</td>
                      <td className="r mono inv-cell">{num(r.kgDespachado)}</td>
                      <td className="r mono inv-cell">{num(kgALitros(r.kgDespachado))}</td>
                      <td className="r mono inv-cell warn-num">{num(r.kgComprometido)}</td>
                      <td className="r mono inv-cell warn-num">{num(kgALitros(r.kgComprometido))}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              <tr className="tot">
                <td>TOTALES DEL CIERRE</td>
                <td className="r mono">{t.docsEntregados}</td><td className="r mono">{num(t.cantidadEntregada)}</td>
                <td className="r mono">{bs(t.baseEntregada)}</td><td className="r mono">{bs(t.ivaEntregado)}</td><td className="r mono">{bs(t.totalEntregado)}</td>
                <td className="r mono">{t.docsPendientes}</td><td className="r mono">{num(t.cantidadPendiente)}</td>
                <td className="r mono">{bs(t.basePendiente)}</td><td className="r mono">{bs(t.ivaPendiente)}</td><td className="r mono">{bs(t.totalPendiente)}</td>
                <td className="r mono">{num(t.kgDespachado)}</td><td className="r mono">{num(kgALitros(t.kgDespachado))}</td>
                <td className="r mono">{num(t.kgComprometido)}</td><td className="r mono">{num(kgALitros(t.kgComprometido))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="cuadre-foot">
          <div><span>Inventario físico al cierre</span><b><KgL kg={g.fisico} /></b></div>
          <div><span>GLP comprometido pendiente</span><b><KgL kg={g.comprometido} /></b></div>
          <div><span>Disponible real</span><b><KgL kg={g.disponible} /></b></div>
          <div className="formula"><span>Fórmula de control</span><b>Físico − comprometido = disponible</b></div>
        </div>
        {periodoCerrado && <div className="cerrado-bar"><Lock size={15} /> {textoCierre(cierrePeriodo)}</div>}
      </section>
    </>
  );
}

/* ═══════════  MODAL FACTURA MANUAL  ═══════════ */

function ModalManual({ onClose, onSave }) {
  const [d, setD] = useState({ usuario: USUARIOS[1].id, cdt: CDTS[0].id, concepto: "BOMB_10", cantidad: 1 });
  const [err, setErr] = useState(null);
  // La misma cuenta que hará la factura: tarifa de hoy e IVA según el uso del contrato.
  const m = montos(d.concepto, Number(d.cantidad) || 0, d.usuario, HOY);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const ok = Number(d.cantidad) > 0;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Facturación</div><h3>Factura manual del CDT</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <p className="modal-intro">Para el talonario físico que emiten los CDT. Entra al consolidado de ingresos igual que las automáticas, marcada como talonario.</p>
          <div className="row2">
            <label className="campo"><span>CDT emisor</span><select value={d.cdt} onChange={set("cdt")}>{CDTS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="campo"><span>Cantidad</span><input type="number" min="1" value={d.cantidad} onChange={set("cantidad")} /></label>
          </div>
          <label className="campo"><span>Usuario</span><select value={d.usuario} onChange={set("usuario")}>{USUARIOS.map((u) => <option key={u.id} value={u.id}>{u.nombre} — contrato {u.contrato}</option>)}</select></label>
          <label className="campo"><span>Concepto</span><select value={d.concepto} onChange={set("concepto")}>{CONCEPTOS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <div className="preview"><div className="preview-h">Monto calculado · tarifa de hoy</div><div className="preview-monto">Bs {bs(m.total)}</div>
            <div className="preview-det">Base {bs(m.base)} · IVA {m.exento ? "exonerado" : bs(m.iva)}</div></div>
          {err && <div className="cg2-err">{err}</div>}
        </div>
        <div className="modal-f"><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => {
            const r = onSave(d);
            if (!r?.ok) setErr(r?.error || "No se pudo registrar la factura.");
          }}>Registrar factura</button></div>
      </div>
    </div>
  );
}

/* ═══════════  ESTILOS  ═══════════ */

function Estilos() {
  return (
    <style>{`
.gl{--ink:#101720;--ink-2:#3D4A59;--ink-3:#71808F;--bg:#E8EBEE;--panel:#FFF;--line:#D8DEE4;--line-2:#EDF0F3;
--azul:#14548C;--azul-2:#1E74BF;--azul-w:#E7F0F8;--llama:#D75A12;--llama-w:#FCEEE4;
--verde:#2C7A3F;--verde-w:#E6F2E8;--rojo:#B3261E;--rojo-w:#FBEAE8;--morado:#5B4A80;--morado-w:#EDE9F4;
--sans:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
display:flex;min-height:calc(100vh - 46px);background:var(--bg);font-family:var(--sans);color:var(--ink);font-size:14px;-webkit-font-smoothing:antialiased}
.gl *{box-sizing:border-box}
.gl button{font-family:inherit;cursor:pointer}
.gl select,.gl input,.gl textarea{font-family:inherit;font-size:13.5px}
.gl :focus-visible{outline:2px solid var(--azul-2);outline-offset:2px}

.side{width:250px;flex-shrink:0;background:var(--ink);color:#C6D0DA;display:flex;flex-direction:column;position:sticky;top:46px;height:calc(100vh - 46px)}
.brand{padding:18px 18px 16px}
.brand-img{width:132px;height:auto;display:block;filter:brightness(0) invert(1)}
.brand-sub{font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:#7E8D9C;margin-top:7px}
.side nav{display:flex;flex-direction:column;gap:1px;padding:0 10px;overflow-y:auto}
.navbtn{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;background:none;border:none;color:#A9B6C2;font-size:13.5px;text-align:left;border-radius:7px;transition:.12s}
.navbtn:hover{background:#1B2531;color:#E4EAF0}
.navbtn.on{background:var(--azul);color:#fff;font-weight:550}
.navbtn span{flex:1}
.navbadge{font-style:normal;font-family:var(--mono);font-size:11px;background:var(--llama);color:#fff;padding:1px 6px;border-radius:20px;font-weight:600}
.side-foot{margin-top:auto;padding:14px 18px;border-top:1px solid #212C39}
.periodo-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:#6F7E8D}
.periodo-val{color:#fff;font-size:15px;font-weight:600;margin-top:4px}
.periodo-est{display:flex;align-items:center;gap:5px;margin-top:7px;font-size:11.5px;color:#5FBF7B}
.periodo-est.cerr{color:#D9A441}
.lara{width:70px;height:auto;display:block;margin:14px auto 2px;opacity:.85}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:20px 26px 16px;background:var(--panel);border-bottom:1px solid var(--line)}
.top h1{margin:0;font-size:20px;font-weight:640;letter-spacing:-.4px}
.top p{margin:4px 0 0;font-size:12.5px;color:var(--ink-3)}
.select-wrap{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:8px;padding:0 10px;color:var(--ink-3);height:36px}
.select-wrap select{border:none;background:none;padding:8px 2px;color:var(--ink);outline:none}
.body{padding:20px 26px 40px;flex:1}

.btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:1px solid var(--line);background:var(--panel);color:var(--ink-2);border-radius:8px;font-size:13.5px;font-weight:520;transition:.12s;white-space:nowrap}
.btn:hover{border-color:#B8C2CC;color:var(--ink)}
.btn.primary{background:var(--azul);border-color:var(--azul);color:#fff}
.btn.primary:hover{background:#0F4372}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.sm{height:30px;padding:0 11px;font-size:12.5px}
.icon-btn{background:none;border:none;color:var(--ink-3);padding:4px;border-radius:6px;display:grid;place-items:center}
.icon-btn:hover{background:var(--line-2);color:var(--ink)}
.link{background:none;border:none;padding:0;color:var(--azul-2);font-family:var(--mono);font-size:12px;text-decoration:underline;text-underline-offset:2px;margin-right:7px}

.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(186px,1fr));gap:13px;margin-bottom:14px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 16px;border-top:3px solid var(--azul)}
.kpi.clickable{cursor:pointer}.kpi.clickable:hover{border-color:#B8C2CC}
.kpi.ambar{border-top-color:var(--llama)}.kpi.verde{border-top-color:var(--verde)}
.kpi.gris{border-top-color:#94A3B0}.kpi.rojo{border-top-color:var(--rojo)}
.kpi-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:600}
.kpi-v{font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.9px;margin:7px 0 3px;font-variant-numeric:tabular-nums}
.kpi-p{font-size:11.5px;color:var(--ink-3)}

.conc-bar{display:flex;align-items:center;gap:14px;background:var(--verde-w);border:1px solid #C4E0CC;border-radius:11px;padding:13px 18px;margin-bottom:15px}
.conc-ico{width:38px;height:38px;border-radius:11px;background:var(--verde);color:#fff;display:grid;place-items:center;flex-shrink:0}
.conc-bar div:nth-child(2){flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.conc-bar b{font-size:13.5px;font-weight:620;color:#1E5C2E}
.conc-bar span{font-size:12.5px;color:#3A6B47}
.conc-monto{font-family:var(--mono);font-size:17px;font-weight:650;color:var(--verde);white-space:nowrap}

.grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:15px;align-items:start}
.card{background:var(--panel);border:1px solid var(--line);border-radius:11px;overflow:hidden;margin-bottom:15px}
.card-h{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:13px 18px;border-bottom:1px solid var(--line-2)}
.card-h h2{margin:0;font-size:14px;font-weight:620;display:flex;align-items:center;gap:8px}
.cnt{font-family:var(--mono);font-size:11px;background:var(--line-2);color:var(--ink-3);padding:2px 7px;border-radius:20px;font-weight:600}
.card-note{font-size:11.5px;color:var(--ink-3)}
.scroll{overflow-x:auto}
.mas{padding:11px 18px;font-size:12px;color:var(--ink-3);border-top:1px solid var(--line-2);background:#FBFCFD}

.bars{padding:14px 18px 18px;display:flex;flex-direction:column;gap:10px}
.bar-row{display:grid;grid-template-columns:1fr 78px 96px;gap:12px;align-items:center}
.bar-name{display:block;font-size:12.5px;color:var(--ink-2);line-height:1.25}
.bar-track{height:7px;background:var(--line-2);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;background:var(--azul-2);border-radius:4px;transition:width .5s}
.bar-fill.rojo{background:#C25A52}
.bar-val{font-family:var(--mono);font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums}



.tbl{width:100%;border-collapse:collapse;min-width:900px}
.tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:650;padding:9px 11px;border-bottom:1px solid var(--line);background:#FBFCFD;white-space:nowrap}
.tbl td{padding:9px 11px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:13px}
.tbl tbody tr:hover{background:#FAFBFC}
.tbl tbody tr.portal{background:#F7FBF8}
.tbl tbody tr.portal:hover{background:#EFF7F1}
.pin{color:var(--verde);font-size:9px;margin-left:5px;vertical-align:middle}
.tbl th:first-child,.tbl td:first-child{padding-left:18px}
.tbl th:last-child,.tbl td:last-child{padding-right:18px}
.tbl .r{text-align:right}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:12px}
.strong{font-weight:600}.muted{color:var(--ink-3)}
.u-name{font-weight:520;line-height:1.25;font-size:12.5px}
.u-name.sm{font-size:12px}
.u-doc{font-size:10.5px;color:var(--ink-3);font-family:var(--mono);margin-top:2px}
.c-name{color:var(--ink-2);font-size:12.5px}
.c-name.asunto{max-width:250px}
.c-name.pad{padding-left:30px}
.neg{color:var(--llama)}
.tbl tr.grp td{background:#F5F7F9;font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:650;color:var(--ink-2);padding:7px 18px}
.tbl tr.tot td{border-top:2px solid var(--ink);border-bottom:none;font-weight:650;background:#FBFCFD;padding:12px 11px}
.empty{padding:34px 18px;text-align:center;color:var(--ink-3);font-size:13px}

.chip{display:inline-block;font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap}
.st-pag{background:var(--ambar-w,#FBF1DE);color:#9A6206}
.st-ad{background:var(--llama-w);color:var(--llama)}
.st-con{background:var(--azul-w);color:var(--azul)}
.st-cul{background:var(--verde-w);color:var(--verde)}
.tag{display:inline-block;font-size:10.5px;padding:2px 8px;border-radius:5px;background:var(--line-2);color:var(--ink-2);white-space:nowrap}
.tag.alt{background:var(--morado-w);color:var(--morado)}
.tag.warn{background:#FBF1DE;color:#9A6206}
.tag.mini{margin-left:7px;font-size:9.5px;padding:1px 6px}
.pri{display:inline-block;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.05em}
.pri-alta{background:var(--rojo-w);color:var(--rojo)}
.pri-media{background:#FBF1DE;color:#9A6206}
.pri-baja{background:var(--line-2);color:var(--ink-3)}
.pago-ok{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:11px;background:var(--verde-w);color:var(--verde);padding:2px 7px;border-radius:5px;font-weight:600}

.toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.search{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:7px;padding:0 10px;height:31px;color:var(--ink-3)}
.search input{border:none;outline:none;width:200px;padding:6px 0;background:none}
.tabs{display:flex;background:var(--line-2);border-radius:7px;padding:2px}
.tabs button{border:none;background:none;padding:5px 10px;font-size:12px;color:var(--ink-3);border-radius:5px}
.tabs button.on{background:var(--panel);color:var(--ink);font-weight:560;box-shadow:0 1px 2px rgba(16,23,32,.1)}

.split{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:15px}
.split-box{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:15px 16px}
.split-box.total{background:var(--ink);border-color:var(--ink);color:#fff}
.split-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:600}
.split-box.total .split-l{color:#8B99A7}
.split-v{font-family:var(--mono);font-size:21px;font-weight:600;letter-spacing:-.8px;margin:8px 0 4px;font-variant-numeric:tabular-nums}
.split-p{font-size:11.5px;color:var(--ink-3)}
.cierre-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
.split-sep{color:var(--ink-3);font-weight:400}
.cierre-leyenda{display:flex;gap:18px;flex-wrap:wrap;padding:11px 18px;background:#FBFCFD;border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2);font-size:11.5px;color:var(--ink-3)}
.cierre-leyenda b{color:var(--ink-2);font-weight:650}
.cierre-scroll{max-width:100%}
.tbl.cierre-unificado{min-width:1780px}
.tbl.cierre-unificado .head-groups th{text-align:center;font-size:9.5px;letter-spacing:.08em;border-right:1px solid var(--line)}
.tbl.cierre-unificado .head-groups th:first-child{text-align:left}
.tbl.cierre-unificado .grp-ent{background:#F4F8FB;color:var(--azul)}
.tbl.cierre-unificado .grp-pend{background:#FFF9ED;color:#8A5B08}
.tbl.cierre-unificado .grp-inv{background:#F3F8F4;color:#2F6B3B}
.tbl.cierre-unificado .pend-cell{background:#FFFCF5}
.tbl.cierre-unificado .inv-cell{background:#FAFCFA}
.cuadre-foot{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--line);background:#FBFCFD}
.cuadre-foot>div{padding:13px 16px;border-right:1px solid var(--line-2);display:flex;flex-direction:column;gap:4px}
.cuadre-foot>div:last-child{border-right:none}
.cuadre-foot span{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:650}
.cuadre-foot b{font-family:var(--mono);font-size:12px;color:var(--ink);font-weight:600}
.cuadre-foot .formula b{font-family:inherit;color:var(--azul)}
@media(max-width:1180px){.cierre-kpis{grid-template-columns:repeat(2,1fr)}.cuadre-foot{grid-template-columns:repeat(2,1fr)}}

.warn-bar{display:flex;align-items:center;gap:10px;background:#FBF1DE;border:1px solid #E8D3A8;color:#7A4E05;border-radius:10px;padding:12px 16px;margin-bottom:15px;font-size:13px}
.cerrado-bar{display:flex;align-items:center;gap:8px;padding:13px 18px;background:var(--azul-w);color:var(--azul);font-size:13px;font-weight:520}
.toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;display:flex;align-items:center;gap:9px;padding:11px 17px;border-radius:10px;font-size:13px;z-index:80;box-shadow:0 10px 30px rgba(16,23,32,.3);animation:up .22s}
@keyframes up{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

.overlay{position:fixed;inset:0;background:rgba(16,23,32,.55);display:grid;place-items:center;padding:18px;z-index:50;animation:fade .18s}
@keyframes fade{from{opacity:0}to{opacity:1}}
.modal{background:var(--panel);border-radius:14px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(16,23,32,.3);animation:pop .2s cubic-bezier(.2,.9,.3,1);max-height:92vh;display:flex;flex-direction:column}
.modal.wide{max-width:840px}
@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.modal-h{display:flex;justify-content:space-between;align-items:flex-start;padding:17px 20px;border-bottom:1px solid var(--line-2)}
.modal-h h3{margin:4px 0 0;font-size:15.5px;font-weight:620}
.mh-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:var(--azul);font-weight:700}
.modal-b{padding:17px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.modal-intro{margin:0;font-size:12.5px;color:var(--ink-3);line-height:1.5}
.modal-f{display:flex;justify-content:flex-end;gap:9px;padding:14px 20px;border-top:1px solid var(--line-2);background:#FBFCFD;border-radius:0 0 14px 14px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.campo{display:flex;flex-direction:column;gap:5px}
.campo>span{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);font-weight:600}
.campo select,.campo input,.campo textarea{border:1px solid var(--line);border-radius:8px;padding:9px 10px;background:var(--panel);color:var(--ink);outline:none;width:100%;resize:vertical}
.campo select:focus,.campo input:focus,.campo textarea:focus{border-color:var(--azul-2)}
.preview{background:var(--azul-w);border-radius:10px;padding:13px 15px}
.preview-h{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--azul);font-weight:650;margin-bottom:8px}
.preview-monto{font-family:var(--mono);font-size:20px;font-weight:600;color:var(--azul)}
.preview-det{font-size:11.5px;color:var(--ink-3);margin-top:3px}
/* Se adapta al ancho en vez de partir cada valor en tres líneas: dentro de un modal
   de 520px, cuatro columnas fijas no caben. */
.rec-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px 16px;background:#F5F7F9;border-radius:10px;padding:13px 15px}
.rec-meta div{display:flex;flex-direction:column;gap:3px;min-width:0}
.rec-meta span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:600}
.rec-meta b{font-size:13px;font-weight:560}
.burb{border-radius:12px;padding:13px 15px;font-size:13.5px;line-height:1.55}
.burb.usuario{background:var(--line-2);color:var(--ink-2)}
.burb.empresa{background:var(--verde-w);color:#1E5C2E}
.burb-l{font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;opacity:.65;margin-bottom:6px}


@media(max-width:1180px){.grid2{grid-template-columns:1fr}.split{grid-template-columns:1fr}}
@media(max-width:900px){
 .gl{flex-direction:column}
 .side{width:100%;height:auto;position:relative;flex-direction:row;align-items:center;overflow-x:auto;top:0}
 .side nav{flex-direction:row;padding:8px}
 .navbtn span{display:none}.side-foot{display:none}.brand-sub{display:none}
 .brand{padding:10px 14px}.brand-img{width:100px}
 .top{flex-direction:column;align-items:stretch}
 .body{padding:14px}
 .kpis{grid-template-columns:1fr 1fr}
 .rec-meta{grid-template-columns:1fr 1fr}
 .conc-bar{flex-wrap:wrap}
 .row2{grid-template-columns:1fr}
}
@media print{.gl.printing .side,.gl.printing .main,.gl.printing .toast{display:none!important}}
@media(prefers-reduced-motion:reduce){.gl *{animation:none!important;transition:none!important}}

/* estados, pagos y documentos */
.st-gris{background:var(--line-2);color:var(--ink-3)}
.pago-bad{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:11px;background:var(--rojo-w);color:var(--rojo);padding:2px 7px;border-radius:5px;font-weight:600}
.u-doc.falta{color:#9A6206;font-weight:600}
.tag.ok{background:var(--verde-w);color:var(--verde)}
.tag-largo{white-space:normal;max-width:280px;text-align:left;line-height:1.35}
.mini-cap{height:7px;background:var(--line-2);border-radius:4px;overflow:hidden;min-width:90px;margin-bottom:4px}
.mini-cap span{display:block;height:100%;background:var(--verde);border-radius:4px}
.warn-num{color:#9A6206}
.split.cinco{grid-template-columns:repeat(5,minmax(0,1fr))}
.cierre-consecuencias{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:12.5px;line-height:1.5;color:var(--ink-2)}
.conc-link{border:0;background:none;display:flex;align-items:center;gap:4px;cursor:pointer;padding:0}
.kardex-cuadre{margin:12px 18px}
/* panel: dinero en poder de la empresa, franja de AD y variantes */
.cm-dash-metric.blue{border-left:4px solid #2d65b0}
.cm-group-bars.single .cm-gbar{width:58%}
.cm-period-strip b.sin-base{color:#7B8882}
.cm-head-r{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.cm-poder{background:#fff;border:1px solid #e1e7e4;border-radius:13px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.cm-poder-h{display:flex;gap:10px;align-items:center;color:#2D65B0}
.cm-poder-h span{display:block;font-size:11px;color:#6B7B85;font-weight:600}
.cm-poder-h b{display:block;font-size:22px;color:#17385C;letter-spacing:-.02em}
.cm-poder-suma{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap}
.cm-poder-suma>div{flex:1;min-width:150px;background:#F5F8FB;border-radius:9px;padding:9px 11px}
.cm-poder-suma>i{align-self:center;font-style:normal;color:#8C98A3;font-weight:700}
.cm-poder-suma span{display:block;font-size:10.5px;color:#6B7B85}
.cm-poder-suma b{display:block;font-size:14px;margin-top:3px}
.cm-poder-suma small{display:block;font-size:10px;color:#8A97A1;margin-top:2px}
.cm-poder p{margin:0;font-size:11.5px;color:#6B7B85;line-height:1.5}
.cm-ad-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
.cm-ad-strip>div{background:#f7f9f8;border-radius:8px;padding:8px}
.cm-ad-strip span{display:block;font-size:10px;color:#728078}
.cm-ad-strip b{display:block;font-size:15px;margin-top:2px}
.cm-ad-strip small{display:block;font-size:9.5px;color:#7B8882}
@media(max-width:1180px){.split.cinco{grid-template-columns:repeat(3,minmax(0,1fr))}.cm-ad-strip{grid-template-columns:repeat(2,1fr)}}
@media(max-width:900px){.split.cinco{grid-template-columns:1fr 1fr}}
/* dashboard ejecutivo comercializacion */
.cm-dash{display:flex;flex-direction:column;gap:16px}.cm-dash-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.cm-dash-head h2{font-size:24px;margin:5px 0 5px}.cm-dash-head p{margin:0;color:#70808d;font-size:12.5px}.cm-dash-eyebrow{font-size:10px;font-weight:800;color:#246447;text-transform:uppercase;letter-spacing:.08em}.cm-range{display:flex;padding:3px;background:#eef2f4;border-radius:9px}.cm-range button{border:0;background:transparent;padding:7px 14px;border-radius:7px;font-size:10px;font-weight:800;color:#6b7882;cursor:pointer}.cm-range button.on{background:#fff;color:#17372a;box-shadow:0 1px 4px #1a2e2314}.cm-top-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.cm-dash-metric{border:1px solid #e0e7e4;background:#fff;border-radius:12px;padding:14px;text-align:left;display:flex;flex-direction:column;gap:5px;min-height:92px;color:#1b2923}.cm-dash-metric>span{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#718079;font-weight:800}.cm-dash-metric>b{font-size:19px}.cm-dash-metric>small{font-size:9.5px;color:#7a8982;line-height:1.35}.cm-dash-metric.money{border-left:4px solid #1c7a50}.cm-dash-metric.warn{border-left:4px solid #d08a24}.cm-dash-metric.soft{border-left:4px solid #89949d}.cm-dash-metric.click{cursor:pointer}.cm-dash-metric.click:hover{transform:translateY(-1px);box-shadow:0 5px 14px #14291f12}.cm-period-strip{display:flex;align-items:center;gap:10px;background:#F7F9F8;border:1px solid #E4EAE7;border-radius:10px;padding:8px 10px}.cm-period-strip>span{font-size:8.5px;color:#6C7B74;margin-right:auto}.cm-period-strip>div{min-width:94px;border-left:1px solid #DEE6E2;padding-left:9px}.cm-period-strip b{display:block;font-size:9.5px;color:#2D5F48}.cm-period-strip small{font-size:7.5px;color:#7B8882}.cm-chart{background:#fff;border:1px solid #e1e7e4;border-radius:13px;padding:15px;min-width:0}.cm-money-chart{min-height:330px}.cm-chart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px}.cm-chart-head h3{margin:0;font-size:14px}.cm-chart-head p{margin:3px 0 0;font-size:9.5px;color:#78867f}.cm-chart-grid{display:grid;gap:12px}.cm-chart-grid.two{grid-template-columns:1fr 1fr}.cm-chart-link{border:0;background:none;color:#2c6c4f;font-size:9px;font-weight:800;display:flex;gap:4px;align-items:center;cursor:pointer}.cm-chart-badge{font-size:8.5px;background:#eef5f1;color:#35664f;padding:5px 8px;border-radius:999px}.cm-legend{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.cm-legend span{font-size:8px;color:#6b7972;display:flex;gap:4px;align-items:center}.cm-legend i{width:7px;height:7px;border-radius:2px}.cm-group-bars{height:220px;display:flex;gap:5px;align-items:flex-end;border-bottom:1px solid #dfe6e2;padding:8px 4px 0;overflow-x:auto}.cm-gcol{height:100%;min-width:32px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.cm-group-bars.dense .cm-gcol{min-width:23px}.cm-gbars{height:178px;width:100%;display:flex;align-items:flex-end;gap:2px;justify-content:center}.cm-gbar{width:18%;min-width:3px;border-radius:3px 3px 0 0;transition:.2s}.cm-gbar.green{background:#1c7a50}.cm-gbar.blue{background:#2d65b0}.cm-gbar.amber{background:#d08a24}.cm-gbar.slate{background:#8c98a3}.cm-gcol>span{font-size:7.5px;color:#7b8882;white-space:nowrap}.cm-money-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.cm-money-foot.two{grid-template-columns:repeat(2,1fr)}.cm-money-foot>div{background:#f7f9f8;border-radius:8px;padding:8px}.cm-money-foot span{font-size:8px;color:#728078;display:block}.cm-money-foot b{font-size:10px;margin-top:3px;display:block}.cm-inv-list{display:flex;flex-direction:column;gap:13px}.cm-inv-row{display:grid;grid-template-columns:minmax(150px,auto) 1fr minmax(150px,auto);gap:12px;align-items:center}.cm-inv-name b,.cm-inv-val b{font-size:11.5px;display:block;line-height:1.3}.cm-inv-name span,.cm-inv-val span{font-size:11px;color:#78867f;display:block;margin-top:3px;line-height:1.4}.cm-inv-val{text-align:right}.cm-inv-track{height:13px;background:#edf1ef;border-radius:999px;position:relative;overflow:hidden;display:flex}.cm-inv-disp{height:100%;background:#2b9566}.cm-inv-comp{height:100%;background:#d6a34a}.cm-inventory-total{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 16px;border-top:1px solid #e6ebe8;margin-top:13px;padding-top:10px;align-items:center}.cm-inventory-total span{font-size:10.5px;color:#75837c;display:block}.cm-inventory-total b{font-size:12px;display:block;margin-top:2px}.cm-donut-wrap{display:grid;grid-template-columns:170px 1fr;gap:20px;align-items:center;min-height:205px}.cm-donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;margin:auto}.cm-donut>div{width:92px;height:92px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 1px #e5ebe8}.cm-donut b{font-size:20px}.cm-donut span{font-size:8px;color:#77857e}.cm-donut-legend{display:flex;flex-direction:column;gap:10px}.cm-donut-row{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:center}.cm-donut-row>i{width:8px;height:8px;border-radius:50%}.cm-donut-row span{display:block;font-size:8.5px;color:#718078}.cm-donut-row b{font-size:12px}.cm-donut-row em{font-style:normal;font-size:8.5px;color:#728078}.cm-seg-list{display:flex;flex-direction:column;gap:14px}.cm-seg-head{display:flex;justify-content:space-between;gap:8px}.cm-seg-head span{font-size:9px;font-weight:800}.cm-seg-head b{font-size:10px}.cm-seg-track{height:11px;background:#edf1ef;border-radius:999px;overflow:hidden;margin:6px 0 4px}.cm-seg-track>div{height:100%;background:#376f99;border-radius:999px}.cm-seg small{font-size:8px;color:#77857e}.cm-rank{display:flex;flex-direction:column;gap:8px}.cm-rank-row{display:grid;grid-template-columns:20px 1fr 100px;gap:8px;align-items:center}.cm-rank-n{width:18px;height:18px;border-radius:50%;background:#eff4f1;color:#32634c;font-size:8px;font-weight:800;display:grid;place-items:center}.cm-rank-main>div:first-child{display:flex;justify-content:space-between;gap:8px}.cm-rank-main span{font-size:8.5px}.cm-rank-main small{font-size:7.5px;color:#7c8983}.cm-rank-track{height:6px;background:#eef2f0;border-radius:999px;overflow:hidden;margin-top:4px}.cm-rank-track>div{height:100%;background:#2f8060}.cm-rank-row>b{text-align:right;font-size:8.5px}.cm-compare{display:flex;flex-direction:column;gap:12px}.cm-compare-row{display:grid;grid-template-columns:90px 1fr;gap:9px}.cm-compare-row>span{font-size:8.5px;font-weight:800;padding-top:3px}.cm-compare-row>div{display:flex;flex-direction:column;gap:4px}.cm-compare-bar{height:18px;background:#f2f5f4;border-radius:5px;position:relative;overflow:hidden}.cm-compare-bar i{display:block;height:100%;min-width:2px}.cm-compare-bar i.a{background:#356ea4}.cm-compare-bar i.b{background:#d29a3e}.cm-compare-bar em{position:absolute;inset:0 5px;display:flex;align-items:center;font-style:normal;font-size:7px;color:#1f2e27}.cm-conc{margin:0}.cm-mini-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.cm-mini-actions button{background:#fff;border:1px solid #e1e7e4;border-radius:9px;padding:9px;display:grid;grid-template-columns:18px 1fr auto;gap:6px;align-items:center;text-align:left;color:#27362f;cursor:pointer}.cm-mini-actions span{font-size:8.5px}.cm-mini-actions b{font-size:9px}.cm-mini-actions svg{color:#4a705d}
@media(max-width:1100px){.cm-top-kpis{grid-template-columns:repeat(2,1fr)}.cm-chart-grid.two{grid-template-columns:1fr}.cm-mini-actions{grid-template-columns:repeat(2,1fr)}}

`}</style>
  );
}
