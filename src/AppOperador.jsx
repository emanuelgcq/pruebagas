import React, { useEffect, useMemo, useState } from "react";
import {
  Truck, Wallet, ChevronLeft, ChevronRight, MapPin, Search, Check, X, AlertTriangle, CheckCircle2, Clock3,
  Users, Factory, Container, LogOut, Banknote, CreditCard, Smartphone, ArrowLeftRight, ClipboardCheck, Home, Flag,
  Signal, Wifi, BatteryFull, Minus, Plus, Receipt, UserRound, ShieldCheck,
} from "lucide-react";
import {
  HOY, num, bs, fecha, cpt, usr, USUARIOS, BANCOS, CODIGOS_GENERICOS, TOPE_UNIDADES_GENERICO,
  motivosDelMomento, motivoNoEntrega, envasesDe, estadoEnvase, kgDeSolicitud, montos, puedeSolicitar, segmentoUsuario,
} from "./datos.jsx";
import {
  estadoAD, tipoAD, tipoADInfo, marcaDe, clientesDeAD, personasDeAD, adPlanificada, adCerrada,
  METODOS_COBRO_PM, cajaPlantaMovil,
} from "./flujo.js";
import { OPERADORES_DISTRIBUCION, ayudanteDistribucion } from "./distribucionSeed.js";
import { horaActual } from "./DistribucionCierreAD.jsx";

/* ════════════════════════════════════════════════════════════════
   APP MÓVIL DE LOS OPERADORES
   Dos trabajos que no se mezclan:
     · DESPACHO DE AD (verde) · prepago: aquí no se cobra nada. Sus AD, sus clientes (quién
       pagó y quién no), las incidencias por persona y su bombona, y al final DESPACHADO con
       sus cilindros. El AD lo cierra sólo Distribución.
     · VENTA EN PLANTA MÓVIL (azul) · cualquier operador vende gas en el sitio y cobra
       (efectivo, punto de venta, pago móvil o transferencia) con su caja del día. No es una
       jornada de llenado: es venta directa.
   ════════════════════════════════════════════════════════════════ */

const cant = (n, uno, varios) => `${num(n)} ${Number(n) === 1 ? uno : varios}`;
const cil = (arr) => arr.reduce((a, s) => a + Number(s.cantidad || 1), 0);
const ORDEN = { EN_RUTA: 0, EN_PLANTA: 1, EN_PUNTO: 2, INCIDENCIA: 3, ASIGNADA: 4, REPROGRAMADA: 5, CERRADA: 6 };
const PASOS = [["ASIGNADA", "Salida"], ["EN_RUTA", "Recolección"], ["EN_PLANTA", "Planta"], ["EN_PUNTO", "Punto"], ["DESPACHADO", "Despachado"], ["CERRADA", "Cerrada"]];
const METODO_UI = {
  EFECTIVO: { I: Banknote, color: "#0F9D58", fondo: "#E6F6EE" },
  PUNTO_VENTA: { I: CreditCard, color: "#3B5BDB", fondo: "#EAEFFD" },
  PAGO_MOVIL: { I: Smartphone, color: "#0B8FA3", fondo: "#E3F5F8" },
  TRANSFERENCIA: { I: ArrowLeftRight, color: "#7048E8", fondo: "#F0EBFD" },
};
const CILINDROS = [
  { kg: 10, color: "#1F9D63", nombre: "Bombona 10 kg", uso: "Hogar pequeño" },
  { kg: 18, color: "#2A6FDB", nombre: "Bombona 18 kg", uso: "Hogar" },
  { kg: 27, color: "#E8590C", nombre: "Bombona 27 kg", uso: "Comercio" },
  { kg: 43, color: "#495057", nombre: "Bombona 43 kg", uso: "Comercio e industria" },
];
// La caja del operador sale del CDT de su flota: fuerza propia en Jacinto Lara, EPSDC en Juan G. Iribarren.
const cdtDe = (op) => (op?.tipo === "EPSDC" ? "CDT-JGI" : "CDT-JL");
const cajaIdDe = (op) => `PMV-${op.id}-${HOY.toISOString().slice(0, 10)}`;
const ALTO = 868;

function pagoCliente(s) {
  if (s.estado === "POR_COMPLETAR") return { tono: "amb", txt: "Por completar", sub: "No recoger: le falta completar el pago" };
  if (s.estado === "SIN_PAGO" && s.pago?.estado === "RECHAZADO") return { tono: "roj", txt: "Pago rechazado", sub: "No recoger: su referencia no es válida" };
  if (s.estado === "SIN_PAGO") return { tono: "roj", txt: "No pagó", sub: "No recoger: no ha pagado" };
  return { tono: "ver", txt: "Pagó", sub: "Recoger su bombona" };
}
function envaseDe(parque, s) {
  const e = envasesDe(parque, s.usuario).find((x) => x.kg === cpt(s.concepto).kg);
  return e ? `${e.serial} · ${estadoEnvase(e.estado).nombre.toLowerCase()}` : "Sin bombona registrada";
}
const pasoDe = (r) => (estadoAD(r.estadoRuta).id === "EN_PUNTO" && r.jornada?.despacho ? "DESPACHADO" : estadoAD(r.estadoRuta).id);

/** El teléfono cabe siempre en la ventana: se escala entero, sin deformar la app. */
function useEscala() {
  const calc = () => (typeof window === "undefined" ? 1 : Math.max(0.55, Math.min(1, (window.innerHeight - 120) / ALTO)));
  const [k, setK] = useState(calc);
  useEffect(() => { const f = () => setK(calc()); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return k;
}

export default function AppOperador(props) {
  const { rutasDistribucion = [] } = props;
  const [opId, setOpId] = useState(null);
  const [seccion, setSeccion] = useState("inicio");
  const [toast, setToast] = useState(null);
  const k = useEscala();
  const op = OPERADORES_DISTRIBUCION.find((o) => o.id === opId) || null;
  const misAD = useMemo(() => rutasDistribucion.filter((r) => adPlanificada(r) && r.operadorId === opId)
    .sort((a, b) => (ORDEN[estadoAD(a.estadoRuta).id] ?? 9) - (ORDEN[estadoAD(b.estadoRuta).id] ?? 9) || String(a.ad).localeCompare(String(b.ad))), [rutasDistribucion, opId]);
  const avisar = (t) => { setToast(t); setTimeout(() => setToast(null), 3000); };
  const tema = seccion === "pm" ? "azu" : "ver";

  return (
    <div className="ope">
      <Estilos />
      <div className="ope-fondo" />
      <aside className="ope-lado">
        <span className="ope-eyebrow">GASLARA · APP MÓVIL DE OPERADORES</span>
        <h1>Dos trabajos distintos, un solo teléfono</h1>
        <p className="ope-intro">El operador lleva en la calle lo mismo que ve la oficina, al instante.</p>
        <div className="ope-feat ver"><span><Truck size={17} /></span><div><b>Despacho de AD</b><em>Prepago · no se cobra</em>
          <p>Sus AD con la ruta, quién pagó y quién no, las incidencias por persona y su bombona, y «Despachado» con los
            cilindros planificados, recogidos y entregados. El cierre lo hace Distribución.</p></div></div>
        <div className="ope-feat azu"><span><Wallet size={17} /></span><div><b>Venta en planta móvil</b><em>Venta directa · con cobro</em>
          <p>Cualquier operador vende gas en el sitio: elige el cilindro, el cliente y el método de pago, y cierra su
            caja del día.</p></div></div>
        <div className="ope-tip"><ShieldCheck size={14} /><span>Para probar el despacho: Julio César Silva tiene AD en recolección, en planta y
          despachada. La venta está disponible para todos.</span></div>
      </aside>

      <div className="ope-dispositivo" style={{ width: 412 * k, height: ALTO * k }}>
        <div className="ope-telefono" style={{ transform: `scale(${k})` }}>
          <i className="ope-boton b1" /><i className="ope-boton b2" /><i className="ope-boton b3" /><i className="ope-boton b4" />
          <div className={`ope-pantalla ${tema}`}>
            <div className="ope-isla" />
            <div className="ope-status"><b>{horaActual()}</b><span><Signal size={13} /><Wifi size={13} /><BatteryFull size={16} /></span></div>
            <div className="ope-app">
              {!op ? <Login rutas={rutasDistribucion} onEntrar={(id) => { setOpId(id); setSeccion("inicio"); }} />
                : seccion === "inicio" ? <Inicio {...props} op={op} misAD={misAD} ir={setSeccion} />
                : seccion === "ad" ? <ModuloAD {...props} op={op} misAD={misAD} avisar={avisar} />
                : <ModuloPM {...props} op={op} avisar={avisar} />}
            </div>
            {op && (
              <nav className="ope-nav">
                <button className={seccion === "inicio" ? "on" : ""} onClick={() => setSeccion("inicio")}><Home size={19} /><span>Inicio</span></button>
                <button className={seccion === "ad" ? "on ver" : ""} onClick={() => setSeccion("ad")}><Truck size={19} /><span>Despacho</span></button>
                <button className={seccion === "pm" ? "on azu" : ""} onClick={() => setSeccion("pm")}><Wallet size={19} /><span>Vender gas</span></button>
                <button onClick={() => setOpId(null)}><LogOut size={19} /><span>Salir</span></button>
              </nav>
            )}
            {toast && <div className="ope-toast"><CheckCircle2 size={15} />{toast}</div>}
            <div className="ope-home" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ENTRADA ── */
function Login({ rutas, onEntrar }) {
  const ops = OPERADORES_DISTRIBUCION.filter((o) => o.activo && !o.granel).map((o) => {
    const ads = rutas.filter((r) => adPlanificada(r) && r.operadorId === o.id);
    return { o, activas: ads.filter((r) => !adCerrada(r)).length, curso: ads.filter((r) => ["EN_RUTA", "EN_PLANTA", "EN_PUNTO"].includes(estadoAD(r.estadoRuta).id)).length };
  });
  return (
    <div className="op-scroll op-login">
      <div className="op-marca"><span><Truck size={20} /></span><div><b>GasLara</b><em>Operadores</em></div></div>
      <h2>¿Quién opera hoy?</h2>
      <p>{fecha(HOY)} · elige tu perfil</p>
      <div className="op-lista">{ops.map(({ o, activas, curso }) => (
        <button key={o.id} className="op-perfil" onClick={() => onEntrar(o.id)}>
          <i>{o.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</i>
          <div><b>{o.nombre}</b><span>{o.cedula} · {o.tipo === "EPSDC" ? `EPSDC ${o.epsdc === "UNION" ? "Unión" : "Cercado"}` : "Fuerza propia"}</span>
            <em>{activas ? cant(activas, "AD asignada", "AD asignadas") : "Sin AD asignadas"}{curso ? ` · ${curso} en curso` : ""}</em></div>
          <ChevronRight size={16} />
        </button>))}</div>
    </div>
  );
}

/* ── INICIO ── */
function Inicio({ op, misAD, ir, solicitudes = [], manuales = [] }) {
  const curso = misAD.filter((r) => ["EN_RUTA", "EN_PLANTA", "EN_PUNTO"].includes(estadoAD(r.estadoRuta).id) && !r.jornada?.despacho).length;
  const porSalir = misAD.filter((r) => ["ASIGNADA", "REPROGRAMADA"].includes(estadoAD(r.estadoRuta).id)).length;
  const esperan = misAD.filter((r) => pasoDe(r) === "DESPACHADO").length;
  const caja = cajaPlantaMovil(cajaIdDe(op), solicitudes, manuales);
  return (
    <div className="op-scroll">
      <div className="op-hola"><span>{fecha(HOY)}</span><h2>Hola, {op.nombre.split(" ")[0]}</h2></div>
      <button className="op-hero ver" onClick={() => ir("ad")}>
        <div className="op-hero-h"><span><Truck size={18} /></span><div><b>Despacho de AD</b><em>PREPAGO · AQUÍ NO SE COBRA</em></div><ChevronRight size={17} /></div>
        <div className="op-hero-n"><div><b>{curso}</b>en curso</div><div><b>{porSalir}</b>por salir</div><div><b>{esperan}</b>esperan cierre</div></div>
      </button>
      <button className="op-hero azu" onClick={() => ir("pm")}>
        <div className="op-hero-h"><span><Wallet size={18} /></span><div><b>Venta en planta móvil</b><em>VENTA DIRECTA · CON COBRO</em></div><ChevronRight size={17} /></div>
        <div className="op-hero-n"><div><b>{caja.ventas.length}</b>ventas hoy</div><div><b>{caja.cilindros}</b>cilindros</div><div><b>{bs(caja.total).split(",")[0]}</b>Bs cobrados</div></div>
      </button>
      <div className="op-nota"><AlertTriangle size={14} /><span>En una AD nadie paga en el punto: todo llegó pagado. Cobrar es sólo de la venta en planta móvil.</span></div>
    </div>
  );
}

/* ════════════════  DESPACHO DE AD  ════════════════ */
function ModuloAD(props) {
  const { misAD, op, solicitudes = [] } = props;
  const [sel, setSel] = useState(null);
  const r = misAD.find((x) => x.id === sel);
  if (r) return <DetalleAD {...props} r={r} volver={() => setSel(null)} />;
  const grupos = [
    ["En curso", misAD.filter((x) => ["EN_RUTA", "EN_PLANTA", "EN_PUNTO", "INCIDENCIA"].includes(estadoAD(x.estadoRuta).id) && pasoDe(x) !== "DESPACHADO")],
    ["Por salir", misAD.filter((x) => ["ASIGNADA", "REPROGRAMADA"].includes(estadoAD(x.estadoRuta).id))],
    ["Despachadas · esperan el cierre", misAD.filter((x) => pasoDe(x) === "DESPACHADO")],
    ["Cerradas por Distribución", misAD.filter(adCerrada).slice(0, 5)],
  ];
  return (
    <div className="op-scroll">
      <Cabecera tema="ver" titulo="Mis AD" sub="Despacho · prepago, sin cobro" />
      {!misAD.length && <div className="op-vacio">{op.nombre.split(" ")[0]}, no tienes AD asignadas hoy. Puedes vender gas desde «Vender gas».</div>}
      {grupos.filter(([, l]) => l.length).map(([t, l]) => (
        <div key={t}><div className="op-grupo">{t}</div>
          {l.map((x) => { const conv = adCerrada(x) ? personasDeAD(x, solicitudes) : clientesDeAD(x, solicitudes).convocadas; const d = pasoDe(x) === "DESPACHADO"; return (
            <button key={x.id} className="op-tarjeta" onClick={() => setSel(x.id)}>
              <div className="op-tarjeta-h"><b>AD {x.ad}</b><span className={`op-chip ${d || estadoAD(x.estadoRuta).id === "CERRADA" ? "ver" : ["EN_RUTA", "EN_PLANTA", "EN_PUNTO"].includes(estadoAD(x.estadoRuta).id) ? "act" : ""}`}>{d ? "Despachado" : estadoAD(x.estadoRuta).nombre}</span></div>
              <em>{x.comunidad}</em>
              <small><MapPin size={11} /> {tipoADInfo(x).nombre} · {cant(conv.length, "persona", "personas")} · {cant(cil(conv), "cilindro", "cilindros")}</small>
            </button>); })}
        </div>))}
    </div>
  );
}

function Cabecera({ tema, titulo, sub, volver }) {
  return <div className={`op-cab ${tema}`}>{volver && <button onClick={volver}><ChevronLeft size={18} /></button>}<div><b>{titulo}</b><span>{sub}</span></div></div>;
}

function DetalleAD({ r, volver, solicitudes = [], parqueEnvases = [], op, avisar, salidaAD, registrarRecoleccion, registrarLlenado, corregirIncidencias, marcarDespachado }) {
  const [tab, setTab] = useState("despacho");
  const [borrador, setBorrador] = useState({});
  const [hoja, setHoja] = useState(null);
  const [obsDespacho, setObsDespacho] = useState("");
  const [error, setError] = useState("");
  const e = estadoAD(r.estadoRuta).id;
  const paso = pasoDe(r);
  const { convocadas, fuera } = clientesDeAD(r, solicitudes);
  const personas = e === "CERRADA" ? personasDeAD(r, solicitudes) : convocadas;
  const por = `App móvil · ${op.nombre}`;
  const recogidas = personas.filter((s) => marcaDe(r, s.id).recogida !== false);
  const llenas = recogidas.filter((s) => marcaDe(r, s.id).llenada !== false);
  const hacer = (res, ok) => { if (!res?.ok) { setError(res?.error || "No se pudo registrar."); return false; } setError(""); avisar(ok); return true; };
  const modo = e === "EN_RUTA" ? "RECOLECCION" : e === "EN_PLANTA" ? "PLANTA" : e === "EN_PUNTO" && !r.jornada?.despacho ? "PUNTO" : null;
  const listaModo = modo === "PLANTA" ? recogidas : personas;
  const marcaActual = (s) => {
    if (borrador[s.id]) return borrador[s.id];
    const mk = marcaDe(r, s.id);
    if (mk.recogida === false || mk.llenada === false) return { resultado: mk.motivo, observacion: mk.observacion || "" };
    return { resultado: "OK", observacion: mk.observacion || "" };
  };
  const noOk = listaModo.filter((s) => marcaActual(s).resultado !== "OK");

  function confirmarRecoleccion() {
    const marcas = Object.fromEntries(Object.entries(borrador).map(([id, b]) => [id, b.resultado === "OK" ? { recogida: true, observacion: b.observacion } : { recogida: false, motivo: b.resultado, observacion: b.observacion }]));
    if (hacer(registrarRecoleccion?.(r.id, marcas, { hora: horaActual(), por }), `AD ${r.ad} · recolección registrada`)) setBorrador({});
  }
  function confirmarLlenado() {
    const marcas = Object.fromEntries(Object.entries(borrador).filter(([, b]) => b.resultado !== "OK").map(([id, b]) => [id, { llenada: false, motivo: b.resultado, observacion: b.observacion }]));
    const h = horaActual();
    if (hacer(registrarLlenado?.(r.id, marcas, { horaLlenado: h, horaDevolucion: h, por }), `AD ${r.ad} · de vuelta al punto`)) setBorrador({});
  }
  function guardarPersona(s, resultado, observacion) {
    if (modo === "PUNTO") hacer(corregirIncidencias?.(r.id, { [s.id]: { resultado: resultado === "OK" ? "ENTREGADA" : resultado, observacion } }, { hora: horaActual(), por }), "Incidencia registrada");
    else setBorrador((b) => ({ ...b, [s.id]: { resultado, observacion } }));
    setHoja(null);
  }
  const idx = PASOS.findIndex(([x]) => x === paso);

  return (
    <div className="op-scroll">
      <Cabecera tema="ver" titulo={`AD ${r.ad}`} sub={`${tipoADInfo(r).nombre} · ${r.comunidad}`} volver={volver} />
      <div className="op-pasos">{PASOS.map(([k, l], i) => (
        <div key={k} className={i < idx ? "hecho" : i === idx ? "on" : ""}><i>{i < idx ? <Check size={10} /> : i + 1}</i><span>{l}</span></div>))}</div>
      <div className="op-seg">{[["despacho", "Despacho"], ["clientes", `Clientes · ${convocadas.length + fuera.length || personas.length}`], ["ruta", "Ruta"]].map(([k, l]) =>
        <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {error && <div className="op-error"><AlertTriangle size={14} />{error}</div>}

      {tab === "despacho" && <>
        {e === "INCIDENCIA" && <div className="op-nota roj"><AlertTriangle size={14} /><span>El AD tiene una incidencia reportada. Distribución la está resolviendo.</span></div>}
        {["ASIGNADA", "REPROGRAMADA"].includes(e) && <>
          <Totales items={[["Personas", personas.length], ["Cilindros", cil(personas)], ["Kg", personas.reduce((a, s) => a + kgDeSolicitud(s), 0)]]} />
          <div className="op-panel"><b>Antes de salir</b><span>El camión sale vacío a recoger. Vehículo {r.unidad} · ayudante {ayudanteDistribucion(r.ayudanteId).nombre}. Todos los de la lista ya pagaron.</span></div>
          <button className="op-cta ver" onClick={() => { const res = salidaAD?.(r.id, { hora: horaActual() }); if (hacer(res, `AD ${r.ad} en ruta`) && res.salieronPorTarifa) avisar(`${res.salieronPorTarifa} salieron por la tarifa nueva`); }}>
            <Truck size={17} /> Iniciar ruta</button>
        </>}
        {modo === "RECOLECCION" && <>
          <div className="op-panel"><b>Recolección en el punto</b><span>Todos arrancan como recogidos. Toca a quien no se le pudo recoger y anota por qué.</span></div>
          <Totales items={[["Convocados", cil(personas)], ["Recogidos", cil(personas) - cil(noOk)], ["Incidencias", noOk.length]]} />
          <ListaPersonas lista={personas} parque={parqueEnvases} marca={marcaActual} okTxt="Recogida" onTocar={(s) => setHoja({ s })} />
          <div className="op-pie"><button className="op-cta ver" onClick={confirmarRecoleccion}><Container size={17} /> Confirmar recolección · {cil(personas) - cil(noOk)}</button></div>
        </>}
        {modo === "PLANTA" && <>
          <div className="op-panel"><b>Llenado en planta</b><span>Todas arrancan como llenas. Toca la que no se pudo llenar: vuelve vacía al punto.</span></div>
          <Totales items={[["Recogidos", cil(recogidas)], ["Llenos", cil(recogidas) - cil(noOk)], ["Vacíos", cil(noOk)]]} />
          <ListaPersonas lista={recogidas} parque={parqueEnvases} marca={marcaActual} okTxt="Llena" onTocar={(s) => setHoja({ s })} />
          <div className="op-pie"><button className="op-cta ver" onClick={confirmarLlenado}><Factory size={17} /> Llenado listo · volver al punto</button></div>
        </>}
        {modo === "PUNTO" && <>
          <div className="op-panel"><b>Entrega en el punto</b><span>Entrega las llenas y devuelve las vacías. Si algo cambió, toca a la persona antes de marcar despachado.</span></div>
          <Totales items={[["Planificados", cil(personas)], ["Recogidos", cil(recogidas)], ["Entregados", cil(llenas)], ["Vacíos", cil(recogidas) - cil(llenas)]]} />
          <ListaPersonas lista={personas} parque={parqueEnvases} marca={marcaActual} okTxt="Entregada llena" onTocar={(s) => setHoja({ s })} />
          <label className="op-campo"><span>Observación del despacho</span><textarea value={obsDespacho} onChange={(ev) => setObsDespacho(ev.target.value)} rows={2} placeholder="Opcional" /></label>
          <div className="op-pie"><button className="op-cta ver" onClick={() => hacer(marcarDespachado?.(r.id, { hora: horaActual(), operador: op.nombre, observacion: obsDespacho.trim() || null }), `AD ${r.ad} despachado · lo cierra Distribución`)}>
            <Flag size={17} /> Marcar despachado</button></div>
        </>}
        {paso === "DESPACHADO" && <>
          <div className="op-exito ver"><CheckCircle2 size={22} /><div><b>Despachado a las {r.jornada.despacho.hora}</b><span>Distribución revisa y cierra el AD: ahí se emiten las facturas.</span></div></div>
          <Totales items={[["Planificados", r.jornada.despacho.planificados], ["Recogidos", r.jornada.despacho.recogidos], ["Entregados", r.jornada.despacho.entregados], ["Vacíos", r.jornada.despacho.vacios]]} />
          <ListaPersonas lista={personas} parque={parqueEnvases} marca={marcaActual} okTxt="Entregada llena" />
        </>}
        {e === "CERRADA" && <>
          <div className="op-exito ver"><ClipboardCheck size={22} /><div><b>Cerrada por Distribución{r.horaCierre ? ` · ${r.horaCierre}` : ""}</b>
            <span>{cant(r.cierreDetalle?.facturas ?? r.cierreDetalle?.entregadas ?? 0, "factura emitida", "facturas emitidas")} · {cant(r.cierreDetalle?.replanificadas || 0, "caso", "casos")} a replanificación</span></div></div>
          {r.jornada?.despacho && <Totales items={[["Planificados", r.jornada.despacho.planificados], ["Recogidos", r.jornada.despacho.recogidos], ["Entregados", r.jornada.despacho.entregados]]} />}
        </>}
      </>}
      {tab === "clientes" && <Clientes convocadas={personas} fuera={fuera} parque={parqueEnvases} r={r} />}
      {tab === "ruta" && <Ruta r={r} solicitudes={solicitudes} />}
      {hoja && <HojaPersona s={hoja.s} modo={modo} actual={marcaActual(hoja.s)} parque={parqueEnvases} onCerrar={() => setHoja(null)} onGuardar={guardarPersona} />}
    </div>
  );
}

function Totales({ items }) {
  return <div className="op-totales">{items.map(([l, v]) => <div key={l}><b>{num(v)}</b><span>{l}</span></div>)}</div>;
}

function ListaPersonas({ lista, parque, marca, okTxt, onTocar }) {
  const [q, setQ] = useState("");
  const qq = q.trim().toLowerCase();
  const vis = lista.filter((s) => { if (!qq) return true; const u = usr(s.usuario); return `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(qq); });
  return <>
    {lista.length > 6 && <div className="op-buscar"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona o cédula" /></div>}
    <div className="op-lista">{vis.slice(0, 120).map((s) => { const u = usr(s.usuario); const m = marca(s); const mal = m.resultado !== "OK"; return (
      <button key={s.id} className={`op-fila ${mal ? "mal" : ""}`} onClick={onTocar ? () => onTocar(s) : undefined} disabled={!onTocar}>
        <i>{mal ? <X size={13} /> : <Check size={13} />}</i>
        <div><b>{u.nombre}</b><span>{u.doc} · {cpt(s.concepto).corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""}</span>
          <small>{envaseDe(parque, s)}</small>
          <em>{mal ? motivoNoEntrega(m.resultado).nombre : okTxt}{m.observacion ? ` · ${m.observacion}` : ""}</em></div>
        {onTocar && <ChevronRight size={15} />}
      </button>); })}
      {vis.length > 120 && <div className="op-vacio">Mostrando 120 de {num(vis.length)}. Busca por nombre o cédula.</div>}
    </div>
  </>;
}

function Clientes({ convocadas, fuera, parque, r }) {
  const [ver, setVer] = useState("TODOS");
  const [q, setQ] = useState("");
  const todos = [...convocadas, ...fuera];
  const lista = (ver === "PAGARON" ? convocadas : ver === "NO" ? fuera : todos)
    .filter((s) => { if (!q.trim()) return true; const u = usr(s.usuario); return `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(q.trim().toLowerCase()); });
  const paradas = new Map((r.paradas || []).map((p) => [p.solicitudId, p]));
  return <>
    <div className="op-chips">{[["TODOS", `Todos ${todos.length}`], ["PAGARON", `Pagaron ${convocadas.length}`], ["NO", `No pagaron ${fuera.length}`]].map(([k, l]) =>
      <button key={k} className={ver === k ? "on" : ""} onClick={() => setVer(k)}>{l}</button>)}</div>
    <div className="op-buscar"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona o cédula" /></div>
    {fuera.length > 0 && <div className="op-nota"><AlertTriangle size={14} /><span>{cant(fuera.length, "persona pidió y no pagó", "personas pidieron y no pagaron")}: si llegan con su bombona, no se recoge.</span></div>}
    <div className="op-lista">{lista.slice(0, 150).map((s) => { const u = usr(s.usuario); const p = pagoCliente(s); const pa = paradas.get(s.id); return (
      <div key={s.id} className="op-fila fija">
        <i className={p.tono}>{p.tono === "ver" ? <Check size={13} /> : <X size={13} />}</i>
        <div><b>{u.nombre}</b><span>{u.doc} · {s.id} · {cpt(s.concepto).corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""}</span>
          <small>{pa ? `Parada ${pa.orden} · ${pa.direccion || u.dir || ""}` : envaseDe(parque, s)}</small>
          <em className={p.tono}>{p.txt} · {p.sub}</em></div>
      </div>); })}</div>
  </>;
}

function Ruta({ r, solicitudes }) {
  const j = r.jornada || {};
  const momentos = [
    ["Salida a recolección", r.fechaSalida && r.horaSalida],
    ["Recolección", j.recoleccion && `${j.recoleccion.hora} · ${cant(j.recoleccion.recogidas, "recogida", "recogidas")}`],
    ["Llenado y regreso al punto", j.llenado && `${j.llenado.hora} · ${cant(j.llenado.llenadas, "llena", "llenas")}`],
    ["Despachado", j.despacho && `${j.despacho.hora} · ${j.despacho.operador}`],
    ["Cierre · Distribución", r.cerradaEn && (r.horaCierre || fecha(r.cerradaEn))],
  ];
  return <>
    <div className="op-mapa"><div className="op-mapa-pin"><MapPin size={20} /></div><div><b>{tipoAD(r) === "ESPECIAL" ? "Ruta por domicilio" : "Punto comunal"}</b>
      <span>{r.comunidad}{r.comuna && r.comuna !== r.comunidad ? ` · ${r.comuna}` : ""}{r.parroquia ? ` · ${r.parroquia}` : ""}</span></div></div>
    {(r.paradas || []).length > 0 && <div className="op-lista">{r.paradas.map((p) => (
      <div key={p.orden} className="op-fila fija"><i className="ver">{p.orden}</i><div><b>{p.nombre}</b><span>{p.direccion}{p.sector ? ` · ${p.sector}` : ""}</span>
        <em>{p.motivo ? `Viene de: ${motivoNoEntrega(p.motivo).nombre}` : "Entrega directa"}</em></div></div>))}</div>}
    <div className="op-datos">
      <div><span>Jornada</span><b>{fecha(r.fechaJornada || r.fechaPlan)}</b></div>
      <div><span>Vehículo</span><b>{r.unidad}</b></div>
      <div><span>Ayudante</span><b>{ayudanteDistribucion(r.ayudanteId).nombre}</b></div>
      <div><span>Personas</span><b>{personasDeAD(r, solicitudes).length}</b></div>
    </div>
    <div className="op-linea">{momentos.map(([l, v]) => <div key={l} className={v ? "si" : ""}><i>{v ? <Check size={10} /> : <Clock3 size={10} />}</i><b>{l}</b><span>{v || "Pendiente"}</span></div>)}</div>
  </>;
}

function HojaPersona({ s, modo, actual, parque, onCerrar, onGuardar }) {
  const [res, setRes] = useState(actual.resultado);
  const [obs, setObs] = useState(actual.observacion || "");
  const u = usr(s.usuario);
  const opciones = modo === "RECOLECCION" ? [["OK", "Recogida"], ...motivosDelMomento("RECOLECCION").map((m) => [m.id, m.nombre])]
    : modo === "PLANTA" ? [["OK", "Llena"], ...motivosDelMomento("PLANTA").map((m) => [m.id, m.nombre])]
    : [["OK", "Entregada llena"], ...motivosDelMomento("RECOLECCION").map((m) => [m.id, `No se recogió · ${m.nombre}`]), ...motivosDelMomento("PLANTA").map((m) => [m.id, `Volvió vacía · ${m.nombre}`])];
  return (
    <div className="op-hoja-bg" onClick={onCerrar}>
      <div className="op-hoja" onClick={(e) => e.stopPropagation()}>
        <div className="op-asa" />
        <div className="op-hoja-h"><div><b>{u.nombre}</b><span>{u.doc} · {s.id}</span></div><button onClick={onCerrar}><X size={17} /></button></div>
        <div className="op-panel"><b>Su bombona</b><span>{cpt(s.concepto).corto}{Number(s.cantidad) > 1 ? ` × ${s.cantidad}` : ""} · {envaseDe(parque, s)}</span></div>
        <div className="op-opciones">{opciones.map(([id, l]) => (
          <button key={id} className={res === id ? "on" : ""} onClick={() => setRes(id)}><i>{res === id ? <Check size={11} /> : null}</i>{l}</button>))}</div>
        <label className="op-campo"><span>Observación</span><textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej.: válvula con fuga, llegó sin aro…" /></label>
        <button className="op-cta ver" onClick={() => onGuardar(s, res, obs.trim())}><Check size={17} /> Guardar</button>
      </div>
    </div>
  );
}

/* ════════════════  VENTA EN PLANTA MÓVIL  ════════════════ */
function ModuloPM({ op, solicitudes = [], manuales = [], cajasPM = {}, venderPlantaMovil, cerrarCajaPM, avisar }) {
  const [tab, setTab] = useState("vender");
  const cajaId = cajaIdDe(op);
  const caja = cajaPlantaMovil(cajaId, solicitudes, manuales);
  const cerrada = cajasPM[cajaId];
  return (
    <div className="op-scroll pm">
      <div className="pm-cab">
        <div className="pm-cab-top"><div><span>VENTA EN PLANTA MÓVIL</span><b>Caja del día</b></div><em className={cerrada ? "cerr" : ""}>{cerrada ? `Cerrada ${cerrada.hora}` : "Abierta"}</em></div>
        <div className="pm-cab-num"><div><small>Cobrado hoy</small><b>Bs {bs(caja.total)}</b></div><div><small>Ventas</small><b>{caja.ventas.length}</b></div><div><small>Cilindros</small><b>{caja.cilindros}</b></div></div>
      </div>
      <div className="op-seg azu">{[["vender", "Vender"], ["ventas", `Ventas · ${caja.ventas.length}`], ["caja", "Caja"]].map(([k, l]) =>
        <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "vender" && (cerrada
        ? <div className="op-nota"><AlertTriangle size={14} /><span>La caja del día ya se cerró: no admite ventas nuevas.</span></div>
        : <Vender op={op} cajaId={cajaId} solicitudes={solicitudes} vender={venderPlantaMovil} avisar={avisar} />)}
      {tab === "ventas" && <Ventas caja={caja} />}
      {tab === "caja" && <Caja op={op} cajaId={cajaId} caja={caja} cerrada={cerrada} cerrarCajaPM={cerrarCajaPM} avisar={avisar} />}
    </div>
  );
}

/** Un cilindro dibujado: el tamaño se nota a simple vista. */
function Cilindro({ kg, color, alto = 58 }) {
  const h = { 10: 0.72, 18: 0.84, 27: 0.94, 43: 1 }[kg] || 0.8;
  const id = `pmg${kg}`;
  return (
    <svg viewBox="0 0 60 96" height={alto * h} width={alto * h * 0.625} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" x2="1">
        <stop offset="0" stopColor={color} /><stop offset=".38" stopColor={color} stopOpacity=".78" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".55" /><stop offset=".62" stopColor={color} /><stop offset="1" stopColor="#10181d" stopOpacity=".55" />
      </linearGradient></defs>
      <rect x="25" y="2" width="10" height="9" rx="2" fill="#AAB4BB" /><rect x="19" y="10" width="22" height="6" rx="2.5" fill="#6B7780" />
      <path d="M10 28 Q10 16 30 16 Q50 16 50 28 V84 Q50 93 41 93 H19 Q10 93 10 84 Z" fill={`url(#${id})`} />
      <rect x="10" y="48" width="40" height="13" fill="#fff" opacity=".22" />
      <text x="30" y="58" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui">{kg}</text>
    </svg>
  );
}

function Vender({ op, cajaId, solicitudes, vender, avisar }) {
  const cdt = cdtDe(op);
  const vacio = { kg: null, cantidad: 1, conCodigo: true, q: "", usuario: null, nombre: "", doc: "", metodo: null, banco: "BDV", referencia: "", telefono: "", recibido: "" };
  const [v, setV] = useState(vacio);
  const [paso, setPaso] = useState(1);
  const [recibo, setRecibo] = useState(null);
  const [error, setError] = useState("");
  const set = (c) => { setError(""); setV((x) => ({ ...x, ...c })); };
  const u = v.usuario ? usr(v.usuario) : null;
  const residencial = u && segmentoUsuario(u) === "RESIDENCIAL";
  const concepto = v.kg ? `BOMB_${v.kg}` : null;
  const g = v.kg ? CODIGOS_GENERICOS.find((x) => x.cdt === cdt && x.kg === v.kg && x.canal === "PLANTA") : null;
  const cantidad = residencial ? 1 : Math.max(1, Number(v.cantidad) || 1);
  const m = concepto ? (v.conCodigo ? (u ? montos(concepto, cantidad, u.id, HOY) : null) : (g ? montos(g.concepto, cantidad, g.id, HOY) : null)) : null;
  const cupo = u && concepto ? puedeSolicitar(u, solicitudes, concepto, cantidad) : { ok: true };
  const tope = !v.conCodigo && cantidad > TOPE_UNIDADES_GENERICO;
  const resultados = v.q.trim().length >= 2 ? USUARIOS.filter((x) => `${x.nombre} ${x.doc} ${x.contrato}`.toLowerCase().includes(v.q.trim().toLowerCase())).slice(0, 5) : [];
  const recibido = v.recibido === "" ? null : Number(String(v.recibido).replace(/\./g, "").replace(",", "."));
  const vuelto = m && recibido != null ? recibido - m.total : 0;
  const clienteOk = v.conCodigo ? Boolean(u) && cupo.ok : v.nombre.trim().length > 3 && v.doc.trim().length > 4 && !tope;
  const pagoOk = v.metodo === "EFECTIVO" ? recibido == null || vuelto >= -0.009 : Boolean(v.metodo) && v.referencia.trim().length >= 4 && (v.metodo !== "PAGO_MOVIL" || v.telefono.trim().length >= 7);
  // Precio de referencia en la vitrina: la tarifa de hoy al consumidor final.
  const precioVitrina = (kg) => { const gg = CODIGOS_GENERICOS.find((x) => x.cdt === cdt && x.kg === kg && x.canal === "PLANTA"); return gg ? montos(`BOMB_${kg}`, 1, gg.id, HOY).total : null; };
  const rapidos = m ? [...new Set([m.total, Math.ceil(m.total / 100) * 100, Math.ceil(m.total / 500) * 500, Math.ceil(m.total / 1000) * 1000])].slice(0, 4) : [];

  function cobrar() {
    const res = vender?.({
      jornada: cajaId, cdt, unidad: "Planta móvil", operador: op.nombre, hora: horaActual(),
      ...(v.conCodigo ? { usuario: u.id, concepto } : { codigoGenerico: g.id, compradorNombre: v.nombre.trim(), compradorDoc: v.doc.trim() }),
      cantidad, metodo: v.metodo, banco: v.metodo === "EFECTIVO" ? "EFECTIVO" : v.banco, referencia: v.referencia.trim(), telefono: v.telefono.trim(),
      montoRecibido: v.metodo === "EFECTIVO" && recibido != null ? recibido : "",
    });
    if (!res?.ok) { setError(res?.error || "No se pudo registrar la venta."); return; }
    setRecibo({ ...res, m, metodo: v.metodo, banco: v.banco, referencia: v.referencia.trim(), nombre: u ? u.nombre : v.nombre.trim(), doc: u ? u.doc : v.doc.trim(), kg: v.kg, cantidad, hora: horaActual() });
    avisar("Venta cobrada y facturada");
  }
  const reiniciar = () => { setRecibo(null); setV(vacio); setPaso(1); };

  if (recibo) {
    const serie = recibo.solicitud?.serie || recibo.factura?.serie;
    const mu = METODO_UI[recibo.metodo];
    return (
      <div className="pm-recibo-wrap">
        <div className="pm-ok"><span><Check size={22} /></span><b>Venta cobrada</b><em>Bs {bs(recibo.total)}</em></div>
        <div className="pm-ticket">
          <div className="pm-ticket-h"><b>GasLara</b><span>Venta en planta móvil · {fecha(HOY)} · {recibo.hora}</span></div>
          <div className="pm-ticket-l"><span>Factura</span><b>{serie}</b></div>
          <div className="pm-ticket-l"><span>Cliente</span><b>{recibo.nombre}</b></div>
          <div className="pm-ticket-l"><span>Documento</span><b>{recibo.doc}</b></div>
          <hr />
          <div className="pm-ticket-l"><span>Bombona {recibo.kg} kg × {recibo.cantidad}</span><b>Bs {bs(recibo.m.base)}</b></div>
          <div className="pm-ticket-l"><span>{recibo.m.exento ? "IVA · exento" : "IVA 16%"}</span><b>Bs {bs(recibo.m.iva)}</b></div>
          <div className="pm-ticket-l tot"><span>Total</span><b>Bs {bs(recibo.total)}</b></div>
          <hr />
          <div className="pm-ticket-l"><span>Pagado con</span><b style={{ color: mu.color }}>{METODOS_COBRO_PM.find((x) => x.id === recibo.metodo).nombre}</b></div>
          {recibo.metodo !== "EFECTIVO" && <div className="pm-ticket-l"><span>{recibo.metodo === "PUNTO_VENTA" ? "Aprobación" : "Referencia"}</span><b>{recibo.referencia}</b></div>}
          {recibo.vuelto > 0 && <div className="pm-ticket-l"><span>Vuelto</span><b>Bs {bs(recibo.vuelto)}</b></div>}
          <div className="pm-ticket-pie">Operador: {op.nombre}</div>
        </div>
        <button className="op-cta azu" onClick={reiniciar}><Plus size={17} /> Nueva venta</button>
      </div>
    );
  }

  return (
    <div className="pm-venta">
      <div className="pm-pasos">{["Cilindro", "Cliente", "Pago"].map((l, i) => (
        <button key={l} className={paso === i + 1 ? "on" : paso > i + 1 ? "hecho" : ""} onClick={() => i + 1 < paso && setPaso(i + 1)}>
          <i>{paso > i + 1 ? <Check size={11} /> : i + 1}</i>{l}</button>))}</div>

      {paso === 1 && <>
        <div className="pm-tit">¿Qué cilindro vas a vender?</div>
        <div className="pm-cilindros">{CILINDROS.map((c) => { const p = precioVitrina(c.kg); return (
          <button key={c.kg} className={`pm-cil ${v.kg === c.kg ? "on" : ""}`} onClick={() => set({ kg: c.kg })} style={{ "--c": c.color }}>
            <div className="pm-cil-img"><Cilindro kg={c.kg} color={c.color} /></div>
            <b>{c.kg} kg</b><span>{c.uso}</span>
            <em>{p ? `Bs ${bs(p)}` : "—"}</em>
            {v.kg === c.kg && <i className="pm-cil-ok"><Check size={12} /></i>}
          </button>); })}</div>
        <div className="pm-cant"><span>Cantidad</span>
          <div><button onClick={() => set({ cantidad: Math.max(1, cantidad - 1) })}><Minus size={16} /></button><b>{cantidad}</b>
            <button onClick={() => set({ cantidad: cantidad + 1 })}><Plus size={16} /></button></div></div>
        <div className="op-nota suave"><ShieldCheck size={14} /><span>Precio de hoy al consumidor final. El total exacto sale con el cliente: el uso residencial está exento de IVA.</span></div>
        <div className="op-pie"><button className="op-cta azu" disabled={!v.kg} onClick={() => setPaso(2)}>Continuar <ChevronRight size={17} /></button></div>
      </>}

      {paso === 2 && <>
        <div className="pm-tit">¿A quién le vendes?</div>
        <div className="op-seg azu">{[[true, "Con código de usuario"], [false, "Consumidor final"]].map(([k, l]) =>
          <button key={l} className={v.conCodigo === k ? "on" : ""} onClick={() => set({ conCodigo: k, usuario: null })}>{l}</button>)}</div>
        {v.conCodigo ? (u ? (
          <div className="pm-cliente">
            <span className="pm-av">{u.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
            <div><b>{u.nombre}</b><small>{u.doc} · contrato {u.contrato}</small>
              <em className={cupo.ok ? "ok" : "no"}>{cupo.ok ? (residencial ? "Residencial · 1 bombona por ciclo" : "Uso comercial · sin tope por núcleo") : cupo.motivo}</em></div>
            <button onClick={() => set({ usuario: null })}>Cambiar</button>
          </div>
        ) : <>
          <div className="op-buscar"><Search size={15} /><input autoFocus value={v.q} onChange={(e) => set({ q: e.target.value })} placeholder="Cédula, contrato o nombre" /></div>
          <div className="op-lista">{resultados.map((x) => (
            <button key={x.id} className="op-fila" onClick={() => set({ usuario: x.id, q: "" })}><i className="azu"><UserRound size={13} /></i>
              <div><b>{x.nombre}</b><span>{x.doc} · contrato {x.contrato}</span></div><ChevronRight size={15} /></button>))}
            {v.q.trim().length >= 2 && !resultados.length && <div className="op-vacio">Nadie coincide. Véndele como consumidor final.</div>}
          </div>
        </>) : <>
          <label className="op-campo"><span>Nombre y apellido</span><input value={v.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Como aparece en la cédula" /></label>
          <label className="op-campo"><span>Cédula</span><input value={v.doc} onChange={(e) => set({ doc: e.target.value })} placeholder="V-00.000.000" /></label>
          <div className="op-nota suave"><ShieldCheck size={14} /><span>Sin código se factura contra el genérico del CDT, con un tope de {TOPE_UNIDADES_GENERICO} bombonas por venta.</span></div>
          {tope && <div className="op-error"><AlertTriangle size={14} />Sin código: hasta {TOPE_UNIDADES_GENERICO} bombonas por venta.</div>}
        </>}
        <div className="op-pie"><button className="op-cta azu" disabled={!clienteOk} onClick={() => setPaso(3)}>Continuar <ChevronRight size={17} /></button></div>
      </>}

      {paso === 3 && m && <>
        <div className="pm-resumen">
          <div className="pm-resumen-l"><Cilindro kg={v.kg} color={CILINDROS.find((c) => c.kg === v.kg).color} alto={44} />
            <div><b>Bombona {v.kg} kg × {cantidad}</b><span>{u ? u.nombre : v.nombre}</span></div></div>
          <div className="pm-resumen-r"><small>{m.exento ? "Exento de IVA" : `IVA Bs ${bs(m.iva)}`}</small><b>Bs {bs(m.total)}</b></div>
        </div>
        <div className="pm-tit">Método de pago</div>
        <div className="pm-metodos">{METODOS_COBRO_PM.map((x) => { const mu = METODO_UI[x.id]; return (
          <button key={x.id} className={v.metodo === x.id ? "on" : ""} onClick={() => set({ metodo: x.id, referencia: "", telefono: "" })} style={{ "--c": mu.color, "--f": mu.fondo }}>
            <span><mu.I size={20} /></span><b>{x.nombre}</b><small>{x.desc}</small>
            {v.metodo === x.id && <i><Check size={11} /></i>}
          </button>); })}</div>
        {v.metodo === "EFECTIVO" && <>
          <label className="op-campo"><span>Monto recibido</span><input inputMode="decimal" value={v.recibido} onChange={(e) => set({ recibido: e.target.value })} placeholder={`Bs ${bs(m.total)}`} /></label>
          <div className="pm-rapidos">{rapidos.map((x, i) => <button key={x} onClick={() => set({ recibido: String(x) })}>{i === 0 ? "Exacto" : `Bs ${bs(x).split(",")[0]}`}</button>)}</div>
        </>}
        {v.metodo && v.metodo !== "EFECTIVO" && <>
          <label className="op-campo"><span>{v.metodo === "PUNTO_VENTA" ? "Banco del punto de venta" : v.metodo === "PAGO_MOVIL" ? "Banco receptor" : "Cuenta de destino"}</span>
            <select value={v.banco} onChange={(e) => set({ banco: e.target.value })}>{BANCOS.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select></label>
          <label className="op-campo"><span>{v.metodo === "PUNTO_VENTA" ? "Número de aprobación" : "Número de referencia"}</span>
            <input inputMode="numeric" value={v.referencia} onChange={(e) => set({ referencia: e.target.value })} placeholder={v.metodo === "PUNTO_VENTA" ? "6 dígitos del voucher" : "Últimos dígitos"} /></label>
          {v.metodo === "PAGO_MOVIL" && <label className="op-campo"><span>Teléfono del pagador</span><input inputMode="tel" value={v.telefono} onChange={(e) => set({ telefono: e.target.value })} placeholder="0414-0000000" /></label>}
        </>}
        <div className="pm-total">
          <div><span>Total a cobrar</span><b>Bs {bs(m.total)}</b></div>
          {m.exento ? <small>Uso residencial · exento de IVA</small> : <small>Base Bs {bs(m.base)} + IVA 16% Bs {bs(m.iva)}</small>}
          {v.metodo === "EFECTIVO" && recibido != null && <em className={vuelto < -0.009 ? "no" : ""}>{vuelto < -0.009 ? `Faltan Bs ${bs(-vuelto)}` : `Vuelto Bs ${bs(vuelto)}`}</em>}
        </div>
        {error && <div className="op-error"><AlertTriangle size={14} />{error}</div>}
        <div className="op-pie"><button className="op-cta azu" disabled={!v.metodo || !pagoOk} onClick={cobrar}><Wallet size={17} /> Cobrar Bs {bs(m.total)}</button></div>
      </>}
    </div>
  );
}

function Ventas({ caja }) {
  if (!caja.ventas.length) return <div className="op-vacio"><Receipt size={26} /><br />Todavía no hay ventas hoy. Las que cobres aparecen aquí con su método y su referencia.</div>;
  return <div className="op-lista">{caja.ventas.map((x) => { const mu = METODO_UI[x.pago?.metodo] || METODO_UI.EFECTIVO; return (
    <div key={x.id} className="pm-venta-fila">
      <span style={{ background: mu.fondo, color: mu.color }}><mu.I size={16} /></span>
      <div><b>{x.conCodigo ? usr(x.usuario).nombre : x.comprador}</b><small>{cpt(x.concepto).corto} × {x.cantidad} · {x.serie}{x.hora ? ` · ${x.hora}` : ""}</small>
        <em>{METODOS_COBRO_PM.find((m) => m.id === x.pago?.metodo)?.nombre || "Efectivo"}{x.pago?.referencia ? ` · ref. ${x.pago.referencia}` : ""}</em></div>
      <b className="pm-monto">Bs {bs(x.total)}</b>
    </div>); })}</div>;
}

function Caja({ op, cajaId, caja, cerrada, cerrarCajaPM, avisar }) {
  const [contado, setContado] = useState("");
  const max = Math.max(1, ...METODOS_COBRO_PM.map((x) => caja.porMetodo[x.id] || 0));
  const porKg = CILINDROS.map((c) => ({ ...c, n: caja.ventas.filter((v) => cpt(v.concepto).kg === c.kg).reduce((a, v) => a + Number(v.cantidad || 0), 0) }));
  const ef = caja.porMetodo.EFECTIVO || 0;
  const cont = contado === "" ? null : Number(String(contado).replace(/\./g, "").replace(",", "."));
  return <>
    <div className="pm-caja">{METODOS_COBRO_PM.map((x) => { const mu = METODO_UI[x.id]; const val = caja.porMetodo[x.id] || 0; return (
      <div key={x.id} className="pm-caja-f"><span style={{ background: mu.fondo, color: mu.color }}><mu.I size={15} /></span>
        <div><div className="pm-caja-t"><b>{x.nombre}</b><em>Bs {bs(val)}</em></div><i><u style={{ width: `${(val / max) * 100}%`, background: mu.color }} /></i></div></div>); })}
      <div className="pm-caja-tot"><span>Total del día</span><b>Bs {bs(caja.total)}</b></div></div>
    <div className="op-totales">{porKg.map((c) => <div key={c.kg}><b>{c.n}</b><span>{c.kg} kg</span></div>)}</div>
    {cerrada ? (
      <div className={`op-exito ${Math.abs(cerrada.diferencia) < 0.01 ? "azu" : "amb"}`}><CheckCircle2 size={22} /><div><b>Caja cerrada a las {cerrada.hora}</b>
        <span>Efectivo contado Bs {bs(cerrada.contado)} · esperado Bs {bs(cerrada.esperado)}{Math.abs(cerrada.diferencia) >= 0.01 ? ` · diferencia Bs ${bs(cerrada.diferencia)}` : " · cuadra"}.</span></div></div>
    ) : <>
      <label className="op-campo"><span>Efectivo contado en caja</span><input inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} placeholder={`Esperado Bs ${bs(ef)}`} /></label>
      {cont != null && <div className={`op-nota ${Math.abs(cont - ef) < 0.01 ? "suave" : ""}`}><AlertTriangle size={14} /><span>{Math.abs(cont - ef) < 0.01 ? "El efectivo cuadra con lo cobrado." : `Diferencia de Bs ${bs(cont - ef)} contra lo cobrado en efectivo.`}</span></div>}
      <div className="op-pie"><button className="op-cta azu" disabled={contado === ""} onClick={() => { cerrarCajaPM?.(cajaId, { efectivoContado: cont, hora: horaActual(), operador: op.nombre }); avisar("Caja del día cerrada"); }}>
        <ClipboardCheck size={17} /> Cerrar caja del día</button></div>
    </>}
  </>;
}

function Estilos() {
  return <style>{`
.ope{position:relative;display:flex;gap:56px;justify-content:center;align-items:center;padding:28px 28px 34px;min-height:calc(100vh - 56px);overflow:hidden;box-sizing:border-box;isolation:isolate}
.ope *,.ope *::before,.ope *::after{box-sizing:border-box}
.ope,.ope.ope :is(h1,h2,h3,p,span,b,em,small,button,input,select,textarea,label,div){font-family:"Inter","SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif}
.ope-fondo{position:absolute;inset:0;z-index:-1;background:
  radial-gradient(900px 520px at 78% 18%,rgba(46,160,110,.28),transparent 62%),
  radial-gradient(760px 480px at 12% 88%,rgba(59,91,219,.30),transparent 60%),
  radial-gradient(600px 400px at 50% 50%,rgba(255,255,255,.04),transparent 70%),
  linear-gradient(160deg,#081014 0%,#0E1A20 46%,#070B0E 100%)}
.ope-fondo::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.ope-lado{max-width:380px;display:flex;flex-direction:column;gap:14px;color:#E8EEF1}
.ope-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.14em;color:#6FD3A4}
.ope .ope-lado h1{margin:0;font-size:32px;line-height:1.12;font-weight:750;letter-spacing:-.025em;color:#fff}
.ope-intro{margin:0;color:#9FB0BA;font-size:14px;line-height:1.55}
.ope-feat{display:flex;gap:12px;padding:15px 16px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(10px)}
.ope-feat>span{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}
.ope-feat.ver>span{background:rgba(46,160,110,.18);color:#6FD3A4}.ope-feat.azu>span{background:rgba(91,124,250,.2);color:#9DB2FF}
.ope-feat b{display:block;font-size:14.5px;color:#fff}.ope-feat em{display:block;font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.06em;color:#8FA2AD;margin:2px 0 6px;text-transform:uppercase}
.ope-feat p{margin:0;font-size:12.5px;line-height:1.55;color:#B4C2CA}
.ope-tip{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:#8FA2AD;line-height:1.5}.ope-tip svg{flex-shrink:0;margin-top:2px;color:#6FD3A4}
.ope-dispositivo{position:relative;flex-shrink:0}
.ope-telefono{position:absolute;top:0;left:0;width:412px;height:${ALTO}px;transform-origin:top left;border-radius:64px;padding:12px;
  background:linear-gradient(145deg,#5B636B 0%,#2A3036 18%,#13171A 50%,#2E353B 82%,#636B73 100%);
  box-shadow:0 60px 120px -30px rgba(0,0,0,.75),0 30px 60px -20px rgba(0,0,0,.55),inset 0 0 0 1.5px rgba(255,255,255,.16),inset 0 0 0 3px #0A0C0E}
.ope-telefono::after{content:"";position:absolute;inset:4px;border-radius:60px;border:1px solid rgba(255,255,255,.06);pointer-events:none}
.ope-boton{position:absolute;width:4px;border-radius:3px;background:linear-gradient(90deg,#1B1F22,#4A5259)}
.ope-boton.b1{left:-3px;top:150px;height:34px}.ope-boton.b2{left:-3px;top:206px;height:62px}.ope-boton.b3{left:-3px;top:282px;height:62px}.ope-boton.b4{right:-3px;left:auto;top:232px;height:96px;background:linear-gradient(270deg,#1B1F22,#4A5259)}
.ope-pantalla{position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:#F2F4F6;display:flex;flex-direction:column}
.ope-isla{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:118px;height:34px;border-radius:20px;background:#000;z-index:20}
.ope-status{height:54px;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;padding:14px 30px 0 34px;color:#10181D;z-index:10}
.ope-status b{font-size:15px;font-weight:650;letter-spacing:-.01em}.ope-status span{display:flex;gap:5px;align-items:center}
.ope-app{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}
.ope-nav{flex-shrink:0;height:84px;display:flex;justify-content:space-around;align-items:flex-start;padding:9px 10px 0;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-top:1px solid rgba(16,24,29,.07)}
.ope-nav button{border:0;background:none;display:flex;flex-direction:column;align-items:center;gap:3px;color:#8A96A0;cursor:pointer;min-width:62px}
.ope-nav button span{font-size:10px;font-weight:600}.ope-nav button.on{color:#10181D}.ope-nav button.on.ver{color:#16794C}.ope-nav button.on.azu{color:#3B5BDB}
.ope-home{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#10181D;opacity:.85;z-index:20}
.ope-toast{position:absolute;left:18px;right:18px;bottom:96px;display:flex;gap:8px;align-items:center;background:#10181D;color:#fff;border-radius:14px;padding:11px 14px;font-size:12.5px;font-weight:550;z-index:30;box-shadow:0 12px 30px rgba(0,0,0,.28)}
.ope-toast svg{color:#6FD3A4}
.op-scroll{flex:1;min-height:0;overflow-y:auto;padding:8px 18px 18px;display:flex;flex-direction:column;gap:11px;scrollbar-width:none}
.op-scroll::-webkit-scrollbar{display:none}
.op-scroll>*,.pm-venta>*,.pm-recibo-wrap>*{flex-shrink:0}
.op-login{padding-top:18px}
.op-marca{display:flex;gap:10px;align-items:center}.op-marca>span{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#16794C,#2EA06E);color:#fff;display:grid;place-items:center}
.op-marca b{display:block;font-size:18px;color:#10181D;letter-spacing:-.02em}.op-marca em{font-style:normal;font-size:11.5px;color:#6B7780}
.ope .op-login h2{margin:10px 0 0;font-size:24px;font-weight:750;letter-spacing:-.02em;color:#10181D}.op-login>p{margin:0 0 4px;font-size:12.5px;color:#6B7780}
.op-perfil{display:flex;gap:11px;align-items:center;width:100%;background:#fff;border:0;border-radius:18px;padding:12px 14px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,29,.05),0 4px 14px rgba(16,24,29,.05)}
.op-perfil i{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#E3F3EA,#CFE9DB);color:#16794C;display:grid;place-items:center;font-style:normal;font-weight:750;font-size:13px;flex-shrink:0}
.op-perfil div{flex:1;min-width:0}.op-perfil b{display:block;font-size:13.5px;color:#10181D}.op-perfil span{display:block;font-size:11px;color:#7A8790}
.op-perfil em{display:block;font-style:normal;font-size:11px;color:#16794C;font-weight:600;margin-top:2px}.op-perfil>svg{color:#B3BDC4}
.op-hola span{font-size:12px;color:#7A8790}.ope .op-hola h2{margin:2px 0 2px;font-size:26px;font-weight:750;letter-spacing:-.025em;color:#10181D}
.op-hero{border:0;border-radius:22px;padding:16px;text-align:left;color:#fff;cursor:pointer;display:flex;flex-direction:column;gap:14px;position:relative;overflow:hidden}
.op-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.08)}
.op-hero.ver{background:linear-gradient(135deg,#0F5E3B 0%,#16794C 55%,#23955F 100%);box-shadow:0 12px 26px -12px rgba(22,121,76,.65)}
.op-hero.azu{background:linear-gradient(135deg,#1E2F7A 0%,#3B5BDB 60%,#5C7CFA 100%);box-shadow:0 12px 26px -12px rgba(59,91,219,.65)}
.op-hero-h{display:flex;gap:11px;align-items:center;position:relative;z-index:1}.op-hero-h>span{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.18);display:grid;place-items:center}
.op-hero-h div{flex:1}.op-hero-h b{display:block;font-size:16px;letter-spacing:-.01em}.op-hero-h em{font-style:normal;font-size:9.5px;font-weight:750;letter-spacing:.08em;opacity:.85}
.op-hero-n{display:flex;gap:8px;position:relative;z-index:1}.op-hero-n div{flex:1;background:rgba(255,255,255,.14);border-radius:12px;padding:8px 6px;font-size:10px;text-align:center;opacity:.95}
.op-hero-n b{display:block;font-size:19px;font-weight:750;letter-spacing:-.02em}
.op-nota{display:flex;gap:8px;background:#FFF5E5;color:#7A5212;border-radius:14px;padding:10px 12px;font-size:11.5px;line-height:1.5}.op-nota svg{flex-shrink:0;margin-top:2px}
.op-nota.roj{background:#FDECEC;color:#8E3131}.op-nota.suave{background:#EEF2F5;color:#4F5D67}
.op-cab{display:flex;gap:10px;align-items:center;padding:2px 0}.op-cab button{border:0;background:#fff;border-radius:12px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 3px rgba(16,24,29,.08)}
.op-cab b{display:block;font-size:21px;font-weight:750;letter-spacing:-.02em;color:#10181D}.op-cab span{display:block;font-size:11.5px;color:#6B7780}
.op-cab.ver span{color:#16794C;font-weight:600}
.op-grupo{font-size:10.5px;font-weight:750;color:#7A8790;letter-spacing:.07em;text-transform:uppercase;margin:4px 2px 7px}
.op-tarjeta{display:block;width:100%;background:#fff;border:0;border-radius:18px;padding:13px 14px;text-align:left;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,29,.05),0 4px 14px rgba(16,24,29,.05)}
.op-tarjeta-h{display:flex;justify-content:space-between;align-items:center}.op-tarjeta-h b{font-size:15px;color:#10181D}
.op-tarjeta em{display:block;font-style:normal;font-size:12.5px;color:#34424C;margin-top:4px;font-weight:550}
.op-tarjeta small{display:flex;gap:4px;align-items:center;font-size:11px;color:#7A8790;margin-top:4px}
.op-chip{font-size:10px;font-weight:700;background:#EEF2F5;color:#4F5D67;border-radius:999px;padding:4px 9px}.op-chip.ver{background:#E3F3EA;color:#16794C}.op-chip.act{background:#FFF1DE;color:#A15C07}
.op-vacio{text-align:center;color:#7A8790;font-size:12.5px;padding:30px 12px;line-height:1.55}.op-vacio svg{color:#B3BDC4}
.op-pasos{display:flex;gap:2px;background:#fff;border-radius:16px;padding:10px 6px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-pasos div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9px;color:#9AA6AE;text-align:center}
.op-pasos i{width:20px;height:20px;border-radius:50%;background:#E8ECEF;display:grid;place-items:center;font-style:normal;font-size:9.5px;font-weight:700;color:#7A8790}
.op-pasos .hecho i{background:#16794C;color:#fff}.op-pasos .on i{background:#fff;box-shadow:0 0 0 2px #16794C;color:#16794C}.op-pasos .on span{color:#16794C;font-weight:700}
.op-seg{display:flex;background:#E4E8EC;border-radius:13px;padding:3px}.op-seg button{flex:1;border:0;background:none;border-radius:10px;padding:8px 4px;font-size:12px;font-weight:600;color:#5E6B74;cursor:pointer}
.op-seg button.on{background:#fff;color:#16794C;box-shadow:0 1px 3px rgba(16,24,29,.1)}.op-seg.azu button.on{color:#3B5BDB}
.op-chips{display:flex;gap:6px}.op-chips button{border:1px solid #DCE3E8;background:#fff;border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:600;color:#4F5D67;cursor:pointer}
.op-chips button.on{background:#10181D;border-color:#10181D;color:#fff}
.op-panel{background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,29,.05)}.op-panel b{display:block;font-size:13px;color:#10181D;margin-bottom:3px}.op-panel span{font-size:11.5px;color:#5E6B74;line-height:1.5}
.op-totales{display:grid;grid-template-columns:repeat(auto-fit,minmax(68px,1fr));gap:7px}.op-totales div{background:#fff;border-radius:14px;padding:9px 6px;text-align:center;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-totales b{display:block;font-size:19px;font-weight:750;color:#10181D;letter-spacing:-.02em}.op-totales span{font-size:10px;color:#7A8790}
.op-pie{position:sticky;bottom:0;margin:4px -18px -18px;padding:12px 18px 16px;background:linear-gradient(180deg,rgba(242,244,246,0),#F2F4F6 32%);z-index:5}
.op-cta{width:100%;border:0;border-radius:16px;padding:15px;font-size:14.5px;font-weight:700;color:#fff;display:flex;gap:8px;align-items:center;justify-content:center;cursor:pointer;letter-spacing:-.01em}
.op-cta.ver{background:linear-gradient(135deg,#127044,#1E8C58);box-shadow:0 10px 22px -10px rgba(22,121,76,.7)}
.op-cta.azu{background:linear-gradient(135deg,#2F4AC0,#4C6EF5);box-shadow:0 10px 22px -10px rgba(59,91,219,.7)}
.op-cta:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.op-lista{display:flex;flex-direction:column;gap:7px}
.op-fila{display:flex;gap:10px;align-items:center;background:#fff;border:0;border-radius:15px;padding:10px 12px;text-align:left;cursor:pointer;width:100%;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-fila.fija,.op-fila:disabled{cursor:default}.op-fila.mal{background:#FFF8EE;box-shadow:inset 0 0 0 1px #F4D3A8}
.op-fila>i{width:26px;height:26px;border-radius:50%;background:#E3F3EA;color:#16794C;display:grid;place-items:center;flex-shrink:0;font-style:normal;font-size:10.5px;font-weight:700}
.op-fila.mal>i,.op-fila>i.roj{background:#FDECEC;color:#B03A3A}.op-fila>i.amb{background:#FFF1DE;color:#A15C07}.op-fila>i.azu{background:#EAEFFD;color:#3B5BDB}
.op-fila>div{flex:1;min-width:0}.op-fila b{display:block;font-size:12.5px;color:#10181D}.op-fila span,.op-fila small{display:block;font-size:11px;color:#7A8790}
.op-fila em{display:block;font-style:normal;font-size:11px;font-weight:600;color:#16794C;margin-top:2px}.op-fila.mal em,.op-fila em.roj{color:#B03A3A}.op-fila em.amb{color:#A15C07}.op-fila>svg{color:#B3BDC4}
.op-buscar{display:flex;gap:8px;align-items:center;background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 2px rgba(16,24,29,.05);color:#8A96A0}
.op-buscar input{border:0;outline:0;flex:1;font-size:13px;background:none;color:#10181D}
.op-campo{display:flex;flex-direction:column;gap:5px}.op-campo span{font-size:11px;font-weight:650;color:#5E6B74}
.op-campo input,.op-campo select,.op-campo textarea{border:1px solid #DCE3E8;border-radius:13px;padding:11px 12px;font-size:14px;background:#fff;resize:none;color:#10181D;outline:0}
.op-campo input:focus,.op-campo select:focus,.op-campo textarea:focus{border-color:#8FA2FF;box-shadow:0 0 0 3px rgba(76,110,245,.14)}
.op-error{display:flex;gap:7px;align-items:center;background:#FDECEC;color:#8E3131;border-radius:12px;padding:9px 12px;font-size:11.5px}
.op-exito{display:flex;gap:11px;align-items:center;border-radius:18px;padding:14px}.op-exito.ver{background:#E3F3EA;color:#16794C}.op-exito.azu{background:#EAEFFD;color:#3B5BDB}.op-exito.amb{background:#FFF1DE;color:#8A5A12}
.op-exito b{display:block;font-size:13.5px}.op-exito span{font-size:11.5px;opacity:.9;line-height:1.45}
.op-mapa{display:flex;gap:12px;align-items:center;border-radius:18px;padding:20px 14px;background:linear-gradient(135deg,#DCEFE4,#EEF6F1);position:relative;overflow:hidden}
.op-mapa::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(22,121,76,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(22,121,76,.08) 1px,transparent 1px);background-size:22px 22px}
.op-mapa-pin{width:42px;height:42px;border-radius:50%;background:#16794C;color:#fff;display:grid;place-items:center;position:relative;box-shadow:0 0 0 8px rgba(22,121,76,.15)}
.op-mapa>div:last-child{position:relative}.op-mapa b{display:block;font-size:13.5px;color:#10181D}.op-mapa span{font-size:11.5px;color:#4F5D67}
.op-datos{display:grid;grid-template-columns:1fr 1fr;gap:7px}.op-datos div{background:#fff;border-radius:14px;padding:9px 12px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-datos span{display:block;font-size:10px;color:#7A8790}.op-datos b{font-size:13px;color:#10181D}
.op-linea{display:flex;flex-direction:column;gap:8px;background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-linea div{display:grid;grid-template-columns:22px 1fr;column-gap:6px;font-size:12px}.op-linea i{grid-row:span 2;width:18px;height:18px;border-radius:50%;background:#E8ECEF;display:grid;place-items:center;color:#7A8790}
.op-linea .si i{background:#16794C;color:#fff}.op-linea b{color:#10181D}.op-linea span{font-size:11px;color:#7A8790}
.op-hoja-bg{position:absolute;inset:0;background:rgba(8,14,18,.45);display:flex;align-items:flex-end;z-index:40}
.op-hoja{background:#F2F4F6;width:100%;border-radius:28px 28px 0 0;padding:8px 18px 22px;display:flex;flex-direction:column;gap:10px;max-height:90%;overflow-y:auto}
.op-asa{width:40px;height:5px;border-radius:3px;background:#C9D1D7;margin:2px auto 4px}
.op-hoja-h{display:flex;justify-content:space-between;align-items:flex-start}.op-hoja-h b{display:block;font-size:15px;color:#10181D}.op-hoja-h span{font-size:11px;color:#7A8790}
.op-hoja-h button{border:0;background:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;cursor:pointer}
.op-opciones{display:flex;flex-direction:column;gap:6px}.op-opciones button{display:flex;gap:10px;align-items:center;border:0;background:#fff;border-radius:13px;padding:11px 12px;font-size:12.5px;text-align:left;cursor:pointer;color:#10181D;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.op-opciones button i{width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1.5px #B7C2C9;display:grid;place-items:center;flex-shrink:0}
.op-opciones button.on{box-shadow:inset 0 0 0 1.5px #16794C;background:#F1FAF5;font-weight:650}.op-opciones button.on i{background:#16794C;box-shadow:none;color:#fff}
/* ── Venta en planta móvil ── */
.pm-cab{border-radius:22px;padding:15px 16px;color:#fff;background:linear-gradient(135deg,#1A2A6C 0%,#2F4AC0 55%,#5C7CFA 100%);box-shadow:0 14px 28px -14px rgba(47,74,192,.75);position:relative;overflow:hidden}
.pm-cab::after{content:"";position:absolute;right:-50px;bottom:-60px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.08)}
.pm-cab-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}.pm-cab-top span{font-size:9.5px;font-weight:750;letter-spacing:.1em;opacity:.8}
.pm-cab-top b{display:block;font-size:18px;letter-spacing:-.02em}.pm-cab-top em{font-style:normal;font-size:10.5px;font-weight:700;background:rgba(111,211,164,.22);color:#B8F1D4;border-radius:999px;padding:4px 10px}
.pm-cab-top em.cerr{background:rgba(255,255,255,.18);color:#fff}
.pm-cab-num{display:flex;gap:8px;margin-top:14px;position:relative;z-index:1}.pm-cab-num div{flex:1;background:rgba(255,255,255,.12);border-radius:13px;padding:8px 10px}
.pm-cab-num div:first-child{flex:1.6}.pm-cab-num small{display:block;font-size:10px;opacity:.8}.pm-cab-num b{font-size:16px;letter-spacing:-.01em}
.pm-venta{display:flex;flex-direction:column;gap:12px}
.pm-pasos{display:flex;gap:6px}.pm-pasos button{flex:1;display:flex;gap:6px;align-items:center;justify-content:center;border:0;background:#E4E8EC;border-radius:12px;padding:8px 4px;font-size:11.5px;font-weight:650;color:#7A8790;cursor:default}
.pm-pasos button i{width:18px;height:18px;border-radius:50%;background:#fff;display:grid;place-items:center;font-style:normal;font-size:10px}
.pm-pasos button.on{background:#10181D;color:#fff}.pm-pasos button.on i{color:#10181D}
.pm-pasos button.hecho{background:#EAEFFD;color:#3B5BDB;cursor:pointer}.pm-pasos button.hecho i{background:#3B5BDB;color:#fff}
.pm-tit{font-size:16px;font-weight:750;letter-spacing:-.015em;color:#10181D;margin-top:2px}
.pm-cilindros{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.pm-cil{position:relative;border:0;background:#fff;border-radius:20px;padding:12px 12px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:1px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,29,.05),0 6px 16px rgba(16,24,29,.05);transition:transform .15s}
.pm-cil:hover{transform:translateY(-1px)}
.pm-cil-img{width:100%;height:70px;display:flex;align-items:flex-end;justify-content:center;border-radius:14px;margin-bottom:8px;background:radial-gradient(circle at 50% 110%,color-mix(in srgb,var(--c) 22%,transparent),transparent 70%),#F6F8F9}
.pm-cil b{font-size:16px;color:#10181D;letter-spacing:-.01em}.pm-cil span{font-size:10.5px;color:#7A8790}.pm-cil em{font-style:normal;font-size:12.5px;font-weight:700;color:var(--c);margin-top:4px}
.pm-cil.on{box-shadow:inset 0 0 0 2px var(--c),0 10px 22px -12px var(--c)}
.pm-cil-ok{position:absolute;top:9px;right:9px;width:22px;height:22px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center}
.pm-cant{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:16px;padding:9px 12px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.pm-cant>span{font-size:13px;font-weight:650;color:#10181D}.pm-cant>div{display:flex;gap:14px;align-items:center}.pm-cant b{font-size:18px;min-width:22px;text-align:center;color:#10181D}
.pm-cant button{width:34px;height:34px;border-radius:11px;border:0;background:#EEF2F5;color:#10181D;display:grid;place-items:center;cursor:pointer}
.pm-cliente{display:flex;gap:11px;align-items:center;background:#fff;border-radius:18px;padding:12px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.pm-av{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#DCE4FF,#C5D2FF);color:#2F4AC0;display:grid;place-items:center;font-weight:750;font-size:13px;flex-shrink:0}
.pm-cliente>div{flex:1;min-width:0}.pm-cliente b{display:block;font-size:13px;color:#10181D}.pm-cliente small{display:block;font-size:11px;color:#7A8790}
.pm-cliente em{display:block;font-style:normal;font-size:11px;font-weight:650;margin-top:3px}.pm-cliente em.ok{color:#16794C}.pm-cliente em.no{color:#B03A3A}
.pm-cliente button{border:0;background:#EEF2F5;border-radius:10px;padding:7px 10px;font-size:11px;font-weight:650;color:#34424C;cursor:pointer}
.pm-resumen{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:18px;padding:10px 14px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.pm-resumen-l{display:flex;gap:10px;align-items:center}.pm-resumen-l b{display:block;font-size:13px;color:#10181D}.pm-resumen-l span{font-size:11px;color:#7A8790}
.pm-resumen-r{text-align:right}.pm-resumen-r small{display:block;font-size:10px;color:#7A8790}.pm-resumen-r b{font-size:17px;color:#10181D;letter-spacing:-.02em}
.pm-metodos{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.pm-metodos button{position:relative;border:0;background:#fff;border-radius:18px;padding:13px 12px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,29,.05),0 6px 16px rgba(16,24,29,.05)}
.pm-metodos button>span{width:38px;height:38px;border-radius:12px;background:var(--f);color:var(--c);display:grid;place-items:center;margin-bottom:5px}
.pm-metodos b{font-size:13px;color:#10181D}.pm-metodos small{font-size:10px;color:#7A8790;line-height:1.35}
.pm-metodos button.on{box-shadow:inset 0 0 0 2px var(--c),0 10px 22px -12px var(--c)}
.pm-metodos button>i{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center}
.pm-rapidos{display:flex;gap:6px;flex-wrap:wrap}.pm-rapidos button{border:0;background:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:650;color:#0F9D58;cursor:pointer;box-shadow:inset 0 0 0 1px #BFE6D0}
.pm-total{border-radius:20px;padding:14px 16px;color:#fff;background:linear-gradient(135deg,#0E151A,#1F2A31)}
.pm-total div{display:flex;justify-content:space-between;align-items:baseline}.pm-total span{font-size:12px;opacity:.75}.pm-total b{font-size:24px;letter-spacing:-.025em}
.pm-total small{display:block;font-size:11px;opacity:.65;margin-top:2px}.pm-total em{display:block;font-style:normal;font-size:13px;font-weight:700;color:#7EE2AE;margin-top:6px}.pm-total em.no{color:#FF9B9B}
.pm-recibo-wrap{display:flex;flex-direction:column;gap:12px}
.pm-ok{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0 2px}.pm-ok span{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#12A15F,#2FC27C);color:#fff;display:grid;place-items:center;box-shadow:0 0 0 8px rgba(18,161,95,.14)}
.pm-ok b{font-size:17px;color:#10181D;margin-top:6px}.pm-ok em{font-style:normal;font-size:24px;font-weight:750;color:#10181D;letter-spacing:-.02em}
.pm-ticket{background:#fff;border-radius:18px;padding:14px 16px 12px;box-shadow:0 1px 2px rgba(16,24,29,.05),0 8px 22px rgba(16,24,29,.06);position:relative}
.pm-ticket::before,.pm-ticket::after{content:"";position:absolute;top:118px;width:16px;height:16px;border-radius:50%;background:#F2F4F6}.pm-ticket::before{left:-8px}.pm-ticket::after{right:-8px}
.pm-ticket-h{text-align:center;padding-bottom:10px;border-bottom:1px dashed #D5DDE3;margin-bottom:8px}.pm-ticket-h b{display:block;font-size:15px;color:#16794C;letter-spacing:-.01em}.pm-ticket-h span{font-size:10.5px;color:#7A8790}
.pm-ticket-l{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:4px 0}.pm-ticket-l span{color:#6B7780}.pm-ticket-l b{color:#10181D;text-align:right}
.pm-ticket-l.tot{font-size:14px}.pm-ticket-l.tot b{font-size:16px}
.pm-ticket hr{border:0;border-top:1px dashed #D5DDE3;margin:6px 0}
.pm-ticket-pie{text-align:center;font-size:10.5px;color:#9AA6AE;margin-top:6px}
.pm-venta-fila{display:flex;gap:10px;align-items:center;background:#fff;border-radius:15px;padding:10px 12px;box-shadow:0 1px 2px rgba(16,24,29,.05)}
.pm-venta-fila>span{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}
.pm-venta-fila>div{flex:1;min-width:0}.pm-venta-fila b{display:block;font-size:12.5px;color:#10181D}.pm-venta-fila small{display:block;font-size:10.5px;color:#7A8790}
.pm-venta-fila em{display:block;font-style:normal;font-size:10.5px;color:#4F5D67;font-weight:600}.pm-monto{font-size:13px !important;white-space:nowrap}
.pm-caja{background:#fff;border-radius:20px;padding:12px 14px;box-shadow:0 1px 2px rgba(16,24,29,.05);display:flex;flex-direction:column;gap:11px}
.pm-caja-f{display:flex;gap:10px;align-items:center}.pm-caja-f>span{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
.pm-caja-f>div{flex:1}.pm-caja-t{display:flex;justify-content:space-between;font-size:12.5px}.pm-caja-t b{color:#10181D}.pm-caja-t em{font-style:normal;font-weight:700;color:#10181D}
.pm-caja-f i{display:block;height:5px;border-radius:3px;background:#EEF2F5;margin-top:5px;overflow:hidden}.pm-caja-f u{display:block;height:100%;border-radius:3px}
.pm-caja-tot{display:flex;justify-content:space-between;align-items:baseline;border-top:1px dashed #D5DDE3;padding-top:10px}.pm-caja-tot span{font-size:12px;color:#6B7780}.pm-caja-tot b{font-size:19px;color:#10181D;letter-spacing:-.02em}
@media (max-width:980px){.ope{flex-direction:column;gap:26px}.ope-lado{max-width:560px;align-items:flex-start}}
`}</style>;
}
