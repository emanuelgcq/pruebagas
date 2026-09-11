/* ═══════════════════════════════════════════════════════════════════
   FLUJO — las transiciones del pedido y las cifras que leen todas las pantallas.

   Un solo objeto —la solicitud— atraviesa el sistema:

     pide y paga → [por completar] → pagada → AD (jornada o especial)
       → recolección en el punto → llenado en planta → devolución al punto → cierre
       · si hubo un problema → por replanificar → AD especial → mismo ciclo
       · si vence el plazo sin replanificar → saldo a favor

   Todas las funciones de este archivo son puras: reciben el estado y devuelven el estado
   nuevo. La aplicación las usa al pulsar un botón y la semilla las usa para construir los
   datos de demostración, así que las pantallas y los datos cuadran por construcción.
   ═══════════════════════════════════════════════════════════════════ */
import {
  HOY, CDTS, cpt, tpd, usr, montos, bs, fecha,
  aplicarReglaPago, reglaPago, aplicarSaldo, saldosDe, puedeSolicitar, validarCanje, envasesDe,
  motivoNoEntrega, MOTIVOS_NO_ENTREGA, estadoSolicitud, cubiertoDe, faltanteDe, dineroAplicadoDe,
  esPendienteDespacho, pagadasPendientesDe, kgDeSolicitud, finDeCiclo, esFechaPeriodo,
  segmentoUsuario, comunaOf, cdtOf, esCodigoGenerico, diasEntre, ESTADO_ABONADA, kgALitros, BANCOS,
} from "./datos.jsx";
import { unidadDistribucion, operadorDistribucion, ayudanteDistribucion, disponibilidadUnidad } from "./distribucionSeed.js";

const r2 = (n) => Number(Number(n || 0).toFixed(2));
const KGS = [10, 15, 18, 21, 27, 43];

/* ═══════════  ESTADOS DEL AD · POR MOMENTOS  ═══════════
   El camión sale vacío a recoger. El AD pasa por los mismos momentos que la jornada:
   planificada → en recolección → en planta → devuelta al punto → cerrada.
   Ya no existen los estados del camión que salía cargado (preparando carga, lista para
   salida, parcial, entregada): si llegan de datos viejos se leen como su equivalente. */
export const ESTADOS_AD = [
  { id: "SIN_PLANIFICAR", nombre: "Por planificar", momento: 0, tono: "gris" },
  { id: "ASIGNADA", nombre: "Planificada", momento: 1, tono: "azul" },
  { id: "REPROGRAMADA", nombre: "Reprogramada", momento: 1, tono: "ambar" },
  { id: "EN_RUTA", nombre: "En recolección", momento: 2, tono: "azul" },
  { id: "EN_PLANTA", nombre: "En planta · llenado", momento: 3, tono: "azul" },
  { id: "EN_PUNTO", nombre: "Devuelta al punto", momento: 4, tono: "verde" },
  { id: "INCIDENCIA", nombre: "Con incidencia", momento: -1, tono: "rojo" },
  { id: "CERRADA", nombre: "Cerrada", momento: 5, tono: "verde" },
];
const LEGADO_AD = { PREPARANDO: "ASIGNADA", LISTA_SALIDA: "ASIGNADA", PARCIAL: "CERRADA", ENTREGADA: "CERRADA", CANCELADA: "CERRADA" };
export const estadoAD = (id) => ESTADOS_AD.find((e) => e.id === (LEGADO_AD[id] || id)) || ESTADOS_AD[0];
export const adPlanificada = (r) => Boolean(r) && estadoAD(r.estadoRuta).id !== "SIN_PLANIFICAR" && Boolean(r.ad) && String(r.ad) !== "0";
export const adCerrada = (r) => estadoAD(r?.estadoRuta).id === "CERRADA";
export const adEnJornada = (r) => ["EN_RUTA", "EN_PLANTA", "EN_PUNTO"].includes(estadoAD(r?.estadoRuta).id);
export const adActiva = (r) => adPlanificada(r) && !adCerrada(r);

/** Lo único que se puede hacer a continuación con un AD. Una sola regla para todas las pantallas. */
export const siguienteAccionAD = (r) => {
  switch (estadoAD(r?.estadoRuta).id) {
    case "ASIGNADA": case "REPROGRAMADA": return { id: "SALIDA", nombre: "Marcar salida a recolección" };
    case "EN_RUTA": return { id: "RECOLECCION", nombre: "Registrar recolección" };
    case "EN_PLANTA": return { id: "LLENADO", nombre: "Registrar llenado y devolución" };
    case "EN_PUNTO": return { id: "CIERRE", nombre: "Cerrar AD" };
    case "INCIDENCIA": return { id: "RESOLVER", nombre: "Resolver incidencia" };
    default: return null;
  }
};

export const TIPOS_AD = [
  { id: "JORNADA", nombre: "Jornada comunal", desc: "La gente lleva su bombona al punto comunal; vuelve llena al mismo punto" },
  { id: "ESPECIAL", nombre: "AD especial por usuario", desc: "Ruta por domicilio que arma Distribución para resolver problemas o entregas directas" },
  { id: "INSTITUCIONAL", nombre: "Institucional", desc: "Pedido de una institución por contrato" },
  { id: "COMERCIAL", nombre: "Comercial", desc: "Pedido de comercio por contrato" },
];
export const tipoAD = (r) => r?.tipoAD || (r?.bloque === "INSTITUCIÓN" ? "INSTITUCIONAL" : r?.bloque === "COMERCIO" ? "COMERCIAL" : "JORNADA");
export const tipoADInfo = (r) => TIPOS_AD.find((t) => t.id === tipoAD(r)) || TIPOS_AD[0];

/* ═══════════  QUIÉN ESTÁ EN CADA AD  ═══════════ */

/** Todas las personas que pasaron por un AD: las que siguen en ella y las que salieron al cerrarse. */
export const personasDeAD = (ruta, solicitudes = []) => solicitudes.filter((s) =>
  s.rutaId === ruta.id || (s.historialAD || []).some((h) => h.rutaId === ruta.id));

/** Convocadas: pagadas y asignadas a este AD, todavía sin cerrar. */
export const convocadasDeAD = (ruta, solicitudes = []) =>
  solicitudes.filter((s) => s.rutaId === ruta.id && s.estado === "EN_AD");

/** Resultado de la jornada de una persona: lo marcado en recolección y en planta. */
export const marcaDe = (ruta, solicitudId) => ruta?.jornada?.marcas?.[solicitudId] || {};

/**
 * CUADRE DE LA JORNADA · salen diez, vuelven diez.
 * Convocadas = recogidas + no recogidas. Recogidas = devueltas llenas + devueltas vacías.
 * Toda bombona recogida vuelve al punto: llena, o vacía si estaba mala o la planta falló.
 */
export function cuadreJornada(ruta, solicitudes = []) {
  if (adCerrada(ruta) && ruta.cierreDetalle) return { ...ruta.cierreDetalle, cerrada: true, cuadra: true };
  const conv = convocadasDeAD(ruta, solicitudes);
  const j = ruta?.jornada || {};
  const hayRecoleccion = Boolean(j.recoleccion);
  const hayLlenado = Boolean(j.llenado);
  const noRecogidas = hayRecoleccion ? conv.filter((s) => marcaDe(ruta, s.id).recogida === false) : [];
  const recogidas = hayRecoleccion ? conv.filter((s) => marcaDe(ruta, s.id).recogida !== false) : [];
  const noLlenadas = hayLlenado ? recogidas.filter((s) => marcaDe(ruta, s.id).llenada === false) : [];
  const llenadas = hayLlenado ? recogidas.filter((s) => marcaDe(ruta, s.id).llenada !== false) : [];
  const kg = (arr) => arr.reduce((a, s) => a + kgDeSolicitud(s), 0);
  const porMotivo = (arr) => arr.reduce((acc, s) => {
    const m = marcaDe(ruta, s.id).motivo || "SIN_MOTIVO";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});
  return {
    convocadas: conv.length, kgConvocado: kg(conv),
    recogidas: hayRecoleccion ? recogidas.length : null, noRecogidas: noRecogidas.length,
    llenadas: hayLlenado ? llenadas.length : null, noLlenadas: noLlenadas.length, kgLlenado: kg(llenadas),
    devueltas: hayLlenado ? recogidas.length : null,
    porMotivoRecoleccion: porMotivo(noRecogidas), porMotivoPlanta: porMotivo(noLlenadas),
    hayRecoleccion, hayLlenado, cerrada: false,
    cuadra: !hayLlenado || recogidas.length === llenadas.length + noLlenadas.length,
  };
}

/* ═══════════  SECUENCIAS Y MOVIMIENTOS  ═══════════ */

export function nuevoAbono(seq, usuario, tipo, monto, referencia, detalle, extra = {}, fechaMov = HOY) {
  seq.abo = (seq.abo || 0) + 1;
  return { id: `ABO-${seq.abo}`, usuario, fecha: fechaMov, tipo, monto: r2(monto), referencia, detalle, ...extra };
}

function nuevoMovPlanta(seq, d) {
  seq.mp = (seq.mp || 0) + 1;
  return { id: `MP-${seq.mp}`, fecha: d.fecha || HOY, hora: d.hora || "—", estado: "CONFIRMADA",
    vehiculo: "—", operador: "—", cedula: "—", nota: "", kg: 0, cilindros: null, ...d, litros: kgALitros(Number(d.kg || 0)) };
}

const cilindrosDe = (sols) => sols.reduce((acc, s) => {
  const k = cpt(s.concepto).kg;
  if (KGS.includes(k)) acc[k] = (acc[k] || 0) + Number(s.cantidad || 1);
  return acc;
}, {});

const reemplazar = (solicitudes, cambiadas) => {
  const mapa = new Map(cambiadas.map((s) => [s.id, s]));
  return solicitudes.map((s) => mapa.get(s.id) || s);
};

/** Referencias bancarias que ya respaldan un pago: la base de la regla de referencia repetida. */
export const referenciasEnUso = (solicitudes) => new Set(solicitudes.flatMap((s) =>
  [s.pago?.estado !== "RECHAZADO" ? s.pago?.referencia : null, ...((s.pago?.complementos || []).map((c) => c.referencia))]
).filter(Boolean));

/* ═══════════  1 · PEDIR Y PAGAR  ═══════════ */

/**
 * NUEVA SOLICITUD · la misma vía para el portal y para la taquilla.
 * Aplica el tope por núcleo, avisa del envase (no bloquea), descuenta primero el saldo a
 * favor y aplica la regla de pago sobre lo que falta: exacto, de más (excedente al saldo),
 * de menos (queda por completar) o referencia repetida (se rechaza sin tocar nada).
 */
export function nuevaSolicitud({ solicitudes, abonos, parque }, d, seq) {
  const u = usr(d.usuario);
  const c = cpt(d.concepto);
  const cantidad = Number(d.cantidad || 1);
  const fechaSol = d.fecha || HOY;
  if (!(cantidad > 0)) return { ok: false, error: "La cantidad no es válida." };
  const cupo = puedeSolicitar(u, solicitudes, d.concepto, cantidad);
  if (!cupo.ok) return { ok: false, error: cupo.motivo };
  const canje = c.bombona ? validarCanje(envasesDe(parque, u.id), c.kg) : { ok: true };

  const td = tpd(d.tipoDespacho || "COMERCIAL");
  const m = montos(d.concepto, cantidad, u.id, fechaSol);
  const saldo = saldosDe(abonos)[u.id] || 0;
  const reparto = td.requierePago ? aplicarSaldo(m.total, saldo) : { devengado: 0, porPagar: 0 };
  const referencia = String(d.referencia || "").trim() || null;
  const recibido = !td.requierePago ? 0
    : d.montoRecibido != null && d.montoRecibido !== "" ? Number(d.montoRecibido) : reparto.porPagar;

  let res;
  if (!td.requierePago) {
    res = { regla: null, estadoPago: "NO_APLICA", estadoSolicitud: "PAGADA", detalle: "No requiere pago" };
  } else if (reparto.porPagar <= 0.009) {
    res = { regla: "EXACTO", estadoPago: "VERIFICADO", estadoSolicitud: "PAGADA", detalle: "Cubierto por completo con su saldo a favor" };
  } else {
    res = aplicarReglaPago({ montoRecibido: recibido, totalFacturado: reparto.porPagar, referencia, referenciasVistas: referenciasEnUso(solicitudes) });
  }
  const duplicada = res.regla === "REFERENCIA_DUPLICADA";
  const devengado = duplicada ? 0 : reparto.devengado;
  const aplicadoBanco = duplicada ? 0 : Math.min(recibido, reparto.porPagar);
  const excedente = !duplicada && res.regla === "MONTO_MAYOR" ? r2(recibido - reparto.porPagar) : 0;

  seq.sol += 1; seq.ped += 7;
  const id = `SOL-${seq.sol}`;
  const refFinal = referencia || (reparto.porPagar > 0.009 ? String((seq.ref += 131)) : null);
  const residencial = segmentoUsuario(u) === "RESIDENCIAL";
  const nueva = {
    id, pedidoNro: seq.ped, usuario: u.id, cdt: d.cdt || u.cdt, comuna: u.comuna,
    concepto: d.concepto, cantidad, tipoDespacho: td.id, condicionVenta: u.condicionVenta || "CONTADO",
    fecha: fechaSol, entrega: null, ventana: residencial ? "Jornada comunal" : "Entrega directa", nota: d.nota || "",
    jornadaComunal: null, modalidadEntrega: residencial ? "COMUNA" : "DIRECTA_COMERCIAL",
    estado: res.estadoSolicitud, rutaId: null, ad: null,
    operador: null, unidad: null, transportistaTipo: null, epsdc: null,
    boleta: null, factura: null, serie: null, control: null,
    ...m,
    cubierto: td.requierePago ? r2(devengado + aplicadoBanco) : m.total,
    saldoAplicado: devengado, montoTransferido: recibido,
    origenRegistro: d.origen || "PORTAL",
    registro: d.registro || null,
    historialAD: [],
    pago: {
      banco: d.banco || null, referencia: refFinal, fecha: fechaSol,
      estado: res.estadoPago, auto: d.origen !== "TAQUILLA", canal: d.canal || (d.origen === "TAQUILLA" ? "TAQUILLA" : "PORTAL"),
      montoRecibido: recibido, regla: res.regla, detalleRegla: res.detalle, resueltoEn: fechaSol,
    },
  };
  const nuevos = [];
  if (devengado > 0.009) {
    nuevos.push(nuevoAbono(seq, u.id, "CONSUMO", devengado, id, `Descontado en ${id} · ${c.corto}`, { solicitud: id }, fechaSol));
  }
  if (excedente > 0.009) {
    nuevos.push(nuevoAbono(seq, u.id, "ABONO_EXCEDENTE", excedente, refFinal || id,
      `${reglaPago("MONTO_MAYOR").nombre} · Bs ${bs(recibido)} sobre Bs ${bs(reparto.porPagar)} por pagar`,
      { solicitud: id, banco: d.banco || null, automatico: true }, fechaSol));
  }
  return {
    ok: true, solicitud: nueva, abonos: nuevos, regla: res.regla, detalle: res.detalle,
    devengado, excedente, faltante: faltanteDe(nueva), porPagar: reparto.porPagar,
    avisoEnvase: canje.ok ? null : canje.motivo,
  };
}

/**
 * COMPLETAR UN PAGO · para un pedido "por completar". Primero se descuenta el saldo a
 * favor; lo que falte lo transfiere el usuario y la regla lo resuelve igual que siempre.
 */
export function completarPago({ solicitudes, abonos }, solicitudId, d = {}, seq) {
  const s = solicitudes.find((x) => x.id === solicitudId);
  if (!s) return { ok: false, error: "Solicitud no encontrada." };
  if (s.estado !== "POR_COMPLETAR") return { ok: false, error: "Esta solicitud no tiene pago por completar." };
  const fechaPago = d.fecha || HOY;
  const faltante = faltanteDe(s);
  const saldo = saldosDe(abonos)[s.usuario] || 0;
  const dev = r2(Math.min(saldo, faltante));
  const porPagar = r2(faltante - dev);
  const recibido = porPagar <= 0.009 ? 0 : d.montoRecibido != null && d.montoRecibido !== "" ? Number(d.montoRecibido) : porPagar;
  const referencia = String(d.referencia || "").trim() || null;
  let res = { regla: "EXACTO", detalle: "Cubierto con su saldo a favor" };
  if (porPagar > 0.009) {
    res = aplicarReglaPago({ montoRecibido: recibido, totalFacturado: porPagar, referencia, referenciasVistas: referenciasEnUso(solicitudes) });
    if (res.regla === "REFERENCIA_DUPLICADA") return { ok: false, error: res.detalle, regla: res.regla };
  }
  const aplicado = Math.min(recibido, porPagar);
  const excedente = r2(Math.max(0, recibido - porPagar));
  const cubierto = r2(cubiertoDe(s) + dev + aplicado);
  const completo = cubierto >= Number(s.total) - 0.01;
  const nuevos = [];
  if (dev > 0.009) nuevos.push(nuevoAbono(seq, s.usuario, "CONSUMO", dev, s.id, `Descontado para completar ${s.id}`, { solicitud: s.id }, fechaPago));
  if (excedente > 0.009) nuevos.push(nuevoAbono(seq, s.usuario, "ABONO_EXCEDENTE", excedente, referencia || s.id,
    `${reglaPago("MONTO_MAYOR").nombre} al completar ${s.id}`, { solicitud: s.id, banco: d.banco || null, automatico: true }, fechaPago));
  const actualizada = {
    ...s, cubierto: completo ? Number(s.total) : cubierto, estado: completo ? "PAGADA" : "POR_COMPLETAR",
    saldoAplicado: r2(Number(s.saldoAplicado || 0) + dev),
    pago: {
      ...s.pago, estado: completo ? "VERIFICADO" : "INCOMPLETO",
      complementos: [...(s.pago?.complementos || []), ...(aplicado > 0 || recibido > 0 ? [{ referencia, monto: recibido, fecha: fechaPago, banco: d.banco || null, canal: d.canal || "PORTAL" }] : [])],
      detalleRegla: completo ? `Pago completado el ${fecha(fechaPago)}` : `Aún faltan Bs ${bs(Number(s.total) - cubierto)}`,
    },
    tarifaPendiente: completo ? null : s.tarifaPendiente || null,
  };
  return { ok: true, solicitudes: reemplazar(solicitudes, [actualizada]), abonos: nuevos, solicitud: actualizada,
    completo, faltante: faltanteDe(actualizada), devengado: dev, excedente };
}

/**
 * PRECIO ACTUAL · los precios cambian cada mes. Un pedido que espera se cobra al precio
 * vigente: si subió, la diferencia la cubre primero el saldo a favor y, si no alcanza, el
 * pedido queda por completar (y sale del AD si todavía no salió). Si bajó, el excedente
 * pasa al saldo. Un AD que ya salió tiene su precio fijado desde la salida.
 */
export function repreciar({ solicitudes, abonos, rutas = [] }, fechaRef, seq, filtro = () => true) {
  const salidas = new Set(rutas.filter((r) => ["EN_RUTA", "EN_PLANTA", "EN_PUNTO", "CERRADA"].includes(estadoAD(r.estadoRuta).id)).map((r) => r.id));
  const saldos = { ...saldosDe(abonos) };
  const nuevos = [];
  const cambiadas = [];
  solicitudes.forEach((s) => {
    if (!filtro(s)) return;
    if (!["PAGADA", "POR_COMPLETAR", "POR_REPLANIFICAR", "EN_AD"].includes(s.estado)) return;
    if (!tpd(s.tipoDespacho).requierePago) return;
    if (s.estado === "EN_AD" && salidas.has(s.rutaId)) return;
    const m = montos(s.concepto, s.cantidad, s.usuario, fechaRef);
    if (Math.abs(m.total - Number(s.total)) < 0.01) return;
    let cubierto = cubiertoDe(s);
    let aplicadoSaldo = 0;
    if (m.total > cubierto + 0.009) {
      aplicadoSaldo = r2(Math.min(saldos[s.usuario] || 0, m.total - cubierto));
      if (aplicadoSaldo > 0) {
        saldos[s.usuario] = r2((saldos[s.usuario] || 0) - aplicadoSaldo);
        cubierto = r2(cubierto + aplicadoSaldo);
        nuevos.push(nuevoAbono(seq, s.usuario, "CONSUMO", aplicadoSaldo, s.id,
          `Diferencia por tarifa nueva en ${s.id}`, { solicitud: s.id, ajusteTarifa: true }, fechaRef));
      }
    } else if (m.total < cubierto - 0.009) {
      const exc = r2(cubierto - m.total);
      cubierto = m.total;
      nuevos.push(nuevoAbono(seq, s.usuario, "ABONO_EXCEDENTE", exc, s.id,
        `La tarifa bajó · la diferencia de ${s.id} pasa a su saldo`, { solicitud: s.id, ajusteTarifa: true }, fechaRef));
    }
    const completo = cubierto >= m.total - 0.009;
    const antes = { precioUnitario: s.precioUnitario, total: s.total };
    const sale = !completo && s.estado === "EN_AD";
    cambiadas.push({
      ...s, ...m, cubierto, saldoAplicado: r2(Number(s.saldoAplicado || 0) + aplicadoSaldo),
      estado: completo ? (s.estado === "POR_COMPLETAR" ? "PAGADA" : s.estado) : "POR_COMPLETAR",
      ...(sale ? { ad: null, historialAD: [...(s.historialAD || []), { rutaId: s.rutaId, ad: s.ad, resultado: "SALIO_POR_TARIFA", fecha: fechaRef }], rutaId: s.rutaId } : {}),
      tarifaAnterior: antes,
      tarifaPendiente: completo ? null : { desde: fechaRef, faltante: r2(m.total - cubierto) },
      pago: { ...s.pago, estado: completo ? (s.pago?.estado === "INCOMPLETO" ? "VERIFICADO" : s.pago?.estado) : "INCOMPLETO" },
    });
  });
  return { solicitudes: reemplazar(solicitudes, cambiadas), abonos: nuevos, cambiadas };
}

/* ═══════════  2 · PLANIFICAR  ═══════════ */

/** Pedidos pagados que esperan jornada, agrupados como se planifica: por comunidad. */
export function gruposPorPlanificar(solicitudes = [], rutas = []) {
  const porRuta = new Map(rutas.map((r) => [r.id, r]));
  const grupos = new Map();
  solicitudes.forEach((s) => {
    if (!cpt(s.concepto).bombona || esCodigoGenerico(s.usuario)) return;
    if (s.estado !== "PAGADA" && s.estado !== "SIN_PAGO" && s.estado !== "POR_COMPLETAR") return;
    if (s.ad) return;
    const r = s.rutaId ? porRuta.get(s.rutaId) : null;
    /* Si su comunidad ya tiene un AD planificado que todavía no sale (completó el pago
       después, por ejemplo), se ofrece sumarlo a ese mismo AD. Si ya salió, va en especial. */
    const sumable = r && adPlanificada(r) && ["ASIGNADA", "REPROGRAMADA"].includes(estadoAD(r.estadoRuta).id);
    if (r && adPlanificada(r) && !sumable) return;
    // Sin ruta de la hoja, la entrega directa (comercio, institución) va en AD especial.
    if (!r && s.modalidadEntrega && s.modalidadEntrega !== "COMUNA") return;
    const com = comunaOf(s.comuna);
    const clave = r ? `RUTA:${r.id}` : `COM:${s.comuna}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave, rutaId: r?.id || null, adExistente: sumable ? String(r.ad) : null, comunaId: s.comuna, cdt: s.cdt || com.cdt,
        comuna: r?.comuna || com.nombre, comunidad: r?.comunidad || com.punto || com.sector || com.nombre,
        parroquia: r?.parroquia || "", bloque: r?.bloque || null,
        // `fuera`: quienes pidieron y no entran por el pago. El planificador los ve con su
        // nombre y su estado de pago, nunca con montos.
        pagadas: [], fuera: [], sinPago: 0, porCompletar: 0, cilindros: {}, kg: 0, desde: null,
      });
    }
    const g = grupos.get(clave);
    if (s.estado === "PAGADA") {
      g.pagadas.push(s);
      const k = cpt(s.concepto).kg;
      g.cilindros[k] = (g.cilindros[k] || 0) + Number(s.cantidad || 1);
      g.kg += kgDeSolicitud(s);
      const f = s.pago?.fecha || s.fecha;
      if (f && (!g.desde || f < g.desde)) g.desde = f;
    } else if (s.estado === "POR_COMPLETAR") { g.porCompletar += 1; g.fuera.push(s); }
    else { g.sinPago += 1; g.fuera.push(s); }
  });
  return [...grupos.values()].filter((g) => g.pagadas.length)
    .map((g) => ({ ...g, personas: g.pagadas.length, diasEspera: g.desde ? diasEntre(g.desde, HOY) : 0 }))
    .sort((a, b) => b.diasEspera - a.diasEspera || b.personas - a.personas);
}

/** Bandeja de replanificación: todo pedido con un problema, en el orden en que conviene atenderlo. */
export function bandejaReplanificacion(solicitudes = [], parque = []) {
  return solicitudes.filter((s) => s.estado === "POR_REPLANIFICAR").map((s) => {
    const p = s.problema || {};
    const plazo = p.plazo || finDeCiclo(p.fecha || HOY);
    const envases = envasesDe(parque, s.usuario);
    const envaseApto = envases.some((e) => e.kg === cpt(s.concepto).kg && e.estado === "EN_USUARIO");
    return { ...s, motivoProblema: motivoNoEntrega(p.motivo), plazo, diasAlPlazo: diasEntre(HOY, plazo),
      diasEnBandeja: p.fecha ? diasEntre(p.fecha, HOY) : 0, prioridad: p.imputable === "EMPRESA" || p.prioridad, envaseApto };
  }).sort((a, b) => (b.prioridad ? 1 : 0) - (a.prioridad ? 1 : 0) || a.diasAlPlazo - b.diasAlPlazo || b.diasEnBandeja - a.diasEnBandeja);
}

/**
 * PLANIFICAR UN AD · jornada comunal o AD especial por usuario.
 * Sólo entran pedidos pagados completos (o por replanificar, en una especial). El vehículo
 * debe estar realmente disponible: certificación, póliza, mantenimiento y ayudante.
 */
export function planificarAD({ solicitudes, rutas }, d, seq) {
  const tipo = d.tipo || "JORNADA";
  const ids = new Set(d.solicitudIds || []);
  const elegidas = solicitudes.filter((s) => ids.has(s.id));
  if (!elegidas.length) return { ok: false, error: "No hay pedidos seleccionados." };
  const invalidas = elegidas.filter((s) => !(s.estado === "PAGADA" || (tipo === "ESPECIAL" && s.estado === "POR_REPLANIFICAR")) || s.ad);
  if (invalidas.length) {
    return { ok: false, error: `${invalidas.length} pedido(s) no se pueden planificar: sólo entran pagados completos${tipo === "ESPECIAL" ? " o por replanificar" : ""} que no estén ya en un AD.` };
  }
  const base = d.rutaId ? rutas.find((r) => r.id === d.rutaId) : null;
  /* Sumar pedidos a un AD ya planificado: sólo mientras no haya salido, y conserva su número.
     Así los que ya estaban convocados no quedan apuntando a un AD que cambió de nombre. */
  const yaPlanificada = base && adPlanificada(base);
  if (yaPlanificada && !["ASIGNADA", "REPROGRAMADA"].includes(estadoAD(base.estadoRuta).id)) {
    return { ok: false, error: `El AD ${base.ad} ya salió a recolección: los pedidos nuevos van en otro AD o en una especial.` };
  }
  if (yaPlanificada) d = { ...d, ad: base.ad, unidad: d.unidad || base.unidad, operadorId: d.operadorId || base.operadorId, ayudanteId: d.ayudanteId || base.ayudanteId };
  const unidad = unidadDistribucion(d.unidad);
  if (!unidad || unidad.tipo === "POR_ASIGNAR") return { ok: false, error: "Seleccione un vehículo." };
  const disp = disponibilidadUnidad(unidad, d.fecha || HOY);
  if (!disp.disponible) return { ok: false, error: `El vehículo ${unidad.placa} no está disponible: ${disp.motivos.join(" · ")}.` };
  const op = operadorDistribucion(d.operadorId || unidad.operadorDefault);
  if (!op || op.tipo === "POR_ASIGNAR") return { ok: false, error: "Seleccione el conductor." };
  const ay = ayudanteDistribucion(d.ayudanteId || unidad.ayudanteDefault);
  if (!ay.activo) return { ok: false, error: `El ayudante ${ay.nombre} no está disponible.` };
  const ad = String(d.ad || "").trim();
  if (!ad || ad === "0") return { ok: false, error: "Indique el número de AD." };
  if (rutas.some((r) => String(r.ad) === ad && r.id !== d.rutaId)) return { ok: false, error: `El AD ${ad} ya existe.` };

  const primera = elegidas[0];
  const com = comunaOf(primera.comuna);
  // La carga del AD sale de TODAS sus convocadas: las que ya estaban y las que se suman.
  const cil = cilindrosDe([...(yaPlanificada ? convocadasDeAD(base, solicitudes) : []), ...elegidas]);
  const fechaPlan = d.fecha || HOY;
  const comunes = {
    ad, unidad: unidad.placa, placa: unidad.placa, unidadCodigoInterno: unidad.codigoInterno,
    operadorId: op.id, conductor: op.nombre, conductorCedula: op.cedula,
    ayudanteId: ay.id, ayudante: ay.nombre, ayudanteCedula: ay.cedula,
    transportistaTipo: unidad.tipo, epsdc: unidad.epsdc || null,
    estadoRuta: "ASIGNADA", fechaPlan, fechaJornada: d.fechaJornada || fechaPlan, horaSalida: null, fechaSalida: null,
    cilindros: cil, tipoAD: tipo, notaPlan: d.nota || null, planificadaPor: d.por || "Distribución", jornada: null,
  };
  let ruta;
  if (base) {
    ruta = { ...base, ...comunes, cilindrosHoja: base.cilindrosHoja || base.cilindros,
      ...(yaPlanificada ? { fechaPlan: base.fechaPlan || fechaPlan, fechaJornada: d.fechaJornada || base.fechaJornada, estadoRuta: base.estadoRuta, jornada: base.jornada || null } : {}) };
  } else {
    seq.ruta = (seq.ruta || 0) + 1;
    const prefijo = tipo === "ESPECIAL" ? "ESP" : "JOR";
    ruta = {
      id: `${prefijo}-${ad}`, bloque: tipo === "ESPECIAL" ? "ESPECIAL" : (d.bloque || com.nombre.toUpperCase()),
      zona: "", ruta: String(seq.ruta),
      comuna: tipo === "ESPECIAL" ? "AD ESPECIAL POR USUARIO" : (d.comuna || com.nombre.toUpperCase()),
      comunidad: tipo === "ESPECIAL" ? `${elegidas.length} parada${elegidas.length > 1 ? "s" : ""} por domicilio` : (d.comunidad || com.punto || com.sector || com.nombre),
      parroquia: d.parroquia || "", ufa: "", faa: fecha(fechaPlan), dias: 0,
      paradas: tipo === "ESPECIAL" ? elegidas.map((s, i) => {
        const u = usr(s.usuario);
        return { orden: i + 1, solicitudId: s.id, usuario: s.usuario, nombre: u.nombre, direccion: u.dir || u.sector || "—", sector: u.sector || "—", motivo: s.problema?.motivo || null };
      }) : null,
      ...comunes,
    };
  }
  const asignadas = elegidas.map((s) => ({
    ...s, estado: "EN_AD", rutaId: ruta.id, ad,
    operador: op.nombre, unidad: unidad.placa, ayudante: ay.nombre, transportistaTipo: unidad.tipo, epsdc: unidad.epsdc || null,
    entrega: ruta.fechaJornada,
    historialAD: [...(s.historialAD || [])],
  }));
  const rutasNuevas = base ? rutas.map((r) => (r.id === base.id ? ruta : r)) : [ruta, ...rutas];
  const capacidad = Number(unidad.capacidad || 0);
  const kgAsignados = asignadas.reduce((a, s) => a + kgDeSolicitud(s), 0);
  return {
    ok: true, ruta, rutas: rutasNuevas, solicitudes: reemplazar(solicitudes, asignadas),
    aviso: capacidad && kgAsignados > capacidad
      ? `La carga (${Math.round(kgAsignados)} kg) supera la capacidad del vehículo (${capacidad} kg): harán falta ${Math.ceil(kgAsignados / capacidad)} viajes.`
      : null,
  };
}

/* ═══════════  3 · LA JORNADA POR MOMENTOS  ═══════════ */

/** Salida a recolección. Fija el precio del AD: el de este día. */
export function salidaAD({ solicitudes, abonos, rutas }, rutaId, meta = {}, seq) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (!["ASIGNADA", "REPROGRAMADA"].includes(estadoAD(ruta.estadoRuta).id)) {
    return { ok: false, error: `El AD ${ruta.ad} está "${estadoAD(ruta.estadoRuta).nombre}": sólo sale un AD planificado.` };
  }
  const disp = disponibilidadUnidad(unidadDistribucion(ruta.unidad), meta.fecha || HOY);
  if (!disp.disponible) return { ok: false, error: `El vehículo ${ruta.unidad} no puede salir: ${disp.motivos.join(" · ")}.` };
  const fechaSalida = meta.fecha || HOY;
  // El precio que manda es el del día de salida: quien quedó corto sale de la lista.
  const rep = repreciar({ solicitudes, abonos, rutas }, fechaSalida, seq, (s) => s.rutaId === ruta.id && s.estado === "EN_AD");
  const convocadas = rep.solicitudes.filter((s) => s.rutaId === ruta.id && s.estado === "EN_AD");
  if (!convocadas.length) return { ok: false, error: "El AD no tiene personas convocadas." };
  // La jornada es el día en que sale el camión: si sale en otra fecha, esa es la real y la
  // planificada queda guardada.
  const mismoDia = ruta.fechaJornada && new Date(ruta.fechaJornada).toDateString() === new Date(fechaSalida).toDateString();
  const rutaNueva = { ...ruta, estadoRuta: "EN_RUTA", fechaSalida, horaSalida: meta.hora || "07:00",
    ...(ruta.fechaJornada && !mismoDia ? { fechaJornada: fechaSalida, fechaJornadaPlan: ruta.fechaJornada } : {}),
    jornada: { ...(ruta.jornada || {}), marcas: { ...(ruta.jornada?.marcas || {}) } } };
  return { ok: true, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)),
    solicitudes: rep.solicitudes, abonos: rep.abonos, salieronPorTarifa: rep.cambiadas.filter((s) => s.estado === "POR_COMPLETAR").length };
}

/**
 * RECOLECCIÓN EN EL PUNTO. `marcas`: { [solicitudId]: { recogida: false, motivo, observacion } }.
 * Quien no aparece en `marcas` se recogió. Toda no recogida lleva un motivo de recolección.
 */
export function recoleccionAD({ solicitudes, rutas }, rutaId, marcas = {}, meta = {}, seq) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (estadoAD(ruta.estadoRuta).id !== "EN_RUTA") return { ok: false, error: "La recolección se registra con el AD en recolección." };
  const conv = convocadasDeAD(ruta, solicitudes);
  const marcasFinal = { ...(ruta.jornada?.marcas || {}) };
  for (const s of conv) {
    const mk = marcas[s.id] || {};
    if (mk.recogida === false) {
      const mot = motivoNoEntrega(mk.motivo);
      if (!mk.motivo || mot.momento !== "RECOLECCION") return { ok: false, error: `Falta el motivo de recolección de ${usr(s.usuario).nombre}.` };
      marcasFinal[s.id] = { recogida: false, motivo: mot.id, observacion: mk.observacion || null };
    } else {
      marcasFinal[s.id] = { recogida: true, observacion: mk.observacion || null };
    }
  }
  const recogidas = conv.filter((s) => marcasFinal[s.id]?.recogida !== false);
  const fechaMov = meta.fecha || HOY;
  const rutaNueva = { ...ruta, estadoRuta: "EN_PLANTA",
    jornada: { ...(ruta.jornada || {}), marcas: marcasFinal,
      recoleccion: { fecha: fechaMov, hora: meta.hora || "—", por: meta.por || "Distribución", recogidas: recogidas.length, noRecogidas: conv.length - recogidas.length } } };
  const mov = nuevoMovPlanta(seq, {
    fecha: fechaMov, hora: meta.hora || "—", tipo: "RECOLECCION", cdt: conv[0]?.cdt || CDTS[0].id,
    documento: `REC-${ruta.ad}`, contraparte: `AD ${ruta.ad} · ${ruta.comunidad || ruta.comuna || ""}`, ad: String(ruta.ad), rutaId: ruta.id,
    cilindros: cilindrosDe(recogidas), vehiculo: ruta.unidad || "—", operador: ruta.conductor || "—", cedula: ruta.conductorCedula || "—",
    nota: `${recogidas.length} bombonas recogidas de ${conv.length} convocadas`,
  });
  return { ok: true, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)), movPlanta: [mov], recogidas: recogidas.length };
}

/**
 * LLENADO EN PLANTA Y DEVOLUCIÓN AL PUNTO. `marcas`: { [solicitudId]: { llenada: false, motivo } }
 * sobre las recogidas. Todas las recogidas vuelven al punto: llenas, o vacías si no se llenaron.
 */
export function llenadoAD({ solicitudes, rutas }, rutaId, marcas = {}, meta = {}, seq) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (estadoAD(ruta.estadoRuta).id !== "EN_PLANTA") return { ok: false, error: "El llenado se registra con el AD en planta." };
  const conv = convocadasDeAD(ruta, solicitudes);
  const marcasFinal = { ...(ruta.jornada?.marcas || {}) };
  const recogidas = conv.filter((s) => marcasFinal[s.id]?.recogida !== false);
  for (const s of recogidas) {
    const mk = marcas[s.id] || {};
    if (mk.llenada === false) {
      const mot = motivoNoEntrega(mk.motivo);
      if (!mk.motivo || mot.momento !== "PLANTA") return { ok: false, error: `Falta el motivo de planta de ${usr(s.usuario).nombre}.` };
      marcasFinal[s.id] = { ...marcasFinal[s.id], llenada: false, motivo: mot.id, observacion: mk.observacion || marcasFinal[s.id]?.observacion || null };
    } else {
      marcasFinal[s.id] = { ...marcasFinal[s.id], llenada: true };
    }
  }
  const llenadas = recogidas.filter((s) => marcasFinal[s.id]?.llenada !== false);
  const fechaMov = meta.fecha || HOY;
  const kg = llenadas.reduce((a, s) => a + kgDeSolicitud(s), 0);
  const rutaNueva = { ...ruta, estadoRuta: "EN_PUNTO",
    jornada: { ...(ruta.jornada || {}), marcas: marcasFinal,
      llenado: { fecha: fechaMov, hora: meta.horaLlenado || meta.hora || "—", por: meta.por || "Distribución", llenadas: llenadas.length, noLlenadas: recogidas.length - llenadas.length, kg },
      devolucion: { fecha: fechaMov, hora: meta.horaDevolucion || meta.hora || "—", devueltas: recogidas.length } } };
  const comunes = { ad: String(ruta.ad), rutaId: ruta.id, cdt: conv[0]?.cdt || CDTS[0].id, vehiculo: ruta.unidad || "—", operador: ruta.conductor || "—", cedula: ruta.conductorCedula || "—" };
  const movs = [
    nuevoMovPlanta(seq, { ...comunes, fecha: fechaMov, hora: meta.horaLlenado || meta.hora || "—", tipo: "LLENADO",
      documento: `LLN-${ruta.ad}`, contraparte: `AD ${ruta.ad} · ${ruta.comunidad || ""}`, cilindros: cilindrosDe(llenadas), kg,
      nota: `${llenadas.length} llenadas · ${recogidas.length - llenadas.length} no admitieron llenado · por cerrar hasta el cierre del AD` }),
    nuevoMovPlanta(seq, { ...comunes, fecha: fechaMov, hora: meta.horaDevolucion || meta.hora || "—", tipo: "DEVOLUCION",
      documento: `DEV-${ruta.ad}`, contraparte: `Punto · ${ruta.comunidad || ruta.comuna || ""}`, cilindros: cilindrosDe(recogidas),
      nota: `${recogidas.length} bombonas devueltas al punto: ${llenadas.length} llenas y ${recogidas.length - llenadas.length} vacías` }),
  ];
  return { ok: true, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)), movPlanta: movs, llenadas: llenadas.length };
}

/**
 * INCIDENCIAS POR CLIENTE AL CERRAR · la última revisión antes de facturar.
 * `cambios`: { [solicitudId]: { resultado: "ENTREGADA" | motivoId, observacion } }.
 * Con el AD devuelto al punto, Distribución puede anotar o corregir lo que pasó con cada
 * persona (el reporte del conductor llega tarde, o se marcó mal en la calle). Lo físico se
 * rehace con la corrección: la recolección, el llenado y la devolución de esta AD cambian sus
 * cilindros y kilos, así el cierre, la planta y el inventario siguen cuadrando. Queda la traza.
 */
export function corregirJornadaAD({ solicitudes, rutas, movPlanta = null }, rutaId, cambios = {}, meta = {}) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (estadoAD(ruta.estadoRuta).id !== "EN_PUNTO") return { ok: false, error: "Las incidencias por cliente se corrigen con el AD devuelto al punto, antes de cerrarlo." };
  const conv = convocadasDeAD(ruta, solicitudes);
  const ids = new Set(conv.map((s) => s.id));
  const marcas = { ...(ruta.jornada?.marcas || {}) };
  const traza = [];
  for (const [id, c] of Object.entries(cambios)) {
    if (!ids.has(id)) return { ok: false, error: `${id} no está convocada en el AD ${ruta.ad}.` };
    const antes = marcas[id] || { recogida: true, llenada: true };
    const observacion = c.observacion != null ? (String(c.observacion).trim() || null) : (antes.observacion || null);
    let nueva;
    if (!c.resultado || c.resultado === "ENTREGADA") nueva = { recogida: true, llenada: true, observacion };
    else {
      const mot = MOTIVOS_NO_ENTREGA.find((m) => m.id === c.resultado);
      if (!mot) return { ok: false, error: `Motivo desconocido para ${usr(conv.find((s) => s.id === id).usuario).nombre}.` };
      nueva = mot.momento === "RECOLECCION"
        ? { recogida: false, motivo: mot.id, observacion }
        : { recogida: true, llenada: false, motivo: mot.id, observacion };
    }
    const igual = Boolean(antes.recogida !== false) === Boolean(nueva.recogida !== false)
      && Boolean(antes.llenada !== false) === Boolean(nueva.llenada !== false)
      && (antes.motivo || null) === (nueva.motivo || null) && (antes.observacion || null) === (nueva.observacion || null);
    if (igual) continue;
    marcas[id] = { ...nueva, corregidaAlCierre: true };
    traza.push({ solicitud: id, antes: resultadoMarca(antes), despues: resultadoMarca(nueva), observacion });
  }
  if (!traza.length) return { ok: true, sinCambios: true, ruta, rutas, movPlantaNuevo: movPlanta, cambios: 0 };

  const recogidas = conv.filter((s) => marcas[s.id]?.recogida !== false);
  const llenadas = recogidas.filter((s) => marcas[s.id]?.llenada !== false);
  const kg = llenadas.reduce((a, s) => a + kgDeSolicitud(s), 0);
  const j = ruta.jornada || {};
  const rutaNueva = { ...ruta, jornada: { ...j, marcas,
    recoleccion: { ...(j.recoleccion || {}), recogidas: recogidas.length, noRecogidas: conv.length - recogidas.length },
    llenado: { ...(j.llenado || {}), llenadas: llenadas.length, noLlenadas: recogidas.length - llenadas.length, kg },
    devolucion: { ...(j.devolucion || {}), devueltas: recogidas.length },
    correcciones: [...(j.correcciones || []), { fecha: meta.fecha || HOY, hora: meta.hora || "—", por: meta.por || "Distribución", cambios: traza }] } };
  // Los movimientos de planta de esta AD se rehacen con lo corregido: mismos documentos, otros cilindros.
  const corregido = " · corregido al cerrar el AD";
  const movPlantaNuevo = movPlanta && movPlanta.map((m) => {
    if (m.rutaId !== ruta.id && String(m.ad) !== String(ruta.ad)) return m;
    if (m.tipo === "RECOLECCION") return { ...m, cilindros: cilindrosDe(recogidas), nota: `${recogidas.length} bombonas recogidas de ${conv.length} convocadas${corregido}` };
    if (m.tipo === "LLENADO") return { ...m, cilindros: cilindrosDe(llenadas), kg,
      nota: `${llenadas.length} llenadas · ${recogidas.length - llenadas.length} no admitieron llenado · por cerrar hasta el cierre del AD${corregido}` };
    if (m.tipo === "DEVOLUCION") return { ...m, cilindros: cilindrosDe(recogidas),
      nota: `${recogidas.length} bombonas devueltas al punto: ${llenadas.length} llenas y ${recogidas.length - llenadas.length} vacías${corregido}` };
    return m;
  });
  return { ok: true, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)), movPlantaNuevo, cambios: traza.length };
}

/**
 * APP DEL OPERADOR · los clientes de una AD: quién pagó (se le recoge la bombona) y quién
 * pidió y no pagó o está por completar (no se le recoge). Sin montos: sólo el estado.
 */
export function clientesDeAD(ruta, solicitudes = []) {
  if (!ruta) return { convocadas: [], fuera: [] };
  const convocadas = convocadasDeAD(ruta, solicitudes);
  const comunas = new Set(convocadas.map((s) => s.comuna));
  const fuera = tipoAD(ruta) === "ESPECIAL" ? [] : solicitudes.filter((s) => cpt(s.concepto).bombona
    && ["SIN_PAGO", "POR_COMPLETAR"].includes(s.estado) && !s.ad
    && (s.rutaId === ruta.id || (!s.rutaId && s.modalidadEntrega === "COMUNA" && comunas.has(s.comuna))));
  return { convocadas, fuera };
}

/**
 * DESPACHADO · lo marca el operador en la app cuando las bombonas ya están en el punto.
 * Deja su reporte (cilindros planificados, recogidos, entregados llenos y devueltos vacíos);
 * no cierra el AD: el cierre, la factura y la salida de inventario los hace sólo Distribución.
 */
export function marcarDespachadoAD({ solicitudes, rutas }, rutaId, meta = {}) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (estadoAD(ruta.estadoRuta).id !== "EN_PUNTO") return { ok: false, error: "Se marca despachado con las bombonas ya devueltas al punto." };
  if (ruta.jornada?.despacho) return { ok: false, error: `El AD ${ruta.ad} ya fue marcado despachado.` };
  const conv = convocadasDeAD(ruta, solicitudes);
  const cil = (arr) => arr.reduce((a, s) => a + Number(s.cantidad || 1), 0);
  const recogidas = conv.filter((s) => marcaDe(ruta, s.id).recogida !== false);
  const llenas = recogidas.filter((s) => marcaDe(ruta, s.id).llenada !== false);
  const despacho = {
    fecha: meta.fecha || HOY, hora: meta.hora || "—", operador: meta.operador || ruta.conductor || "Operador",
    planificados: cil(conv), recogidos: cil(recogidas), entregados: cil(llenas), vacios: cil(recogidas) - cil(llenas),
    noRecogidos: cil(conv) - cil(recogidas), personas: conv.length, observacion: meta.observacion || null,
    personasRecogidas: recogidas.length, personasEntregadas: llenas.length,
  };
  const rutaNueva = { ...ruta, jornada: { ...(ruta.jornada || {}), despacho } };
  return { ok: true, despacho, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)) };
}

/* PLANTA MÓVIL · venta en sitio con cobro. Es otra cosa distinta del despacho de AD: aquí
   se llena y se cobra en el momento (efectivo, punto de venta, pago móvil o transferencia). */
export const METODOS_COBRO_PM = [
  { id: "EFECTIVO", nombre: "Efectivo", banco: false, desc: "Se cuenta en el cierre de caja" },
  { id: "PUNTO_VENTA", nombre: "Punto de venta", banco: true, desc: "Tarjeta de débito · número de aprobación" },
  { id: "PAGO_MOVIL", nombre: "Pago móvil", banco: true, desc: "Referencia y teléfono del pagador" },
  { id: "TRANSFERENCIA", nombre: "Transferencia", banco: true, desc: "Referencia bancaria" },
];
export const metodoCobroPM = (id) => METODOS_COBRO_PM.find((m) => m.id === id) || METODOS_COBRO_PM[0];

/**
 * Venta en planta móvil a un usuario CON código: nace entregada y facturada (se llenó en la
 * unidad), cuenta para su tope del ciclo y entra al libro de ventas y al inventario.
 */
export function ventaPlantaMovil({ solicitudes, manuales = [] }, d, seq) {
  const u = usr(d.usuario);
  const c = cpt(d.concepto);
  const cantidad = Number(d.cantidad || 1);
  if (!c.bombona || !(cantidad > 0)) return { ok: false, error: "Producto o cantidad no válidos." };
  const cupo = puedeSolicitar(u, solicitudes, d.concepto, cantidad);
  if (!cupo.ok) return { ok: false, error: cupo.motivo };
  const m = montos(d.concepto, cantidad, u.id, HOY);
  const cobro = validarCobroPM({ solicitudes, manuales }, d, m.total);
  if (!cobro.ok) return cobro;
  seq.sol += 1; seq.ped += 7; seq.bop += 1; seq.serie += 1;
  const id = `SOL-${seq.sol}`;
  const serie = `U-${String(seq.serie).padStart(8, "0")}`;
  const solicitud = {
    id, pedidoNro: seq.ped, usuario: u.id, cdt: d.cdt || u.cdt, comuna: u.comuna,
    concepto: d.concepto, cantidad, tipoDespacho: u.tipo === "Institución" ? "INSTITUCION" : "COMERCIAL", condicionVenta: "CONTADO",
    fecha: HOY, entrega: HOY, ventana: "Planta móvil", nota: "", jornadaComunal: null, modalidadEntrega: "PLANTA_MOVIL",
    canalVenta: "PLANTA_MOVIL", jornadaPM: d.jornada || null, estado: "CULMINADO", rutaId: null, ad: null,
    operador: d.operador || null, unidad: d.unidad || null, transportistaTipo: null, epsdc: null,
    boleta: `BOP-${String(seq.bop).padStart(4, "0")}`, factura: serie, serie, control: `01-${seq.ped}`,
    ...m, precioFacturado: m.precioUnitario, fechaPrecio: HOY, cubierto: m.total, saldoAplicado: 0, montoTransferido: cobro.pago.montoRecibido,
    origenRegistro: "PLANTA_MOVIL", horaEntrega: d.hora || null, historialAD: [],
    pago: { ...cobro.pago, fecha: HOY, estado: "VERIFICADO", auto: false, regla: "EXACTO", detalleRegla: "Cobrado en la planta móvil", resueltoEn: HOY },
  };
  return { ok: true, solicitud, total: m.total, vuelto: cobro.vuelto };
}

/** El cobro en sitio: efectivo con vuelto; lo electrónico, con su referencia y sin repetirla. */
export function validarCobroPM({ solicitudes = [], manuales = [] }, d, total) {
  const met = metodoCobroPM(d.metodo);
  const recibido = d.montoRecibido === "" || d.montoRecibido == null ? total : Number(d.montoRecibido);
  if (met.id === "EFECTIVO") {
    if (!(recibido >= total - 0.009)) return { ok: false, error: `En efectivo se reciben al menos Bs ${bs(total)}.` };
    return { ok: true, vuelto: r2(recibido - total), pago: { metodo: met.id, banco: "EFECTIVO", referencia: null, efectivo: true, canal: "PLANTA_MOVIL", montoRecibido: r2(recibido) } };
  }
  const referencia = String(d.referencia || "").trim();
  if (referencia.length < 4) return { ok: false, error: met.id === "PUNTO_VENTA" ? "Falta el número de aprobación del punto de venta." : "Falta la referencia del pago." };
  if (!d.banco) return { ok: false, error: "Falta el banco." };
  const usadas = referenciasEnUso(solicitudes);
  manuales.forEach((f) => f.pago?.referencia && usadas.add(f.pago.referencia));
  if (usadas.has(referencia)) return { ok: false, error: `La referencia ${referencia} ya respalda otro pago: no se acepta dos veces.` };
  return { ok: true, vuelto: 0, pago: { metodo: met.id, banco: d.banco, referencia, telefono: d.telefono || null, efectivo: false, canal: "PLANTA_MOVIL", montoRecibido: r2(total) } };
}

/** La caja de una jornada de planta móvil: lo cobrado por método, con y sin código. */
export function cajaPlantaMovil(jornadaId, solicitudes = [], manuales = []) {
  const ventas = [
    ...solicitudes.filter((s) => s.jornadaPM === jornadaId).map((s) => ({ id: s.id, serie: s.serie, usuario: s.usuario, conCodigo: true,
      concepto: s.concepto, cantidad: s.cantidad, total: s.total, pago: s.pago, hora: s.horaEntrega })),
    ...manuales.filter((f) => f.jornadaPlantaMovil === jornadaId).map((f) => ({ id: f.id, serie: f.serie, usuario: f.usuario, conCodigo: false,
      comprador: f.compradorNombre, concepto: f.concepto, cantidad: f.cantidad, total: f.total, pago: f.pago, hora: f.hora })),
  ];
  const porMetodo = Object.fromEntries(METODOS_COBRO_PM.map((m) => [m.id, 0]));
  ventas.forEach((v) => { const k = v.pago?.metodo || (v.pago?.efectivo ? "EFECTIVO" : "TRANSFERENCIA"); porMetodo[k] = r2((porMetodo[k] || 0) + Number(v.total || 0)); });
  return { ventas, porMetodo, total: r2(ventas.reduce((a, v) => a + Number(v.total || 0), 0)),
    cilindros: ventas.reduce((a, v) => a + Number(v.cantidad || 0), 0), conCodigo: ventas.filter((v) => v.conCodigo).length };
}

/** Lo que pasó con una persona, en una línea: para la traza de las correcciones. */
function resultadoMarca(mk = {}) {
  if (mk.recogida === false) return `No recogida · ${motivoNoEntrega(mk.motivo).nombre}`;
  if (mk.llenada === false) return `Vuelve vacía · ${motivoNoEntrega(mk.motivo).nombre}`;
  return "Devuelta llena";
}

/**
 * CIERRE DEL AD · el punto donde ocurre la venta y termina la responsabilidad de la empresa.
 *   Devuelta llena → factura al precio del día de salida + BOP + salida de inventario.
 *   No recogida / no llenada → según el motivo: REPLANIFICAR (bandeja de Distribución,
 *     el pedido sigue vivo) o ABONO (el usuario desistió: dinero al saldo a favor).
 */
export function cerrarADPuro({ solicitudes, abonos, parque = [], rutas }, rutaId, meta = {}, seq) {
  const ruta = rutas.find((r) => r.id === rutaId);
  if (!ruta) return { ok: false, error: "AD no encontrada." };
  if (estadoAD(ruta.estadoRuta).id !== "EN_PUNTO") {
    return { ok: false, error: `Sólo se cierra un AD devuelto al punto. El AD ${ruta.ad} está "${estadoAD(ruta.estadoRuta).nombre}".` };
  }
  const conv = convocadasDeAD(ruta, solicitudes);
  if (!conv.length) return { ok: false, error: "No hay personas convocadas en este AD." };
  const fechaCierre = meta.fecha || HOY;
  const nuevosAbonos = [];
  const envasesNoAptos = [];
  const res = { convocadas: conv.length, kgConvocado: conv.reduce((a, s) => a + kgDeSolicitud(s), 0), recogidas: 0, noRecogidas: 0, llenadas: 0, noLlenadas: 0,
    entregadas: 0, replanificadas: 0, abonadas: 0, facturas: 0, facturado: 0, abonado: 0, kgSalida: 0, porMotivo: {} };

  const actualizadas = conv.map((s) => {
    const mk = marcaDe(ruta, s.id);
    const recogida = mk.recogida !== false;
    const llenada = recogida && mk.llenada !== false;
    if (recogida) res.recogidas += 1; else res.noRecogidas += 1;
    const hist = [...(s.historialAD || []), { rutaId: ruta.id, ad: String(ruta.ad), fecha: fechaCierre,
      resultado: llenada ? "ENTREGADA" : (recogida ? "NO_LLENADA" : "NO_RECOGIDA"), motivo: mk.motivo || null }];

    if (llenada) {
      res.llenadas += 1; res.entregadas += 1;
      const td = tpd(s.tipoDespacho);
      seq.bop += 1;
      const bopId = `BOP-${String(seq.bop).padStart(4, "0")}`;
      let serie = null, control = null;
      if (td.factura) {
        seq.serie += 1;
        serie = `U-${String(seq.serie).padStart(8, "0")}`;
        control = `01-${s.pedidoNro}`;
      }
      res.kgSalida += kgDeSolicitud(s);
      // Distribución ve cuántas facturas se emiten; el monto sólo lo ve Comercialización.
      if (td.factura) res.facturas += 1;
      res.facturado += td.factura ? Number(s.total || 0) : 0;
      return {
        ...s, estado: "CULMINADO", boleta: bopId, serie, control, factura: serie, entrega: fechaCierre,
        precioFacturado: s.precioUnitario, fechaPrecio: ruta.fechaSalida || fechaCierre,
        receptor: meta.receptor || null, horaEntrega: meta.hora || null, obsEntrega: mk.observacion || null,
        historialAD: hist,
      };
    }
    if (recogida) res.noLlenadas += 1;
    const mot = motivoNoEntrega(mk.motivo);
    res.porMotivo[mot.id] = (res.porMotivo[mot.id] || 0) + 1;
    if (mot.envaseNoApto) envasesNoAptos.push({ usuario: s.usuario, kg: cpt(s.concepto).kg, motivo: mot.nombre });

    if (mot.consecuencia === "ABONO") {
      res.abonadas += 1;
      const monto = dineroAplicadoDe(s);
      res.abonado += monto;
      if (monto > 0.009) {
        nuevosAbonos.push(nuevoAbono(seq, s.usuario, "ABONO_NO_COMPRA", monto, String(ruta.ad),
          `${mot.nombre}${mk.observacion ? ` · ${mk.observacion}` : ""}`, { ad: String(ruta.ad), solicitud: s.id, cdt: s.cdt }, fechaCierre));
      }
      return { ...s, estado: ESTADO_ABONADA, motivoNoCompra: mot.nombre, motivoId: mot.id, fechaAbono: fechaCierre,
        abonadoBs: monto, obsEntrega: mk.observacion || null, rutaId: null, ad: null, historialAD: hist };
    }
    res.replanificadas += 1;
    return {
      ...s, estado: "POR_REPLANIFICAR", rutaId: null, ad: null, operador: null, unidad: null, ayudante: null,
      problema: { motivo: mot.id, nombre: mot.nombre, momento: mot.momento, imputable: mot.imputable, prioridad: Boolean(mot.prioridad),
        adOrigen: String(ruta.ad), rutaOrigen: ruta.id, fecha: fechaCierre, plazo: finDeCiclo(fechaCierre), nota: mk.observacion || null },
      requiereVerificacionPadron: Boolean(mot.marcaPadron) || s.requiereVerificacionPadron,
      historialAD: hist,
    };
  });

  const parqueNuevo = envasesNoAptos.length
    ? parque.map((e) => {
        const x = envasesNoAptos.find((n) => n.usuario === e.usuario && n.kg === e.kg);
        return x ? { ...e, estado: "NO_APTO", motivo: x.motivo, desde: fechaCierre } : e;
      })
    : parque;

  res.facturado = r2(res.facturado); res.abonado = r2(res.abonado);
  const rutaNueva = { ...ruta, estadoRuta: "CERRADA", cerradaEn: fechaCierre, horaCierre: meta.hora || null,
    cierreDetalle: { ...res, devueltas: res.recogidas, kgLlenado: res.kgSalida, cuadra: res.recogidas === res.llenadas + res.noLlenadas },
    recepcion: { receptor: meta.receptor || null, cedula: meta.cedula || null, hora: meta.hora || null, firma: meta.firma || null, cerradaPor: meta.por || "Gerencia de Distribución" } };
  return { ok: true, ruta: rutaNueva, rutas: rutas.map((r) => (r.id === ruta.id ? rutaNueva : r)),
    solicitudes: reemplazar(solicitudes, actualizadas), abonos: nuevosAbonos, parque: parqueNuevo, resumen: res };
}

/* ═══════════  4 · LA BANDEJA · ABONO COMO ÚLTIMO RECURSO  ═══════════ */

/** Distribución decide no replanificar: el dinero pasa al saldo a favor. */
export function abonarPedido({ solicitudes }, solicitudId, d = {}, seq) {
  const s = solicitudes.find((x) => x.id === solicitudId);
  if (!s) return { ok: false, error: "Solicitud no encontrada." };
  if (!["POR_REPLANIFICAR", "POR_COMPLETAR"].includes(s.estado)) return { ok: false, error: "Sólo se abona un pedido por replanificar o por completar." };
  const nota = String(d.nota || "").trim();
  if (!nota && !d.automatico) return { ok: false, error: "Indique por qué no se replanifica: queda en la bitácora." };
  const monto = dineroAplicadoDe(s);
  const fechaAbono = d.fecha || HOY;
  const motivo = d.motivo || (s.estado === "POR_COMPLETAR" ? "No completó el pago antes del cierre del ciclo" : "Distribución decidió no replanificar");
  const ab = monto > 0.009 ? [nuevoAbono(seq, s.usuario, "ABONO_NO_COMPRA", monto, s.id, `${motivo}${nota ? ` · ${nota}` : ""}`,
    { solicitud: s.id, cdt: s.cdt, registradoPor: d.por || "Distribución" }, fechaAbono)] : [];
  const actualizada = { ...s, estado: ESTADO_ABONADA, motivoNoCompra: motivo, fechaAbono, abonadoBs: monto,
    decisionAbono: { por: d.por || "Distribución", en: fechaAbono, nota: nota || null, automatico: Boolean(d.automatico) } };
  return { ok: true, solicitudes: reemplazar(solicitudes, [actualizada]), abonos: ab, monto };
}

/** Cierre del ciclo: lo que no se replanificó ni se completó pasa al saldo a favor. */
export function vencerPlazos({ solicitudes }, corte = HOY, seq, por = "Cierre del ciclo") {
  let estado = { solicitudes };
  const abonos = [];
  const vencidas = solicitudes.filter((s) => ["POR_REPLANIFICAR", "POR_COMPLETAR"].includes(s.estado));
  vencidas.forEach((s) => {
    const r = abonarPedido(estado, s.id, { automatico: true, fecha: corte, por,
      motivo: s.estado === "POR_COMPLETAR" ? "No completó el pago antes del cierre del ciclo" : "Venció el plazo sin replanificar" }, seq);
    if (r.ok) { estado = { solicitudes: r.solicitudes }; abonos.push(...r.abonos); }
  });
  return { solicitudes: estado.solicitudes, abonos, vencidas: vencidas.length, monto: r2(abonos.reduce((a, x) => a + x.monto, 0)) };
}

/* ═══════════  CIFRAS · UNA SOLA FUENTE  ═══════════
   Cada dato del sistema se calcula aquí una vez. Panel, Saldos, Cierre, Centro de gestión,
   Distribución, portada y portal leen de esta función: por eso cuadran entre sí. */
export function cifrasSistema({ solicitudes = [], abonos = [], facturas = [], rutas = [], movPlanta = [], existencias = {}, compromisos = {}, disponibles = {} }) {
  const suma = (arr, f) => r2(arr.reduce((a, x) => a + Number(f(x) || 0), 0));
  const pendientesGlp = pagadasPendientesDe(solicitudes);
  const pendientesDinero = pendientesGlp.filter((s) => tpd(s.tipoDespacho).requierePago);
  const servicios = solicitudes.filter((s) => !cpt(s.concepto).inv && s.estado === "PAGADA");
  const porCompletar = solicitudes.filter((s) => s.estado === "POR_COMPLETAR");
  const replan = solicitudes.filter((s) => s.estado === "POR_REPLANIFICAR");
  const saldos = saldosDe(abonos);
  const conSaldo = Object.entries(saldos).filter(([, v]) => v > 0.009);
  const factPeriodo = facturas.filter((f) => esFechaPeriodo(f.fecha));
  const porEstado = solicitudes.reduce((acc, s) => { acc[s.estado] = (acc[s.estado] || 0) + 1; return acc; }, {});
  const planificadas = rutas.filter(adPlanificada);
  const porEstadoAD = planificadas.reduce((acc, r) => { const e = estadoAD(r.estadoRuta).id; acc[e] = (acc[e] || 0) + 1; return acc; }, {});
  const cerradas = planificadas.filter(adCerrada);
  const activas = planificadas.filter((r) => !adCerrada(r));
  const convocadas = solicitudes.filter((s) => s.estado === "EN_AD");
  const grupos = gruposPorPlanificar(solicitudes, rutas);
  const entregadasAD = solicitudes.filter((s) => s.estado === "CULMINADO" && (s.historialAD || []).some((h) => h.resultado === "ENTREGADA"));
  const llenadoPorCerrar = (() => {
    const cerr = new Set(cerradas.map((r) => String(r.ad)));
    return suma(movPlanta.filter((m) => m.tipo === "LLENADO" && !cerr.has(String(m.ad))), (m) => m.kg);
  })();
  const fisico = suma(Object.values(existencias), (v) => v);
  const comprometido = suma(Object.values(compromisos), (v) => v);
  const disponible = suma(Object.values(disponibles), (v) => v);
  const dinero = {
    pendienteDespacho: { n: pendientesDinero.length, bs: suma(pendientesDinero, dineroAplicadoDe), kg: suma(pendientesDinero, kgDeSolicitud) },
    serviciosPorPrestar: { n: servicios.length, bs: suma(servicios, dineroAplicadoDe) },
    porCompletar: { n: porCompletar.length, recibido: suma(porCompletar, dineroAplicadoDe), faltante: suma(porCompletar, faltanteDe) },
    saldoFavor: { usuarios: conSaldo.length, bs: r2(conSaldo.reduce((a, [, v]) => a + v, 0)) },
    facturadoPeriodo: { docs: factPeriodo.length, base: suma(factPeriodo, (f) => f.base), iva: suma(factPeriodo, (f) => f.iva), total: suma(factPeriodo, (f) => f.total) },
  };
  dinero.enPoderDeLaEmpresa = r2(dinero.pendienteDespacho.bs + dinero.serviciosPorPrestar.bs + dinero.porCompletar.recibido + dinero.saldoFavor.bs);
  return {
    dinero,
    glp: { fisico, comprometido, disponible, llenadoPorCerrar, pendientesGlp: pendientesGlp.length, kgPendiente: suma(pendientesGlp, kgDeSolicitud) },
    solicitudes: { total: solicitudes.length, porEstado, porReplanificar: replan.length, porCompletar: porCompletar.length },
    ad: {
      porPlanificar: grupos.length, personasPorPlanificar: grupos.reduce((a, g) => a + g.personas, 0),
      planificadas: planificadas.length, activas: activas.length, cerradas: cerradas.length,
      enJornada: activas.filter(adEnJornada).length, porEstado: porEstadoAD,
      especiales: planificadas.filter((r) => tipoAD(r) === "ESPECIAL").length,
      convocadas: convocadas.length, cilindrosConvocados: convocadas.reduce((a, s) => a + Number(s.cantidad || 1), 0),
      kgConvocado: suma(convocadas, kgDeSolicitud),
      entregadas: entregadasAD.length,
    },
    replanificacion: { n: replan.length, bs: suma(replan, dineroAplicadoDe), prioridad: replan.filter((s) => s.problema?.imputable === "EMPRESA" || s.problema?.prioridad).length },
  };
}

/* ═══════════  VISTAS DERIVADAS  ═══════════ */

/**
 * Los pedidos de bombona tal como los ve Distribución, construidos desde las solicitudes
 * vivas. Lo que entra por el portal o por taquilla aparece aquí en el mismo instante.
 */
export function pedidosDistribucion(solicitudes = [], rutas = []) {
  const porRuta = new Map(rutas.map((r) => [r.id, r]));
  return solicitudes.filter((s) => cpt(s.concepto).bombona && !esCodigoGenerico(s.usuario)).map((s) => {
    const r = s.rutaId ? porRuta.get(s.rutaId) : null;
    const u = usr(s.usuario);
    const com = comunaOf(s.comuna);
    const c = cpt(s.concepto);
    const est = estadoSolicitud(s.estado);
    const f = s.fecha instanceof Date ? s.fecha : new Date(s.fecha);
    return {
      id: s.id, pedidoId: s.id, solicitudId: s.id, usuario: s.usuario,
      fechaPedido: fecha(f), fechaPago: s.pago?.fecha || null, horaPedido: s.horaPedido || "—",
      nombre: u.nombre, cedula: u.doc,
      // En una AD especial la persona sigue siendo de su comuna: la ruta es por domicilio.
      comuna: (r && tipoAD(r) !== "ESPECIAL" ? r.comuna : null) || com.nombre.toUpperCase(), comunaId: s.comuna,
      comunidad: s.comunidad || (r && tipoAD(r) !== "ESPECIAL" ? r.comunidad : null) || com.punto || u.sector || com.nombre,
      parroquia: s.parroquia || r?.parroquia || "",
      rutaId: s.rutaId || null, cantidad: Number(s.cantidad || 1), kg: c.kg, totalKg: kgDeSolicitud(s),
      segmento: segmentoUsuario(u), tipoDespacho: s.tipoDespacho, modalidadEntrega: s.modalidadEntrega,
      estado: s.estado, estadoNombre: est.admin,
      pagado: esPendienteDespacho(s) || s.estado === "CULMINADO",
      estadoPago: s.estado === "POR_COMPLETAR" ? "POR COMPLETAR" : s.pago?.estado === "RECHAZADO" ? "PAGO RECHAZADO"
        : s.pago?.estado === "NO_APLICA" ? "NO REQUIERE PAGO" : esPendienteDespacho(s) || s.estado === "CULMINADO" ? "PAGO VERIFICADO" : "SIN PAGO",
      faltante: faltanteDe(s), incluidoAD: s.estado === "EN_AD", ad: s.ad || null,
      estadoAD: s.estado === "EN_AD" ? "EN_AD" : "SIN_AD", estadoRuta: r?.estadoRuta || null,
      unidad: s.estado === "EN_AD" ? (r?.unidad || s.unidad || null) : null,
      operadorId: s.estado === "EN_AD" ? (r?.operadorId || null) : null,
      conductor: s.estado === "EN_AD" ? (r?.conductor || s.operador || null) : null,
      problema: s.problema || null,
    };
  });
}

/** Lo que el ciudadano necesita saber de su pedido, en su idioma. */
export function momentoCiudadano(s, rutas = []) {
  const est = estadoSolicitud(s.estado);
  const r = s.rutaId ? rutas.find((x) => x.id === s.rutaId) : null;
  const base = { peldano: est.peldano, titulo: est.cliente, detalle: est.clienteDesc, tono: est.tono, lateral: null, ad: r?.ad || s.ad || null };
  // Los servicios y el granel no pasan por el punto comunal.
  if (s.estado === "CULMINADO" && !cpt(s.concepto).bombona) {
    return { ...base, titulo: cpt(s.concepto).inv ? "Despachado" : "Servicio prestado",
      detalle: `${cpt(s.concepto).inv ? "Tu despacho se entregó" : "El servicio se prestó"} y ya tienes tu factura.` };
  }
  if (s.estado === "POR_COMPLETAR") {
    return { ...base, lateral: "POR_COMPLETAR", titulo: "Falta completar tu pago",
      detalle: s.tarifaPendiente
        ? `La tarifa cambió. Tu pago quedó aplicado; faltan Bs ${bs(faltanteDe(s))} para entrar a la jornada.`
        : `${s.pago?.detalleRegla || "Llegó menos de lo que cuesta el pedido."} Transfiere Bs ${bs(faltanteDe(s))} y entras a la próxima jornada.` };
  }
  if (s.estado === "POR_REPLANIFICAR") {
    const p = s.problema || {};
    return { ...base, lateral: "POR_REPLANIFICAR", titulo: "Tu pedido se reprograma",
      detalle: `${p.nombre || "Hubo un problema en la jornada"}${p.adOrigen ? ` (AD ${p.adOrigen})` : ""}. Tu pedido sigue vivo: Distribución te asigna una ruta especial antes del ${fecha(p.plazo)}.` };
  }
  if (s.estado === "ABONADA") {
    return { ...base, lateral: "ABONADA", titulo: "Cerrado · tu dinero quedó a tu favor",
      detalle: `${s.motivoNoCompra || "Sin despacho"}. Bs ${bs(s.abonadoBs || 0)} se descuentan solos en tu próximo pedido.` };
  }
  if (s.estado === "SIN_PAGO" && s.pago?.estado === "RECHAZADO") {
    return { ...base, lateral: "RECHAZADO", titulo: "Pago rechazado", detalle: s.pago?.detalleRegla || "La referencia no se pudo validar." };
  }
  if (s.estado === "EN_AD" && r) {
    const mk = marcaDe(r, s.id);
    const e = estadoAD(r.estadoRuta).id;
    const esp = tipoAD(r) === "ESPECIAL";
    const lugar = esp ? "tu domicilio" : "el punto comunal";
    const llevar = esp ? "Ten lista tu bombona vacía en tu domicilio" : "Lleva tu bombona vacía al punto comunal";
    const textos = {
      ASIGNADA: [`Jornada planificada · AD ${r.ad}`, `${llevar} el ${fecha(r.fechaJornada || r.fechaPlan || s.entrega)}.`],
      REPROGRAMADA: [`Jornada reprogramada · AD ${r.ad}`, "Te avisamos la nueva fecha."],
      EN_RUTA: [`Recolección en curso · AD ${r.ad}`, `La unidad ${r.unidad} está recogiendo las bombonas en ${lugar}.`],
      EN_PLANTA: mk.recogida === false
        ? ["Tu bombona no se recogió", `${motivoNoEntrega(mk.motivo).nombre}. Distribución te reprograma al cerrar el AD.`]
        : ["Tu bombona está en planta", "Se está llenando. Vuelve al mismo punto."],
      EN_PUNTO: mk.recogida === false || mk.llenada === false
        ? ["Tu bombona no se pudo atender", `${motivoNoEntrega(mk.motivo).nombre}. Se reprograma al cerrar el AD.`]
        : ["Tu bombona volvió llena al punto", `Ya puedes retirarla en ${lugar}. La factura sale al cerrar el AD.`],
      INCIDENCIA: [`AD ${r.ad} con incidencia`, "La jornada tuvo un problema; Distribución te informa la nueva fecha."],
    };
    const t = textos[e];
    if (t) return { ...base, titulo: t[0], detalle: t[1], momentoAD: e };
  }
  return base;
}

/**
 * FICHA 360° de un usuario, con los datos reales del sistema. La usan Comercialización
 * (con importes) y Distribución (sin importes: `modo: "distribucion"`), con la misma
 * trazabilidad: solicitud → pago → AD → recolección → llenado → devolución → factura.
 */
export function fichaUsuario360(usuarioId, { solicitudes = [], facturas = [], abonos = [], rutas = [], reclamos = [] }, { modo = "comercializacion", onOpenFactura } = {}) {
  const u = usr(usuarioId);
  const conImportes = modo === "comercializacion";
  const porRuta = new Map(rutas.map((r) => [r.id, r]));
  const ss = solicitudes.filter((s) => s.usuario === usuarioId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const fs = facturas.filter((f) => f.usuario === usuarioId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const nombreBanco = (id) => (id ? (BANCOS.find((b) => b.id === id)?.nombre || id) : "No aplica");
  const perfil = {
    id: u.id, nombre: u.nombre, doc: u.doc, contrato: u.contrato, tipo: u.tipoContrato, uso: segmentoUsuario(u),
    comuna: comunaOf(u.comuna).nombre, comunidad: u.sector, cdt: cdtOf(u.cdt).nombre, direccion: u.dir, tel: u.tel, correo: u.correo, desde: u.desde,
  };
  const solRows = ss.map((s) => ({ id: s.id, fecha: s.fecha, concepto: cpt(s.concepto).nombre, cantidad: s.cantidad,
    kg: kgDeSolicitud(s), litros: kgALitros(kgDeSolicitud(s)), ad: s.ad || (s.historialAD || []).slice(-1)[0]?.ad || null,
    estado: estadoSolicitud(s.estado).admin }));
  /* Una fila por cada dinero que entró al pedido: la transferencia, el saldo a favor que se
     descontó y cada complemento. Así la suma de las filas es lo que el usuario puso, sin
     contar dos veces. En Distribución no viajan importes. */
  const pagos = ss.filter((s) => s.pago && (s.pago.referencia || s.pago.estado === "NO_APLICA" || Number(s.saldoAplicado) > 0)).flatMap((s) => {
    const estado = { VERIFICADO: "PAGO VERIFICADO", INCOMPLETO: "PAGO INCOMPLETO", RECHAZADO: "RECHAZADO", NO_APLICA: "NO REQUIERE PAGO", SIN_PAGO: "SIN PAGO" }[s.pago.estado] || s.pago.estado;
    const recibido = ["VERIFICADO", "INCOMPLETO"].includes(s.pago.estado) ? Number(s.pago.montoRecibido || 0) : 0;
    const filas = [];
    if (s.pago.referencia || s.pago.estado === "NO_APLICA") {
      filas.push({ solicitud: s.id, banco: nombreBanco(s.pago.banco), operacion: s.pago.referencia || "—", fecha: s.pago.fecha || s.fecha,
        base: 0, iva: 0, total: conImportes ? recibido : 0, estado,
        validacion: s.pago.regla ? `Regla automática · ${reglaPago(s.pago.regla).nombre}` : s.origenRegistro === "TAQUILLA" ? "Registro en taquilla" : "No aplica" });
    }
    if (Number(s.saldoAplicado) > 0) {
      filas.push({ solicitud: s.id, banco: "Saldo a favor", operacion: "—", fecha: s.fecha, base: 0, iva: 0,
        total: conImportes ? Number(s.saldoAplicado) : 0, estado: "SALDO APLICADO", validacion: "Descontado automáticamente" });
    }
    (s.pago.complementos || []).forEach((c) => filas.push({ solicitud: s.id, banco: nombreBanco(c.banco), operacion: c.referencia || "—", fecha: c.fecha,
      base: 0, iva: 0, total: conImportes ? Number(c.monto || 0) : 0, estado: "COMPLEMENTO VERIFICADO", validacion: "Completó el pago" }));
    return filas;
  }).sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  const RESULTADO = { ENTREGADA: "Devuelta llena al punto", NO_RECOGIDA: "No se recogió", NO_LLENADA: "Volvió vacía", SALIO_POR_TARIFA: "Salió por tarifa nueva" };
  const despachos = ss.flatMap((s) => {
    const kg = kgDeSolicitud(s);
    const filas = (s.historialAD || []).map((h) => {
      const r = porRuta.get(h.rutaId) || {};
      return { ad: h.ad, fecha: h.fecha, comuna: r.comuna || comunaOf(s.comuna).nombre, comunidad: r.comunidad || u.sector,
        placa: r.unidad || "—", operador: r.conductor || "—", operadorCedula: r.conductorCedula || "—",
        bop: h.resultado === "ENTREGADA" ? (s.boleta || "—") : "—", kg, litros: kgALitros(kg),
        estado: `${RESULTADO[h.resultado] || h.resultado}${h.motivo ? ` · ${motivoNoEntrega(h.motivo).nombre}` : ""}` };
    });
    if (s.estado === "EN_AD" && s.rutaId) {
      const r = porRuta.get(s.rutaId) || {};
      filas.unshift({ ad: s.ad, fecha: r.fechaJornada || r.fechaPlan || s.fecha, comuna: r.comuna || comunaOf(s.comuna).nombre, comunidad: r.comunidad || u.sector,
        placa: r.unidad || "—", operador: r.conductor || "—", operadorCedula: r.conductorCedula || "—", bop: "—", kg, litros: kgALitros(kg),
        estado: estadoAD(r.estadoRuta).nombre });
    }
    if (!filas.length && s.estado === "CULMINADO" && s.ad) {
      filas.push({ ad: s.ad, fecha: s.entrega || s.fecha, comuna: comunaOf(s.comuna).nombre, comunidad: u.sector, placa: String(s.unidad || "—").replace(/^Placa\s+/i, ""),
        operador: s.operador || "—", operadorCedula: "—", bop: s.boleta || "—", kg, litros: kgALitros(kg), estado: "Entregada" });
    }
    return filas;
  });
  const factRows = fs.map((f) => ({ serie: f.serie, control: f.control, fecha: f.fecha, concepto: cpt(f.concepto).nombre, ad: f.ad,
    base: f.base, iva: f.iva, total: f.total, onOpen: onOpenFactura ? () => onOpenFactura(f) : undefined }));
  const auditoria = [];
  const ev = (fechaEv, hora, evento, origen, referencia, detalle) => fechaEv && auditoria.push({ fecha: fechaEv, hora: hora || "—", evento, origen, referencia, detalle });
  ss.forEach((s) => {
    ev(s.fecha, s.horaPedido, "Solicitud registrada", s.origenRegistro === "TAQUILLA" ? "Taquilla" : "Portal / comuna", s.id, `${cpt(s.concepto).nombre} · ${s.cantidad} unidad(es)`);
    if (s.pago?.regla) ev(s.pago.resueltoEn || s.fecha, null, `Pago resuelto · ${reglaPago(s.pago.regla).nombre}`, "API bancaria", s.pago.referencia,
      conImportes ? (s.pago.detalleRegla || "") : reglaPago(s.pago.regla).efecto);
    if (Number(s.saldoAplicado) > 0 && conImportes) ev(s.fecha, null, "Saldo a favor aplicado", "Sistema", s.id, `Bs ${bs(s.saldoAplicado)}`);
    (s.historialAD || []).forEach((h) => {
      const r = porRuta.get(h.rutaId) || {};
      if (r.fechaPlan) ev(r.fechaPlan, null, `Convocada en AD ${h.ad}`, "Distribución", h.ad, `${tipoADInfo(r).nombre} · ${r.comunidad || ""}`);
      if (r.jornada?.recoleccion) ev(r.jornada.recoleccion.fecha, r.jornada.recoleccion.hora, "Recolección en el punto", "Distribución", h.ad, h.resultado === "NO_RECOGIDA" ? motivoNoEntrega(h.motivo).nombre : "Bombona recogida");
      if (r.jornada?.llenado && h.resultado !== "NO_RECOGIDA") ev(r.jornada.llenado.fecha, r.jornada.llenado.hora, "Llenado en planta", "Planta", h.ad, h.resultado === "NO_LLENADA" ? motivoNoEntrega(h.motivo).nombre : "Llenada");
      ev(h.fecha, r.horaCierre, `AD ${h.ad} cerrada`, "Distribución", h.ad, RESULTADO[h.resultado] || h.resultado);
    });
    if (s.estado === "EN_AD" && s.rutaId) {
      const r = porRuta.get(s.rutaId) || {};
      if (r.fechaPlan) ev(r.fechaPlan, null, `Convocada en AD ${s.ad}`, "Distribución", s.ad, `${tipoADInfo(r).nombre} · ${r.comunidad || ""}`);
      if (r.jornada?.recoleccion) ev(r.jornada.recoleccion.fecha, r.jornada.recoleccion.hora, "Recolección en el punto", "Distribución", s.ad, marcaDe(r, s.id).recogida === false ? motivoNoEntrega(marcaDe(r, s.id).motivo).nombre : "Bombona recogida");
    }
    if (s.boleta) ev(s.entrega || s.fecha, null, "BOP · salida de inventario", s.servicio ? "O.A.U." : "Distribución", s.boleta, s.ad ? `AD ${s.ad}` : "Servicio culminado");
    if (s.factura && conImportes) ev(s.entrega || s.fecha, null, "Factura emitida", "Comercialización", s.factura, `Bs ${bs(s.total)}`);
    if (s.problema) ev(s.problema.fecha, null, "Pasó a replanificación", "Distribución", s.problema.adOrigen, `${s.problema.nombre} · plazo ${fecha(s.problema.plazo)}`);
    if (s.estado === "ABONADA") ev(s.fechaAbono || s.fecha, null, "Cerrada con saldo a favor", s.decisionAbono?.automatico ? "Sistema" : "Comercialización / Distribución", s.id, s.motivoNoCompra || "");
  });
  if (conImportes) abonos.filter((a) => a.usuario === usuarioId && a.tipo !== "CONSUMO").forEach((a) => ev(a.fecha, null, "Saldo a favor", "Comercialización", a.id, `${a.detalle} · Bs ${bs(a.monto)}`));
  reclamos.filter((r) => r.usuario === usuarioId).forEach((r) => ev(r.fecha, null, `Reclamo ${r.estado === "RESUELTO" ? "resuelto" : "recibido"}`, "Atención al usuario", r.id, r.asunto));
  auditoria.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  // La línea de tiempo del pedido más reciente que pasó por un AD.
  const ultimo = ss.find((s) => s.rutaId || (s.historialAD || []).length) || ss[0];
  const ciclo = ultimo ? auditoria.filter((a) => a.referencia === ultimo.id || a.referencia === ultimo.ad || a.referencia === ultimo.boleta || a.referencia === ultimo.factura
    || (ultimo.historialAD || []).some((h) => h.ad === a.referencia) || a.referencia === ultimo.pago?.referencia).slice().reverse() : [];
  return { perfil, solicitudes: solRows, pagos, despachos, facturas: conImportes ? factRows : [], auditoria, ciclo };
}

/** Registro de lo que realmente ocurrió, para la auditoría del Centro de gestión. */
export function bitacoraEventos({ solicitudes = [], abonos = [], rutas = [], reclamos = [] }, limite = 5000) {
  const ev = [];
  const push = (fechaEv, hora, modulo, evento, referencia, detalle) => { if (fechaEv) ev.push({ fecha: fechaEv, hora: hora || "—", modulo, evento, referencia, detalle }); };
  solicitudes.forEach((s) => {
    if (s.pago?.regla && s.pago.regla !== "EXACTO") push(s.pago.resueltoEn || s.fecha, null, "Comercialización", `Regla de pago · ${reglaPago(s.pago.regla).nombre}`, s.id, s.pago.detalleRegla);
    if (s.origenRegistro === "TAQUILLA") push(s.fecha, null, "Comercialización", "Solicitud registrada en taquilla", s.id, s.registro?.motivo || "");
    if (s.problema) push(s.problema.fecha, null, "Distribución", "Pedido a replanificación", s.id, `${s.problema.nombre} · AD ${s.problema.adOrigen}`);
    if (s.decisionAbono) push(s.decisionAbono.en, null, s.decisionAbono.automatico ? "Sistema" : "Distribución", "Pedido abonado", s.id, s.motivoNoCompra);
    if (s.servicio) push(s.servicio.en, null, "Comercialización", "Servicio culminado", s.id, s.servicio.atendio);
  });
  rutas.forEach((r) => {
    if (!adPlanificada(r)) return;
    if (r.fechaPlan) push(r.fechaPlan, null, "Distribución", `AD ${r.ad} planificada · ${tipoADInfo(r).nombre}`, String(r.ad), `${r.comunidad || ""} · ${r.unidad || ""}`);
    if (r.fechaSalida) push(r.fechaSalida, r.horaSalida, "Distribución", `AD ${r.ad} salió a recolección`, String(r.ad), `${r.unidad} · ${r.conductor}`);
    if (r.jornada?.recoleccion) push(r.jornada.recoleccion.fecha, r.jornada.recoleccion.hora, "Planta", `AD ${r.ad} · recolección`, String(r.ad), `${r.jornada.recoleccion.recogidas} recogidas`);
    if (r.jornada?.llenado) push(r.jornada.llenado.fecha, r.jornada.llenado.hora, "Planta", `AD ${r.ad} · llenado y devolución`, String(r.ad), `${r.jornada.llenado.llenadas} llenas · ${r.jornada.llenado.noLlenadas} vacías`);
    (r.jornada?.correcciones || []).forEach((c) => c.cambios.forEach((x) => push(c.fecha, c.hora, "Distribución",
      `AD ${r.ad} · incidencia corregida al cerrar`, x.solicitud, `${x.antes} → ${x.despues}${x.observacion ? ` · ${x.observacion}` : ""} · ${c.por}`)));
    if (r.cerradaEn) push(r.cerradaEn, r.horaCierre, "Distribución", `AD ${r.ad} cerrada`, String(r.ad), `${r.cierreDetalle?.entregadas || 0} entregadas · ${r.cierreDetalle?.replanificadas || 0} a replanificación · Bs ${bs(r.cierreDetalle?.facturado || 0)}`);
    if (r.incidenciaTipo || r.obsIncidencia) push(r.incidenciaEn || r.fechaSalida || r.fechaPlan, null, "Distribución", `AD ${r.ad} con incidencia`, String(r.ad), r.obsIncidencia || r.incidenciaTipo);
  });
  abonos.forEach((a) => {
    if (a.tipo === "CONSUMO") return;
    push(a.fecha, null, "Comercialización", `Saldo a favor · ${a.tipo === "ABONO_EXCEDENTE" ? "excedente" : "abono"}`, a.id, `${a.usuario} · Bs ${bs(a.monto)}`);
  });
  reclamos.forEach((r) => {
    push(r.fecha, null, "Atención al usuario", `Reclamo ${r.estado === "RESUELTO" ? "resuelto" : "recibido"}`, r.id, r.asunto);
  });
  return ev.sort((a, b) => b.fecha - a.fecha || String(b.hora).localeCompare(String(a.hora))).slice(0, limite);
}
