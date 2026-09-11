import React, { useState, useRef, useMemo } from "react";
import { Users, Building2, Calculator, Route, AlertTriangle, RotateCcw, Smartphone } from "lucide-react";
import {
  CLIENTE_PORTAL, HOY, cpt, tpd, usr, montos, boletasDe, facturasDe, movimientosDe, existenciasDe,
  compromisosDe, disponiblesDe, cicloDe, USUARIOS, COMUNAS, saldosDe, ESTADO_ABONADA, tipoMovPlanta,
  kgALitros, estadoPadronDe, codigoGenerico, reglaPago, incidenciaPrevia, motivoEstadoPadron,
  dineroAplicadoDe, finDeCiclo, etiquetaCiclo, PERIODO, BANCOS, TOPE_UNIDADES_GENERICO,
} from "./datos.jsx";
import {
  nuevaSolicitud, completarPago as completarPagoPuro, planificarAD as planificarADPuro, salidaAD as salidaADPuro,
  recoleccionAD, llenadoAD, corregirJornadaAD, cerrarADPuro, abonarPedido as abonarPedidoPuro, vencerPlazos, nuevoAbono,
  cifrasSistema, pedidosDistribucion, gruposPorPlanificar, bandejaReplanificacion, bitacoraEventos,
  marcarDespachadoAD, ventaPlantaMovil, validarCobroPM, cajaPlantaMovil,
} from "./flujo.js";
import { construirEstadoInicial } from "./semilla.js";
import PortalUsuario from "./PortalUsuario.jsx";
import Comercializacion from "./Comercializacion.jsx";
import Proyecto from "./Proyecto.jsx";
import Nomina from "./Nomina.jsx";
import Distribucion from "./Distribucion.jsx";
import CentroGestion from "./CentroGestion.jsx";
import AppOperador from "./AppOperador.jsx";
import Tema from "./Tema.jsx";

/* Un solo universo de datos, construido con el mismo flujo que usan las pantallas
   (ver `src/semilla.js`). Se reinicia al recargar la página: no hay backend. */
const INICIAL = construirEstadoInicial();

export default function App() {
  const [cara, setCara] = useState("proyecto");
  const [solicitudes, setSolicitudes] = useState(INICIAL.solicitudes);
  const [manuales, setManuales] = useState(INICIAL.manuales);
  const [reclamos, setReclamos] = useState(INICIAL.reclamos);
  const [abonos, setAbonos] = useState(INICIAL.abonos);
  const [movPlanta, setMovPlanta] = useState(INICIAL.movPlanta);
  const [parqueEnvases, setParqueEnvases] = useState(INICIAL.parqueEnvases);
  const [periodoCerrado, setPeriodoCerradoEstado] = useState(false);
  const [cierrePeriodo, setCierrePeriodo] = useState(null);
  const [rutasDistribucion, setRutasDistribucion] = useState(INICIAL.rutas);
  // Cierre de caja de cada jornada de planta móvil, declarado por el operador en la app.
  const [cajasPM, setCajasPM] = useState({});
  // El padrón vive en el módulo `datos.jsx` y lo consultan decenas de puntos vía `usr()`.
  // Para que una edición se refleje en todos ellos a la vez, se actualiza el registro en
  // sitio y se incrementa esta versión, que fuerza el recálculo de las vistas.
  const [padronV, setPadronV] = useState(0);
  const seq = useRef({ ...INICIAL.seq });

  const boletas = useMemo(() => boletasDe(solicitudes, manuales), [solicitudes, manuales]);
  const facturas = useMemo(() => facturasDe(solicitudes, manuales), [solicitudes, manuales]);
  const movs = useMemo(() => movimientosDe(solicitudes, manuales), [solicitudes, manuales]);
  const existencias = useMemo(() => existenciasDe(movs, movPlanta), [movs, movPlanta]);
  const compromisos = useMemo(() => compromisosDe(solicitudes), [solicitudes]);
  const disponibles = useMemo(() => disponiblesDe(existencias, compromisos), [existencias, compromisos]);
  const ciclo = useMemo(() => cicloDe(solicitudes, CLIENTE_PORTAL.id), [solicitudes]);
  const saldos = useMemo(() => saldosDe(abonos), [abonos]);

  /* Las cifras del sistema se calculan UNA vez y todas las pantallas las leen de aquí. */
  const cifras = useMemo(() => cifrasSistema({ solicitudes, abonos, facturas, rutas: rutasDistribucion, movPlanta, existencias, compromisos, disponibles }),
    [solicitudes, abonos, facturas, rutasDistribucion, movPlanta, existencias, compromisos, disponibles]);
  const pedidos = useMemo(() => pedidosDistribucion(solicitudes, rutasDistribucion), [solicitudes, rutasDistribucion]);
  const gruposPlanificar = useMemo(() => gruposPorPlanificar(solicitudes, rutasDistribucion), [solicitudes, rutasDistribucion]);
  const bandeja = useMemo(() => bandejaReplanificacion(solicitudes, parqueEnvases), [solicitudes, parqueEnvases]);
  const bitacora = useMemo(() => bitacoraEventos({ solicitudes, abonos, rutas: rutasDistribucion, reclamos }), [solicitudes, abonos, rutasDistribucion, reclamos]);

  // Comunas sin jornada planificada: su gente no debe contar días de inactividad,
  // porque la falta de movimiento es imputable a la empresa y no al usuario.
  const comunasSinJornada = useMemo(() => {
    const conJornada = new Set(solicitudes.filter((s) => s.rutaId || s.estado === "EN_AD").map((s) => s.comuna));
    return new Set(COMUNAS.filter((c) => !conJornada.has(c.id)).map((c) => c.id));
  }, [solicitudes]);

  const padron = useMemo(
    () => USUARIOS.map((u) => ({ ...u, padron: estadoPadronDe(u, solicitudes, abonos, comunasSinJornada) })),
    [solicitudes, abonos, comunasSinJornada, padronV]
  );

  /* ─── Aplicar el resultado de una función del flujo ───
     Cada función pura devuelve el estado nuevo de lo que tocó; aquí se asienta. */
  const estadoActual = () => ({ solicitudes, abonos, parque: parqueEnvases, rutas: rutasDistribucion, movPlanta });
  function asentar(res) {
    if (!res?.ok) return res;
    if (res.solicitudes) setSolicitudes(res.solicitudes);
    if (res.abonos?.length) setAbonos((p) => [...res.abonos, ...p]);
    if (res.parque) setParqueEnvases(res.parque);
    if (res.rutas) setRutasDistribucion(res.rutas);
    if (res.movPlanta?.length) setMovPlanta((p) => [...res.movPlanta, ...p]);
    return res;
  }
  /* Cerrado el período, nada con fecha de agosto se registra ni se modifica. */
  const bloqueo = () => (periodoCerrado
    ? { ok: false, error: `El período de ${PERIODO.label.toLowerCase()} está cerrado: no se registran operaciones con fecha de este período. Recarga la página para volver al inicio de la demo.` }
    : null);

  /* ═══════════  PEDIR Y PAGAR  ═══════════ */

  /** El ciudadano pide desde el portal. Misma vía que la taquilla: tope, saldo primero y regla de pago. */
  function crearSolicitud(d) {
    const b = bloqueo(); if (b) return b;
    const res = nuevaSolicitud(estadoActual(), {
      usuario: CLIENTE_PORTAL.id, concepto: d.concepto, cantidad: d.cantidad, banco: d.banco,
      referencia: d.referencia, montoRecibido: d.montoTransferido, nota: d.nota,
      canal: d.banco === "PM" ? "PAGO_MOVIL" : "PORTAL", origen: "PORTAL",
    }, seq.current);
    if (!res.ok) return res;
    setSolicitudes((p) => [res.solicitud, ...p]);
    if (res.abonos.length) setAbonos((p) => [...res.abonos, ...p]);
    return res;
  }

  /**
   * SOLICITUD MANUAL · el único caso en que Comercialización crea un pedido: quien llega a la
   * taquilla sin usar el portal. El operador anota todo y la regla de pago se aplica igual.
   */
  function crearSolicitudManual(d) {
    const b = bloqueo(); if (b) return b;
    const res = nuevaSolicitud(estadoActual(), {
      usuario: d.usuario, concepto: d.concepto, cantidad: d.cantidad, banco: d.banco, referencia: d.referencia,
      montoRecibido: d.montoRecibido, nota: d.observacion, canal: d.canal || "TAQUILLA", origen: "TAQUILLA",
      tipoDespacho: d.tipoDespacho, cdt: d.cdt,
      registro: { por: d.operador || "Comercialización", en: HOY, motivo: d.motivoRegistro || null, canal: d.canal || "TAQUILLA", observacion: d.observacion || null },
    }, seq.current);
    if (!res.ok) return res;
    setSolicitudes((p) => [res.solicitud, ...p]);
    if (res.abonos.length) setAbonos((p) => [...res.abonos, ...p]);
    return { ...res, abono: res.excedente };
  }

  /** Completar un pedido por completar: primero el saldo, después la transferencia. */
  function completarPago(solicitudId, d = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(completarPagoPuro(estadoActual(), solicitudId, d, seq.current));
  }

  /**
   * Revertir una referencia rechazada por repetida cuando el usuario demuestra que era suya.
   * Los pagos cortos ya no se revierten: quedan por completar y se completan.
   */
  function revertirResolucionPago(sol, nota, quien) {
    const b = bloqueo(); if (b) return b;
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    if (actual.pago?.estado !== "RECHAZADO") return { ok: false, error: "Sólo se revierte una referencia rechazada por repetida." };
    if (!String(nota || "").trim()) return { ok: false, error: "La reversión requiere motivo: queda en la bitácora." };
    const responsable = quien || "Comercialización";
    const cubierto = Math.min(Number(actual.total), Number(actual.pago.montoRecibido || 0) + Number(actual.saldoAplicado || 0));
    const completo = cubierto >= Number(actual.total) - 0.01;
    const actualizada = {
      ...actual, estado: completo ? "PAGADA" : "POR_COMPLETAR", cubierto,
      pago: { ...actual.pago, estado: completo ? "VERIFICADO" : "INCOMPLETO", revertida: true, revertidaPor: responsable,
        revertidaEn: HOY, notaReversion: String(nota).trim() },
    };
    setSolicitudes((p) => p.map((s) => (s.id === actual.id ? actualizada : s)));
    return { ok: true, anulado: 0, estado: actualizada.estado };
  }

  /**
   * INCIDENCIA SOBRE UNA SOLICITUD QUE NO HA SALIDO A RUTA.
   * La consecuencia la fija el motivo: CIERRA (decisión del usuario o corrección: pasa a
   * saldo a favor) o RETIENE (el pedido sigue vivo con la constancia).
   */
  function registrarIncidenciaPrevia(sol, motivoId, nota, quien) {
    const b = bloqueo(); if (b) return b;
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    if (!actual || ["CULMINADO", ESTADO_ABONADA].includes(actual.estado)) return { ok: false, error: "La solicitud ya está cerrada." };
    if (actual.estado === "EN_AD") return { ok: false, error: "Ya está convocada en un AD: lo que pase en la jornada lo registra Distribución." };
    const m = incidenciaPrevia(motivoId);
    const responsable = String(quien || "").trim() || "Comercialización";
    const registro = { motivo: m.id, nombre: m.nombre, consecuencia: m.consecuencia, nota: String(nota || "").trim() || null, por: responsable, en: HOY };
    if (m.consecuencia === "RETIENE") {
      setSolicitudes((p) => p.map((s) => (s.id === actual.id
        ? { ...s, incidencia: registro, retenidaDesde: s.retenidaDesde || HOY,
            requiereVerificacionPadron: Boolean(m.marcaPadron) || s.requiereVerificacionPadron }
        : s)));
      return { ok: true, cierra: false, motivo: m, monto: 0 };
    }
    const monto = dineroAplicadoDe(actual);
    setSolicitudes((p) => p.map((s) => (s.id === actual.id
      ? { ...s, estado: ESTADO_ABONADA, motivoNoCompra: m.nombre, motivoId: m.id, incidencia: registro, fechaAbono: HOY, abonadoBs: monto,
          rutaId: s.estado === "PAGADA" ? s.rutaId : null, requiereVerificacionPadron: Boolean(m.marcaPadron) || s.requiereVerificacionPadron }
      : s)));
    if (monto > 0.009) {
      setAbonos((p) => [nuevoAbono(seq.current, actual.usuario, "ABONO_NO_COMPRA", monto, actual.id,
        `${m.nombre}${registro.nota ? ` · ${registro.nota}` : ""}`, { solicitud: actual.id, cdt: actual.cdt, registradoPor: responsable }), ...p]);
    }
    return { ok: true, cierra: true, motivo: m, monto };
  }

  /* ═══════════  DISTRIBUCIÓN · LA JORNADA POR MOMENTOS  ═══════════ */

  /** Planificar un AD: jornada comunal o AD especial por usuario. */
  function planificarAD(d) {
    const b = bloqueo(); if (b) return b;
    return asentar(planificarADPuro(estadoActual(), { por: "Gerencia de Distribución", ...d }, seq.current));
  }
  /** Salida a recolección. Fija el precio del AD: el de este día. */
  function salidaAD(rutaId, meta = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(salidaADPuro(estadoActual(), rutaId, { fecha: HOY, ...meta }, seq.current));
  }
  /** Recolección en el punto: quién llevó su bombona y quién no, con su motivo. */
  function registrarRecoleccion(rutaId, marcas = {}, meta = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(recoleccionAD(estadoActual(), rutaId, marcas, { fecha: HOY, ...meta }, seq.current));
  }
  /** Llenado en planta y devolución al punto: cuáles se llenaron y cuáles volvieron vacías. */
  function registrarLlenado(rutaId, marcas = {}, meta = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(llenadoAD(estadoActual(), rutaId, marcas, { fecha: HOY, ...meta }, seq.current));
  }
  /** Cierre del AD: factura lo devuelto lleno, replanifica o abona lo demás. Si al cerrar se
      anotaron o corrigieron incidencias por cliente, primero se asientan (y se rehacen los
      movimientos de planta de esta AD) y el cierre trabaja sobre lo corregido. */
  function cerrarAD(rutaId, meta = {}) {
    const b = bloqueo(); if (b) return b;
    const id = typeof rutaId === "object" ? rutaId.id : rutaId;
    const { correcciones, ...resto } = meta;
    let st = estadoActual();
    let corregido = null;
    if (correcciones && Object.keys(correcciones).length) {
      corregido = corregirJornadaAD(st, id, correcciones, { fecha: HOY, hora: resto.hora, por: resto.por });
      if (!corregido.ok) return corregido;
      if (!corregido.sinCambios) st = { ...st, rutas: corregido.rutas, movPlanta: corregido.movPlantaNuevo };
    }
    const res = cerrarADPuro(st, id, { fecha: HOY, ...resto }, seq.current);
    if (!res?.ok) return res;
    if (corregido && !corregido.sinCambios) setMovPlanta(corregido.movPlantaNuevo);
    return asentar({ ...res, correcciones: corregido?.cambios || 0 });
  }
  /* ═══════════  APP DEL OPERADOR  ═══════════ */

  /** Incidencias por cliente anotadas o corregidas con el AD en el punto (app o Distribución). */
  function corregirIncidencias(rutaId, cambios = {}, meta = {}) {
    const b = bloqueo(); if (b) return b;
    const res = corregirJornadaAD(estadoActual(), rutaId, cambios, { fecha: HOY, ...meta });
    if (!res?.ok || res.sinCambios) return res;
    setRutasDistribucion(res.rutas);
    setMovPlanta(res.movPlantaNuevo);
    return res;
  }
  /** El operador marca despachado: deja su reporte. El AD lo cierra sólo Distribución. */
  function marcarDespachado(rutaId, meta = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(marcarDespachadoAD(estadoActual(), rutaId, { fecha: HOY, ...meta }));
  }
  /** Venta en planta móvil: con código nace entregada y facturada; sin código va contra el genérico. */
  function venderPlantaMovil(d) {
    const b = bloqueo(); if (b) return b;
    if (cajasPM[d.jornada]) return { ok: false, error: "La caja de esta jornada ya se cerró: no admite ventas nuevas." };
    if (d.usuario) {
      const res = ventaPlantaMovil({ solicitudes, manuales }, d, seq.current);
      if (res.ok) setSolicitudes((p) => [res.solicitud, ...p]);
      return res;
    }
    const g = codigoGenerico(d.codigoGenerico);
    if (!g) return { ok: false, error: "Código genérico no válido." };
    const m = montos(g.concepto, Number(d.cantidad || 1), g.id, HOY);
    const cobro = validarCobroPM({ solicitudes, manuales }, d, m.total);
    if (!cobro.ok) return cobro;
    const res = crearVentaGenerica({ ...d, canal: "PLANTA_MOVIL", banco: cobro.pago.banco, referencia: cobro.pago.referencia });
    if (!res.ok) return res;
    // El cobro con su método (efectivo, punto de venta, pago móvil o transferencia) y la jornada.
    const factura = { ...res.factura, jornadaPlantaMovil: d.jornada, hora: d.hora || null, pago: { ...res.factura.pago, ...cobro.pago, estado: "VERIFICADO" } };
    setManuales((p) => p.map((f) => (f.id === factura.id ? factura : f)));
    return { ok: true, factura, total: factura.total, vuelto: cobro.vuelto };
  }
  /** El operador cierra la caja de la jornada: cuenta el efectivo; Comercialización lo concilia. */
  function cerrarCajaPM(jornadaId, d = {}) {
    const caja = cajaPlantaMovil(jornadaId, solicitudes, manuales);
    // La caja del día del operador: sólo lo que él cobró en efectivo desde la app.
    const esperado = Number(caja.porMetodo.EFECTIVO.toFixed(2));
    const contado = Number(d.efectivoContado || 0);
    const cierre = { fecha: HOY, hora: d.hora || "—", operador: d.operador || "Operador", esperado, contado,
      diferencia: Number((contado - esperado).toFixed(2)), total: caja.total, ventas: caja.ventas.length };
    setCajasPM((p) => ({ ...p, [jornadaId]: cierre }));
    return { ok: true, cierre };
  }

  /** Distribución decide no replanificar un pedido: su dinero pasa al saldo a favor. */
  function abonarPedido(solicitudId, d = {}) {
    const b = bloqueo(); if (b) return b;
    return asentar(abonarPedidoPuro(estadoActual(), solicitudId, { por: "Gerencia de Distribución", ...d }, seq.current));
  }

  /** Reasignar vehículo o conductor, registrar o resolver una incidencia. */
  function actualizarRutaDistribucion(id, cambios) {
    const b = bloqueo(); if (b) return b;
    setRutasDistribucion((rs) => rs.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
    return { ok: true };
  }

  /* ═══════════  CIERRE DEL PERÍODO  ═══════════ */

  /**
   * Cerrar el período es cerrar el ciclo: lo que no se replanificó ni se completó pasa al
   * saldo a favor, y desde ese momento nada con fecha del período se registra.
   */
  function cerrarPeriodo(d = {}) {
    if (periodoCerrado) return { ok: false, error: "El período ya está cerrado." };
    const res = vencerPlazos({ solicitudes }, finDeCiclo(HOY), seq.current, d.por || "Cierre del período");
    setSolicitudes(res.solicitudes);
    if (res.abonos.length) setAbonos((p) => [...res.abonos, ...p]);
    const resumen = { en: HOY, por: d.por || "Comercialización", vencidas: res.vencidas, monto: res.monto, ciclo: etiquetaCiclo() };
    setCierrePeriodo(resumen);
    setPeriodoCerradoEstado(true);
    return { ok: true, ...resumen };
  }
  // Compatibilidad: sólo se puede cerrar; el período no se reabre.
  const setPeriodoCerrado = (v) => (v && !periodoCerrado ? cerrarPeriodo() : null);

  /* ═══════════  COMERCIALIZACIÓN · DOCUMENTOS Y PADRÓN  ═══════════ */

  /** Registra manualmente un movimiento en el libro de saldos a favor. */
  function registrarAbono(d) {
    const b = bloqueo(); if (b) return b;
    const mov = nuevoAbono(seq.current, d.usuario, d.tipo, d.monto, d.referencia || "—", d.detalle || "", d.extra || {});
    setAbonos((p) => [mov, ...p]);
    return mov;
  }

  function crearManual(d) {
    const b = bloqueo(); if (b) return b;
    const m = montos(d.concepto, Number(d.cantidad), d.usuario, HOY);
    const n = manuales.length;
    const tal = `TAL-${d.cdt.replace("CDT-", "")}-${1184 + n}`;
    setManuales((p) => [{
      id: `FAC-M-${String(205 + n).padStart(6, "0")}`, serie: `M-${String(205 + n).padStart(8, "0")}`,
      control: tal, talonario: tal, sol: null, ad: null, cdt: d.cdt, comuna: usr(d.usuario).comuna, usuario: d.usuario,
      concepto: d.concepto, cantidad: Number(d.cantidad), fecha: HOY, ...m, origen: "MANUAL",
      tipoDespacho: usr(d.usuario).tipo === "Institución" ? "INSTITUCION" : "COMERCIAL",
      condicionVenta: usr(d.usuario).condicionVenta || "CONTADO",
      pago: { banco: "BDV", referencia: `88${5000 + n * 13}`, estado: "VERIFICADO", auto: false },
    }, ...p]);
    return { ok: true };
  }

  /**
   * Venta sin contrato contra un código genérico. Usa inventario, genera ingreso, deja su
   * boleta y entra al libro de ventas como cualquier otra venta.
   */
  function crearVentaGenerica(d) {
    const b = bloqueo(); if (b) return b;
    const g = codigoGenerico(d.codigoGenerico);
    if (!g) return { ok: false, error: "Código genérico no válido." };
    const cantidad = Number(d.cantidad || 1);
    if (!(cantidad > 0)) return { ok: false, error: "La cantidad no es válida." };
    // El genérico no puede volverse el destino de lo que no se quiere justificar: tope por venta.
    if (g.canal !== "GRANEL" && cantidad > TOPE_UNIDADES_GENERICO) {
      return { ok: false, error: `Una venta sin contrato admite hasta ${TOPE_UNIDADES_GENERICO} bombonas.` };
    }
    // El efectivo de planta móvil o del CDT no pasa por un banco: se controla por arqueo.
    const esBanco = BANCOS.some((x) => x.id === d.banco);
    const m = montos(g.concepto, cantidad, g.id, HOY);
    const n = manuales.length;
    const tal = `GEN-${g.cdt.replace("CDT-", "")}-${4200 + n}`;
    seq.current.bop += 1;
    const bopId = `BOP-${String(seq.current.bop).padStart(4, "0")}`;
    const factura = {
      id: `FAC-G-${String(300 + n).padStart(6, "0")}`, serie: `G-${String(300 + n).padStart(8, "0")}`,
      control: tal, talonario: tal, sol: null, ad: null, cdt: g.cdt, comuna: null, usuario: g.id,
      concepto: g.concepto, cantidad, fecha: HOY, ...m, origen: "SIN_CONTRATO", boleta: bopId,
      tipoDespacho: "COMERCIAL", condicionVenta: "CONTADO",
      canal: d.canal || g.canal, codigoGenerico: g.id,
      compradorNombre: d.compradorNombre || "No identificado",
      compradorDoc: d.compradorDoc || "—",
      pago: esBanco
        ? { banco: d.banco, referencia: d.referencia || `77${6000 + n * 11}`, estado: "VERIFICADO", auto: false, canal: d.canal || g.canal }
        : { banco: "EFECTIVO", referencia: null, estado: "VERIFICADO", auto: false, canal: "EFECTIVO", efectivo: true },
      jornadaPlantaMovil: d.jornada || null,
    };
    setManuales((p) => [factura, ...p]);
    return { ok: true, factura };
  }

  /** Registro del operador de planta: gandolas y bombonas de la jornada. */
  function crearMovimientoPlanta(d) {
    const b = bloqueo(); if (b) return b;
    seq.current.mp += 1;
    const t = tipoMovPlanta(d.tipo);
    const kg = t.medio === "GANDOLA" || t.id === "LLENADO" ? Number(d.kg || 0) : 0;
    const mov = {
      id: `MP-${seq.current.mp}`, fecha: HOY, hora: d.hora || "—", tipo: d.tipo, cdt: d.cdt,
      documento: d.documento || `CMP-${seq.current.mp}`, contraparte: d.contraparte || "—",
      cilindros: d.cilindros || null, kg, litros: kgALitros(kg), ad: d.ad || null,
      vehiculo: d.vehiculo || "—", operador: d.operador || "—", cedula: d.cedula || "—",
      nota: d.nota || "", estado: d.estado || "CONFIRMADA",
    };
    setMovPlanta((p) => [mov, ...p]);
    return { ok: true, ...mov };
  }

  /**
   * Edición del padrón con bitácora. Los campos de identidad (código, cédula, contrato)
   * no se editan libremente: se corrigen por expediente, fuera de esta vía.
   */
  function actualizarUsuario(id, cambios, autor = "Comercialización") {
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Usuario no encontrado." };
    const protegidos = ["id", "doc", "contrato"];
    const bitacoraCambios = [];
    Object.entries(cambios).forEach(([k, v]) => {
      if (protegidos.includes(k)) return;
      const antes = u[k] instanceof Date ? u[k].getTime() : u[k] ?? null;
      const despues = v instanceof Date ? v.getTime() : v === "" ? null : v ?? null;
      if (antes === despues || (antes == null && despues == null)) return;
      bitacoraCambios.push({ campo: k, antes: u[k] ?? null, despues: v ?? null, fecha: HOY, autor });
      u[k] = v;
    });
    if (bitacoraCambios.length) {
      u.bitacora = [...bitacoraCambios, ...(u.bitacora || [])];
      setPadronV((n) => n + 1);
    }
    return { ok: true, cambios: bitacoraCambios };
  }

  /**
   * ALTA DE USUARIO. Primero la información base; el usuario nace CONTADO y REGULAR. La
   * condición de pago y la tarifaria se activan después, desde su ficha, con su aval.
   */
  function crearUsuario(d, autor = "Comercialización") {
    const doc = String(d.doc || "").trim().toUpperCase();
    const nombre = String(d.nombre || "").trim();
    if (nombre.length < 4) return { ok: false, error: "El nombre o razón social es obligatorio." };
    if (!/^[VEJGP]-?\d{6,9}$/i.test(doc.replace(/[.\s]/g, ""))) {
      return { ok: false, error: "Documento inválido. Use el formato V-12345678, J-401184223, etc." };
    }
    const limpio = doc.replace(/[.\s-]/g, "");
    if (USUARIOS.some((u) => String(u.doc || "").replace(/[.\s-]/g, "").toUpperCase() === limpio)) {
      return { ok: false, error: `Ya existe un usuario registrado con el documento ${doc}.` };
    }
    if (!d.comuna) return { ok: false, error: "Debe asociarlo a una comuna: es el punto por donde recibe." };
    seq.current.usuario = (seq.current.usuario || 4343000) + 1;
    const id = String(seq.current.usuario);
    const comuna = COMUNAS.find((c) => c.id === d.comuna) || COMUNAS[0];
    const nuevo = {
      id, nombre, doc,
      rifFactura: d.rifFactura || (doc.startsWith("J") || doc.startsWith("G") ? doc : "Sin Datos"),
      dir: d.dir || "", sector: d.sector || comuna.sector || "", tel: d.tel || "", correo: d.correo || "",
      cdt: comuna.cdt, comuna: comuna.id,
      tipo: doc.startsWith("J") || doc.startsWith("G") ? "Jurídica" : "Natural",
      uso: d.uso || "RESIDENCIAL",
      contrato: `${1180000 + (seq.current.usuario % 100000)}`,
      tipoContrato: d.tipoContrato || "Bombona Domicilio",
      condicionVenta: "CONTADO", condicionTarifa: "REGULAR",
      desde: HOY, portal: false, altaPor: autor, altaEn: HOY,
      bitacora: [{ campo: "alta", antes: null, despues: `Registrado por ${autor}`, fecha: HOY, autor }],
    };
    USUARIOS.push(nuevo);
    setPadronV((n) => n + 1);
    return { ok: true, usuario: nuevo };
  }

  /**
   * CULMINAR UN SERVICIO ATENDIDO EN O.A.U. Dispara boleta, factura y libro de ventas sin
   * exigir AD: un servicio no sale en una ruta. Factura a la tarifa del día en que se prestó.
   */
  function culminarServicio(sol, d = {}) {
    const b = bloqueo(); if (b) return b;
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    const c = cpt(actual.concepto);
    if (c.inv) return { ok: false, error: "Este concepto mueve inventario: se cierra en el cierre de su AD, no desde aquí." };
    if (actual.estado === "CULMINADO") return { ok: false, error: "El servicio ya está culminado." };
    if (actual.estado !== "PAGADA") return { ok: false, error: "Solo se culmina un servicio pagado por completo." };
    if (!String(d.atendio || "").trim()) return { ok: false, error: "Indique quién prestó el servicio." };
    const td = tpd(actual.tipoDespacho);
    const m = montos(actual.concepto, actual.cantidad, actual.usuario, HOY);
    seq.current.bop += 1;
    const bopId = `BOP-${String(seq.current.bop).padStart(4, "0")}`;
    let serie = null, control = null;
    if (td.factura) {
      seq.current.serie += 1;
      serie = `U-${String(seq.current.serie).padStart(8, "0")}`;
      control = `01-${actual.pedidoNro}`;
    }
    setSolicitudes((p) => p.map((s) => (s.id === actual.id ? {
      ...s, estado: "CULMINADO", boleta: bopId, serie, control, factura: serie, entrega: HOY, ...m,
      servicio: { atendio: String(d.atendio).trim(), en: HOY, canal: d.canal || "O.A.U.",
        informe: String(d.informe || "").trim() || null, receptor: String(d.receptor || "").trim() || null },
      obsEntrega: d.informe || null,
    } : s)));
    return { ok: true, boleta: bopId, serie, control, total: m.total, factura: td.factura };
  }

  /** Definir a mano el estado del padrón, o devolverlo al automatismo de 180 días. */
  function definirEstadoUsuario(id, motivoId, nota, autor = "Comercialización") {
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Usuario no encontrado." };
    if (!motivoId) {
      const antes = u.estadoManual;
      delete u.estadoManual;
      u.bitacora = [{ campo: "estado", antes: antes ? motivoEstadoPadron(antes.motivo)?.nombre : null,
        despues: "Vuelve al cálculo automático por antigüedad", fecha: HOY, autor }, ...(u.bitacora || [])];
      setPadronV((n) => n + 1);
      return { ok: true, estado: null };
    }
    const m = motivoEstadoPadron(motivoId);
    if (!m) return { ok: false, error: "Motivo no válido." };
    u.estadoManual = { motivo: m.id, por: autor, en: HOY, nota: String(nota || "").trim() || null };
    u.bitacora = [{ campo: "estado", antes: u.padron?.estado ?? null, despues: `${m.estado} · ${m.nombre}`, fecha: HOY, autor }, ...(u.bitacora || [])];
    setPadronV((n) => n + 1);
    return { ok: true, estado: m.estado, motivo: m };
  }

  function crearReclamo(d) {
    seq.current.rec += 1;
    const id = `REC-${String(seq.current.rec).padStart(4, "0")}`;
    const prioridad = d.prioridad || (/fuga|olor|seguridad/i.test(`${d.asunto} ${d.detalle}`) ? "ALTA" : "MEDIA");
    setReclamos((r) => [{
      id, usuario: CLIENTE_PORTAL.id, fecha: HOY, asunto: d.asunto, tipo: d.tipo,
      estado: "RECIBIDO", prioridad, detalle: d.detalle,
      respuesta: null, cerrado: null, atendio: null, solicitud: d.solicitud || null,
    }, ...r]);
    return id;
  }

  function responderReclamo(rec, texto, cerrar) {
    setReclamos((rs) => rs.map((r) => (r.id === rec.id ? {
      ...r, respuesta: texto, atendio: "M. Álvarez",
      estado: cerrar ? "RESUELTO" : "EN_PROCESO", cerrado: cerrar ? HOY : null,
    } : r)));
  }

  function tomarReclamo(rec) {
    setReclamos((rs) => rs.map((r) => (r.id === rec.id && r.estado === "RECIBIDO"
      ? { ...r, estado: "EN_PROCESO", atendio: "M. Álvarez" } : r)));
  }

  const compartido = {
    // Estado
    solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles, ciclo,
    abonos, saldos, movPlanta, padron, padronV, parqueEnvases, rutasDistribucion, periodoCerrado, cierrePeriodo,
    // Una sola fuente de cifras y de vistas derivadas
    cifras, pedidos, gruposPlanificar, bandeja, bitacora,
    // Pedir y pagar
    crearSolicitud, crearSolicitudManual, completarPago, revertirResolucionPago, registrarIncidenciaPrevia,
    // Distribución · la jornada
    planificarAD, salidaAD, registrarRecoleccion, registrarLlenado, cerrarAD, abonarPedido, actualizarRutaDistribucion,
    // App del operador
    corregirIncidencias, marcarDespachado, venderPlantaMovil, cerrarCajaPM, cajasPM,
    crearMovimientoPlanta,
    // Comercialización
    crearManual, crearVentaGenerica, registrarAbono, culminarServicio, cerrarPeriodo, setPeriodoCerrado,
    actualizarUsuario, crearUsuario, definirEstadoUsuario,
    crearReclamo, responderReclamo, tomarReclamo,
    // Compatibilidad mientras las pantallas terminan de pasarse al flujo nuevo
    consignaciones: [],
  };

  return (
    <>
      <SwitcherEstilos />
      <div className="switcher">
        <div className="sw-marca">Demo GasLara</div>
        <div className="sw-tabs">
          <button className={cara === "proyecto" ? "on" : ""} onClick={() => setCara("proyecto")}>
            <Building2 size={14} /> Proyecto
          </button>
          <button className={cara === "gestion" ? "on" : ""} onClick={() => setCara("gestion")}>
            <Building2 size={14} /> Centro de gestión
          </button>
          <button className={cara === "portal" ? "on" : ""} onClick={() => setCara("portal")}>
            <Users size={14} /> Portal del usuario
          </button>
          <button className={cara === "distribucion" ? "on" : ""} onClick={() => setCara("distribucion")}>
            <Route size={14} /> Distribución
          </button>
          <button className={cara === "admin" ? "on" : ""} onClick={() => setCara("admin")}>
            <Building2 size={14} /> Módulo de comercialización
          </button>
          <button className={cara === "operador" ? "on" : ""} onClick={() => setCara("operador")}>
            <Smartphone size={14} /> App operadores
          </button>
          <button className={cara === "nomina" ? "on" : ""} onClick={() => setCara("nomina")}>
            <Calculator size={14} /> Nómina
          </button>
        </div>
        <div className="sw-hint">
          {cara === "proyecto" ? "Resumen del proyecto · problemas, solución y accesos"
            : cara === "gestion" ? "Dashboard ejecutivo · reportes · auditoría · roles"
            : cara === "admin" ? "Viendo como operador de comercialización"
            : cara === "operador" ? "App móvil de los operadores · despacho de AD y venta en planta móvil"
            : cara === "nomina" ? "Backoffice interno · Departamento de Nómina · trabajadores sin acceso"
            : cara === "distribucion" ? "Backoffice logístico · planificación, jornadas por momentos, replanificación y cierre de AD"
            : `Viendo como ${CLIENTE_PORTAL.nombre.split(" ").slice(0, 2).join(" ")} · contrato ${CLIENTE_PORTAL.contrato}`}
        </div>
      </div>
      <div className="cara">
        <Frontera key={cara} cara={cara}>
          {cara === "proyecto" && <Proyecto onNavigate={setCara} {...compartido} />}
          {cara === "gestion" && <CentroGestion {...compartido} />}
          {cara === "portal" && <PortalUsuario {...compartido} />}
          {cara === "distribucion" && <Distribucion {...compartido} />}
          {cara === "admin" && <Comercializacion {...compartido} />}
          {cara === "operador" && <AppOperador {...compartido} />}
          {cara === "nomina" && <Nomina />}
        </Frontera>
      </div>
      {/* Va al final a propósito: los estilos de cada módulo se inyectan al montarse,
          y la capa de diseño debe quedar después para imponerse sin usar !important. */}
      <Tema />
    </>
  );
}

/* Si una pantalla falla, el aviso queda dentro de su cara: el resto de la demo sigue viva. */
class Frontera extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(`[${this.props.cara}]`, error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="frontera">
        <AlertTriangle size={22} />
        <div>
          <b>Esta pantalla tuvo un error y se detuvo</b>
          <p>El resto de la demo sigue funcionando. Detalle técnico: {String(this.state.error?.message || this.state.error)}</p>
          <button onClick={() => this.setState({ error: null })}><RotateCcw size={14} /> Volver a intentar</button>
        </div>
      </div>
    );
  }
}

function SwitcherEstilos() {
  return (
    <style>{`
.switcher{position:sticky;top:0;z-index:100;background:#0C1512;color:#B9C7C2;
display:flex;align-items:center;gap:18px;padding:0 18px;height:46px;
font-family:"Inter","Segoe UI",system-ui,sans-serif;font-size:13px;
border-bottom:1px solid #1E2B27}
.sw-marca{font-weight:700;color:#fff;letter-spacing:-.2px;font-size:13.5px;white-space:nowrap}
.sw-tabs{display:flex;gap:3px;background:#16221E;border-radius:9px;padding:3px;overflow-x:auto;scrollbar-width:none}.sw-tabs::-webkit-scrollbar{display:none}
.sw-tabs button{display:flex;align-items:center;gap:7px;border:none;background:none;color:#94A8A2;
padding:6px 13px;border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:540;cursor:pointer;white-space:nowrap}
.sw-tabs button:hover{color:#E2EBE8}
.sw-tabs button.on{background:#2E9A63;color:#fff;font-weight:600}
.sw-hint{margin-left:auto;font-size:11.5px;color:#6E827C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cara{min-height:calc(100vh - 46px)}
.frontera{display:flex;gap:14px;align-items:flex-start;margin:48px auto;max-width:640px;padding:22px 24px;border-radius:14px;
background:#FFF7ED;color:#7C2D12;box-shadow:0 0 0 1px #FED7AA;font-family:"Inter","Segoe UI",system-ui,sans-serif}
.frontera b{display:block;font-size:15px;margin-bottom:6px}
.frontera p{margin:0 0 12px;font-size:13px;line-height:1.5;color:#9A3412}
.frontera button{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:8px;padding:7px 12px;
background:#C2410C;color:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
@media(max-width:820px){
 .switcher{height:auto;padding:8px 12px;gap:10px;flex-wrap:wrap}
 .sw-marca{font-size:12.5px}
 .sw-tabs{flex:1;min-width:0}
 .sw-tabs button{flex:1;justify-content:center;padding:7px 8px;font-size:11.5px}
 .sw-tabs button span{display:none}
 .sw-hint{display:none}
}
`}</style>
  );
}
