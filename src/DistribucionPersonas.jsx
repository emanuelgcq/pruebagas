import React, { useMemo, useState } from "react";
import { Search, Container, AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react";
import { cpt, usr, bs, num, kgDeSolicitud, envasesDe, validarCanje, reglaPago } from "./datos.jsx";
import { cilindrosFila } from "./distribucionSeed.js";
import { KgL } from "./Unidades.jsx";

/* ════════════════════════════════════════════════════════════════
   LAS PERSONAS DE UN AD

   Un AD son 110 personas en promedio; la mayor lleva 306. Hasta ahora la lista nominal
   solo aparecía en dos momentos —al planificar y al cerrar— y en el medio, que es donde
   el AD vive casi todo el día, el camión era un número de cilindros.

   Aquí se deriva de la gente lo que antes se leía de un campo congelado. `r.cilindros`
   se fija cuando se planifica y no vuelve a moverse: si después la API rechaza un pago,
   el conteo sigue contando a esa persona. Contar personas es la única forma de que el
   número no mienta.

   ANTES DEL AD LA ÚNICA INCIDENCIA ES EL PAGO. El camión no sale cargado: sale a
   recoger las bombonas que la gente lleva al punto. Si alguien llevó su bombona, si
   volvió llena o si estaba mala son hallazgos del sitio, y se registran al cerrar.
   Adelantarlos aquí sería inventarse un dato que todavía nadie recogió.
   ════════════════════════════════════════════════════════════════ */

/**
 * El cuadre real de un AD. Devuelve lo planificado, la gente que hay detrás y —lo que
 * importa— cuántos cilindros van a salir sin quien los reciba.
 */
export function cuadreAD(ruta, solicitudes = []) {
  const personas = solicitudes.filter((s) => s.rutaId === ruta.id);
  // Convocadas: las que pagaron. Es lo único que decide quién entra a la jornada.
  const convocadas = personas.filter((s) => s.estado === "EN_AD");
  const sinPago = personas.filter((s) => s.pago?.estado === "SIN_PAGO");
  const rechazados = personas.filter((s) => s.pago?.estado === "RECHAZADO");
  const cerradas = personas.filter((s) => s.estado === "ABONADA" || s.estado === "CULMINADO");
  return {
    personas, convocadas, sinPago, rechazados, cerradas,
    planificado: cilindrosFila(ruta),
    sinPagoTotal: sinPago.length + rechazados.length,
    kg: convocadas.reduce((a, s) => a + kgDeSolicitud(s), 0),
    total: convocadas.reduce((a, s) => a + Number(s.total || 0), 0),
  };
}

/**
 * Por qué esta persona no entra a la jornada. Null si entra.
 *
 * Sólo mira el pago: es lo único que se sabe antes de que el camión salga. Lo del
 * envase se descubre en el punto, cuando la gente llega con su bombona o sin ella.
 */
export function problemaDe(s) {
  if (s.pago?.estado === "SIN_PAGO") return { tipo: "Sin pago", tono: "wr", detalle: "No ha reportado transferencia" };
  if (s.pago?.estado === "RECHAZADO") {
    return { tipo: reglaPago(s.pago.regla).nombre, tono: "bad", detalle: s.pago.detalleRegla || "Pago rechazado por la regla" };
  }
  if (s.estado === "ABONADA") return { tipo: "Cerrada con abono", tono: "wr", detalle: s.motivoNoCompra || "No recibió en la jornada" };
  return null;
}

/**
 * La lista nominal. Se usa en la tarjeta del AD, en el detalle y donde haga falta:
 * es la misma gente, no tres listas que se desincronizan.
 */
export function ListaPersonasAD({ ruta, solicitudes = [], parqueEnvases = [], compacta = false, onVerUsuario }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODAS");

  const personas = useMemo(() => solicitudes.filter((s) => s.rutaId === ruta.id), [solicitudes, ruta.id]);
  const fueraDeJornada = useMemo(
    () => personas.filter((s) => problemaDe(s)),
    [personas]);

  const lista = personas.filter((s) => {
    const u = usr(s.usuario);
    const okQ = !q || `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(q.toLowerCase());
    if (!okQ) return false;
    if (filtro === "DESPACHABLES") return s.estado === "EN_AD";
    if (filtro === "PROBLEMA") return Boolean(problemaDe(s));
    return true;
  });

  return (
    <div className="dp-personas">
      <div className="dp-per-tools">
        <div className="dx-search"><Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona, cédula o solicitud" /></div>
        <div className="dp-per-tabs">
          {[["TODAS", "Todas", personas.length],
            ["DESPACHABLES", "Convocadas", personas.filter((s) => s.estado === "EN_AD").length],
            ["PROBLEMA", "Sin pago", fueraDeJornada.length]].map(([k, l, n]) => (
              <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l} <em>{n}</em></button>
            ))}
        </div>
      </div>

      <div className="dp-per-scroll">
        <table className="dp-per-tabla">
          <thead><tr>
            <th>#</th><th>Persona</th><th>Cédula</th><th>Producto</th>
            <th className="r">GLP</th><th className="r">Bs</th><th>Pago</th><th>Entra a la jornada</th>
          </tr></thead>
          <tbody>
            {lista.slice(0, compacta ? 40 : 400).map((s, i) => {
              const u = usr(s.usuario);
              const c = cpt(s.concepto);
              const prob = problemaDe(s);
              return (
                <tr key={s.id} className={prob ? "prob" : ""}>
                  <td className="dp-per-n">{i + 1}</td>
                  <td>
                    {onVerUsuario
                      ? <button className="dp-per-link" onClick={() => onVerUsuario(u)}>{u.nombre}</button>
                      : <b>{u.nombre}</b>}
                    <span>{s.id}</span>
                  </td>
                  <td className="dp-per-doc">{u.doc}</td>
                  <td>{c.corto}</td>
                  <td className="r"><KgL kg={kgDeSolicitud(s)} /></td>
                  <td className="r dp-per-bs">{bs(s.total)}</td>
                  <td>{s.pago?.estado === "VERIFICADO"
                    ? <span className="dp-per-chip ok"><CheckCircle2 size={11} /> Verificado</span>
                    : s.pago?.estado === "RECHAZADO"
                      ? <span className="dp-per-chip bad">Rechazado</span>
                      : <span className="dp-per-chip wr"><Clock3 size={11} /> Sin pago</span>}</td>
                  <td>{prob
                    ? <span className={`dp-per-chip ${prob.tono}`} title={prob.detalle}>
                        <AlertTriangle size={11} /> {prob.tipo}</span>
                    : <span className="dp-per-chip ok">Convocada a la jornada</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lista.length && <div className="dp-per-vacio">Ninguna persona coincide con el filtro.</div>}
      {lista.length > (compacta ? 40 : 400) && (
        <div className="dp-per-mas">Mostrando {compacta ? 40 : 400} de {num(lista.length)}. Afina la búsqueda para ver el resto.</div>
      )}
    </div>
  );
}

/**
 * El cuadre en una línea, para la tarjeta del AD.
 *
 * Muestra lo planificado y lo que de verdad tiene destinatario. Cuando no coinciden,
 * lo dice: son cilindros que van a salir del CDT y volver.
 */
export function CuadreChips({ c }) {
  return (
    <div className="dp-cuadre">
      <span className="dp-cu"><b>{num(c.personas.length)}</b> en la lista</span>
      <span className="dp-cu ok"><b>{num(c.convocadas.length)}</b> convocadas</span>
      {c.sinPago.length > 0 && <span className="dp-cu wr"><b>{num(c.sinPago.length)}</b> sin pago</span>}
      {c.rechazados.length > 0 && (
        <span className="dp-cu bad" title="El pago no pasó la regla: no entran a la jornada">
          <AlertTriangle size={11} /> <b>{num(c.rechazados.length)}</b> pago rechazado
        </span>
      )}
    </div>
  );
}

export function PersonasStyles() {
  return <style>{`
.dp-personas{background:#F7F9FA;border:1px solid #E4EAED;border-radius:12px;padding:14px;margin-top:10px}
.dp-per-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.dp-per-tabs{display:flex;gap:5px;flex-wrap:wrap}
.dp-per-tabs button{border:0;background:#E8EDF0;border-radius:8px;padding:7px 11px;font-size:11.5px;font-weight:600;color:#516069;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.dp-per-tabs button.on{background:#17623F;color:#fff}
.dp-per-tabs em{font-style:normal;font-size:11px;font-weight:700;opacity:.72}
.dp-per-scroll{overflow:auto;max-height:420px;border:1px solid #E4E9EC;border-radius:10px;background:#fff}
.dp-per-tabla{width:100%;border-collapse:collapse;font-size:12.5px}
.dp-per-tabla th,.dp-per-tabla td{padding:9px 11px;border-bottom:1px solid #EDF1F3;text-align:left;white-space:nowrap}
.dp-per-tabla th{position:sticky;top:0;background:#F5F7F8;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#6D7982;font-weight:700;z-index:1}
.dp-per-tabla th.r,.dp-per-tabla td.r{text-align:right}
.dp-per-tabla tr.prob{background:#FDFAF4}
.dp-per-tabla td b,.dp-per-tabla td span{display:block}
.dp-per-tabla td span{font-size:11px;color:#8A959D;margin-top:2px;font-variant-numeric:tabular-nums}
.dp-per-n{color:#9AA5AD;font-variant-numeric:tabular-nums;font-size:11px}
.dp-per-doc,.dp-per-bs{font-variant-numeric:tabular-nums}
.dp-per-link{border:0;background:none;padding:0;font-size:12.5px;font-weight:640;color:#17623F;cursor:pointer;text-align:left}
.dp-per-link:hover{text-decoration:underline}
.dp-per-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:99px;font-size:11px;font-weight:650;background:#EEF2F4;color:#516069}
.dp-per-chip.ok{background:#E8F5ED;color:#216B48}
.dp-per-chip.wr{background:#FFF1DC;color:#925F19}
.dp-per-chip.bad{background:#FBE9E9;color:#944141}
.dp-per-vacio{text-align:center;padding:28px;color:#78868F;font-size:12.5px}
.dp-per-mas{font-size:11.5px;color:#78868F;padding-top:9px}
/* La tabla de AD tiene siete columnas y ahora la de personas cuelga dentro. Si no se
   acotan los anchos, el boton que abre la gente queda fuera de la vista — justo el que
   hace falta. La comuna parte en varias lineas antes que empujar el resto. */
.dx-table td.dp-ad-comuna,.dx-table th.dp-ad-comuna{max-width:210px;white-space:normal;line-height:1.35}
.dx-table td.dp-ad-ruta,.dx-table th.dp-ad-ruta{max-width:130px;white-space:normal}
.dx-table td.dp-ad-veh,.dx-table th.dp-ad-veh{max-width:180px;white-space:normal;line-height:1.35}
.dx-table td.dp-ad-carga{min-width:230px}
.dx-ad-acc{display:flex;gap:6px;align-items:center;justify-content:flex-end;white-space:nowrap}
.dx-fila-on>td{background:#F4F8FA}
.dx-fila-personas>td{padding:0 10px 12px!important;background:#F4F8FA}
/* Segmentos de AD del dia: las cuatro pantallas de AD que habia se volvieron
   filtros de una sola. */
.dx-segmentos{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px}
.dx-segmentos button{border:0;background:#EDF1F3;border-radius:8px;padding:8px 13px;font-size:12px;font-weight:600;color:#516069;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.dx-segmentos button:hover{background:#E2E8EB}
.dx-segmentos button.on{background:#17623F;color:#fff}
.dx-segmentos em{font-style:normal;font-size:11px;font-weight:700;opacity:.72}
.dx-vacio-seg{text-align:center;padding:40px;color:#78868F;font-size:13px}
.dp-cuadre{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
.dp-cu{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#6B7B85;background:#EEF2F4;border-radius:99px;padding:3px 9px;white-space:nowrap}
.dp-cu b{font-weight:700;color:#252F36;font-variant-numeric:tabular-nums}
.dp-cu.ok{background:#E8F5ED;color:#216B48}.dp-cu.ok b{color:#17623F}
.dp-cu.wr{background:#FFF1DC;color:#925F19}.dp-cu.wr b{color:#8A5A16}
.dp-cu.bad{background:#FBE9E9;color:#944141}.dp-cu.bad b{color:#A83E3E}
`}</style>;
}

/* La vista «AD del día» volvió a Distribucion.jsx el 01/09/2026: necesitaba el
   planificador, la reasignación, el visor de impresión y media docena de helpers
   que viven allí. Este módulo se queda con lo que es suyo —la gente de un AD— y
   se consume desde donde haga falta. */
