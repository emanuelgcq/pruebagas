import React, { useState, useRef, useMemo } from "react";
import { Users, Building2, Smartphone, Truck, Calculator } from "lucide-react";
import {
  CLIENTE_PORTAL, COMUNA_PORTAL, HOY, cpt, tpd, usr, montos, generarEstadoInicial,
  boletasDe, facturasDe, movimientosDe, existenciasDe, compromisosDe, disponiblesDe,
  cicloDe, sumarDias, kgDeSolicitud,
} from "./datos.jsx";
import PortalUsuario from "./PortalUsuario.jsx";
import PortalComuna from "./PortalComuna.jsx";
import Comercializacion from "./Comercializacion.jsx";
import AppMovil from "./AppMovil.jsx";
import AppOperaciones from "./AppOperaciones.jsx";
import Proyecto from "./Proyecto.jsx";
import Nomina from "./Nomina.jsx";

const INICIAL = generarEstadoInicial();

export default function App() {
  const [cara, setCara] = useState("proyecto");
  const [solicitudes, setSolicitudes] = useState(INICIAL.solicitudes);
  const [manuales, setManuales] = useState(INICIAL.manuales);
  const [reclamos, setReclamos] = useState(INICIAL.reclamos);
  const [periodoCerrado, setPeriodoCerrado] = useState(false);
  const seq = useRef({ ...INICIAL.seq });

  const boletas = useMemo(() => boletasDe(solicitudes), [solicitudes]);
  const facturas = useMemo(() => facturasDe(solicitudes, manuales), [solicitudes, manuales]);
  const movs = useMemo(() => movimientosDe(solicitudes, manuales), [solicitudes, manuales]);
  const existencias = useMemo(() => existenciasDe(movs), [movs]);
  const compromisos = useMemo(() => compromisosDe(solicitudes), [solicitudes]);
  const disponibles = useMemo(() => disponiblesDe(existencias, compromisos), [existencias, compromisos]);
  const ciclo = useMemo(() => cicloDe(solicitudes, CLIENTE_PORTAL.id), [solicitudes]);

  /* ─── Acciones compartidas ─── */

  // El usuario crea una solicitud. El pago se concilia automáticamente contra el banco.
  function crearSolicitud(d) {
    const u = usr(CLIENTE_PORTAL.id);
    const m = montos(d.concepto, d.cantidad, u.id);
    seq.current.sol += 1; seq.current.ped += 7; seq.current.ref += 131;
    const nueva = {
      id: `SOL-${seq.current.sol}`, pedidoNro: seq.current.ped, usuario: u.id, cdt: u.cdt, comuna: u.comuna,
      concepto: d.concepto, cantidad: Number(d.cantidad), tipoDespacho: "COMERCIAL",
      condicionVenta: u.condicionVenta || "CONTADO",
      fecha: HOY, entrega: sumarDias(HOY, 4), ventana: "Jornada comunal", nota: d.nota || "",
      jornadaComunal: "JC-BQTO-PROX", modalidadEntrega: "COMUNA",
      estado: "PAGADA", operador: null, unidad: null, transportistaTipo: null, epsdc: null,
      ad: null, boleta: null, factura: null, serie: null, control: null,
      ...m,
      pago: { banco: d.banco, referencia: String(seq.current.ref), fecha: HOY, estado: "VERIFICADO", auto: true },
    };
    setSolicitudes((p) => [nueva, ...p]);
    return nueva;
  }

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
    const montoEntregado = montos(actual.concepto, qty, actual.usuario);
    let remanente = null;
    if (restante > 0) {
      seq.current.sol += 1; seq.current.ped += 7;
      remanente = {
        ...actual,
        id: `SOL-${seq.current.sol}`, pedidoNro: seq.current.ped,
        cantidad: restante, ...montos(actual.concepto, restante, actual.usuario),
        fecha: actual.fecha, entrega: actual.entrega || sumarDias(HOY, 4), estado: "PAGADA",
        ad: null, boleta: null, factura: null, serie: null, control: null,
        operador: null, unidad: null, transportistaTipo: null, epsdc: null,
        firma: null, receptor: null, obsEntrega: null, horaEntrega: null,
        origenParcial: actual.id,
        nota: `${actual.nota || ""}${actual.nota ? " · " : ""}Saldo pagado pendiente por entrega parcial`,
        pago: { ...actual.pago, saldoPendiente: true, origenSolicitud: actual.id },
      };
    }

    setSolicitudes((p) => {
      const cerradas = p.map((s) => (s.id === actual.id ? {
        ...s, cantidad: qty, ...montoEntregado,
        estado: "CULMINADO", boleta: bopId, serie, control, factura: serie, entrega: HOY,
        firma: datos.firma, receptor: datos.receptor, obsEntrega: datos.obs, horaEntrega: datos.hora,
        entregaParcial: restante > 0, cantidadOriginal: Number(actual.cantidad),
      } : s));
      return remanente ? [remanente, ...cerradas] : cerradas;
    });

    return {
      ok: true, bopId, serie, control, kg: v.kg, factura: td.factura,
      total: montoEntregado.total, transportistaTipo: actual.transportistaTipo || "GASLARA",
      epsdc: actual.epsdc || null, cantidadEntregada: qty, pendienteCantidad: restante,
      parcial: restante > 0, remanenteId: remanente?.id || null,
    };
  }


  function crearManual(d) {
    const m = montos(d.concepto, Number(d.cantidad), d.usuario);
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

  const compartido = {
    solicitudes, manuales, reclamos, boletas, facturas, movs, existencias, compromisos, disponibles, ciclo,
    periodoCerrado, setPeriodoCerrado,
    crearSolicitud, abrirAD, validarCierre, entregar, crearManual,
    crearReclamo, responderReclamo, tomarReclamo,
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
          <button className={cara === "portal" ? "on" : ""} onClick={() => setCara("portal")}>
            <Users size={14} /> Portal del usuario
          </button>
          <button className={cara === "comuna" ? "on" : ""} onClick={() => setCara("comuna")}>
            <Users size={14} /> Portal comuna
          </button>
          <button className={cara === "movil" ? "on" : ""} onClick={() => setCara("movil")}>
            <Smartphone size={14} /> App móvil
          </button>
          <button className={cara === "ops" ? "on" : ""} onClick={() => setCara("ops")}>
            <Truck size={14} /> Operaciones
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
            : cara === "admin" ? "Viendo como operador de comercialización"
            : cara === "nomina" ? "Backoffice interno · Departamento de Nómina · trabajadores sin acceso"
            : cara === "ops" ? "Viendo como unidad de despacho · L. Torrealba"
            : cara === "comuna" ? `Viendo como ${COMUNA_PORTAL.nombre} · rol comuna`
            : `Viendo como ${CLIENTE_PORTAL.nombre.split(" ").slice(0, 2).join(" ")} · contrato ${CLIENTE_PORTAL.contrato}`}
        </div>
      </div>
      <div className="cara">
        {cara === "proyecto" && <Proyecto onNavigate={setCara} solicitudes={solicitudes} existencias={existencias} compromisos={compromisos} disponibles={disponibles} />}
        {cara === "portal" && <PortalUsuario {...compartido} />}
        {cara === "comuna" && <PortalComuna {...compartido} />}
        {cara === "movil" && <AppMovil {...compartido} />}
        {cara === "ops" && <AppOperaciones {...compartido} />}
        {cara === "admin" && <Comercializacion {...compartido} />}
        {cara === "nomina" && <Nomina />}
      </div>
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
.sw-tabs{display:flex;gap:3px;background:#16221E;border-radius:9px;padding:3px}
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
