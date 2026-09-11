import React from "react";
import { CheckCircle2, AlertTriangle, Clock3, Receipt, Gauge, Wallet, Download, Lock } from "lucide-react";
import { CDTS, PERIODO, bs, num, fecha, esFechaPeriodo, dineroAplicadoDe, llenadoPorCerrarDe } from "./datos.jsx";
import { adActiva, estadoAD } from "./flujo.js";
import { KgL, kgYL } from "./Unidades.jsx";
import { correlativoU } from "./ComercializacionGestion.jsx";

/**
 * Lo que el cierre del ciclo pasará al saldo a favor. La misma selección que hace
 * `vencerPlazos` —por replanificar y por completar— y el mismo monto que abona: el dinero
 * aplicado a cada pedido. Lo por completar sale directo de `cifras`.
 */
export function vencenAlCerrar(solicitudes = [], cifras) {
  const replan = solicitudes.filter((s) => s.estado === "POR_REPLANIFICAR");
  const pc = cifras.dinero.porCompletar;
  const bsReplan = Number(replan.reduce((a, s) => a + dineroAplicadoDe(s), 0).toFixed(2));
  return {
    replan: { n: replan.length, bs: bsReplan },
    porCompletar: { n: pc.n, bs: pc.recibido, faltante: pc.faltante },
    total: Number((bsReplan + pc.recibido).toFixed(2)),
  };
}

/** El cierre ya hecho, en una frase: cuándo, quién y cuánto pasó al saldo a favor. */
export const textoCierre = (c) => (c
  ? `Período cerrado el ${fecha(c.en)} por ${c.por}: ${num(c.vencidas)} pedidos vencidos pasaron Bs ${bs(c.monto)} al saldo a favor (ciclo de ${c.ciclo}). Los pedidos pagados y los que estaban en un AD siguen comprometidos para el período siguiente.`
  : "Período cerrado.");

/**
 * PRE-CIERRE · validaciones reales antes de cerrar. Todo es de la empresa entera: el
 * período se cierra para todos los CDT a la vez. Nada aquí bloquea el cierre; dice qué
 * queda abierto y qué va a pasar con cada cosa.
 */
export function PreCierre({ cifras, vencen, facturas = [], boletas = [], rutas = [], existencias = {}, compromisos = {}, disponibles = {},
  movPlanta = [], cdtF = "TODOS", periodoCerrado = false, cierrePeriodo = null, onCerrar = () => {}, onExport = () => {} }) {
  const d = cifras.dinero, g = cifras.glp, a = cifras.ad;
  const abiertas = rutas.filter(adActiva);
  const porCerrar = llenadoPorCerrarDe(movPlanta, rutas);
  // Por CDT: físico − comprometido = disponible, y el llenado por cerrar dentro de lo comprometido.
  const inventario = CDTS.map((c) => {
    const ex = Number(existencias[c.id] || 0), comp = Number(compromisos[c.id] || 0);
    const disp = Number(disponibles[c.id] || 0), lln = Number(porCerrar[c.id] || 0);
    if (Math.abs(ex - comp - disp) >= 1) return `${c.corto}: lo comprometido (${kgYL(comp)}) supera la existencia (${kgYL(ex)})`;
    if (lln > comp + 1) return `${c.corto}: el llenado por cerrar (${kgYL(lln)}) supera lo comprometido (${kgYL(comp)})`;
    return null;
  }).filter(Boolean);
  // La serie U- es una sola para toda la empresa: se revisa completa.
  const corr = correlativoU(facturas);
  const corrOk = !corr.huecos.length && !corr.repetidos.length;
  // Toda factura que no es de talonario nace con su BOP: cierre de AD, servicio o venta sin contrato.
  const conBop = new Set(boletas.filter((b) => b.sol).map((b) => b.sol));
  const idsBop = new Set(boletas.map((b) => b.id));
  const automaticas = facturas.filter((f) => esFechaPeriodo(f.fecha) && f.origen !== "MANUAL");
  const sinBop = automaticas.filter((f) => (f.sol ? !conBop.has(f.sol) : !idsBop.has(f.boleta)));
  const bopPeriodo = boletas.filter((b) => esFechaPeriodo(b.fecha)).length;
  const listaAbiertas = abiertas.slice(0, 5).map((r) => `${r.ad} (${estadoAD(r.estadoRuta).nombre.toLowerCase()})`).join(" · ");

  const checks = [
    { ok: !abiertas.length, t: "AD abiertas",
      d: abiertas.length
        ? `${num(abiertas.length)} sin cerrar: ${listaAbiertas}${abiertas.length > 5 ? ` y ${num(abiertas.length - 5)} más` : ""}. Sus personas siguen convocadas: no se facturan ni vencen al cerrar, pasan al período siguiente.`
        : `Las ${num(a.cerradas)} AD planificadas están cerradas.` },
    { ok: !vencen.replan.n, t: "Por replanificar que vencen al cerrar",
      d: vencen.replan.n
        ? `${num(vencen.replan.n)} pedidos · Bs ${bs(vencen.replan.bs)} pasarán al saldo a favor de sus dueños si Distribución no los atiende antes del cierre (${num(cifras.replanificacion.prioridad)} con prioridad).`
        : "Ningún pedido espera replanificación." },
    { ok: !vencen.porCompletar.n, t: "Por completar que vencen al cerrar",
      d: vencen.porCompletar.n
        ? `${num(vencen.porCompletar.n)} pedidos · Bs ${bs(vencen.porCompletar.bs)} recibidos pasarán al saldo a favor; faltaban Bs ${bs(vencen.porCompletar.faltante)} por completar.`
        : "Ningún pedido espera completar su pago." },
    { ok: !inventario.length, t: "Inventario reconciliado",
      d: inventario.length
        ? inventario.join(" · ")
        : `Físico ${kgYL(g.fisico)} − comprometido ${kgYL(g.comprometido)} = disponible ${kgYL(g.disponible)}. El llenado por cerrar (${kgYL(g.llenadoPorCerrar)}) ya está dentro del físico y de lo comprometido.` },
    { ok: corrOk, t: "Correlativo de facturas sin saltos",
      d: corr.total
        ? `Serie U- de todos los CDT: ${num(corr.total)} documentos, de ${corr.rango}.${corr.huecos.length ? ` Faltan: ${corr.huecos.join(" · ")}.` : ""}${corr.repetidos.length ? ` Repetidos: ${corr.repetidos.join(" · ")}.` : ""}${corrOk ? " Sin números faltantes." : ""}`
        : "Sin facturas de la serie U- en el período." },
    { ok: !sinBop.length, t: "Cada factura automática tiene su BOP",
      d: sinBop.length
        ? `${num(sinBop.length)} factura(s) sin BOP: ${sinBop.slice(0, 5).map((f) => f.serie).join(", ")}${sinBop.length > 5 ? "…" : ""}.`
        : `${num(automaticas.length)} facturas del período (cierre de AD, servicios y ventas sin contrato), todas con su BOP.` },
  ];
  const observaciones = checks.filter((x) => !x.ok).length;

  return <div className="cx-page"><CXStyles />
    <section className="cx-hero">
      <div><span>CONTROL DEL PERÍODO · {PERIODO.label.toUpperCase()}</span><h2>Pre-cierre de Comercialización</h2>
        <p>Una sola pantalla para verificar dinero, inventario, AD, BOP y facturación antes de cerrar. Las cifras son las mismas del panel.</p></div>
      <div className={`cx-pill ${periodoCerrado ? "closed" : ""}`}><Lock size={14} />{periodoCerrado ? "PERÍODO CERRADO" : "PERÍODO ABIERTO"}</div>
    </section>
    {periodoCerrado && <section className="cx-cerrado"><Lock size={18} /><div><b>PERÍODO CERRADO · {PERIODO.label}</b><span>{textoCierre(cierrePeriodo)}</span></div></section>}
    {cdtF !== "TODOS" && <p className="cx-nota">Las validaciones y el cierre son de toda la empresa: el período se cierra para todos los CDT a la vez. El filtro de CDT sólo cambia la tabla del cierre mensual.</p>}
    <div className="cx-kpis cinco">
      <CXK icon={Receipt} l="Facturado del período" v={`Bs ${bs(d.facturadoPeriodo.total)}`} s={`${num(d.facturadoPeriodo.docs)} documentos · IVA Bs ${bs(d.facturadoPeriodo.iva)}`} />
      <CXK icon={Clock3} l="Pendiente por despachar" v={`Bs ${bs(d.pendienteDespacho.bs)}`} s={`${num(d.pendienteDespacho.n)} pedidos pagados · siguen al período siguiente`} />
      <CXK icon={AlertTriangle} l="Pasa a saldo al cerrar" v={`Bs ${bs(vencen.total)}`} s={`${num(vencen.replan.n)} por replanificar + ${num(vencen.porCompletar.n)} por completar`} />
      <CXK icon={Wallet} l="Saldo a favor hoy" v={`Bs ${bs(d.saldoFavor.bs)}`} s={`${num(d.saldoFavor.usuarios)} usuarios · en poder de la empresa Bs ${bs(d.enPoderDeLaEmpresa)}`} />
      <CXK icon={Gauge} l="Disponible real" v={<KgL kg={g.disponible} />} s={`físico ${kgYL(g.fisico)} · llenado por cerrar ${kgYL(g.llenadoPorCerrar)}`} />
    </div>
    <div className="cx-grid2">
      <section className="cx-card"><h3>Cuadre operativo</h3><div className="cx-opgrid">
        <Mini l="AD planificadas" v={num(a.planificadas)} /><Mini l="AD cerradas" v={num(a.cerradas)} /><Mini l="AD abiertas" v={num(a.activas)} />
        <Mini l="BOP del período" v={num(bopPeriodo)} /><Mini l="Facturas del período" v={num(d.facturadoPeriodo.docs)} /><Mini l="IVA facturado" v={`Bs ${bs(d.facturadoPeriodo.iva)}`} />
      </div></section>
      <section className="cx-card"><h3>Cuadre de inventario</h3>
        <Bar l="Inventario físico" v={g.fisico} max={Math.max(g.fisico, 1)} note={kgYL(g.fisico)} />
        <Bar l="Comprometido" v={g.comprometido} max={Math.max(g.fisico, 1)} note={kgYL(g.comprometido)} />
        <Bar l="Disponible real" v={g.disponible} max={Math.max(g.fisico, 1)} note={kgYL(g.disponible)} />
        <Bar l="Llenado por cerrar" v={g.llenadoPorCerrar} max={Math.max(g.fisico, 1)} note={kgYL(g.llenadoPorCerrar)} />
      </section>
    </div>
    <section className="cx-card">
      <div className="cx-head"><div><h3>Validaciones antes de cerrar</h3><p>Lo que queda abierto y lo que el cierre va a hacer, con las cifras del sistema.</p></div>
        <span>{observaciones ? `${observaciones} observaciones` : "Sin observaciones"}</span></div>
      <div className="cx-checks">{checks.map((x) => <div key={x.t} className={x.ok ? "ok" : "warn"}>{x.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}<div><b>{x.t}</b><span>{x.d}</span></div></div>)}</div>
      <div className="cx-actions">
        <button className="cx-secondary" onClick={onExport}><Download size={14} />Descargar cierre (CSV)</button>
        {periodoCerrado
          ? <span className="cx-pill closed"><Lock size={14} />Período cerrado</span>
          : <button className="cx-primary" onClick={onCerrar}><Lock size={14} />Cerrar período</button>}
      </div>
    </section>
  </div>;
}

/* El módulo de Cartera se retiró el 01/09/2026.
   Fabricaba los datos por posición en el arreglo — `i % 7` decidía quién era cliente a
   crédito, `i % 3` cuánto había abonado y `i % 5` la antigüedad — y solo miraba las
   primeras 80 solicitudes. Además el modelo no tiene abonos parciales, así que no había
   dónde persistir un cobro a cuenta.

   De fondo, con la regla vigente de pago verificado antes de reservar inventario, nadie
   recibe sin pagar y la cartera casi no tendría qué registrar. Si más adelante se habilita
   despacho a crédito para clientes institucionales, el módulo debe rehacerse sobre datos
   reales: límite de crédito por cliente, abonos parciales y antigüedad desde la fecha de
   factura.

   La pantalla de «pagos y conciliación visual» (PagosDemo) también se retiró: inventaba
   diferencias y duplicados con `i % 17` e `i % 23`. Lo que la regla resuelve de verdad se
   consulta en Solicitudes, segmento «Resueltas por regla». */

function CXK({ icon: I, l, v, s }) { return <div className="cx-k"><I size={18} /><span>{l}</span><b>{v}</b><small>{s}</small></div>; }
function Mini({ l, v }) { return <div><span>{l}</span><b>{v}</b></div>; }
function Bar({ l, v, max, note }) { return <div className="cx-bar"><div><span>{l}</span><b>{note}</b></div><i><em style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></i></div>; }
function CXStyles() {
  return <style>{`
.cx-page{display:flex;flex-direction:column;gap:14px}
.cx-hero,.cx-card,.cx-k{background:#fff;border:1px solid #e2e8ec;border-radius:14px}
.cx-hero{padding:18px 20px;display:flex;justify-content:space-between;gap:20px;align-items:center}
.cx-hero span{font-size:9px;font-weight:800;color:#26704c}
.cx-hero h2{margin:5px 0;font-size:21px}
.cx-hero p{margin:0;color:#71808a;font-size:11px;max-width:760px}
.cx-pill{display:flex;align-items:center;gap:6px;background:#eaf5ee;color:#17623f;padding:8px 10px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
.cx-pill.closed{background:#edf0f2;color:#4c5963}
.cx-cerrado{display:flex;gap:12px;align-items:flex-start;background:#EDF0F2;border:1px solid #D5DCE1;border-radius:14px;padding:14px 16px;color:#34424C}
.cx-cerrado svg{flex:none;margin-top:2px}
.cx-cerrado b{display:block;font-size:13px;margin-bottom:4px;letter-spacing:.02em}
.cx-cerrado span{display:block;font-size:11.5px;line-height:1.55}
.cx-nota{margin:0;font-size:11.5px;color:#6E7C87;line-height:1.5}
.cx-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.cx-kpis.cinco{grid-template-columns:repeat(5,minmax(0,1fr))}
.cx-k{padding:13px;display:flex;flex-direction:column;gap:5px;min-width:0}
.cx-k svg{color:#17623f}
.cx-k span,.cx-k small{font-size:10px;color:#71808a}
.cx-k b{font-size:20px}
.cx-card{padding:15px}
.cx-card h3{margin:0 0 10px;font-size:14px}
.cx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cx-opgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.cx-opgrid>div{background:#f5f7f8;border-radius:9px;padding:10px}
.cx-opgrid span{display:block;font-size:9px;color:#74818a}
.cx-opgrid b{display:block;margin-top:3px;font-size:16px}
.cx-bar{margin:10px 0}
.cx-bar>div{display:flex;justify-content:space-between;font-size:10px}
.cx-bar i{display:block;height:8px;background:#eef2f3;border-radius:99px;overflow:hidden;margin-top:5px}
.cx-bar em{display:block;height:100%;background:#2f9b66;border-radius:99px}
.cx-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.cx-head p{margin:3px 0 0;color:#78858e;font-size:10px}
.cx-head>span{font-size:10px;color:#8a651f;background:#fff3df;padding:6px 8px;border-radius:99px;white-space:nowrap}
.cx-checks{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.cx-checks>div{display:flex;gap:8px;border:1px solid #e4e9ec;border-radius:9px;padding:9px}
.cx-checks svg{flex:none}
.cx-checks .ok svg{color:#27875a}
.cx-checks .warn{background:#fff8eb}
.cx-checks .warn svg{color:#bd7718}
.cx-checks b,.cx-checks span{display:block;font-size:10.5px}
.cx-checks span{color:#74818a;margin-top:2px;line-height:1.5}
.cx-actions{display:flex;justify-content:flex-end;align-items:center;gap:7px;margin-top:12px}
.cx-primary,.cx-secondary{border:0;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:800;display:flex;gap:6px;align-items:center;cursor:pointer}
.cx-primary{background:#17623f;color:white}
.cx-secondary{background:#eef2f4;color:#35434d}
@media(max-width:1180px){.cx-kpis.cinco{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:950px){.cx-kpis,.cx-kpis.cinco{grid-template-columns:1fr 1fr}.cx-grid2,.cx-checks{grid-template-columns:1fr}}
`}</style>;
}
