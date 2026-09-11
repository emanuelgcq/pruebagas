import React, { useMemo, useState } from "react";
import { KgL, UnidadesStyles } from "./Unidades.jsx";
import {
  Search, Check, X, AlertTriangle, PackageX, Wrench, UserX, CircleSlash,
  Container, ChevronRight, ClipboardCheck, Users, Fuel, ShieldCheck, MapPin,
} from "lucide-react";
import {
  MOTIVOS_NO_ENTREGA, motivoNoEntrega, cpt, usr, bs, num, kgALitros,
  envasesDe, validarCanje, kgDeSolicitud, EXIGE_ENVASE_PARA_CANJE,
} from "./datos.jsx";

const ICONO_MOTIVO = {
  NO_ESTABA: UserX, SIN_ENVASE: Container, FORMATO_NO_DISPONIBLE: PackageX,
  DIRECCION_NO_UBICADA: MapPin, RECHAZO: CircleSlash, CANCELADO: CircleSlash, DEFECTUOSO: Wrench,
};

/**
 * CIERRE DEL AD · PERSONA POR PERSONA
 *
 * Lo cierra el gerente de Distribución, no el conductor. El conductor ejecuta la ruta
 * y reporta lo que pasó; quien firma el cierre —y con él la facturación, la salida de
 * inventario y los abonos— es Distribución, que responde por la AD que planificó.
 *
 * Una AD lleva ciento y pico de personas. Antes solo había cuatro contadores —uno por
 * tamaño de cilindro— y un texto libre para toda la ruta, así que era imposible decir
 * quién no recibió y por qué.
 *
 * Aquí cada persona es una fila: se confirma entregada o no entregada con motivo
 * tipificado, y cada motivo produce su consecuencia al cerrar:
 *   entregada  → factura al precio del despacho, BOP, salida de inventario y canje de envase
 *   no estaba  → abono a su código, el GLP se libera
 *   defectuoso → reposición física, sin abono, el envase entra a taller
 *
 * El gerente llega con la propuesta ya armada —quien tiene pago verificado y envase apto
 * viene marcado como entregado— y su trabajo es confirmar o corregir contra lo que el
 * conductor reportó, no teclear ciento y pico de veces.
 */
export default function CierreAD({ ruta, pedidos = [], parqueEnvases = [], onCerrar, onCancelar }) {
  const [marcas, setMarcas] = useState(() => {
    /* Todos arrancan como entregados. Quien pagó tiene derecho a su gas; lo que impide
       la entrega se descubre en el punto —no llevó su bombona, no estaba, la bombona
       resultó mala— y eso lo reporta el conductor. Pre-marcar a alguien como «sin
       envase» antes de la jornada es inventarse un dato que todavía nadie recogió. */
    const inicial = {};
    pedidos.forEach((p) => {
      inicial[p.id] = { entregada: true, motivo: null, envaseRecibido: true, observacion: "" };
    });
    return inicial;
  });
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [detalle, setDetalle] = useState(null);
  const [receptor, setReceptor] = useState(ruta?.receptorComunal || "María Elena González");
  const [cedulaReceptor, setCedulaReceptor] = useState("V-12.458.921");
  const [confirmando, setConfirmando] = useState(false);

  const entregadas = pedidos.filter((p) => marcas[p.id]?.entregada);
  const noEntregadas = pedidos.filter((p) => !marcas[p.id]?.entregada);
  // Las que se recogieron y no admitieron llenado: vuelven vacías y van a taller.
  const noLlenables = noEntregadas.filter((p) => marcas[p.id]?.motivo === "DEFECTUOSO");
  // Quien no llevó su bombona al punto no entra en la recolección: no hubo qué recoger.
  const noLlevaron = noEntregadas.filter((p) => marcas[p.id]?.motivo === "SIN_ENVASE");
  const recogidas = pedidos.length - noLlevaron.length;
  const devueltas = entregadas.length;
  const conAbono = noEntregadas.filter((p) => motivoNoEntrega(marcas[p.id]?.motivo).consecuencia === "ABONO");
  const kgEntregado = entregadas.reduce((a, p) => a + kgDeSolicitud(p), 0);
  const facturado = entregadas.reduce((a, p) => a + Number(p.total || 0), 0);
  const abonado = conAbono.reduce((a, p) => a + Number(p.total || 0), 0);
  const envasesRecibidos = entregadas.filter((p) => marcas[p.id]?.envaseRecibido).length;

  const visibles = useMemo(() => pedidos.filter((p) => {
    const m = marcas[p.id] || {};
    const okQ = !q || `${usr(p.usuario).nombre} ${usr(p.usuario).doc} ${p.id}`.toLowerCase().includes(q.toLowerCase());
    const okF = filtro === "TODOS"
      || (filtro === "ENTREGADAS" && m.entregada)
      || (filtro === "PENDIENTES" && !m.entregada)
      || (filtro === "SIN_ENVASE" && m.motivo === "SIN_ENVASE")
      || (filtro === "DEFECTUOSO" && m.motivo === "DEFECTUOSO");
    return okQ && okF;
  }), [pedidos, marcas, q, filtro]);

  const marcar = (id, cambios) => setMarcas((m) => ({ ...m, [id]: { ...m[id], ...cambios } }));

  const entregarTodas = () => setMarcas((m) => {
    const n = { ...m };
    visibles.forEach((p) => { n[p.id] = { entregada: true, motivo: null, envaseRecibido: true, observacion: "" }; });
    return n;
  });

  function confirmar() {
    onCerrar(
      pedidos.map((p) => ({ solicitudId: p.id, ...marcas[p.id] })),
      { receptor, cedula: cedulaReceptor, hora: "14:40", firma: "Firma registrada · demo" }
    );
  }

  return (
    <div className="oj">
      <JornadaStyles />
      <UnidadesStyles />

      <header className="oj-head">
        <div>
          <span>CIERRE DE AD {ruta?.ad} · GERENCIA DE DISTRIBUCIÓN</span>
          <h2>{ruta?.comunidad}</h2>
          <p>{ruta?.comuna} · {pedidos.length} personas · placa {ruta?.unidad} · condujo {ruta?.conductor}
            {ruta?.ayudante ? ` con ${ruta.ayudante}` : ""}</p>
        </div>
        <button className="oj-x" onClick={onCancelar}><X size={18} /></button>
      </header>

      <div className="oj-resumen">
        <div><span>Bombonas recogidas</span><b>{recogidas}</b><small>de {pedidos.length} personas convocadas</small></div>
        <div className="ok"><span>Devueltas llenas</span><b>{devueltas}</b><small><KgL kg={kgEntregado} /></small></div>
        <div className="in"><span>No se pudieron llenar</span><b>{noLlenables.length}</b><small>bombonas malas · van a taller</small></div>
        <div className="wr"><span>No llevaron bombona</span><b>{noLlevaron.length}</b><small>no hubo qué recoger</small></div>
        <div className="mn"><span>A facturar</span><b>Bs {bs(facturado)}</b><small>precio del día del despacho</small></div>
        <div className="mn2"><span>A abonar</span><b>Bs {bs(abonado)}</b><small>vuelve al código del usuario</small></div>
      </div>

      <div className="oj-tools">
        <div className="oj-search"><Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, cédula o pedido" /></div>
        <div className="oj-tabs">
          {[["TODOS", `Todos ${pedidos.length}`], ["ENTREGADAS", `Entregadas ${entregadas.length}`],
            ["PENDIENTES", `No entregadas ${noEntregadas.length}`],
            ["SIN_ENVASE", `No llevó bombona ${noLlevaron.length}`],
            ["DEFECTUOSO", `Bombona mala ${noLlenables.length}`]].map(([k, l]) => (
            <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
        <button className="oj-btn" onClick={entregarTodas}><Check size={14} /> Marcar visibles como entregadas</button>
      </div>

      {EXIGE_ENVASE_PARA_CANJE && (
        <div className="oj-regla">
          <Container size={16} />
          <span>La gente lleva su bombona al punto, el operador la recoge, la llena en planta y
            la vuelve a dejar. <b>Salen diez, vuelven diez.</b> Marca aquí a quien no llevó su
            bombona, a quien no estaba, y las bombonas que se recogieron pero no se pudieron
            llenar por estar malas: esas vuelven vacías, entran a taller y el dinero queda
            abonado. Los formatos no se sustituyen entre sí porque la tarifa es por formato.</span>
        </div>
      )}

      <div className="oj-lista">
        {visibles.map((p) => {
          const m = marcas[p.id] || {};
          const u = usr(p.usuario);
          const c = cpt(p.concepto);
          // Antecedente del parque: lo ultimo que el sistema supo de su bombona.
          const canje = validarCanje(envasesDe(parqueEnvases, p.usuario), c.kg);
          const mot = m.entregada ? null : motivoNoEntrega(m.motivo);
          const Ico = mot ? (ICONO_MOTIVO[mot.id] || AlertTriangle) : Check;
          return (
            <article key={p.id} className={`oj-fila ${m.entregada ? "ok" : mot?.envaseATaller ? "rep" : "no"}`}>
              <button className={`oj-check ${m.entregada ? "on" : ""}`}
                onClick={() => marcar(p.id, m.entregada
                  ? { entregada: false, motivo: canje.ok ? "NO_ESTABA" : "SIN_ENVASE", envaseRecibido: false }
                  : { entregada: true, motivo: null, envaseRecibido: canje.ok })}>
                {m.entregada ? <Check size={16} strokeWidth={3} /> : <Ico size={15} />}
              </button>

              <div className="oj-persona">
                <b>{u.nombre}</b>
                <span>{u.doc} · {c.corto} · Bs {bs(p.total)}</span>
              </div>

              <button className="oj-mas" onClick={() => setDetalle(p)}><ChevronRight size={16} /></button>

              <div className="oj-meta">
                <span className="oj-pill fmt"><Container size={11} /> {c.kg} kg</span>
                {!canje.ok && (
                  <span className="oj-pill nota" title={canje.motivo}>
                    Su bombona figuraba en taller
                  </span>
                )}
                {m.entregada
                  ? <span className="oj-pill entregada"><Check size={11} /> Entregada</span>
                  : <select value={m.motivo || "NO_ESTABA"} onChange={(e) => marcar(p.id, { motivo: e.target.value })}>
                      {MOTIVOS_NO_ENTREGA.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>}
              </div>

              <div className="oj-efecto">
                {m.entregada
                  ? <span><b>Factura + BOP</b> · bombona devuelta llena</span>
                  : mot.envaseATaller
                    ? <span><b className="rep">Vuelve vacía</b> · a taller y abona Bs {bs(p.total)}</span>
                    : <span><b className="ab">Abona Bs {bs(p.total)}</b> · el GLP se libera</span>}
              </div>
            </article>
          );
        })}
        {!visibles.length && <div className="oj-vacio">Ninguna persona coincide con el filtro.</div>}
      </div>

      <footer className="oj-foot">
        <div className="oj-receptor">
          <label><span>Recibe en el punto</span>
            <input value={receptor} onChange={(e) => setReceptor(e.target.value)} /></label>
          <label><span>Cédula</span>
            <input value={cedulaReceptor} onChange={(e) => setCedulaReceptor(e.target.value)} /></label>
        </div>
        <div className="oj-acciones">
          <button className="oj-btn" onClick={onCancelar}>Cancelar</button>
          <button className="oj-btn pri" onClick={() => setConfirmando(true)}>
            <ClipboardCheck size={15} /> Cerrar AD
          </button>
        </div>
      </footer>

      {detalle && <FichaPersona p={detalle} marca={marcas[detalle.id]} parque={parqueEnvases}
        onMarcar={(c) => marcar(detalle.id, c)} onClose={() => setDetalle(null)} />}

      {confirmando && (
        <div className="oj-modal-bg" onClick={() => setConfirmando(false)}>
          <div className="oj-modal" onClick={(e) => e.stopPropagation()}>
            <header><h3>Confirmar cierre de AD {ruta?.ad}</h3></header>
            <div className="oj-modal-b">
              <p className="oj-modal-p">Al cerrar ocurre todo esto de una vez, bajo la firma de Distribución.
                La venta se registra al despachar al punto de distribución, y la comuna queda como responsable
                de la mercancía hasta que la reparta.</p>
              <div className="oj-confirm">
                <div><span>Facturas a emitir</span><b>{entregadas.length}</b><small>Bs {bs(facturado)} al precio de hoy</small></div>
                <div><span>Salida de inventario</span><b><KgL kg={kgEntregado} /></b></div>
                <div><span>Bombonas recogidas</span><b>{recogidas}</b><small>devueltas llenas {devueltas}</small></div>
                <div><span>Abonos a generar</span><b>{conAbono.length}</b><small>Bs {bs(abonado)} a sus códigos</small></div>
                <div><span>Bombonas a taller</span><b>{noLlenables.length}</b><small>malas · vuelven vacías y abonan</small></div>
                <div><span>Queda en consignación</span><b>{entregadas.length}</b><small>bajo custodia de la comuna</small></div>
              </div>
              <div className="oj-regla">
                <ShieldCheck size={16} />
                <span>Recibe <b>{receptor}</b>, cédula {cedulaReceptor}. La comuna responde ante la empresa
                  por lo que reciba y no entregue.</span>
              </div>
            </div>
            <footer>
              <button className="oj-btn" onClick={() => setConfirmando(false)}>Volver</button>
              <button className="oj-btn pri" onClick={confirmar}><Check size={15} /> Confirmar y cerrar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function FichaPersona({ p, marca, parque, onMarcar, onClose }) {
  const u = usr(p.usuario);
  const c = cpt(p.concepto);
  const envases = envasesDe(parque, p.usuario);
  return (
    <div className="oj-modal-bg" onClick={onClose}>
      <div className="oj-modal" onClick={(e) => e.stopPropagation()}>
        <header><h3>{u.nombre}</h3><button className="oj-x" onClick={onClose}><X size={17} /></button></header>
        <div className="oj-modal-b">
          <div className="oj-confirm">
            <div><span>Documento</span><b>{u.doc}</b></div>
            <div><span>Pedido</span><b>{p.id}</b></div>
            <div><span>Producto</span><b>{c.corto}</b><small><KgL kg={kgDeSolicitud(p)} /></small></div>
            <div><span>Importe</span><b>Bs {bs(p.total)}</b></div>
            <div><span>Comunidad</span><b>{p.comunidad || u.comunidad || "—"}</b></div>
            <div><span>Pago</span><b>{p.pago?.estado === "VERIFICADO" ? "Verificado" : "Por verificar"}</b><small>{p.pago?.referencia || "—"}</small></div>
          </div>

          <div className="oj-sep">Envases registrados</div>
          {envases.length ? envases.map((e) => (
            <div className="oj-env" key={e.serial}>
              <Container size={15} />
              <div><b>{e.serial}</b><span>{e.kg} kg · {e.motivo || "sin observaciones"}</span></div>
              <span className={`oj-pill ${e.estado === "EN_USUARIO" ? "ok" : "no"}`}>{e.estado.replace(/_/g, " ").toLowerCase()}</span>
            </div>
          )) : <div className="oj-vacio">Sin envases registrados a su nombre.</div>}

          <div className="oj-sep">Resultado de la visita</div>
          <div className="oj-opciones">
            <button className={marca?.entregada ? "on" : ""}
              onClick={() => onMarcar({ entregada: true, motivo: null, envaseRecibido: true })}>
              <Check size={15} /> Entregada
            </button>
            {MOTIVOS_NO_ENTREGA.map((m) => {
              const Ico = ICONO_MOTIVO[m.id] || AlertTriangle;
              return (
                <button key={m.id} className={!marca?.entregada && marca?.motivo === m.id ? "on" : ""}
                  onClick={() => onMarcar({ entregada: false, motivo: m.id, envaseRecibido: false })}>
                  <Ico size={15} /> {m.nombre}
                </button>
              );
            })}
          </div>
          {!marca?.entregada && (
            <div className="oj-consec">
              <AlertTriangle size={15} />
              <span>{motivoNoEntrega(marca?.motivo).desc}</span>
            </div>
          )}
          <label className="oj-obs"><span>Observación del operador</span>
            <textarea rows={2} value={marca?.observacion || ""}
              onChange={(e) => onMarcar({ observacion: e.target.value })}
              placeholder="Lo que haya que dejar por escrito de esta visita" /></label>
        </div>
        <footer><button className="oj-btn pri" onClick={onClose}>Listo</button></footer>
      </div>
    </div>
  );
}

function JornadaStyles() {
  return <style>{`
.oj{position:absolute;inset:0;background:#F5F8F9;z-index:30;display:flex;flex-direction:column;font-family:Inter,Segoe UI,system-ui,sans-serif}
.oj-head{background:#111B22;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex:0 0 auto}
.oj-head span{font-size:9px;font-weight:800;letter-spacing:.06em;color:#7FBFA0}
.oj-head h2{margin:5px 0 3px;font-size:17px;letter-spacing:-.02em}
.oj-head p{margin:0;font-size:10.5px;color:#A8B8C0;line-height:1.45}
.oj-x{border:1px solid #ffffff26;background:#ffffff10;color:#fff;width:30px;height:30px;border-radius:8px;flex:none;cursor:pointer}
.oj-resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:9px;background:#fff;border-bottom:1px solid #E4EAEE;flex:0 0 auto}
.oj-resumen>div{background:#F5F8F9;border-radius:9px;padding:8px;border-left:3px solid #C3CED5}
.oj-resumen>div.ok{border-left-color:#1B7A4C}.oj-resumen>div.ok b{color:#1B7A4C}
.oj-resumen>div.wr{border-left-color:#9A6410}.oj-resumen>div.wr b{color:#9A6410}
.oj-resumen>div.in{border-left-color:#2A5FA6}.oj-resumen>div.in b{color:#2A5FA6}
.oj-resumen>div.mn{border-left-color:#17623F}.oj-resumen>div.mn b{color:#17623F}
.oj-resumen>div.mn2{border-left-color:#A83E3E}.oj-resumen>div.mn2 b{color:#A83E3E}
.oj-resumen span{display:block;font-size:9px;color:#6B7B85;line-height:1.3}
.oj-resumen b{display:block;font-size:17px;margin:3px 0 2px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.oj-resumen small{display:block;font-size:8.5px;color:#84919B;line-height:1.35}
.oj-tools{display:flex;gap:8px;align-items:center;padding:10px;background:#fff;border-bottom:1px solid #E4EAEE;flex-wrap:wrap;flex:0 0 auto}
.oj-search{display:flex;align-items:center;gap:7px;background:#fff;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:7px 10px;flex:1;min-width:200px}
.oj-search input{border:0;outline:0;width:100%;font:inherit;font-size:12px}
.oj-tabs{display:flex;gap:3px;background:#F1F4F6;border-radius:8px;padding:3px}
.oj-tabs button{border:0;background:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:600;color:#516069;cursor:pointer;white-space:nowrap}
.oj-tabs button.on{background:#fff;color:#17623F;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.oj-btn{border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;color:#3A464E;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;display:inline-flex;gap:6px;align-items:center;cursor:pointer;white-space:nowrap}
.oj-btn.pri{background:#17623F;color:#fff;box-shadow:none}
.oj-regla{display:flex;gap:9px;align-items:flex-start;background:#EDF6F1;border-bottom:1px solid #D7E8DE;padding:10px 14px;color:#2F5B45;font-size:11px;line-height:1.5;flex:0 0 auto}
.oj-lista{flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:5px}
/* Pensado para la pantalla del operador: cada persona es una tarjeta de tres renglones
   — quién es, en qué estado queda y qué produce esa marca al cerrar. */
.oj-fila{display:grid;grid-template-columns:34px 1fr 24px;grid-template-areas:"check persona mas" "check meta meta" "check efecto efecto";gap:6px 9px;align-items:center;background:#fff;border-radius:11px;padding:10px;box-shadow:0 0 0 1px #E4EAEE;border-left:3px solid transparent}
.oj-fila.ok{border-left-color:#1B7A4C}
.oj-fila.no{border-left-color:#9A6410;background:#FFFDF8}
.oj-fila.rep{border-left-color:#2A5FA6;background:#F7FAFD}
.oj-check{grid-area:check;width:32px;height:32px;border-radius:9px;border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;color:#9A6410;display:grid;place-items:center;cursor:pointer;align-self:start}
.oj-check.on{background:#1B7A4C;color:#fff;box-shadow:none}
.oj-persona{grid-area:persona;min-width:0}
.oj-persona b{display:block;font-size:12.5px;font-weight:650;line-height:1.3;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oj-persona span{display:block;font-size:10.5px;color:#6B7B85;margin-top:2px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oj-meta{grid-area:meta;display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.oj-meta select{flex:1;min-width:130px}
.oj-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:600;white-space:nowrap}
.oj-pill.ok{background:#E9F5EE;color:#1B7A4C}
.oj-pill.fmt{background:#EEF3F5;color:#516069}
.oj-pill.nota{background:#FDF6EA;color:#8A5A16;font-weight:600}
.oj-pill.no{background:#FDF3E3;color:#9A6410}
.oj-pill.entregada{background:#E9F5EE;color:#1B7A4C}
.oj-meta select{border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:7px;padding:6px 8px;font:inherit;font-size:10.5px;background:#fff;cursor:pointer}
.oj-efecto{grid-area:efecto}
.oj-efecto span{display:block;font-size:10px;color:#6B7B85;line-height:1.4}
.oj-efecto b{font-size:10.5px;font-weight:700;color:#1B7A4C}
.oj-efecto b.ab{color:#A83E3E}.oj-efecto b.rep{color:#2A5FA6}
.oj-mas{grid-area:mas;border:0;background:none;color:#94A3AC;cursor:pointer;display:grid;place-items:center;align-self:start;padding:6px 0}
.oj-vacio{text-align:center;color:#6B7B85;padding:34px;font-size:12px}
.oj-foot{flex:0 0 auto;background:#fff;border-top:1px solid #E4EAEE;padding:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.oj-receptor{display:flex;gap:8px;flex:1}
.oj-receptor label{flex:1}
.oj-receptor span{display:block;font-size:10px;color:#516069;margin-bottom:4px}
.oj-receptor input{width:100%;box-sizing:border-box;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:8px;font:inherit;font-size:12px}
.oj-acciones{display:flex;gap:7px}
.oj-modal-bg{position:absolute;inset:0;background:rgba(11,18,22,.55);backdrop-filter:blur(4px);z-index:40;display:grid;place-items:center;padding:16px}
.oj-modal{background:#fff;border-radius:16px;width:min(560px,96vw);max-height:92%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.28)}
.oj-modal>header{padding:14px 16px;border-bottom:1px solid #E4EAEE;display:flex;justify-content:space-between;align-items:center}
.oj-modal>header h3{margin:0;font-size:15px;letter-spacing:-.015em}
.oj-modal-b{padding:16px;overflow:auto;flex:1}
.oj-modal-p{margin:0 0 12px;font-size:12px;color:#516069;line-height:1.6}
.oj-modal>footer{padding:12px 16px;border-top:1px solid #E4EAEE;display:flex;justify-content:flex-end;gap:7px}
.oj-confirm{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.oj-confirm>div{background:#F5F8F9;border-radius:9px;padding:10px}
.oj-confirm span{display:block;font-size:10px;color:#6B7B85}
.oj-confirm b{display:block;font-size:16px;margin:3px 0 1px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.oj-confirm small{display:block;font-size:10px;color:#84919B}
.oj-sep{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#17623F;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid #E8EDF0}
.oj-env{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;background:#F5F8F9;border-radius:9px;padding:9px;margin-bottom:5px}
.oj-env b{display:block;font-size:11.5px;font-family:ui-monospace,monospace}
.oj-env span{display:block;font-size:10.5px;color:#6B7B85;margin-top:2px}
.oj-opciones{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.oj-opciones button{border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;border-radius:9px;padding:10px;font-size:11.5px;font-weight:600;color:#3A464E;display:flex;gap:7px;align-items:center;cursor:pointer;text-align:left}
.oj-opciones button.on{background:#17623F;color:#fff;box-shadow:none}
.oj-consec{display:flex;gap:8px;align-items:flex-start;background:#FDF3E3;border-radius:9px;padding:10px;margin-top:9px;color:#82561D;font-size:11px;line-height:1.5}
.oj-obs{display:block;margin-top:12px}
.oj-obs span{display:block;font-size:10px;color:#516069;margin-bottom:5px}
.oj-obs textarea{width:100%;box-sizing:border-box;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:9px;font:inherit;font-size:12px}
.oj-tools{flex-direction:column;align-items:stretch}
.oj-tabs{overflow-x:auto;scrollbar-width:none}
.oj-tabs::-webkit-scrollbar{display:none}
.oj-foot{flex-direction:column;align-items:stretch}
.oj-acciones{justify-content:flex-end}
.oj-confirm{grid-template-columns:1fr 1fr}
.oj-opciones{grid-template-columns:1fr}
`}</style>;
}
