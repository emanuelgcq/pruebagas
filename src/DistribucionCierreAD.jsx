import React, { useMemo, useState } from "react";
import {
  Search, Check, X, AlertTriangle, PackageX, Wrench, UserX, CircleSlash, Container,
  ChevronRight, ClipboardCheck, MapPin, Factory, ShieldCheck,
} from "lucide-react";
import { KgL, UnidadesStyles } from "./Unidades.jsx";
import {
  motivosDelMomento, motivoNoEntrega, cpt, usr, num, envasesDe, validarCanje, kgDeSolicitud, estadoEnvase,
} from "./datos.jsx";
import { convocadasDeAD, marcaDe, tipoAD, tipoADInfo } from "./flujo.js";

/** «1 persona», «2 personas»: el número con su palabra en singular o plural. */
const cant = (n, uno, varios) => `${num(n)} ${Number(n) === 1 ? uno : varios}`;

/**
 * LA JORNADA PERSONA POR PERSONA · recolección en el punto y llenado en planta.
 *
 * Cada momento del AD se registra cuando ocurre, no todo junto al final del día:
 *   RECOLECCIÓN · todas las convocadas arrancan como recogidas; sólo se marca a quien no
 *                 se le pudo recoger, con el motivo del punto.
 *   LLENADO     · todas las recogidas arrancan como llenas; sólo se marcan las que no
 *                 admitieron llenado. Esas vuelven vacías al punto con las demás: salen
 *                 diez, vuelven diez.
 *
 * Lo que produce cada motivo lo decide el núcleo al cerrar el AD: replanificar (la bandeja
 * de Distribución arma una AD especial) o, si el usuario desistió, saldo a favor. Esta
 * pantalla registra lo que pasó y dice qué va a pasar; no factura ni abona nada.
 */

const ICONO_MOTIVO = {
  NO_ESTABA: UserX, SIN_ENVASE: Container, RECHAZADA_PUNTO: PackageX, FORMATO_NO_DISPONIBLE: PackageX,
  DIRECCION_NO_UBICADA: MapPin, RECHAZO: CircleSlash, CANCELADO: CircleSlash, DEFECTUOSO: Wrench, FALLA_PLANTA: Factory,
};

const MODOS = {
  recoleccion: {
    momento: "RECOLECCION", campo: "recogida", eyebrow: "RECOLECCIÓN",
    si: "Recogida", siPlural: "Recogidas", no: "No recogida", noPlural: "No recogidas",
    efectoSi: "va a planta a llenarse", accion: "Registrar recolección", destino: "En planta · llenado",
  },
  llenado: {
    momento: "PLANTA", campo: "llenada", eyebrow: "LLENADO Y DEVOLUCIÓN",
    si: "Llenada", siPlural: "Llenas", no: "Vuelve vacía", noPlural: "Vacías",
    efectoSi: "vuelve llena al punto · se factura al cerrar el AD", accion: "Registrar llenado y devolución", destino: "Devuelta al punto",
  },
};

/** Hora del reloj, para que ningún registro nazca con una hora escrita a mano. */
export const horaActual = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Lo que hará el cierre del AD con quien no se atendió, dicho en una línea. */
export const consecuenciaDe = (mot) => (mot.consecuencia === "ABONO"
  ? "desistió: su dinero va a su saldo a favor"
  : `pasa a la bandeja de replanificación (AD especial)${mot.prioridad ? ", con prioridad: la falla es de la empresa" : ""}`);

/* Antecedente del parque de envases: lo último que el sistema supo de su bombona. Es sólo
   información —si la trajo y sirve se ve en el punto—, por eso no marca a nadie. */
function antecedenteEnvase(parque, s) {
  const kg = cpt(s.concepto).kg;
  const envases = envasesDe(parque, s.usuario);
  const canje = validarCanje(envases, kg);
  if (canje.ok) return null;
  const mismo = envases.find((e) => e.kg === kg);
  const texto = mismo?.estado === "NO_APTO" ? "Su bombona figuraba no apta"
    : mismo?.estado === "EN_TALLER" ? "Su bombona figuraba en taller"
      : mismo ? `Su bombona figuraba ${estadoEnvase(mismo.estado).nombre.toLowerCase()}`
        : envases.length ? "Tiene registrado otro formato" : "Sin bombona registrada";
  return { texto, detalle: canje.motivo };
}

export default function JornadaPersonas({
  ruta, solicitudes = [], parqueEnvases = [], modo = "recoleccion", onConfirmar, onCancelar,
}) {
  const M = MODOS[modo] || MODOS.recoleccion;
  const llenado = modo === "llenado";
  const opciones = useMemo(() => motivosDelMomento(M.momento), [M.momento]);
  // Recolección: todas las convocadas. Llenado: sólo lo que de verdad se recogió.
  const personas = useMemo(() => {
    const conv = convocadasDeAD(ruta, solicitudes);
    return llenado ? conv.filter((s) => marcaDe(ruta, s.id).recogida !== false) : conv;
  }, [ruta, solicitudes, llenado]);
  const antecedentes = useMemo(
    () => new Map(personas.map((s) => [s.id, antecedenteEnvase(parqueEnvases, s)])), [personas, parqueEnvases]);
  const paradas = useMemo(() => new Map((ruta?.paradas || []).map((p) => [p.solicitudId, p])), [ruta]);

  // Sólo se guarda lo que se tocó: quien no aparece queda como recogida / llenada.
  const [marcas, setMarcas] = useState({});
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [detalle, setDetalle] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(() => ({ hora: horaActual(), horaLlenado: horaActual(), horaDevolucion: horaActual(), por: "" }));

  const esNo = (id) => Boolean(marcas[id]?.no);
  const motivoDe = (s) => motivoNoEntrega(marcas[s.id]?.motivo || opciones[0]?.id);
  const marcar = (id, cambios) => { setError(""); setMarcas((m) => ({ ...m, [id]: { ...m[id], ...cambios } })); };
  const alternar = (s) => marcar(s.id, esNo(s.id) ? { no: false } : { no: true, motivo: marcas[s.id]?.motivo || opciones[0]?.id });

  const si = personas.filter((s) => !esNo(s.id));
  const no = personas.filter((s) => esNo(s.id));
  const aReplanificar = no.filter((s) => motivoDe(s).consecuencia === "REPLANIFICAR");
  const aSaldo = no.filter((s) => motivoDe(s).consecuencia === "ABONO");
  const conPrioridad = no.filter((s) => motivoDe(s).prioridad);
  const conAviso = personas.filter((s) => antecedentes.get(s.id));
  const kg = (arr) => arr.reduce((a, s) => a + kgDeSolicitud(s), 0);
  const porMotivo = no.reduce((acc, s) => { const id = motivoDe(s).id; acc[id] = (acc[id] || 0) + 1; return acc; }, {});

  const visibles = useMemo(() => personas.filter((s) => {
    const u = usr(s.usuario);
    if (q && !`${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filtro === "SI") return !marcas[s.id]?.no;
    if (filtro === "NO") return Boolean(marcas[s.id]?.no);
    if (filtro === "AVISO") return Boolean(antecedentes.get(s.id));
    return true;
  }), [personas, marcas, q, filtro, antecedentes]);

  const todasSi = () => setMarcas((m) => {
    const n = { ...m };
    visibles.forEach((s) => { if (n[s.id]) n[s.id] = { ...n[s.id], no: false }; });
    return n;
  });

  /* Lo que esperan los manejadores: sólo las excepciones, con su motivo del momento.
     En la recolección también viaja la nota de quien sí se recogió; en el llenado el
     núcleo conserva la nota de la recolección y sólo recibe la de las que no se llenaron. */
  function marcasDeSalida() {
    const out = {};
    personas.forEach((s) => {
      const m = marcas[s.id];
      if (!m) return;
      const observacion = String(m.observacion || "").trim() || null;
      if (m.no) out[s.id] = { [M.campo]: false, motivo: m.motivo || opciones[0].id, observacion };
      else if (observacion && !llenado) out[s.id] = { recogida: true, observacion };
    });
    return out;
  }
  const horasOk = llenado ? Boolean(meta.horaLlenado && meta.horaDevolucion) : Boolean(meta.hora);

  function confirmar() {
    const por = meta.por.trim() || "Gerencia de Distribución";
    const res = onConfirmar?.(marcasDeSalida(), llenado
      ? { horaLlenado: meta.horaLlenado, horaDevolucion: meta.horaDevolucion, por }
      : { hora: meta.hora, por });
    if (!res?.ok) setError(res?.error || "No se pudo registrar.");
  }

  const tiles = llenado ? [
    { label: "Recogidas en planta", valor: personas.length, nota: <KgL kg={kg(personas)} /> },
    { tono: "ok", label: "Llenas", valor: si.length, nota: <KgL kg={kg(si)} /> },
    { tono: "wr", label: "Vuelven vacías", valor: no.length, nota: "no admitieron llenado" },
    { tono: "in", label: "A replanificación", valor: aReplanificar.length,
      nota: conPrioridad.length ? `${conPrioridad.length} con prioridad · falla de la empresa` : "al cerrar el AD · AD especial" },
    { tono: "ok", label: "Devueltas al punto", valor: personas.length, nota: "llenas y vacías: vuelven todas" },
  ] : [
    { label: "Convocadas", valor: personas.length, nota: <KgL kg={kg(personas)} /> },
    { tono: "ok", label: "Recogidas", valor: si.length, nota: <KgL kg={kg(si)} /> },
    { tono: "wr", label: "No recogidas", valor: no.length, nota: "con su motivo del punto" },
    { tono: "in", label: "A replanificación", valor: aReplanificar.length, nota: "al cerrar el AD · AD especial" },
    { tono: "ab", label: "A saldo a favor", valor: aSaldo.length, nota: "desistieron o cancelaron" },
  ];

  return (
    <div className="oj-bg">
      <div className="oj" role="dialog" aria-label={`${M.accion} · AD ${ruta?.ad}`}>
        <JornadaStyles />
        <UnidadesStyles />

        <header className="oj-head">
          <div>
            <span>{M.eyebrow} · AD {ruta?.ad} · {tipoADInfo(ruta).nombre.toUpperCase()}</span>
            <h2>{ruta?.comunidad}</h2>
            <p>{ruta?.comuna} · {llenado ? cant(personas.length, "bombona recogida", "bombonas recogidas") : cant(personas.length, "persona convocada", "personas convocadas")} · placa {ruta?.unidad || "—"}
              {ruta?.conductor ? ` · conduce ${ruta.conductor}` : ""}{ruta?.ayudante ? ` con ${ruta.ayudante}` : ""}</p>
          </div>
          <button className="oj-x" onClick={onCancelar} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <div className="oj-resumen">
          {tiles.map((t) => (
            <div key={t.label} className={t.tono || ""}><span>{t.label}</span><b>{num(t.valor)}</b><small>{t.nota}</small></div>
          ))}
        </div>
        <div className="oj-ecuacion">
          {llenado
            ? <span>Recogidas <b>{num(personas.length)}</b> = <b>{num(si.length)}</b> llenas + <b>{num(no.length)}</b> vacías</span>
            : <span>Convocadas <b>{num(personas.length)}</b> = <b>{num(si.length)}</b> recogidas + <b>{num(no.length)}</b> no recogidas</span>}
          <em className="cuadra"><Check size={11} /> {llenado ? `salen ${num(personas.length)}, vuelven ${num(personas.length)}` : "cuadra"}</em>
        </div>

        <div className="oj-tools">
          <div className="oj-search"><Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, cédula o solicitud" /></div>
          <div className="oj-tabs">
            {[["TODOS", `Todas ${personas.length}`], ["SI", `${M.siPlural} ${si.length}`], ["NO", `${M.noPlural} ${no.length}`],
              ["AVISO", `Antecedente de envase ${conAviso.length}`]].map(([k, l]) => (
              <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
          <button className="oj-btn" onClick={todasSi} disabled={!visibles.some((s) => esNo(s.id))}>
            <Check size={14} /> Marcar visibles como {M.siPlural.toLowerCase()}</button>
        </div>

        <div className="oj-regla">
          <ShieldCheck size={16} />
          {llenado
            ? <span>Salen diez, vuelven diez: toda bombona recogida vuelve al punto, llena o vacía si no admitió llenado.
                Marca sólo las que no se pudieron llenar. <b>La responsabilidad de la empresa termina cuando las bombonas
                vuelven al punto;</b> el cierre del AD factura las llenas al precio del día de salida.</span>
            : <span>{tipoAD(ruta) === "ESPECIAL" ? "La unidad recoge en cada domicilio de la ruta." : "La gente lleva su bombona vacía al punto."} Todas
                arrancan como recogidas: marca sólo a quien no se le pudo recoger y por qué. El antecedente del parque de
                envases es un aviso, no una marca. Nadie se factura ni se abona aquí: eso lo hace el cierre del AD.</span>}
        </div>

        <div className="oj-lista">
          {visibles.map((s) => {
            const m = marcas[s.id] || {};
            const u = usr(s.usuario);
            const c = cpt(s.concepto);
            const ant = antecedentes.get(s.id);
            const parada = paradas.get(s.id);
            const mot = m.no ? motivoDe(s) : null;
            const Ico = mot ? (ICONO_MOTIVO[mot.id] || AlertTriangle) : Check;
            const notaRecoleccion = llenado ? marcaDe(ruta, s.id).observacion : null;
            return (
              <article key={s.id} className={`oj-fila ${m.no ? "no" : "ok"}`}>
                <button className={`oj-check ${m.no ? "" : "on"}`} onClick={() => alternar(s)}
                  title={m.no ? `Marcar como ${M.si.toLowerCase()}` : `Marcar como ${M.no.toLowerCase()}`}>
                  <Ico size={m.no ? 15 : 16} strokeWidth={m.no ? 2 : 3} />
                </button>
                <div className="oj-persona">
                  <b>{u.nombre}</b>
                  <span>{u.doc} · {s.id}{parada ? ` · parada ${parada.orden}: ${parada.direccion}` : ""}</span>
                </div>
                <div className="oj-meta">
                  <span className="oj-pill fmt"><Container size={11} /> {c.corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""}</span>
                  {ant && <span className="oj-pill nota" title={ant.detalle}>{ant.texto}</span>}
                  {s.problema?.nombre && <span className="oj-pill rep" title={`Venía de la AD ${s.problema.adOrigen || "—"}`}>Replanificada · {s.problema.nombre}</span>}
                  {notaRecoleccion && <span className="oj-pill fmt" title="Nota de la recolección">{notaRecoleccion}</span>}
                  {m.no && (
                    <select value={mot.id} onChange={(e) => marcar(s.id, { motivo: e.target.value })}>
                      {opciones.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                    </select>
                  )}
                </div>
                <div className="oj-efecto">
                  {m.no
                    ? <span><b className={mot.consecuencia === "ABONO" ? "ab" : "rep"}>{M.no}</b> · al cerrar el AD {consecuenciaDe(mot)}</span>
                    : <span><b>{M.si}</b> · {M.efectoSi}</span>}
                </div>
                <button className="oj-mas" onClick={() => setDetalle(s)} aria-label="Ver ficha"><ChevronRight size={16} /></button>
              </article>
            );
          })}
          {!personas.length && (
            <div className="oj-vacio">{llenado
              ? "Ninguna bombona se recogió en el punto: no hay nada que llenar. Registra el momento para que el AD quede en el punto y pueda cerrarse."
              : "Este AD no tiene personas convocadas."}</div>
          )}
          {personas.length > 0 && !visibles.length && <div className="oj-vacio">Ninguna persona coincide con el filtro.</div>}
        </div>

        <footer className="oj-foot">
          <div className="oj-campos">
            {llenado ? (
              <>
                <label><span>Hora del llenado</span>
                  <input type="time" value={meta.horaLlenado} onChange={(e) => setMeta({ ...meta, horaLlenado: e.target.value })} /></label>
                <label><span>Hora de devolución al punto</span>
                  <input type="time" value={meta.horaDevolucion} onChange={(e) => setMeta({ ...meta, horaDevolucion: e.target.value })} /></label>
              </>
            ) : (
              <label><span>Hora de la recolección</span>
                <input type="time" value={meta.hora} onChange={(e) => setMeta({ ...meta, hora: e.target.value })} /></label>
            )}
            <label className="ancho"><span>Registra</span>
              <input value={meta.por} onChange={(e) => setMeta({ ...meta, por: e.target.value })} placeholder="Gerencia de Distribución" /></label>
          </div>
          <div className="oj-acciones">
            <button className="oj-btn" onClick={onCancelar}>Cancelar</button>
            <button className="oj-btn pri" disabled={!horasOk} onClick={() => { setError(""); setConfirmando(true); }}>
              <ClipboardCheck size={15} /> {M.accion}
            </button>
          </div>
        </footer>

        {detalle && (
          <FichaPersona s={detalle} ruta={ruta} modo={M} llenado={llenado} opciones={opciones} marca={marcas[detalle.id]}
            parque={parqueEnvases} onMarcar={(c) => marcar(detalle.id, c)} onClose={() => setDetalle(null)} />
        )}

        {confirmando && (
          <div className="oj-modal-bg" onClick={() => setConfirmando(false)}>
            <div className="oj-modal" onClick={(e) => e.stopPropagation()}>
              <header><h3>{M.accion} · AD {ruta?.ad}</h3>
                <button className="oj-x claro" onClick={() => setConfirmando(false)} aria-label="Volver"><X size={16} /></button></header>
              <div className="oj-modal-b">
                <p className="oj-modal-p">{llenado
                  ? `Se registran ${cant(si.length, "bombona llena", "bombonas llenas")} y ${num(no.length)} que ${no.length === 1 ? "vuelve vacía" : "vuelven vacías"}: ${personas.length === 1 ? "queda devuelta" : `las ${num(personas.length)} quedan devueltas`} al punto y el AD pasa a «${M.destino}», listo para cerrar.`
                  : `Se registran ${cant(si.length, "bombona recogida", "bombonas recogidas")} y ${cant(no.length, "no recogida", "no recogidas")}. El AD pasa a «${M.destino}». Nadie se factura ni se abona todavía: eso ocurre al cerrar el AD.`}</p>
                <div className="oj-confirm">
                  <div><span>{M.siPlural}</span><b>{num(si.length)}</b><small><KgL kg={kg(si)} /></small></div>
                  <div><span>{M.noPlural}</span><b>{num(no.length)}</b><small>{no.length ? "con su motivo" : "ninguna"}</small></div>
                  <div><span>A replanificación al cerrar</span><b>{num(aReplanificar.length)}</b><small>bandeja · AD especial</small></div>
                  {!llenado && <div><span>A saldo a favor al cerrar</span><b>{num(aSaldo.length)}</b><small>desistieron o cancelaron</small></div>}
                  {llenado && <div><span>Devueltas al punto</span><b>{num(personas.length)}</b><small>salen y vuelven todas</small></div>}
                </div>
                {no.length > 0 && (
                  <div className="oj-motivos">
                    {Object.entries(porMotivo).map(([id, n]) => {
                      const mot = motivoNoEntrega(id);
                      return <span key={id}><b>{n}</b> {mot.nombre} <em>→ {consecuenciaDe(mot)}</em></span>;
                    })}
                  </div>
                )}
                {llenado && (
                  <div className="oj-regla caja"><ShieldCheck size={16} />
                    <span>La responsabilidad de la empresa termina cuando las bombonas vuelven al punto. Si el dueño la retira
                      o no, ya no le compete a GasLara.</span></div>
                )}
                {error && <div className="oj-error"><AlertTriangle size={15} /> {error}</div>}
              </div>
              <footer>
                <button className="oj-btn" onClick={() => setConfirmando(false)}>Volver</button>
                <button className="oj-btn pri" onClick={confirmar}><Check size={15} /> Confirmar</button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FichaPersona({ s, ruta, modo, llenado, opciones, marca = {}, parque, onMarcar, onClose }) {
  const u = usr(s.usuario);
  const c = cpt(s.concepto);
  const envases = envasesDe(parque, s.usuario);
  const parada = (ruta?.paradas || []).find((p) => p.solicitudId === s.id);
  const recoleccion = marcaDe(ruta, s.id);
  const mot = marca.no ? motivoNoEntrega(marca.motivo || opciones[0]?.id) : null;
  return (
    <div className="oj-modal-bg" onClick={onClose}>
      <div className="oj-modal" onClick={(e) => e.stopPropagation()}>
        <header><h3>{u.nombre}</h3><button className="oj-x claro" onClick={onClose} aria-label="Cerrar"><X size={16} /></button></header>
        <div className="oj-modal-b">
          <div className="oj-confirm">
            <div><span>Documento</span><b className="t">{u.doc}</b></div>
            <div><span>Solicitud</span><b className="t">{s.id}</b></div>
            <div><span>Producto</span><b className="t">{c.corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""}</b><small><KgL kg={kgDeSolicitud(s)} /></small></div>
            <div><span>{parada ? `Parada ${parada.orden}` : "Comunidad"}</span><b className="t">{parada ? parada.direccion : (s.comunidad || u.sector || ruta?.comunidad || "—")}</b></div>
            {s.problema?.nombre && <div className="ancho"><span>Viene de replanificación</span><b className="t">{s.problema.nombre}</b><small>AD {s.problema.adOrigen || "—"}</small></div>}
            {llenado && <div className="ancho"><span>Recolección</span><b className="t">Recogida{ruta?.jornada?.recoleccion?.hora ? ` a las ${ruta.jornada.recoleccion.hora}` : ""}</b>
              {recoleccion.observacion && <small>{recoleccion.observacion}</small>}</div>}
          </div>

          <div className="oj-sep">Envases registrados · antecedente</div>
          {envases.length ? envases.map((e) => (
            <div className="oj-env" key={e.serial}>
              <Container size={15} />
              <div><b>{e.serial}</b><span>{e.kg} kg · {e.motivo || "sin observaciones"}</span></div>
              <span className={`oj-pill ${e.estado === "EN_USUARIO" ? "okp" : "nota"}`}>{estadoEnvase(e.estado).nombre}</span>
            </div>
          )) : <div className="oj-vacio chico">Sin envases registrados a su nombre.</div>}

          <div className="oj-sep">{llenado ? "Resultado del llenado" : "Resultado de la recolección"}</div>
          <div className="oj-opciones">
            <button className={marca.no ? "" : "on"} onClick={() => onMarcar({ no: false })}><Check size={15} /> {modo.si}</button>
            {opciones.map((m) => {
              const Ico = ICONO_MOTIVO[m.id] || AlertTriangle;
              return (
                <button key={m.id} className={mot?.id === m.id ? "on" : ""} onClick={() => onMarcar({ no: true, motivo: m.id })}>
                  <Ico size={15} /> {m.nombre}
                </button>
              );
            })}
          </div>
          <div className={`oj-consec ${mot ? "" : "ok"}`}>
            {mot ? <AlertTriangle size={15} /> : <Check size={15} />}
            <span>{mot ? <>{mot.desc} <b>Al cerrar el AD {consecuenciaDe(mot)}.</b></> : `${modo.si}: ${modo.efectoSi}.`}</span>
          </div>
          {(!llenado || mot) && (
            <label className="oj-obs"><span>Nota para el expediente</span>
              <textarea rows={2} value={marca.observacion || ""} onChange={(e) => onMarcar({ observacion: e.target.value })}
                placeholder="Lo que haya que dejar por escrito de esta persona" /></label>
          )}
        </div>
        <footer><button className="oj-btn pri" onClick={onClose}>Listo</button></footer>
      </div>
    </div>
  );
}

function JornadaStyles() {
  return <style>{`
.oj-bg{position:fixed;inset:0;z-index:80;background:rgba(11,18,22,.55);backdrop-filter:blur(5px);display:grid;place-items:center;padding:14px}
.oj{position:relative;width:min(1180px,98vw);height:min(94vh,980px);background:#F5F8F9;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(11,18,22,.35);font-family:Inter,Segoe UI,system-ui,sans-serif}
.oj-head{background:#111B22;color:#fff;padding:15px 18px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex:none}
.oj-head span{font-size:10.5px;font-weight:800;letter-spacing:.06em;color:#7FBFA0}
.oj-head h2{margin:5px 0 3px;font-size:19px;letter-spacing:-.02em}
.oj-head p{margin:0;font-size:12px;color:#A8B8C0;line-height:1.45}
.oj-x{border:1px solid #ffffff26;background:#ffffff10;color:#fff;width:32px;height:32px;border-radius:8px;flex:none;cursor:pointer;display:grid;place-items:center}
.oj-x.claro{border-color:#DDE4E8;background:#fff;color:#516069}
.oj-resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;padding:12px 14px 8px;background:#fff;flex:none}
.oj-resumen>div{background:#F5F8F9;border-radius:10px;padding:9px 12px;border-left:3px solid #C3CED5;min-width:0}
.oj-resumen>div.ok{border-left-color:#1B7A4C}.oj-resumen>div.ok b{color:#1B7A4C}
.oj-resumen>div.wr{border-left-color:#9A6410}.oj-resumen>div.wr b{color:#9A6410}
.oj-resumen>div.in{border-left-color:#2A5FA6}.oj-resumen>div.in b{color:#2A5FA6}
.oj-resumen>div.ab{border-left-color:#A83E3E}.oj-resumen>div.ab b{color:#A83E3E}
.oj-resumen span{display:block;font-size:11px;color:#6B7B85;font-weight:600}
.oj-resumen b{display:block;font-size:21px;margin:2px 0;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.oj-resumen small{display:block;font-size:11px;color:#84919B;line-height:1.35}
.oj-ecuacion{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:2px 14px 12px;background:#fff;border-bottom:1px solid #E4EAEE;font-size:12.5px;color:#3A464E;flex:none}
.oj-ecuacion b{font-variant-numeric:tabular-nums;color:#17232C}
.oj-ecuacion .cuadra{display:inline-flex;align-items:center;gap:4px;background:#E9F5EE;color:#1B7A4C;border-radius:99px;padding:3px 9px;font-size:11px;font-weight:700;font-style:normal}
.oj-tools{display:flex;gap:8px;align-items:center;padding:10px 14px;background:#fff;border-bottom:1px solid #E4EAEE;flex-wrap:wrap;flex:none}
.oj-search{display:flex;align-items:center;gap:7px;background:#fff;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:7px 10px;flex:1;min-width:220px}
.oj-search input{border:0;outline:0;width:100%;font:inherit;font-size:12.5px}
.oj-tabs{display:flex;gap:3px;background:#F1F4F6;border-radius:8px;padding:3px;overflow-x:auto;scrollbar-width:none}
.oj-tabs::-webkit-scrollbar{display:none}
.oj-tabs button{border:0;background:none;border-radius:6px;padding:6px 10px;font-size:11.5px;font-weight:600;color:#516069;cursor:pointer;white-space:nowrap}
.oj-tabs button.on{background:#fff;color:#17623F;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.oj-btn{border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;color:#3A464E;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;display:inline-flex;gap:6px;align-items:center;cursor:pointer;white-space:nowrap}
.oj-btn:disabled{opacity:.45;cursor:not-allowed}
.oj-btn.pri{background:#17623F;color:#fff;box-shadow:none}
.oj-regla{display:flex;gap:9px;align-items:flex-start;background:#EDF6F1;border-bottom:1px solid #D7E8DE;padding:10px 14px;color:#2F5B45;font-size:12px;line-height:1.55;flex:none}
.oj-regla svg{flex:none;margin-top:2px}
.oj-regla.caja{border:1px solid #D7E8DE;border-radius:10px;margin-top:12px}
.oj-lista{flex:1;overflow:auto;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
/* Cada persona es una fila: quién es, qué se sabe de su bombona y qué produce la marca. */
.oj-fila{display:grid;grid-template-columns:34px minmax(190px,1.2fr) minmax(230px,1.5fr) minmax(210px,1.3fr) 24px;grid-template-areas:"check persona meta efecto mas";gap:6px 12px;align-items:center;background:#fff;border-radius:11px;padding:9px 12px;box-shadow:0 0 0 1px #E4EAEE;border-left:3px solid #1B7A4C}
.oj-fila.no{border-left-color:#9A6410;background:#FFFDF8}
.oj-check{grid-area:check;width:32px;height:32px;border-radius:9px;border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;color:#9A6410;display:grid;place-items:center;cursor:pointer}
.oj-check.on{background:#1B7A4C;color:#fff;box-shadow:none}
.oj-persona{grid-area:persona;min-width:0}
.oj-persona b{display:block;font-size:12.5px;font-weight:650;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oj-persona span{display:block;font-size:11px;color:#6B7B85;margin-top:2px;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.oj-meta{grid-area:meta;display:flex;gap:5px;align-items:center;flex-wrap:wrap;min-width:0}
.oj-meta select{flex:1;min-width:150px;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:7px;padding:6px 8px;font:inherit;font-size:11.5px;background:#fff;cursor:pointer}
.oj-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.oj-pill.fmt{background:#EEF3F5;color:#516069}
.oj-pill.nota{background:#FDF6EA;color:#8A5A16}
.oj-pill.rep{background:#EAF1FA;color:#2A5FA6}
.oj-pill.okp{background:#E9F5EE;color:#1B7A4C}
.oj-efecto{grid-area:efecto;min-width:0}
.oj-efecto span{display:block;font-size:11.5px;color:#6B7B85;line-height:1.4}
.oj-efecto b{font-weight:700;color:#1B7A4C}
.oj-efecto b.ab{color:#A83E3E}.oj-efecto b.rep{color:#9A6410}
.oj-mas{grid-area:mas;border:0;background:none;color:#94A3AC;cursor:pointer;display:grid;place-items:center;padding:6px 0}
.oj-vacio{text-align:center;color:#6B7B85;padding:34px;font-size:12.5px;line-height:1.5}
.oj-vacio.chico{padding:14px}
.oj-foot{flex:none;background:#fff;border-top:1px solid #E4EAEE;padding:10px 14px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
.oj-campos{display:flex;gap:8px;flex:1;flex-wrap:wrap}
.oj-campos label{flex:0 0 150px}
.oj-campos label.ancho{flex:1;min-width:180px}
.oj-campos span{display:block;font-size:11px;font-weight:600;color:#516069;margin-bottom:4px}
.oj-campos input{width:100%;box-sizing:border-box;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:8px;font:inherit;font-size:12.5px}
.oj-acciones{display:flex;gap:7px;justify-content:flex-end}
.oj-modal-bg{position:absolute;inset:0;background:rgba(11,18,22,.5);backdrop-filter:blur(3px);z-index:5;display:grid;place-items:center;padding:16px}
.oj-modal{background:#fff;border-radius:16px;width:min(600px,96%);max-height:92%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.28)}
.oj-modal>header{padding:14px 16px;border-bottom:1px solid #E4EAEE;display:flex;justify-content:space-between;align-items:center;gap:10px}
.oj-modal>header h3{margin:0;font-size:15.5px;letter-spacing:-.015em}
.oj-modal-b{padding:16px;overflow:auto;flex:1}
.oj-modal-p{margin:0 0 12px;font-size:12.5px;color:#516069;line-height:1.6}
.oj-modal>footer{padding:12px 16px;border-top:1px solid #E4EAEE;display:flex;justify-content:flex-end;gap:7px}
.oj-confirm{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.oj-confirm>div{background:#F5F8F9;border-radius:9px;padding:10px;min-width:0}
.oj-confirm>div.ancho{grid-column:1/3}
.oj-confirm span{display:block;font-size:11px;color:#6B7B85}
.oj-confirm b{display:block;font-size:17px;margin:3px 0 1px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.oj-confirm b.t{font-size:13px;letter-spacing:0;line-height:1.35}
.oj-confirm small{display:block;font-size:11px;color:#84919B;line-height:1.4}
.oj-motivos{display:flex;flex-direction:column;gap:5px;margin-top:12px}
.oj-motivos span{font-size:12px;color:#3A464E;background:#F5F8F9;border-radius:8px;padding:7px 10px;line-height:1.45}
.oj-motivos b{font-variant-numeric:tabular-nums;margin-right:3px}
.oj-motivos em{font-style:normal;color:#6B7B85}
.oj-error{display:flex;gap:8px;align-items:flex-start;background:#FBECEC;border:1px solid #F2D4D4;color:#A83E3E;border-radius:9px;padding:10px;margin-top:12px;font-size:12.5px;line-height:1.45}
.oj-error svg{flex:none;margin-top:1px}
.oj-sep{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#17623F;margin:16px 0 8px;padding-bottom:5px;border-bottom:1px solid #E8EDF0}
.oj-env{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;background:#F5F8F9;border-radius:9px;padding:9px;margin-bottom:5px}
.oj-env b{display:block;font-size:12px;font-family:ui-monospace,monospace}
.oj-env span{display:block;font-size:11px;color:#6B7B85;margin-top:2px}
.oj-opciones{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.oj-opciones button{border:0;box-shadow:0 0 0 1px #DDE4E8;background:#fff;border-radius:9px;padding:10px;font-size:12px;font-weight:600;color:#3A464E;display:flex;gap:7px;align-items:center;cursor:pointer;text-align:left}
.oj-opciones button.on{background:#17623F;color:#fff;box-shadow:none}
.oj-consec{display:flex;gap:8px;align-items:flex-start;background:#FDF3E3;border-radius:9px;padding:10px;margin-top:9px;color:#82561D;font-size:12px;line-height:1.5}
.oj-consec.ok{background:#EDF6F1;color:#2F5B45}
.oj-consec svg{flex:none;margin-top:2px}
.oj-obs{display:block;margin-top:12px}
.oj-obs span{display:block;font-size:11px;font-weight:600;color:#516069;margin-bottom:5px}
.oj-obs textarea{width:100%;box-sizing:border-box;border:0;box-shadow:0 0 0 1px #DDE4E8;border-radius:8px;padding:9px;font:inherit;font-size:12.5px}
@media(max-width:900px){
 .oj-fila{grid-template-columns:34px 1fr 24px;grid-template-areas:"check persona mas" "check meta meta" "check efecto efecto"}
 .oj-opciones,.oj-confirm{grid-template-columns:1fr}
 .oj-confirm>div.ancho{grid-column:auto}
 .oj-foot{flex-direction:column;align-items:stretch}
}
`}</style>;
}
