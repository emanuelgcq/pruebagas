import React, { useState, useRef, useMemo } from "react";
import { Users, Building2, Calculator, Route } from "lucide-react";
import {
  CLIENTE_PORTAL, COMUNA_PORTAL, HOY, cpt, tpd, usr, montos, generarEstadoInicial,
  boletasDe, facturasDe, movimientosDe, existenciasDe, compromisosDe, disponiblesDe,
  cicloDe, sumarDias, kgDeSolicitud, USUARIOS, COMUNAS,
  saldosDe, aplicarSaldo, ESTADO_ABONADA, tipoMovPlanta, kgALitros,
  estadoPadronDe, codigoGenerico, esCodigoGenerico,
  solicitudesDeRutas, parqueDelPadron, envasesDe, validarCanje, motivoNoEntrega,
  puedeSolicitar, consignacionesDe, cicloDistribucion, kgDeCilindros,
  aplicarReglaPago, reglaPago, incidenciaPrevia, motivoEstadoPadron,
} from "./datos.jsx";
import PortalUsuario from "./PortalUsuario.jsx";
import Comercializacion from "./Comercializacion.jsx";
import Proyecto from "./Proyecto.jsx";
import Nomina from "./Nomina.jsx";
import Distribucion from "./Distribucion.jsx";
import CentroGestion from "./CentroGestion.jsx";
import { crearAsignacionesIniciales, beneficiariosDeRuta } from "./distribucionSeed.js";
import Tema from "./Tema.jsx";

/* Un solo universo de datos.
   Antes la planificación vivía por su cuenta y las solicitudes por la suya, sin compartir
   un identificador. Aquí la planificación se convierte en solicitudes reales del sistema,
   de modo que Distribución y Comercialización miren la misma lista. */
const INICIAL = generarEstadoInicial();
const RUTAS_INICIALES = crearAsignacionesIniciales();
const DESDE_RUTAS = solicitudesDeRutas(RUTAS_INICIALES, beneficiariosDeRuta, INICIAL.seq);
const SOLICITUDES_INICIALES = [...INICIAL.solicitudes, ...DESDE_RUTAS.solicitudes];
const PARQUE_INICIAL = [...parqueDelPadron(), ...DESDE_RUTAS.parque];
const ABONOS_INICIALES = [...INICIAL.abonos, ...DESDE_RUTAS.abonos];

export default function App() {
  const [cara, setCara] = useState("proyecto");
  const [solicitudes, setSolicitudes] = useState(SOLICITUDES_INICIALES);
  const [manuales, setManuales] = useState(INICIAL.manuales);
  const [reclamos, setReclamos] = useState(INICIAL.reclamos);
  const [abonos, setAbonos] = useState(ABONOS_INICIALES);
  const [movPlanta, setMovPlanta] = useState(INICIAL.movPlanta);
  const [parqueEnvases, setParqueEnvases] = useState(PARQUE_INICIAL);
  const [periodoCerrado, setPeriodoCerrado] = useState(false);
  const [rutasDistribucion, setRutasDistribucion] = useState(RUTAS_INICIALES);
  // El padrón vive en el módulo `datos.jsx` y lo consultan decenas de puntos vía `usr()`.
  // Para que una edición se refleje en todos ellos a la vez, se actualiza el registro en
  // sitio y se incrementa esta versión, que fuerza el recálculo de las vistas.
  const [padronV, setPadronV] = useState(0);
  const seq = useRef({ ...INICIAL.seq, ...DESDE_RUTAS.seq });

  const boletas = useMemo(() => boletasDe(solicitudes, manuales), [solicitudes, manuales]);
  const facturas = useMemo(() => facturasDe(solicitudes, manuales), [solicitudes, manuales]);
  const movs = useMemo(() => movimientosDe(solicitudes, manuales), [solicitudes, manuales]);
  const existencias = useMemo(() => existenciasDe(movs, movPlanta), [movs, movPlanta]);
  const compromisos = useMemo(() => compromisosDe(solicitudes), [solicitudes]);
  const disponibles = useMemo(() => disponiblesDe(existencias, compromisos), [existencias, compromisos]);
  const ciclo = useMemo(() => cicloDe(solicitudes, CLIENTE_PORTAL.id), [solicitudes]);
  const saldos = useMemo(() => saldosDe(abonos), [abonos]);
  const consignaciones = useMemo(() => consignacionesDe(solicitudes), [solicitudes]);

  /**
   * SOLICITUD MANUAL · el único caso en que Comercialización crea un pedido.
   *
   * El portal genera las solicitudes solo y la API resuelve el pago. Esta vía existe
   * para quien llega a la taquilla sin usar el portal: entonces el operador anota todo
   * — usuario, producto, canal, monto recibido, referencia y por qué se registró a mano —
   * y queda constancia de quién lo hizo. La regla de pago se aplica igual que si viniera
   * del portal: nadie decide a mano lo que una regla resuelve.
   */
  function crearSolicitudManual(d) {
    const u = usr(d.usuario);
    const cupo = puedeSolicitar(u, solicitudes, d.concepto, Number(d.cantidad || 1));
    if (!cupo.ok) return { ok: false, error: cupo.motivo };

    const canje = validarCanje(envasesDe(parqueEnvases, u.id), cpt(d.concepto).kg);
    if (cpt(d.concepto).bombona && !canje.ok) return { ok: false, error: canje.motivo };

    const m = montos(d.concepto, Number(d.cantidad || 1), u.id, HOY);
    const referencia = String(d.referencia || "").trim();
    const recibido = Number(d.montoRecibido || m.total);
    const referenciasVistas = new Set(solicitudes.map((s) => s.pago?.referencia).filter(Boolean));
    const res = aplicarReglaPago({ montoRecibido: recibido, totalFacturado: m.total, referencia, referenciasVistas });

    seq.current.sol += 1; seq.current.ped += 7;
    const id = `SOL-${seq.current.sol}`;
    const nueva = {
      id, pedidoNro: seq.current.ped, usuario: u.id, cdt: d.cdt || u.cdt, comuna: u.comuna,
      concepto: d.concepto, cantidad: Number(d.cantidad || 1), tipoDespacho: d.tipoDespacho || "COMERCIAL",
      condicionVenta: u.condicionVenta || "CONTADO",
      fecha: HOY, entrega: sumarDias(HOY, 3), ventana: d.canal === "TAQUILLA" ? "Retiro en taquilla" : "Jornada comunal",
      nota: d.observacion || "", jornadaComunal: null,
      modalidadEntrega: d.canal === "TAQUILLA" ? "DIRECTA_COMERCIAL" : "COMUNA",
      estado: res.estadoSolicitud,
      motivoNoCompra: res.regla === "MONTO_MENOR" ? reglaPago(res.regla).nombre : undefined,
      operador: null, unidad: null, transportistaTipo: null, epsdc: null,
      ad: null, boleta: null, factura: null, serie: null, control: null,
      ...m,
      origenRegistro: "MANUAL",
      registro: {
        por: d.operador || "Comercialización", en: HOY,
        motivo: d.motivoRegistro, canal: d.canal,
        observacion: d.observacion || null,
      },
      pago: {
        banco: d.banco || null, referencia: referencia || null, fecha: HOY,
        estado: res.estadoPago, auto: false, canal: d.canal, montoRecibido: recibido,
        regla: res.regla, detalleRegla: res.detalle, resueltoEn: HOY,
      },
    };
    setSolicitudes((p) => [nueva, ...p]);

    if (res.abono) {
      setAbonos((p) => [nuevoAbono(u.id, res.abono.tipo, res.abono.monto, referencia || id,
        `${reglaPago(res.regla).nombre} · ${res.detalle}`, { solicitud: id, banco: d.banco, automatico: true }), ...p]);
    }
    return { ok: true, solicitud: nueva, regla: res.regla, detalle: res.detalle, abono: res.abono?.monto || 0 };
  }

  /**
   * Revertir una resolución automática cuando el usuario reclama y tiene razón.
   *
   * Sólo aplica a los dos casos en que la regla le negó el gas: transfirió de menos y
   * referencia duplicada. Si esa solicitud había generado un abono, ese abono se anula
   * en el mismo acto — de lo contrario la persona se quedaría con la bombona y con el
   * dinero acreditado. La reversión exige motivo y deja constancia de quién y cuándo.
   */
  function revertirResolucionPago(sol, nota, quien) {
    if (sol.pago?.estado !== "RECHAZADO") {
      return { ok: false, error: "Sólo se revierte una resolución que le negó el despacho al usuario." };
    }
    if (!String(nota || "").trim()) {
      return { ok: false, error: "La reversión requiere motivo: queda en la bitácora." };
    }
    const responsable = quien || "Comercialización";
    setSolicitudes((p) => p.map((s) => (s.id === sol.id ? {
      ...s, estado: "PAGADA", motivoNoCompra: undefined,
      pago: { ...s.pago, estado: "VERIFICADO", revertida: true, revertidaPor: responsable,
        revertidaEn: HOY, notaReversion: String(nota).trim() },
    } : s)));

    /* El abono que produjo la regla deja de estar disponible: ese dinero ya paga esta
       entrega. El monto se calcula sobre el estado actual y no dentro del actualizador,
       porque React ejecuta ese callback después de que esta función haya retornado. */
    const anulado = abonos
      .filter((a) => a.solicitud === sol.id && !a.anulado)
      .reduce((t, a) => t + Number(a.monto || 0), 0);
    setAbonos((p) => p.map((a) => (a.solicitud !== sol.id || a.anulado ? a : {
      ...a, anulado: true, anuladoPor: responsable, anuladoEn: HOY,
      detalleAnulacion: `Reversión de ${reglaPago(sol.pago.regla).nombre} · el saldo pasa a cubrir ${sol.id}`,
    })));
    return { ok: true, anulado };
  }

  /* esolverIncidenciaPago se retiro el 01/09/2026: las tres reglas de pago son
     deterministas y ahora las aplica plicarReglaPago al recibir el dinero.
     Comercializacion no aprueba lo que una regla ya decidio; solo puede revertir. */

  // Comunas sin jornada planificada: su gente no debe contar días de inactividad,
  // porque la falta de movimiento es imputable a la empresa y no al usuario.
  const comunasSinJornada = useMemo(() => {
    const conJornada = new Set(
      solicitudes.filter((s) => s.jornadaComunal && s.estado !== "CULMINADO").map((s) => s.comuna)
    );
    return new Set(COMUNAS.filter((c) => !conJornada.has(c.id)).map((c) => c.id));
  }, [solicitudes]);

  const padron = useMemo(
    () => USUARIOS.map((u) => ({ ...u, padron: estadoPadronDe(u, solicitudes, abonos, comunasSinJornada) })),
    [solicitudes, abonos, comunasSinJornada, padronV]
  );

  /* ─── Acciones compartidas ─── */

  // El usuario crea una solicitud. El pago se concilia automáticamente contra el banco.
  // El saldo a favor se devenga primero: si tiene abono, cubre parte del total y solo
  // transfiere la diferencia. Si transfiere de más, el excedente queda abonado a su código.
  function crearSolicitud(d) {
    const u = usr(CLIENTE_PORTAL.id);
    const m = montos(d.concepto, d.cantidad, u.id, HOY);
    const saldoPrevio = saldos[u.id] || 0;
    const reparto = aplicarSaldo(m.total, saldoPrevio);
    const transferido = d.montoTransferido != null ? Number(d.montoTransferido) : reparto.porPagar;
    const excedente = Number((transferido - reparto.porPagar).toFixed(2));

    seq.current.sol += 1; seq.current.ped += 7; seq.current.ref += 131;
    const id = `SOL-${seq.current.sol}`;
    const nueva = {
      id, pedidoNro: seq.current.ped, usuario: u.id, cdt: u.cdt, comuna: u.comuna,
      concepto: d.concepto, cantidad: Number(d.cantidad), tipoDespacho: "COMERCIAL",
      condicionVenta: u.condicionVenta || "CONTADO",
      fecha: HOY, entrega: sumarDias(HOY, 4), ventana: "Jornada comunal", nota: d.nota || "",
      jornadaComunal: "JC-BQTO-PROX", modalidadEntrega: "COMUNA",
      estado: "PAGADA", operador: null, unidad: null, transportistaTipo: null, epsdc: null,
      ad: null, boleta: null, factura: null, serie: null, control: null,
      ...m,
      saldoAplicado: reparto.devengado, montoTransferido: transferido,
      pago: { banco: d.banco, referencia: String(seq.current.ref), fecha: HOY, estado: "VERIFICADO", auto: true },
    };
    setSolicitudes((p) => [nueva, ...p]);

    const nuevos = [];
    if (reparto.devengado > 0) {
      nuevos.push(nuevoAbono(u.id, "CONSUMO", reparto.devengado, id,
        `Devengado en ${id} · ${cpt(d.concepto).corto}`, { solicitud: id }));
    }
    if (excedente > 0.009) {
      nuevos.push(nuevoAbono(u.id, "ABONO_EXCEDENTE", excedente, String(seq.current.ref),
        `Transfirió Bs ${transferido.toFixed(2)} sobre Bs ${reparto.porPagar.toFixed(2)} por pagar`,
        { banco: d.banco, solicitud: id }));
    }
    if (nuevos.length) setAbonos((p) => [...nuevos, ...p]);

    return { ...nueva, saldoPrevio, devengado: reparto.devengado, excedenteAbonado: Math.max(0, excedente) };
  }

  function nuevoAbono(usuario, tipo, monto, referencia, detalle, extra = {}) {
    seq.current.abo += 1;
    return {
      id: `ABO-${seq.current.abo}`, usuario, fecha: HOY, tipo,
      monto: Number(Number(monto).toFixed(2)), referencia, detalle, ...extra,
    };
  }

  /** Registra manualmente un movimiento en el libro de saldos a favor. */
  function registrarAbono(d) {
    const mov = nuevoAbono(d.usuario, d.tipo, d.monto, d.referencia || "—", d.detalle || "", d.extra || {});
    setAbonos((p) => [mov, ...p]);
    return mov;
  }

  /* registrarNoCompra se retiró el 01/09/2026.
     Ofrecía motivos de entrega fallida sobre pedidos que nunca habían salido a ruta —
     «no se encontraba en el punto» de alguien a quien nadie fue a buscar— y siempre
     terminaba abonando, incluso cuando la falla era de la empresa y el pedido debía
     seguir vivo. Lo que ocurre en la calle lo marca el operador en `cerrarAD()`; lo que
     ocurre antes de despachar es `registrarIncidenciaPrevia()`, aquí abajo. */

  /**
   * INCIDENCIA SOBRE UNA SOLICITUD PAGADA QUE NO HA SALIDO A RUTA.
   *
   * Reemplaza al botón «No compró», que era incorrecto: hablaba de una entrega que nunca
   * se intentó y siempre terminaba abonando, incluso cuando el problema era de la empresa
   * y el pedido debía seguir vivo.
   *
   * Ahora la consecuencia la fija el motivo, no el operador:
   *   CIERRA   → la solicitud pasa a ABONADA, libera GLP y cupo, y el dinero va al saldo
   *   RETIENE  → el pedido sigue pendiente; queda la constancia y, si toca, se marca el padrón
   */
  function registrarIncidenciaPrevia(sol, motivoId, nota, quien) {
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    if (!actual || actual.estado === "CULMINADO" || actual.estado === ESTADO_ABONADA) {
      return { ok: false, error: "La solicitud ya está cerrada." };
    }
    if (actual.estado === "EN_AD") {
      return { ok: false, error: "Ya está en distribución: la incidencia la registra el operador en la jornada." };
    }
    const m = incidenciaPrevia(motivoId);
    const responsable = String(quien || "").trim() || "Comercialización";
    const registro = {
      motivo: m.id, nombre: m.nombre, consecuencia: m.consecuencia,
      nota: String(nota || "").trim() || null, por: responsable, en: HOY,
    };

    if (m.consecuencia === "RETIENE") {
      setSolicitudes((p) => p.map((s) => (s.id === actual.id
        ? { ...s, incidencia: registro, retenidaDesde: s.retenidaDesde || HOY,
            requiereVerificacionPadron: Boolean(m.marcaPadron) || s.requiereVerificacionPadron }
        : s)));
      return { ok: true, cierra: false, motivo: m, monto: 0 };
    }

    const monto = Number(actual.total || 0);
    setSolicitudes((p) => p.map((s) => (s.id === actual.id
      ? { ...s, estado: ESTADO_ABONADA, motivoNoCompra: m.nombre, motivoId: m.id,
          incidencia: registro, fechaAbono: HOY, abonadoBs: monto,
          requiereVerificacionPadron: Boolean(m.marcaPadron) || s.requiereVerificacionPadron }
      : s)));
    setAbonos((p) => [nuevoAbono(actual.usuario, "ABONO_NO_COMPRA", monto, actual.id,
      `${m.nombre}${registro.nota ? ` · ${registro.nota}` : ""}`,
      { solicitud: actual.id, cdt: actual.cdt, registradoPor: responsable }), ...p]);
    return { ok: true, cierra: true, motivo: m, monto };
  }

  /* El reintegro en efectivo se retiró el 01/09/2026. La empresa no reembolsa: todo dinero
     que entra queda abonado al código del usuario y sólo se descarga contra un despacho
     posterior. El saldo tiene una sola salida — `aplicarSaldo()` al facturar — y por eso
     TIPOS_ABONO ya no contiene ningún movimiento que devuelva dinero. */

  // El operador abre el AD sobre una solicitud ya pagada.
  function abrirAD(sol, asignacion = {}) {
    seq.current.ad += 1;
    const id = `AD-${seq.current.ad}`;
    const transportistaTipo = asignacion.transportistaTipo || "GASLARA";
    setSolicitudes((p) => p.map((s) => (s.id === sol.id
      ? {
          ...s, estado: "EN_AD", ad: id,
          operador: asignacion.operador || "L. Torrealba",
          unidad: asignacion.unidad || "Placa A54BC7K",
          transportistaTipo,
          epsdc: transportistaTipo === "EPSDC" ? (asignacion.epsdc || "EPSDC-01") : null,
        } : s)));
    return id;
  }

  // Cuadre automático previo al cierre: sustituye un verificador obligatorio.
  function validarCierre(sol, cantidadEntregada = null) {
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    const c = cpt(actual.concepto), td = tpd(actual.tipoDespacho);
    const qty = Number(cantidadEntregada ?? actual.cantidad);
    const errores = [];
    if (actual.estado !== "EN_AD" || !actual.ad) errores.push("La solicitud debe estar asignada a un AD abierto.");
    if (td.requierePago && actual.pago?.estado !== "VERIFICADO") errores.push("El pago aún no está verificado.");
    if (!Number.isFinite(qty) || qty <= 0 || qty > Number(actual.cantidad)) errores.push("La cantidad entregada no es válida.");
    const kg = c.inv ? c.kg * qty : 0;
    if (c.inv && (existencias[actual.cdt] || 0) < kg) errores.push("No hay existencia física suficiente para cerrar esta entrega.");
    return { ok: errores.length === 0, errores, kg, qty, actual };
  }

  // La unidad entrega físicamente. Solo aquí se genera BOP, salida de inventario y factura.
  // Si la recepción es parcial, el remanente conserva el pago y vuelve a la cola pendiente.
  function entregar(sol, datos) {
    const v = validarCierre(sol, datos.cantidadEntregada);
    if (!v.ok) return { ok: false, errores: v.errores };

    const actual = v.actual, c = cpt(actual.concepto), td = tpd(actual.tipoDespacho);
    const qty = v.qty, restante = Number(actual.cantidad) - qty;
    seq.current.bop += 1;
    const bopId = `BOP-${String(seq.current.bop).padStart(4, "0")}`;
    let serie = null, control = null;
    if (td.factura) {
      seq.current.serie += 1;
      serie = `U-${String(seq.current.serie).padStart(8, "0")}`;
      control = `01-${actual.pedidoNro}`;
    }
    const montoEntregado = montos(actual.concepto, qty, actual.usuario, actual.fecha);

    // Regla de la Gerencia: lo que no se entregó NO vuelve a la cola de despacho.
    // Se factura únicamente lo entregado y el valor de lo no entregado se abona al
    // código del usuario, quedando disponible para una compra futura.
    let abonoParcial = null;
    if (restante > 0) {
      const valorNoEntregado = montos(actual.concepto, restante, actual.usuario, actual.fecha).total;
      abonoParcial = nuevoAbono(actual.usuario, "ABONO_DEVOLUCION", valorNoEntregado, actual.ad || actual.id,
        `${restante} ${cpt(actual.concepto).unidad}(s) no entregada(s) de ${actual.id}`,
        { ad: actual.ad || null, solicitud: actual.id, cdt: actual.cdt });
    }

    setSolicitudes((p) => p.map((s) => (s.id === actual.id ? {
      ...s, cantidad: qty, ...montoEntregado,
      estado: "CULMINADO", boleta: bopId, serie, control, factura: serie, entrega: HOY,
      firma: datos.firma, receptor: datos.receptor, obsEntrega: datos.obs, horaEntrega: datos.hora,
      entregaParcial: restante > 0, cantidadOriginal: Number(actual.cantidad),
      cantidadNoEntregada: restante, abonoGenerado: abonoParcial?.monto || 0,
    } : s)));

    if (abonoParcial) setAbonos((p) => [abonoParcial, ...p]);

    return {
      ok: true, bopId, serie, control, kg: v.kg, factura: td.factura,
      total: montoEntregado.total, transportistaTipo: actual.transportistaTipo || "GASLARA",
      epsdc: actual.epsdc || null, cantidadEntregada: qty, pendienteCantidad: restante,
      parcial: restante > 0, abonado: abonoParcial?.monto || 0, abonoId: abonoParcial?.id || null,
    };
  }


  /**
   * CIERRE DEL AD · el punto donde ocurre la venta.
   *
   * Recibe el resultado de la jornada persona por persona y produce, en un solo acto,
   * todo lo que la Gerencia definió que debe ocurrir al despachar:
   *
   *   Entregada       → factura con el precio del DÍA DEL DESPACHO + BOP + salida de
   *                     inventario + canje de envase (el vacío entra, el lleno sale)
   *   No entregada    → según el motivo tipificado: abono al código del usuario, o
   *                     reposición física sin abono si el cilindro salió defectuoso
   *   Consignación    → lo entregado a la comuna queda bajo su custodia hasta que la
   *                     reparta; la comuna responde ante la empresa por lo que no entregue
   *
   * @param resultados [{ solicitudId, entregada, motivo, envaseRecibido, observacion }]
   */
  function cerrarAD(ruta, resultados = [], recepcion = {}) {
    const porId = new Map(resultados.map((r) => [r.solicitudId, r]));
    const afectadas = solicitudes.filter((s) => porId.has(s.id));
    if (!afectadas.length) return { ok: false, error: "No hay pedidos que cerrar en esta AD." };

    const nuevosAbonos = [];
    const cambiosEnvase = [];
    let entregadas = 0, noEntregadas = 0, reposiciones = 0, kgSalida = 0, facturado = 0;

    const actualizadas = afectadas.map((s) => {
      const r = porId.get(s.id);
      const c = cpt(s.concepto);

      if (r.entregada) {
        // El precio que manda es el del despacho, no el del pedido.
        const m = montos(s.concepto, s.cantidad, s.usuario, HOY);
        seq.current.bop += 1;
        const bopId = `BOP-${String(seq.current.bop).padStart(4, "0")}`;
        seq.current.serie += 1;
        const serie = `U-${String(seq.current.serie).padStart(8, "0")}`;
        entregadas += 1;
        kgSalida += kgDeSolicitud(s);
        facturado += m.total;

        // Canje de envase: el vacío entra a planta, el lleno queda con el usuario.
        if (r.envaseRecibido) {
          cambiosEnvase.push({ usuario: s.usuario, kg: c.kg, estado: "EN_PLANTA_VACIO", motivo: "Recibido en canje" });
        }

        return {
          ...s, estado: "CULMINADO", boleta: bopId, serie, control: `01-${s.pedidoNro}`,
          factura: serie, entrega: HOY, ...m,
          precioPedido: s.precioUnitario ?? null, precioFacturado: m.precioUnitario,
          receptor: recepcion.receptor || null, firma: recepcion.firma || null,
          horaEntrega: recepcion.hora || null, envaseCanjeado: Boolean(r.envaseRecibido),
          obsEntrega: r.observacion || null,
          consignatario: s.modalidadEntrega === "COMUNA" ? s.comuna : null,
          estadoRetiroComuna: s.modalidadEntrega === "COMUNA" ? "PENDIENTE" : null,
        };
      }

      const mot = motivoNoEntrega(r.motivo);
      noEntregadas += 1;

      /* La bombona se recogió y no se pudo llenar: vuelve vacía y su envase entra a
         taller. No hay reposición en el momento, así que la persona queda con el dinero
         abonado igual que en los demás motivos. */
      if (mot.envaseATaller) {
        reposiciones += 1;
        cambiosEnvase.push({ usuario: s.usuario, kg: c.kg, estado: "EN_TALLER",
          motivo: "Recogida y no admitió llenado · entra a taller" });
      }

      // Todos los motivos liberan el GLP y abonan el dinero al código.
      const monto = Number(s.total || 0);
      if (monto > 0) {
        nuevosAbonos.push(nuevoAbono(s.usuario, "ABONO_NO_COMPRA", monto, String(ruta.ad || s.id),
          `${mot.nombre}${r.observacion ? ` · ${r.observacion}` : ""}`,
          { ad: String(ruta.ad || ""), solicitud: s.id, cdt: s.cdt }));
      }
      return {
        ...s, estado: ESTADO_ABONADA, motivoNoCompra: mot.nombre, motivoId: mot.id,
        fechaAbono: HOY, abonadoBs: monto, obsEntrega: r.observacion || null,
        requiereVerificacionPadron: Boolean(mot.marcaPadron),
      };
    });

    const mapa = new Map(actualizadas.map((s) => [s.id, s]));
    setSolicitudes((p) => p.map((s) => mapa.get(s.id) || s));
    if (nuevosAbonos.length) setAbonos((p) => [...nuevosAbonos, ...p]);

    if (cambiosEnvase.length) {
      setParqueEnvases((p) => p.map((e) => {
        const cambio = cambiosEnvase.find((c) => c.usuario === e.usuario && c.kg === e.kg);
        return cambio ? { ...e, estado: cambio.estado, motivo: cambio.motivo, desde: HOY } : e;
      }));
    }

    // El retorno de envases vacíos y la salida de cilindros quedan asentados en planta.
    if (entregadas > 0) {
      seq.current.mp += 1;
      const canjeados = cambiosEnvase.filter((c) => c.estado === "EN_PLANTA_VACIO").length;
      setMovPlanta((p) => [{
        id: `MP-${seq.current.mp}`, fecha: HOY, hora: recepcion.hora || "—", tipo: "ENTRADA_VACIOS",
        cdt: afectadas[0].cdt, documento: `CMP-${ruta.ad}-V`, contraparte: `Canje AD ${ruta.ad} · ${ruta.comunidad || ""}`,
        cilindros: null, kg: 0, litros: 0, vehiculo: ruta.unidad || "—",
        operador: ruta.conductor || "—", cedula: ruta.conductorCedula || "—",
        nota: `${canjeados} envases vacíos recibidos en canje`, estado: "CONFIRMADA",
      }, ...p]);
    }

    actualizarRutaDistribucion(ruta.id, {
      estadoRuta: noEntregadas > 0 ? "PARCIAL" : "ENTREGADA",
      cierreDetalle: { entregadas, noEntregadas, reposiciones, kgSalida, facturado },
      recepcion, horaEntrega: recepcion.hora || null, cerradaEn: HOY,
    });

    return { ok: true, entregadas, noEntregadas, reposiciones, kgSalida, facturado, abonos: nuevosAbonos.length };
  }

  function crearManual(d) {
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
  }

  /**
   * Venta sin contrato contra un código genérico.
   * Usa inventario, genera ingreso y entra al libro de ventas como cualquier otra venta.
   * Se exige identificación del comprador aunque no tenga código de usuario.
   */
  function crearVentaGenerica(d) {
    const g = codigoGenerico(d.codigoGenerico);
    if (!g) return { ok: false, error: "Código genérico no válido." };
    const cantidad = Number(d.cantidad || 1);
    const m = montos(g.concepto, cantidad, g.id, HOY);
    const n = manuales.length;
    const tal = `GEN-${g.cdt.replace("CDT-", "")}-${4200 + n}`;
    /* La venta sin contrato también genera su boleta: es una salida física de GLP del
       CDT y debe dejar el mismo rastro que un despacho de ruta. Sin ella, el inventario
       se movía por una factura huérfana y el control documental no cuadraba. */
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
      pago: { banco: d.banco || "BDV", referencia: d.referencia || `77${6000 + n * 11}`, estado: "VERIFICADO", auto: false },
    };
    setManuales((p) => [factura, ...p]);
    return { ok: true, factura };
  }

  /** Registro del operador de planta: entradas y salidas de cilindros y gandolas. */
  function crearMovimientoPlanta(d) {
    seq.current.mp += 1;
    const t = tipoMovPlanta(d.tipo);
    const kg = t.medio === "GANDOLA" ? Number(d.kg || 0) : Number(d.kg || 0);
    const mov = {
      id: `MP-${seq.current.mp}`, fecha: HOY, hora: d.hora || "—", tipo: d.tipo, cdt: d.cdt,
      documento: d.documento || `CMP-${seq.current.mp}`, contraparte: d.contraparte || "—",
      cilindros: d.cilindros || null, kg, litros: kgALitros(kg),
      vehiculo: d.vehiculo || "—", operador: d.operador || "—", cedula: d.cedula || "—",
      nota: d.nota || "", estado: d.estado || "CONFIRMADA",
    };
    setMovPlanta((p) => [mov, ...p]);
    return mov;
  }

  /**
   * Edición del padrón con bitácora. Los campos de identidad (código, cédula, RIF)
   * no se editan libremente: se corrigen por expediente, fuera de esta vía.
   */
  function actualizarUsuario(id, cambios, autor = "Comercialización") {
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Usuario no encontrado." };
    const protegidos = ["id", "doc", "contrato"];
    const bitacora = [];
    Object.entries(cambios).forEach(([k, v]) => {
      if (protegidos.includes(k)) return;
      if (u[k] === v) return;
      bitacora.push({ campo: k, antes: u[k] ?? null, despues: v ?? null, fecha: HOY, autor });
      u[k] = v;
    });
    if (bitacora.length) {
      u.bitacora = [...bitacora, ...(u.bitacora || [])];
      setPadronV((n) => n + 1);
    }
    return { ok: true, cambios: bitacora };
  }

  /**
   * ALTA DE USUARIO · el paso que faltaba.
   *
   * La Gerencia lo pidió en dos tiempos y así está construido: primero se registra la
   * información base —quién es, dónde vive, a qué comuna pertenece— y el usuario nace
   * CONTADO y REGULAR, que es lo ordinario. La condición de pago y la condición
   * tarifaria se activan **después**, desde su ficha, porque exonerar o dar crédito no
   * es un dato de registro sino una decisión que necesita respaldo.
   *
   * El código y el contrato los asigna el sistema: si los teclea una persona, tarde o
   * temprano hay dos usuarios con el mismo número.
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
      // Nace en lo ordinario. Lo especial se activa después, con su aval.
      condicionVenta: "CONTADO", condicionTarifa: "REGULAR",
      desde: HOY, portal: false,
      altaPor: autor, altaEn: HOY,
      bitacora: [{ campo: "alta", antes: null, despues: `Registrado por ${autor}`, fecha: HOY, autor }],
    };
    USUARIOS.push(nuevo);
    setPadronV((n) => n + 1);
    return { ok: true, usuario: nuevo };
  }

  /**
   * CULMINAR UN SERVICIO ATENDIDO EN O.A.U.
   *
   * Una visita técnica, un cambio de válvula o una reparación no salen en una gandola:
   * no entran a un AD y por eso no tenían forma de cerrarse. El pedido quedaba pagado
   * para siempre, y si el técnico hacía el trabajo el sistema solo sabía cancelarlo.
   *
   * Esto dispara la misma cadena contable que el cierre del AD —boleta, factura, libro
   * de ventas— sin exigir ruta, porque aquí no hay ruta que exigir. Lo que sí exige es
   * constancia de quién atendió y cuándo, que es el soporte del servicio prestado.
   *
   * Los conceptos con inventario no pasan por aquí: un cilindro se entrega despachando,
   * no declarando que se entregó.
   */
  function culminarServicio(sol, d = {}) {
    const actual = solicitudes.find((x) => x.id === sol.id) || sol;
    const c = cpt(actual.concepto);
    if (c.inv) {
      return { ok: false, error: "Este concepto mueve inventario: se cierra despachando en un AD, no desde aquí." };
    }
    if (actual.estado === "CULMINADO") return { ok: false, error: "El servicio ya está culminado." };
    if (actual.pago?.estado !== "VERIFICADO") {
      return { ok: false, error: "Solo se culmina un servicio con el pago verificado." };
    }
    if (!String(d.atendio || "").trim()) return { ok: false, error: "Indique quién prestó el servicio." };

    const td = tpd(actual.tipoDespacho);
    // El precio que manda es el del día en que se prestó, igual que en el despacho.
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
      ...s, estado: "CULMINADO", boleta: bopId, serie, control, factura: serie,
      entrega: HOY, ...m,
      servicio: {
        atendio: String(d.atendio).trim(), en: HOY,
        canal: d.canal || "O.A.U.",
        informe: String(d.informe || "").trim() || null,
        receptor: String(d.receptor || "").trim() || null,
      },
      obsEntrega: d.informe || null,
    } : s)));
    return { ok: true, boleta: bopId, serie, control, total: m.total, factura: td.factura };
  }

  /** Definir a mano el estado del padrón, o devolverlo al automatismo de 180 días. */
  function definirEstadoUsuario(id, motivoId, nota, autor = "Comercialización") {
    const u = USUARIOS.find((x) => x.id === id);
    if (!u) return { ok: false, error: "Usuario no encontrado." };
    if (!motivoId) {
      // Volver al reloj: se borra la decisión y el estado se recalcula solo.
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
    u.bitacora = [{ campo: "estado", antes: u.padron?.estado ?? null,
      despues: `${m.estado} · ${m.nombre}`, fecha: HOY, autor }, ...(u.bitacora || [])];
    setPadronV((n) => n + 1);
    return { ok: true, estado: m.estado, motivo: m };
  }

  function crearReclamo(d) {
    seq.current.rec += 1;
    const id = `REC-${String(seq.current.rec).padStart(4, "0")}`;
    setReclamos((r) => [{
      id, usuario: CLIENTE_PORTAL.id, fecha: HOY, asunto: d.asunto, tipo: d.tipo,
      estado: "RECIBIDO", prioridad: d.prioridad || "MEDIA", detalle: d.detalle,
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

  function actualizarRutaDistribucion(id, cambios) {
    setRutasDistribucion((rs) => rs.map((r) => r.id === id ? { ...r, ...cambios } : r));
  }

  // La comuna registra la última milla: recibido por GasLara no significa retirado por el ciudadano.
  // En el prototipo este cambio queda compartido para que el Portal del usuario lo refleje al navegar.
  function registrarRetiroComuna(usuarioId, estado, detalle = {}) {
    setSolicitudes((prev) => {
      const candidatas = prev.filter((s) => s.usuario === usuarioId && s.estado === "CULMINADO");
      if (!candidatas.length) return prev;
      const target = [...candidatas].sort((a,b)=>(b.entrega||b.fecha||0)-(a.entrega||a.fecha||0))[0];
      return prev.map((s) => s.id === target.id ? {
        ...s, estadoRetiroComuna: estado, retiradoPorUsuario: estado === "RETIRADA",
        fechaRetiroComuna: estado === "RETIRADA" ? HOY : s.fechaRetiroComuna || null,
        observacionRetiroComuna: detalle.observacion || null,
      } : s);
    });
  }

  // AD personalizada: Distribución puede agrupar cualquier conjunto de pedidos SIN AD.
  // Los pedidos se retiran de su cola/comunidad de origen y pasan a una ruta sintética compartida
  // por Distribución, Operaciones y Comercialización.
  function crearRutaDistribucionPersonalizada(nuevaRuta, pedidosSeleccionados = []) {
    const porRuta = new Map();
    pedidosSeleccionados.forEach((p) => {
      if (!p.rutaId) return;
      if (!porRuta.has(p.rutaId)) porRuta.set(p.rutaId, []);
      porRuta.get(p.rutaId).push(p);
    });
    setRutasDistribucion((rs) => {
      const actualizadas = rs.map((r) => {
        const movidos = porRuta.get(r.id) || [];
        if (!movidos.length) return r;
        const ids = [...new Set([...(r.customAssignedPedidoIds || []), ...movidos.map((p) => p.id)])];
        let cilindros = { ...r.cilindros };
        // En una comunidad todavía sin planificar, los pedidos pagados formaban parte de la carga
        // potencial. Al moverlos a una AD personalizada se descuentan de esa carga pendiente.
        if (r.estadoRuta === "SIN_PLANIFICAR") {
          movidos.filter((p) => p.pagado).forEach((p) => {
            const k = Number(p.kg || 0), q = Number(p.cantidad || 1);
            if (cilindros[k] != null) cilindros[k] = Math.max(0, Number(cilindros[k] || 0) - q);
          });
        }
        return { ...r, cilindros, customAssignedPedidoIds: ids };
      });
      return [nuevaRuta, ...actualizadas];
    });
  }

  const compartido = {
    solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles, ciclo,
    abonos, saldos, movPlanta, padron, padronV, parqueEnvases, consignaciones, cerrarAD,
    crearSolicitudManual, revertirResolucionPago,
    periodoCerrado, setPeriodoCerrado, rutasDistribucion, actualizarRutaDistribucion, crearRutaDistribucionPersonalizada, registrarRetiroComuna,
    crearSolicitud, abrirAD, validarCierre, entregar, crearManual,
    crearReclamo, responderReclamo, tomarReclamo,
    registrarAbono, registrarIncidenciaPrevia, culminarServicio,
    crearVentaGenerica, crearMovimientoPlanta, actualizarUsuario, crearUsuario, definirEstadoUsuario,
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
          <button className={cara === "nomina" ? "on" : ""} onClick={() => setCara("nomina")}>
            <Calculator size={14} /> Nómina
          </button>
        </div>
        <div className="sw-hint">
          {cara === "proyecto" ? "Resumen del proyecto · problemas, solución y accesos"
            : cara === "gestion" ? "Dashboard ejecutivo · reportes · auditoría · roles"
            : cara === "admin" ? "Viendo como operador de comercialización"
            : cara === "nomina" ? "Backoffice interno · Departamento de Nómina · trabajadores sin acceso"
            : cara === "distribucion" ? "Backoffice logístico · planificación, AD, rutas, unidades y conductores"
            : `Viendo como ${CLIENTE_PORTAL.nombre.split(" ").slice(0, 2).join(" ")} · contrato ${CLIENTE_PORTAL.contrato}`}
        </div>
      </div>
      <div className="cara">
        {cara === "proyecto" && <Proyecto onNavigate={setCara} solicitudes={solicitudes} existencias={existencias} compromisos={compromisos} disponibles={disponibles} rutasDistribucion={rutasDistribucion} />}
        {cara === "gestion" && <CentroGestion {...compartido} />}
        {cara === "portal" && <PortalUsuario {...compartido} />}
        {cara === "distribucion" && <Distribucion {...compartido} />}
        {cara === "admin" && <Comercializacion {...compartido} />}
        {cara === "nomina" && <Nomina />}
      </div>
      {/* Va al final a propósito: los estilos de cada módulo se inyectan al montarse,
          y la capa de diseño debe quedar después para imponerse sin usar !important. */}
      <Tema />
    </>
  );
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
