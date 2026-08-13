import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, FileText, Receipt, Gauge, HeartHandshake,
  Lock, Plus, X, ChevronRight, Check, ArrowRight, AlertTriangle, Search,
  Building2, CircleDot, Download, Printer, Users, MessageSquareWarning,
  Eye, CheckCircle2, Zap, Send, TrendingUp, Landmark, Smartphone, Truck, Clock3,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, PERIODO, HOY, CDTS, CONCEPTOS, GRUPOS,
  TIPOS_DESPACHO, USUARIOS, CLIENTE_PORTAL, BANCOS, COMUNAS, EPSDCS, banco, cpt, usr, tpd, cdtOf, comunaOf, epsdcOf, segmentoUsuario,
  FASES, faseIdx, fase, bs, num, fecha, fechaCorta, fechaLarga, descargar, csv, montos, kgALitros,
  pagadasPendientesDe, diasEntre, kgDeSolicitud, resumenCierreMensual,
} from "./datos.jsx";
import { VisorDocumento } from "./Documentos.jsx";

export default function Comercializacion({
  solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles,
  periodoCerrado, setPeriodoCerrado, crearManual,
  responderReclamo, tomarReclamo,
}) {
  const [vista, setVista] = useState("panel");
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

  const nav = [
    { id: "panel", label: "Panel", icon: LayoutDashboard },
    { id: "ad", label: "Seguimiento distribución", icon: ClipboardList, badge: pendAD + abiertas },
    { id: "pendientes", label: "Recaudación por despachar", icon: Clock3, badge: pagadasPendientesDe(solicitudes).length },
    { id: "boletas", label: "Boletas de operación", icon: FileText },
    { id: "facturas", label: "Facturación", icon: Receipt },
    { id: "inventario", label: "Inventario GLP", icon: Gauge },
    { id: "despachos", label: "Despachos especiales", icon: HeartHandshake },
    { id: "epsdc", label: "EPSDC · 30%", icon: Truck, badge: epsdcCerradas },
    { id: "reclamos", label: "Reclamos", icon: MessageSquareWarning, badge: recAbiertos },
    { id: "usuarios", label: "Usuarios y comunas", icon: Users },
    { id: "cierre", label: "Cierre mensual", icon: Lock },
  ];

  return (
    <div className={`gl ${doc ? "printing" : ""}`}>
      <Estilos />

      <aside className="side">
        <div className="brand">
          <img src={LOGO_GASLARA} alt="GasLara" className="brand-img" />
          <div className="brand-sub">Módulo de comercialización</div>
        </div>
        <nav>
          {nav.map((n) => (
            <button key={n.id} className={`navbtn ${vista === n.id ? "on" : ""}`} onClick={() => setVista(n.id)}>
              <n.icon size={16} /><span>{n.label}</span>{n.badge > 0 && <em className="navbadge">{n.badge}</em>}
            </button>
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
            <h1>{nav.find((n) => n.id === vista).label}</h1>
            <p>{fechaLarga(HOY)} · {cdtF === "TODOS" ? "Consolidado de 4 centros de distribución" : cdtOf(cdtF).nombre}</p>
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
          {vista === "panel" && <Panel {...{ solV, facV, existencias, compromisos, disponibles, ingresos, setVista, reclamos, solicitudes, cdtF }} />}
          {vista === "ad" && <VistaAD {...{ solV, setDoc, boletas, facturas }} />}
          {vista === "pendientes" && <VistaPendientes sols={solV} onExport={expPendientes} />}
          {vista === "boletas" && <VistaBoletas boletas={bopV} setDoc={setDoc} />}
          {vista === "facturas" && <VistaFacturas facturas={facV} setDoc={setDoc} setModal={setModal} onExport={expLibro} />}
          {vista === "inventario" && <VistaInventario {...{ existencias, compromisos, disponibles, movs: movV, cdtF, onExport: expInventario }} />}
          {vista === "despachos" && <VistaDespachos sols={solV} setDoc={setDoc} boletas={boletas} onExport={expDespachos} />}
          {vista === "epsdc" && <VistaEPSDC sols={solV} onExport={expEPSDC} />}
          {vista === "reclamos" && <VistaReclamos {...{ reclamos, setModal, tomarReclamo, onExport: expReclamos }} />}
          {vista === "usuarios" && <VistaUsuarios {...{ solicitudes, facturas, reclamos, setModal }} />}
          {vista === "cierre" && <VistaCierre {...{ facV, solV, existencias, compromisos, disponibles, periodoCerrado, setPeriodoCerrado, onExport: expCierre, setDoc, cdtF }} />}
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

function Panel({ solV, facV, existencias, compromisos, disponibles, ingresos, setVista, reclamos, solicitudes, cdtF }) {
  const porConcepto = CONCEPTOS.map((c) => ({ ...c, total: facV.filter((f) => f.concepto === c.id).reduce((s, f) => s + f.total, 0) }))
    .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(...porConcepto.map((c) => c.total), 1);
  const porDia = Array.from({ length: 8 }, (_, i) => ({
    d: i + 1, total: facV.filter((f) => f.fecha.getDate() === i + 1).reduce((s, f) => s + f.total, 0),
  }));
  const maxDia = Math.max(...porDia.map((x) => x.total), 1);

  const pagadas = solV.filter((s) => s.estado === "PAGADA");
  const enAD = solV.filter((s) => s.estado === "EN_AD").length;
  const culm = solV.filter((s) => s.estado === "CULMINADO").length;
  const cdtIds = CDTS.filter((c)=>cdtF === "TODOS" || c.id === cdtF).map((c)=>c.id);
  const totalKg = cdtIds.reduce((s, id) => s + (existencias[id] || 0), 0);
  const totalComp = cdtIds.reduce((s, id) => s + (compromisos[id] || 0), 0);
  const totalDisp = cdtIds.reduce((s, id) => s + (disponibles[id] || 0), 0);
  const pagosPend = pagadasPendientesDe(solV);
  const recaudadoPend = pagosPend.reduce((a,x)=>a+Number(x.total||0),0);
  const ivaPend = pagosPend.reduce((a,x)=>a+Number(x.iva||0),0);
  const masAntiguo = pagosPend.length ? Math.max(...pagosPend.map((x)=>diasEntre(x.pago?.fecha||x.fecha, HOY))) : 0;
  const conciliadoHoy = solicitudes.filter((s) => s.pago?.auto && s.pago.fecha && s.pago.fecha.getDate() === HOY.getDate() && s.pago.fecha.getMonth() === HOY.getMonth());
  const recAbiertos = reclamos.filter((r) => r.estado !== "RESUELTO");

  return (
    <>
      <div className="kpis">
        <Kpi label="Ingresos del período" valor={`Bs ${bs(ingresos)}`} pie={`${facV.length} facturas emitidas`} tono="azul" />
        <Kpi label="Pagadas sin AD" valor={pagadas.length} pie="cola de distribución" tono="ambar" click={() => setVista("ad")} />
        <Kpi label="AD abiertas" valor={enAD} pie="pendientes de cierre" tono="ambar" click={() => setVista("ad")} />
        <Kpi label="Inventario físico" valor={`${num(totalKg)} kg`} pie={`${num(kgALitros(totalKg))} L · solo baja al cierre del AD`} tono="verde" click={() => setVista("inventario")} />
        <Kpi label="Recaudado por despachar" valor={`Bs ${bs(recaudadoPend)}`} pie={`IVA Bs ${bs(ivaPend)} · ${pagosPend.length} solicitudes · hasta ${masAntiguo} días`} tono="ambar" click={() => setVista("pendientes")} />
        <Kpi label="GLP comprometido" valor={`${num(totalComp)} kg`} pie={`${num(kgALitros(totalComp))} L cobrados y aún en CDT`} tono="gris" click={() => setVista("pendientes")} />
        <Kpi label="Disponible real" valor={`${num(totalDisp)} kg`} pie={`${num(kgALitros(totalDisp))} L · físico menos comprometido`} tono="azul" click={() => setVista("inventario")} />
        <Kpi label="Reclamos abiertos" valor={recAbiertos.length} pie="atención al usuario" tono="rojo" click={() => setVista("reclamos")} />
      </div>

      <div className="conc-bar">
        <div className="conc-ico"><Zap size={18} /></div>
        <div>
          <b>Conciliación bancaria automática</b>
          <span>{conciliadoHoy.length} pagos validados hoy contra {BANCOS.length} bancos. Las solicitudes entran a la cola sin intervención del operador.</span>
        </div>
        <div className="conc-monto">Bs {bs(conciliadoHoy.reduce((s, x) => s + x.total, 0))}</div>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-h"><h2>Ingresos por concepto</h2><span className="card-note">Bs con IVA · {PERIODO.label}</span></div>
          <div className="bars">
            {porConcepto.map((c) => (
              <div className="bar-row" key={c.id}>
                <div><span className="bar-name">{c.nombre}</span><span className="bar-grp">{c.grupo}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(c.total / max) * 100}%` }} /></div>
                <div className="bar-val">{bs(c.total)}</div>
              </div>
            ))}
          </div>
        </section>

        <div>
          <section className="card">
            <div className="card-h"><h2>Facturación diaria</h2><TrendingUp size={15} className="dim" /></div>
            <div className="spark">
              {porDia.map((x) => (
                <div className="spark-col" key={x.d}>
                  <div className="spark-bar" style={{ height: `${Math.max(4, (x.total / maxDia) * 100)}%` }} title={`Bs ${bs(x.total)}`} />
                  <span>{x.d}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-h"><h2>Estatus de usuarios</h2></div>
            <div className="estatus">
              <EstRow label="Pagada" n={pagadas.length} cls="st-pag" desc="Pago conciliado, sin AD asignada" />
              <EstRow label="En AD" n={enAD} cls="st-ad" desc="Atención de distribución abierta" />
              <EstRow label="Culminado" n={culm} cls="st-cul" desc="AD cerrada · BOP, inventario y factura generados automáticamente" />
            </div>
            <div className="card-h mt"><h2>Existencia por CDT</h2></div>
            <div className="cdt-list">
              {CDTS.map((c) => {
                const pct = (existencias[c.id] / c.capacidad) * 100;
                return (
                  <div className="cdt-row" key={c.id}>
                    <div className="cdt-name">{c.corto}</div>
                    <div className="cdt-track"><div className={`cdt-fill ${pct < 35 ? "low" : ""}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                    <div className="cdt-kg">{num(existencias[c.id])} kg · {num(kgALitros(existencias[c.id]))} L</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

const Kpi = ({ label, valor, pie, tono, click }) => (
  <div className={`kpi ${tono} ${click ? "clickable" : ""}`} onClick={click}>
    <div className="kpi-l">{label}</div><div className="kpi-v">{valor}</div><div className="kpi-p">{pie}</div>
  </div>
);
const EstRow = ({ label, n, cls, desc }) => (
  <div className="est-row"><span className={`chip ${cls}`}>{label}</span><div className="est-desc">{desc}</div><div className="est-n">{n}</div></div>
);
const EstadoChip = ({ estado }) => {
  const cls = { PAGADA: "st-pag", EN_AD: "st-ad", CULMINADO: "st-cul" }[estado];
  return <span className={`chip ${cls}`}>{fase(estado).admin}</span>;
};

/* ═══════════  AD  ═══════════ */

function VistaAD({ solV, setDoc, boletas, facturas }) {
  const [q, setQ] = useState(""); const [f, setF] = useState("TODOS");
  const lista = solV.filter((s) => {
    const u = usr(s.usuario);
    const okQ = !q || u.nombre.toLowerCase().includes(q.toLowerCase()) || s.id.includes(q)
      || (s.ad || "").toLowerCase().includes(q.toLowerCase()) || u.doc.includes(q) || u.contrato.includes(q);
    return okQ && (f === "TODOS" || s.estado === f);
  });

  return (
    <section className="card">
      <div className="card-h">
        <div><h2>Seguimiento de distribución <span className="cnt">{lista.length}</span></h2>
          <span className="card-note">El AD se crea y se cierra exclusivamente desde Distribución / Operaciones. Comercialización consulta el resultado del cierre automático.</span></div>
        <div className="toolbar">
          <div className="search"><Search size={14} /><input placeholder="Buscar solicitud, AD, usuario o contrato" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="tabs">
            {["TODOS", ...FASES.map((x) => x.key)].map((t) => (
              <button key={t} className={f === t ? "on" : ""} onClick={() => setF(t)}>{t === "TODOS" ? "Todas" : fase(t).admin}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr>
            <th>Solicitud</th><th>AD</th><th>Fecha</th><th>Usuario</th><th>Concepto</th>
            <th className="r">Cant.</th><th>Tipo</th><th>Pago</th><th className="r">Total Bs</th>
            <th>Documentos</th><th>Estatus</th><th></th>
          </tr></thead>
          <tbody>
            {lista.map((s) => {
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
                    {s.estado === "PAGADA" && <span className="tag alt">Pendiente de asignación</span>}
                    {s.estado === "EN_AD" && <span className="tag">En distribución</span>}
                    {s.estado === "CULMINADO" && <span className="tag">AD cerrado · automático</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lista.length && <div className="empty">No hay solicitudes con estos filtros.</div>}
    </section>
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

/* ═══════════  RECAUDACIÓN PENDIENTE DE DESPACHO  ═══════════ */
function VistaPendientes({ sols, onExport }) {
  const [q,setQ]=useState(""); const [edad,setEdad]=useState("TODOS");
  const base=pagadasPendientesDe(sols).map((s)=>({...s,dias:diasEntre(s.pago?.fecha||s.fecha,HOY)})).sort((a,b)=>b.dias-a.dias);
  const lista=base.filter((s)=>{const txt=`${usr(s.usuario).nombre} ${usr(s.usuario).doc} ${comunaOf(s.comuna).nombre} ${s.id} ${s.ad||""}`.toLowerCase();const okQ=!q||txt.includes(q.toLowerCase());const okE=edad==="TODOS"||(edad==="30"?s.dias>=30:edad==="15"?s.dias>=15&&s.dias<30:s.dias<15);return okQ&&okE;});
  const kg=base.reduce((a,s)=>a+kgDeSolicitud(s),0);
  const baseBs=base.reduce((a,s)=>a+Number(s.base||0),0);
  const ivaBs=base.reduce((a,s)=>a+Number(s.iva||0),0);
  const totalBs=base.reduce((a,s)=>a+Number(s.total||0),0);
  const mayores30=base.filter((s)=>s.dias>=30).length;
  const res=base.filter((s)=>segmentoUsuario(s.usuario)==="RESIDENCIAL");
  const com=base.filter((s)=>segmentoUsuario(s.usuario)==="COMERCIAL");
  const inst=base.filter((s)=>segmentoUsuario(s.usuario)==="INSTITUCIONAL");
  return <>
    <div className="kpis">
      <Kpi label="Recaudado sin despachar" valor={`Bs ${bs(totalBs)}`} pie={`${base.length} solicitudes pagadas · dinero ya conciliado`} tono="ambar"/>
      <Kpi label="Base recaudada" valor={`Bs ${bs(baseBs)}`} pie={`Residencial: Bs ${bs(res.reduce((a,s)=>a+Number(s.base||0),0))} · Comercial: Bs ${bs(com.reduce((a,s)=>a+Number(s.base||0),0))}`} tono="azul"/>
      <Kpi label="IVA recaudado" valor={`Bs ${bs(ivaBs)}`} pie={`${res.length} residenciales a IVA 0% · ${com.length + inst.length} solicitudes gravadas según tratamiento`} tono={ivaBs>0?"verde":"gris"}/>
      <Kpi label="GLP comprometido" valor={`${num(kg)} kg`} pie={`${num(kgALitros(kg))} L aún físicamente en CDT`} tono="gris"/>
      <Kpi label="Más de 30 días" valor={mayores30} pie="prioridad de programación" tono={mayores30?"rojo":"verde"}/>
    </div>
    <div className="inv-regla"><Clock3 size={17}/><div><b>Recaudación reconocida sin salida física de GLP.</b><span>El pago conserva Base, IVA y Total de la solicitud en su fecha original. El inventario permanece físicamente en el CDT hasta la entrega; BOP, salida física y factura nacen del cierre real del AD.</span></div></div>
    <section className="card"><div className="card-h"><div><h2>Recaudación pendiente de despacho <span className="cnt">{lista.length}</span></h2><span className="card-note">Dinero cobrado + GLP comprometido, priorizado por antigüedad</span></div><div className="toolbar"><div className="search"><Search size={14}/><input placeholder="Buscar persona, comuna, solicitud o AD" value={q} onChange={(e)=>setQ(e.target.value)}/></div><div className="tabs">{[["TODOS","Todos"],["30","30+ días"],["15","15–29"],["MENOS","<15 días"]].map(([v,l])=><button key={v} className={edad===v?"on":""} onClick={()=>setEdad(v)}>{l}</button>)}</div><button className="btn sm" onClick={onExport}><Download size={14}/> Exportar</button></div></div>
      <div className="scroll"><table className="tbl"><thead><tr><th>Pago</th><th>Espera</th><th>Persona</th><th>Comuna</th><th>Producto / uso</th><th>Fiscal</th><th className="r">Cant.</th><th className="r">Kg</th><th className="r">Litros</th><th className="r">Base Bs</th><th className="r">IVA Bs</th><th className="r">Total Bs</th><th>Estatus</th><th>AD</th></tr></thead><tbody>{lista.map((s)=><tr key={s.id}><td><div className="mono strong">{fechaCorta(s.pago?.fecha||s.fecha)}</div><div className="u-doc">{s.pago?.referencia}</div></td><td><span className={`age ${s.dias>=30?"late":s.dias>=15?"mid":""}`}>{s.dias} días</span></td><td><div className="u-name">{usr(s.usuario).nombre}</div><div className="u-doc">{usr(s.usuario).doc} · {s.id}</div></td><td className="c-name">{comunaOf(s.comuna).nombre}</td><td><div className="u-name sm">{cpt(s.concepto).corto}</div><div className="u-doc">{segmentoUsuario(s.usuario).toLowerCase()}</div></td><td><span className={`tag ${s.exento?"alt":""}`}>{s.exento?"IVA 0%":"IVA 16%"}</span></td><td className="r mono">{num(s.cantidad)}</td><td className="r mono strong">{num(kgDeSolicitud(s))}</td><td className="r mono">{num(kgALitros(kgDeSolicitud(s)))}</td><td className="r mono">{bs(s.base)}</td><td className="r mono strong">{bs(s.iva)}</td><td className="r mono strong">{bs(s.total)}</td><td><EstadoChip estado={s.estado}/></td><td className="mono">{s.ad||"Por asignar"}</td></tr>)}</tbody><tfoot><tr className="tot"><td colSpan="6"><b>Total visible</b></td><td className="r mono">{num(lista.reduce((a,s)=>a+Number(s.cantidad||0),0))}</td><td className="r mono">{num(lista.reduce((a,s)=>a+kgDeSolicitud(s),0))}</td><td className="r mono">{num(kgALitros(lista.reduce((a,s)=>a+kgDeSolicitud(s),0)))}</td><td className="r mono">{bs(lista.reduce((a,s)=>a+Number(s.base||0),0))}</td><td className="r mono">{bs(lista.reduce((a,s)=>a+Number(s.iva||0),0))}</td><td className="r mono strong">{bs(lista.reduce((a,s)=>a+Number(s.total||0),0))}</td><td colSpan="2"></td></tr></tfoot></table></div>
    </section>
  </>;
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
                <td className="r mono">{b.kg > 0 ? `${num(b.kg)} kg` : <span className="muted">sin inventario</span>}</td>
                <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "boleta", data: b })}><Eye size={13} /> Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ═══════════  FACTURACIÓN  ═══════════ */

function VistaFacturas({ facturas, setDoc, setModal, onExport }) {
  const [q, setQ] = useState("");
  const auto = facturas.filter((f) => f.origen === "AUTOMATICA");
  const man = facturas.filter((f) => f.origen === "MANUAL");
  const tA = auto.reduce((s, f) => s + f.total, 0), tM = man.reduce((s, f) => s + f.total, 0);
  const lista = facturas.filter((f) => !q || (f.serie || "").toLowerCase().includes(q.toLowerCase())
    || usr(f.usuario).nombre.toLowerCase().includes(q.toLowerCase()) || (f.control || "").includes(q));

  return (
    <>
      <div className="split">
        <div className="split-box"><div className="split-l">Facturación automática</div><div className="split-v">Bs {bs(tA)}</div><div className="split-p">{auto.length} documentos nacidos del cierre de AD</div></div>
        <div className="split-box"><div className="split-l">Facturación manual por CDT</div><div className="split-v">Bs {bs(tM)}</div><div className="split-p">{man.length} documentos de talonario integrados</div></div>
        <div className="split-box total"><div className="split-l">Total consolidado</div><div className="split-v">Bs {bs(tA + tM)}</div><div className="split-p">Base del cierre mensual de ingresos</div></div>
      </div>
      <section className="card">
        <div className="card-h">
          <h2>Facturas del período <span className="cnt">{lista.length}</span></h2>
          <div className="toolbar">
            <div className="search"><Search size={14} /><input placeholder="Buscar serie, control o usuario" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <button className="btn sm" onClick={() => setModal("manual")}><Plus size={14} /> Factura manual</button>
            <button className="btn sm" onClick={onExport}><Download size={14} /> Libro de ventas</button>
          </div>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Serie</th><th>Nro. control</th><th>Origen</th><th>Fecha</th><th>Usuario</th><th>Contrato</th><th>Concepto</th><th className="r">Base</th><th className="r">IVA</th><th className="r">Total Bs</th><th></th></tr></thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id}>
                  <td className="mono strong">{f.serie}</td>
                  <td className="mono muted">{f.control}</td>
                  <td>{f.origen === "AUTOMATICA" ? <span className="tag">Automática</span> : <span className="tag warn">Manual</span>}</td>
                  <td className="muted">{fechaCorta(f.fecha)}</td>
                  <td className="u-name sm">{usr(f.usuario).nombre}</td>
                  <td className="mono muted">{usr(f.usuario).contrato}</td>
                  <td className="c-name">{cpt(f.concepto).nombre}</td>
                  <td className="r mono">{bs(f.exento ? 0 : f.base)}</td>
                  <td className="r mono">{f.exento ? <span className="muted">exento</span> : bs(f.iva)}</td>
                  <td className="r mono strong">{bs(f.total)}</td>
                  <td className="r"><button className="btn sm" onClick={() => setDoc({ tipo: "factura", data: f })}><Eye size={13} /> Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <section className="card">
        <div className="card-h"><div><h2>Disponibilidad real por CDT</h2><span className="card-note">1 litro de GLP = 0,540 kg</span></div><button className="btn sm" onClick={onExport}><Download size={14}/> Exportar</button></div>
        <div className="scroll"><table className="tbl"><thead><tr><th>CDT</th><th className="r">Físico kg</th><th className="r">Físico L</th><th className="r">Comprometido kg</th><th className="r">Comprometido L</th><th className="r">Disponible kg</th><th className="r">Disponible L</th><th>Capacidad física</th></tr></thead><tbody>
          {lista.map((c)=>{const pct=(existencias[c.id]/c.capacidad)*100;return <tr key={c.id}><td><div className="u-name">{c.nombre}</div></td><td className="r mono strong">{num(existencias[c.id])}</td><td className="r mono">{num(kgALitros(existencias[c.id]))}</td><td className="r mono warn-num">{num(compromisos[c.id]||0)}</td><td className="r mono warn-num">{num(kgALitros(compromisos[c.id]||0))}</td><td className="r mono ok-num">{num(disponibles[c.id]||0)}</td><td className="r mono ok-num">{num(kgALitros(disponibles[c.id]||0))}</td><td><div className="mini-cap"><span style={{width:`${Math.min(100,pct)}%`}}/><em>{Math.round(pct)}%</em></div></td></tr>})}
        </tbody></table></div>
      </section>
      <section className="card">
        <div className="card-h">
          <h2>Salidas físicas generadas por BOP <span className="cnt">{movs.length}</span></h2>
          <span className="card-note">No aparecen pagos pendientes aquí: todavía no han salido del CDT.</span>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Movimiento</th><th>Fecha</th><th>CDT</th><th>Comuna</th><th>Documento</th><th>Concepto</th><th>Tipo</th><th className="r">Kg</th><th className="r">Litros</th></tr></thead>
            <tbody>{movs.slice(0,60).map((m)=><tr key={m.id}><td className="mono muted">{m.id}</td><td className="muted">{fechaCorta(m.fecha)}</td><td>{cdtOf(m.cdt).corto}</td><td className="c-name">{comunaOf(m.comuna).nombre}</td><td className="mono strong">{m.doc}</td><td className="c-name">{cpt(m.concepto).nombre}</td><td><span className={`tag ${m.tipo === "SALIDA_MANUAL" ? "warn" : "alt"}`}>{m.tipo === "SALIDA_MANUAL" ? "Salida manual CDT" : "Salida por BOP"}</span></td><td className="r mono neg">{num(m.kg)}</td><td className="r mono neg">−{num(kgALitros(Math.abs(m.kg)))}</td></tr>)}</tbody>
          </table>
        </div>
        {movs.length>60&&<div className="mas">Mostrando 60 de {movs.length} movimientos · exporta para el detalle completo</div>}
      </section>
    </>
  );
}


/* ═══════════  DESPACHOS ESPECIALES  ═══════════ */

function VistaDespachos({ sols, setDoc, boletas, onExport }) {
  const lista = sols.filter((s) => s.tipoDespacho !== "COMERCIAL");
  return (
    <>
      <div className="kpis">
        {TIPOS_DESPACHO.filter((t) => t.id !== "COMERCIAL").map((t) => {
          const l = lista.filter((s) => s.tipoDespacho === t.id);
          return <Kpi key={t.id} label={t.nombre} valor={`${num(l.reduce((s, x) => s + cpt(x.concepto).kg * x.cantidad, 0))} kg`} pie={`${l.length} despachos`} tono="gris" />;
        })}
      </div>
      <section className="card">
        <div className="card-h">
          <h2>Despachos automatizados por apoyos, exonerados, institucionales y programa social <span className="cnt">{lista.length}</span></h2>
          <div className="toolbar">
            <span className="card-note">Todos siguen AD → boleta automática → inventario; la factura se genera al cierre cuando el tipo lo requiere.</span>
            <button className="btn sm" onClick={onExport}><Download size={14} /> Exportar</button>
          </div>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>Solicitud</th><th>AD</th><th>Fecha</th><th>Tipo</th><th>Beneficiario</th><th>CDT</th><th>Concepto</th><th className="r">Cant.</th><th className="r">GLP</th><th>Boleta</th><th>Estatus</th></tr></thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td className="mono strong">{s.id}</td>
                  <td className="mono muted">{s.ad || "—"}</td>
                  <td className="muted">{fechaCorta(s.fecha)}</td>
                  <td><span className="tag alt">{tpd(s.tipoDespacho).nombre}</span></td>
                  <td><div className="u-name">{usr(s.usuario).nombre}</div><div className="u-doc">{usr(s.usuario).doc}</div></td>
                  <td>{cdtOf(s.cdt).corto}</td>
                  <td className="c-name">{cpt(s.concepto).nombre}</td>
                  <td className="r mono">{num(s.cantidad)}</td>
                  <td className="r mono">{cpt(s.concepto).kg ? `${num(cpt(s.concepto).kg * s.cantidad)} kg` : "—"}</td>
                  <td className="mono">{s.boleta ? <button className="link" onClick={() => setDoc({ tipo: "boleta", data: boletas.find((b) => b.id === s.boleta) })}>{s.boleta}</button> : <span className="muted">pendiente</span>}</td>
                  <td><EstadoChip estado={s.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/* ═══════════  EPSDC · RESUMEN DE VENTA TRANSPORTADA  ═══════════ */

function VistaEPSDC({ sols, onExport }) {
  const lista = sols.filter((s) => s.transportistaTipo === "EPSDC" && s.boleta);
  const venta = lista.reduce((a,s) => a + s.total, 0);
  const servicio = venta * 0.30;
  const kg = lista.reduce((a,s) => a + cpt(s.concepto).kg * s.cantidad, 0);
  return (
    <>
      <div className="kpis">
        <Kpi label="Venta transportada EPSDC" valor={`Bs ${bs(venta)}`} pie={`${lista.length} AD cerradas`} tono="verde" />
        <Kpi label="Servicio EPSDC · 30%" valor={`Bs ${bs(servicio)}`} pie="soporte para pago del tercero" tono="ambar" />
        <Kpi label="GLP transportado" valor={`${num(kg)} kg`} pie={`${num(kgALitros(kg))} L`} tono="gris" />
      </div>
      <section className="card">
        <div className="card-h">
          <div><h2>Resumen de la venta transportada por EPSDC</h2>
            <span className="card-note">Control generado desde los AD cerrados por un usuario de despacho tipo EPSDC. No se carga manualmente.</span></div>
          <button className="btn sm" onClick={onExport}><Download size={14}/> Descargar soporte 30%</button>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>AD</th><th>Fecha</th><th>EPSDC</th><th>Operador / unidad</th><th>Comuna</th><th>Usuario</th><th>Tipo</th><th className="r">GLP kg</th><th className="r">Venta Bs</th><th className="r">30% Bs</th><th>Soporte</th></tr></thead>
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

function VistaUsuarios({ solicitudes, facturas, reclamos, setModal }) {
  const [q, setQ] = useState("");
  const [codigosComuna, setCodigosComuna] = useState(Object.fromEntries(COMUNAS.map((c) => [c.id, c.codigo])));
  const lista = USUARIOS.filter((u) => !q || u.nombre.toLowerCase().includes(q.toLowerCase()) || u.doc.includes(q) || u.contrato.includes(q) || u.id.includes(q) || comunaOf(u.comuna).nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
    <div className="kpis">
      <Kpi label="Usuarios en base" valor={USUARIOS.length} pie="todos asociados a una comuna" tono="verde" />
      <Kpi label="Comunas / comunidades" valor={COMUNAS.length} pie="centros comunales de distribución" tono="gris" />
      <Kpi label="Sin código legado" valor={COMUNAS.filter((c) => !codigosComuna[c.id]).length} pie="registradas y pendientes de normalizar" tono="ambar" />
    </div>
    <section className="card">
      <div className="card-h">
        <div><h2>Base de datos de usuarios <span className="cnt">{lista.length}</span></h2><span className="card-note">Cada usuario pertenece obligatoriamente a una comuna y ésta a un CDT.</span></div>
        <div className="search"><Search size={14} /><input placeholder="Buscar nombre, código, contrato o comuna" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Código</th><th>Nombre o razón social</th><th>Rif / CI</th><th>Contrato</th><th>Tipo de contrato</th><th>Comuna</th><th>CDT</th><th className="r">Solicitudes</th><th className="r">Reclamos</th><th className="r">Facturado Bs</th><th>Estatus</th><th></th></tr></thead>
          <tbody>
            {lista.map((u) => {
              const ss = solicitudes.filter((s) => s.usuario === u.id);
              const fs = facturas.filter((f) => f.usuario === u.id);
              const rs = reclamos.filter((r) => r.usuario === u.id);
              const abierta = ss.find((s) => s.estado !== "CULMINADO");
              const est = abierta ? abierta.estado : ss[0] ? ss[0].estado : null;
              return (
                <tr key={u.id} className={u.portal ? "portal" : ""}>
                  <td className="mono muted">{u.id}{u.portal && <span className="pin" title="Usuario con portal activo">●</span>}</td>
                  <td><div className="u-name">{u.nombre}</div><div className="u-doc">{u.dir}</div></td>
                  <td className="mono">{u.doc}</td>
                  <td className="mono strong">{u.contrato}</td>
                  <td className="c-name">{u.tipoContrato}</td>
                  <td><div className="u-name sm">{comunaOf(u.comuna).nombre}</div><div className="u-doc">{comunaOf(u.comuna).sector}</div></td>
                  <td>{cdtOf(u.cdt).corto}</td>
                  <td className="r mono">{ss.length}</td>
                  <td className="r mono">{rs.length ? rs.length : <span className="muted">0</span>}</td>
                  <td className="r mono strong">{bs(fs.reduce((s, f) => s + f.total, 0))}</td>
                  <td>{est ? <EstadoChip estado={est} /> : <span className="muted">sin actividad</span>}</td>
                  <td className="r"><button className="btn sm" onClick={() => setModal({ tipo: "ficha", u })}>Ver ficha</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
    <section className="card">
      <div className="card-h"><div><h2>Registro de comunas y comunidades</h2><span className="card-note">Las comunidades heredadas sin código pueden registrarse primero y normalizarse sin perder sus datos.</span></div></div>
      <div className="scroll">
        <table className="tbl">
          <thead><tr><th>Código</th><th>Comuna / comunidad</th><th>CDT</th><th>Sector</th><th>Responsable</th><th className="r">Usuarios</th><th>Estatus</th><th></th></tr></thead>
          <tbody>{COMUNAS.map((c) => {
            const codigo = codigosComuna[c.id];
            const miembros = USUARIOS.filter((u) => u.comuna === c.id).length;
            return <tr key={c.id}>
              <td className="mono strong">{codigo || <span className="muted">SIN CÓDIGO</span>}</td>
              <td><div className="u-name">{c.nombre}</div><div className="u-doc">{c.punto}</div></td>
              <td>{cdtOf(c.cdt).corto}</td><td>{c.sector}</td><td>{c.coordinador}</td><td className="r mono">{miembros}</td>
              <td>{codigo ? <span className="pago-ok"><Check size={11}/> Registrada</span> : <span className="tag alt">Registrada · por codificar</span>}</td>
              <td className="r">{!codigo && <button className="btn sm primary" onClick={() => setCodigosComuna((m) => ({...m, [c.id]: `COM-${c.cdt.replace("CDT-","")}-05`}))}>Generar código</button>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    </>
  );
}

function FichaUsuario({ u, solicitudes, facturas, reclamos, onClose, setDoc }) {
  const ss = solicitudes.filter((s) => s.usuario === u.id);
  const fs = facturas.filter((f) => f.usuario === u.id);
  const rs = reclamos.filter((r) => r.usuario === u.id);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <div>
            <div className="mh-eyebrow">Ficha de usuario {u.portal ? "· portal activo" : ""}</div>
            <h3>{u.nombre}</h3>
            <div className="ficha-sub">{u.doc} · Contrato {u.contrato} · {u.tipoContrato} · {comunaOf(u.comuna).nombre} · {cdtOf(u.cdt).nombre}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-b">
          <div className="ficha-kpis">
            <div><span>Dirección</span><b>{u.dir}</b></div>
            <div><span>Comuna</span><b>{comunaOf(u.comuna).nombre}</b></div>
            <div><span>Solicitudes</span><b>{ss.length}</b></div>
            <div><span>Facturado</span><b>Bs {bs(fs.reduce((s, f) => s + f.total, 0))}</b></div>
            <div><span>Reclamos</span><b>{rs.length}</b></div>
          </div>

          <div className="ficha-tit">Historial de solicitudes</div>
          <div className="scroll max">
            <table className="tbl compact">
              <thead><tr><th>Solicitud</th><th>AD</th><th>Fecha</th><th>Concepto</th><th className="r">Cant.</th><th>Boleta</th><th>Factura</th><th>Estatus</th></tr></thead>
              <tbody>
                {ss.map((s) => {
                  const fac = facturas.find((f) => f.sol === s.id);
                  return (
                    <tr key={s.id}>
                      <td className="mono strong">{s.id}</td>
                      <td className="mono muted">{s.ad || "—"}</td>
                      <td className="muted">{fechaCorta(s.fecha)}</td>
                      <td className="c-name">{cpt(s.concepto).nombre}</td>
                      <td className="r mono">{num(s.cantidad)}</td>
                      <td className="mono muted">{s.boleta || "—"}</td>
                      <td className="mono">{fac ? <button className="link" onClick={() => { onClose(); setDoc({ tipo: "factura", data: fac }); }}>{s.serie}</button> : "—"}</td>
                      <td><EstadoChip estado={s.estado} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rs.length > 0 && <>
            <div className="ficha-tit">Reclamos</div>
            <div className="scroll max">
              <table className="tbl compact">
                <thead><tr><th>Reclamo</th><th>Fecha</th><th>Tipo</th><th>Asunto</th><th>Estatus</th></tr></thead>
                <tbody>
                  {rs.map((r) => (
                    <tr key={r.id}>
                      <td className="mono strong">{r.id}</td>
                      <td className="muted">{fechaCorta(r.fecha)}</td>
                      <td className="c-name">{r.tipo}</td>
                      <td className="c-name">{r.asunto}</td>
                      <td><span className={`chip ${EST_REC[r.estado][1]}`}>{EST_REC[r.estado][0]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>}
        </div>
        <div className="modal-f"><button className="btn" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

/* ═══════════  CIERRE MENSUAL  ═══════════ */

function VistaCierre({ facV, solV, existencias, compromisos, disponibles, periodoCerrado, setPeriodoCerrado, onExport, setDoc, cdtF }) {
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
        <div className="split-box"><div className="split-l">GLP físico vs comprometido</div><div className="split-v">{num(fisico)} kg <span className="split-sep">/</span> {num(comprometido)} kg</div><div className="split-p">Disponible real {num(disponible)} kg · {num(kgALitros(disponible))} L</div></div>
        <div className="split-box"><div className="split-l">Salida real del período</div><div className="split-v">{num(t.kgDespachado)} kg</div><div className="split-p">{num(kgALitros(t.kgDespachado))} L físicamente despachados</div></div>
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
          <div><span>Inventario físico al cierre</span><b>{num(fisico)} kg · {num(kgALitros(fisico))} L</b></div>
          <div><span>GLP comprometido pendiente</span><b>{num(comprometido)} kg · {num(kgALitros(comprometido))} L</b></div>
          <div><span>Disponible real</span><b>{num(disponible)} kg · {num(kgALitros(disponible))} L</b></div>
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
.rec-meta{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;background:#F5F7F9;border-radius:10px;padding:13px 15px}
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
`}</style>
  );
}
