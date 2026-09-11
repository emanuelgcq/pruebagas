/* ═══════════════════════════════════════════════════════════════════
   SEMILLA — el estado inicial del prototipo, construido con el mismo flujo que la app.

   Nada de lo que muestra una pantalla está escrito a mano: los pedidos se pagan con la
   regla, los saldos se descuentan solos, la tarifa de agosto se aplica a lo que se pagó en
   julio, las AD se planifican sobre pedidos pagados y las jornadas avanzan con las mismas
   funciones que usa Distribución (`src/flujo.js`). Por eso las pantallas cuadran entre sí.

   Lo que se ve el 14/08/2026 al abrir el prototipo:
     · Ayer (13/08) se cerró el AD 76527 · Rastrojitos Centro, con sus problemas reales.
     · Mañana (15/08) sale un AD especial por usuario con parte de esos problemas.
     · Hoy hay un AD en cada momento: planificadas, en recolección, en planta y
       devuelta al punto lista para cerrar. La comuna del portal está en planta.
   ═══════════════════════════════════════════════════════════════════ */
import { generarEstadoInicial, solicitudesDeRutas, parqueDelPadron, HOY, tpd, cpt, tipoAbono } from "./datos.jsx";
import {
  crearAsignacionesIniciales, beneficiariosDeRuta, unidadDistribucion, disponibilidadUnidad,
  UNIDADES_DISTRIBUCION, operadorDistribucion, ayudanteDistribucion,
} from "./distribucionSeed.js";
import {
  planificarAD, salidaAD, recoleccionAD, llenadoAD, cerrarADPuro, repreciar, nuevoAbono,
  adPlanificada, tipoAD, convocadasDeAD, marcarDespachadoAD,
} from "./flujo.js";

const r2 = (n) => Number(Number(n || 0).toFixed(2));
const AYER = new Date(2026, 7, 13);
const MANANA = new Date(2026, 7, 15);

/* Una unidad sin certificación, en taller o sin ayudante no puede salir. La hoja original
   asignaba AD a dos unidades así; el planificador no lo permitiría, y la semilla tampoco. */
function unidadDisponibleComo(placa) {
  const u = unidadDistribucion(placa);
  if (disponibilidadUnidad(u, HOY).disponible) return u;
  const mismas = UNIDADES_DISTRIBUCION.filter((x) => !x.granel && x.tipo === u.tipo && disponibilidadUnidad(x, HOY).disponible);
  return mismas.find((x) => x.epsdc && x.epsdc === u.epsdc) || mismas[0] || u;
}

function ajustarRuta(r) {
  // La institución no tenía número de AD: queda por planificar, con sus pedidos pagados.
  if (!r.ad || String(r.ad) === "0") return { ...r, estadoRuta: "SIN_PLANIFICAR" };
  if (r.estadoRuta === "SIN_PLANIFICAR") return r;
  const u = unidadDisponibleComo(r.unidad);
  if (u.placa === r.unidad) return r;
  const op = operadorDistribucion(u.operadorDefault);
  const ay = ayudanteDistribucion(u.ayudanteDefault);
  return { ...r, unidad: u.placa, placa: u.placa, unidadCodigoInterno: u.codigoInterno,
    operadorId: op.id, conductor: op.nombre, conductorCedula: op.cedula,
    ayudanteId: ay.id, ayudante: ay.nombre, ayudanteCedula: ay.cedula,
    transportistaTipo: u.tipo, epsdc: u.epsdc || null,
    notaUnidad: `Reasignada desde ${r.unidad}: la unidad original no estaba disponible` };
}

/**
 * Cada saldo a favor se descuenta solo en el siguiente pedido del usuario, sea del concepto
 * que sea: el usuario transfirió sólo la diferencia. Así el saldo que queda es el mínimo.
 */
function aplicarSaldosHistoricos(st, seq) {
  const eventos = [
    ...st.abonos.map((a) => ({ fecha: a.fecha, orden: 0, a })),
    ...st.solicitudes
      .filter((s) => tpd(s.tipoDespacho).requierePago && s.pago?.regla === "EXACTO" && ["VERIFICADO"].includes(s.pago.estado))
      .map((s) => ({ fecha: s.fecha, orden: 1, s })),
  ].sort((x, y) => x.fecha - y.fecha || x.orden - y.orden);
  const saldo = {};
  const consumos = [];
  const cambios = new Map();
  eventos.forEach((e) => {
    if (e.a) { saldo[e.a.usuario] = r2((saldo[e.a.usuario] || 0) + tipoAbono(e.a.tipo).signo * Number(e.a.monto)); return; }
    const s = e.s;
    const disp = saldo[s.usuario] || 0;
    if (disp <= 0.009) return;
    const dev = r2(Math.min(disp, Number(s.total)));
    saldo[s.usuario] = r2(disp - dev);
    consumos.push(nuevoAbono(seq, s.usuario, "CONSUMO", dev, s.id, `Descontado en ${s.id} · ${cpt(s.concepto).corto}`, { solicitud: s.id }, s.fecha));
    cambios.set(s.id, { ...s, saldoAplicado: dev, cubierto: Number(s.total), montoTransferido: r2(Number(s.total) - dev),
      pago: { ...s.pago, montoRecibido: r2(Number(s.total) - dev),
        detalleRegla: dev >= Number(s.total) - 0.009 ? "Cubierto por completo con su saldo a favor" : `Saldo a favor de Bs ${dev.toFixed(2)} aplicado · transfirió la diferencia` } });
  });
  return { ...st, solicitudes: st.solicitudes.map((s) => cambios.get(s.id) || s), abonos: [...st.abonos, ...consumos] };
}

/** Marcas deterministas de la jornada: salen del parque de envases y del orden en la lista. */
function marcasRecoleccion(st, rutaId, extra = {}) {
  const ruta = st.rutas.find((r) => r.id === rutaId);
  const conv = convocadasDeAD(ruta, st.solicitudes);
  const envase = new Map(st.parque.map((e) => [`${e.usuario}|${e.kg}`, e]));
  const marcas = {};
  conv.forEach((s, j) => {
    const e = envase.get(`${s.usuario}|${cpt(s.concepto).kg}`);
    const i = s.ordenEnRuta ?? j;
    if (extra[s.id]) marcas[s.id] = extra[s.id];
    else if (e && ["RETIRADO", "EN_TALLER", "NO_APTO"].includes(e.estado)) marcas[s.id] = { recogida: false, motivo: "SIN_ENVASE" };
    else if (i % 53 === 7) marcas[s.id] = { recogida: false, motivo: "NO_ESTABA" };
    else if (i % 89 === 13) marcas[s.id] = { recogida: false, motivo: "RECHAZADA_PUNTO", observacion: "Válvula con fuga" };
  });
  return marcas;
}
function marcasLlenado(st, rutaId, extra = {}) {
  const ruta = st.rutas.find((r) => r.id === rutaId);
  const conv = convocadasDeAD(ruta, st.solicitudes).filter((s) => ruta.jornada?.marcas?.[s.id]?.recogida !== false);
  const marcas = {};
  conv.forEach((s, j) => {
    const i = s.ordenEnRuta ?? j;
    if (extra[s.id]) marcas[s.id] = extra[s.id];
    else if (i % 61 === 17) marcas[s.id] = { llenada: false, motivo: "DEFECTUOSO", observacion: "Prueba hidrostática vencida" };
  });
  return marcas;
}

function aplicar(st, res, etiqueta) {
  if (!res.ok) {
    // La semilla usa las mismas validaciones que la app: si algo no pasa, se ve en consola.
    console.warn(`[semilla] ${etiqueta}: ${res.error}`);
    return st;
  }
  return {
    ...st,
    solicitudes: res.solicitudes || st.solicitudes,
    rutas: res.rutas || st.rutas,
    abonos: res.abonos?.length ? [...st.abonos, ...res.abonos] : st.abonos,
    parque: res.parque || st.parque,
    movPlanta: res.movPlanta?.length ? [...res.movPlanta, ...st.movPlanta] : st.movPlanta,
  };
}

export function construirEstadoInicial() {
  const base = generarEstadoInicial();
  const rutasHoja = crearAsignacionesIniciales();
  const desde = solicitudesDeRutas(rutasHoja, beneficiariosDeRuta, base.seq);
  const seq = { ...base.seq, ...desde.seq, ruta: 0 };

  let st = {
    solicitudes: [...base.solicitudes, ...desde.solicitudes],
    abonos: [...base.abonos, ...desde.abonos],
    parque: [...parqueDelPadron(base.solicitudes), ...desde.parque],
    rutas: rutasHoja.map(ajustarRuta),
    movPlanta: [...base.movPlanta],
  };

  // 1 · Cada saldo a favor se descontó en el siguiente pedido de su dueño.
  st = aplicarSaldosHistoricos(st, seq);

  // Ellard, el usuario del portal, no tiene pedidos en curso: su pedido de agosto lo hace
  // quien presenta la demo, y recorre el flujo completo hasta la factura.

  // 2 · Precio actual: lo pagado en julio se cobra con la tarifa de agosto.
  st = aplicar(st, { ok: true, ...repreciar(st, HOY, seq) }, "tarifa de agosto");

  // 3 · Las AD de la hoja se convocan con sus personas pagadas. La de Rastrojitos Centro
  //     (76527) fue la jornada de ayer; las demás son de hoy.
  st.rutas.filter(adPlanificada).forEach((r) => {
    const ids = st.solicitudes.filter((s) => s.rutaId === r.id && s.estado === "PAGADA").map((s) => s.id);
    if (!ids.length) return;
    const deAyer = r.id === "RES-01";
    st = aplicar(st, planificarAD(st, {
      tipo: tipoAD(r), rutaId: r.id, solicitudIds: ids, ad: r.ad, unidad: r.unidad,
      operadorId: r.operadorId, ayudanteId: r.ayudanteId, fecha: deAyer ? new Date(2026, 7, 12) : AYER, fechaJornada: deAyer ? AYER : HOY,
      por: "Gerencia de Distribución",
    }, seq), `planificar AD ${r.ad}`);
  });

  // 4 · Ayer: AD 76527 · Rastrojitos Centro. Salió, recogió, llenó, devolvió y se cerró.
  const res01 = st.rutas.find((r) => r.id === "RES-01");
  if (res01 && adPlanificada(res01)) {
    st = aplicar(st, salidaAD(st, "RES-01", { fecha: AYER, hora: "07:15" }, seq), "salida 76527");
    const convRes = convocadasDeAD(st.rutas.find((r) => r.id === "RES-01"), st.solicitudes);
    const desistio = convRes[40] ? { [convRes[40].id]: { recogida: false, motivo: "CANCELADO", observacion: "Avisó en el punto que ya compró en otro lado" } } : {};
    st = aplicar(st, recoleccionAD(st, "RES-01", marcasRecoleccion(st, "RES-01", desistio), { fecha: AYER, hora: "09:40", por: "Distribución · reporte del conductor" }, seq), "recolección 76527");
    const recogRes = convocadasDeAD(st.rutas.find((r) => r.id === "RES-01"), st.solicitudes)
      .filter((s) => st.rutas.find((r) => r.id === "RES-01").jornada.marcas[s.id]?.recogida !== false);
    const fallaPlanta = recogRes[101] ? { [recogRes[101].id]: { llenada: false, motivo: "FALLA_PLANTA", observacion: "Balanza 3 fuera de servicio" } } : {};
    st = aplicar(st, llenadoAD(st, "RES-01", marcasLlenado(st, "RES-01", fallaPlanta), { fecha: AYER, horaLlenado: "12:30", horaDevolucion: "16:50" }, seq), "llenado 76527");
    st = aplicar(st, cerrarADPuro(st, "RES-01", { fecha: AYER, hora: "17:40", receptor: "Yusmary Pérez", cedula: "V-15.402.118", por: "Gerencia de Distribución" }, seq), "cierre 76527");
  }

  // 5 · Mañana: AD especial por usuario. Toma lo prioritario de la bandeja (la falla de
  //     planta), dos ausencias y las entregas directas de uso comercial.
  const bandeja = st.solicitudes.filter((s) => s.estado === "POR_REPLANIFICAR");
  const especial = [
    ...bandeja.filter((s) => s.problema?.imputable === "EMPRESA"),
    ...bandeja.filter((s) => s.problema?.motivo === "NO_ESTABA").slice(0, 2),
    ...st.solicitudes.filter((s) => s.estado === "PAGADA" && s.modalidadEntrega === "DIRECTA_COMERCIAL" && !s.rutaId
      && s.comuna === "COM-BQTO-01" && cpt(s.concepto).bombona),
  ];
  if (especial.length) {
    st = aplicar(st, planificarAD(st, {
      tipo: "ESPECIAL", solicitudIds: especial.map((s) => s.id), ad: "76990", unidad: "A92RT5",
      fecha: HOY, fechaJornada: MANANA, nota: "Replanificación de la jornada del 13/08 y entregas directas", por: "Gerencia de Distribución",
    }, seq), "AD especial 76990");
  }

  // 6 · La comuna del portal: jornada de Barquisimeto Centro. Hoy está en planta.
  const bqc = st.solicitudes.filter((s) => s.comuna === "COM-BQTO-01" && s.estado === "PAGADA" && s.modalidadEntrega === "COMUNA" && cpt(s.concepto).bombona && !s.ad);
  if (bqc.length) {
    st = aplicar(st, planificarAD(st, {
      tipo: "JORNADA", solicitudIds: bqc.map((s) => s.id), ad: "76950", unidad: "B41MX8",
      fecha: AYER, fechaJornada: HOY, bloque: "BARQUISIMETO CENTRO", comuna: "COMUNA BARQUISIMETO CENTRO",
      comunidad: "CENTRO COMUNAL EL OBELISCO", parroquia: "CONCEPCIÓN", por: "Gerencia de Distribución",
    }, seq), "jornada Barquisimeto Centro");
    const rutaBqc = st.rutas.find((r) => String(r.ad) === "76950");
    if (rutaBqc) {
      st = aplicar(st, salidaAD(st, rutaBqc.id, { fecha: HOY, hora: "07:30" }, seq), "salida 76950");
      const sinBombona = convocadasDeAD(rutaBqc, st.solicitudes).find((s) => s.usuario === "4342298");
      st = aplicar(st, recoleccionAD(st, rutaBqc.id, sinBombona ? { [sinBombona.id]: { recogida: false, motivo: "SIN_ENVASE", observacion: "Llegó sin la bombona" } } : {},
        { fecha: HOY, hora: "09:05", por: "Distribución · reporte del conductor" }, seq), "recolección 76950");
    }
  }

  // 7 · Hoy, en la parroquia José Gregorio Bastidas, una AD en cada momento.
  const avanzar = (rutaId, hasta, horas) => {
    const r = st.rutas.find((x) => x.id === rutaId);
    if (!r || !adPlanificada(r)) return;
    st = aplicar(st, salidaAD(st, rutaId, { fecha: HOY, hora: horas[0] }, seq), `salida ${r.ad}`);
    if (hasta === "EN_RUTA") return;
    st = aplicar(st, recoleccionAD(st, rutaId, marcasRecoleccion(st, rutaId), { fecha: HOY, hora: horas[1], por: "Distribución · reporte del conductor" }, seq), `recolección ${r.ad}`);
    if (hasta === "EN_PLANTA") return;
    st = aplicar(st, llenadoAD(st, rutaId, marcasLlenado(st, rutaId), { fecha: HOY, horaLlenado: horas[2], horaDevolucion: horas[3] }, seq), `llenado ${r.ad}`);
  };
  avanzar("JGB-16", "EN_RUTA", ["07:10"]);                               // 76883 · Coco e Mono
  avanzar("JGB-17", "EN_PLANTA", ["06:50", "09:20"]);                    // 76884 · Concepción Dos Cerros
  avanzar("JGB-12", "EN_PUNTO", ["06:40", "08:55", "11:40", "14:10"]);   // 76902 · Tres Topias · lista para cerrar
  // Su operador ya marcó despachado en la app: Distribución sólo tiene que cerrarla.
  st = aplicar(st, marcarDespachadoAD(st, "JGB-12", { fecha: HOY, hora: "14:25", operador: "Julio César Silva" }), "despacho 76902");

  return {
    solicitudes: st.solicitudes, abonos: st.abonos, parqueEnvases: st.parque, rutas: st.rutas, movPlanta: st.movPlanta,
    manuales: base.manuales, reclamos: base.reclamos, seq,
  };
}
