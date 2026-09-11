import React, { useState, useMemo, useEffect } from "react";

import {
  LayoutDashboard, ClipboardList, FileText, Receipt, Gauge, HeartHandshake,
  Lock, Plus, X, ChevronRight, Check, ArrowRight, AlertTriangle, Search,
  Building2, CircleDot, Download, Printer, Users, MessageSquareWarning,
  Eye, CheckCircle2, Zap, Send, TrendingUp, Landmark, Smartphone, Truck, Clock3, Route,
  Wallet, BookText, ShoppingBag, Tag as TagIcon, UserCog,
  ShieldAlert, Undo2, Wrench, UserPlus, Power,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, PERIODO, HOY, CDTS, CONCEPTOS, GRUPOS,
  TIPOS_DESPACHO, USUARIOS, CLIENTE_PORTAL, BANCOS, COMUNAS, EPSDCS, banco, cpt, usr, tpd, cdtOf, comunaOf, epsdcOf, segmentoUsuario,
  FASES, faseIdx, fase, bs, num, fecha, fechaCorta, fechaLarga, descargar, csv, montos, kgALitros,
  pagadasPendientesDe, diasEntre, kgDeSolicitud, resumenCierreMensual,
  bitacoraPagos, patronesSospechosos, reglaPago, aplicarReglaPago, esAbonada,
  CANALES_PAGO, puedeSolicitar, validarCanje, envasesDe,
  INCIDENCIAS_PREVIAS, incidenciaPrevia, gruposIncidenciaPrevia,
} from "./datos.jsx";
import { VisorDocumento } from "./Documentos.jsx";
import Usuario360Modal from "./Usuario360.jsx";
import { PreCierre } from "./ComercializacionExtra.jsx";
import { LibroVentas, SaldosAFavor, ListaPrecios, PadronUsuarios, VentasSinContrato } from "./ComercializacionGestion.jsx";
import { ConsignacionComunal, CustodiaStyles } from "./ComercializacionCustodia.jsx";
import { cilindrosFila, kgFila, unidadDistribucion } from "./distribucionSeed.js";
import { KgL, KgLBloque, NotaFactor, UnidadesStyles, kgYL } from "./Unidades.jsx";

export default function Comercializacion({
  solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles,
  periodoCerrado, setPeriodoCerrado, crearManual, rutasDistribucion = [],
  responderReclamo, tomarReclamo,
  abonos = [], saldos = {}, padron = [], parqueEnvases = [], consignaciones = [],
  registrarAbono, registrarIncidenciaPrevia, culminarServicio, crearVentaGenerica, actualizarUsuario,
  crearUsuario, definirEstadoUsuario,
  crearSolicitudManual, revertirResolucionPago,
}) {
  const [vista, setVista] = useState("panel");
  const incidencias = solicitudes.filter((s) => s.pago?.estado === "POR_CONCILIAR").length;
  const [cdtF, setCdtF] = useState("TODOS");
  const [modal, setModal] = useState(null);
  const [doc, setDoc] = useState(null);
  const [cascada, setCascada] = useState(null);
  const [toast, setToast] = useState(null);
  const aviso = (m) => { setToast(m); setTimeout(() => setToast(null), 3400); };

  const enCdt = (arr) => arr.filter((x) => cdtF === "TODOS" || x.cdt === cdtF);
  const solV = useMemo(() => enCdt(solicitudes), [solicitudes, cdtF]);
  const facV = useMemo(() => enCdt(facturas), [facturas, cdtF]);
  const bopV = useMemo(() => enCdt(boletas), [boletas, cdtF]);
  const movV = useMemo(() => enCdt(movs), [movs, cdtF]);

  const ingresos = facV.reduce((s, f) => s + f.total, 0);

  useEffect(() => {
    if (!cascada || cascada.visibles >= cascada.pasos.length) return;
    const t = setTimeout(() => setCascada((c) => c && { ...c, visibles: c.visibles + 1 }), 430);
    return () => clearTimeout(t);
  }, [cascada]);

  /* ── Exportaciones ── */
  function expLibro() {
    descargar(`libro-ventas-${PERIODO.anio}-08.csv`, csv([
      ["Libro de ventas", EMPRESA.nombre, EMPRESA.rif, PERIODO.label], [],
      ["Serie", "Nro control", "Fecha", "CDT", "Rif/CI", "Razón social", "Contrato", "Concepto", "Cantidad",
       "Base imponible", "Exento", "IVA 16%", "Total", "Origen", "AD", "Banco", "Referencia"],
      ...facV.map((f) => [f.serie, f.control, fecha(f.fecha), cdtOf(f.cdt).corto, usr(f.usuario).doc,
        usr(f.usuario).nombre, usr(f.usuario).contrato, cpt(f.concepto).nombre, f.cantidad,
        (f.exento ? 0 : f.base).toFixed(2), (f.exento ? f.base : 0).toFixed(2), f.iva.toFixed(2),
        f.total.toFixed(2), f.origen, f.ad || "", f.pago?.banco ? banco(f.pago.banco).nombre : "", f.pago?.referencia || ""]),
      [], ["TOTALES", "", "", "", "", "", "", "", "",
        facV.filter((f) => !f.exento).reduce((s, f) => s + f.base, 0).toFixed(2),
        facV.filter((f) => f.exento).reduce((s, f) => s + f.base, 0).toFixed(2),
        facV.reduce((s, f) => s + f.iva, 0).toFixed(2), facV.reduce((s, f) => s + f.total, 0).toFixed(2)],
    ]));
    aviso("Libro de ventas descargado");
  }

  function expCierre() {
    const cierre = resumenCierreMensual(facV, solV);
    const t = cierre.totales;
    const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
    const fisico = cdtsAlcance.reduce((a, c) => a + Number(existencias[c.id] || 0), 0);
    const comprometido = cdtsAlcance.reduce((a, c) => a + Number(compromisos[c.id] || 0), 0);
    const disponible = cdtsAlcance.reduce((a, c) => a + Number(disponibles[c.id] || 0), 0);

    descargar(`cierre-mensual-${PERIODO.anio}-08.csv`, csv([
      ["CIERRE MENSUAL DE COMERCIALIZACIÓN"], [EMPRESA.nombre, EMPRESA.rif], [PERIODO.label],
      ["Alcance", cdtF === "TODOS" ? "Todos los CDT" : cdtOf(cdtF).nombre], ["Emitido", fecha(HOY)], [],
      ["CUADRE GENERAL"],
      ["Facturado por entregas reales Bs", t.totalEntregado.toFixed(2), "Base Bs", t.baseEntregada.toFixed(2), "IVA Bs", t.ivaEntregado.toFixed(2)],
      ["Recaudado pendiente de despacho Bs", t.totalPendiente.toFixed(2), "Base pendiente Bs", t.basePendiente.toFixed(2), "IVA pendiente Bs", t.ivaPendiente.toFixed(2)],
      ["GLP despachado físicamente kg", t.kgDespachado.toFixed(2), "Litros", kgALitros(t.kgDespachado).toFixed(2)],
      ["GLP comprometido pendiente kg", t.kgComprometido.toFixed(2), "Litros", kgALitros(t.kgComprometido).toFixed(2)],
      ["Inventario físico al cierre kg", fisico.toFixed(2), "Comprometido kg", comprometido.toFixed(2), "Disponible real kg", disponible.toFixed(2)],
      ["Inventario físico al cierre L", kgALitros(fisico).toFixed(2), "Comprometido L", kgALitros(comprometido).toFixed(2), "Disponible real L", kgALitros(disponible).toFixed(2)], [],
      ["Concepto de ingreso",
       "Docs. entregados/facturados", "Cant. facturada", "Base entregada Bs", "IVA entregado Bs", "Total entregado Bs",
       "Solicitudes recaudadas pendientes", "Cant. pendiente", "Base pendiente Bs", "IVA pendiente Bs", "Total recaudado pendiente Bs",
       "GLP despachado kg", "GLP despachado L", "GLP comprometido kg", "GLP comprometido L"],
      ...GRUPOS.flatMap((g) => [[g.toUpperCase()], ...cierre.filas.filter((r) => r.grupo === g).map((r) => [
        r.nombre, r.docsEntregados, r.cantidadEntregada, r.baseEntregada.toFixed(2), r.ivaEntregado.toFixed(2), r.totalEntregado.toFixed(2),
        r.docsPendientes, r.cantidadPendiente, r.basePendiente.toFixed(2), r.ivaPendiente.toFixed(2), r.totalPendiente.toFixed(2),
        r.kgDespachado.toFixed(2), kgALitros(r.kgDespachado).toFixed(2), r.kgComprometido.toFixed(2), kgALitros(r.kgComprometido).toFixed(2),
      ])]),
      ["TOTALES", t.docsEntregados, t.cantidadEntregada, t.baseEntregada.toFixed(2), t.ivaEntregado.toFixed(2), t.totalEntregado.toFixed(2),
       t.docsPendientes, t.cantidadPendiente, t.basePendiente.toFixed(2), t.ivaPendiente.toFixed(2), t.totalPendiente.toFixed(2),
       t.kgDespachado.toFixed(2), kgALitros(t.kgDespachado).toFixed(2), t.kgComprometido.toFixed(2), kgALitros(t.kgComprometido).toFixed(2)],
      [], ["REGLAS DE CUADRE"],
      ["1", "El pago no descuenta inventario físico: queda como recaudación y GLP comprometido hasta la entrega."],
      ["2", "El cierre del AD genera BOP, salida física y factura cuando corresponde."],
      ["3", "La recaudación pendiente se muestra en el cierre, pero no se suma a la facturación entregada del período."],
      ["4", "Inventario disponible real = inventario físico - inventario comprometido."],
    ]));
    aviso("Cierre mensual descargado · mismos valores de pantalla y acta");
  }

  function expInventario() {
    descargar(`inventario-glp-${PERIODO.anio}-08.csv`, csv([
      ["MOVIMIENTOS DE INVENTARIO GLP", PERIODO.label], [],
      ["Movimiento", "Fecha", "CDT", "Comuna", "Documento", "Concepto", "Origen de salida", "Kg", "Litros"],
      ...movV.map((m) => [m.id, fecha(m.fecha), cdtOf(m.cdt).corto, comunaOf(m.comuna).nombre, m.doc, cpt(m.concepto).nombre, m.tipo === "SALIDA_MANUAL" ? "Factura manual de CDT" : "BOP automática", m.kg, kgALitros(Math.abs(m.kg)).toFixed(2)]),
      [], ["EXISTENCIAS", "Conversión: 1 litro de GLP = 0,540 kg"], ["CDT", "Inicial kg", "Despachado físico kg", "Existencia física kg", "Existencia física L", "Comprometido kg", "Comprometido L", "Disponible real kg", "Disponible real L"],
      ...CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF).map((c) =>
        [c.nombre, c.inicial, c.inicial - existencias[c.id], existencias[c.id], kgALitros(existencias[c.id]).toFixed(2), compromisos[c.id] || 0, kgALitros(compromisos[c.id] || 0).toFixed(2), disponibles[c.id] || 0, kgALitros(disponibles[c.id] || 0).toFixed(2)]),
    ]));
    aviso("Movimientos descargados");
  }

  function expPendientes() {
    const l = pagadasPendientesDe(solV).sort((a,b)=>(a.pago?.fecha||a.fecha)-(b.pago?.fecha||b.fecha));
    descargar(`recaudacion-pendiente-despacho-${PERIODO.anio}-08.csv`, csv([
      ["RECAUDACIÓN PENDIENTE DE DESPACHO", "Dinero cobrado cuyo GLP aún no ha salido físicamente del CDT"],
      ["Regla", "El pago reserva el GLP; BOP, factura y salida física se generan con el cierre real del AD"], [],
      ["Solicitud", "Pago", "Días esperando", "Persona", "Cédula", "Comuna", "CDT", "Producto", "Uso", "Tratamiento fiscal", "Cantidad", "Kg comprometidos", "Litros", "Base Bs", "IVA Bs", "Total recaudado Bs", "Estado", "AD"],
      ...l.map((x)=>[x.id, fecha(x.pago?.fecha||x.fecha), diasEntre(x.pago?.fecha||x.fecha, HOY), usr(x.usuario).nombre, usr(x.usuario).doc, comunaOf(x.comuna).nombre, cdtOf(x.cdt).corto, cpt(x.concepto).corto, segmentoUsuario(x.usuario), x.exento ? "IVA 0% / exonerado" : "IVA 16% / gravado", x.cantidad, kgDeSolicitud(x), kgALitros(kgDeSolicitud(x)).toFixed(2), Number(x.base||0).toFixed(2), Number(x.iva||0).toFixed(2), Number(x.total||0).toFixed(2), fase(x.estado).admin, x.ad||""]),
      [], ["TOTALES", "", "", "", "", "", "", "", "", "", l.reduce((a,x)=>a+Number(x.cantidad||0),0), l.reduce((a,x)=>a+kgDeSolicitud(x),0), kgALitros(l.reduce((a,x)=>a+kgDeSolicitud(x),0)).toFixed(2), l.reduce((a,x)=>a+Number(x.base||0),0).toFixed(2), l.reduce((a,x)=>a+Number(x.iva||0),0).toFixed(2), l.reduce((a,x)=>a+Number(x.total||0),0).toFixed(2)]
    ]));
    aviso("Recaudación pendiente de despacho exportada");
  }

  function expDespachos() {
    const l = solV.filter((s) => s.tipoDespacho !== "COMERCIAL");
    descargar(`despachos-especiales-${PERIODO.anio}-08.csv`, csv([
      ["DESPACHOS AUTOMATIZADOS: APOYOS, EXONERADOS, INSTITUCIONALES Y PROGRAMAS SOCIALES", PERIODO.label], [],
      ["Solicitud", "AD", "Fecha", "Tipo", "Beneficiario", "Rif/CI", "Contrato", "CDT", "Concepto", "Cantidad", "Kg GLP", "Boleta", "Estatus"],
      ...l.map((s) => [s.id, s.ad || "", fecha(s.fecha), tpd(s.tipoDespacho).nombre, usr(s.usuario).nombre,
        usr(s.usuario).doc, usr(s.usuario).contrato, cdtOf(s.cdt).corto, cpt(s.concepto).nombre,
        s.cantidad, cpt(s.concepto).kg * s.cantidad, s.boleta || "", fase(s.estado).admin]),
    ]));
    aviso("Despachos especiales descargados");
  }

  function expEPSDC() {
    const l = solV.filter((s) => s.transportistaTipo === "EPSDC" && s.boleta);
    descargar(`resumen-venta-transportada-epsdc-${PERIODO.anio}-08.csv`, csv([
      ["RESUMEN DE LA VENTA TRANSPORTADA POR EPSDC", PERIODO.label],
      ["Control para soporte del pago del 30% por servicio de transporte a GasLara"], [],
      ["AD", "Fecha", "EPSDC", "Operador", "Unidad", "Comuna", "Usuario", "Tipo despacho", "Kg GLP", "Venta transportada Bs", "30% servicio Bs"],
      ...l.map((s) => [s.ad, fecha(s.entrega), epsdcOf(s.epsdc).nombre, s.operador || "", s.unidad || "", comunaOf(s.comuna).nombre,
        usr(s.usuario).nombre, tpd(s.tipoDespacho).nombre, cpt(s.concepto).kg * s.cantidad, s.total.toFixed(2), (s.total * 0.30).toFixed(2)]),
      [], ["TOTALES", "", "", "", "", "", "", "",
        l.reduce((a,s)=>a+cpt(s.concepto).kg*s.cantidad,0), l.reduce((a,s)=>a+s.total,0).toFixed(2), l.reduce((a,s)=>a+s.total*0.30,0).toFixed(2)],
    ]));
    aviso("Resumen EPSDC descargado");
  }

  function expReclamos() {
    descargar(`reclamos-${PERIODO.anio}-08.csv`, csv([
      ["RECLAMOS DE USUARIOS", PERIODO.label], [],
      ["Reclamo", "Fecha", "Usuario", "Contrato", "Tipo", "Prioridad", "Asunto", "Detalle", "Estatus", "Atendió", "Respuesta", "Cerrado"],
      ...reclamos.map((r) => [r.id, fecha(r.fecha), usr(r.usuario).nombre, usr(r.usuario).contrato, r.tipo,
        r.prioridad, r.asunto, r.detalle, r.estado, r.atendio || "", r.respuesta || "", r.cerrado ? fecha(r.cerrado) : ""]),
    ]));
    aviso("Reclamos descargados");
  }

  const pendAD = solicitudes.filter((s) => s.estado === "PAGADA").length;
  const abiertas = solicitudes.filter((s) => s.estado === "EN_AD").length;
  const recAbiertos = reclamos.filter((r) => r.estado !== "RESUELTO").length;
  const epsdcCerradas = solicitudes.filter((s) => s.transportistaTipo === "EPSDC" && s.boleta).length;
  const ventasGenericas = facturas.filter((f) => f.origen === "SIN_CONTRATO").length;

  /* El menú va agrupado por oficio, no en una lista plana de once entradas donde el
     libro de ventas —que es el soporte contable oficial— quedaba escondido como pestaña
     de «Documentos».

     El orden sigue el día de trabajo: primero lo que se hace a diario (operación), luego
     lo que se administra, y al final lo contable, que se consulta al cerrar. Estar de
     último no lo esconde: cada pieza tiene su entrada y su rótulo de grupo. */
  const nav = [
    { grupo: null, items: [
      { id: "panel", label: "Panel", icon: LayoutDashboard },
    ]},
    { grupo: "Operación comercial", items: [
      { id: "solicitudes", label: "Solicitudes", icon: ClipboardList, badge: incidencias },
      { id: "inventario", label: "Inventario GLP", icon: Gauge },
      { id: "consignacion", label: "Consignación comunal", icon: Landmark, badge: consignaciones.reduce((a, c) => a + c.enCustodia, 0) },
      { id: "epsdc", label: "EPSDC · 30%", icon: Truck, badge: epsdcCerradas },
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
      { id: "saldos", label: "Saldos a favor", icon: Wallet, badge: Object.values(saldos).filter((v) => v > 0.009).length },
      { id: "cierre", label: "Cierre del período", icon: Lock },
    ]},
  ];
  const navPlano = nav.flatMap((g) => g.items);

  return (
    <div className={`gl ${doc ? "printing" : ""}`}>
      <Estilos />
      <CustodiaStyles />
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
                <button key={n.id} className={`navbtn ${vista === n.id ? "on" : ""}`} onClick={() => setVista(n.id)}>
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
            <CircleDot size={11} /> {periodoCerrado ? "Cerrado" : "Abierto"}
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
          {vista === "panel" && <Panel {...{ solV, facV, existencias, compromisos, disponibles, ingresos, setVista, reclamos, solicitudes, cdtF, rutasDistribucion }} />}
          {vista === "solicitudes" && <VistaSolicitudes {...{ solV, setDoc, boletas, facturas, parqueEnvases }}
            todas={solicitudes} onIncidencia={registrarIncidenciaPrevia} onRevertir={revertirResolucionPago}
            onCrearManual={crearSolicitudManual} onCulminarServicio={culminarServicio} />}
          {vista === "saldos" && <SaldosAFavor abonos={abonos} saldos={saldos} solicitudes={solV}
            onRegistrar={registrarAbono} />}
          {vista === "consignacion" && <ConsignacionComunal consignaciones={consignaciones} solicitudes={solV} />}
          {vista === "libro" && <LibroVentas facturas={facV} cdtF={cdtF} periodoCerrado={periodoCerrado} />}
          {vista === "sincontrato" && <VentasSinContrato facturas={facV} solicitudes={solV} onVender={crearVentaGenerica} />}
          {vista === "documentos" && <VistaDocumentos {...{ facV, bopV, solV, cdtF, periodoCerrado, setDoc, setModal,
            onExportLibro: expLibro }} />}
          {vista === "inventario" && <VistaInventario {...{ existencias, compromisos, disponibles, movs: movV, cdtF, onExport: expInventario }} />}
          {vista === "precios" && <ListaPrecios />}
          {vista === "epsdc" && <VistaEPSDC sols={solV} onExport={expEPSDC} />}
          {vista === "reclamos" && <VistaReclamos {...{ reclamos, setModal, tomarReclamo, onExport: expReclamos }} />}
          {vista === "padron" && <PadronUsuarios padron={padron} solicitudes={solicitudes} saldos={saldos}
            facturas={facturas} reclamos={reclamos} onActualizar={actualizarUsuario}
            onCrear={crearUsuario} onDefinirEstado={definirEstadoUsuario}
            onVerFicha={(u) => setModal({ tipo: "ficha", u })} />}
          {vista === "cierre" && <VistaCierre {...{ facV, solV, boletas: bopV, existencias, compromisos, disponibles,
            rutasDistribucion, periodoCerrado, setPeriodoCerrado, onExport: expCierre, setDoc, cdtF }} />}
        </div>
      </main>

      {modal === "manual" && <ModalManual onClose={() => setModal(null)} onSave={(d) => { crearManual(d); setModal(null); aviso("Factura manual integrada al consolidado"); }} />}
      {modal?.tipo === "reclamo" && <ModalReclamo r={modal.r} onClose={() => setModal(null)}
        onSave={(txt, cerrar) => { responderReclamo(modal.r, txt, cerrar); setModal(null); aviso(`Respuesta enviada · ${modal.r.id}`); }} />}
      {modal?.tipo === "ficha" && <FichaUsuario u={modal.u} {...{ solicitudes, facturas, reclamos }} onClose={() => setModal(null)} setDoc={setDoc} />}
      {cascada && <Cascada data={cascada} facturas={facturas} onClose={() => setCascada(null)}
        onVer={(f) => { setCascada(null); setDoc({ tipo: "factura", data: f }); }} />}
      {doc && <VisorDocumento doc={doc} onClose={() => setDoc(null)} contexto={{ facturas: facV, solicitudes: solV, alcance: cdtF === "TODOS" ? "Consolidado 4 CDT" : cdtOf(cdtF).nombre, existencias, compromisos, disponibles, cdtF, periodoCerrado }} />}
      {toast && <div className="toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}

/* ═══════════  PANEL  ═══════════ */

function Panel({ solV, facV, existencias, compromisos, disponibles, ingresos, setVista, reclamos, solicitudes, cdtF, rutasDistribucion = [] }) {
  const [rango, setRango] = useState("MES");

  const rangoInfo = useMemo(() => {
    const fin = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate(), 23, 59, 59, 999);
    let inicio;
    if (rango === "DIA") inicio = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate());
    else if (rango === "SEMANA") {
      inicio = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate() - 6);
      inicio.setHours(0,0,0,0);
    } else inicio = new Date(PERIODO.anio, PERIODO.mes, 1);
    const etiqueta = rango === "DIA" ? fecha(HOY) : rango === "SEMANA" ? `${fecha(inicio)} – ${fecha(fin)}` : PERIODO.label;
    return { inicio, fin, etiqueta };
  }, [rango]);

  const enRango = (d) => !!d && d >= rangoInfo.inicio && d <= rangoInfo.fin;
  const facPeriodo = facV.filter((f) => enRango(f.fecha));
  const solPeriodo = solV.filter((s) => enRango(s.fecha));
  const pagosPeriodo = solV.filter((s) => s.pago?.estado === "VERIFICADO" && enRango(s.pago?.fecha || s.fecha));
  const pendientesPeriodo = pagosPeriodo.filter((s) => s.estado !== "CULMINADO");
  const porRecaudarPeriodo = solV.filter((s) => tpd(s.tipoDespacho).requierePago && s.pago?.estado !== "VERIFICADO" && enRango(s.fecha));
  const culminadasPeriodo = solV.filter((s) => s.estado === "CULMINADO" && enRango(s.entrega || s.fecha));

  const recaudado = pagosPeriodo.reduce((a, s) => a + Number(s.total || 0), 0);
  const facturado = facPeriodo.reduce((a, f) => a + Number(f.total || 0), 0);
  const recaudadoPendiente = pendientesPeriodo.reduce((a, s) => a + Number(s.total || 0), 0);
  const porRecaudar = porRecaudarPeriodo.reduce((a, s) => a + Number(s.total || 0), 0);
  const ivaPeriodo = facPeriodo.reduce((a, f) => a + Number(f.iva || 0), 0);
  const basePeriodo = facPeriodo.reduce((a, f) => a + Number(f.base || 0), 0);

  const tramoMs = Math.max(1, rangoInfo.fin.getTime() - rangoInfo.inicio.getTime());
  const prevFin = new Date(rangoInfo.inicio.getTime() - 1);
  const prevInicio = new Date(prevFin.getTime() - tramoMs);
  const enPrevio = (d) => !!d && d >= prevInicio && d <= prevFin;
  const recaudadoPrev = solV.filter((s)=>s.pago?.estado === "VERIFICADO" && enPrevio(s.pago?.fecha || s.fecha)).reduce((a,s)=>a+Number(s.total||0),0);
  const facturadoPrev = facV.filter((f)=>enPrevio(f.fecha)).reduce((a,f)=>a+Number(f.total||0),0);
  const pendientePrev = solV.filter((s)=>s.pago?.estado === "VERIFICADO" && s.estado !== "CULMINADO" && enPrevio(s.pago?.fecha || s.fecha)).reduce((a,s)=>a+Number(s.total||0),0);
  const deltaPct=(actual,previo)=>previo?((actual-previo)/previo*100):(actual?100:0);

  const adPendientes = solPeriodo.filter((s) => s.estado === "PAGADA" || s.estado === "EN_AD").length;
  const adRealizadas = culminadasPeriodo.length;
  const adEnRuta = solPeriodo.filter((s) => s.estado === "EN_AD").length;
  const adSinAsignar = solPeriodo.filter((s) => s.estado === "PAGADA").length;
  const totalADEstados = Math.max(1, adPendientes + adRealizadas);

  const kgDespachadoPeriodo = culminadasPeriodo.reduce((a, s) => a + kgDeSolicitud(s), 0);
  const kgComprometidoPeriodo = pendientesPeriodo.reduce((a, s) => a + kgDeSolicitud(s), 0);

  const cdtIds = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF).map((c) => c.id);
  const totalKg = cdtIds.reduce((s, id) => s + Number(existencias[id] || 0), 0);
  const totalComp = cdtIds.reduce((s, id) => s + Number(compromisos[id] || 0), 0);
  const totalDisp = cdtIds.reduce((s, id) => s + Number(disponibles[id] || 0), 0);
  const recAbiertos = reclamos.filter((r) => r.estado !== "RESUELTO");

  const buckets = useMemo(() => {
    const out = [];
    const cursor = new Date(rangoInfo.inicio);
    cursor.setHours(0,0,0,0);
    while (cursor <= rangoInfo.fin) {
      const ini = new Date(cursor);
      const fin = new Date(cursor); fin.setHours(23,59,59,999);
      const key = `${ini.getFullYear()}-${ini.getMonth()}-${ini.getDate()}`;
      const label = rango === "MES" ? String(ini.getDate()) : `${String(ini.getDate()).padStart(2,"0")}/${String(ini.getMonth()+1).padStart(2,"0")}`;
      out.push({ key, label, ini, fin });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [rango, rangoInfo.inicio.getTime(), rangoInfo.fin.getTime()]);

  const moneySerie = buckets.map((b) => {
    const fact = facV.filter((f) => f.fecha >= b.ini && f.fecha <= b.fin).reduce((a, f) => a + Number(f.total || 0), 0);
    const pagos = solV.filter((s) => s.pago?.estado === "VERIFICADO" && (s.pago?.fecha || s.fecha) >= b.ini && (s.pago?.fecha || s.fecha) <= b.fin);
    const reca = pagos.reduce((a, s) => a + Number(s.total || 0), 0);
    const pend = pagos.filter((s) => s.estado !== "CULMINADO").reduce((a, s) => a + Number(s.total || 0), 0);
    const cobrar = solV.filter((s) => tpd(s.tipoDespacho).requierePago && s.pago?.estado !== "VERIFICADO" && s.fecha >= b.ini && s.fecha <= b.fin).reduce((a, s) => a + Number(s.total || 0), 0);
    return { ...b, facturado: fact, recaudado: reca, pendiente: pend, porRecaudar: cobrar };
  });

  const glpSerie = buckets.map((b) => ({
    ...b,
    despachado: solV.filter((s) => s.estado === "CULMINADO" && (s.entrega || s.fecha) >= b.ini && (s.entrega || s.fecha) <= b.fin).reduce((a, s) => a + kgDeSolicitud(s), 0),
    comprometido: solV.filter((s) => s.pago?.estado === "VERIFICADO" && s.estado !== "CULMINADO" && (s.pago?.fecha || s.fecha) >= b.ini && (s.pago?.fecha || s.fecha) <= b.fin).reduce((a, s) => a + kgDeSolicitud(s), 0),
  }));

  const porSegmento = ["RESIDENCIAL", "COMERCIAL", "INSTITUCIONAL"].map((seg) => {
    const fs = facPeriodo.filter((f) => segmentoUsuario(f.usuario) === seg);
    return { label: seg, total: fs.reduce((a,f)=>a+Number(f.total||0),0), iva: fs.reduce((a,f)=>a+Number(f.iva||0),0), docs: fs.length };
  });

  const porConcepto = CONCEPTOS.map((c) => ({
    ...c,
    total: facPeriodo.filter((f) => f.concepto === c.id).reduce((s, f) => s + Number(f.total || 0), 0),
    docs: facPeriodo.filter((f) => f.concepto === c.id).length,
  })).filter((c) => c.total > 0).sort((a,b)=>b.total-a.total).slice(0,7);

  const porCDT = CDTS.filter((c)=>cdtF === "TODOS" || c.id === cdtF).map((c) => {
    const fact = facPeriodo.filter((f)=>f.cdt===c.id).reduce((a,f)=>a+Number(f.total||0),0);
    const pend = pendientesPeriodo.filter((s)=>s.cdt===c.id).reduce((a,s)=>a+Number(s.total||0),0);
    return { ...c, fact, pend };
  });

  const conciliadoHoy = solicitudes.filter((s) => s.pago?.auto && s.pago.fecha && s.pago.fecha.getDate() === HOY.getDate() && s.pago.fecha.getMonth() === HOY.getMonth());

  return (
    <div className="cm-dash">
      <div className="cm-dash-head">
        <div>
          <div className="cm-dash-eyebrow">Gestión comercial · {rangoInfo.etiqueta}</div>
          <h2>Panel ejecutivo de Comercialización</h2>
          <p>Recaudación, facturación, inventario, GLP y ejecución logística desde una sola fuente de datos.</p>
        </div>
        <div className="cm-range">
          {["DIA","SEMANA","MES"].map((x)=><button key={x} className={rango===x?"on":""} onClick={()=>setRango(x)}>{x==="DIA"?"Día":x==="SEMANA"?"Semana":"Mes"}</button>)}
        </div>
      </div>

      <div className="cm-top-kpis">
        <DashMetric label="Recaudado" value={`Bs ${bs(recaudado)}`} note={`${pagosPeriodo.length} operaciones bancarias verificadas`} tone="money" />
        <DashMetric label="Facturado / entregado" value={`Bs ${bs(facturado)}`} note={`Base Bs ${bs(basePeriodo)} · IVA Bs ${bs(ivaPeriodo)}`} />
        <DashMetric label="Recaudado sin despachar" value={`Bs ${bs(recaudadoPendiente)}`} note={`${pendientesPeriodo.length} solicitudes ya cobradas`} tone="warn" click={()=>setVista("pendientes")} />
        <DashMetric label="Por recaudar" value={`Bs ${bs(porRecaudar)}`} note={`${porRecaudarPeriodo.length} solicitudes pendientes de cobro`} tone="soft" />
      </div>
      <div className="cm-period-strip"><span>Comparación con período inmediatamente anterior</span><div><b>{deltaPct(recaudado,recaudadoPrev)>=0?"↑":"↓"} {Math.abs(deltaPct(recaudado,recaudadoPrev)).toFixed(1)}%</b><small>Recaudación</small></div><div><b>{deltaPct(facturado,facturadoPrev)>=0?"↑":"↓"} {Math.abs(deltaPct(facturado,facturadoPrev)).toFixed(1)}%</b><small>Facturación</small></div><div><b>{deltaPct(recaudadoPendiente,pendientePrev)>=0?"↑":"↓"} {Math.abs(deltaPct(recaudadoPendiente,pendientePrev)).toFixed(1)}%</b><small>Pendiente de despacho</small></div></div>

      <section className="cm-chart cm-money-chart">
        <ChartHead title="Gestión monetaria" subtitle="Principal · recaudación, facturación y dinero por cobrar" right={<Legend items={[["Recaudado","#1C7A50"],["Facturado","#2D65B0"],["Recaudado sin despachar","#D08A24"],["Por recaudar","#7C8792"]]} />} />
        <GroupedBars data={moneySerie} series={[
          {key:"recaudado", label:"Recaudado", cls:"green"},
          {key:"facturado", label:"Facturado", cls:"blue"},
          {key:"pendiente", label:"Sin despachar", cls:"amber"},
          {key:"porRecaudar", label:"Por recaudar", cls:"slate"},
        ]} money />
        <div className="cm-money-foot">
          <div><span>Eficiencia facturación / recaudación</span><b>{recaudado ? `${((facturado/recaudado)*100).toFixed(1)}%` : "0,0%"}</b></div>
          <div><span>Recaudación todavía comprometida</span><b>{recaudado ? `${((recaudadoPendiente/recaudado)*100).toFixed(1)}%` : "0,0%"}</b></div>
          <div><span>IVA facturado</span><b>Bs {bs(ivaPeriodo)}</b></div>
        </div>
      </section>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Inventario GLP por CDT" subtitle="Físico, comprometido y disponible real" right={<button className="cm-chart-link" onClick={()=>setVista("inventario")}>Ver inventario <ChevronRight size={13}/></button>} />
          <InventoryBars cdts={CDTS.filter((c)=>cdtF === "TODOS" || c.id === cdtF)} existencias={existencias} compromisos={compromisos} disponibles={disponibles} />
          <div className="cm-inventory-total"><span>Inventario físico</span><b><KgL kg={totalKg} /></b><span>Comprometido</span><b><KgL kg={totalComp} /></b><span>Disponible</span><b><KgL kg={totalDisp} /></b></div>
        </section>

        <section className="cm-chart">
          <ChartHead title="Estado de AD / solicitudes" subtitle="Pendientes contra realizadas en el período" right={<button className="cm-chart-link" onClick={()=>setVista("ad")}>Seguimiento <ChevronRight size={13}/></button>} />
          <div className="cm-donut-wrap">
            <DonutChart values={[adRealizadas, adEnRuta, adSinAsignar]} colors={["#1C7A50","#2D65B0","#D08A24"]} center={adRealizadas+adPendientes} centerLabel="operaciones" />
            <div className="cm-donut-legend">
              <DonutRow label="Realizadas" value={adRealizadas} total={totalADEstados} color="#1C7A50" />
              <DonutRow label="En AD / distribución" value={adEnRuta} total={totalADEstados} color="#2D65B0" />
              <DonutRow label="Pagadas sin AD" value={adSinAsignar} total={totalADEstados} color="#D08A24" />
            </div>
          </div>
        </section>
      </div>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Movimiento de GLP" subtitle="Kg despachados físicamente vs kg comprometidos por pagos" right={<NotaFactor />} />
          <GroupedBars data={glpSerie} series={[{key:"despachado",label:"Despachado",cls:"green"},{key:"comprometido",label:"Comprometido",cls:"amber"}]} />
          <div className="cm-money-foot two"><div><span>Despachado</span><b><KgL kg={kgDespachadoPeriodo} /></b></div><div><span>Comprometido</span><b><KgL kg={kgComprometidoPeriodo} /></b></div></div>
        </section>

        <section className="cm-chart">
          <ChartHead title="Facturación por segmento" subtitle="Residencial, comercial e institucional" />
          <SegmentBars rows={porSegmento} />
        </section>
      </div>

      <div className="cm-chart-grid two">
        <section className="cm-chart">
          <ChartHead title="Ingresos por concepto" subtitle="Top de conceptos facturados en el período" />
          <RankBars rows={porConcepto.map(c=>({label:c.nombre,value:c.total,note:`${c.docs} docs.`}))} />
        </section>
        <section className="cm-chart">
          <ChartHead title="Desempeño por CDT" subtitle="Facturado vs recaudación pendiente de despacho" />
          <CompareBars rows={porCDT.map(c=>({label:c.corto,a:c.fact,b:c.pend}))} />
        </section>
      </div>

      <div className="conc-bar cm-conc">
        <div className="conc-ico"><Zap size={18} /></div>
        <div><b>Conciliación bancaria automática</b><span>{conciliadoHoy.length} pagos validados hoy contra {BANCOS.length} bancos. Cada referencia bancaria queda trazable en la ficha 360° del usuario.</span></div>
        <div className="conc-monto">Bs {bs(conciliadoHoy.reduce((s,x)=>s+Number(x.total||0),0))}</div>
      </div>

      <div className="cm-mini-actions">
        <button onClick={()=>setVista("pendientes")}><Clock3 size={15}/><span>Recaudación por despachar</span><b>Bs {bs(recaudadoPendiente)}</b></button>
        <button onClick={()=>setVista("inventario")}><Gauge size={15}/><span>Disponible real</span><b><KgL kg={totalDisp} /></b></button>
        <button onClick={()=>setVista("ad")}><ClipboardList size={15}/><span>AD pendientes</span><b>{adPendientes}</b></button>
        <button onClick={()=>setVista("reclamos")}><MessageSquareWarning size={15}/><span>Reclamos abiertos</span><b>{recAbiertos.length}</b></button>
      </div>
    </div>
  );
}

function DashMetric({label,value,note,tone="default",click}) { return <button className={`cm-dash-metric ${tone} ${click?"click":""}`} onClick={click}><span>{label}</span><b>{value}</b><small>{note}</small></button>; }
function ChartHead({title,subtitle,right}) { return <div className="cm-chart-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{right}</div>; }
function Legend({items}) { return <div className="cm-legend">{items.map(([l,c])=><span key={l}><i style={{background:c}}/>{l}</span>)}</div>; }
function GroupedBars({data,series,money=false}) {
  const max=Math.max(1,...data.flatMap(d=>series.map(s=>Number(d[s.key]||0))));
  return <div className={`cm-group-bars ${data.length>10?"dense":""}`}>{data.map((d)=><div className="cm-gcol" key={d.key}><div className="cm-gbars">{series.map(s=><div key={s.key} className={`cm-gbar ${s.cls}`} style={{height:`${Math.max(Number(d[s.key]||0)>0?4:0,(Number(d[s.key]||0)/max)*100)}%`}} title={`${s.label}: ${money?`Bs ${bs(Number(d[s.key]||0))}`:num(Number(d[s.key]||0))}`}/>)}</div><span>{d.label}</span></div>)}</div>;
}
function InventoryBars({cdts,existencias,compromisos,disponibles}) { return <div className="cm-inv-list">{cdts.map(c=>{const fis=Number(existencias[c.id]||0),comp=Number(compromisos[c.id]||0),disp=Math.max(0,Number(disponibles[c.id]||0)),cap=Math.max(c.capacidad||1,fis);return <div className="cm-inv-row" key={c.id}><div className="cm-inv-name"><b>{c.corto}</b><span><KgL kg={fis} /> físicos</span></div><div className="cm-inv-track"><div className="cm-inv-disp" style={{width:`${Math.min(100,(disp/cap)*100)}%`}}/><div className="cm-inv-comp" style={{width:`${Math.min(100,(comp/cap)*100)}%`}}/></div><div className="cm-inv-val"><b><KgL kg={disp} /></b><span>disponibles</span></div></div>})}</div>; }
function DonutChart({values,colors,center,centerLabel}) { const sum=Math.max(1,values.reduce((a,b)=>a+b,0));let acc=0;const stops=values.map((v,i)=>{const a=acc/sum*360;acc+=v;const b=acc/sum*360;return `${colors[i]} ${a}deg ${b}deg`}).join(",");return <div className="cm-donut" style={{background:`conic-gradient(${stops})`}}><div><b>{num(center)}</b><span>{centerLabel}</span></div></div>; }
function DonutRow({label,value,total,color}) {return <div className="cm-donut-row"><i style={{background:color}}/><div><span>{label}</span><b>{value}</b></div><em>{total?`${((value/total)*100).toFixed(1)}%`:"0%"}</em></div>;}
function SegmentBars({rows}) {const max=Math.max(1,...rows.map(r=>r.total));return <div className="cm-seg-list">{rows.map(r=><div className="cm-seg" key={r.label}><div className="cm-seg-head"><span>{r.label}</span><b>Bs {bs(r.total)}</b></div><div className="cm-seg-track"><div style={{width:`${(r.total/max)*100}%`}}/></div><small>{r.docs} documentos · IVA Bs {bs(r.iva)}</small></div>)}</div>;}
function RankBars({rows}) {const max=Math.max(1,...rows.map(r=>r.value));return <div className="cm-rank">{rows.length?rows.map((r,i)=><div className="cm-rank-row" key={`${r.label}-${i}`}><span className="cm-rank-n">{i+1}</span><div className="cm-rank-main"><div><span>{r.label}</span><small>{r.note}</small></div><div className="cm-rank-track"><div style={{width:`${(r.value/max)*100}%`}}/></div></div><b>Bs {bs(r.value)}</b></div>):<div className="empty">Sin facturación para el filtro seleccionado.</div>}</div>;}
function CompareBars({rows}) {const max=Math.max(1,...rows.flatMap(r=>[r.a,r.b]));return <div className="cm-compare">{rows.map(r=><div className="cm-compare-row" key={r.label}><span>{r.label}</span><div><div className="cm-compare-bar"><i className="a" style={{width:`${(r.a/max)*100}%`}}/><em>Facturado Bs {bs(r.a)}</em></div><div className="cm-compare-bar"><i className="b" style={{width:`${(r.b/max)*100}%`}}/><em>Pendiente Bs {bs(r.b)}</em></div></div></div>)}</div>;}

const Kpi = ({ label, valor, pie, tono, click }) => (
  <div className={`kpi ${tono} ${click ? "clickable" : ""}`} onClick={click}>
    <div className="kpi-l">{label}</div><div className="kpi-v">{valor}</div><div className="kpi-p">{pie}</div>
  </div>
);
const EstRow = ({ label, n, cls, desc }) => (
  <div className="est-row"><span className={`chip ${cls}`}>{label}</span><div className="est-desc">{desc}</div><div className="est-n">{n}</div></div>
);
const EstadoChip = ({ estado }) => {
  const cls = { SIN_PAGO: "st-pag", POR_CONCILIAR: "pri-media", PAGADA: "st-pag",
    EN_AD: "st-ad", CULMINADO: "st-cul", ABONADA: "st-con" }[estado];
  return <span className={`chip ${cls}`}>{estado === "ABONADA" ? "Abonada" : fase(estado).admin}</span>;
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

function VistaSolicitudes({ solV, setDoc, boletas, facturas, onIncidencia, onRevertir, onCrearManual, onCulminarServicio, parqueEnvases, todas }) {
  const [q, setQ] = useState(""); const [f, setF] = useState("TODAS");
  const [pagina, setPagina] = useState(1);
  const [abonar, setAbonar] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [verPatrones, setVerPatrones] = useState(false);
  const [revertir, setRevertir] = useState(null);
  const [culminar, setCulminar] = useState(null);
  const porPagina = 50;

  const conc = useMemo(() => bitacoraPagos(solV), [solV]);
  const patrones = useMemo(() => patronesSospechosos(solV), [solV]);
  // Agrupados por tipo: si se listaran de corrido, los de severidad alta coparían la
  // pantalla y los otros dos tipos no se verían nunca.
  const grupoPatrones = useMemo(() => patrones.reduce((acc, p) => {
    (acc[p.tipo] ||= []).push(p); return acc;
  }, {}), [patrones]);

  const grupos = useMemo(() => ({
    TODAS: solV,
    SIN_PAGO: solV.filter((s) => s.pago?.estado === "SIN_PAGO"),
    REGLA: solV.filter((s) => s.pago?.regla && s.pago.regla !== "EXACTO"),
    PAGADA: solV.filter((s) => s.estado === "PAGADA"),
    EN_AD: solV.filter((s) => s.estado === "EN_AD"),
    CULMINADO: solV.filter((s) => s.estado === "CULMINADO"),
    ABONADA: solV.filter(esAbonada),
    ESPECIAL: solV.filter((s) => s.tipoDespacho !== "COMERCIAL"),
  }), [solV]);

  const SEGMENTOS = [
    ["TODAS", "Todas"], ["SIN_PAGO", "Sin pago"], ["REGLA", "Resueltas por regla"],
    ["PAGADA", "Pagadas · sin despachar"], ["EN_AD", "En AD"], ["CULMINADO", "Entregadas"],
    ["ABONADA", "Abonadas"], ["ESPECIAL", "Despachos especiales"],
  ];

  const lista = useMemo(() => (grupos[f] || solV).filter((s) => {
    if (!q) return true;
    const u = usr(s.usuario);
    return u.nombre.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q)
      || (s.ad || "").toLowerCase().includes(q.toLowerCase()) || u.doc.includes(q)
      || (u.contrato || "").includes(q) || (s.pago?.referencia || "").includes(q);
  }), [grupos, f, q, solV]);

  useEffect(() => setPagina(1), [q, f]);
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const visibles = lista.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <>
      <div className="kpis">
        <Kpi label="Solicitudes en el sistema" valor={num(solV.length)} pie="todas viven en esta pantalla" tono="azul" />
        <Kpi label="Pagadas sin despachar" valor={num(grupos.PAGADA.length)} pie="con GLP reservado" tono="ambar" />
        <Kpi label="En AD" valor={num(grupos.EN_AD.length)} pie="asignadas a una jornada" tono="gris" />
        <Kpi label="Entregadas" valor={num(grupos.CULMINADO.length)} pie="facturadas al despachar" tono="verde" />
        <Kpi label="Abonadas" valor={num(grupos.ABONADA.length)} pie="no compraron · dinero a su código" tono="gris" />
      </div>

      <div className="conc-bar">
        <div className="conc-ico"><Zap size={18} /></div>
        <div>
          <b>El pago lo resuelve la regla, no una persona</b>
          <span>La API confirma contra el banco y aplica la regla que corresponde: {num(conc.exactos)} pagos
            cuadraron exactos y {num(conc.resueltas.length)} se resolvieron por regla — monto distinto o
            referencia repetida — sin que nadie aprobara nada. Aquí se consultan y, si un usuario reclama,
            se revierte el caso concreto.
            {conc.revertidas > 0 ? ` ${num(conc.revertidas)} revertidas por reclamo.` : ""}</span>
        </div>
        <div className="conc-monto">{conc.tasaAuto.toFixed(1)}% automático</div>
      </div>

      {patrones.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2><ShieldAlert size={16} /> Requieren mirada humana <span className="cnt">{num(patrones.length)}</span></h2>
              <span className="card-note">Una regla decide sobre un pago aislado. Esto es repetición entre varios pagos — la regla no la ve, y es lo único de esta pantalla que alguien tiene que atender.</span>
            </div>
            <button className="btn sm" onClick={() => { setF("REGLA"); setVerPatrones((v) => !v); }}>
              {verPatrones ? "Ocultar" : "Ver los casos"}
            </button>
          </div>
          {verPatrones && Object.entries(grupoPatrones).map(([tipo, lista]) => (
            <div className="pat-grupo" key={tipo}>
              <div className="pat-grupo-h">
                <b>{TIPO_PATRON[tipo]?.titulo || tipo}</b>
                <span className="cnt">{num(lista.length)}</span>
                <em>{TIPO_PATRON[tipo]?.desc}</em>
              </div>
              <div className="pat-lista">
                {lista.slice(0, 3).map((p) => (
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
                {lista.length > 3 && (
                  <div className="pat-mas muted">
                    y {num(lista.length - 3)} caso(s) más de este tipo. Búscalos por referencia
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
            <span className="card-note">Todo pedido del sistema vive aquí. Las crea el portal y la API resuelve el pago; esta pantalla las consulta.</span></div>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar solicitud, AD, usuario, contrato o referencia" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm primary" onClick={() => setNueva(true)}><Plus size={14} /> Registrar en taquilla</button>
          </div>
        </div>
        <div className="tabs seg">
          {SEGMENTOS.map(([k, l]) => (
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
              const fac = facturas.find((x) => x.sol === s.id);
              return (
                <tr key={s.id} className={u.portal ? "portal" : ""}>
                  <td className="mono strong">{s.id}{u.portal && <span className="pin" title="Usuario con portal activo">●</span>}</td>
                  <td className="mono">{s.ad || <span className="muted">—</span>}</td>
                  <td className="muted">{fechaCorta(s.fecha)}</td>
                  <td><div className="u-name">{u.nombre}</div><div className="u-doc">Contrato {u.contrato} · {comunaOf(u.comuna).nombre} · {cdtOf(s.cdt).corto}</div></td>
                  <td className="c-name">{c.nombre}</td>
                  <td className="r mono">{num(s.cantidad)}</td>
                  <td>{s.tipoDespacho === "COMERCIAL" ? <span className="tag">Comercial</span> : <span className="tag alt">{td.nombre}</span>}</td>
                  <td>{s.pago.banco
                    ? <span className="pago-ok" title={`${banco(s.pago.banco).nombre} · ref ${s.pago.referencia}`}><Zap size={11} /> {s.pago.referencia}</span>
                    : <span className="muted">—</span>}</td>
                  <td className="r mono">{td.factura ? bs(s.total) : <span className="muted">—</span>}</td>
                  <td className="mono docs">
                    {s.boleta ? <button className="link" onClick={() => setDoc({ tipo: "boleta", data: boletas.find((b) => b.id === s.boleta) })}>{s.boleta}</button> : <span className="muted">—</span>}
                    {fac && <button className="link" onClick={() => setDoc({ tipo: "factura", data: fac })}>{s.serie}</button>}
                  </td>
                  <td><EstadoChip estado={s.estado} /></td>
                  <td className="r">
                    {s.pago?.regla && s.pago.regla !== "EXACTO" && (
                      <div className="inc-acciones">
                        <span className={`tag ${reglaPago(s.pago.regla).severidad === "alta" ? "warn" : "alt"}`}
                          title={s.pago.detalleRegla}>{reglaPago(s.pago.regla).nombre}</span>
                        {/* Sólo se revierte lo que le negó el gas al usuario. Un excedente
                            abonado no tiene nada que revertir: ya se le entregó. */}
                        {s.pago.estado === "RECHAZADO" && !s.pago.revertida &&
                          <button className="btn sm" onClick={() => setRevertir(s)}><Undo2 size={13} /> Revertir</button>}
                        {s.pago.revertida && <span className="tag" title={s.pago.notaReversion}>Revertida</span>}
                      </div>
                    )}
                    {s.pago?.estado === "SIN_PAGO" && <span className="tag alt">Esperando pago</span>}
                    {/* Un servicio no sale en gandola: se culmina cuando el técnico lo
                        prestó, y ahí nace su boleta y su factura como en cualquier despacho. */}
                    {s.estado === "PAGADA" && s.pago?.estado === "VERIFICADO" && !c.inv &&
                      <button className="btn sm primary" onClick={() => setCulminar(s)}><Wrench size={13} /> Servicio prestado</button>}
                    {s.estado === "PAGADA" && s.pago?.estado === "VERIFICADO" && !s.incidencia &&
                      <button className="btn sm" onClick={() => setAbonar(s)}><MessageSquareWarning size={13} /> Incidencia</button>}
                    {s.estado === "PAGADA" && s.incidencia && (
                      <div className="inc-acciones">
                        <span className="tag warn" title={`${s.incidencia.nombre}${s.incidencia.nota ? ` · ${s.incidencia.nota}` : ""} — registrada por ${s.incidencia.por}`}>
                          Retenida: {s.incidencia.nombre}
                        </span>
                        <button className="btn sm" onClick={() => setAbonar(s)}>Cambiar</button>
                      </div>
                    )}
                    {s.estado === "EN_AD" && <span className="tag">En distribución</span>}
                    {s.estado === "CULMINADO" && <span className="tag">Facturada al despachar</span>}
                    {esAbonada(s) && <span className="tag alt">{s.motivoNoCompra || "Abonada"}</span>}
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
          setAviso(r?.ok ? { ok: true, incidencia: true, solicitud: abonar, ...r }
            : { ok: false, incidencia: true, error: r?.error || "No se pudo registrar la incidencia." });
        }} />}
      {culminar && <ModalServicio s={culminar} onClose={() => setCulminar(null)}
        onSave={(d) => {
          const r = onCulminarServicio?.(culminar, d);
          setCulminar(null);
          setAviso(r?.ok ? { ok: true, servicio: true, solicitud: culminar, ...r }
            : { ok: false, servicio: true, error: r?.error || "No se pudo culminar el servicio." });
        }} />}
      {revertir && <ModalRevertir s={revertir} onClose={() => setRevertir(null)}
        onSave={(nota, quien) => {
          const r = onRevertir?.(revertir, nota, quien);
          setRevertir(null);
          setAviso(r?.ok
            ? { ok: true, reversion: true, solicitud: revertir, anulado: r.anulado }
            : { ok: false, error: r?.error || "No se pudo revertir." });
        }} />}
      {nueva && <ModalSolicitudManual parqueEnvases={parqueEnvases} todas={todas}
        onClose={() => setNueva(false)}
        onSave={(d) => { const r = onCrearManual?.(d); if (r?.ok) { setNueva(false); setAviso(r); } else setAviso(r); }} />}
      {aviso && (
        <div className="overlay" onClick={() => setAviso(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-h"><div>
              <div className="mh-eyebrow">{aviso.reversion ? "Reversión" : aviso.incidencia ? "Incidencia"
                : aviso.servicio ? "Servicio prestado" : "Registro en taquilla"}</div>
              <h3>{!aviso.ok
                ? (aviso.reversion ? "No se pudo revertir"
                  : aviso.incidencia ? "No se pudo registrar la incidencia"
                  : aviso.servicio ? "No se pudo culminar el servicio"
                  : "No se pudo registrar")
                : aviso.reversion ? "Resolución revertida"
                : aviso.incidencia ? (aviso.cierra ? "Pedido cerrado y abonado" : "Pedido retenido")
                : aviso.servicio ? "Servicio culminado y facturado"
                : "Solicitud registrada"}</h3></div></div>
            <div className="modal-b">
              {!aviso.ok ? <div className="cg2-err">{aviso.error}</div>
                : aviso.servicio ? (
                <>
                  <div className="rec-meta">
                    <div><span>Solicitud</span><b>{aviso.solicitud.id}</b></div>
                    <div><span>Boleta</span><b className="mono">{aviso.boleta}</b></div>
                    <div><span>Factura</span><b className="mono">{aviso.serie || "No aplica"}</b></div>
                    <div><span>Facturado</span><b>{aviso.factura ? `Bs ${bs(aviso.total)}` : "—"}</b></div>
                  </div>
                  <div className="inv-regla" style={{ marginTop: 12 }}><BookText size={17} /><div>
                    <b>El servicio quedó culminado y asentado</b>
                    <span>{aviso.factura
                      ? `La factura ${aviso.serie} ya está en el libro de ventas con fecha de hoy. El pedido sale de "pagados sin despachar".`
                      : "Se emitió la boleta como soporte. Por el tipo de despacho no corresponde factura."}</span>
                  </div></div>
                </>
              ) : aviso.incidencia ? (
                <>
                  <div className="rec-meta">
                    <div><span>Solicitud</span><b>{aviso.solicitud.id}</b></div>
                    <div><span>Incidencia</span><b>{aviso.motivo.nombre}</b></div>
                    <div><span>Queda</span><b>{aviso.cierra ? "Abonada · cerrada" : "Pagada · retenida"}</b></div>
                    <div><span>Abonado</span><b>{aviso.cierra ? `Bs ${bs(aviso.monto)}` : "—"}</b></div>
                  </div>
                  <div className="inv-regla" style={{ marginTop: 12 }}>
                    {aviso.cierra ? <Wallet size={17} /> : <Clock3 size={17} />}
                    <div>
                      <b>{aviso.cierra ? "El dinero queda a favor del usuario" : "El pedido sigue vivo"}</b>
                      <span>{aviso.cierra
                        ? `Bs ${bs(aviso.monto)} pasaron al saldo del código ${aviso.solicitud.usuario}. No es un reembolso: lo devengará contra la tarifa vigente el día que vuelva a comprar.`
                        : "Sigue figurando como pagado y pendiente por despachar, con la constancia de por qué está detenido. Cuando se resuelva, se despacha normalmente."}</span>
                    </div>
                  </div>
                </>
              ) : aviso.reversion ? (
                <>
                  <div className="rec-meta">
                    <div><span>Solicitud</span><b>{aviso.solicitud.id}</b></div>
                    <div><span>Queda</span><b>Pagada · GLP reservado</b></div>
                    <div><span>Abono anulado</span><b>{aviso.anulado ? `Bs ${bs(aviso.anulado)}` : "—"}</b></div>
                  </div>
                  <div className="inv-regla" style={{ marginTop: 12 }}><Undo2 size={17} /><div>
                    <b>El usuario recupera su despacho</b>
                    <span>{aviso.anulado
                      ? `Los Bs ${bs(aviso.anulado)} que estaban a su favor dejan de estar disponibles: ese dinero pasa a cubrir esta entrega. El movimiento queda en su estado de cuenta marcado como anulado.`
                      : "La solicitud vuelve a estado pagado. No había abono que anular."}</span>
                  </div></div>
                </>
              ) : (
                <>
                  <div className="rec-meta">
                    <div><span>Solicitud</span><b>{aviso.solicitud.id}</b></div>
                    <div><span>Regla aplicada</span><b>{reglaPago(aviso.regla).nombre}</b></div>
                    <div><span>Estado</span><b>{aviso.solicitud.estado === "PAGADA" ? "Pagada · GLP reservado" : "Abonada"}</b></div>
                    <div><span>Abono generado</span><b>{aviso.abono ? `Bs ${bs(aviso.abono)}` : "—"}</b></div>
                  </div>
                  <div className="inv-regla" style={{ marginTop: 12 }}><Zap size={17} /><div>
                    <b>{reglaPago(aviso.regla).efecto}</b><span>{aviso.detalle}</span>
                  </div></div>
                </>
              )}
            </div>
            <div className="modal-f"><button className="btn primary" onClick={() => setAviso(null)}>Entendido</button></div>
          </div>
        </div>
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

function ModalSolicitudManual({ parqueEnvases = [], todas = [], onClose, onSave }) {
  const MOTIVOS = [
    "El usuario no tiene acceso al portal",
    "Compra presencial en el CDT",
    "Pago recibido en taquilla",
    "Corrección de un registro anterior",
    "Otro motivo",
  ];
  const [d, setD] = useState({
    usuario: USUARIOS[1].id, concepto: "BOMB_18", cantidad: 1, canal: "TAQUILLA",
    banco: "Efectivo", referencia: "", montoRecibido: "", motivoRegistro: MOTIVOS[0],
    operador: "M. Álvarez", observacion: "",
  });
  const u = usr(d.usuario);
  const m = montos(d.concepto, Number(d.cantidad || 1), u.id, HOY);
  const recibido = d.montoRecibido === "" ? m.total : Number(d.montoRecibido);
  const cupo = puedeSolicitar(u, todas, d.concepto, Number(d.cantidad || 1));
  const canje = validarCanje(envasesDe(parqueEnvases, u.id), cpt(d.concepto).kg);
  const necesitaEnvase = cpt(d.concepto).bombona;
  const prevision = aplicarReglaPago({ montoRecibido: recibido, totalFacturado: m.total, referencia: d.referencia, referenciasVistas: new Set() });
  const motivoOk = d.motivoRegistro !== "Otro motivo" || d.observacion.trim().length > 5;
  const ok = cupo.ok && (!necesitaEnvase || canje.ok) && recibido > 0 && motivoOk;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal cg2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="mh-eyebrow">Registro manual</div><h3>Nueva solicitud en taquilla</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="cg2-hint">Esta vía es la excepción. El portal genera las solicitudes solo y la API
            resuelve el pago; aquí hay que anotar todo porque no hay un sistema del otro lado que lo haga.</div>

          <div className="row2">
            <label className="campo"><span>Usuario</span>
              <select value={d.usuario} onChange={(e) => setD({ ...d, usuario: e.target.value })}>
                {USUARIOS.map((x) => <option key={x.id} value={x.id}>{x.nombre} — contrato {x.contrato}</option>)}
              </select></label>
            <label className="campo"><span>Producto</span>
              <select value={d.concepto} onChange={(e) => setD({ ...d, concepto: e.target.value })}>
                {CONCEPTOS.filter((c) => !c.distribucionOnly).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></label>
          </div>

          {!cupo.ok && <div className="cg2-err">{cupo.motivo}</div>}
          {necesitaEnvase && !canje.ok && <div className="cg2-err">{canje.motivo}</div>}
          {necesitaEnvase && canje.ok && <div className="cg2-hint">Envase de {cpt(d.concepto).kg} kg disponible para el canje.</div>}

          <div className="cg2-sep">Cobro</div>
          <div className="row2">
            <label className="campo"><span>Canal</span>
              <select value={d.canal} onChange={(e) => setD({ ...d, canal: e.target.value })}>
                {CANALES_PAGO.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></label>
            <label className="campo"><span>Banco o forma de pago</span>
              <input value={d.banco} onChange={(e) => setD({ ...d, banco: e.target.value })} /></label>
          </div>
          <div className="row2">
            <label className="campo"><span>Monto recibido Bs</span>
              <input inputMode="decimal" value={d.montoRecibido} placeholder={m.total.toFixed(2)}
                onChange={(e) => setD({ ...d, montoRecibido: e.target.value.replace(/[^\d.]/g, "") })} /></label>
            <label className="campo"><span>Referencia</span>
              <input value={d.referencia} onChange={(e) => setD({ ...d, referencia: e.target.value })}
                placeholder="Opcional si es efectivo" /></label>
          </div>

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
            <div className="preview-h">Tarifa de hoy · {cpt(d.concepto).nombre}</div>
            <div className="preview-monto">Bs {bs(m.total)}</div>
            <div className="preview-det">
              Base {bs(m.base)} · IVA {m.exento ? "exonerado" : bs(m.iva)}
              {recibido !== m.total && ` · recibido Bs ${bs(recibido)}`}
            </div>
          </div>
          <div className="inv-regla" style={{ marginTop: 10 }}><Zap size={17} /><div>
            <b>La regla se aplicará sola: {reglaPago(prevision.regla).nombre}</b>
            <span>{reglaPago(prevision.regla).efecto}. {prevision.detalle}</span>
          </div></div>
        </div>
        <div className="modal-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave({ ...d, montoRecibido: recibido })}>
            <Check size={14} /> Registrar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════  CASCADA  ═══════════ */

const ICONOS = { ad: ClipboardList, bop: FileText, inv: Gauge, fac: Receipt };

function Cascada({ data, facturas, onClose, onVer }) {
  const listo = data.visibles >= data.pasos.length;
  const fac = data.serie ? facturas.find((f) => f.serie === data.serie) : null;
  const esPortal = usr(data.sol.usuario).portal;
  return (
    <div className="overlay" onClick={listo ? onClose : undefined}>
      <div className="casc" onClick={(e) => e.stopPropagation()}>
        <div className="casc-h">
          <div><div className="casc-eyebrow">Cadena automática</div><h3>El cierre del AD dispara todo lo demás</h3></div>
          {listo && <button className="icon-btn" onClick={onClose}><X size={17} /></button>}
        </div>
        <div className="casc-steps">
          {data.pasos.map((p, i) => {
            const Ico = ICONOS[p.ico]; const on = i < data.visibles;
            return (
              <div className={`casc-step ${on ? "on" : ""}`} key={i}>
                <div className="casc-rail"><div className="casc-dot"><Ico size={15} /></div>{i < data.pasos.length - 1 && <div className="casc-line" />}</div>
                <div className="casc-txt"><div className="casc-title">{p.t}</div><div className="casc-det">{p.d}</div></div>
                {on && <Check className="casc-check" size={16} strokeWidth={3} />}
              </div>
            );
          })}
        </div>
        {listo && esPortal && (
          <div className="casc-portal"><CheckCircle2 size={15} /> El usuario ya lo ve en su portal: su pedido quedó «Completado» al cerrar el AD.</div>
        )}
        <div className="casc-f">
          <p>La salida de inventario y la factura nacen del cierre del AD, no del pago del usuario.</p>
          {listo && (fac ? <button className="btn primary" onClick={() => onVer(fac)}>Ver factura</button>
                         : <button className="btn primary" onClick={onClose}>Entendido</button>)}
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
 * Revertir lo que la regla decidió.
 *
 * Es la única puerta que Comercialización tiene sobre un pago, y por eso pide motivo:
 * está deshaciendo algo que el sistema resolvió con un criterio escrito. Si la solicitud
 * había generado un abono, el modal lo dice antes de confirmar — ese dinero deja de
 * estar disponible porque pasa a pagar la entrega.
 */
function ModalRevertir({ s, onClose, onSave }) {
  const MOTIVOS = [
    "El usuario mostró el comprobante y el pago es válido",
    "El banco confirmó la transferencia después del corte",
    "La referencia se cargó mal en el portal",
    "Error del registro en taquilla",
    "Otro motivo",
  ];
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [detalle, setDetalle] = useState("");
  const [quien, setQuien] = useState("");
  const u = usr(s.usuario);
  const r = reglaPago(s.pago.regla);
  const texto = motivo === "Otro motivo" ? detalle.trim() : motivo;
  const ok = texto.length > 4 && quien.trim().length > 2;
  const abonoQueSeAnula = s.pago.regla === "MONTO_MENOR" ? Number(s.pago.montoRecibido || 0) : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Reversión</div>
          <h3>Revertir una resolución automática</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <div className="rec-meta">
            <div><span>Usuario</span><b>{u.nombre}</b></div>
            <div><span>Solicitud</span><b>{s.id}</b></div>
            <div><span>Regla aplicada</span><b>{r.nombre}</b></div>
            <div><span>Referencia</span><b className="mono">{s.pago.referencia || "—"}</b></div>
          </div>
          <div className="inv-regla" style={{ margin: "12px 0" }}><ShieldAlert size={17} /><div>
            <b>Qué decidió el sistema</b>
            <span>{s.pago.detalleRegla} — {r.desc}</span>
          </div></div>
          {abonoQueSeAnula > 0 && (
            <div className="cg2-correlativo bad" style={{ background: "var(--er-bg)", color: "var(--er)" }}>
              <AlertTriangle size={17} /><div>
              <b>Se anularán Bs {bs(abonoQueSeAnula)} de su saldo a favor</b>
              <span>Ese dinero pasa a cubrir esta entrega. Si no se anulara, el usuario se
                quedaría con la bombona y con el saldo. El movimiento seguirá visible en su
                estado de cuenta, marcado como anulado.</span>
            </div></div>
          )}
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
            <Undo2 size={14} /> Revertir y liberar el despacho
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * INCIDENCIA SOBRE UNA SOLICITUD PAGADA QUE NO HA SALIDO A RUTA.
 *
 * Sustituye al modal «No compró», que hablaba de una entrega que nunca se intentó y
 * siempre terminaba abonando. Aquí la consecuencia la fija el motivo y se muestra antes
 * de confirmar: hay incidencias que cierran el pedido y otras que lo dejan vivo.
 */
function ModalIncidencia({ s, onClose, onSave }) {
  const [motivo, setMotivo] = useState(INCIDENCIAS_PREVIAS[0].id);
  const [nota, setNota] = useState("");
  const [quien, setQuien] = useState("");
  const u = usr(s.usuario);
  const m = incidenciaPrevia(motivo);
  const cierra = m.consecuencia === "CIERRA";
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
            <div><span>Pagado</span><b>Bs {bs(s.total)}</b></div>
          </div>

          <p className="modal-nota">Este pedido está pagado y todavía no ha salido a ruta.
            Lo que ocurra en la calle lo marca el operador en su jornada; aquí sólo se
            registra lo que pasa antes de despachar.</p>

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
                ? `Se cierra el pedido y se abonan Bs ${bs(s.total)} al código ${s.usuario}`
                : "El pedido queda retenido, no se cierra"}</b>
              <span>
                {m.desc}{" "}
                {cierra
                  ? `Se libera${kgDeSolicitud(s) > 0 ? ` ${num(kgDeSolicitud(s))} kg de GLP y` : ""} el cupo del ciclo. El dinero no se devuelve en efectivo: queda a su favor y lo devengará contra la tarifa vigente el día que vuelva a comprar.`
                  : "Sigue contando como pagado y pendiente por despachar. Queda la constancia de por qué está detenido y quién lo registró."}
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
            {cierra ? <><Wallet size={14} /> Cerrar y abonar Bs {bs(s.total)}</> : <><Clock3 size={14} /> Retener el pedido</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════  BOLETAS  ═══════════ */

function VistaBoletas({ boletas, setDoc }) {
  return (
    <section className="card">
      <div className="card-h"><h2>Boletas de operación <span className="cnt">{boletas.length}</span></h2>
        <span className="card-note">Generadas al cerrar cada AD · documento no editable</span></div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Boleta</th><th>AD</th><th>Solicitud</th><th>Fecha</th><th>CDT</th><th>Usuario</th><th>Concepto</th><th>Tipo</th><th className="r">Salida GLP</th><th></th></tr></thead>
          <tbody>
            {boletas.map((b) => (
              <tr key={b.id}>
                <td className="mono strong">{b.id}</td>
                <td className="mono muted">{b.ad}</td>
                <td className="mono muted">{b.sol}</td>
                <td className="muted">{fechaCorta(b.fecha)}</td>
                <td>{cdtOf(b.cdt).corto}</td>
                <td className="u-name sm">{usr(b.usuario).nombre}</td>
                <td className="c-name">{cpt(b.concepto).nombre}</td>
                <td>{tpd(b.tipoDespacho).factura ? <span className="tag">Comercial</span> : <span className="tag alt">{tpd(b.tipoDespacho).nombre}</span>}</td>
                <td className="r mono">{b.kg > 0 ? <KgL kg={b.kg} /> : <span className="muted">sin inventario</span>}</td>
                <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "boleta", data: b })}><Eye size={13} /> Ver</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td colSpan={8}>TOTAL SALIDA DE GLP · {num(boletas.length)} boletas</td>
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
    const u = usr(f.usuario);
    return `${f.serie} ${f.control} ${u.nombre} ${u.doc} ${cpt(f.concepto).nombre}`.toLowerCase().includes(q.toLowerCase());
  });
  const t = lista.reduce((a, f) => ({
    kg: a.kg + kgDeSolicitud({ concepto: f.concepto, cantidad: f.cantidad }),
    total: a.total + Number(f.total || 0),
  }), { kg: 0, total: 0 });

  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Facturas emitidas <span className="cnt">{num(lista.length)}</span></h2>
          <span className="card-note">Cada una nació al cerrar un AD o al registrar una venta sin contrato. No se editan.</span></div>
        <div className="toolbar">
          <div className="search"><Search size={14} /><input placeholder="Buscar serie, control, usuario o concepto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
      </div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Serie</th><th>Control</th><th>Fecha</th><th>Usuario</th><th>Concepto</th>
            <th className="r">Cant.</th><th className="r">GLP</th><th>Origen</th><th className="r">Total Bs</th><th></th></tr></thead>
          <tbody>
            {lista.slice(0, 200).map((f) => (
              <tr key={f.id}>
                <td className="mono strong">{f.serie}</td>
                <td className="mono muted">{f.control}</td>
                <td className="muted">{fechaCorta(f.fecha)}</td>
                <td className="u-name sm">{usr(f.usuario).nombre}</td>
                <td className="c-name">{cpt(f.concepto).nombre}</td>
                <td className="r mono">{num(f.cantidad)}</td>
                <td className="r mono">{cpt(f.concepto).inv
                  ? <KgL kg={kgDeSolicitud({ concepto: f.concepto, cantidad: f.cantidad })} />
                  : <span className="muted">servicio</span>}</td>
                <td><span className={`tag ${f.origen === "SIN_CONTRATO" ? "warn" : "alt"}`}>
                  {f.origen === "SIN_CONTRATO" ? "Sin contrato" : f.origen === "MANUAL" ? "Manual" : "Cierre de AD"}</span></td>
                <td className="r mono strong">{bs(f.total)}</td>
                <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Eye size={13} /> Ver</button></td>
              </tr>
            ))}
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
   documental —las boletas emitidas y el control de correlativo. */
function VistaDocumentos({ facV, bopV, solV, cdtF, periodoCerrado, setDoc, setModal, onExportLibro }) {
  const [tab, setTab] = useState("boletas");
  const TABS = [
    ["boletas", "Boletas de operación", FileText, bopV.length],
    ["facturas", "Facturas emitidas", Receipt, facV.length],
    ["control", "Control documental", ShieldAlert, 2],
  ];
  return (
    <>
      <div className="doc-tabs">
        {TABS.map(([k, l, Ico, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            <Ico size={15} /> {l} <em>{num(n)}</em>
          </button>
        ))}
      </div>
      {tab === "boletas" && <VistaBoletas boletas={bopV} setDoc={setDoc} />}
      {tab === "facturas" && <VistaFacturas facturas={facV} setDoc={setDoc} />}
      {tab === "control" && <ControlDocumental facturas={facV} setDoc={setDoc} setModal={setModal} onExport={onExportLibro} />}
    </>
  );
}

function ControlDocumental({ facturas, setDoc, setModal, onExport }) {
  const [q, setQ] = useState("");
  const auto = facturas.filter((f) => f.origen === "AUTOMATICA");
  const man = facturas.filter((f) => f.origen === "MANUAL");
  const gen = facturas.filter((f) => f.origen === "SIN_CONTRATO");
  const tot = (a) => a.reduce((s, f) => s + Number(f.total || 0), 0);
  const lista = facturas.filter((f) => !q || (f.serie || "").toLowerCase().includes(q.toLowerCase())
    || usr(f.usuario).nombre.toLowerCase().includes(q.toLowerCase()) || (f.control || "").includes(q));
  return (
    <>
      <div className="split">
        <div className="split-box"><div className="split-l">Nacidas del cierre de AD</div><div className="split-v">Bs {bs(tot(auto))}</div><div className="split-p">{auto.length} documentos</div></div>
        <div className="split-box"><div className="split-l">Talonario del CDT</div><div className="split-v">Bs {bs(tot(man))}</div><div className="split-p">{man.length} documentos</div></div>
        <div className="split-box"><div className="split-l">Sin contrato</div><div className="split-v">Bs {bs(tot(gen))}</div><div className="split-p">{gen.length} documentos</div></div>
        <div className="split-box total"><div className="split-l">Total consolidado</div><div className="split-v">Bs {bs(tot(facturas))}</div><div className="split-p">base del cierre de ingresos</div></div>
      </div>
      <section className="card">
        <div className="card-h"><div><h2>Anulaciones y sustituciones</h2>
          <span className="card-note">Un documento asentado no se borra. Se corrige con nota de crédito o se sustituye, y el original queda en el histórico.</span></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Documento original</th><th>Estado</th><th>Documento relacionado</th><th>Motivo</th><th>Fecha</th></tr></thead><tbody>
          <tr><td className="mono strong">U-00000124</td><td><span className="chip pri-alta">ANULADA</span></td><td className="mono">NC-00000024</td><td>Error de cantidad · documento conservado en histórico</td><td>11/08/2026</td></tr>
          <tr><td className="mono strong">U-00000126</td><td><span className="chip st-ad">SUSTITUIDA</span></td><td className="mono">U-00000131</td><td>Corrección de datos fiscales del receptor</td><td>12/08/2026</td></tr>
        </tbody></table></div>
      </section>
      <section className="card">
        <div className="card-h">
          <h2>Todos los documentos <span className="cnt">{lista.length}</span></h2>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar serie, control o usuario" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={() => setModal("manual")}><Plus size={14} /> Factura manual</button>
            <button className="btn sm" onClick={onExport}><Download size={14} /> Exportar</button>
          </div>
        </div>
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Serie</th><th>Nro. control</th><th>Origen</th><th>Fecha</th><th>Usuario</th><th>Concepto</th><th className="r">Total Bs</th><th></th></tr></thead>
          <tbody>{lista.slice(0, 80).map((f) => (
            <tr key={f.id}>
              <td className="mono strong">{f.serie}</td>
              <td className="mono muted">{f.control}</td>
              <td>{f.origen === "AUTOMATICA" ? <span className="tag">Cierre de AD</span> : f.origen === "SIN_CONTRATO" ? <span className="tag alt">Sin contrato</span> : <span className="tag warn">Talonario</span>}</td>
              <td className="muted">{fechaCorta(f.fecha)}</td>
              <td className="u-name sm">{usr(f.usuario).nombre}</td>
              <td className="c-name">{cpt(f.concepto).nombre}</td>
              <td className="r mono strong">{bs(f.total)}</td>
              <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Eye size={13} /> Ver</button></td>
            </tr>
          ))}</tbody>
        </table></div>
        {lista.length > 80 && <div className="mas">Mostrando 80 de {lista.length} · exporta para el detalle completo</div>}
      </section>
    </>
  );
}

/* ═══════════  INVENTARIO  ═══════════ */

function VistaInventario({ existencias, compromisos, disponibles, movs, cdtF, onExport }) {
  const lista = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  return (
    <>
      <div className="inv-regla"><Gauge size={17}/><div><b>Pago ≠ salida de inventario.</b><span>Una persona puede pagar hoy y recibir semanas después. El pago compromete GLP; la existencia física solo disminuye cuando Operaciones entrega y cierra el AD.</span></div></div>

      {/* Las tres cifras del inventario, cada una en sus dos unidades. El GLP se compra
          por litro y se factura por kilo: quien mira esta pantalla necesita las dos. */}
      <div className="inv-totales">
        <KgLBloque label="Existencia física" kg={lista.reduce((a,c)=>a+Number(existencias[c.id]||0),0)} />
        <KgLBloque label="Comprometido por pagos" kg={lista.reduce((a,c)=>a+Number(compromisos[c.id]||0),0)} tono="warn" />
        <KgLBloque label="Disponible para planificar" kg={lista.reduce((a,c)=>a+Number(disponibles[c.id]||0),0)} tono="ok" />
      </div>

      <section className="card">
        <div className="card-h"><div><h2>Disponibilidad real por CDT</h2><span className="card-note"><NotaFactor /></span></div><button className="btn sm" onClick={onExport}><Download size={14}/> Exportar</button></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>CDT</th><th className="r">Existencia física</th><th className="r">Comprometido</th><th className="r">Disponible</th><th>Capacidad física</th></tr></thead><tbody>
          {lista.map((c)=>{const pct=(existencias[c.id]/c.capacidad)*100;return <tr key={c.id}>
            <td><div className="u-name">{c.nombre}</div><div className="u-doc">{c.sector}</div></td>
            <td className="r mono strong"><KgL kg={existencias[c.id]} /></td>
            <td className="r mono"><KgL kg={compromisos[c.id]||0} tono="warn" /></td>
            <td className="r mono"><KgL kg={disponibles[c.id]||0} tono="ok" /></td>
            <td><div className="mini-cap"><span style={{width:`${Math.min(100,pct)}%`}}/><em>{Math.round(pct)}%</em></div>
              <div className="u-doc"><KgL kg={c.capacidad} /> de capacidad</div></td></tr>})}
        </tbody>
        <tfoot><tr>
          <td>TOTALES · {lista.length} CDT</td>
          <td className="r"><KgL kg={lista.reduce((a,c)=>a+Number(existencias[c.id]||0),0)} /></td>
          <td className="r"><KgL kg={lista.reduce((a,c)=>a+Number(compromisos[c.id]||0),0)} /></td>
          <td className="r"><KgL kg={lista.reduce((a,c)=>a+Number(disponibles[c.id]||0),0)} /></td>
          <td />
        </tr></tfoot>
        </table></div>
      </section>
      <section className="card">
        <div className="card-h"><div><h2>Kardex operativo de GLP</h2><span className="card-note">Demostración visual de entradas, compromisos, transferencias, ajustes y salidas. Estos ejemplos no alteran los saldos seed del panel.</span></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>Fecha / hora</th><th>Movimiento</th><th>Documento</th><th>Origen</th><th>Destino</th><th className="r">Entrada</th><th className="r">Salida</th><th className="r">Compromiso</th><th className="r">Saldo físico</th><th>Estado</th></tr></thead><tbody>
          <tr><td>14/08 · 06:12</td><td><span className="tag">Recepción GLP</span></td><td className="mono">REC-140826-01</td><td>Abastecimiento</td><td>Jacinto Lara</td><td className="r ok-num"><KgL kg={12500} tono="ok" /></td><td className="r">—</td><td className="r">—</td><td className="r mono strong"><KgL kg={(existencias[CDTS[0].id]||0)+12500} /></td><td><span className="pago-ok">Confirmada</span></td></tr>
          <tr><td>14/08 · 07:21</td><td><span className="tag warn">Compromiso por pago</span></td><td className="mono">PAG-8439182</td><td>Comercialización</td><td>Reserva lógica</td><td className="r">—</td><td className="r">—</td><td className="r warn-num"><KgL kg={180} tono="warn" /></td><td className="r mono strong"><KgL kg={existencias[CDTS[0].id]||0} /></td><td><span className="chip st-ad">Sin salida física</span></td></tr>
          <tr><td>14/08 · 08:04</td><td><span className="tag alt">Transferencia</span></td><td className="mono">TRF-140826-03</td><td>Jacinto Lara</td><td>CDT Palavecino</td><td className="r">—</td><td className="r neg"><KgL kg={1500} tono="neg" /></td><td className="r">—</td><td className="r mono strong"><KgL kg={Math.max(0,(existencias[CDTS[0].id]||0)-1500)} /></td><td><span className="pago-ok">Recibida</span></td></tr>
          <tr><td>14/08 · 10:32</td><td><span className="tag warn">Ajuste de conteo</span></td><td className="mono">AJ-140826-02</td><td>Conteo físico</td><td>Jacinto Lara</td><td className="r">—</td><td className="r neg"><KgL kg={12} tono="neg" /></td><td className="r">—</td><td className="r mono strong"><KgL kg={Math.max(0,(existencias[CDTS[0].id]||0)-1512)} /></td><td><span className="chip st-pag">Justificado</span></td></tr>
        </tbody></table></div>
      </section>
      <section className="card">
        <div className="card-h">
          <h2>Salidas físicas generadas por BOP <span className="cnt">{movs.length}</span></h2>
          <span className="card-note">No aparecen pagos pendientes aquí: todavía no han salido del CDT.</span>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Movimiento</th><th>Fecha</th><th>CDT</th><th>Comuna</th><th>Documento</th><th>Concepto</th><th>Tipo</th><th className="r">Salida de GLP</th></tr></thead>
            <tbody>{movs.slice(0,60).map((m)=><tr key={m.id}><td className="mono muted">{m.id}</td><td className="muted">{fechaCorta(m.fecha)}</td><td>{cdtOf(m.cdt).corto}</td><td className="c-name">{comunaOf(m.comuna).nombre}</td><td className="mono strong">{m.doc}</td><td className="c-name">{cpt(m.concepto).nombre}</td><td><span className={`tag ${m.tipo === "SALIDA_MANUAL" ? "warn" : "alt"}`}>{m.tipo === "SALIDA_MANUAL" ? "Salida manual CDT" : "Salida por BOP"}</span></td><td className="r mono"><KgL kg={Math.abs(m.kg)} tono="neg" /></td></tr>)}</tbody>
            <tfoot><tr>
              <td colSpan={7}>TOTAL DE SALIDAS · {num(movs.length)} movimientos</td>
              <td className="r"><KgL kg={movs.reduce((a,m)=>a+Math.abs(Number(m.kg||0)),0)} /></td>
            </tr></tfoot>
          </table>
        </div>
        {movs.length>60&&<div className="mas">Mostrando 60 de {movs.length} movimientos · exporta para el detalle completo</div>}
      </section>
    </>
  );
}


function VistaEPSDC({ sols, onExport }) {
  const lista = sols.filter((s) => s.transportistaTipo === "EPSDC" && s.boleta);
  const venta = lista.reduce((a,s) => a + s.total, 0);
  const servicio = venta * 0.30;
  const kg = lista.reduce((a,s) => a + cpt(s.concepto).kg * s.cantidad, 0);
  const grupos = Object.values(lista.reduce((acc,s)=>{ const id=s.epsdc||"EPSDC"; if(!acc[id]) acc[id]={id,ads:0,venta:0,kg:0}; acc[id].ads++; acc[id].venta+=Number(s.total||0); acc[id].kg+=cpt(s.concepto).kg*s.cantidad; return acc; },{}));
  const [liqEstados,setLiqEstados] = useState(() => Object.fromEntries(grupos.map((g,i)=>[g.id,["PENDIENTE","REVISADA","APROBADA","PAGADA"][i%4]])));
  const avanzarLiq=(id)=>setLiqEstados(prev=>{const seq=["PENDIENTE","REVISADA","APROBADA","PAGADA"];const i=Math.max(0,seq.indexOf(prev[id]||"PENDIENTE"));return {...prev,[id]:seq[Math.min(seq.length-1,i+1)]}});
  return (
    <>
      <div className="kpis">
        <Kpi label="Venta transportada EPSDC" valor={`Bs ${bs(venta)}`} pie={`${lista.length} AD cerradas`} tono="verde" />
        <Kpi label="Servicio EPSDC · 30%" valor={`Bs ${bs(servicio)}`} pie="soporte para pago del tercero" tono="ambar" />
        <Kpi label="GLP transportado" valor={<KgL kg={kg} />} pie="facturado por kilo, medido por litro" tono="gris" />
      </div>
      <section className="card">
        <div className="card-h"><div><h2>Liquidaciones EPSDC</h2><span className="card-note">Simulación del ciclo documental: Pendiente → Revisada → Aprobada → Pagada. La base continúa siendo únicamente AD entregadas/cerradas.</span></div></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>EPSDC</th><th className="r">AD cerradas</th><th className="r">GLP transportado</th><th className="r">Venta transportada Bs</th><th className="r">30% servicio Bs</th><th>Estado</th><th>Pago / soporte</th><th></th></tr></thead><tbody>{grupos.map((g,i)=>{const est=liqEstados[g.id]||"PENDIENTE";const pagada=est==="PAGADA";return <tr key={g.id}><td><div className="u-name">{epsdcOf(g.id).nombre}</div><div className="u-doc">{epsdcOf(g.id).rif}</div></td><td className="r mono strong">{g.ads}</td><td className="r mono"><KgL kg={g.kg} /></td><td className="r mono strong">{bs(g.venta)}</td><td className="r mono strong">{bs(g.venta*.30)}</td><td><span className={`chip ${pagada?"st-cul":est==="APROBADA"?"st-con":est==="REVISADA"?"st-ad":"st-pag"}`}>{est}</span></td><td>{pagada?<div><div className="u-name sm">Banco de Venezuela</div><div className="u-doc">Op. {`84${String(391820+i*731).padStart(7,"0")}`} · 16/08/2026</div></div>:<span className="muted">Pendiente de comprobante</span>}</td><td><button className="btn sm ghost" disabled={pagada} onClick={()=>avanzarLiq(g.id)}>{pagada?"Cerrada":"Avanzar estado"}</button></td></tr>})}</tbody></table></div>
      </section>
      <section className="card">
        <div className="card-h">
          <div><h2>Resumen de la venta transportada por EPSDC</h2>
            <span className="card-note">Control generado desde los AD cerrados por un usuario de despacho tipo EPSDC. No se carga manualmente.</span></div>
          <button className="btn sm" onClick={onExport}><Download size={14}/> Descargar soporte 30%</button>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>AD</th><th>Fecha</th><th>EPSDC</th><th>Operador / unidad</th><th>Comuna</th><th>Usuario</th><th>Tipo</th><th className="r">GLP</th><th className="r">Venta Bs</th><th className="r">30% Bs</th><th>Soporte</th></tr></thead>
            <tbody>{lista.map((s)=><tr key={s.id}>
              <td><div className="mono strong">{s.ad}</div><div className="u-doc">{s.boleta}</div></td>
              <td className="muted">{fechaCorta(s.entrega)}</td>
              <td><div className="u-name">{epsdcOf(s.epsdc).nombre}</div><div className="u-doc">{epsdcOf(s.epsdc).rif}</div></td>
              <td><div className="u-name sm">{s.operador}</div><div className="u-doc">{s.unidad}</div></td>
              <td className="c-name">{comunaOf(s.comuna).nombre}</td>
              <td><div className="u-name sm">{usr(s.usuario).nombre}</div></td>
              <td><span className="tag alt">{tpd(s.tipoDespacho).nombre}</span></td>
              <td className="r mono">{num(cpt(s.concepto).kg*s.cantidad)}</td>
              <td className="r mono strong">{bs(s.total)}</td>
              <td className="r mono strong">{bs(s.total*0.30)}</td>
              <td><span className="pago-ok"><Check size={11}/> AD + BOP</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="cerrado-bar"><Truck size={15}/> Base del cálculo: 30% de la venta transportada registrada en cada AD EPSDC cerrado.</div>
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

/* ═══════════  USUARIOS  ═══════════ */

function FichaUsuario({ u, solicitudes, facturas, reclamos, onClose, setDoc }) {
  const ss = solicitudes.filter((s) => s.usuario === u.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const fs = facturas.filter((f) => f.usuario === u.id).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const perfil = {
    id: u.id, nombre: u.nombre, doc: u.doc, contrato: u.contrato, tipo: u.tipoContrato,
    uso: segmentoUsuario(u), comuna: comunaOf(u.comuna).nombre, comunidad: u.sector,
    cdt: cdtOf(u.cdt).nombre, direccion: u.dir, tel: u.tel, correo: u.correo, desde: u.desde,
  };
  const historicoSolicitudes = ss.map((s) => {
    const kg = kgDeSolicitud(s);
    return {
      id: s.id, fecha: s.fecha, concepto: cpt(s.concepto).nombre, cantidad: s.cantidad,
      kg, litros: kgALitros(kg), ad: s.ad, estado: fase(s.estado).admin,
    };
  });
  const pagos = ss.filter((s)=>s.pago).map((s) => ({
    solicitud: s.id,
    banco: s.pago?.banco ? banco(s.pago.banco).nombre : "No aplica",
    operacion: s.pago?.referencia || "—",
    fecha: s.pago?.fecha,
    base: s.pago?.estado === "VERIFICADO" ? Number(s.base || 0) : 0,
    iva: s.pago?.estado === "VERIFICADO" ? Number(s.iva || 0) : 0,
    total: s.pago?.estado === "VERIFICADO" ? Number(s.total || 0) : 0,
    estado: s.pago?.estado === "VERIFICADO" ? "PAGO VERIFICADO" : (s.pago?.estado || "NO APLICA"),
    validacion: s.pago?.auto ? "Conciliación automática" : "Registro manual",
  })).sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));
  const despachos = ss.filter((s)=>s.ad).map((s)=>{
    const kg = kgDeSolicitud(s);
    return {
      ad:s.ad, fecha:s.entrega||s.fecha, comuna:comunaOf(s.comuna).nombre, comunidad:u.sector,
      placa:String(s.unidad||"—").replace(/^Placa\s+/i,""), operador:s.operador||"—", operadorCedula:"—",
      bop:s.boleta||"—", kg, litros:kgALitros(kg), estado: fase(s.estado).admin,
    };
  });
  const historicoFacturas = fs.map((f)=>({
    serie:f.serie, control:f.control, fecha:f.fecha, concepto:cpt(f.concepto).nombre, ad:f.ad,
    base:f.base, iva:f.iva, total:f.total,
    onOpen:()=>{ onClose(); setDoc({tipo:"factura",data:f}); },
  }));
  const auditoria = [];
  ss.forEach((s)=>{
    auditoria.push({fecha:s.fecha,hora:"08:00",evento:"Solicitud registrada",origen:"Solicitudes",referencia:s.id,detalle:`${cpt(s.concepto).nombre} · ${s.cantidad} unidad(es)`});
    if(s.pago?.referencia) auditoria.push({fecha:s.pago.fecha||s.fecha,hora:"08:05",evento:"Pago conciliado",origen:s.pago.auto?"Conciliación bancaria":"Registro manual",referencia:s.pago.referencia,detalle:`${s.pago.banco?banco(s.pago.banco).nombre:"Banco"} · solicitud ${s.id}`});
    if(s.ad) auditoria.push({fecha:s.fecha,hora:"09:10",evento:"Asignación a AD",origen:"Distribución",referencia:s.ad,detalle:`Solicitud ${s.id} · ${comunaOf(s.comuna).nombre}`});
    if(s.boleta) auditoria.push({fecha:s.entrega||s.fecha,hora:"14:40",evento:"Despacho físico / BOP",origen:"Operaciones",referencia:s.boleta,detalle:`AD ${s.ad} · salida física conciliada`});
    if(s.serie) auditoria.push({fecha:s.entrega||s.fecha,hora:"14:42",evento:"Factura emitida",origen:"Comercialización",referencia:s.serie,detalle:`Control ${s.control||"—"} · AD ${s.ad||"—"}`});
  });
  fs.filter(f=>!f.sol).forEach((f)=>auditoria.push({fecha:f.fecha,hora:"10:30",evento:"Factura manual registrada",origen:"Comercialización",referencia:f.serie,detalle:`Control ${f.control||"—"}`}));
  auditoria.sort((a,b)=>new Date(b.fecha||0)-new Date(a.fecha||0));
  return <Usuario360Modal mode="comercializacion" {...{perfil,pagos,despachos,auditoria}} solicitudes={historicoSolicitudes} facturas={historicoFacturas} onClose={onClose}/>;
}

/* ═══════════  CIERRE MENSUAL  ═══════════ */

function VistaCierre({ facV, solV, boletas, rutasDistribucion, existencias, compromisos, disponibles, periodoCerrado, setPeriodoCerrado, onExport, setDoc, cdtF }) {
  const [tab, setTab] = useState("precierre");
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
      {tab === "precierre" && <PreCierre {...{ facV, solV, boletas, existencias, compromisos, disponibles,
        rutasDistribucion, cdtF, periodoCerrado, setPeriodoCerrado, onExport }} />}
      {tab === "cierre" && <TablaCierre {...{ facV, solV, existencias, compromisos, disponibles,
        periodoCerrado, setPeriodoCerrado, onExport, setDoc, cdtF }} />}
    </>
  );
}

function TablaCierre({ facV, solV, existencias, compromisos, disponibles, periodoCerrado, setPeriodoCerrado, onExport, setDoc, cdtF }) {
  const cierre = resumenCierreMensual(facV, solV);
  const t = cierre.totales;
  const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  const fisico = cdtsAlcance.reduce((a, c) => a + Number(existencias[c.id] || 0), 0);
  const comprometido = cdtsAlcance.reduce((a, c) => a + Number(compromisos[c.id] || 0), 0);
  const disponible = cdtsAlcance.reduce((a, c) => a + Number(disponibles[c.id] || 0), 0);
  const abiertas = cierre.compromisosPendientes.length;

  return (
    <>
      {abiertas > 0 && !periodoCerrado && (
        <div className="warn-bar"><Clock3 size={16} />
          <span>Hay <strong>{abiertas} compromisos de GLP todavía no entregados</strong>. El período puede cerrar sin descuadrarse: el dinero ya recaudado queda visible como pendiente y el GLP permanece dentro del inventario físico hasta la entrega real.</span></div>
      )}

      <div className="split cierre-kpis">
        <div className="split-box total"><div className="split-l">Entregado y facturado</div><div className="split-v">Bs {bs(t.totalEntregado)}</div><div className="split-p">Base {bs(t.baseEntregada)} · IVA {bs(t.ivaEntregado)}</div></div>
        <div className="split-box"><div className="split-l">Recaudado sin despachar</div><div className="split-v">Bs {bs(t.totalPendiente)}</div><div className="split-p">Base {bs(t.basePendiente)} · IVA {bs(t.ivaPendiente)}</div></div>
        <div className="split-box"><div className="split-l">GLP físico vs comprometido</div><div className="split-v"><KgL kg={fisico} /> <span className="split-sep">/</span> <KgL kg={comprometido} /></div><div className="split-p">Disponible real: <KgL kg={disponible} /></div></div>
        <div className="split-box"><div className="split-l">Salida real del período</div><div className="split-v"><KgL kg={t.kgDespachado} /></div><div className="split-p">salida física real del período</div></div>
      </div>

      <section className="card">
        <div className="card-h">
          <div><h2>Cierre mensual de comercialización · {PERIODO.label}</h2>
            <span className="card-note">Una sola tabla concilia facturación entregada, recaudación aún no despachada e inventario. El saldo pendiente no se suma al total facturado hasta que ocurra la entrega física.</span></div>
          <div className="toolbar">
            <button className="btn sm" onClick={onExport}><Download size={14} /> Descargar cierre</button>
            <button className="btn sm" onClick={() => setDoc({ tipo: "acta" })}><Printer size={14} /> Acta de cierre</button>
            <button className={`btn sm ${periodoCerrado ? "" : "primary"}`} onClick={() => setPeriodoCerrado(!periodoCerrado)}>
              {periodoCerrado ? "Reabrir período" : <><Lock size={14} /> Cerrar período</>}
            </button>
          </div>
        </div>
        <div className="cierre-leyenda">
          <span><b>Entregado / facturado:</b> operación física ya cerrada.</span>
          <span><b>Recaudado pendiente:</b> dinero cobrado cuyo gas sigue físicamente en el CDT.</span>
          <span><b>Inventario:</b> por fila se compara salida física vs GLP comprometido; el stock físico común del CDT se reconcilia al pie.</span>
        </div>
        <div className="scroll cierre-scroll">
          <table className="tbl cierre cierre-unificado">
            <thead>
              <tr className="head-groups">
                <th rowSpan={2}>Concepto de ingreso</th>
                <th colSpan={5} className="grp-ent">Entregado / facturado</th>
                <th colSpan={5} className="grp-pend">Recaudado pendiente de despacho</th>
                <th colSpan={4} className="grp-inv">Inventario GLP</th>
              </tr>
              <tr>
                <th className="r">Docs.</th><th className="r">Cant.</th><th className="r">Base Bs</th><th className="r">IVA Bs</th><th className="r">Total Bs</th>
                <th className="r">Solic.</th><th className="r">Cant.</th><th className="r">Base Bs</th><th className="r">IVA Bs</th><th className="r">Total Bs</th>
                <th className="r">Desp. kg</th><th className="r">Desp. L</th><th className="r">Pend. kg</th><th className="r">Pend. L</th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS.map((g) => (
                <React.Fragment key={g}>
                  <tr className="grp"><td colSpan={15}>{g}</td></tr>
                  {cierre.filas.filter((r) => r.grupo === g).map((r) => (
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
          <div><span>Inventario físico al cierre</span><b><KgL kg={fisico} /></b></div>
          <div><span>GLP comprometido pendiente</span><b><KgL kg={comprometido} /></b></div>
          <div><span>Disponible real</span><b><KgL kg={disponible} /></b></div>
          <div className="formula"><span>Fórmula de control</span><b>Físico − comprometido = disponible</b></div>
        </div>
        {periodoCerrado && <div className="cerrado-bar"><Lock size={15} /> Período cerrado el {fecha(HOY)}. Los compromisos no despachados permanecen abiertos para el siguiente período sin alterar la existencia física.</div>}
      </section>
    </>
  );
}

/* ═══════════  MODAL FACTURA MANUAL  ═══════════ */

function ModalManual({ onClose, onSave }) {
  const [d, setD] = useState({ usuario: USUARIOS[1].id, cdt: CDTS[0].id, concepto: "BOMB_10", cantidad: 1 });
  const m = montos(d.concepto, Number(d.cantidad) || 0, d.usuario);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><div><div className="mh-eyebrow">Facturación</div><h3>Factura manual del CDT</h3></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-b">
          <p className="modal-intro">Para el talonario físico que emiten los CDT. Entra al consolidado de ingresos igual que las automáticas, marcada como manual.</p>
          <div className="row2">
            <label className="campo"><span>CDT emisor</span><select value={d.cdt} onChange={set("cdt")}>{CDTS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="campo"><span>Cantidad</span><input type="number" min="1" value={d.cantidad} onChange={set("cantidad")} /></label>
          </div>
          <label className="campo"><span>Usuario</span><select value={d.usuario} onChange={set("usuario")}>{USUARIOS.map((u) => <option key={u.id} value={u.id}>{u.nombre} — contrato {u.contrato}</option>)}</select></label>
          <label className="campo"><span>Concepto</span><select value={d.concepto} onChange={set("concepto")}>{CONCEPTOS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <div className="preview"><div className="preview-h">Monto calculado</div><div className="preview-monto">Bs {bs(m.total)}</div>
            <div className="preview-det">Base {bs(m.base)} · IVA {m.exento ? "exonerado" : bs(m.iva)}</div></div>
        </div>
        <div className="modal-f"><button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={() => onSave(d)}>Registrar factura</button></div>
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
.dim{color:var(--ink-3)}

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
.card-h.mt{border-top:1px solid var(--line-2)}
.card-h h2{margin:0;font-size:14px;font-weight:620;display:flex;align-items:center;gap:8px}
.cnt{font-family:var(--mono);font-size:11px;background:var(--line-2);color:var(--ink-3);padding:2px 7px;border-radius:20px;font-weight:600}
.card-note{font-size:11.5px;color:var(--ink-3)}
.scroll{overflow-x:auto}
.scroll.max{max-height:250px;overflow-y:auto}
.mas{padding:11px 18px;font-size:12px;color:var(--ink-3);border-top:1px solid var(--line-2);background:#FBFCFD}

.bars{padding:14px 18px 18px;display:flex;flex-direction:column;gap:10px}
.bar-row{display:grid;grid-template-columns:1fr 78px 96px;gap:12px;align-items:center}
.bar-name{display:block;font-size:12.5px;color:var(--ink-2);line-height:1.25}
.bar-grp{font-size:10px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.08em}
.bar-track{height:7px;background:var(--line-2);border-radius:4px;overflow:hidden}
.bar-fill{height:100%;background:var(--azul-2);border-radius:4px;transition:width .5s}
.bar-fill.rojo{background:#C25A52}
.bar-val{font-family:var(--mono);font-size:12.5px;text-align:right;font-variant-numeric:tabular-nums}

.spark{display:flex;align-items:flex-end;gap:8px;height:104px;padding:16px 18px 10px}
.spark-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px}
.spark-bar{width:100%;background:var(--azul-2);border-radius:3px 3px 0 0;min-height:4px}
.spark-col span{font-size:10.5px;color:var(--ink-3);font-family:var(--mono)}

.estatus{padding:12px 18px;display:flex;flex-direction:column;gap:9px}
.est-row{display:grid;grid-template-columns:96px 1fr 40px;align-items:center;gap:10px}
.est-desc{font-size:11.5px;color:var(--ink-3);line-height:1.3}
.est-n{font-family:var(--mono);font-size:16px;font-weight:600;text-align:right}
.cdt-list{padding:13px 18px 17px;display:flex;flex-direction:column;gap:10px}
.cdt-row{display:grid;grid-template-columns:1fr 74px 84px;gap:11px;align-items:center}
.cdt-name{font-size:12.5px;color:var(--ink-2)}
.cdt-track{height:7px;background:var(--line-2);border-radius:4px;overflow:hidden}
.cdt-fill{height:100%;background:var(--verde);border-radius:4px}
.cdt-fill.low{background:var(--llama)}
.cdt-kg{font-family:var(--mono);font-size:12px;text-align:right}

.tbl{width:100%;border-collapse:collapse;min-width:900px}
.tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:650;padding:9px 11px;border-bottom:1px solid var(--line);background:#FBFCFD;white-space:nowrap}
.tbl td{padding:9px 11px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:13px}
.tbl.compact{min-width:640px}
.tbl.compact td,.tbl.compact th{padding:7px 10px;font-size:12.5px}
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
.modal,.casc{background:var(--panel);border-radius:14px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(16,23,32,.3);animation:pop .2s cubic-bezier(.2,.9,.3,1);max-height:92vh;display:flex;flex-direction:column}
.modal.wide{max-width:840px}
@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
.modal-h{display:flex;justify-content:space-between;align-items:flex-start;padding:17px 20px;border-bottom:1px solid var(--line-2)}
.modal-h h3{margin:4px 0 0;font-size:15.5px;font-weight:620}
.mh-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:var(--azul);font-weight:700}
.ficha-sub{font-size:12px;color:var(--ink-3);margin-top:5px;font-family:var(--mono)}
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
.ficha-kpis{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;background:#F5F7F9;border-radius:10px;padding:13px 15px}
.ficha-kpis div{display:flex;flex-direction:column;gap:3px;min-width:0}
.ficha-kpis span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:600}
.ficha-kpis b{font-size:13px;font-weight:560}
.ficha-tit{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);font-weight:650}
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

.casc{max-width:490px}
.casc-h{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px 6px}
.casc-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--llama);font-weight:700}
.casc-h h3{margin:6px 0 0;font-size:17px;font-weight:640;letter-spacing:-.3px}
.casc-steps{padding:16px 22px 4px}
.casc-step{display:grid;grid-template-columns:34px 1fr 20px;gap:12px;align-items:flex-start;opacity:.28;transition:opacity .35s}
.casc-step.on{opacity:1}
.casc-rail{display:flex;flex-direction:column;align-items:center;align-self:stretch}
.casc-dot{width:32px;height:32px;border-radius:9px;background:var(--line-2);color:var(--ink-3);display:grid;place-items:center;flex-shrink:0;transition:.3s}
.casc-step.on .casc-dot{background:var(--azul);color:#fff}
.casc-line{flex:1;width:2px;background:var(--line);min-height:16px;margin:4px 0}
.casc-step.on .casc-line{background:var(--azul-2)}
.casc-txt{padding-bottom:16px}
.casc-title{font-size:13.5px;font-weight:580;line-height:1.3}
.casc-det{font-size:11.5px;color:var(--ink-3);margin-top:3px;font-family:var(--mono)}
.casc-check{color:var(--verde);margin-top:8px}
.casc-portal{display:flex;align-items:center;gap:9px;margin:0 22px 14px;background:var(--verde-w);color:#1E5C2E;padding:11px 14px;border-radius:10px;font-size:12.5px;line-height:1.45}
.casc-f{border-top:1px solid var(--line-2);padding:15px 22px;display:flex;justify-content:space-between;align-items:center;gap:16px;background:#FBFCFD;border-radius:0 0 14px 14px}
.casc-f p{margin:0;font-size:12px;color:var(--ink-3);line-height:1.45}

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
 .ficha-kpis,.rec-meta{grid-template-columns:1fr 1fr}
 .conc-bar{flex-wrap:wrap}
 .row2{grid-template-columns:1fr}
}
@media print{.gl.printing .side,.gl.printing .main,.gl.printing .toast{display:none!important}}
@media(prefers-reduced-motion:reduce){.gl *{animation:none!important;transition:none!important}}

/* dashboard ejecutivo comercializacion */
.cm-dash{display:flex;flex-direction:column;gap:16px}.cm-dash-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.cm-dash-head h2{font-size:24px;margin:5px 0 5px}.cm-dash-head p{margin:0;color:#70808d;font-size:12.5px}.cm-dash-eyebrow{font-size:10px;font-weight:800;color:#246447;text-transform:uppercase;letter-spacing:.08em}.cm-range{display:flex;padding:3px;background:#eef2f4;border-radius:9px}.cm-range button{border:0;background:transparent;padding:7px 14px;border-radius:7px;font-size:10px;font-weight:800;color:#6b7882;cursor:pointer}.cm-range button.on{background:#fff;color:#17372a;box-shadow:0 1px 4px #1a2e2314}.cm-top-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.cm-dash-metric{border:1px solid #e0e7e4;background:#fff;border-radius:12px;padding:14px;text-align:left;display:flex;flex-direction:column;gap:5px;min-height:92px;color:#1b2923}.cm-dash-metric>span{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#718079;font-weight:800}.cm-dash-metric>b{font-size:19px}.cm-dash-metric>small{font-size:9.5px;color:#7a8982;line-height:1.35}.cm-dash-metric.money{border-left:4px solid #1c7a50}.cm-dash-metric.warn{border-left:4px solid #d08a24}.cm-dash-metric.soft{border-left:4px solid #89949d}.cm-dash-metric.click{cursor:pointer}.cm-dash-metric.click:hover{transform:translateY(-1px);box-shadow:0 5px 14px #14291f12}.cm-period-strip{display:flex;align-items:center;gap:10px;background:#F7F9F8;border:1px solid #E4EAE7;border-radius:10px;padding:8px 10px}.cm-period-strip>span{font-size:8.5px;color:#6C7B74;margin-right:auto}.cm-period-strip>div{min-width:94px;border-left:1px solid #DEE6E2;padding-left:9px}.cm-period-strip b{display:block;font-size:9.5px;color:#2D5F48}.cm-period-strip small{font-size:7.5px;color:#7B8882}.cm-chart{background:#fff;border:1px solid #e1e7e4;border-radius:13px;padding:15px;min-width:0}.cm-money-chart{min-height:330px}.cm-chart-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px}.cm-chart-head h3{margin:0;font-size:14px}.cm-chart-head p{margin:3px 0 0;font-size:9.5px;color:#78867f}.cm-chart-grid{display:grid;gap:12px}.cm-chart-grid.two{grid-template-columns:1fr 1fr}.cm-chart-link{border:0;background:none;color:#2c6c4f;font-size:9px;font-weight:800;display:flex;gap:4px;align-items:center;cursor:pointer}.cm-chart-badge{font-size:8.5px;background:#eef5f1;color:#35664f;padding:5px 8px;border-radius:999px}.cm-legend{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}.cm-legend span{font-size:8px;color:#6b7972;display:flex;gap:4px;align-items:center}.cm-legend i{width:7px;height:7px;border-radius:2px}.cm-group-bars{height:220px;display:flex;gap:5px;align-items:flex-end;border-bottom:1px solid #dfe6e2;padding:8px 4px 0;overflow-x:auto}.cm-gcol{height:100%;min-width:32px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px}.cm-group-bars.dense .cm-gcol{min-width:23px}.cm-gbars{height:178px;width:100%;display:flex;align-items:flex-end;gap:2px;justify-content:center}.cm-gbar{width:18%;min-width:3px;border-radius:3px 3px 0 0;transition:.2s}.cm-gbar.green{background:#1c7a50}.cm-gbar.blue{background:#2d65b0}.cm-gbar.amber{background:#d08a24}.cm-gbar.slate{background:#8c98a3}.cm-gcol>span{font-size:7.5px;color:#7b8882;white-space:nowrap}.cm-money-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.cm-money-foot.two{grid-template-columns:repeat(2,1fr)}.cm-money-foot>div{background:#f7f9f8;border-radius:8px;padding:8px}.cm-money-foot span{font-size:8px;color:#728078;display:block}.cm-money-foot b{font-size:10px;margin-top:3px;display:block}.cm-inv-list{display:flex;flex-direction:column;gap:13px}.cm-inv-row{display:grid;grid-template-columns:minmax(150px,auto) 1fr minmax(150px,auto);gap:12px;align-items:center}.cm-inv-name b,.cm-inv-val b{font-size:11.5px;display:block;line-height:1.3}.cm-inv-name span,.cm-inv-val span{font-size:11px;color:#78867f;display:block;margin-top:3px;line-height:1.4}.cm-inv-val{text-align:right}.cm-inv-track{height:13px;background:#edf1ef;border-radius:999px;position:relative;overflow:hidden;display:flex}.cm-inv-disp{height:100%;background:#2b9566}.cm-inv-comp{height:100%;background:#d6a34a}.cm-inventory-total{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 16px;border-top:1px solid #e6ebe8;margin-top:13px;padding-top:10px;align-items:center}.cm-inventory-total span{font-size:10.5px;color:#75837c;display:block}.cm-inventory-total b{font-size:12px;display:block;margin-top:2px}.cm-donut-wrap{display:grid;grid-template-columns:170px 1fr;gap:20px;align-items:center;min-height:205px}.cm-donut{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;margin:auto}.cm-donut>div{width:92px;height:92px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 0 1px #e5ebe8}.cm-donut b{font-size:20px}.cm-donut span{font-size:8px;color:#77857e}.cm-donut-legend{display:flex;flex-direction:column;gap:10px}.cm-donut-row{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:center}.cm-donut-row>i{width:8px;height:8px;border-radius:50%}.cm-donut-row span{display:block;font-size:8.5px;color:#718078}.cm-donut-row b{font-size:12px}.cm-donut-row em{font-style:normal;font-size:8.5px;color:#728078}.cm-seg-list{display:flex;flex-direction:column;gap:14px}.cm-seg-head{display:flex;justify-content:space-between;gap:8px}.cm-seg-head span{font-size:9px;font-weight:800}.cm-seg-head b{font-size:10px}.cm-seg-track{height:11px;background:#edf1ef;border-radius:999px;overflow:hidden;margin:6px 0 4px}.cm-seg-track>div{height:100%;background:#376f99;border-radius:999px}.cm-seg small{font-size:8px;color:#77857e}.cm-rank{display:flex;flex-direction:column;gap:8px}.cm-rank-row{display:grid;grid-template-columns:20px 1fr 100px;gap:8px;align-items:center}.cm-rank-n{width:18px;height:18px;border-radius:50%;background:#eff4f1;color:#32634c;font-size:8px;font-weight:800;display:grid;place-items:center}.cm-rank-main>div:first-child{display:flex;justify-content:space-between;gap:8px}.cm-rank-main span{font-size:8.5px}.cm-rank-main small{font-size:7.5px;color:#7c8983}.cm-rank-track{height:6px;background:#eef2f0;border-radius:999px;overflow:hidden;margin-top:4px}.cm-rank-track>div{height:100%;background:#2f8060}.cm-rank-row>b{text-align:right;font-size:8.5px}.cm-compare{display:flex;flex-direction:column;gap:12px}.cm-compare-row{display:grid;grid-template-columns:90px 1fr;gap:9px}.cm-compare-row>span{font-size:8.5px;font-weight:800;padding-top:3px}.cm-compare-row>div{display:flex;flex-direction:column;gap:4px}.cm-compare-bar{height:18px;background:#f2f5f4;border-radius:5px;position:relative;overflow:hidden}.cm-compare-bar i{display:block;height:100%;min-width:2px}.cm-compare-bar i.a{background:#356ea4}.cm-compare-bar i.b{background:#d29a3e}.cm-compare-bar em{position:absolute;inset:0 5px;display:flex;align-items:center;font-style:normal;font-size:7px;color:#1f2e27}.cm-conc{margin:0}.cm-mini-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.cm-mini-actions button{background:#fff;border:1px solid #e1e7e4;border-radius:9px;padding:9px;display:grid;grid-template-columns:18px 1fr auto;gap:6px;align-items:center;text-align:left;color:#27362f;cursor:pointer}.cm-mini-actions span{font-size:8.5px}.cm-mini-actions b{font-size:9px}.cm-mini-actions svg{color:#4a705d}
@media(max-width:1100px){.cm-top-kpis{grid-template-columns:repeat(2,1fr)}.cm-chart-grid.two{grid-template-columns:1fr}.cm-mini-actions{grid-template-columns:repeat(2,1fr)}}

`}</style>
  );
}
