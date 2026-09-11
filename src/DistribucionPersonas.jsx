import React, { useMemo, useState } from "react";
import { Search, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { cpt, usr, num, kgDeSolicitud, reglaPago, motivoNoEntrega, estadoSolicitud } from "./datos.jsx";
import { personasDeAD, marcaDe, tipoAD } from "./flujo.js";
import { KgL } from "./Unidades.jsx";

/* ════════════════════════════════════════════════════════════════
   LAS PERSONAS DE UN AD

   Un AD son 110 personas en promedio; la mayor lleva 300. La lista nominal es la misma
   gente en todas partes —la tarjeta del AD, el detalle, la hoja impresa— y sale siempre
   de las solicitudes vivas (`personasDeAD`), no de una copia congelada al planificar.

   ANTES DEL AD LA ÚNICA INCIDENCIA ES EL PAGO. El camión sale vacío a recoger las
   bombonas que la gente lleva al punto. Si alguien llevó su bombona, si se llenó o si
   volvió vacía son hallazgos del sitio: se marcan en la recolección y en el llenado, y al
   cerrar el AD cada persona queda con su resultado en `historialAD`.

   El cuadre de la jornada (convocadas, recogidas, llenadas, devueltas) es `cuadreJornada`
   del núcleo: aquí sólo se pinta.
   ════════════════════════════════════════════════════════════════ */

/**
 * Por qué esta persona no entra a la jornada. Null si entra.
 *
 * Sólo mira el pago antes del AD: sin pago, pago rechazado o por completar. Lo del envase
 * se descubre en el punto, cuando la gente llega con su bombona o sin ella.
 * Distribución no ve importes: el faltante se nombra, no se cifra.
 */
export function problemaDe(s) {
  if (s.estado === "SIN_PAGO" && s.pago?.estado === "RECHAZADO") {
    return { tipo: reglaPago(s.pago.regla).nombre, tono: "bad", detalle: s.pago.detalleRegla || "Pago rechazado por la regla" };
  }
  if (s.estado === "SIN_PAGO") return { tipo: "Sin pago", tono: "wr", detalle: "No ha reportado transferencia" };
  if (s.estado === "POR_COMPLETAR") {
    return { tipo: "Por completar", tono: "wr", detalle: s.tarifaPendiente ? "La tarifa subió: falta cubrir la diferencia" : "Transfirió de menos: falta la diferencia" };
  }
  return null;
}

const RESULTADO = {
  ENTREGADA: ["Devuelta llena · facturada", "ok"],
  NO_RECOGIDA: ["No se recogió", "wr"],
  NO_LLENADA: ["Volvió vacía", "wr"],
  SALIO_POR_TARIFA: ["Salió por la tarifa nueva", "wr"],
};

/**
 * Lo que pasó con esta persona en este AD, o null si nunca estuvo convocada en él.
 * Cerrado el AD, lo dice `historialAD` y el estado actual del pedido (a replanificación,
 * abonado o ya atendido en otra AD). Mientras la jornada corre, lo dicen las marcas.
 */
export function resultadoDe(ruta, s) {
  const h = (s.historialAD || []).filter((x) => x.rutaId === ruta.id).slice(-1)[0];
  if (h) {
    const [texto, tono] = RESULTADO[h.resultado] || [h.resultado, ""];
    const otraAD = s.rutaId && s.rutaId !== ruta.id && s.ad;
    const despues = h.resultado === "ENTREGADA" ? null
      : s.estado === "POR_REPLANIFICAR" ? "por replanificar"
      : s.estado === "ABONADA" ? "abonada · saldo a favor"
      : s.estado === "POR_COMPLETAR" ? "por completar el pago"
      : s.estado === "EN_AD" && otraAD ? `replanificada en AD ${s.ad}`
      : s.estado === "CULMINADO" && otraAD ? `entregada en AD ${s.ad}` : null;
    return { texto: [texto, h.motivo ? motivoNoEntrega(h.motivo).nombre : null].filter(Boolean).join(" · "), despues, tono };
  }
  if (s.estado !== "EN_AD" || s.rutaId !== ruta.id) return null;
  const mk = marcaDe(ruta, s.id);
  const j = ruta.jornada || {};
  if (mk.recogida === false) return { texto: `No se recogió · ${motivoNoEntrega(mk.motivo).nombre}`, tono: "wr" };
  if (j.llenado) {
    return mk.llenada === false
      ? { texto: `Volvió vacía al punto · ${motivoNoEntrega(mk.motivo).nombre}`, tono: "wr" }
      : { texto: "Devuelta llena al punto", tono: "ok" };
  }
  if (j.recoleccion) return { texto: "Recogida · en planta", tono: "ok" };
  return { texto: "Convocada", tono: "ok" };
}

const pagoChip = (s) => (s.estado === "POR_COMPLETAR" ? ["wr", "Por completar"]
  : s.pago?.estado === "RECHAZADO" ? ["bad", "Rechazado"]
  : s.pago?.estado === "NO_APLICA" ? ["", "No requiere pago"]
  : s.pago?.estado === "VERIFICADO" ? ["ok", "Verificado"] : ["wr", "Sin pago"]);

// Se cuentan personas, no pedidos: una institución puede traer un pedido por formato.
const personasEn = (filas) => new Set(filas.map((f) => f.s.usuario)).size;

/**
 * La lista nominal. Se usa en la tarjeta del AD, en el detalle y donde haga falta:
 * es la misma gente, no tres listas que se desincronizan.
 * `onVerUsuario(usuarioId)` abre la ficha 360° de la persona.
 */
export function ListaPersonasAD({ ruta, solicitudes = [], compacta = false, onVerUsuario }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("TODAS");
  const especial = tipoAD(ruta) === "ESPECIAL";
  const filas = useMemo(() => {
    const paradas = new Map((ruta.paradas || []).map((p) => [p.solicitudId, p]));
    const ps = personasDeAD(ruta, solicitudes);
    // En una AD especial la gente se recorre en el orden de las paradas.
    const orden = especial ? [...ps].sort((a, b) => (paradas.get(a.id)?.orden ?? 999) - (paradas.get(b.id)?.orden ?? 999)) : ps;
    return orden.map((s) => ({ s, u: usr(s.usuario), prob: problemaDe(s), res: resultadoDe(ruta, s), parada: paradas.get(s.id) }));
  }, [ruta, solicitudes, especial]);

  const grupos = {
    TODAS: filas,
    CONVOCADAS: filas.filter((f) => f.res),
    NOVEDAD: filas.filter((f) => f.res?.tono === "wr"),
    PAGO: filas.filter((f) => f.prob),
  };
  const lista = (grupos[filtro] || filas).filter((f) => !q || `${f.u.nombre} ${f.u.doc} ${f.s.id}`.toLowerCase().includes(q.toLowerCase()));
  const tope = compacta ? 40 : 400;

  return (
    <div className="dp-personas">
      <div className="dp-per-tools">
        <div className="dx-search"><Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona, cédula o solicitud" /></div>
        <div className="dp-per-tabs">
          {[["TODAS", "Todas"], ["CONVOCADAS", "Convocadas"], ["NOVEDAD", "Con novedad"], ["PAGO", "Fuera por el pago"]].map(([k, l]) => (
            <button key={k} className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{l} <em>{num(personasEn(grupos[k]))}</em></button>
          ))}
        </div>
        {personasEn(filas) !== filas.length && <span className="dp-per-nota">{num(personasEn(filas))} personas · {num(filas.length)} pedidos</span>}
      </div>

      <div className="dp-per-scroll">
        <table className="dp-per-tabla">
          <thead><tr>
            <th>#</th><th>Persona</th><th>Cédula</th><th>{especial ? "Dirección" : "Comunidad"}</th><th>Producto</th>
            <th className="r">GLP</th><th>Pago</th><th>En la jornada</th>
          </tr></thead>
          <tbody>
            {lista.slice(0, tope).map((f, i) => {
              const { s, u, prob, res } = f;
              const [tonoPago, textoPago] = pagoChip(s);
              return (
                <tr key={s.id} className={prob || res?.tono === "wr" ? "prob" : ""}>
                  <td className="dp-per-n">{f.parada?.orden ?? i + 1}</td>
                  <td>
                    {onVerUsuario
                      ? <button className="dp-per-link" onClick={() => onVerUsuario(s.usuario)}>{u.nombre}</button>
                      : <b>{u.nombre}</b>}
                    <span>{s.id}</span>
                  </td>
                  <td className="dp-per-doc">{u.doc}</td>
                  <td className="dp-per-lugar">{especial ? (f.parada?.direccion || u.dir || u.sector || "—") : (s.comunidad || ruta.comunidad || "—")}</td>
                  <td>{s.cantidad > 1 ? `${s.cantidad} × ` : ""}{cpt(s.concepto).corto}</td>
                  <td className="r"><KgL kg={kgDeSolicitud(s)} /></td>
                  <td><span className={`dp-per-chip ${tonoPago}`}>
                    {tonoPago === "ok" ? <CheckCircle2 size={11} /> : tonoPago === "wr" ? <Clock3 size={11} /> : null} {textoPago}</span></td>
                  <td>{res
                    ? <><span className={`dp-per-chip ${res.tono}`}>{res.texto}</span>{res.despues && <span>→ {res.despues}</span>}</>
                    : prob
                      ? <span className={`dp-per-chip ${prob.tono}`} title={prob.detalle}><AlertTriangle size={11} /> {prob.tipo} · no entra</span>
                      : <span className="dp-per-chip" title="Pagó después de planificarse el AD: se atiende en una AD especial">{estadoSolicitud(s.estado).admin} · no convocada</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!lista.length && <div className="dp-per-vacio">Ninguna persona coincide con el filtro.</div>}
      {lista.length > tope && (
        <div className="dp-per-mas">Mostrando {tope} de {num(lista.length)}. Afina la búsqueda para ver el resto.</div>
      )}
    </div>
  );
}

/**
 * El cuadre en una línea, para la tarjeta del AD. Recibe `cuadreJornada(ruta, solicitudes)`:
 * salen diez, vuelven diez. Cerrado el AD, muestra en qué terminó cada pedido.
 * `fuera`: personas de la lista del AD que no entraron por el pago.
 */
export function CuadreChips({ c, fuera = 0 }) {
  if (!c) return null;
  return (
    <div className="dp-cuadre">
      <span className="dp-cu ok"><b>{num(c.convocadas)}</b> convocadas</span>
      {c.cerrada ? <>
        <span className="dp-cu ok"><b>{num(c.entregadas)}</b> entregadas</span>
        {c.replanificadas > 0 && <span className="dp-cu wr"><b>{num(c.replanificadas)}</b> a replanificación</span>}
        {c.abonadas > 0 && <span className="dp-cu"><b>{num(c.abonadas)}</b> abonadas</span>}
      </> : <>
        {c.hayRecoleccion && <span className="dp-cu"><b>{num(c.recogidas)}</b> recogidas</span>}
        {c.noRecogidas > 0 && <span className="dp-cu wr"><b>{num(c.noRecogidas)}</b> no recogidas</span>}
        {c.hayLlenado && <span className="dp-cu ok"><b>{num(c.llenadas)}</b> llenas</span>}
        {c.noLlenadas > 0 && <span className="dp-cu wr"><b>{num(c.noLlenadas)}</b> vuelven vacías</span>}
      </>}
      {fuera > 0 && (
        <span className="dp-cu bad" title="Están en la lista de la comunidad pero el pago no está completo: no entran a la jornada">
          <AlertTriangle size={11} /> <b>{num(fuera)}</b> fuera por el pago
        </span>
      )}
      {c.cuadra === false && <span className="dp-cu bad"><AlertTriangle size={11} /> no cuadra</span>}
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
.dp-per-nota{font-size:11px;color:#78868F}
.dp-per-scroll{overflow:auto;max-height:420px;border:1px solid #E4E9EC;border-radius:10px;background:#fff}
.dp-per-tabla{width:100%;border-collapse:collapse;font-size:12.5px}
.dp-per-tabla th,.dp-per-tabla td{padding:9px 11px;border-bottom:1px solid #EDF1F3;text-align:left;white-space:nowrap}
.dp-per-tabla th{position:sticky;top:0;background:#F5F7F8;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#6D7982;font-weight:700;z-index:1}
.dp-per-tabla th.r,.dp-per-tabla td.r{text-align:right}
.dp-per-tabla tr.prob{background:#FDFAF4}
.dp-per-tabla td b,.dp-per-tabla td>span{display:block}
.dp-per-tabla td>span{font-size:11px;color:#8A959D;margin-top:2px;font-variant-numeric:tabular-nums}
.dp-per-tabla td>span.dp-per-chip{display:inline-flex;margin-top:0}
.dp-per-n{color:#9AA5AD;font-variant-numeric:tabular-nums;font-size:11px}
.dp-per-doc{font-variant-numeric:tabular-nums}
.dp-per-lugar{max-width:230px;white-space:normal!important;line-height:1.35}
.dp-per-link{border:0;background:none;padding:0;font-size:12.5px;font-weight:640;color:#17623F;cursor:pointer;text-align:left}
.dp-per-link:hover{text-decoration:underline}
.dp-per-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:99px;font-size:11px;font-weight:650;background:#EEF2F4;color:#516069}
.dp-per-chip.ok{background:#E8F5ED;color:#216B48}
.dp-per-chip.wr{background:#FFF1DC;color:#925F19}
.dp-per-chip.bad{background:#FBE9E9;color:#944141}
.dp-per-vacio{text-align:center;padding:28px;color:#78868F;font-size:12.5px}
.dp-per-mas{font-size:11.5px;color:#78868F;padding-top:9px}
/* La tabla de AD tiene siete columnas y la de personas cuelga dentro. Si no se acotan
   los anchos, el boton que abre la gente queda fuera de la vista — justo el que hace
   falta. La comuna parte en varias lineas antes que empujar el resto. */
.dx-table td.dp-ad-comuna,.dx-table th.dp-ad-comuna{max-width:210px;white-space:normal;line-height:1.35}
.dx-table td.dp-ad-ruta,.dx-table th.dp-ad-ruta{max-width:130px;white-space:normal}
.dx-table td.dp-ad-veh,.dx-table th.dp-ad-veh{max-width:180px;white-space:normal;line-height:1.35}
.dx-table td.dp-ad-carga{min-width:230px;white-space:normal}
.dx-ad-acc{display:flex;gap:6px;align-items:center;justify-content:flex-end;white-space:nowrap}
.dx-fila-on>td{background:#F4F8FA}
.dx-fila-personas>td{padding:0 10px 12px!important;background:#F4F8FA}
/* Segmentos de AD del dia: los momentos del AD, como filtros de una sola pantalla. */
.dx-segmentos{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px}
.dx-segmentos button{border:0;background:#EDF1F3;border-radius:8px;padding:8px 13px;font-size:12px;font-weight:600;color:#516069;cursor:pointer;display:inline-flex;gap:6px;align-items:center}
.dx-segmentos button:hover{background:#E2E8EB}
.dx-segmentos button.on{background:#17623F;color:#fff}
.dx-segmentos em{font-style:normal;font-size:11px;font-weight:700;opacity:.72}
.dx-vacio-seg{text-align:center;padding:40px;color:#78868F;font-size:13px}
.dx-table tr.dx-fuera td{background:#FAFBFC;color:#7A8790}
.dx-table tr.dx-fuera td b{color:#5E6B74}
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
