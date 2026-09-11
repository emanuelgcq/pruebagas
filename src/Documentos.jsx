import React from "react";
import { X, Download, Printer } from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, IVA, CDTS, GRUPOS,
  cpt, usr, tpd, cdtOf, banco, bs, bs3, num, fecha, fechaGuion, PERIODO, HOY,
  descargar, csv, kgALitros, resumenCierreMensual,
} from "./datos.jsx";
import { kgYL } from "./Unidades.jsx";

/* ═══════════════════  ORIGEN, CLIENTE Y PRECIO DE UNA FACTURA  ═══════════════════
   Una factura nace por cuatro vías y cada una lo dice en su pie: el cierre del AD, un
   servicio culminado en la O.A.U., el talonario manual del CDT o una venta sin contrato.
   Decir "emitida al cierre del AD" en una factura de talonario sería falso. */

export function origenFactura(f = {}) {
  switch (f.origen) {
    case "SERVICIO":
      return { corto: "Servicio O.A.U.", traza: `Solicitud ${f.sol || "—"} · servicio prestado en la O.A.U.`,
        nota: `Emitida por ${EMPRESA.sistema} al culminar el servicio en la O.A.U.` };
    case "MANUAL":
      return { corto: `Talonario ${f.talonario || f.control || ""}`.trim(), traza: `Facturación manual de talonario ${f.talonario || f.control || ""}`.trim(),
        nota: "Factura de talonario registrada en el CDT." };
    case "SIN_CONTRATO":
      return { corto: "Venta sin contrato", traza: `Venta sin contrato · código ${f.codigoGenerico || f.usuario || "—"}`,
        nota: `Venta sin contrato atendida en ${f.canal === "PLANTA_MOVIL" ? "la planta móvil" : "el CDT"}, contra un código genérico.` };
    default:
      return { corto: f.ad ? `Cierre del AD ${f.ad}` : "Cierre del AD", traza: `Solicitud ${f.sol || "—"} · atención de distribución ${f.ad || "—"}`,
        nota: `Emitida por ${EMPRESA.sistema} al cierre del AD${f.ad ? ` ${f.ad}` : ""}, cuando la bombona volvió llena al punto.` };
  }
}

/** A quién se factura. La venta sin contrato va contra un código genérico: el nombre y el
 *  documento son los del comprador que se identificó en el acto, si los dio. */
export function clienteFactura(f = {}) {
  const u = usr(f.usuario);
  if (f.origen !== "SIN_CONTRATO") return { nombre: u.nombre, doc: u.rifFactura, u };
  const nombre = f.compradorNombre && f.compradorNombre !== "No identificado" ? f.compradorNombre : null;
  const doc = f.compradorDoc && f.compradorDoc !== "—" ? f.compradorDoc : null;
  return { nombre: nombre || u.nombre, doc: doc || u.rifFactura, u };
}

/* El precio unitario es el que quedó en la factura —el del día de salida del AD o el del día
   del servicio—, no el del catálogo de hoy: los precios cambian cada mes. */
const precioDeFactura = (f) => (f.precioUnitario != null ? Number(f.precioUnitario)
  : Number(f.cantidad) ? Number(f.base || 0) / Number(f.cantidad) : 0);

/* La boleta también dice de dónde salió: del cierre de un AD, de un servicio o de una venta
   sin contrato. Sólo la primera y la última mueven GLP. */
export const origenBoleta = (b = {}) => {
  if (b.origen === "SERVICIO") {
    return { corto: "Servicio O.A.U.", cab: "SERVICIO O.A.U.",
      nota: "Esta boleta se generó al culminar el servicio en la O.A.U. Un servicio no mueve inventario de GLP.",
      firmas: ["Atendido por", "Supervisor de O.A.U.", "Recibido conforme · Usuario"] };
  }
  if (b.origen === "SIN_CONTRATO") {
    return { corto: "Venta sin contrato", cab: "VENTA SIN CONTRATO",
      nota: "Venta sin contrato atendida en el CDT. La salida de inventario GLP quedó registrada en el mismo acto.",
      firmas: ["Despachador del CDT", "Supervisor de CDT", "Recibido conforme · Comprador"] };
  }
  return { corto: b.ad ? `Cierre del AD ${b.ad}` : "Cierre del AD", cab: `AD DE ORIGEN ${b.ad || "—"}`,
    nota: `Esta boleta se generó con el cierre del AD${b.ad ? ` ${b.ad}` : ""}, cuando la bombona volvió llena al punto. La salida de inventario GLP quedó registrada en el mismo acto, sin una operación manual aparte.`,
    firmas: ["Conductor de la unidad", "Supervisor de CDT", "Recibido en el punto"] };
};

/* ═══════════════════  ARCHIVO CSV DE CADA DOCUMENTO  ═══════════════════
   El botón "Descargar" del visor y el CSV del Centro de reportes salen de aquí: la hoja
   impresa y el archivo se arman con los mismos datos y no pueden contar cosas distintas. */

const n2 = (v) => Number(v || 0).toFixed(2);
const MES_PERIODO = String(PERIODO.mes + 1).padStart(2, "0");

export function archivoDocumento(doc, contexto = {}) {
  if (doc.tipo === "factura") {
    const f = doc.data, c = cpt(f.concepto), cli = clienteFactura(f);
    return { nombre: `${f.serie}.csv`, contenido: csv([
      [EMPRESA.nombre], ["Rif", EMPRESA.rif], ["FORMA LIBRE"],
      ["Nro. Control", f.control], ["Factura Serie", f.serie], ["Fecha Emision", fechaGuion(f.fecha)], [],
      ["Nombre o Razon Social", cli.nombre], ["Direccion", cli.u.dir], ["Rif", cli.doc],
      ["Telefonos", cli.u.tel], ["Contrato", cli.u.contrato], ["Tipo de Contrato", cli.u.tipoContrato],
      ["Pedido Nro", f.pedidoNro ? `P${f.pedidoNro}` : f.talonario], [],
      ["Cantidad", "Descripcion", "Precio/Unitario", "Total Bs."],
      [f.cantidad, c.nombre, precioDeFactura(f).toFixed(3), n2(f.base)], [],
      ["Total Base Imponible Bs.", n2(f.exento ? 0 : f.base)],
      ["Total Exento", n2(f.exento ? f.base : 0)],
      ["Subtotal Neto Bs.", n2(f.base)],
      ["I.V.A % sobre Base", n2(f.iva)],
      ["Total a Pagar Bs.", n2(f.total)], [],
      ["Origen", origenFactura(f).corto], ["Solicitud", f.sol || ""], ["AD de origen", f.ad || ""],
      ["Banco", f.pago?.banco ? banco(f.pago.banco).nombre : ""], ["Referencia", f.pago?.referencia || ""],
    ]) };
  }
  if (doc.tipo === "boleta") {
    const b = doc.data, u = usr(b.usuario);
    return { nombre: `${b.id}.csv`, contenido: csv([
      [EMPRESA.nombre], ["BOLETA DE OPERACION", b.id], ["Origen", origenBoleta(b).corto],
      ["AD de origen", b.ad || ""], ["Solicitud", b.sol || ""], ["Factura", b.factura || ""],
      ["Fecha", fecha(b.fecha)], ["CDT", cdtOf(b.cdt).nombre], ["Operador", b.operador || ""], [],
      ["Usuario", u.nombre], ["Contrato", u.contrato],
      ["Concepto", cpt(b.concepto).nombre], ["Cantidad", b.cantidad],
      ["Salida GLP kg", n2(b.kg)], ["Salida GLP L", n2(kgALitros(b.kg))], ["Tipo de despacho", tpd(b.tipoDespacho).nombre],
    ]) };
  }
  if (doc.tipo === "reporte") {
    const r = doc.data;
    // El kilo nunca viaja solo: una columna en kg se exporta como dos, kg y L.
    const cab = r.columnas.flatMap((c) => (c.tipo === "kg" ? [`${c.t} kg`, `${c.t} L`] : [c.t]));
    const celda = (c, v) => {
      if (c.tipo === "kg") return typeof v === "number" ? [n2(v), n2(kgALitros(v))] : [v ?? "", ""];
      if (c.tipo === "bs") return [typeof v === "number" ? n2(v) : v ?? ""];
      // Una celda de fecha puede traer un rótulo ("TOTALES"): sólo se formatea si es fecha.
      if (c.tipo === "fecha") return [v instanceof Date ? fecha(v) : v ?? ""];
      return [v ?? ""];
    };
    const fila = (f) => r.columnas.flatMap((c, i) => celda(c, f[i]));
    return { nombre: `${r.archivo || r.codigo}.csv`, contenido: csv([
      [r.titulo], [EMPRESA.nombre, EMPRESA.rif], ...(r.subtitulo ? [[r.subtitulo]] : []),
      ["Código", r.codigo, "Emitido", fecha(HOY)], [],
      ...(r.resumen?.length ? [...r.resumen.map((x) => [x.l, x.v, x.s || ""]), []] : []),
      cab, ...r.filas.map(fila), ...(r.totales ? [fila(r.totales)] : []),
      ...(r.nota ? [[], [r.nota]] : []),
    ]) };
  }
  const { facturas = [], solicitudes = [], existencias = {}, compromisos = {}, disponibles = {}, cdtF = "TODOS", alcance = "Consolidado" } = contexto;
  const cierre = resumenCierreMensual(facturas, solicitudes), t = cierre.totales;
  const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  const fisico = cdtsAlcance.reduce((a, c) => a + Number(existencias[c.id] || 0), 0);
  const comprometido = cdtsAlcance.reduce((a, c) => a + Number(compromisos[c.id] || 0), 0);
  const disponible = cdtsAlcance.reduce((a, c) => a + Number(disponibles[c.id] || 0), 0);
  return { nombre: `acta-cierre-${PERIODO.anio}-${MES_PERIODO}.csv`, contenido: csv([
    ["ACTA DE CIERRE MENSUAL DE COMERCIALIZACIÓN"], [EMPRESA.nombre, EMPRESA.rif], [PERIODO.label], ["Alcance", alcance], [],
    ["CUADRE GENERAL"],
    ["Facturado por entregas reales Bs", t.totalEntregado.toFixed(2), "Base Bs", t.baseEntregada.toFixed(2), "IVA Bs", t.ivaEntregado.toFixed(2)],
    ["Pendiente por despachar Bs", t.totalPendiente.toFixed(2), "Base pendiente Bs", t.basePendiente.toFixed(2), "IVA pendiente Bs", t.ivaPendiente.toFixed(2)],
    ["Inventario físico al cierre kg", fisico.toFixed(2), "Comprometido kg", comprometido.toFixed(2), "Disponible real kg", disponible.toFixed(2)],
    ["Inventario físico al cierre L", kgALitros(fisico).toFixed(2), "Comprometido L", kgALitros(comprometido).toFixed(2), "Disponible real L", kgALitros(disponible).toFixed(2)], [],
    ["Concepto de ingreso", "Docs. entregados/facturados", "Cant. facturada", "Base entregada Bs", "IVA entregado Bs", "Total entregado Bs",
     "Solicitudes pendientes por despachar", "Cant. pendiente", "Base pendiente Bs", "IVA pendiente Bs", "Total pendiente por despachar Bs",
     "GLP despachado kg", "GLP despachado L", "GLP comprometido kg", "GLP comprometido L"],
    ...GRUPOS.flatMap((g) => [[g.toUpperCase()], ...cierre.filas.filter((r) => r.grupo === g).map((r) => [
      r.nombre, r.docsEntregados, r.cantidadEntregada, r.baseEntregada.toFixed(2), r.ivaEntregado.toFixed(2), r.totalEntregado.toFixed(2),
      r.docsPendientes, r.cantidadPendiente, r.basePendiente.toFixed(2), r.ivaPendiente.toFixed(2), r.totalPendiente.toFixed(2),
      r.kgDespachado.toFixed(2), kgALitros(r.kgDespachado).toFixed(2), r.kgComprometido.toFixed(2), kgALitros(r.kgComprometido).toFixed(2),
    ])]),
    ["TOTALES", t.docsEntregados, t.cantidadEntregada, t.baseEntregada.toFixed(2), t.ivaEntregado.toFixed(2), t.totalEntregado.toFixed(2),
     t.docsPendientes, t.cantidadPendiente, t.basePendiente.toFixed(2), t.ivaPendiente.toFixed(2), t.totalPendiente.toFixed(2),
     t.kgDespachado.toFixed(2), kgALitros(t.kgDespachado).toFixed(2), t.kgComprometido.toFixed(2), kgALitros(t.kgComprometido).toFixed(2)],
  ]) };
}

/* ═══════════════════  VISOR  ═══════════════════ */

export function VisorDocumento({ doc, onClose, contexto = {} }) {
  const bajar = () => {
    const a = archivoDocumento(doc, contexto);
    descargar(a.nombre, a.contenido);
  };
  const ancho = doc.tipo === "acta" || (doc.tipo === "reporte" && Boolean(doc.data?.horizontal));

  return (
    <div className="gdoc-overlay" onClick={onClose}>
      <DocEstilos landscape={ancho} />
      <div className={`gdoc-wrap ${ancho ? "acta-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="gdoc-actions">
          <button className="gdoc-btn" onClick={onClose}><X size={14} /> Cerrar</button>
          <div style={{ flex: 1 }} />
          <button className="gdoc-btn" onClick={bajar}><Download size={14} /> Descargar</button>
          <button className="gdoc-btn pri" onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
        </div>
        <div className="gdoc-hoja">
          {doc.tipo === "factura" && <FacturaDoc f={doc.data} />}
          {doc.tipo === "boleta" && <BoletaDoc b={doc.data} />}
          {doc.tipo === "acta" && <ActaDoc {...contexto} />}
          {doc.tipo === "reporte" && <ReporteDoc r={doc.data} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════  FACTURA — formato GasLara  ═══════════════════ */

export function FacturaDoc({ f }) {
  const c = cpt(f.concepto);
  const cli = clienteFactura(f);
  const u = cli.u;
  const origen = origenFactura(f);
  const gravable = f.exento ? 0 : f.base;
  const exento = f.exento ? f.base : 0;
  // La API verifica el pago y aplica la regla, llegue por el portal o por la taquilla.
  const porApi = Boolean(f.pago?.regla || f.pago?.auto);

  return (
    <div className="fac">
      <div className="fac-top">
        <div>
          <img src={LOGO_GASLARA} alt="GasLara" className="fac-logo" />
          <div className="fac-rif">Rif: {EMPRESA.rif}</div>
        </div>
      </div>

      <div className="fac-cab">
        <div className="fac-dom">
          {EMPRESA.domicilio.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="fac-forma">FORMA LIBRE</div>
        <div className="fac-nros">
          <div>NRO.  CONTROL  {f.control}</div>
          <div className="mt">FACTURA SERIE {f.serie}</div>
          <div>FECHA EMISION: {fechaGuion(f.fecha)}</div>
        </div>
      </div>

      <table className="fac-cli">
        <tbody>
          <tr>
            <td className="lbl">Nombre o Razón Social:</td>
            <td className="val nom" colSpan={7}>{cli.nombre}</td>
          </tr>
          <tr>
            <td className="lbl">Dirección:</td>
            <td className="val dir" colSpan={7}>{u.dir}</td>
          </tr>
          <tr>
            <td className="lbl">Rif:</td>
            <td className="val">{cli.doc}</td>
            <td className="lbl">Teléfonos:</td>
            <td className="val">{u.tel}</td>
            <td className="lbl">Contrato:</td>
            <td className="val">{u.contrato}</td>
            <td className="lbl">Tipo de Contrato:</td>
            <td className="val">{u.tipoContrato}</td>
          </tr>
        </tbody>
      </table>

      <table className="fac-ped">
        <tbody><tr>
          <td className="lbl">Pedido Nro:</td>
          <td className="val">{f.pedidoNro ? `P${f.pedidoNro}` : f.talonario}</td>
        </tr></tbody>
      </table>

      <table className="fac-items">
        <thead>
          <tr>
            <th className="w-cant">Cantidad</th>
            <th>Descripción</th>
            <th className="w-pre">Precio/Unitario</th>
            <th className="w-tot">Total Bs.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="c">{num(f.cantidad)}</td>
            <td className="desc">{c.nombre}</td>
            <td className="r">{bs3(precioDeFactura(f))}</td>
            <td className="r">{bs(f.base)}</td>
          </tr>
          <tr className="vacia"><td /><td /><td /><td /></tr>
          <tr className="vacia"><td /><td /><td /><td /></tr>
        </tbody>
      </table>

      <table className="fac-tot">
        <tbody>
          <tr><td className="lbl">Total Base Imponible Bs.</td><td className="val">{bs(gravable)}</td></tr>
          <tr><td className="lbl">Total Exento</td><td className="val">{bs(exento)}</td></tr>
          <tr><td className="lbl">Subtotal Neto Bs.</td><td className="val">{bs(f.base)}</td></tr>
          <tr><td className="lbl">I.V.A {IVA * 100} % sobre Base {bs(gravable)} Bs.</td><td className="val">{bs(f.iva)}</td></tr>
          <tr className="grande"><td className="lbl">Total a Pagar Bs.</td><td className="val">{bs(f.total)}</td></tr>
        </tbody>
      </table>

      <div className="fac-pie">
        <div className="fac-trace">
          <b>Trazabilidad interna</b>
          <div>{origen.traza}</div>
          {f.pago?.banco && (
            <div>Pago anticipado verificado: {banco(f.pago.banco).nombre}, referencia {f.pago.referencia}
              {porApi ? " · verificado por la API" : ""}</div>
          )}
          <div>{origen.nota}</div>
        </div>
        <img src={LOGO_LARA} alt="Gobierno Bolivariano de Lara" className="fac-lara" />
      </div>
      <div className="fac-legal">Documento de demostración. Sin validez fiscal.</div>
    </div>
  );
}

/* ═══════════════════  BOLETA DE OPERACIÓN  ═══════════════════ */

export function BoletaDoc({ b }) {
  const c = cpt(b.concepto), u = usr(b.usuario), origen = origenBoleta(b);
  return (
    <div className="fac">
      <div className="fac-top">
        <div>
          <img src={LOGO_GASLARA} alt="GasLara" className="fac-logo" />
          <div className="fac-rif">Rif: {EMPRESA.rif}</div>
        </div>
        <div className="bop-tit">
          <div className="bop-tipo">Boleta de Operación</div>
          <div className="bop-num">{b.id}</div>
          <div className="bop-auto">Generada automáticamente</div>
        </div>
      </div>

      <div className="fac-cab">
        <div className="fac-dom">{EMPRESA.domicilio.map((l, i) => <div key={i}>{l}</div>)}</div>
        <div />
        <div className="fac-nros">
          <div>{origen.cab}</div>
          <div className="mt">{b.sol ? `SOLICITUD ${b.sol}` : b.factura ? `FACTURA ${b.factura}` : "—"}</div>
          <div>FECHA: {fechaGuion(b.fecha)}</div>
        </div>
      </div>

      <table className="fac-cli">
        <tbody>
          <tr><td className="lbl">Usuario:</td><td className="val nom" colSpan={5}>{u.nombre}</td></tr>
          <tr><td className="lbl">Dirección:</td><td className="val dir" colSpan={5}>{u.dir}</td></tr>
          <tr>
            <td className="lbl">Contrato:</td><td className="val">{u.contrato}</td>
            <td className="lbl">Centro:</td><td className="val">{cdtOf(b.cdt).nombre}</td>
            <td className="lbl">Operador:</td><td className="val">{b.operador || "—"}</td>
          </tr>
        </tbody>
      </table>

      <table className="fac-items">
        <thead><tr><th className="w-cant">Cantidad</th><th>Movimiento</th><th className="w-pre">Factor kg</th><th className="w-tot">Salida GLP</th></tr></thead>
        <tbody>
          <tr>
            <td className="c">{num(b.cantidad)}</td>
            <td className="desc">{c.nombre} — despacho {tpd(b.tipoDespacho).nombre.toLowerCase()}</td>
            <td className="r">{c.kg || "—"}</td>
            <td className="r">{b.kg ? kgYL(b.kg) : "sin inventario"}</td>
          </tr>
          <tr className="vacia"><td /><td /><td /><td /></tr>
        </tbody>
      </table>

      <div className="bop-nota">{origen.nota}</div>

      <div className="bop-firmas">
        {origen.firmas.map((x) => <div key={x}><div className="linea" />{x}</div>)}
      </div>

      <div className="fac-pie">
        <div className="fac-trace"><b>{EMPRESA.sistema}</b><div>Documento no editable.</div></div>
        <img src={LOGO_LARA} alt="Gobierno Bolivariano de Lara" className="fac-lara" />
      </div>
      <div className="fac-legal">Documento de demostración.</div>
    </div>
  );
}

/* ═══════════════════  ACTA DE CIERRE  ═══════════════════ */

export function ActaDoc({ facturas = [], solicitudes = [], alcance = "Consolidado", existencias = {}, compromisos = {}, disponibles = {}, cdtF = "TODOS", periodoCerrado = false }) {
  const cierre = resumenCierreMensual(facturas, solicitudes);
  const t = cierre.totales;
  const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
  const fisico = cdtsAlcance.reduce((a, c) => a + Number(existencias[c.id] || 0), 0);
  const comprometido = cdtsAlcance.reduce((a, c) => a + Number(compromisos[c.id] || 0), 0);
  const disponible = cdtsAlcance.reduce((a, c) => a + Number(disponibles[c.id] || 0), 0);

  return (
    <div className="fac acta-cierre">
      <div className="fac-top">
        <div>
          <img src={LOGO_GASLARA} alt="GasLara" className="fac-logo" />
          <div className="fac-rif">Rif: {EMPRESA.rif}</div>
        </div>
        <div className="bop-tit">
          <div className="bop-tipo">Acta de Cierre Mensual de Comercialización</div>
          <div className="bop-num">{PERIODO.label}</div>
          <div className="bop-auto">{alcance} · {periodoCerrado ? "PERÍODO CERRADO" : "PRELIMINAR"}</div>
        </div>
      </div>

      <div className="acta-resumen">
        <div><span>Entregado / facturado</span><b>Bs {bs(t.totalEntregado)}</b><small>Base {bs(t.baseEntregada)} · IVA {bs(t.ivaEntregado)}</small></div>
        <div><span>Pendiente por despachar</span><b>Bs {bs(t.totalPendiente)}</b><small>Base {bs(t.basePendiente)} · IVA {bs(t.ivaPendiente)}</small></div>
        <div><span>Inventario físico</span><b>{num(fisico)} kg</b><small>{num(kgALitros(fisico))} L</small></div>
        <div><span>Comprometido / disponible</span><b>{num(comprometido)} / {num(disponible)} kg</b><small>{num(kgALitros(comprometido))} / {num(kgALitros(disponible))} L</small></div>
      </div>

      <div className="acta-nota">
        Lo pendiente por despachar se presenta como saldo operativo y <b>no se suma a lo facturado</b>. El inventario físico sólo baja con el cierre del AD (BOP) o con una venta registrada en el CDT; el GLP pagado y todavía sin despachar sigue comprometido dentro del CDT.
      </div>

      <table className="fac-items acta-tabla">
        <thead>
          <tr>
            <th rowSpan={2}>Concepto</th>
            <th colSpan={5}>Entregado / facturado</th>
            <th colSpan={5}>Pendiente por despachar</th>
            <th colSpan={4}>Inventario GLP</th>
          </tr>
          <tr>
            <th>Docs.</th><th>Cant.</th><th>Base</th><th>IVA</th><th>Total</th>
            <th>Solic.</th><th>Cant.</th><th>Base</th><th>IVA</th><th>Total</th>
            <th>Desp. kg</th><th>Desp. L</th><th>Pend. kg</th><th>Pend. L</th>
          </tr>
        </thead>
        <tbody>
          {GRUPOS.map((g) => (
            <React.Fragment key={g}>
              <tr className="grupo"><td colSpan={15}>{g}</td></tr>
              {cierre.filas.filter((r) => r.grupo === g).map((r) => (
                <tr key={r.key}>
                  <td className="desc ind">{r.nombre}</td>
                  <td className="r">{r.docsEntregados}</td><td className="r">{num(r.cantidadEntregada)}</td>
                  <td className="r">{bs(r.baseEntregada)}</td><td className="r">{bs(r.ivaEntregado)}</td><td className="r strong-cell">{bs(r.totalEntregado)}</td>
                  <td className="r pend-doc">{r.docsPendientes}</td><td className="r pend-doc">{num(r.cantidadPendiente)}</td>
                  <td className="r pend-doc">{bs(r.basePendiente)}</td><td className="r pend-doc">{bs(r.ivaPendiente)}</td><td className="r pend-doc strong-cell">{bs(r.totalPendiente)}</td>
                  <td className="r">{num(r.kgDespachado)}</td><td className="r">{num(kgALitros(r.kgDespachado))}</td>
                  <td className="r">{num(r.kgComprometido)}</td><td className="r">{num(kgALitros(r.kgComprometido))}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          <tr className="totalr">
            <td>TOTALES DEL CIERRE</td>
            <td className="r">{t.docsEntregados}</td><td className="r">{num(t.cantidadEntregada)}</td>
            <td className="r">{bs(t.baseEntregada)}</td><td className="r">{bs(t.ivaEntregado)}</td><td className="r">{bs(t.totalEntregado)}</td>
            <td className="r">{t.docsPendientes}</td><td className="r">{num(t.cantidadPendiente)}</td>
            <td className="r">{bs(t.basePendiente)}</td><td className="r">{bs(t.ivaPendiente)}</td><td className="r">{bs(t.totalPendiente)}</td>
            <td className="r">{num(t.kgDespachado)}</td><td className="r">{num(kgALitros(t.kgDespachado))}</td>
            <td className="r">{num(t.kgComprometido)}</td><td className="r">{num(kgALitros(t.kgComprometido))}</td>
          </tr>
        </tbody>
      </table>

      <div className="acta-cuadre">
        <div><span>Inventario físico al cierre</span><b>{num(fisico)} kg · {num(kgALitros(fisico))} L</b></div>
        <div><span>GLP comprometido</span><b>{num(comprometido)} kg · {num(kgALitros(comprometido))} L</b></div>
        <div><span>Disponible real</span><b>{num(disponible)} kg · {num(kgALitros(disponible))} L</b></div>
        <div><span>Cuadre</span><b>{num(fisico)} − {num(comprometido)} = {num(disponible)} kg</b></div>
      </div>

      <div className="bop-firmas">
        <div><div className="linea" />Coordinación de Comercialización</div>
        <div><div className="linea" />Administración</div>
        <div><div className="linea" />Gerencia General</div>
      </div>

      <div className="fac-pie">
        <div className="fac-trace"><b>{EMPRESA.sistema}</b><div>Acta generada de la misma fuente del cierre visible y del CSV.</div><div>Emitida: {fechaGuion(HOY)} · {alcance}</div></div>
        <img src={LOGO_LARA} alt="Gobierno Bolivariano de Lara" className="fac-lara" />
      </div>
      <div className="fac-legal">Documento de demostración.</div>
    </div>
  );
}

/* ═══════════════════  REPORTE TABULAR  ═══════════════════
   Los listados del Centro de reportes (libro de ventas, libro de AD, bandeja de
   replanificación...) se imprimen en la misma hoja que la factura y el acta. Cada columna
   declara su tipo —fecha, bs, entero, kg o texto—: así el kilo sale siempre con su litro y
   el bolívar con dos decimales, igual en la hoja que en el CSV.
   `doc.data = { modulo, titulo, codigo, subtitulo, resumen: [{ l, v, s }], nota,
                 columnas: [{ t, tipo }], filas: [[...]], totales: [...] | null, horizontal, archivo }` */

const NUMERICAS = ["bs", "entero", "kg"];
const verCelda = (c, v) => {
  if (v === null || v === undefined || v === "") return "";
  if (c.tipo === "fecha") return v instanceof Date ? fecha(v) : String(v);
  if (typeof v !== "number") return String(v);
  if (c.tipo === "bs") return bs(v);
  if (c.tipo === "kg") return kgYL(v);
  return num(v);
};

export function ReporteDoc({ r }) {
  const alinear = (c) => (NUMERICAS.includes(c.tipo) ? "r" : "");
  return (
    <div className="fac reporte">
      <div className="fac-top">
        <div>
          <img src={LOGO_GASLARA} alt="GasLara" className="fac-logo" />
          <div className="fac-rif">Rif: {EMPRESA.rif}</div>
        </div>
        <div className="bop-tit">
          <div className="bop-tipo">{r.modulo || "Reporte"}</div>
          <div className="bop-num rep-tit">{r.titulo}</div>
          <div className="bop-auto">{r.codigo} · emitido {fechaGuion(HOY)}</div>
        </div>
      </div>

      {r.subtitulo && <div className="rep-sub">{r.subtitulo}</div>}

      {r.resumen?.length > 0 && (
        <div className="acta-resumen">
          {r.resumen.map((x) => <div key={x.l}><span>{x.l}</span><b>{x.v}</b>{x.s && <small>{x.s}</small>}</div>)}
        </div>
      )}

      {r.nota && <div className="acta-nota">{r.nota}</div>}

      <table className="fac-items rep-tabla">
        <thead><tr>{r.columnas.map((c) => <th key={c.t} className={alinear(c)}>{c.t}</th>)}</tr></thead>
        <tbody>
          {r.filas.length ? r.filas.map((f, i) => (
            <tr key={i}>{r.columnas.map((c, j) => <td key={j} className={alinear(c)}>{verCelda(c, f[j]) || "—"}</td>)}</tr>
          )) : <tr><td colSpan={r.columnas.length} className="c vacio">Sin registros.</td></tr>}
          {r.totales && (
            <tr className="totalr">{r.columnas.map((c, j) => <td key={j} className={alinear(c)}>{r.totales[j] == null ? "" : verCelda(c, r.totales[j])}</td>)}</tr>
          )}
        </tbody>
      </table>

      <div className="fac-pie">
        <div className="fac-trace">
          <b>{EMPRESA.sistema}</b>
          <div>{r.pie || "Generado de los mismos datos que muestran las pantallas: la hoja y el CSV salen de las mismas filas."}</div>
          <div>Emitido: {fechaGuion(HOY)}</div>
        </div>
        <img src={LOGO_LARA} alt="Gobierno Bolivariano de Lara" className="fac-lara" />
      </div>
      <div className="fac-legal">Documento de demostración.</div>
    </div>
  );
}

/* ═══════════════════  ESTILOS DEL DOCUMENTO  ═══════════════════ */

function DocEstilos({ landscape = false }) {
  return (
    <style>{`
.gdoc-overlay{position:fixed;inset:0;background:rgba(20,26,32,.58);backdrop-filter:blur(3px);
display:grid;place-items:center;padding:18px;z-index:70;
font-family:"Inter","Segoe UI",system-ui,sans-serif;animation:gfade .18s}
@keyframes gfade{from{opacity:0}to{opacity:1}}
.gdoc-wrap{width:100%;max-width:800px;max-height:94vh;display:flex;flex-direction:column;gap:10px}
.gdoc-wrap.acta-wrap{max-width:1180px}
.gdoc-actions{display:flex;gap:8px;align-items:center}
.gdoc-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border:1px solid #D8DEE4;
background:#fff;color:#3D4A59;border-radius:9px;font-size:13px;font-weight:550;font-family:inherit;cursor:pointer}
.gdoc-btn:hover{border-color:#B8C2CC;color:#101720}
.gdoc-btn.pri{background:#14548C;border-color:#14548C;color:#fff}
.gdoc-btn.pri:hover{background:#0F4372}
.gdoc-hoja{background:#fff;border-radius:8px;padding:30px 34px;overflow:auto;box-shadow:0 24px 70px rgba(20,26,32,.4)}

.fac{color:#1A1A1A;font-size:11.5px;line-height:1.35}
.fac *{box-sizing:border-box}
.fac-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.fac-logo{width:132px;height:auto;display:block}
.fac-rif{font-size:10.5px;font-weight:700;color:#1A1A1A;margin:5px 0 0 32px}
.bop-tit{text-align:right}
.bop-tipo{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#C8102E;font-weight:800}
.bop-num{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:19px;font-weight:700;margin-top:3px}
.bop-auto{font-size:9.5px;color:#666;margin-top:2px}

.fac-cab{display:grid;grid-template-columns:1fr auto 1fr;gap:20px;margin-top:16px;align-items:flex-start}
.fac-dom{font-size:10.5px;font-weight:700;color:#1A1A1A;line-height:1.6}
.fac-forma{font-size:11.5px;font-weight:700;padding-top:12px;white-space:nowrap}
.fac-nros{text-align:right;font-size:11px;font-weight:700;line-height:1.6;white-space:nowrap}
.fac-nros .mt{margin-top:12px}

.fac-cli{width:100%;border-collapse:collapse;margin-top:18px;table-layout:auto}
.fac-cli td{border:1px solid #6B6B6B;padding:6px 8px;vertical-align:middle}
.fac-cli .lbl{background:#EFEFEF;font-weight:700;white-space:nowrap;font-size:11px}
.fac-cli .val{font-size:11px}
.fac-cli .nom{font-weight:700;font-size:12.5px}
.fac-cli .dir{color:#7A5C00;font-weight:600}

.fac-ped{border-collapse:collapse;margin-top:10px}
.fac-ped td{border:1px solid #6B6B6B;padding:6px 10px}
.fac-ped .lbl{background:#EFEFEF;font-weight:700;white-space:nowrap}
.fac-ped .val{font-weight:700;min-width:150px}

.fac-items{width:100%;border-collapse:collapse;margin-top:16px}
.fac-items th{background:#E4E4E4;border:1px solid #6B6B6B;padding:7px 9px;font-size:11px;font-weight:700;text-align:center}
.fac-items td{border:1px solid #6B6B6B;padding:7px 9px;font-size:11px;height:26px}
.fac-items .w-cant{width:78px}.fac-items .w-pre{width:112px}.fac-items .w-tot{width:112px}
.fac-items .c{text-align:center}
.fac-items .r{text-align:right;font-variant-numeric:tabular-nums}
.fac-items .desc{color:#2F4F7F}
.fac-items .desc.ind{padding-left:20px;color:#1A1A1A}
.fac-items tr.vacia td{height:24px}
.fac-items tr.grupo td{background:#F2F2F2;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.fac-items tr.totalr td{font-weight:700;background:#F7F7F7}

.fac-tot{border-collapse:collapse;margin:0 0 0 auto;margin-top:-1px}
.fac-tot td{border:1px solid #6B6B6B;padding:7px 10px;font-size:11px}
.fac-tot .lbl{text-align:right;font-weight:700;white-space:nowrap;padding-right:14px}
.fac-tot .val{text-align:right;font-weight:700;width:120px;font-variant-numeric:tabular-nums}
.fac-tot .grande td{font-size:12.5px;background:#F2F2F2}

.bop-nota{margin-top:16px;border-left:3px solid #14548C;background:#F1F6FA;padding:10px 13px;
font-size:10.5px;line-height:1.6;color:#1F4B70}
.bop-firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:46px;
font-size:9.5px;color:#555;text-align:center}
.bop-firmas .linea{border-top:1px solid #1A1A1A;margin-bottom:6px}

.fac-pie{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
margin-top:26px;border-top:1px solid #D5D5D5;padding-top:12px}
.fac-trace{font-size:9.5px;color:#666;line-height:1.65}
.fac-trace b{display:block;color:#1A1A1A;font-size:10px;margin-bottom:2px}
.fac-lara{width:52px;height:auto;flex-shrink:0;opacity:.92}
.fac-legal{margin-top:10px;font-size:9px;color:#8A8A8A;text-align:center}

.acta-cierre{font-size:9px}
.acta-resumen{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.acta-resumen>div{border:1px solid #D6DCE2;border-radius:6px;padding:8px 9px;display:flex;flex-direction:column;gap:3px}
.acta-resumen span,.acta-cuadre span{font-size:7.5px;text-transform:uppercase;letter-spacing:.07em;color:#6A7480;font-weight:700}
.acta-resumen b{font-size:12px;font-variant-numeric:tabular-nums}
.acta-resumen small{font-size:8px;color:#6A7480}
.acta-nota{margin-top:9px;padding:7px 9px;background:#F4F7F9;border-left:3px solid #14548C;font-size:8.3px;line-height:1.45;color:#3E4B57}
.acta-tabla{margin-top:10px;table-layout:auto}
.acta-tabla th{font-size:6.8px;padding:4px 3px;line-height:1.15}
.acta-tabla td{font-size:7px;padding:4px 3px;height:auto;white-space:nowrap}
.acta-tabla td:first-child{white-space:normal;min-width:145px}
.acta-tabla .desc.ind{padding-left:7px}
.acta-tabla .pend-doc{background:#FFF9ED}
.acta-tabla .strong-cell{font-weight:700}
.acta-cuadre{display:grid;grid-template-columns:repeat(4,1fr);margin-top:9px;border:1px solid #D6DCE2}
.acta-cuadre>div{padding:7px 8px;border-right:1px solid #D6DCE2;display:flex;flex-direction:column;gap:3px}
.acta-cuadre>div:last-child{border-right:none}
.acta-cuadre b{font-size:8.5px;font-variant-numeric:tabular-nums}
.acta-cierre .bop-firmas{margin-top:28px}

.reporte .rep-tit{font-family:inherit;font-size:16px;max-width:520px;margin-left:auto;line-height:1.25}
.rep-sub{margin-top:12px;font-size:10px;color:#3E4B57;line-height:1.5}
.reporte .acta-resumen{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.rep-tabla{margin-top:10px}
.rep-tabla th{font-size:8px;padding:5px 6px;text-align:left;line-height:1.2}
.rep-tabla td{font-size:8.5px;padding:4px 6px;height:auto;vertical-align:top;line-height:1.35}
.rep-tabla td.r{white-space:nowrap}
.rep-tabla td.vacio{color:#777;padding:16px}

@media(max-width:820px){
 .gdoc-hoja{padding:18px}
 .fac-cab{grid-template-columns:1fr;gap:12px}
 .fac-forma{padding-top:0}
 .fac-nros{text-align:left}
 .fac-cli td{padding:5px 6px;font-size:10px}
 .bop-firmas{grid-template-columns:1fr;gap:30px}
}
@media print{
 /* Se imprime el documento y nada más, sea cual sea la pantalla que abrió el visor: se
    oculta todo lo que no es el visor ni lo contiene. */
 body:has(.gdoc-overlay) *:not(.gdoc-overlay):not(:has(.gdoc-overlay)):not(.gdoc-overlay *){display:none!important}
 .gdoc-overlay{position:static;background:#fff;backdrop-filter:none;padding:0;display:block}
 .gdoc-wrap{max-width:none;max-height:none;gap:0}
 .gdoc-actions{display:none}
 .gdoc-hoja{box-shadow:none;padding:0;border-radius:0;overflow:visible}
 @page{size:${landscape ? "A4 landscape" : "A4 portrait"};margin:${landscape ? "8mm" : "12mm"}}
}
`}</style>
  );
}
