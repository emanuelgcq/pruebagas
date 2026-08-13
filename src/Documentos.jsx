import React from "react";
import { X, Download, Printer } from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, EMPRESA, IVA, CDTS, GRUPOS, CONCEPTOS, TIPOS_DESPACHO,
  cpt, usr, tpd, cdtOf, banco, bs, bs3, num, fecha, fechaGuion, PERIODO, HOY,
  descargar, csv, kgALitros, resumenCierreMensual,
} from "./datos.jsx";

/* ═══════════════════  VISOR  ═══════════════════ */

export function VisorDocumento({ doc, onClose, contexto = {} }) {
  const bajar = () => {
    if (doc.tipo === "factura") {
      const f = doc.data, u = usr(f.usuario), c = cpt(f.concepto);
      descargar(`${f.serie}.csv`, csv([
        [EMPRESA.nombre], ["Rif", EMPRESA.rif], ["FORMA LIBRE"],
        ["Nro. Control", f.control], ["Factura Serie", f.serie], ["Fecha Emision", fechaGuion(f.fecha)], [],
        ["Nombre o Razon Social", u.nombre], ["Direccion", u.dir], ["Rif", u.rifFactura],
        ["Telefonos", u.tel], ["Contrato", u.contrato], ["Tipo de Contrato", u.tipoContrato],
        ["Pedido Nro", f.pedidoNro ? `P${f.pedidoNro}` : f.talonario], [],
        ["Cantidad", "Descripcion", "Precio/Unitario", "Total Bs."],
        [f.cantidad, c.nombre, c.precio.toFixed(3), f.base.toFixed(2)], [],
        ["Total Base Imponible Bs.", (f.exento ? 0 : f.base).toFixed(2)],
        ["Total Exento", (f.exento ? f.base : 0).toFixed(2)],
        ["Subtotal Neto Bs.", f.base.toFixed(2)],
        ["I.V.A % sobre Base", f.iva.toFixed(2)],
        ["Total a Pagar Bs.", f.total.toFixed(2)], [],
        ["Solicitud", f.sol || ""], ["AD de origen", f.ad || ""],
        ["Banco", f.pago?.banco ? banco(f.pago.banco).nombre : ""], ["Referencia", f.pago?.referencia || ""],
      ]));
    } else if (doc.tipo === "boleta") {
      const b = doc.data;
      descargar(`${b.id}.csv`, csv([
        [EMPRESA.nombre], ["BOLETA DE OPERACION", b.id], ["AD de origen", b.ad], ["Solicitud", b.sol],
        ["Fecha", fecha(b.fecha)], ["CDT", cdtOf(b.cdt).nombre], ["Operador", b.operador], [],
        ["Usuario", usr(b.usuario).nombre], ["Contrato", usr(b.usuario).contrato],
        ["Concepto", cpt(b.concepto).nombre], ["Cantidad", b.cantidad],
        ["Salida GLP kg", b.kg], ["Tipo de despacho", tpd(b.tipoDespacho).nombre],
      ]));
    } else {
      const { facturas = [], solicitudes = [], existencias = {}, compromisos = {}, disponibles = {}, cdtF = "TODOS", alcance = "Consolidado" } = contexto;
      const cierre = resumenCierreMensual(facturas, solicitudes), t = cierre.totales;
      const cdtsAlcance = CDTS.filter((c) => cdtF === "TODOS" || c.id === cdtF);
      const fisico = cdtsAlcance.reduce((a, c) => a + Number(existencias[c.id] || 0), 0);
      const comprometido = cdtsAlcance.reduce((a, c) => a + Number(compromisos[c.id] || 0), 0);
      const disponible = cdtsAlcance.reduce((a, c) => a + Number(disponibles[c.id] || 0), 0);
      descargar(`acta-cierre-${PERIODO.anio}-08.csv`, csv([
        ["ACTA DE CIERRE MENSUAL DE COMERCIALIZACIÓN"], [EMPRESA.nombre, EMPRESA.rif], [PERIODO.label], ["Alcance", alcance], [],
        ["CUADRE GENERAL"],
        ["Facturado por entregas reales Bs", t.totalEntregado.toFixed(2), "Base Bs", t.baseEntregada.toFixed(2), "IVA Bs", t.ivaEntregado.toFixed(2)],
        ["Recaudado pendiente de despacho Bs", t.totalPendiente.toFixed(2), "Base pendiente Bs", t.basePendiente.toFixed(2), "IVA pendiente Bs", t.ivaPendiente.toFixed(2)],
        ["Inventario físico al cierre kg", fisico.toFixed(2), "Comprometido kg", comprometido.toFixed(2), "Disponible real kg", disponible.toFixed(2)],
        ["Inventario físico al cierre L", kgALitros(fisico).toFixed(2), "Comprometido L", kgALitros(comprometido).toFixed(2), "Disponible real L", kgALitros(disponible).toFixed(2)], [],
        ["Concepto de ingreso", "Docs. entregados/facturados", "Cant. facturada", "Base entregada Bs", "IVA entregado Bs", "Total entregado Bs",
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
      ]));
    }
  };

  return (
    <div className="gdoc-overlay" onClick={onClose}>
      <DocEstilos landscape={doc.tipo === "acta"} />
      <div className={`gdoc-wrap ${doc.tipo === "acta" ? "acta-wrap" : ""}`} onClick={(e) => e.stopPropagation()}>
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
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════  FACTURA — formato GasLara  ═══════════════════ */

export function FacturaDoc({ f }) {
  const u = usr(f.usuario);
  const c = cpt(f.concepto);
  const gravable = f.exento ? 0 : f.base;
  const exento = f.exento ? f.base : 0;

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
            <td className="val nom" colSpan={7}>{u.nombre}</td>
          </tr>
          <tr>
            <td className="lbl">Dirección:</td>
            <td className="val dir" colSpan={7}>{u.dir}</td>
          </tr>
          <tr>
            <td className="lbl">Rif:</td>
            <td className="val">{u.rifFactura}</td>
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
            <td className="r">{bs3(c.precio)}</td>
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
          <div>Solicitud {f.sol || "—"} · {f.ad ? `Atención de distribución ${f.ad}` : "Facturación manual de talonario"}</div>
          {f.pago?.banco && (
            <div>Pago anticipado verificado: {banco(f.pago.banco).nombre}, referencia {f.pago.referencia}
              {f.pago.auto ? " · conciliado automáticamente" : ""}</div>
          )}
          <div>Emitida por {EMPRESA.sistema} al cierre del AD.</div>
        </div>
        <img src={LOGO_LARA} alt="Gobierno Bolivariano de Lara" className="fac-lara" />
      </div>
      <div className="fac-legal">Documento de demostración. Sin validez fiscal.</div>
    </div>
  );
}

/* ═══════════════════  BOLETA DE OPERACIÓN  ═══════════════════ */

export function BoletaDoc({ b }) {
  const c = cpt(b.concepto), u = usr(b.usuario);
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
          <div>AD DE ORIGEN {b.ad}</div>
          <div className="mt">SOLICITUD {b.sol}</div>
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
            <td className="lbl">Operador:</td><td className="val">{b.operador}</td>
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
            <td className="r">{b.kg ? `${num(b.kg)} kg` : "sin inventario"}</td>
          </tr>
          <tr className="vacia"><td /><td /><td /><td /></tr>
        </tbody>
      </table>

      <div className="bop-nota">
        Esta boleta se generó con el cierre del AD. La salida de inventario GLP quedó registrada en el mismo
        acto, eliminando la operación manual de salida de inventario.
      </div>

      <div className="bop-firmas">
        <div><div className="linea" />Operador de distribución</div>
        <div><div className="linea" />Supervisor de CDT</div>
        <div><div className="linea" />Recibido conforme · Usuario</div>
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
        <div><span>Recaudado sin despachar</span><b>Bs {bs(t.totalPendiente)}</b><small>Base {bs(t.basePendiente)} · IVA {bs(t.ivaPendiente)}</small></div>
        <div><span>Inventario físico</span><b>{num(fisico)} kg</b><small>{num(kgALitros(fisico))} L</small></div>
        <div><span>Comprometido / disponible</span><b>{num(comprometido)} / {num(disponible)} kg</b><small>Disponible {num(kgALitros(disponible))} L</small></div>
      </div>

      <div className="acta-nota">
        Los importes recaudados pendientes se presentan como saldo operativo y <b>no se suman a la facturación entregada</b>. El inventario físico solo disminuye con una entrega real documentada; el GLP pagado pero no entregado permanece comprometido dentro del CDT.
      </div>

      <table className="fac-items acta-tabla">
        <thead>
          <tr>
            <th rowSpan={2}>Concepto</th>
            <th colSpan={5}>Entregado / facturado</th>
            <th colSpan={5}>Recaudado pendiente</th>
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

@media(max-width:820px){
 .gdoc-hoja{padding:18px}
 .fac-cab{grid-template-columns:1fr;gap:12px}
 .fac-forma{padding-top:0}
 .fac-nros{text-align:left}
 .fac-cli td{padding:5px 6px;font-size:10px}
 .bop-firmas{grid-template-columns:1fr;gap:30px}
}
@media print{
 .gdoc-overlay{position:static;background:#fff;backdrop-filter:none;padding:0;display:block}
 .gdoc-wrap{max-width:none;max-height:none;gap:0}
 .gdoc-actions{display:none}
 .gdoc-hoja{box-shadow:none;padding:0;border-radius:0}
 @page{size:${landscape ? "A4 landscape" : "A4 portrait"};margin:${landscape ? "8mm" : "12mm"}}
}
`}</style>
  );
}
