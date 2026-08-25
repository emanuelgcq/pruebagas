import React, { useMemo, useState } from "react";
import { X, FileText, Receipt, Clock3, CheckCircle2, Building2, Users, Search } from "lucide-react";

const money = (n) => Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (n, d = 0) => Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits: d, maximumFractionDigits: d });
const dateText = (d) => {
  if (!d) return "—";
  if (typeof d === "string") return d;
  try { return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d); }
  catch { return String(d); }
};

export default function Usuario360Modal({
  mode = "comercializacion", perfil = {}, solicitudes = [], pagos = [], despachos = [], facturas = [], auditoria = [], onClose,
}) {
  const [tab, setTab] = useState("resumen");
  const [q, setQ] = useState("");
  const comercial = mode === "comercializacion";
  const totals = useMemo(() => ({
    solicitudes: solicitudes.length,
    pagos: pagos.filter((p) => p.estado !== "PENDIENTE" && p.estado !== "NO_APLICA").length,
    recaudado: pagos.reduce((a, p) => a + Number(p.total || 0), 0),
    iva: pagos.reduce((a, p) => a + Number(p.iva || 0), 0),
    facturado: facturas.reduce((a, f) => a + Number(f.total || 0), 0),
    kg: solicitudes.reduce((a, s) => a + Number(s.kg || 0), 0),
  }), [solicitudes, pagos, facturas]);

  const ciclo = useMemo(() => {
    const sol = solicitudes.find((x) => x.ad) || solicitudes[0];
    if (!sol) return [];
    const pago = pagos.find((x) => x.solicitud === sol.id) || pagos[0];
    const despacho = despachos.find((x) => x.ad && x.ad === sol.ad) || despachos[0];
    const factura = facturas.find((x) => x.ad && x.ad === sol.ad) || facturas[0];
    const fechaBase = sol.fecha;
    const rows = [
      { titulo: "Solicitud registrada", detalle: sol.id, fecha: fechaBase, estado: "Solicitud" },
      pago && { titulo: "Pago confirmado", detalle: `${pago.banco || "Banco"} · Op. ${pago.operacion || "—"}`, fecha: pago.fecha || fechaBase, estado: "Pago" },
      sol.ad && { titulo: "Incluida en AD", detalle: sol.ad, fecha: despacho?.fecha || fechaBase, estado: "AD" },
      despacho && { titulo: "Carga y asignación logística", detalle: `${despacho.placa || "Vehículo"} · ${despacho.operador || "Operador"}`, fecha: despacho.fecha || fechaBase, estado: "Distribución" },
      despacho && { titulo: "Entregada a comuna / destino", detalle: despacho.comunidad || despacho.comuna || "Destino registrado", fecha: despacho.fecha || fechaBase, estado: "Entrega" },
      despacho?.bop && { titulo: "BOP generada", detalle: despacho.bop, fecha: despacho.fecha || fechaBase, estado: "BOP" },
      factura && { titulo: "Factura emitida", detalle: factura.serie || factura.control || "Factura", fecha: factura.fecha || despacho?.fecha || fechaBase, estado: "Factura" },
      despacho && /ENTREG|CULMIN|CERRAD/i.test(String(despacho.estado || "")) && { titulo: "Retiro por el usuario", detalle: "Entrega final registrada por la comuna · demo", fecha: despacho.fecha || fechaBase, estado: "Retiro" },
    ].filter(Boolean);
    return rows;
  }, [solicitudes, pagos, despachos, facturas]);

  function exportarAuditoria(){
    const esc=(v)=>`"${String(v??"").replaceAll('"','""')}"`;
    const rows=[["FICHA 360",perfil.nombre||"Usuario",perfil.doc||""],["Módulo",comercial?"Comercialización":"Distribución"],[],["Fecha","Hora","Evento","Origen","Referencia","Detalle"],...auditoria.map(a=>[dateText(a.fecha),a.hora||"",a.evento,a.origen||"Sistema",a.referencia||"",a.detalle||""])];
    if(comercial){rows.push([], ["PAGOS"], ["Solicitud","Banco","Operación","Fecha","Base Bs","IVA Bs","Total Bs","Estado"], ...pagos.map(p=>[p.solicitud,p.banco,p.operacion,dateText(p.fecha),Number(p.base||0).toFixed(2),Number(p.iva||0).toFixed(2),Number(p.total||0).toFixed(2),p.estado]));}
    else{rows.push([], ["TRANSACCIONES BANCARIAS - SIN MONTOS"], ["Solicitud","Banco","Operación","Fecha","Estado"], ...pagos.map(p=>[p.solicitud,p.banco,p.operacion,dateText(p.fecha),p.estado]));}
    const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(esc).join(";")).join("\n")],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`auditoria-${String(perfil.doc||perfil.id||"usuario").replace(/[^a-zA-Z0-9]/g,"")}.csv`;a.click();URL.revokeObjectURL(a.href);
  }

  const tabs = [
    ["resumen", "Resumen"], ["solicitudes", "Solicitudes"], ["pagos", "Pagos"], ["despachos", "Despachos"],
    ...(comercial ? [["facturas", "Facturas"]] : []), ["auditoria", "Auditoría"],
  ];

  return <div className="u360-bg" onClick={onClose}>
    <Estilos />
    <section className="u360" onClick={(e) => e.stopPropagation()}>
      <header className="u360-head">
        <div>
          <small>{comercial ? "Ficha 360° · Comercialización" : "Ficha 360° · Distribución"}</small>
          <h2>{perfil.nombre || "Usuario"}</h2>
          <p>{[perfil.doc, perfil.contrato ? `Contrato ${perfil.contrato}` : null, perfil.tipo, perfil.uso].filter(Boolean).join(" · ")}</p>
        </div>
        <button className="u360-close" onClick={onClose}><X size={18}/></button>
      </header>

      <div className="u360-identity">
        <Identity label="Código / ID" value={perfil.id || "—"}/><Identity label="Comuna" value={perfil.comuna || "—"}/>
        <Identity label="Comunidad" value={perfil.comunidad || "—"}/><Identity label="CDT" value={perfil.cdt || "—"}/>
        <Identity label="Dirección" value={perfil.direccion || "—"}/><Identity label="Teléfono" value={perfil.tel || "—"}/>
        {comercial && <Identity label="Correo" value={perfil.correo || "—"}/>}<Identity label="Cliente desde" value={dateText(perfil.desde)}/>
      </div>

      <nav className="u360-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>

      <main className="u360-body">
        {tab === "resumen" && <>
          <div className="u360-kpis">
            <Kpi label="Solicitudes históricas" value={number(totals.solicitudes)} />
            <Kpi label="Pagos registrados" value={number(totals.pagos)} />
            <Kpi label="GLP solicitado" value={`${number(totals.kg, 2)} kg`} />
            {comercial ? <Kpi label="Recaudado histórico" value={`Bs ${money(totals.recaudado)}`} /> : <Kpi label="Transacciones bancarias" value={number(pagos.filter(p => p.operacion).length)} />}
          </div>
          {comercial && <div className="u360-finance">
            <div><span>Base histórica</span><b>Bs {money(pagos.reduce((a,p)=>a+Number(p.base||0),0))}</b></div>
            <div><span>IVA histórico</span><b>Bs {money(totals.iva)}</b></div>
            <div><span>Facturado</span><b>Bs {money(totals.facturado)}</b></div>
            <div><span>Diferencia recaudado/facturado</span><b>Bs {money(totals.recaudado - totals.facturado)}</b></div>
          </div>}
          <section className="u360-flow"><div className="u360-flow-head"><div><small>Trazabilidad punta a punta</small><h3>Línea de tiempo de la operación</h3></div><span>Solicitud → Pago → AD → Entrega → BOP → Factura → Retiro</span></div><div className="u360-flow-track">{ciclo.map((x,i)=><div className="u360-flow-item" key={`${x.titulo}-${i}`}><div className="u360-flow-dot">{i+1}</div><div><b>{x.titulo}</b><span>{dateText(x.fecha)} · {x.detalle}</span><small>{x.estado}</small></div></div>)}</div></section>
          <div className="u360-two">
            <section className="u360-panel"><h3>Últimas operaciones</h3>{solicitudes.slice(0,5).map((s)=><div className="u360-line" key={s.id}><div><b>{s.id}</b><span>{dateText(s.fecha)} · {s.concepto}</span></div><strong>{s.ad || "Sin AD"}</strong></div>)}</section>
            <section className="u360-panel"><h3>Trazabilidad reciente</h3>{auditoria.slice(0,5).map((a,i)=><div className="u360-line" key={`${a.referencia}-${i}`}><div><b>{a.evento}</b><span>{dateText(a.fecha)} {a.hora || ""}</span></div><strong>{a.referencia || a.origen}</strong></div>)}</section>
          </div>
          <div className="u360-note"><CheckCircle2 size={16}/><span>La ficha reconstruye cada operación usando identificadores inmutables: solicitud/pedido, operación bancaria, AD, BOP y factura. {comercial ? "Los importes financieros solo son visibles para Comercialización." : "Distribución visualiza la trazabilidad bancaria sin montos en bolívares."}</span></div>
        </>}

        {tab !== "resumen" && <div className="u360-toolbar"><div className="u360-search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar dentro del histórico"/></div><span>{rowCount(tab, {solicitudes,pagos,despachos,facturas,auditoria})} registros</span></div>}

        {tab === "solicitudes" && <Table headers={["Solicitud / pedido","Fecha","Concepto","Cantidad","Kg / litros","AD","Estado"]} rows={solicitudes.filter(searcher(q)).map(s => [<Strong key="id">{s.id}</Strong>,dateText(s.fecha),s.concepto,s.cantidad ?? "—",`${number(s.kg,2)} kg · ${number(s.litros,2)} L`,s.ad||"Sin AD",<Status key="st" value={s.estado}/>])}/>} 

        {tab === "pagos" && <Table headers={comercial ? ["Solicitud","Banco","N.º operación banco","Fecha","Base Bs","IVA Bs","Total Bs","Estado"] : ["Solicitud","Banco","N.º operación banco","Fecha","Estado","Validación"]} rows={pagos.filter(searcher(q)).map(p => comercial ? [p.solicitud,p.banco||"—",<Strong key="op">{p.operacion||"—"}</Strong>,dateText(p.fecha),money(p.base),money(p.iva),<Strong key="tt">{money(p.total)}</Strong>,<Status key="st" value={p.estado}/>] : [p.solicitud,p.banco||"—",<Strong key="op">{p.operacion||"—"}</Strong>,dateText(p.fecha),<Status key="st" value={p.estado}/>,p.validacion||"Registrado por Comercialización"] )}/>} 

        {tab === "despachos" && <Table headers={["AD","Fecha","Destino","Vehículo","Operador","BOP","Kg / litros","Estado"]} rows={despachos.filter(searcher(q)).map(d => [<Strong key="ad">{d.ad||"—"}</Strong>,dateText(d.fecha),[d.comunidad,d.comuna].filter(Boolean).join(" · ")||"—",d.placa||"—",[d.operador,d.operadorCedula].filter(Boolean).join(" · ")||"—",d.bop||"—",`${number(d.kg,2)} kg · ${number(d.litros,2)} L`,<Status key="st" value={d.estado}/>])}/>} 

        {tab === "facturas" && comercial && <Table headers={["Factura","Control","Fecha","Concepto","AD","Base Bs","IVA Bs","Total Bs","Documento"]} rows={facturas.filter(searcher(q)).map(f => [<Strong key="f">{f.serie||"—"}</Strong>,f.control||"—",dateText(f.fecha),f.concepto,f.ad||"—",money(f.base),money(f.iva),<Strong key="t">{money(f.total)}</Strong>,f.onOpen?<button className="u360-doc" onClick={f.onOpen}><Receipt size={12}/> Ver factura</button>:"—"])}/>} 

        {tab === "auditoria" && <Table headers={["Fecha / hora","Evento","Origen","Referencia","Detalle"]} rows={auditoria.filter(searcher(q)).map((a,i) => [`${dateText(a.fecha)}${a.hora?` · ${a.hora}`:""}`,<Strong key="e">{a.evento}</Strong>,a.origen||"Sistema",a.referencia||"—",a.detalle||"—"])}/>} 
      </main>
      <footer className="u360-foot"><span><Clock3 size={13}/> Histórico de demostración ordenado de más reciente a más antiguo</span><div className="u360-foot-actions"><button className="alt" onClick={exportarAuditoria}>Exportar auditoría CSV</button><button onClick={onClose}>Cerrar ficha</button></div></footer>
    </section>
  </div>;
}

function searcher(q){const x=q.trim().toLowerCase();return (r)=>!x||Object.values(r).some(v=>String(v??"").toLowerCase().includes(x));}
function rowCount(tab,d){return (d[tab]||[]).length;}
function Identity({label,value}){return <div><span>{label}</span><b>{value}</b></div>}
function Kpi({label,value}){return <div className="u360-kpi"><span>{label}</span><b>{value}</b></div>}
function Strong({children}){return <b className="u360-strong">{children}</b>}
function Status({value}){const v=String(value||"—");const ok=/VERIFIC|CULMIN|ENTREG|PAGAD|APROBAD|CONCILI/i.test(v);const warn=/PEND|SIN AD|ASIGN/i.test(v);return <span className={`u360-status ${ok?"ok":warn?"warn":"neutral"}`}>{v}</span>}
function Table({headers,rows}){return <div className="u360-table-wrap"><table className="u360-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>):<tr><td colSpan={headers.length} className="u360-empty">Sin registros para mostrar.</td></tr>}</tbody></table></div>}

function Estilos(){return <style>{`
.u360-bg{position:fixed;inset:0;background:rgba(12,22,30,.52);z-index:180;display:grid;place-items:center;padding:18px;font-family:Inter,Segoe UI,system-ui,sans-serif}.u360{width:min(1280px,97vw);height:min(880px,94vh);background:#fff;border-radius:22px;box-shadow:0 26px 80px rgba(8,17,24,.28);display:flex;flex-direction:column;overflow:hidden;color:#15232D}.u360-head{display:flex;justify-content:space-between;gap:14px;padding:20px 22px 14px;border-bottom:1px solid #E4EAEF}.u360-head small{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#23734E;font-weight:900}.u360-head h2{margin:5px 0 4px;font-size:24px}.u360-head p{margin:0;color:#687682;font-size:12px}.u360-close{border:1px solid #DDE5EA;background:#fff;border-radius:11px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer}.u360-identity{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px 22px;background:#F7F9FA;border-bottom:1px solid #E5EBEF}.u360-identity>div{min-width:0}.u360-identity span{display:block;font-size:9px;color:#71808B;text-transform:uppercase;letter-spacing:.04em}.u360-identity b{display:block;font-size:11px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.u360-tabs{display:flex;gap:3px;padding:9px 22px;border-bottom:1px solid #E6ECEF;background:#fff;overflow:auto}.u360-tabs button{border:0;background:transparent;border-radius:9px;padding:8px 11px;color:#677681;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.u360-tabs button.on{background:#EAF4EE;color:#1F6544}.u360-body{padding:16px 22px;overflow:auto;flex:1;background:#FBFCFD}.u360-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.u360-kpi,.u360-finance>div{border:1px solid #E1E8ED;background:#fff;border-radius:14px;padding:13px}.u360-kpi span,.u360-finance span{display:block;font-size:10px;color:#71808C}.u360-kpi b,.u360-finance b{display:block;font-size:18px;margin-top:5px}.u360-finance{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}.u360-flow{margin-top:12px;border:1px solid #DDE7E2;background:#fff;border-radius:15px;padding:14px}.u360-flow-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:13px}.u360-flow-head small{font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#23734E;font-weight:900}.u360-flow-head h3{font-size:13px;margin:3px 0 0}.u360-flow-head>span{font-size:8.5px;color:#78858E}.u360-flow-track{display:flex;gap:0;overflow:auto;padding-bottom:3px}.u360-flow-item{display:flex;align-items:flex-start;gap:7px;min-width:155px;position:relative;padding-right:16px}.u360-flow-item:not(:last-child):after{content:"";position:absolute;left:20px;right:-1px;top:12px;height:1px;background:#C9D8D0;z-index:0}.u360-flow-dot{width:25px;height:25px;border-radius:50%;background:#1F6948;color:#fff;display:grid;place-items:center;font-size:9px;font-weight:900;flex:0 0 auto;position:relative;z-index:1;box-shadow:0 0 0 4px #EDF5F1}.u360-flow-item>div:last-child{position:relative;z-index:1;background:#fff;padding-right:4px}.u360-flow-item b{display:block;font-size:9px}.u360-flow-item span{display:block;font-size:8px;color:#6F7D87;line-height:1.35;margin-top:3px}.u360-flow-item small{display:inline-block;margin-top:4px;font-size:7.5px;font-weight:800;color:#2B6A4B;background:#EDF6F1;border-radius:999px;padding:3px 6px}.u360-two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.u360-panel{border:1px solid #E2E8ED;background:#fff;border-radius:14px;padding:13px}.u360-panel h3{font-size:12px;margin:0 0 9px}.u360-line{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #EEF2F4}.u360-line:last-child{border-bottom:0}.u360-line b{display:block;font-size:10px}.u360-line span{display:block;font-size:9px;color:#71808B;margin-top:2px}.u360-line strong{font-size:9px;color:#52616C;text-align:right}.u360-note{display:flex;gap:8px;align-items:flex-start;background:#EDF6F1;border:1px solid #D7E8DE;color:#315F48;border-radius:13px;padding:11px;margin-top:12px;font-size:10px;line-height:1.5}.u360-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}.u360-toolbar>span{font-size:10px;color:#6B7984}.u360-search{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #DDE5EA;border-radius:9px;padding:7px 9px}.u360-search input{border:0;outline:none;font:inherit;font-size:10px;width:260px}.u360-table-wrap{border:1px solid #E0E7EC;border-radius:13px;overflow:auto;background:#fff}.u360-table{width:100%;border-collapse:collapse;font-size:9.5px;min-width:900px}.u360-table th{background:#F2F5F7;color:#687782;text-transform:uppercase;letter-spacing:.03em;font-size:8px;padding:8px;text-align:left;position:sticky;top:0}.u360-table td{padding:8px;border-top:1px solid #E9EEF1;vertical-align:top}.u360-strong{font-size:9.5px}.u360-status{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:800}.u360-status.ok{background:#E7F4EC;color:#246747}.u360-status.warn{background:#FFF2E2;color:#A86714}.u360-status.neutral{background:#EEF2F5;color:#5D6C77}.u360-doc{border:1px solid #D6E3DB;background:#EDF6F1;color:#225D40;border-radius:7px;padding:5px 7px;font-size:8px;font-weight:800;display:inline-flex;gap:4px;align-items:center;cursor:pointer}.u360-empty{text-align:center!important;color:#74818B;padding:28px!important}.u360-foot{height:52px;flex:0 0 auto;border-top:1px solid #E2E8EC;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 22px;background:#fff}.u360-foot span{font-size:9px;color:#73808A;display:flex;gap:5px;align-items:center}.u360-foot-actions{display:flex;gap:7px}.u360-foot button{border:0;background:#173C2B;color:white;border-radius:9px;padding:8px 13px;font-size:10px;font-weight:800;cursor:pointer}.u360-foot button.alt{background:#EEF3F6;color:#31424E}@media(max-width:900px){.u360-identity,.u360-kpis,.u360-finance,.u360-two{grid-template-columns:1fr 1fr}.u360{height:96vh}.u360-search input{width:150px}}`}</style>}
