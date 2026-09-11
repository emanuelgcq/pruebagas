import React, { useMemo, useState } from "react";
import {
  Users, Search, CheckCircle2, Clock, Package, Truck, AlertTriangle, History,
  UserRoundCheck, ShieldCheck,
} from "lucide-react";
import {
  HOY, COMUNA_PORTAL, USUARIOS, cdtOf, cpt, num, diasEntre, segmentoUsuario,
} from "./datos.jsx";
import { KgL, UnidadesStyles } from "./Unidades.jsx";

/* ════════════════════════════════════════════════════════════════
   ROL COMUNA · dentro del portal del usuario

   El Portal Comuna dejó de ser una cara aparte el 01/09/2026. Nunca fue un sistema
   distinto: es el mismo portal visto por alguien con un permiso más. El coordinador
   de una comuna es, antes que nada, un usuario con su contrato y su bombona; lo que
   cambia es que además responde por el lote que recibe en custodia.

   Por eso vive aquí como permisología: quien tiene el rol ve, encima de sus propias
   secciones, la gestión de su comuna. Quien no lo tiene, no la ve.

   La comuna es CONSIGNATARIA: recibe mercancía de GasLara y responde ante la empresa
   por lo que no entregue. Estas pantallas registran esa segunda custodia —comuna →
   persona— que el cierre del AD no alcanza a cubrir.
   ════════════════════════════════════════════════════════════════ */

const COM = COMUNA_PORTAL;

/** Las filas que comparten las cuatro vistas: cada miembro con su pedido vigente. */
export function useFilasComuna(solicitudes) {
  const miembros = useMemo(() => USUARIOS.filter((u) => u.comuna === COM.id), []);
  return useMemo(() => miembros.map((u, i) => {
    const bombonas = solicitudes
      .filter((s) => s.usuario === u.id && cpt(s.concepto).bombona)
      .sort((a, b) => (b.pago?.fecha || b.fecha) - (a.pago?.fecha || a.fecha));
    const pendientes = bombonas.filter((s) => s.pago?.estado === "VERIFICADO" && s.estado !== "CULMINADO");
    const vigente = pendientes[0] || bombonas[0] || null;
    const dias = vigente?.pago?.fecha ? diasEntre(vigente.pago.fecha, HOY) : null;
    const comunal = segmentoUsuario(u) === "RESIDENCIAL" && vigente?.modalidadEntrega !== "DIRECTA_COMERCIAL";
    return {
      u, vigente, pendientes, dias, comunal,
      bombonas: pendientes.reduce((a, x) => a + Number(x.cantidad || 0), 0),
      kg: pendientes.reduce((a, x) => a + cpt(x.concepto).kg * Number(x.cantidad || 0), 0),
      seedEstado: i % 7 === 0 ? "PENDIENTE" : i % 11 === 0 ? "INCIDENCIA" : "RETIRADA",
    };
  }), [miembros, solicitudes]);
}

export const NAV_COMUNA = [
  { id: "com-miembros", label: "Miembros de la comuna", icon: Users },
  { id: "com-recepcion", label: "Recepción de jornada", icon: Truck },
  { id: "com-entrega", label: "Entrega a miembros", icon: UserRoundCheck },
  { id: "com-jornadas", label: "Histórico de jornadas", icon: History },
];

export function CabeceraComuna() {
  return (
    <div className="rc-cab">
      <ShieldCheck size={17} />
      <div>
        <b>Actúas como consignatario de {COM.nombre}</b>
        <span>GasLara entrega el lote a la comuna y la comuna responde ante la empresa por lo
          que reciba y no entregue. Estas pantallas registran la segunda custodia: de la
          comuna a cada persona. Coordina {COM.coordinador} · {cdtOf(COM.cdt).nombre}.</span>
      </div>
    </div>
  );
}

export function MiembrosComuna({ filas, entregas }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const lista = filas.filter((x) => (
    (!q || `${x.u.nombre} ${x.u.doc} ${x.u.contrato}`.toLowerCase().includes(q.toLowerCase()))
    && (filtro === "TODOS"
      || (filtro === "PAGADOS" && x.vigente?.pago?.estado === "VERIFICADO")
      || (filtro === "PENDIENTES" && x.pendientes.length)
      || (filtro === "RETIRADOS" && entregas[x.u.id] === "RETIRADA"))
  ));
  const lote = filas.filter((x) => x.comunal && x.pendientes.length);
  const kg = lote.reduce((a, x) => a + x.kg, 0);

  return (
    <>
      <RolComunaStyles /><UnidadesStyles />
      <CabeceraComuna />
      <div className="rc-kpis">
        <K icon={Users} l="Miembros" v={filas.length} s="registrados en la comuna" />
        <K icon={CheckCircle2} l="Pagos verificados" v={filas.filter((x) => x.vigente?.pago?.estado === "VERIFICADO").length} s="último ciclo" />
        <K icon={Truck} l="Pendientes de despacho" v={filas.filter((x) => x.pendientes.length).length} s="personas" />
        <K icon={Package} l="Lote previsto" v={lote.reduce((a, x) => a + x.bombonas, 0)} s={<KgL kg={kg} />} />
      </div>

      <section className="rc-card">
        <div className="rc-tools">
          <div className="rc-search"><Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, cédula o contrato" /></div>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="PAGADOS">Pagados</option>
            <option value="PENDIENTES">Pendientes de despacho</option>
            <option value="RETIRADOS">Ya retiraron</option>
          </select>
        </div>
        <div className="rc-scroll">
          <table>
            <thead><tr>
              <th>Usuario</th><th>Documento</th><th>Contrato</th><th>Bombona</th>
              <th>Pago</th><th>Despacho GasLara</th><th>Entrega final</th>
            </tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.u.id}>
                  <td><b>{x.u.nombre}</b><span>{x.u.dir}</span></td>
                  <td>{x.u.doc}</td>
                  <td>{x.u.contrato}</td>
                  <td>{x.vigente ? <><b>{cpt(x.vigente.concepto).corto}</b><span>{x.vigente.id}</span></> : "—"}</td>
                  <td>{x.vigente?.pago?.estado === "VERIFICADO"
                    ? <span className="rc-chip ok">Verificado</span>
                    : <span className="rc-chip wait">Sin pago</span>}</td>
                  <td>{x.pendientes.length
                    ? <span className="rc-chip wait">Pendiente / en jornada</span>
                    : <span className="rc-chip ok">Recibido</span>}</td>
                  <td><span className={`rc-chip ${entregas[x.u.id] === "RETIRADA" ? "ok" : entregas[x.u.id] === "INCIDENCIA" ? "bad" : "wait"}`}>
                    {entregas[x.u.id]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!lista.length && <div className="rc-vacio">Ningún miembro coincide con el filtro.</div>}
      </section>
    </>
  );
}

export function RecepcionComuna({ filas, recepcion, setRecepcion }) {
  const lote = filas.filter((x) => x.comunal && x.pendientes.length);
  const bomb = lote.reduce((a, x) => a + x.bombonas, 0);
  const kg = lote.reduce((a, x) => a + x.kg, 0);
  const plan = Math.max(bomb, recepcion.plan);

  return (
    <>
      <RolComunaStyles /><UnidadesStyles />
      <CabeceraComuna />
      <div className="rc-kpis">
        <K icon={Package} l="Planificado" v={plan} s={<KgL kg={kg} />} />
        <K icon={Truck} l="Recibido" v={recepcion.recibido} s="cilindros" />
        <K icon={AlertTriangle} l="Diferencia" v={Math.max(0, plan - recepcion.recibido)} s="pendiente por recibir" />
        <K icon={Users} l="Personas de la jornada" v={lote.length} s="con solicitud pagada" />
      </div>

      <section className="rc-card">
        <div className="rc-head">
          <div><span>JORNADA 14/08/2026</span><h3>Recepción del lote comunal</h3>
            <p>AD-76542 · placa A73KD2 · condujo José Manuel Rodríguez</p></div>
          <span className={recepcion.confirmada ? "rc-ok" : "rc-wait"}>
            {recepcion.confirmada ? "Recepción confirmada" : "Pendiente de confirmar"}</span>
        </div>

        <div className="rc-load">
          <div><span>10 kg</span><b>{Math.max(0, plan - 4)}</b></div>
          <div><span>18 kg</span><b>4</b></div>
          <div><span>27 kg</span><b>0</b></div>
          <div><span>43 kg</span><b>0</b></div>
        </div>

        <div className="rc-receive">
          <label>Planificado<input value={plan} readOnly /></label>
          <label>Recibido realmente<input type="number" value={recepcion.recibido}
            onChange={(e) => setRecepcion({ ...recepcion, recibido: Number(e.target.value) })} /></label>
          <label>Responsable<input value={COM.coordinador} readOnly /></label>
          <label>Cédula<input value="V-11.824.561" readOnly /></label>
        </div>
        <label className="rc-obs">Observación
          <textarea value={recepcion.obs} onChange={(e) => setRecepcion({ ...recepcion, obs: e.target.value })} /></label>
        <div className="rc-proof">
          <div>Firma de recepción · demo</div>
          <div>Soporte fotográfico · demo</div>
          <div>14:40 · Punto comunal</div>
        </div>
        <button className="rc-primary" onClick={() => setRecepcion({ ...recepcion, confirmada: true })}>
          <CheckCircle2 size={15} /> Confirmar recepción del lote
        </button>
      </section>
    </>
  );
}

export function EntregaComuna({ filas, entregas, setEntregas, registrarRetiroComuna }) {
  const [q, setQ] = useState("");
  const rows = filas.filter((x) => !q || `${x.u.nombre} ${x.u.doc}`.toLowerCase().includes(q.toLowerCase()));
  const ret = filas.filter((x) => entregas[x.u.id] === "RETIRADA").length;
  const pend = filas.filter((x) => entregas[x.u.id] === "PENDIENTE").length;
  const inc = filas.filter((x) => entregas[x.u.id] === "INCIDENCIA").length;

  const change = (id, st) => {
    setEntregas({ ...entregas, [id]: st });
    registrarRetiroComuna?.(id, st, {
      observacion: st === "INCIDENCIA" ? "Incidencia registrada por la comuna"
        : st === "PENDIENTE" ? "Usuario no retiró en la jornada"
        : "Entrega final confirmada",
    });
  };

  return (
    <>
      <RolComunaStyles /><UnidadesStyles />
      <CabeceraComuna />
      <div className="rc-kpis">
        <K icon={CheckCircle2} l="Retiradas" v={ret} s="entregas finales" />
        <K icon={Clock} l="Pendientes" v={pend} s="aún en la comuna" />
        <K icon={AlertTriangle} l="Incidencias" v={inc} s="requieren revisión" />
        <K icon={Users} l="Total controlado" v={filas.length} s="miembros" />
      </div>

      <section className="rc-card">
        <div className="rc-head">
          <div><h3>Entrega persona por persona</h3>
            <p>El lote ya llegó a la comuna. Aquí se registra la entrega final al ciudadano —
              lo que la comuna aún no entrega, sigue bajo su responsabilidad.</p></div>
          <div className="rc-search"><Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona" /></div>
        </div>
        <div className="rc-lista">
          {rows.map((x) => (
            <article key={x.u.id}>
              <div><b>{x.u.nombre}</b>
                <span>{x.u.doc} · {x.vigente ? cpt(x.vigente.concepto).corto : "Sin solicitud"}</span></div>
              <em className={String(entregas[x.u.id]).toLowerCase()}>{entregas[x.u.id]}</em>
              <div className="rc-btns">
                <button onClick={() => change(x.u.id, "RETIRADA")}>Entregada</button>
                <button onClick={() => change(x.u.id, "PENDIENTE")}>No retiró</button>
                <button onClick={() => change(x.u.id, "INCIDENCIA")}>Incidencia</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export function JornadasComuna() {
  const rows = [
    ["14/08/2026", "AD-76542", 300, 278, 20, 2],
    ["28/07/2026", "AD-74881", 286, 286, 0, 0],
    ["12/07/2026", "AD-73194", 302, 300, 0, 2],
    ["18/06/2026", "AD-71210", 274, 271, 3, 0],
  ];
  return (
    <>
      <RolComunaStyles />
      <CabeceraComuna />
      <section className="rc-card">
        <div className="rc-head">
          <div><h3>Histórico de jornadas</h3>
            <p>Recepción del lote y distribución final a los miembros de la comuna.</p></div>
        </div>
        <div className="rc-history">
          {rows.map((r) => (
            <article key={r[0]}>
              <div><span>{r[0]}</span><b>{r[1]}</b></div>
              <div><span>Recibidos</span><b>{num(r[2])}</b></div>
              <div><span>Retirados</span><b>{num(r[3])}</b></div>
              <div><span>Pendientes</span><b>{num(r[4])}</b></div>
              <div><span>Incidencias</span><b>{num(r[5])}</b></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function K({ icon: I, l, v, s }) {
  return <div className="rc-k"><I size={17} /><span>{l}</span><b>{num(v)}</b><small>{s}</small></div>;
}

export function RolComunaStyles() {
  return <style>{`
.rc-cab{display:flex;gap:11px;background:#EDF5F0;border:1px solid #D6E7DD;border-radius:12px;padding:14px;margin-bottom:16px}
.rc-cab svg{color:#17623F;flex:none;margin-top:1px}
.rc-cab b{display:block;font-size:13.5px;font-weight:650;color:#17623F;line-height:1.4}
.rc-cab span{display:block;font-size:12.5px;color:#3A464E;line-height:1.6;margin-top:4px}
.rc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:11px;margin-bottom:16px}
.rc-k{background:#fff;border:1px solid #E0E6E9;border-radius:13px;padding:14px}
.rc-k svg{color:#20714A}
.rc-k span{display:block;font-size:11px;color:#75828B;font-weight:600;margin-top:6px}
.rc-k b{display:block;font-size:23px;font-weight:660;margin:3px 0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.rc-k small{display:block;font-size:11.5px;color:#75828B;line-height:1.4}
.rc-card{background:#fff;border:1px solid #E0E6E9;border-radius:13px;padding:16px}
.rc-tools,.rc-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.rc-head span{font-size:11px;font-weight:700;color:#26704C;letter-spacing:.04em}
.rc-head h3{font-size:16px;margin:4px 0;font-weight:650}
.rc-head p{font-size:12.5px;color:#74818B;margin:0;line-height:1.55;max-width:640px}
.rc-search{display:flex;align-items:center;gap:7px;border:1px solid #DBE3E7;border-radius:9px;padding:9px 11px;min-width:270px}
.rc-search input{border:0;outline:0;width:100%;font-size:13px;font-family:inherit}
.rc-tools select{border:1px solid #DBE3E7;border-radius:9px;padding:9px 11px;background:#fff;font-size:13px;font-family:inherit}
.rc-scroll{overflow:auto;border:1px solid #E4E9EC;border-radius:10px}
.rc-scroll table{width:100%;border-collapse:collapse;font-size:12.5px}
.rc-scroll th,.rc-scroll td{padding:11px 12px;border-bottom:1px solid #E9EDEF;text-align:left;white-space:nowrap}
.rc-scroll th{background:#F5F7F8;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#6D7982;font-weight:700}
.rc-scroll td b,.rc-scroll td span{display:block}
.rc-scroll td span{font-size:11.5px;color:#74818B;margin-top:2px}
.rc-chip{display:inline-flex;padding:5px 9px;border-radius:99px;font-size:11px;font-weight:650}
.rc-chip.ok,.rc-ok{background:#E8F5ED;color:#216B48}
.rc-chip.wait,.rc-wait{background:#FFF1DC;color:#925F19}
.rc-chip.bad{background:#FBE9E9;color:#944141}
.rc-ok,.rc-wait{padding:7px 11px;border-radius:99px;font-weight:650;font-size:11.5px;white-space:nowrap}
.rc-load{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:9px;margin:14px 0}
.rc-load>div{background:#F5F7F8;border-radius:9px;padding:11px}
.rc-load span{display:block;font-size:11px;color:#75828B}
.rc-load b{display:block;font-size:18px;margin-top:3px;font-variant-numeric:tabular-nums}
.rc-receive{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
.rc-receive label,.rc-obs{font-size:11px;color:#697780;font-weight:600}
.rc-receive input,.rc-obs textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #D9E1E5;border-radius:9px;padding:10px;margin-top:5px;font-size:13px;font-family:inherit}
.rc-obs{display:block;margin-top:12px}
.rc-obs textarea{min-height:70px}
.rc-proof{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:12px 0}
.rc-proof>div{border:1px dashed #CBD5DA;background:#F7F9FA;border-radius:9px;padding:16px;text-align:center;font-size:11.5px;color:#74818B}
.rc-primary{border:0;background:#17623F;color:#fff;border-radius:9px;padding:11px 15px;font-size:12.5px;font-weight:650;display:flex;gap:7px;align-items:center;margin-left:auto;cursor:pointer}
.rc-lista{display:flex;flex-direction:column;gap:8px}
.rc-lista article{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;border:1px solid #E4E9EC;border-radius:10px;padding:11px 13px;flex-wrap:wrap}
.rc-lista b,.rc-lista span{display:block;font-size:12.5px}
.rc-lista span{color:#74818B;margin-top:2px}
.rc-lista em{font-style:normal;font-size:10.5px;font-weight:700;background:#EEF2F4;padding:5px 9px;border-radius:99px;white-space:nowrap}
.rc-lista em.retirada{background:#E8F5ED;color:#216B48}
.rc-lista em.incidencia{background:#FBE9E9;color:#944141}
.rc-btns{display:flex;gap:5px;flex-wrap:wrap}
.rc-lista button{border:0;background:#EEF2F4;border-radius:8px;padding:7px 10px;font-size:11.5px;font-weight:600;color:#516069;cursor:pointer}
.rc-lista button:hover{background:#E2E8EB}
.rc-history{display:flex;flex-direction:column;gap:8px}
.rc-history article{display:grid;grid-template-columns:1.3fr repeat(4,.8fr);gap:12px;align-items:center;border:1px solid #E4E9EC;border-radius:10px;padding:12px 13px}
.rc-history span,.rc-history b{display:block;font-size:11.5px}
.rc-history span{color:#74818B}
.rc-history b{font-size:14px;margin-top:2px;font-variant-numeric:tabular-nums}
.rc-vacio{text-align:center;padding:36px;color:#78868F;font-size:13px}
@media(max-width:820px){.rc-history article{grid-template-columns:1fr 1fr}}
`}</style>;
}
