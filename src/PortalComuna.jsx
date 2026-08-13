import React, { useMemo, useState } from "react";
import {
  Users, Search, CheckCircle2, Clock, Package, MapPin, UserRoundCheck,
  Truck, Building2, ShieldCheck, Phone, CircleDollarSign,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, HOY, PERIODO, COMUNA_PORTAL, USUARIOS,
  cdtOf, cpt, tpd, fase, fechaCorta, num, diasEntre, segmentoUsuario,
} from "./datos.jsx";

const COM = COMUNA_PORTAL;

export default function PortalComuna({ solicitudes }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");

  const miembros = useMemo(() => USUARIOS.filter((u) => u.comuna === COM.id), []);

  const filas = useMemo(() => miembros.map((u) => {
    const bombonas = solicitudes
      .filter((s) => s.usuario === u.id && cpt(s.concepto).bombona)
      .sort((a, b) => (b.pago?.fecha || b.fecha) - (a.pago?.fecha || a.fecha));
    const pendientesDespacho = bombonas.filter((s) => s.pago?.estado === "VERIFICADO" && s.estado !== "CULMINADO");
    const vigente = pendientesDespacho[0] || bombonas[0] || null;
    const diasPago = vigente?.pago?.fecha ? diasEntre(vigente.pago.fecha, HOY) : null;
    const pagoReciente = vigente?.pago?.estado === "VERIFICADO" && diasPago <= 14;
    const sinPagoReciente = vigente?.pago?.estado === "VERIFICADO" && diasPago > 14;
    const residencial = segmentoUsuario(u) === "RESIDENCIAL";
    const comunal = residencial && vigente?.modalidadEntrega !== "DIRECTA_COMERCIAL";
    return {
      u, vigente, pendientesDespacho, diasPago, pagoReciente, sinPagoReciente, residencial, comunal,
      tienePendienteDespacho: pendientesDespacho.length > 0,
      bombonasRecibir: comunal ? pendientesDespacho.reduce((a, x) => a + Number(x.cantidad || 0), 0) : 0,
      kgRecibir: comunal ? pendientesDespacho.reduce((a, x) => a + cpt(x.concepto).kg * Number(x.cantidad || 0), 0) : 0,
    };
  }), [miembros, solicitudes]);

  const lista = filas.filter((x) => {
    const txt = `${x.u.nombre} ${x.u.doc} ${x.u.contrato} ${x.u.dir}`.toLowerCase();
    const okQ = !q || txt.includes(q.toLowerCase());
    const okF = filtro === "TODOS"
      || (filtro === "RECIENTE" && x.pagoReciente)
      || (filtro === "ANTIGUO" && x.sinPagoReciente)
      || (filtro === "COMUNAL" && x.comunal)
      || (filtro === "DIRECTO" && !x.comunal);
    return okQ && okF;
  });

  const pagosRecientes = filas.filter((x) => x.pagoReciente).length;
  const pagosAntiguos = filas.filter((x) => x.sinPagoReciente).length;
  const pendientes = filas.filter((x) => x.tienePendienteDespacho).length;
  const directos = filas.filter((x) => x.tienePendienteDespacho && !x.comunal).length;
  const comunales = filas.filter((x) => x.tienePendienteDespacho && x.comunal);
  const bombonas = comunales.reduce((a, x) => a + x.bombonasRecibir, 0);
  const kg = comunales.reduce((a, x) => a + x.kgRecibir, 0);
  const jornadaFecha = comunales.map((x) => x.vigente?.entrega).filter(Boolean).sort((a, b) => a - b)[0] || null;

  const porTipo = comunales.reduce((acc, x) => {
    x.pendientesDespacho.forEach((s) => {
      const c = cpt(s.concepto);
      acc[c.corto] = (acc[c.corto] || 0) + Number(s.cantidad || 0);
    });
    return acc;
  }, {});

  return (
    <div className="cp">
      <Estilos />
      <aside className="cp-side">
        <img src={LOGO_GASLARA} alt="GasLara" className="cp-logo" />
        <div className="cp-role"><Users size={14} /> Portal de comuna</div>
        <div className="cp-name">{COM.nombre}</div>
        <div className="cp-meta"><MapPin size={13} /> {COM.sector}</div>
        <div className="cp-meta"><Building2 size={13} /> Abastece {cdtOf(COM.cdt).nombre}</div>
        <div className="cp-box">
          <span>Responsable comunal</span>
          <b>{COM.coordinador}</b>
          <small><Phone size={12} /> {COM.tel}</small>
        </div>
        <div className="cp-side-note">
          GasLara entrega el lote residencial a la comuna. La comuna recibe una sola vez y luego distribuye las bombonas a sus miembros.
        </div>
        <img src={LOGO_LARA} alt="Gobierno de Lara" className="cp-lara" />
      </aside>

      <main className="cp-main">
        <header className="cp-top">
          <div>
            <div className="cp-eyebrow">ROL COMUNA · {PERIODO.label}</div>
            <h1>Control de miembros y jornada comunal</h1>
            <p>Una sola lista para saber quién pertenece a la comuna, cuándo pagó y qué bombona debe incluirse en la próxima entrega consolidada.</p>
          </div>
          <div className="cp-date">Corte {fechaCorta(HOY)}</div>
        </header>

        <div className="cp-info">
          <ShieldCheck size={18} />
          <div><b>La empresa no reparte casa por casa en el flujo residencial.</b> GasLara entrega todas las bombonas residenciales de esta jornada el mismo día en <strong>{COM.nombre}</strong>; luego la comuna las distribuye a los usuarios. Solo los casos excepcionales o de uso comercial pueden ir por entrega directa.</div>
        </div>

        <section className="cp-kpis">
          <Kpi icon={Users} label="Miembros registrados" value={filas.length} sub="personas asociadas a esta comuna" />
          <Kpi icon={CheckCircle2} label="Pago reciente" value={pagosRecientes} sub="pago verificado en los últimos 14 días" ok />
          <Kpi icon={Clock} label="Sin pago reciente" value={pagosAntiguos} sub="2 pagos tienen más de 14 días, pero siguen vigentes" warn />
          <Kpi icon={Truck} label="Pendientes de despacho" value={pendientes} sub={`${comunales.length} en lote comunal · ${directos} directos`} warn />
          <Kpi icon={Package} label="Lote de la comuna" value={bombonas} sub={`${num(kg)} kg · una sola recepción`} />
        </section>

        {jornadaFecha && <div className="cp-info"><Truck size={18}/><div><b>Próxima jornada comunal: {fechaCorta(jornadaFecha)}.</b> Las {bombonas} bombonas residenciales se entregan juntas a {COM.coordinador}. Las filas individuales solo indican a qué persona corresponde cada bombona después de que la comuna recibe el lote.</div></div>}

        <section className="cp-card">
          <div className="cp-card-h">
            <div><h2>Personas pertenecientes a la comuna</h2><span>{lista.length} de {filas.length} miembros</span></div>
            <div className="cp-tools">
              <div className="cp-search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, cédula o contrato" /></div>
              <div className="cp-tabs">
                <button className={filtro === "TODOS" ? "on" : ""} onClick={() => setFiltro("TODOS")}>Todos</button>
                <button className={filtro === "RECIENTE" ? "on" : ""} onClick={() => setFiltro("RECIENTE")}>Pago reciente</button>
                <button className={filtro === "ANTIGUO" ? "on" : ""} onClick={() => setFiltro("ANTIGUO")}>+14 días</button>
                <button className={filtro === "COMUNAL" ? "on" : ""} onClick={() => setFiltro("COMUNAL")}>Jornada comunal</button>
                <button className={filtro === "DIRECTO" ? "on" : ""} onClick={() => setFiltro("DIRECTO")}>Directos</button>
              </div>
            </div>
          </div>
          <div className="cp-scroll">
            <table>
              <thead><tr><th>Usuario</th><th>Documento</th><th>Contrato</th><th>Bombona</th><th>Pago</th><th>Modalidad</th><th>Despacho</th><th>Estatus</th></tr></thead>
              <tbody>
                {lista.map(({ u, vigente, pagoReciente, sinPagoReciente, diasPago, comunal, tienePendienteDespacho }) => (
                  <tr key={u.id}>
                    <td><b>{u.nombre}</b><span className="cp-sub">{u.dir}</span></td>
                    <td className="mono">{u.doc}</td>
                    <td className="mono">{u.contrato}</td>
                    <td>{vigente ? <><b>{cpt(vigente.concepto).corto}</b><span className="cp-sub">{num(vigente.cantidad)} bombona · {vigente.id}</span></> : <span className="muted">Sin solicitud</span>}</td>
                    <td>{sinPagoReciente
                      ? <><span className="cp-chip wait"><Clock size={12}/> Sin pago reciente · +14 días</span><span className="cp-sub">Pago anterior verificado {fechaCorta(vigente.pago.fecha)} · {diasPago} días</span></>
                      : pagoReciente
                        ? <><span className="cp-chip ok"><CheckCircle2 size={12}/> Pagó</span><span className="cp-sub">Verificado {fechaCorta(vigente.pago.fecha)}</span></>
                        : <span className="cp-chip wait"><Clock size={12}/> Sin pago reciente</span>}</td>
                    <td>{comunal ? <span className="cp-chip na"><Users size={12}/> Jornada comunal</span> : <span className="cp-chip na"><Truck size={12}/> Directo comercial</span>}</td>
                    <td>{tienePendienteDespacho
                      ? <><span className="cp-chip wait"><Truck size={12}/> Pendiente</span><span className="cp-sub">{comunal ? `Entrega a comuna · ${fechaCorta(vigente.entrega)}` : `Entrega directa · ${fechaCorta(vigente.entrega)}`}</span></>
                      : vigente?.estado === "CULMINADO" ? <span className="cp-chip ok">Entregado</span> : <span className="muted">—</span>}</td>
                    <td>{vigente ? <span className="cp-status">{fase(vigente.estado).cliente}</span> : <span className="muted">Pendiente</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="cp-grid" style={{marginTop:14}}>
          <section className="cp-card cp-wide">
            <div className="cp-card-h simple"><div><h2>Lote residencial de la próxima jornada</h2><span>Un solo punto de recepción para todos los miembros residenciales incluidos</span></div><Truck size={18} /></div>
            <div className="cp-recepcion">
              <div className="cp-re-big">{bombonas}</div>
              <div><b>bombonas</b><span>{num(kg)} kg de GLP · {jornadaFecha ? fechaCorta(jornadaFecha) : "por programar"}</span></div>
            </div>
            <div className="cp-types">
              {Object.keys(porTipo).length ? Object.entries(porTipo).map(([tipo, n]) => <div key={tipo}><span>{tipo}</span><b>{n}</b></div>) : <div className="muted">Sin carga comunal programada.</div>}
            </div>
            <div className="cp-dest"><MapPin size={15} /><div><span>GasLara entrega aquí, no en cada vivienda</span><b>{COM.punto}</b></div></div>
          </section>

          <section className="cp-card">
            <div className="cp-card-h simple"><div><h2>Regla operativa</h2><span>Sin duplicar el control</span></div><UserRoundCheck size={18} /></div>
            <div className="cp-rules">
              <div><CircleDollarSign size={16} /><span><b>Persona</b> solicita y paga individualmente.</span></div>
              <div><Package size={16} /><span><b>Sistema</b> consolida las bombonas pagadas de la comuna.</span></div>
              <div><Truck size={16} /><span><b>GasLara / EPSDC</b> lleva el lote completo al centro comunal el mismo día.</span></div>
              <div><Users size={16} /><span><b>Comuna</b> recibe y entrega cada bombona a la persona registrada.</span></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, ok, warn }) {
  return <div className={`cp-kpi ${ok ? "ok" : ""} ${warn ? "warn" : ""}`}><div className="cp-kpi-i"><Icon size={18} /></div><div><span>{label}</span><b>{value}</b><small>{sub}</small></div></div>;
}

function Estilos() {
  return <style>{`
.cp{--ink:#17231f;--muted:#71817b;--line:#e4ebe7;--bg:#f5f8f6;--green:#238b59;--green2:#e7f5ed;--amber:#b77819;--amber2:#fff4dc;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:calc(100vh - 46px);display:grid;grid-template-columns:245px 1fr}
.cp *{box-sizing:border-box}.cp-side{background:#10231c;color:#dbe8e2;padding:28px 22px;display:flex;flex-direction:column;min-height:calc(100vh - 46px)}
.cp-logo{width:145px;max-width:100%;margin-bottom:25px}.cp-role{display:flex;gap:7px;align-items:center;color:#8fc9aa;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.cp-name{font-size:20px;font-weight:760;line-height:1.2;margin:9px 0 13px}.cp-meta{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#a9bcb4;margin:5px 0}.cp-meta svg{flex:none;margin-top:2px}.cp-box{margin-top:22px;background:#19352a;border:1px solid #264b3b;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}.cp-box span{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#80a996}.cp-box b{font-size:13px}.cp-box small{display:flex;gap:6px;align-items:center;color:#a9bcb4;margin-top:4px}.cp-side-note{font-size:11.5px;line-height:1.5;color:#80978e;margin-top:18px}.cp-lara{width:95px;margin-top:auto;opacity:.88;padding-top:25px}
.cp-main{padding:30px 34px 45px;min-width:0}.cp-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:18px}.cp-eyebrow{font-size:11px;font-weight:750;color:var(--green);letter-spacing:.08em}.cp-top h1{font-size:28px;letter-spacing:-.6px;margin:5px 0}.cp-top p{margin:0;color:var(--muted);font-size:13.5px}.cp-date{background:#fff;border:1px solid var(--line);padding:9px 12px;border-radius:9px;font-size:12px;color:var(--muted)}
.cp-info{display:flex;gap:10px;align-items:center;background:#eaf6f0;border:1px solid #cde9db;color:#315d48;border-radius:11px;padding:12px 14px;font-size:12.5px;margin-bottom:18px}.cp-info svg{color:var(--green);flex:none}.cp-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px}.cp-kpi{background:#fff;border:1px solid var(--line);border-radius:13px;padding:15px;display:flex;gap:12px;align-items:flex-start}.cp-kpi-i{width:34px;height:34px;border-radius:9px;background:#edf3f0;display:grid;place-items:center;color:#46665a}.cp-kpi.ok .cp-kpi-i{background:var(--green2);color:var(--green)}.cp-kpi.warn .cp-kpi-i{background:var(--amber2);color:var(--amber)}.cp-kpi span{display:block;font-size:11px;color:var(--muted);margin-bottom:3px}.cp-kpi b{display:block;font-size:25px;line-height:1}.cp-kpi small{display:block;font-size:10.5px;color:#8a9993;margin-top:5px}
.cp-grid{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:15px}.cp-card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}.cp-card-h{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:15px 16px;border-bottom:1px solid var(--line)}.cp-card-h.simple{padding-bottom:12px}.cp-card-h h2{font-size:14px;margin:0 0 2px}.cp-card-h span{font-size:10.5px;color:var(--muted)}.cp-tools{display:flex;align-items:center;gap:8px}.cp-search{height:32px;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;gap:6px;padding:0 9px;color:#91a09a}.cp-search input{border:0;outline:0;width:190px;font:inherit;font-size:11.5px}.cp-tabs{display:flex;background:#f0f4f2;padding:3px;border-radius:8px}.cp-tabs button{border:0;background:none;padding:5px 8px;border-radius:6px;font-size:10.5px;color:#71817b;cursor:pointer}.cp-tabs button.on{background:#fff;color:var(--ink);font-weight:700;box-shadow:0 1px 3px #0000000d}
.cp-scroll{overflow:auto}.cp table{border-collapse:collapse;width:100%;min-width:1010px}.cp th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#84938d;background:#fafcfb;padding:9px 11px;border-bottom:1px solid var(--line)}.cp td{font-size:11.5px;padding:11px;border-bottom:1px solid #edf1ef;vertical-align:middle}.cp td b{font-size:11.5px}.cp-sub{display:block;color:#8b9994;font-size:9.8px;margin-top:3px}.cp-dir{display:block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mono{font-family:"SFMono-Regular",Consolas,monospace}.center{text-align:center}.muted{color:#9aa6a2}.cp-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap}.cp-chip.ok{background:var(--green2);color:#197244}.cp-chip.wait{background:var(--amber2);color:#945b0c}.cp-chip.na{background:#eef1f0;color:#64736d}.cp-chip.late{background:#fbe8e6;color:#a22b24}.cp-status{font-size:10.5px;color:#50635b}
.cp-right{display:flex;flex-direction:column;gap:15px}.cp-recepcion{display:flex;align-items:center;gap:12px;padding:18px 16px 12px}.cp-re-big{font-size:39px;line-height:1;font-weight:790;color:var(--green)}.cp-recepcion b,.cp-recepcion span{display:block}.cp-recepcion b{font-size:13px}.cp-recepcion span{font-size:11px;color:var(--muted);margin-top:2px}.cp-types{padding:0 16px 14px}.cp-types>div{display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #edf1ef;font-size:11px}.cp-types b{font-size:12px}.cp-dest{margin:0 16px 16px;border-radius:10px;background:#f4f7f5;padding:11px;display:flex;gap:8px}.cp-dest svg{color:var(--green);flex:none}.cp-dest span,.cp-dest b{display:block}.cp-dest span{font-size:9.5px;color:var(--muted);margin-bottom:2px}.cp-dest b{font-size:11px;line-height:1.35}.cp-rules{padding:7px 16px 15px}.cp-rules>div{display:flex;gap:9px;align-items:flex-start;border-top:1px solid #edf1ef;padding:10px 0;font-size:11.2px;line-height:1.45;color:#53655e}.cp-rules svg{color:var(--green);flex:none;margin-top:1px}.cp-rules b{color:var(--ink)}
@media(max-width:1100px){.cp{grid-template-columns:1fr}.cp-side{min-height:auto;display:none}.cp-kpis{grid-template-columns:repeat(2,1fr)}.cp-grid{grid-template-columns:1fr}.cp-right{display:grid;grid-template-columns:1fr 1fr}.cp-main{padding:22px}}
@media(max-width:700px){.cp-main{padding:16px}.cp-top{display:block}.cp-date{display:inline-block;margin-top:12px}.cp-kpis{grid-template-columns:1fr 1fr}.cp-tools{align-items:stretch;flex-direction:column}.cp-search input{width:100%}.cp-right{grid-template-columns:1fr}.cp-card-h{align-items:flex-start;flex-direction:column}.cp-top h1{font-size:23px}}
`}</style>;
}
