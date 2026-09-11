import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, ClipboardPlus, ClipboardList, Users, CalendarDays, Search, CheckCircle2, AlertTriangle,
  Fuel, MapPin, UserRound, ChevronRight, ChevronLeft, Download, X, Truck, Clock3, CircleDot, Check, FileText,
  Radio, RefreshCw, CarFront, Factory, Droplets, Caravan, ClipboardCheck, RotateCcw, History,
} from "lucide-react";
import {
  EMPRESA, LOGO_GASLARA, HOY, descargar, csv, num, fecha, fechaGuion, kgALitros, kgDeSolicitud, cpt, usr,
  comunaOf, estadoSolicitud, ESTADOS_SOLICITUD, motivoNoEntrega, diasEntre, sumarDias, finDeCiclo, esCodigoGenerico,
} from "./datos.jsx";
import {
  ESTADOS_AD, TIPOS_AD, estadoAD, adPlanificada, adActiva, adCerrada, tipoAD, tipoADInfo, personasDeAD,
  convocadasDeAD, cuadreJornada, siguienteAccionAD, fichaUsuario360,
} from "./flujo.js";
import {
  UNIDADES_DISTRIBUCION, OPERADORES_DISTRIBUCION, unidadDistribucion, operadorDistribucion, operadoresParaUnidad,
  disponibilidadUnidad,
} from "./distribucionSeed.js";
import Usuario360Modal from "./Usuario360.jsx";
import { KgL, UnidadesStyles } from "./Unidades.jsx";
import EjecucionAD from "./DistribucionEjecucion.jsx";
import { ListaPersonasAD, CuadreChips, PersonasStyles, problemaDe, resultadoDe } from "./DistribucionPersonas.jsx";
import { FlotaDistribucion, Reasignar, OpcionesUnidad, aISO, deISO, conductorDe, unidadLista } from "./DistribucionExtra.jsx";
import { MovimientoPlanta, GranelDistribucion, PlantaMovil } from "./DistribucionPlanta.jsx";

/* ════════════════════════════════════════════════════════════════
   DISTRIBUCIÓN · el backoffice logístico

   Todo lo que se ve aquí sale del estado vivo del sistema: las solicitudes (`pedidos`,
   `gruposPlanificar`, `bandeja`) y las cifras únicas (`cifras`). Un pedido que entra por el
   portal o por taquilla aparece en «Pedidos en tiempo real» en el mismo instante.

   Todo es prepago: sólo se planifican pedidos pagados completos. El camión sale vacío a
   recoger: recolección en el punto → llenado en planta → devolución al mismo punto → cierre.
   Lo que falla va a replanificación y se atiende en una AD especial por usuario.
   ════════════════════════════════════════════════════════════════ */

const TONO = { gris: "slate", ambar: "amber", verde: "green", azul: "blue", rojo: "red" };
const tipoFlota = { FUERZA_PROPIA: "Fuerza propia", EPSDC: "EPSDC", POR_ASIGNAR: "Por asignar" };
const PAGO_TAG = {
  "PAGO VERIFICADO": ["green", "Verificado"], "POR COMPLETAR": ["amber", "Por completar"], "PAGO RECHAZADO": ["red", "Rechazado"],
  "SIN PAGO": ["slate", "Sin pago"], "NO REQUIERE PAGO": ["blue", "No requiere pago"],
};
// Sólo mientras el pedido sigue vivo tiene sentido contar sus días de espera.
const VIVOS = ["SIN_PAGO", "POR_COMPLETAR", "PAGADA", "EN_AD", "POR_REPLANIFICAR"];
// Un AD se reasigna mientras no ha salido: después ya tiene precio fijado y gente recogida.
const EDITABLE = ["ASIGNADA", "REPROGRAMADA"];
const totalCil = (c) => Object.values(c || {}).reduce((a, v) => a + Number(v || 0), 0);
const cant = (n, uno, varios) => `${num(n)} ${Number(n) === 1 ? uno : varios}`;
const dias = (n) => cant(n, "día", "días");
// Cerrado el AD, lo que cuenta es lo entregado; mientras corre, lo convocado.
const kgAD = (c) => (c.cerrada ? c.kgSalida : c.kgConvocado);
// Una AD especial toma lo que está por replanificar y lo pagado que no tiene AD.
const elegibleEspecial = (s) => s.estado === "POR_REPLANIFICAR" || (s.estado === "PAGADA" && !s.ad);

export default function Distribucion(props) {
  const {
    rutasDistribucion: rutas = [], solicitudes = [], pedidos = [], gruposPlanificar = [], bandeja = [], cifras,
    facturas = [], abonos = [], actualizarRutaDistribucion = () => {},
    planificarAD = () => ({ ok: false, error: "La planificación no está disponible." }),
    abonarPedido = () => ({ ok: false, error: "El abono no está disponible." }),
  } = props;
  const [vista, setVista] = useState("inicio");
  const [wizard, setWizard] = useState(null);
  const [especial, setEspecial] = useState(null);
  // Se guarda el id y no la ruta: el detalle lee siempre la versión viva del AD.
  const [detalle, setDetalle] = useState(null);
  const [usuario360, setUsuario360] = useState(null);
  const [toast, setToast] = useState(null);
  const reloj = useRef(null);
  const aviso = (m, tono = "ok") => {
    clearTimeout(reloj.current);
    setToast({ m, tono });
    reloj.current = setTimeout(() => setToast(null), tono === "warn" ? 6500 : 2600);
  };
  useEffect(() => () => clearTimeout(reloj.current), []);

  const pagadasSinAD = useMemo(() => pedidos.filter((p) => p.estado === "PAGADA").length, [pedidos]);
  const rutaDetalle = detalle ? rutas.find((r) => r.id === detalle) : null;
  // Distribución ve la misma trazabilidad que Comercialización, sin importes.
  const ficha = useMemo(() => (usuario360
    ? fichaUsuario360(usuario360, { solicitudes, facturas, abonos, rutas }, { modo: "distribucion" }) : null),
  [usuario360, solicitudes, facturas, abonos, rutas]);

  function planificado(res, n) {
    setWizard(null); setEspecial(null);
    const txt = `AD ${res.ruta.ad} planificada · ${num(n)} pedido${n === 1 ? "" : "s"} convocado${n === 1 ? "" : "s"}`;
    if (res.aviso) aviso(`${txt}. ${res.aviso}`, "warn"); else aviso(txt);
  }
  const abrirPlan = (g) => setWizard({ grupo: g });
  const abrirEspecial = (ids = []) => setEspecial({ ids });

  return <div className="dx">
    <Estilos />
    <UnidadesStyles />
    <PersonasStyles />
    <aside className="dx-side">
      <div className="dx-brand"><img src={LOGO_GASLARA} alt="" /><div><b>Distribución</b><span>{EMPRESA.nombre}</span></div></div>
      <p>Recibe los pedidos pagados, los agrupa por comunidad en jornadas, arma AD especiales para lo que hay que replanificar y asigna vehículo, conductor y ayudante.</p>
      <nav>
        <Nav id="inicio" icon={LayoutDashboard} label="Resumen" {...{ vista, setVista }} />
        <Nav id="pedidos" icon={Radio} label="Pedidos en tiempo real" badge={pagadasSinAD} {...{ vista, setVista }} />
        <Nav id="ads" icon={ClipboardList} label="AD del día" badge={cifras?.ad?.porPlanificar} {...{ vista, setVista }} />
        <Nav id="replan" icon={RotateCcw} label="Replanificación" badge={cifras?.replanificacion?.n} {...{ vista, setVista }} />
        <Nav id="ejecucion" icon={ClipboardCheck} label="Ejecución y cierre" badge={cifras?.ad?.enJornada} {...{ vista, setVista }} />
        <Nav id="flota" icon={CarFront} label="Flota y operadores" {...{ vista, setVista }} />
        <Nav id="planta" icon={Factory} label="Movimiento de planta" {...{ vista, setVista }} />
        <Nav id="granel" icon={Droplets} label="Granel" {...{ vista, setVista }} />
        <Nav id="movil" icon={Caravan} label="Planta móvil" {...{ vista, setVista }} />
        <Nav id="comunas" icon={Users} label="Comunas y usuarios" {...{ vista, setVista }} />
      </nav>
      <div className="dx-rule"><small>Flujo</small><b>Pagado → AD → Recolección → Llenado → Devolución → Cierre</b>
        <span>El camión sale vacío a recoger las bombonas en el punto y las devuelve al mismo punto. El cierre lo firma Distribución.</span></div>
    </aside>

    <main className="dx-main">
      <header className="dx-head"><div><span>C.D.T. GRAL. JACINTO LARA</span><h1>{titulo(vista)}</h1><p>{subtitulo(vista)}</p></div>
        <div className="dx-date"><CalendarDays size={15} />{fecha(HOY)}</div></header>
      {vista === "inicio" && cifras && <Inicio {...{ cifras, rutas, solicitudes, grupos: gruposPlanificar, setVista, setDetalle }} onPlanificar={abrirPlan} />}
      {vista === "pedidos" && <Pedidos {...{ pedidos, solicitudes, rutas, aviso }} onEspecial={abrirEspecial} onVerUsuario={setUsuario360} />}
      {vista === "ads" && <ADs {...{ rutas, solicitudes, aviso, setDetalle }} grupos={gruposPlanificar} actualizar={actualizarRutaDistribucion}
        onPlanificar={abrirPlan} onVerUsuario={setUsuario360} />}
      {vista === "replan" && cifras && <Replanificacion {...{ bandeja, rutas, solicitudes, cifras, abonarPedido, aviso, setDetalle }}
        onEspecial={abrirEspecial} onVerUsuario={setUsuario360} />}
      {vista === "ejecucion" && <EjecucionAD {...props} aviso={aviso} />}
      {vista === "flota" && <FlotaDistribucion rutas={rutas} solicitudes={solicitudes} />}
      {vista === "planta" && <MovimientoPlanta {...props} aviso={aviso} />}
      {vista === "granel" && <GranelDistribucion {...props} aviso={aviso} />}
      {vista === "movil" && <PlantaMovil {...props} aviso={aviso} />}
      {vista === "comunas" && <Comunas pedidos={pedidos} onVerUsuario={setUsuario360} />}
    </main>

    {wizard && <WizardAD grupo={wizard.grupo} rutas={rutas} planificarAD={planificarAD} onClose={() => setWizard(null)} onDone={planificado} />}
    {especial && <WizardADEspecial ids={especial.ids} bandeja={bandeja} solicitudes={solicitudes} rutas={rutas} planificarAD={planificarAD}
      onClose={() => setEspecial(null)} onDone={planificado} />}
    {rutaDetalle && <DetalleAD ruta={rutaDetalle} solicitudes={solicitudes} actualizar={actualizarRutaDistribucion} aviso={aviso}
      onClose={() => setDetalle(null)} onVerUsuario={setUsuario360} />}
    {ficha && <Usuario360Modal mode="distribucion" {...ficha} onClose={() => setUsuario360(null)} />}
    {toast && <div className={`dx-toast ${toast.tono}`}>{toast.tono === "warn" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}{toast.m}</div>}
  </div>;
}

function Nav({ id, icon: I, label, badge = 0, vista, setVista }) {
  return <button className={vista === id ? "on" : ""} onClick={() => setVista(id)}><I size={17} /><span>{label}</span>{badge > 0 && <em>{num(badge)}</em>}</button>;
}

/* ── RESUMEN ───────────────────────────────────────────────────────────────────
   Todas las cifras salen de `cifras`: son las mismas que ven el Centro de gestión,
   Comercialización y la portada. Aquí no se recalcula nada. */
function Inicio({ cifras, rutas, solicitudes, grupos, setVista, setDetalle, onPlanificar }) {
  const ad = cifras.ad, rep = cifras.replanificacion;
  const est = (id) => Number(ad.porEstado?.[id] || 0);
  // AD en curso: primero las que están más cerca del cierre.
  const enCurso = useMemo(() => rutas.filter(adActiva).map((r) => ({ r, c: cuadreJornada(r, solicitudes) }))
    .sort((a, b) => estadoAD(b.r.estadoRuta).momento - estadoAD(a.r.estadoRuta).momento || b.c.convocadas - a.c.convocadas)
    .slice(0, 6), [rutas, solicitudes]);

  return <div className="dx-content">
    <FuentesDistribucion cifras={cifras} setVista={setVista} />
    <div className="dx-kpis">
      <Kpi icon={ClipboardList} label="AD planificadas" value={num(ad.planificadas)}
        foot={`${cant(ad.activas, "activa", "activas")} · ${cant(ad.cerradas, "cerrada", "cerradas")}${ad.especiales ? ` · ${cant(ad.especiales, "especial", "especiales")}` : ""}`} />
      <Kpi icon={Truck} label="AD en jornada" value={num(ad.enJornada)} foot="En recolección, en planta o devueltas al punto" />
      <Kpi icon={Users} label="Convocadas" value={num(ad.convocadas)} foot={<>{num(ad.cilindrosConvocados)} bombonas · <KgL kg={ad.kgConvocado} /></>} />
      <Kpi icon={CheckCircle2} label="Entregadas" value={num(ad.entregadas)} foot="Devueltas llenas al punto y facturadas al cerrar su AD" />
      <Kpi icon={Clock3} label="Por planificar" value={num(ad.porPlanificar)} foot={`${num(ad.personasPorPlanificar)} pedidos pagados esperan jornada`} />
      <Kpi icon={RotateCcw} label="Por replanificar" value={num(rep.n)}
        foot={rep.prioridad ? `${num(rep.prioridad)} con prioridad · falla de la empresa` : "Esperan una AD especial por usuario"} />
    </div>

    <div className="dx-grid two">
      <Card title="Por planificar" subtitle="Comunidades con pedidos pagados que todavía no tienen AD. Sólo entran los pagados completos."
        action={grupos.length > 5 && <button className="dx-link" onClick={() => setVista("ads")}>Ver las {grupos.length} <ChevronRight size={14} /></button>}>
        <div className="dx-list">
          {grupos.length ? grupos.slice(0, 5).map((g) => <div className="dx-list-row" key={g.clave}>
            <div><b>{g.comunidad}</b><span>{g.comuna} · {cant(g.personas, "pagado", "pagados")} · {dias(g.diasEspera)} esperando</span></div>
            <button className="dx-primary" onClick={() => onPlanificar(g)}><ClipboardPlus size={14} />Planificar AD</button>
          </div>) : <Empty text="No hay pedidos pagados esperando jornada." />}
        </div>
      </Card>
      <Card title="Momentos de la jornada" subtitle="Cada AD avanza por los mismos momentos hasta su cierre."
        action={est("EN_PUNTO") > 0 && <button className="dx-link" onClick={() => setVista("ejecucion")}>{num(est("EN_PUNTO"))} por cerrar <ChevronRight size={14} /></button>}>
        <div className="dx-status">
          <Stat label="Planificadas" value={est("ASIGNADA") + est("REPROGRAMADA")} />
          <Stat label={estadoAD("EN_RUTA").nombre} value={est("EN_RUTA")} tone="blue" />
          <Stat label={estadoAD("EN_PLANTA").nombre} value={est("EN_PLANTA")} tone="blue" />
          <Stat label={estadoAD("EN_PUNTO").nombre} value={est("EN_PUNTO")} tone="green" />
          <Stat label={estadoAD("INCIDENCIA").nombre} value={est("INCIDENCIA")} tone={est("INCIDENCIA") ? "red" : "slate"} />
          <Stat label="Cerradas" value={est("CERRADA")} tone="green" />
        </div>
      </Card>
    </div>

    <Card title="AD en curso" subtitle="Las más cercanas al cierre primero. Cada una abre a su detalle y a su gente."
      action={<button className="dx-link" onClick={() => setVista("ads")}>Ver todas <ChevronRight size={14} /></button>}>
      {enCurso.length ? <div className="dx-ad-grid">{enCurso.map(({ r, c }) => {
        const sig = siguienteAccionAD(r);
        return <button className="dx-ad-card" key={r.id} onClick={() => setDetalle(r.id)}>
          <div className="dx-ad-top"><TagAD r={r} /><span>AD {r.ad}</span></div>
          <b>{r.comunidad}</b><p>{tipoADInfo(r).nombre} · {r.comuna}</p>
          <div className="dx-ad-foot"><span>{cant(c.convocadas, "convocada", "convocadas")}</span><span>Placa {r.unidad}</span></div>
          {sig && <small className="dx-ad-next">Siguiente: {sig.nombre}</small>}
        </button>;
      })}</div> : <Empty text="No hay AD activas." />}
    </Card>
  </div>;
}

/* Distribución no planifica en el vacío: toma los pedidos pagados de Comercialización, el gas
   del control de planta y las unidades con conductor y ayudante de Flota. El disponible de
   planta ya viene descontado de lo comprometido: no se vuelve a restar. */
function FuentesDistribucion({ cifras, setVista }) {
  const pend = cifras.dinero.pendienteDespacho, glp = cifras.glp;
  const flota = UNIDADES_DISTRIBUCION.filter((u) => !u.granel).map((u) => ({ u, d: disponibilidadUnidad(u, HOY), ops: operadoresParaUnidad(u.id) }));
  const listas = flota.filter((x) => x.d.disponible && x.ops.length);
  const trabadas = flota.filter((x) => !x.d.disponible || !x.ops.length);
  const motivos = (x) => (x.d.disponible ? ["Sin conductor habilitado"] : x.d.motivos);

  return <section className="dx-card">
    <div className="dx-card-head">
      <div><h2>Insumos para planificar</h2><p>Distribución se alimenta de Comercialización, del control de planta y de Flota. Estas tres cifras condicionan lo que se puede planificar hoy.</p></div>
    </div>
    <div className="dx-fuentes-grid">
      <button className="dx-fuente com" onClick={() => setVista("pedidos")}>
        <span>DESDE COMERCIALIZACIÓN</span>
        <b>{num(pend.n)}</b>
        <em>pedidos pagados pendientes por despachar</em>
        <small><KgL kg={pend.kg} /> por despachar · {num(cifras.ad.personasPorPlanificar)} esperan jornada · {num(cifras.replanificacion.n)} por replanificar</small>
      </button>
      <button className="dx-fuente ope" onClick={() => setVista("planta")}>
        <span>DESDE EL CONTROL DE PLANTA</span>
        <b><KgL kg={glp.disponible} /></b>
        <em>GLP disponible · ya descontado lo comprometido</em>
        <small><KgL kg={glp.fisico} /> físicos · <KgL kg={glp.comprometido} /> comprometidos con pedidos pagados</small>
      </button>
      <button className="dx-fuente flo" onClick={() => setVista("flota")}>
        <span>DESDE FLOTA</span>
        <b>{listas.length} / {flota.length}</b>
        <em>vehículos listos con conductor y ayudante</em>
        <small>{trabadas.length ? `${trabadas.length} no disponible(s): ${trabadas.map((x) => x.u.placa).join(", ")}` : "Toda la flota operativa"}</small>
      </button>
    </div>
    {trabadas.length > 0 && <div className="dx-flota-alerta">
      <AlertTriangle size={15} />
      <div><b>{trabadas.length} unidad(es) fuera de servicio</b>
        <span>{trabadas.map((x) => `${x.u.placa}: ${motivos(x).join(" · ")}`).join(" | ")}</span></div>
    </div>}
  </section>;
}

/* ── PEDIDOS EN TIEMPO REAL ────────────────────────────────────────────────────
   Una fila por solicitud de bombona, construida desde las solicitudes vivas. Lo más reciente
   arriba: lo que entra por el portal o por taquilla se ve primero. */
const F0 = {
  q: "", estado: "TODOS", pago: "TODOS", enAD: "TODOS", tipo: "TODOS", estadoAD: "TODOS", segmento: "TODOS",
  comuna: "TODAS", comunidad: "TODAS", parroquia: "TODAS", kg: "TODOS", placa: "TODAS", operador: "TODOS",
  antiguedad: "TODAS", periodo: "TODO",
};
const RANGOS = { "0_7": [0, 7], "8_15": [8, 15], "16_30": [16, 30], "31_MAS": [31, Infinity] };

function Pedidos({ pedidos, solicitudes, rutas, aviso, onEspecial, onVerUsuario }) {
  const [f, setF] = useState(F0);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v, ...(k === "comuna" ? { comunidad: "TODAS" } : {}) }));
  const [pagina, setPagina] = useState(1);
  const [sel, setSel] = useState(() => new Set());
  const pageSize = 60;

  const filas = useMemo(() => {
    const solPorId = new Map(solicitudes.map((s) => [s.id, s]));
    const rutaPorId = new Map(rutas.map((r) => [r.id, r]));
    return pedidos.map((p) => {
      const s = solPorId.get(p.solicitudId) || {};
      const alta = s.fecha instanceof Date ? s.fecha : new Date(s.fecha || HOY);
      // El AD del pedido: aquel en que está o en el que se entregó. Estar en la lista de una
      // comunidad sin haber pagado no es estar en su AD.
      const r = p.rutaId ? rutaPorId.get(p.rutaId) : null;
      const adR = r && p.ad && String(p.ad) === String(r.ad) && adPlanificada(r) ? r : null;
      return {
        ...p, alta, orden: Number(String(p.id).replace(/\D/g, "")) || 0,
        // La espera se cuenta desde el pago, igual que la espera de un grupo por planificar.
        dias: Math.max(0, diasEntre(s.pago?.fecha || alta, HOY)),
        tipo: adR ? tipoAD(adR) : null, estadoDelAD: adR ? estadoAD(adR.estadoRuta).id : null, elegible: elegibleEspecial(p),
      };
    }).sort((a, b) => b.alta - a.alta || b.orden - a.orden);
  }, [pedidos, solicitudes, rutas]);

  const opciones = useMemo(() => ({
    comunas: [...new Set(filas.map((p) => p.comuna).filter(Boolean))].sort(),
    parroquias: [...new Set(filas.map((p) => p.parroquia).filter(Boolean))].sort(),
    kgs: [...new Set(filas.map((p) => p.kg).filter(Boolean))].sort((a, b) => a - b),
  }), [filas]);
  const comunidades = useMemo(() => [...new Set(filas.filter((p) => f.comuna === "TODAS" || p.comuna === f.comuna)
    .map((p) => p.comunidad).filter(Boolean))].sort(), [filas, f.comuna]);

  const filtrados = useMemo(() => {
    const qq = f.q.trim().toLowerCase();
    return filas.filter((p) => {
      if (qq && ![p.id, p.nombre, p.cedula, p.comuna, p.comunidad, p.ad].filter(Boolean).join(" ").toLowerCase().includes(qq)) return false;
      if (f.estado !== "TODOS" && p.estado !== f.estado) return false;
      if (f.pago !== "TODOS" && p.estadoPago !== f.pago) return false;
      if (f.enAD === "EN_AD" && !p.incluidoAD) return false;
      if (f.enAD === "SIN_AD" && p.incluidoAD) return false;
      if (f.tipo !== "TODOS" && p.tipo !== f.tipo) return false;
      if (f.estadoAD !== "TODOS" && p.estadoDelAD !== f.estadoAD) return false;
      if (f.segmento !== "TODOS" && p.segmento !== f.segmento) return false;
      if (f.comuna !== "TODAS" && p.comuna !== f.comuna) return false;
      if (f.comunidad !== "TODAS" && p.comunidad !== f.comunidad) return false;
      if (f.parroquia !== "TODAS" && p.parroquia !== f.parroquia) return false;
      if (f.kg !== "TODOS" && String(p.kg) !== f.kg) return false;
      if (f.placa !== "TODAS" && p.unidad !== f.placa) return false;
      if (f.operador !== "TODOS" && p.operadorId !== f.operador) return false;
      if (f.antiguedad !== "TODAS") { const [a, b] = RANGOS[f.antiguedad]; if (p.dias < a || p.dias > b) return false; }
      if (f.periodo !== "TODO") {
        const d = diasEntre(p.alta, HOY);
        if (f.periodo === "HOY" && d !== 0) return false;
        if (f.periodo === "SEMANA" && (d < 0 || d > 6)) return false;
        if (f.periodo === "MES" && (p.alta.getMonth() !== HOY.getMonth() || p.alta.getFullYear() !== HOY.getFullYear())) return false;
      }
      return true;
    });
  }, [filas, f]);
  useEffect(() => setPagina(1), [f]);

  const pages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const visible = filtrados.slice((pagina - 1) * pageSize, pagina * pageSize);
  const conteo = useMemo(() => ({
    pagados: filtrados.filter((p) => p.pagado).length,
    porPlanificar: filtrados.filter((p) => p.estado === "PAGADA").length,
    enAD: filtrados.filter((p) => p.incluidoAD).length,
    kg: filtrados.reduce((a, p) => a + Number(p.totalKg || 0), 0),
  }), [filtrados]);
  // Lo que ya entró a un AD deja de estar seleccionable solo.
  const seleccionados = useMemo(() => filas.filter((p) => sel.has(p.id) && p.elegible), [filas, sel]);
  const toggle = (p) => { if (!p.elegible) return; setSel((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }); };
  const seleccionarElegibles = () => setSel((prev) => { const n = new Set(prev); filtrados.filter((p) => p.elegible).forEach((p) => n.add(p.id)); return n; });

  function exportar() {
    const rows = filtrados.map((p) => [p.id, p.fechaPedido, p.nombre, p.cedula, p.segmento, p.parroquia, p.comuna, p.comunidad,
      p.estadoNombre, p.estadoPago, VIVOS.includes(p.estado) ? p.dias : "", p.cantidad, p.kg, p.totalKg, kgALitros(p.totalKg).toFixed(2),
      p.ad || "", p.tipo ? tipoADInfo({ tipoAD: p.tipo }).nombre : "", p.estadoDelAD ? estadoAD(p.estadoDelAD).nombre : "",
      p.unidad || "", p.conductor || "", p.problema?.nombre || ""]);
    descargar(`pedidos-distribucion-${fechaGuion(HOY)}.csv`, csv([["PEDIDOS DE DISTRIBUCIÓN", fecha(HOY)],
      ["Pedido", "Fecha", "Solicitante", "Cédula/RIF", "Segmento", "Parroquia", "Comuna", "Comunidad", "Estado", "Pago", "Días desde el pago",
        "Cantidad", "Kg por unidad", "Kg total", "Litros", "AD", "Tipo de AD", "Estado del AD", "Placa", "Conductor", "Problema"], ...rows]));
    aviso("Listado de pedidos exportado");
  }

  return <div className="dx-content">
    <div className="dx-livebar"><div><Radio size={15} /><b>Pedidos en vivo</b><span>Cada fila es una solicitud del sistema: lo que entra por el portal o por taquilla aparece aquí al instante.</span></div>
      <button className="dx-primary" disabled={!seleccionados.length} onClick={() => onEspecial(seleccionados.map((p) => p.id))}><ClipboardPlus size={14} />Crear AD especial {seleccionados.length ? `(${seleccionados.length})` : ""}</button></div>
    <div className="dx-kpis orders">
      <Kpi icon={ClipboardList} label="Pedidos visibles" value={num(filtrados.length)} foot={`${num(conteo.pagados)} pagados · ${num(conteo.porPlanificar)} por planificar`} />
      <Kpi icon={FileText} label="Dentro de un AD" value={num(conteo.enAD)} foot={`${num(filtrados.length - conteo.enAD)} fuera de AD`} />
      <Kpi icon={Fuel} label="GLP solicitado" value={<KgL kg={conteo.kg} />} foot="Se factura por kilo y se mide por litro" />
      <Kpi icon={Users} label="Selección" value={num(seleccionados.length)} foot={seleccionados.length ? "Lista para una AD especial" : "Pagados sin AD o por replanificar"} />
    </div>
    <Card title="Bandeja individual de pedidos" subtitle="Filtra, revisa y abre la ficha de cualquier pedido. Todo es prepago: sólo lo pagado entra a un AD."
      action={<button className="dx-secondary" onClick={exportar}><Download size={14} />CSV</button>}>
      <div className="dx-orders-help">
        <div><b>Jornada comunal</b><span>Los pagados de una comunidad se planifican juntos desde AD del día › Por planificar. La gente lleva su bombona al punto.</span></div>
        <div><b>AD especial por usuario</b><span>Ruta por domicilio para lo que está por replanificar o para pagados sin AD, como las entregas directas de comercio.</span></div>
      </div>
      <div className="dx-orders-filters">
        <div className="dx-search wide"><Search size={15} /><input value={f.q} onChange={(e) => set("q")(e.target.value)} placeholder="Buscar pedido, persona, cédula, comuna o AD" /></div>
        <FilterSelect label="Estado" value={f.estado} set={set("estado")} options={[["TODOS", "Todos"], ...ESTADOS_SOLICITUD.map((e) => [e.key, e.admin])]} />
        <FilterSelect label="Pago" value={f.pago} set={set("pago")} options={[["TODOS", "Todos"], ...Object.entries(PAGO_TAG).map(([k, [, l]]) => [k, l])]} />
        <FilterSelect label="AD" value={f.enAD} set={set("enAD")} options={[["TODOS", "Todos"], ["SIN_AD", "Sin AD"], ["EN_AD", "En AD"]]} />
        <FilterSelect label="Tipo de AD" value={f.tipo} set={set("tipo")} options={[["TODOS", "Todos"], ...TIPOS_AD.map((t) => [t.id, t.nombre])]} />
        <FilterSelect label="Estado del AD" value={f.estadoAD} set={set("estadoAD")} options={[["TODOS", "Todos"], ...ESTADOS_AD.filter((e) => e.id !== "SIN_PLANIFICAR").map((e) => [e.id, e.nombre])]} />
        <FilterSelect label="Segmento" value={f.segmento} set={set("segmento")} options={[["TODOS", "Todos"], ["RESIDENCIAL", "Residencial"], ["COMERCIAL", "Comercial"], ["INSTITUCIONAL", "Institucional"]]} />
        <FilterSelect label="Comuna" value={f.comuna} set={set("comuna")} options={[["TODAS", "Todas"], ...opciones.comunas.map((x) => [x, x])]} />
        <FilterSelect label="Comunidad" value={f.comunidad} set={set("comunidad")} options={[["TODAS", "Todas"], ...comunidades.map((x) => [x, x])]} />
        <FilterSelect label="Parroquia" value={f.parroquia} set={set("parroquia")} options={[["TODAS", "Todas"], ...opciones.parroquias.map((x) => [x, x])]} />
        <FilterSelect label="Bombona" value={f.kg} set={set("kg")} options={[["TODOS", "Todas"], ...opciones.kgs.map((k) => [String(k), `${k} kg`])]} />
        <FilterSelect label="Vehículo" value={f.placa} set={set("placa")} options={[["TODAS", "Todas las placas"], ...UNIDADES_DISTRIBUCION.filter((u) => !u.granel).map((u) => [u.placa, u.placa])]} />
        <FilterSelect label="Conductor" value={f.operador} set={set("operador")} options={[["TODOS", "Todos"], ...OPERADORES_DISTRIBUCION.map((o) => [o.id, `${o.nombre} · ${o.cedula}`])]} />
        <FilterSelect label="Días desde el pago" value={f.antiguedad} set={set("antiguedad")} options={[["TODAS", "Todas"], ["0_7", "0–7 días"], ["8_15", "8–15 días"], ["16_30", "16–30 días"], ["31_MAS", "+30 días"]]} />
        <FilterSelect label="Fecha del pedido" value={f.periodo} set={set("periodo")} options={[["TODO", "Todas"], ["HOY", "Hoy"], ["SEMANA", "Últimos 7 días"], ["MES", "Este mes"]]} />
        <button className="dx-clear" onClick={() => setF(F0)}><X size={13} />Limpiar filtros</button>
      </div>
      <div className="dx-selectionbar"><div><b>{seleccionados.length} seleccionados</b><span>Sólo se seleccionan pagados sin AD o por replanificar</span></div>
        <div><button className="dx-secondary" onClick={seleccionarElegibles}>Seleccionar los elegibles filtrados</button>
          <button className="dx-secondary" onClick={() => setSel(new Set())}>Limpiar selección</button>
          <button className="dx-primary" disabled={!seleccionados.length} onClick={() => onEspecial(seleccionados.map((p) => p.id))}><ClipboardPlus size={14} />Crear AD especial</button></div></div>
      <div className="dx-table-wrap orders-table"><table className="dx-table"><thead><tr>
        <th></th><th>Pedido</th><th>Solicitante</th><th>Comuna / comunidad</th><th>Estado</th><th>Pago</th><th>Espera</th><th>Solicitud</th><th>GLP</th><th>AD</th><th>Logística</th><th>Acción</th>
      </tr></thead><tbody>{visible.map((p) => {
        const [tonoPago, textoPago] = PAGO_TAG[p.estadoPago] || ["slate", p.estadoPago];
        return <tr key={p.id} className={p.estado === "SIN_PAGO" || p.estado === "POR_COMPLETAR" ? "muted" : ""}>
          <td><input type="checkbox" disabled={!p.elegible} checked={sel.has(p.id) && p.elegible} onChange={() => toggle(p)} /></td>
          <td><b>{p.id}</b><span>{p.fechaPedido}{p.horaPedido && p.horaPedido !== "—" ? ` · ${p.horaPedido}` : ""}</span></td>
          <td><b>{p.nombre}</b><span>{p.cedula} · {p.segmento}</span></td>
          <td><b>{p.comunidad}</b><span>{p.comuna}</span></td>
          <td><TagSol k={p.estado} />{p.problema && <span>{p.problema.nombre}</span>}</td>
          <td><Tag tone={tonoPago}>{textoPago}</Tag></td>
          <td>{VIVOS.includes(p.estado) ? <Tag tone={p.dias >= 31 ? "red" : p.dias >= 16 ? "amber" : "slate"}>{dias(p.dias)}</Tag> : <span>—</span>}</td>
          <td><b>{p.cantidad} × {p.kg} kg</b></td>
          <td><b><KgL kg={p.totalKg} /></b></td>
          <td>{p.ad ? <><b>{p.ad}</b><span>{p.tipo ? tipoADInfo({ tipoAD: p.tipo }).nombre : "—"}</span></> : <Tag tone="slate">Sin AD</Tag>}</td>
          <td>{p.incluidoAD ? <><b>{p.unidad}</b><span>{p.conductor} · {estadoAD(p.estadoRuta).nombre}</span></>
            : <span>{p.estadoDelAD ? `AD ${estadoAD(p.estadoDelAD).nombre.toLowerCase()}` : p.elegible ? "Disponible para AD especial" : "—"}</span>}</td>
          <td><div className="dx-row-actions"><button className="dx-user-link" onClick={() => onVerUsuario(p.usuario)}>Ver usuario</button>
            {p.elegible && <button className="dx-row-plan" onClick={() => onEspecial([p.id])}><ClipboardPlus size={12} />AD especial</button>}</div></td>
        </tr>;
      })}</tbody></table>
        {!visible.length && <div className="dx-vacio-seg">Ningún pedido coincide con los filtros.</div>}</div>
      <div className="dx-pagination"><span>Mostrando {visible.length} de {num(filtrados.length)} pedidos · página {pagina} de {pages}</span>
        <div><button className="dx-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}>Anterior</button>
          <button className="dx-secondary" disabled={pagina >= pages} onClick={() => setPagina((p) => Math.min(pages, p + 1))}>Siguiente</button></div></div>
    </Card>
  </div>;
}

function FilterSelect({ label, value, set, options }) {
  return <label className="dx-filter-select"><span>{label}</span><select value={value} onChange={(e) => set(e.target.value)}>
    {options.map(([v, l]) => <option key={`${label}-${v}`} value={v}>{l}</option>)}</select></label>;
}

/* La vista Planificar se retiro el 01/09/2026: es el segmento «Por planificar» de
   AD del dia. Eran la misma lista de comunidades con el mismo boton, en dos
   pantallas distintas. */

/* ── AD DEL DÍA ────────────────────────────────────────────────────────────────
   Una sola pantalla para las AD, con un segmento por momento: por planificar, planificadas,
   en recolección, en planta, devueltas al punto, con incidencia y cerradas. El AD conserva su
   peso —la ruta, el camión, el conductor y el ayudante— y se abre a su gente.
   Antes del AD lo único que decide quién entra es el pago; lo que ocurra con las bombonas se
   sabe en el punto y en la planta, y se registra en Ejecución y cierre. */
const SEGMENTOS = [
  ["SIN_PLANIFICAR", "Por planificar"],
  ["PLANIFICADAS", "Planificadas", (r) => EDITABLE.includes(estadoAD(r.estadoRuta).id)],
  ...["EN_RUTA", "EN_PLANTA", "EN_PUNTO", "INCIDENCIA"].map((id) => [id, estadoAD(id).nombre, (r) => estadoAD(r.estadoRuta).id === id]),
  ["CERRADA", "Cerradas", adCerrada],
  ["TODAS", "Todas", () => true],
];

function ADs({ rutas, solicitudes, grupos, aviso, actualizar, onPlanificar, setDetalle, onVerUsuario }) {
  const [buscar, setBuscar] = useState("");
  const [seg, setSeg] = useState("TODAS");
  const [abierta, setAbierta] = useState(null);
  const [reasignar, setReasignar] = useState(null);
  const [doc, setDoc] = useState(null);

  const planificadas = useMemo(() => rutas.filter(adPlanificada), [rutas]);
  const cuadres = useMemo(() => new Map(planificadas.map((r) => [r.id, cuadreJornada(r, solicitudes)])), [planificadas, solicitudes]);
  // Gente de la lista de cada AD activa que no entra porque su pago no está completo.
  const fueraPorPago = useMemo(() => new Map(planificadas.filter(adActiva).map((r) => [r.id,
    personasDeAD(r, solicitudes).filter((s) => s.rutaId === r.id && problemaDe(s)).length])), [planificadas, solicitudes]);
  const fuera = [...fueraPorPago.values()].reduce((a, n) => a + n, 0);

  const qq = buscar.trim().toLowerCase();
  const filtro = (k) => SEGMENTOS.find((x) => x[0] === k)?.[2] || (() => true);
  const coincide = (r) => !qq || [r.ad, r.comuna, r.comunidad, r.parroquia, r.unidad, r.conductor, r.ayudante, r.ruta, tipoADInfo(r).nombre]
    .filter(Boolean).join(" ").toLowerCase().includes(qq);
  const lista = seg === "SIN_PLANIFICAR" ? [] : planificadas.filter(filtro(seg)).filter(coincide);
  const gruposVis = grupos.filter((g) => !qq || [g.comuna, g.comunidad, g.parroquia].filter(Boolean).join(" ").toLowerCase().includes(qq));
  const cuenta = (k) => (k === "SIN_PLANIFICAR" ? grupos.length : planificadas.filter(filtro(k)).length);
  const aExportar = seg === "SIN_PLANIFICAR" ? planificadas : lista;
  const tot = lista.reduce((a, r) => ({ cil: a.cil + totalCil(r.cilindros), conv: a.conv + (cuadres.get(r.id)?.convocadas || 0) }), { cil: 0, conv: 0 });

  function exportarADs() {
    const vacio = (n) => (n == null ? "" : n);
    const rows = [["REPORTE DE AD", fecha(HOY)], [], ["AD", "Tipo", "Estado", "Comuna", "Comunidad", "Ruta", "Fecha de jornada", "Placa", "Conductor", "Ayudante",
      "Bombonas planificadas", "Bombonas en la hoja", "Convocadas", "Recogidas", "No recogidas", "Llenas", "Volvieron vacías", "Entregadas", "A replanificación", "Abonadas", "Kg", "Litros"]];
    aExportar.forEach((r) => {
      const c = cuadres.get(r.id);
      rows.push([r.ad, tipoADInfo(r).nombre, estadoAD(r.estadoRuta).nombre, r.comuna, r.comunidad, r.ruta || "", fecha(r.fechaJornada || r.fechaPlan),
        r.unidad || "", r.conductor || "", r.ayudante || "", totalCil(r.cilindros), r.cilindrosHoja ? totalCil(r.cilindrosHoja) : "",
        c.convocadas, vacio(c.recogidas), c.noRecogidas, vacio(c.llenadas), c.noLlenadas, vacio(c.entregadas), vacio(c.replanificadas), vacio(c.abonadas),
        kgAD(c), kgALitros(kgAD(c)).toFixed(2)]);
    });
    descargar(`ad-distribucion-${fechaGuion(HOY)}.csv`, csv(rows));
    aviso("Reporte de AD exportado");
  }

  return <div className="dx-content">
    <div className="dx-toolbar"><div className="dx-search"><Search size={15} /><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar AD, comuna, placa, conductor o ruta" /></div></div>

    {fuera > 0 && <div className="dx-flota-alerta"><AlertTriangle size={16} />
      <div><b>{num(fuera)} personas de las listas de AD activas no entran a la jornada por el pago.</b>
        <span>Antes del AD lo único que decide es el pago: sin pago, rechazado o por completar. Cuando completen su pago quedan pagadas
          y se atienden en una AD especial por usuario.</span></div></div>}

    <Card title="AD del día"
      subtitle="Cada AD abre a su gente. Sólo entran pedidos pagados completos; el camión sale vacío a recoger y vuelve al mismo punto."
      action={<div className="dx-report-actions">
        <button className="dx-secondary" onClick={exportarADs}><Download size={14} />CSV</button>
        <button className="dx-primary" disabled={!lista.length} onClick={() => setDoc(lista)}><FileText size={14} />Imprimir {lista.length ? num(lista.length) : ""}</button>
      </div>}>
      <div className="dx-segmentos">
        {SEGMENTOS.map(([k, l]) => <button key={k} className={seg === k ? "on" : ""} onClick={() => { setSeg(k); setAbierta(null); }}>{l} <em>{num(cuenta(k))}</em></button>)}
      </div>

      {seg === "SIN_PLANIFICAR"
        ? <div className="dx-community-list">
            {gruposVis.map((g) => <div className="dx-community" key={g.clave}>
              <div className="dx-community-main"><Tag tone="amber">{tipoADInfo({ bloque: g.bloque }).nombre}</Tag>
                <div><b>{g.comunidad}</b><span>{g.comuna}{g.parroquia ? ` · ${g.parroquia}` : ""} · {dias(g.diasEspera)} esperando</span></div></div>
              <div className="dx-community-counts">
                <div><span>Pagados</span><b>{num(g.personas)}</b></div>
                <div><span>Bombonas</span><b>{num(totalCil(g.cilindros))}</b></div>
                <div><span>GLP</span><b><KgL kg={g.kg} /></b></div>
                <div><span>Fuera por el pago</span><b>{num(g.sinPago + g.porCompletar)}</b></div></div>
              <button className="dx-primary" onClick={() => onPlanificar(g)}><ClipboardPlus size={14} />Planificar AD</button>
            </div>)}
            {!gruposVis.length && <div className="dx-vacio-seg">No hay pedidos pagados esperando jornada.</div>}
          </div>
        : <div className="dx-table-wrap"><table className="dx-table"><thead><tr>
            <th>AD</th><th className="dp-ad-comuna">Comuna / comunidad</th><th className="dp-ad-carga">Bombonas y personas</th>
            <th className="dp-ad-ruta">Jornada y salida</th><th className="dp-ad-veh">Vehículo / conductor</th><th>Estado</th><th></th>
          </tr></thead><tbody>
            {lista.map((r) => {
              const c = cuadres.get(r.id); const ab = abierta === r.id;
              const cil = totalCil(r.cilindros), hoja = totalCil(r.cilindrosHoja);
              const sig = siguienteAccionAD(r);
              return <React.Fragment key={r.id}>
                <tr className={ab ? "dx-fila-on" : ""}>
                  <td><b>{r.ad}</b><span>{tipoADInfo(r).nombre}</span></td>
                  <td className="dp-ad-comuna"><b>{r.comunidad}</b><span>{r.comuna}</span></td>
                  <td className="dp-ad-carga"><b>{num(cil)} bombonas{hoja && hoja !== cil ? <em className="dx-hoja"> · planificado en hoja {num(hoja)}</em> : null}</b>
                    <span><KgL kg={kgAD(c)} /> {c.cerrada ? "entregados" : "convocados"}</span><CuadreChips c={c} fuera={fueraPorPago.get(r.id) || 0} /></td>
                  <td className="dp-ad-ruta"><b>{fecha(r.fechaJornada || r.fechaPlan)}</b><span>{r.horaSalida ? `Salió ${r.horaSalida}` : `Ruta ${r.ruta || "—"}`}</span></td>
                  <td className="dp-ad-veh"><b>Placa {r.unidad}</b><span>{r.conductor || "Por asignar"} · {r.conductorCedula || "—"}</span><span>Ayudante {r.ayudante || "—"}</span></td>
                  <td><TagAD r={r} />{sig && <span>{sig.nombre}</span>}</td>
                  <td className="dx-ad-acc">
                    <button className="dx-secondary" onClick={() => setAbierta(ab ? null : r.id)}><Users size={13} />{ab ? "Ocultar" : "Personas"}</button>
                    {EDITABLE.includes(estadoAD(r.estadoRuta).id) && <button className="dx-secondary" onClick={() => setReasignar(r)} title="Reasignar vehículo, conductor, ruta o fecha"><RefreshCw size={13} /></button>}
                    <button className="dx-secondary" onClick={() => setDoc([r])} title="Ver e imprimir"><FileText size={13} /></button>
                    <button className="dx-iconbtn" onClick={() => setDetalle(r.id)} title="Detalle del AD"><ChevronRight size={15} /></button>
                  </td>
                </tr>
                {ab && <tr className="dx-fila-personas"><td colSpan={7}>
                  <ListaPersonasAD ruta={r} solicitudes={solicitudes} onVerUsuario={onVerUsuario} />
                </td></tr>}
              </React.Fragment>;
            })}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}>TOTALES · {num(lista.length)} AD</td>
            <td><b>{num(tot.cil)} bombonas planificadas</b><span>{num(tot.conv)} convocadas</span></td>
            <td colSpan={4}></td>
          </tr></tfoot>
          </table>
          {!lista.length && <div className="dx-vacio-seg">Ninguna AD en este segmento.</div>}
        </div>}
    </Card>

    {reasignar && <Reasignar r={reasignar} onClose={() => setReasignar(null)}
      onSave={(d) => { actualizar(reasignar.id, d); setReasignar(null); aviso(`AD ${reasignar.ad} reasignada`); }} />}
    {doc && <ReporteADViewer rutas={doc} solicitudes={solicitudes} onClose={() => setDoc(null)} />}
  </div>;
}

/* ── REPLANIFICACIÓN · LA BANDEJA ──────────────────────────────────────────────
   Todo pedido que tuvo un problema en la jornada sigue vivo: no llevó su bombona, no estaba,
   la bombona estaba mala o la planta falló. Distribución lo atiende en una AD especial por
   usuario —una ruta por domicilio— antes del cierre del ciclo. Abonar es el último recurso:
   sólo si se decide no replanificar, y con una nota que queda en la bitácora.
   El orden es el del núcleo: primero lo imputable a la empresa, después lo que vence antes. */
function Replanificacion({ bandeja, rutas, solicitudes, cifras, abonarPedido, aviso, setDetalle, onEspecial, onVerUsuario }) {
  const [q, setQ] = useState("");
  const [motivo, setMotivo] = useState("TODOS");
  const [sel, setSel] = useState(() => new Set());
  const [abonar, setAbonar] = useState(null);
  const motivos = useMemo(() => [...new Map(bandeja.map((b) => [b.motivoProblema.id, b.motivoProblema.nombre])).entries()], [bandeja]);
  const lista = bandeja.filter((b) => {
    if (motivo === "PRIORIDAD" ? !b.prioridad : motivo !== "TODOS" && b.motivoProblema.id !== motivo) return false;
    const u = usr(b.usuario);
    return !q || `${u.nombre} ${u.doc} ${b.id} ${b.problema?.adOrigen || ""}`.toLowerCase().includes(q.toLowerCase());
  });
  const seleccion = bandeja.filter((b) => sel.has(b.id));
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const especiales = useMemo(() => rutas.filter((r) => adPlanificada(r) && tipoAD(r) === "ESPECIAL")
    .sort((a, b) => (adCerrada(a) ? 1 : 0) - (adCerrada(b) ? 1 : 0)), [rutas]);
  const solPorId = useMemo(() => new Map(solicitudes.map((s) => [s.id, s])), [solicitudes]);
  const plazo = finDeCiclo(HOY);

  function confirmarAbono(nota) {
    const res = abonarPedido(abonar.id, { nota });
    if (res?.ok) {
      setAbonar(null);
      setSel((prev) => { const n = new Set(prev); n.delete(abonar.id); return n; });
      aviso("Pedido abonado: el dinero pasó al saldo a favor del usuario");
    }
    return res;
  }

  return <div className="dx-content">
    <div className="dx-kpis orders">
      <Kpi icon={RotateCcw} label="En la bandeja" value={num(cifras.replanificacion.n)}
        foot={cifras.replanificacion.prioridad ? `${num(cifras.replanificacion.prioridad)} con prioridad · falla de la empresa` : "Ninguno imputable a la empresa"} />
      <Kpi icon={Clock3} label="Plazo del ciclo" value={fecha(plazo)} foot={`${dias(diasEntre(HOY, plazo))} · al cierre, lo no replanificado pasa a saldo a favor`} />
      <Kpi icon={Truck} label="AD especiales" value={num(cifras.ad.especiales)} foot={`${num(especiales.filter(adActiva).length)} por atender`} />
      <Kpi icon={Users} label="Selección" value={num(seleccion.length)} foot={seleccion.length ? "Lista para una AD especial" : "Marca los pedidos a replanificar"} />
    </div>

    <Card title="Bandeja de replanificación" subtitle="El pedido sigue vivo y ya está pagado: se replanifica con la bombona correcta, en una ruta por domicilio."
      action={<button className="dx-primary" disabled={!seleccion.length} onClick={() => onEspecial(seleccion.map((b) => b.id))}><ClipboardPlus size={14} />Crear AD especial {seleccion.length ? `(${seleccion.length})` : ""}</button>}>
      <div className="dx-orders-help">
        <div><b>Replanificar</b><span>Una AD especial por usuario recoge en su domicilio y devuelve en el mismo sitio. El envase apto es un aviso, no un bloqueo: si no la tiene lista, no hay qué recoger.</span></div>
        <div><b>Abonar · último recurso</b><span>Sólo si Distribución decide no replanificar. El dinero pasa al saldo a favor (no hay reembolso) y la nota queda en la bitácora.</span></div>
      </div>
      <div className="dx-user-toolbar">
        <div className="dx-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar persona, cédula, solicitud o AD de origen" /></div>
        <FilterSelect label="Motivo" value={motivo} set={setMotivo} options={[["TODOS", "Todos"], ["PRIORIDAD", "Prioridad · empresa"], ...motivos]} />
        <button className="dx-secondary" onClick={() => setSel(new Set(lista.map((b) => b.id)))}>Seleccionar los visibles</button>
        <button className="dx-secondary" onClick={() => setSel(new Set())}>Limpiar</button>
      </div>
      <div className="dx-table-wrap users"><table className="dx-table"><thead><tr>
        <th></th><th>Persona</th><th>Motivo</th><th>AD de origen</th><th>En bandeja</th><th>Plazo</th><th>Envase</th><th>Pedido</th><th></th>
      </tr></thead><tbody>{lista.map((b) => {
        const u = usr(b.usuario);
        return <tr key={b.id}>
          <td><input type="checkbox" checked={sel.has(b.id)} onChange={() => toggle(b.id)} /></td>
          <td><button className="dx-name-link" onClick={() => onVerUsuario(b.usuario)}>{u.nombre}</button><span>{u.doc} · {b.id}</span></td>
          <td>{b.prioridad && <Tag tone="red">Prioridad · empresa</Tag>}<b>{b.motivoProblema.nombre}</b>
            <span>{b.problema?.momento === "PLANTA" ? "En planta" : "En la recolección"}{b.problema?.nota ? ` · ${b.problema.nota}` : ""}</span></td>
          <td><b>{b.problema?.adOrigen || "—"}</b><span>{fecha(b.problema?.fecha)}</span></td>
          <td><b>{dias(b.diasEnBandeja)}</b></td>
          <td><b>{fecha(b.plazo)}</b><span>{b.diasAlPlazo >= 0 ? `quedan ${dias(b.diasAlPlazo)}` : "vencido"}</span></td>
          <td>{b.envaseApto ? <Tag tone="green">Envase apto</Tag> : <Tag tone="amber">Sin envase apto registrado</Tag>}</td>
          <td><b>{cpt(b.concepto).corto}</b><span><KgL kg={kgDeSolicitud(b)} /></span></td>
          <td><div className="dx-row-actions">
            <button className="dx-row-plan" onClick={() => onEspecial([b.id])}><ClipboardPlus size={12} />AD especial</button>
            <button className="dx-user-link" onClick={() => setAbonar(b)}>Abonar</button></div></td>
        </tr>;
      })}</tbody></table>
        {!lista.length && <div className="dx-vacio-seg">{bandeja.length ? "Ningún pedido coincide con el filtro." : "La bandeja está vacía: no hay pedidos por replanificar."}</div>}</div>
    </Card>

    <Card title="AD especiales por usuario" subtitle="Rutas por domicilio que arma Distribución. Cada parada es una persona, con su dirección y su motivo.">
      {especiales.length ? <div className="dx-especiales">{especiales.map((r) => <article key={r.id} className="dx-especial">
        <div className="dx-especial-head">
          <div><b>AD {r.ad} · {fecha(r.fechaJornada || r.fechaPlan)}</b><span>Placa {r.unidad} · {r.conductor || "—"} · ayudante {r.ayudante || "—"}</span></div>
          <div><TagAD r={r} /><button className="dx-iconbtn" onClick={() => setDetalle(r.id)} title="Detalle del AD"><ChevronRight size={15} /></button></div>
        </div>
        <ol className="dx-paradas">{(r.paradas || []).map((p) => {
          const s = solPorId.get(p.solicitudId);
          const res = s ? resultadoDe(r, s) : null;
          return <li key={p.solicitudId}><b>{p.orden}. {p.nombre}</b>
            <span><MapPin size={11} /> {p.direccion}{p.sector && p.sector !== "—" ? ` · ${p.sector}` : ""}</span>
            <em>{p.motivo ? motivoNoEntrega(p.motivo).nombre : "Pagado sin AD · entrega directa"}{res && res.texto !== "Convocada" ? ` · ${res.texto}` : ""}</em></li>;
        })}</ol>
        {r.notaPlan && <small>{r.notaPlan}</small>}
      </article>)}</div> : <Empty text="Todavía no hay AD especiales." />}
    </Card>

    {abonar && <AbonarModal s={abonar} onClose={() => setAbonar(null)} onConfirm={confirmarAbono} />}
  </div>;
}

/** Abonar es decidir no replanificar: se exige la nota porque queda en la bitácora del usuario. */
function AbonarModal({ s, onClose, onConfirm }) {
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const u = usr(s.usuario);
  function confirmar() {
    const res = onConfirm(nota.trim());
    if (res && !res.ok) setError(res.error || "No se pudo abonar el pedido.");
  }
  return <div className="dx-modal-bg"><div className="dx-detail dx-abono">
    <header><div><small>Abonar · último recurso</small><h2>{u.nombre}</h2><p>{s.id} · {cpt(s.concepto).corto} · {s.motivoProblema?.nombre || "Por replanificar"}</p></div>
      <button onClick={onClose}><X size={17} /></button></header>
    <main>
      <div className="dx-custom-warning"><AlertTriangle size={15} /><span>Distribución decide no replanificar: el pedido se cierra y lo que pagó pasa a su saldo a favor, que se
        descuenta solo en su próximo pedido. No hay reembolso en efectivo.</span></div>
      <label className="dx-justification"><span>¿Por qué no se replanifica? · obligatorio</span>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. El usuario avisó que ya no necesita el gas este ciclo" /></label>
      {error && <div className="dx-error"><AlertTriangle size={15} /><span>{error}</span></div>}
    </main>
    <footer><button className="dx-secondary" onClick={onClose}>Cancelar</button>
      <button className="dx-primary" disabled={!nota.trim()} onClick={confirmar}><Check size={14} />Abonar y cerrar el pedido</button></footer>
  </div></div>;
}

/* ── PLANIFICAR · JORNADA COMUNAL Y AD ESPECIAL ────────────────────────────────
   Los dos asistentes terminan en `planificarAD` del núcleo, que valida lo que importa:
   pedidos pagados completos (o por replanificar, en la especial), vehículo realmente
   disponible y AD único. Si la carga supera la capacidad, devuelve un aviso que no bloquea. */

/** Logística por defecto: la unidad de la hoja si puede salir; si no, la primera que pueda. */
function logisticaInicial(preferida, rutas) {
  const flota = UNIDADES_DISTRIBUCION.filter((u) => !u.granel);
  const pref = preferida ? unidadDistribucion(preferida) : null;
  const u = pref && !pref.granel && pref.tipo !== "POR_ASIGNAR" && unidadLista(pref) ? pref : (flota.find(unidadLista) || flota[0]);
  // «AD del día»: se propone hoy, así la jornada que se planifica se puede ejecutar enseguida.
  return { ad: String(siguienteAD(rutas)), unidad: u.placa, operadorId: conductorDe(u), ayudanteId: u.ayudanteDefault,
    fechaJornada: aISO(HOY), nota: "" };
}

/** Vista previa de lo seleccionado: bombonas por formato, kilos, pedidos y personas. */
function cargaDe(sols) {
  const cil = {};
  sols.forEach((s) => { const k = cpt(s.concepto).kg; cil[k] = (cil[k] || 0) + Number(s.cantidad || 1); });
  return { cil, kg: sols.reduce((a, s) => a + kgDeSolicitud(s), 0), pedidos: sols.length, personas: new Set(sols.map((s) => s.usuario)).size };
}

/** El pago de una persona como lo ve Distribución: el estado y la fecha, nunca el monto. */
function pagoDe(s) {
  if (s.estado === "PAGADA") return { tono: "green", txt: "Pagado", sub: `verificado el ${fecha(s.pago?.resueltoEn || s.pago?.fecha || s.fecha)}` };
  if (s.estado === "POR_COMPLETAR") return { tono: "amber", txt: "Por completar",
    sub: s.tarifaPendiente ? "subió la tarifa: le falta la diferencia" : "pagó una parte: le falta la diferencia" };
  if (s.pago?.estado === "RECHAZADO") return { tono: "red", txt: "Pago rechazado", sub: "referencia repetida: debe reportar otra" };
  return { tono: "slate", txt: "Sin pago", sub: `pidió el ${fecha(s.fecha)} y no ha pagado` };
}

function WizardAD({ grupo, rutas, planificarAD, onClose, onDone }) {
  // La institución de la hoja va como AD institucional; el resto, jornada comunal.
  const tipo = tipoAD({ bloque: grupo.bloque });
  const base = grupo.rutaId ? rutas.find((r) => r.id === grupo.rutaId) : null;
  const [paso, setPaso] = useState(1);
  const [sel, setSel] = useState(() => new Set(grupo.pagadas.map((s) => s.id)));
  const [ver, setVer] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [log, setLog] = useState(() => logisticaInicial(base?.unidad, rutas));
  const [error, setError] = useState("");
  const elegidas = grupo.pagadas.filter((s) => sel.has(s.id));
  const carga = cargaDe(elegidas);
  // Toda la comunidad que pidió: quienes pagaron entran; el resto se ve con su estado de pago.
  const fuera = grupo.fuera || [];
  const listas = { TODOS: [...grupo.pagadas, ...fuera], PAGADOS: grupo.pagadas, FUERA: fuera };
  const qq = busca.trim().toLowerCase();
  const visibles = (listas[ver] || []).filter((s) => { if (!qq) return true; const u = usr(s.usuario); return `${u.nombre} ${u.doc} ${s.id}`.toLowerCase().includes(qq); });
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const logisticaOk = Boolean(log.ad.trim() && log.operadorId && unidadLista(unidadDistribucion(log.unidad)));

  function crear() {
    setError("");
    const res = planificarAD({
      tipo, rutaId: grupo.rutaId, solicitudIds: elegidas.map((s) => s.id), ad: log.ad.trim(), unidad: log.unidad,
      operadorId: log.operadorId, ayudanteId: log.ayudanteId, fecha: HOY, fechaJornada: deISO(log.fechaJornada),
      comuna: String(grupo.comuna || "").toUpperCase(), comunidad: grupo.comunidad, parroquia: grupo.parroquia || undefined,
      bloque: grupo.bloque || undefined, nota: log.nota.trim() || undefined,
    });
    if (!res?.ok) { setError(res?.error || "No se pudo planificar el AD."); return; }
    onDone(res, elegidas.length);
  }

  return <div className="dx-modal-bg"><div className="dx-wizard">
    <header><div><small>Planificación de AD · {tipoADInfo({ tipoAD: tipo }).nombre}</small><h2>{grupo.comunidad}</h2>
      <p>{grupo.comuna}{grupo.parroquia ? ` · ${grupo.parroquia}` : ""} · {dias(grupo.diasEspera)} esperando</p></div><button onClick={onClose}><X size={17} /></button></header>
    <div className="dx-wsteps"><StepTab n="1" label="Pedidos pagados" on={paso === 1} done={paso > 1} /><i /><StepTab n="2" label="Vehículo y conductor" on={paso === 2} done={paso > 2} /><i /><StepTab n="3" label="Confirmar AD" on={paso === 3} /></div>
    <main>
      {paso === 1 && <>
        <div className="dx-wintro"><div><b>1. Los pedidos que entran al AD</b><span>Sólo se planifican pedidos pagados completos. El día de la jornada la gente lleva su bombona vacía al punto y vuelve llena al mismo punto.</span></div>
          <div className="dx-wcounts"><span>{cant(grupo.pagadas.length, "pagado", "pagados")}</span><span>{cant(elegidas.length, "seleccionado", "seleccionados")}</span></div></div>
        {fuera.length > 0 && <div className="dx-custom-warning"><AlertTriangle size={15} /><span>{cant(fuera.length, "persona de esta comunidad pidió y no entra", "personas de esta comunidad pidieron y no entran")}: {num(grupo.sinPago)} sin pago y {num(grupo.porCompletar)} por completar. Aparecen en la lista con su estado de pago; cuando la API verifique su pago completo pasan a pagados.</span></div>}
        <div className="dx-user-toolbar">
          <div className="dx-segmentos">{[["TODOS", "Todos"], ["PAGADOS", "Pagados · entran"], ["FUERA", "Sin pago o por completar · no entran"]].map(([k, l]) =>
            <button key={k} className={ver === k ? "on" : ""} onClick={() => setVer(k)}>{l} <em>{num(listas[k].length)}</em></button>)}</div>
          <div className="dx-search"><Search size={14} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona, cédula o solicitud" /></div>
          <button className="dx-secondary" onClick={() => setSel(new Set(grupo.pagadas.map((s) => s.id)))}>Todos los pagados</button>
          <button className="dx-secondary" onClick={() => setSel(new Set())}>Ninguno</button></div>
        <div className="dx-table-wrap users"><table className="dx-table"><thead><tr><th></th><th>Solicitud</th><th>Persona</th><th>Cédula</th><th>Pago</th><th>Producto</th><th>GLP</th></tr></thead><tbody>
          {visibles.map((s) => { const u = usr(s.usuario); const p = pagoDe(s); const entra = s.estado === "PAGADA"; return <tr key={s.id} className={entra ? "" : "dx-fuera"}>
            <td><input type="checkbox" checked={entra && sel.has(s.id)} disabled={!entra} title={entra ? undefined : "No entra: el pago no está completo"} onChange={() => toggle(s.id)} /></td>
            <td><b>{s.id}</b><span>{s.comunidad || grupo.comunidad}</span></td><td><b>{u.nombre}</b></td><td>{u.doc}</td>
            <td><Tag tone={p.tono}>{p.txt}</Tag><span>{p.sub}</span></td>
            <td>{s.cantidad > 1 ? `${s.cantidad} × ` : ""}{cpt(s.concepto).corto}</td><td><KgL kg={kgDeSolicitud(s)} /></td></tr>; })}
        </tbody></table>{!visibles.length && <div className="dx-vacio-seg">Nada que mostrar en esta lista.</div>}</div>
      </>}
      {paso === 2 && <>
        <div className="dx-wintro"><div><b>2. Vehículo, conductor y ayudante</b><span>Sólo se ofrecen las unidades que pueden salir: certificación y póliza vigentes, mantenimiento al día, conductor habilitado y ayudante.</span></div></div>
        <PasoLogistica log={log} setLog={setLog} kg={carga.kg} />
      </>}
      {paso === 3 && <>
        <div className="dx-wintro"><div><b>3. Confirma el AD</b><span>Al confirmar, los pedidos quedan convocados en el AD y salen de «Por planificar».</span></div></div>
        <Confirmacion log={log} tipo={tipo} carga={carga} filas={[["Comunidad", grupo.comunidad, grupo.comuna], ["Pedidos convocados", num(carga.pedidos), cant(carga.personas, "persona", "personas")]]} />
      </>}
      {error && <div className="dx-error"><AlertTriangle size={15} /><span>{error}</span></div>}
    </main>
    <footer><button className="dx-secondary" onClick={() => (paso === 1 ? onClose() : setPaso(paso - 1))}>{paso === 1 ? "Cancelar" : <><ChevronLeft size={14} />Atrás</>}</button>
      {paso < 3
        ? <button className="dx-primary" disabled={(paso === 1 && !elegidas.length) || (paso === 2 && !logisticaOk)} onClick={() => setPaso(paso + 1)}>Continuar <ChevronRight size={14} /></button>
        : <button className="dx-primary" disabled={!elegidas.length || !logisticaOk} onClick={crear}><Check size={14} />Crear y asignar AD</button>}</footer>
  </div></div>;
}

/**
 * AD ESPECIAL POR USUARIO · la ruta por domicilio con la que Distribución resuelve la bandeja
 * de replanificación y las entregas directas. Todo es prepago: no hay vía para pedidos sin pagar.
 */
function WizardADEspecial({ ids, bandeja, solicitudes, rutas, planificarAD, onClose, onDone }) {
  const porBandeja = useMemo(() => new Map(bandeja.map((b) => [b.id, b])), [bandeja]);
  // En el mismo orden en que el núcleo numera las paradas.
  const candidatos = useMemo(() => solicitudes.filter((s) => elegibleEspecial(s) && cpt(s.concepto).bombona && !esCodigoGenerico(s.usuario)), [solicitudes]);
  const [paso, setPaso] = useState(1);
  const [sel, setSel] = useState(() => new Set(ids));
  const [ver, setVer] = useState(ids.length ? "SELECCION" : "REPLANIFICAR");
  const [busca, setBusca] = useState("");
  const [log, setLog] = useState(() => logisticaInicial(null, rutas));
  const [error, setError] = useState("");
  const elegidas = candidatos.filter((s) => sel.has(s.id));
  const carga = cargaDe(elegidas);
  const grupos = {
    REPLANIFICAR: bandeja,
    PAGADAS: candidatos.filter((s) => s.estado === "PAGADA"),
    SELECCION: elegidas,
  };
  const qq = busca.trim().toLowerCase();
  const visibles = (grupos[ver] || []).filter((s) => { if (!qq) return true; const u = usr(s.usuario); return `${u.nombre} ${u.doc} ${s.id} ${u.dir || ""}`.toLowerCase().includes(qq); });
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const logisticaOk = Boolean(log.ad.trim() && log.operadorId && unidadLista(unidadDistribucion(log.unidad)));
  const origenDe = (s) => {
    const b = porBandeja.get(s.id);
    if (b) return { txt: b.motivoProblema.nombre, sub: `AD ${b.problema?.adOrigen || "—"} · plazo ${fecha(b.plazo)}`, tono: b.prioridad ? "red" : "amber" };
    return { txt: s.modalidadEntrega && s.modalidadEntrega !== "COMUNA" ? "Entrega directa" : "Pagado sin AD", sub: `Pagó el ${fecha(s.pago?.fecha || s.fecha)}`, tono: "green" };
  };

  function crear() {
    setError("");
    const res = planificarAD({ tipo: "ESPECIAL", solicitudIds: elegidas.map((s) => s.id), ad: log.ad.trim(), unidad: log.unidad,
      operadorId: log.operadorId, ayudanteId: log.ayudanteId, fecha: HOY, fechaJornada: deISO(log.fechaJornada), nota: log.nota.trim() || undefined });
    if (!res?.ok) { setError(res?.error || "No se pudo planificar el AD especial."); return; }
    onDone(res, elegidas.length);
  }

  return <div className="dx-modal-bg"><div className="dx-wizard custom">
    <header><div><small>AD especial por usuario</small><h2>Ruta por domicilio</h2><p>{cant(elegidas.length, "parada", "paradas")} · {cant(carga.personas, "persona", "personas")} · <KgL kg={carga.kg} /></p></div><button onClick={onClose}><X size={17} /></button></header>
    <div className="dx-wsteps"><StepTab n="1" label="Pedidos" on={paso === 1} done={paso > 1} /><i /><StepTab n="2" label="Vehículo y conductor" on={paso === 2} done={paso > 2} /><i /><StepTab n="3" label="Paradas y confirmación" on={paso === 3} /></div>
    <main>
      {paso === 1 && <>
        <div className="dx-wintro"><div><b>1. Quiénes entran a la ruta</b><span>Pedidos por replanificar y pedidos pagados que no tienen AD, como las entregas directas de comercio. Todo lo que entra ya está pagado.</span></div>
          <div className="dx-wcounts"><span>{num(elegidas.length)} seleccionados</span></div></div>
        <div className="dx-user-toolbar">
          <div className="dx-segmentos">{[["REPLANIFICAR", "Por replanificar"], ["PAGADAS", "Pagados sin AD"], ["SELECCION", "Seleccionados"]].map(([k, l]) =>
            <button key={k} className={ver === k ? "on" : ""} onClick={() => setVer(k)}>{l} <em>{num(grupos[k].length)}</em></button>)}</div>
          <div className="dx-search"><Search size={14} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona, cédula o dirección" /></div>
        </div>
        <div className="dx-table-wrap users"><table className="dx-table"><thead><tr><th></th><th>Persona</th><th>Dirección</th><th>Origen</th><th>Envase</th><th>Producto</th><th>GLP</th></tr></thead><tbody>
          {visibles.map((s) => { const u = usr(s.usuario); const o = origenDe(s); const b = porBandeja.get(s.id); return <tr key={s.id}>
            <td><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} /></td>
            <td><b>{u.nombre}</b><span>{u.doc} · {s.id}</span></td>
            <td className="dx-celda-larga"><b>{u.dir || "—"}</b><span>{u.sector || ""}</span></td>
            <td><Tag tone={o.tono}>{o.txt}</Tag><span>{o.sub}</span></td>
            <td>{b ? (b.envaseApto ? <Tag tone="green">Apto</Tag> : <Tag tone="amber">Sin envase apto</Tag>) : <span>—</span>}</td>
            <td>{s.cantidad > 1 ? `${s.cantidad} × ` : ""}{cpt(s.concepto).corto}</td><td><KgL kg={kgDeSolicitud(s)} /></td></tr>; })}
        </tbody></table>{!visibles.length && <div className="dx-vacio-seg">Nada que mostrar en esta lista.</div>}</div>
      </>}
      {paso === 2 && <>
        <div className="dx-wintro"><div><b>2. Vehículo, conductor y ayudante</b><span>La unidad recoge en cada domicilio y devuelve en el mismo sitio. Sólo se ofrecen las unidades que pueden salir.</span></div></div>
        <PasoLogistica log={log} setLog={setLog} kg={carga.kg} notaLabel="Motivo o nota de la AD especial (opcional)" />
      </>}
      {paso === 3 && <>
        <div className="dx-wintro"><div><b>3. Paradas y confirmación</b><span>Los pedidos quedan convocados en esta AD y salen de la bandeja. Cada parada es una persona en su domicilio.</span></div></div>
        <Confirmacion log={log} tipo="ESPECIAL" carga={carga} filas={[["Paradas", num(elegidas.length), cant(carga.personas, "persona", "personas")]]} />
        <div className="dx-preview"><h3>Paradas por domicilio · en este orden</h3>
          {elegidas.map((s, i) => { const u = usr(s.usuario); return <div key={s.id}><span>{i + 1}. {u.nombre} · {u.dir || u.sector || "—"}</span><b>{origenDe(s).txt}</b></div>; })}</div>
      </>}
      {error && <div className="dx-error"><AlertTriangle size={15} /><span>{error}</span></div>}
    </main>
    <footer><button className="dx-secondary" onClick={() => (paso === 1 ? onClose() : setPaso(paso - 1))}>{paso === 1 ? "Cancelar" : <><ChevronLeft size={14} />Atrás</>}</button>
      {paso < 3
        ? <button className="dx-primary" disabled={(paso === 1 && !elegidas.length) || (paso === 2 && !logisticaOk)} onClick={() => setPaso(paso + 1)}>Continuar <ChevronRight size={14} /></button>
        : <button className="dx-primary" disabled={!elegidas.length || !logisticaOk} onClick={crear}><Check size={14} />Crear AD especial</button>}</footer>
  </div></div>;
}

/** Vehículo, conductor, ayudante, número de AD y fecha: lo mismo en los dos asistentes. */
function PasoLogistica({ log, setLog, kg, notaLabel = "Nota de la planificación (opcional)" }) {
  const u = unidadDistribucion(log.unidad);
  const d = disponibilidadUnidad(u, HOY);
  const ops = operadoresParaUnidad(u.id);
  const op = operadorDistribucion(log.operadorId);
  const set = (k) => (e) => setLog((x) => ({ ...x, [k]: e.target.value }));
  const cambiarUnidad = (placa) => { const n = unidadDistribucion(placa); setLog((x) => ({ ...x, unidad: n.placa, operadorId: conductorDe(n), ayudanteId: n.ayudanteDefault })); };
  return <>
    <div className="dx-formgrid">
      <label><span>Número de AD</span><input value={log.ad} onChange={set("ad")} /></label>
      <label><span>Fecha de la jornada</span><input type="date" value={log.fechaJornada} min={aISO(HOY)} onChange={set("fechaJornada")} /></label>
      <label><span>Vehículo · las que no pueden salir aparecen deshabilitadas</span><select value={log.unidad} onChange={(e) => cambiarUnidad(e.target.value)}><OpcionesUnidad /></select></label>
      <label><span>Conductor habilitado para {u.placa}</span><select value={log.operadorId} onChange={set("operadorId")}>
        {ops.length ? ops.map((o) => <option key={o.id} value={o.id}>{o.nombre} · {o.cedula}</option>) : <option value="">Sin conductor habilitado</option>}</select></label>
    </div>
    <label className="dx-justification"><span>{notaLabel}</span><textarea value={log.nota} onChange={set("nota")} placeholder="Queda en la hoja del AD" /></label>
    <div className="dx-driver-card">
      <div><CarFront size={17} /><span>Vehículo · {tipoFlota[u.tipo] || u.tipo}</span><b>{u.placa}</b><small>Capacidad {num(u.capacidad)} kg por viaje · selección <KgL kg={kg} /></small></div>
      <div><UserRound size={17} /><span>Conductor</span><b>{op.nombre}</b><small>{op.cedula}</small></div>
      <div><Users size={17} /><span>Ayudante de la unidad</span><b>{d.ayudante.nombre}</b><small>{d.ayudante.cedula}</small></div>
    </div>
    {!d.disponible && <div className="dx-error"><AlertTriangle size={15} /><span>{u.placa} no puede salir: {d.motivos.join(" · ")}.</span></div>}
  </>;
}

function Confirmacion({ log, tipo, carga, filas }) {
  const u = unidadDistribucion(log.unidad), o = operadorDistribucion(log.operadorId), ay = disponibilidadUnidad(u, HOY).ayudante;
  return <>
    <div className="dx-confirm">
      <div><span>AD</span><b>{log.ad}</b><small>{tipoADInfo({ tipoAD: tipo }).nombre}</small></div>
      {filas.map(([l, v, s]) => <div key={l}><span>{l}</span><b>{v}</b>{s && <small>{s}</small>}</div>)}
      <div><span>Fecha de la jornada</span><b>{fecha(deISO(log.fechaJornada))}</b></div>
      <div><span>Vehículo</span><b>{u.placa}</b><small>{u.etiqueta}</small></div>
      <div><span>Conductor</span><b>{o.nombre}</b><small>{o.cedula}</small></div>
      <div><span>Ayudante</span><b>{ay.nombre}</b><small>{ay.cedula}</small></div>
    </div>
    <div className="dx-load"><h3>Bombonas a recoger</h3>
      <div>{Object.entries(carga.cil).map(([k, v]) => <span key={k}>{k} kg<b>{num(v)}</b></span>)}</div>
      <strong>{cant(carga.pedidos, "pedido", "pedidos")} · {cant(carga.personas, "persona", "personas")} · <KgL kg={carga.kg} /></strong></div>
  </>;
}

/* ── DETALLE DE UN AD ───────────────────────────────────────────────────────────
   Sus momentos con fecha y hora, la incidencia si la hubo, la bitácora de cambios, las
   paradas si es especial y su gente. Editar la planificación sólo mientras no ha salido. */
function DetalleAD({ ruta: r, solicitudes, actualizar, aviso, onClose, onVerUsuario }) {
  const [reasignar, setReasignar] = useState(false);
  const [doc, setDoc] = useState(false);
  const c = cuadreJornada(r, solicitudes);
  const e = estadoAD(r.estadoRuta);
  const cil = totalCil(r.cilindros), hoja = totalCil(r.cilindrosHoja);
  const j = r.jornada || {};
  const tipoInc = r.incidenciaTipo || r.tipoIncidencia;
  const momentos = [
    ["Planificada", r.fechaPlan, null, `${r.planificadaPor || "Distribución"}${r.notaPlan ? ` · ${r.notaPlan}` : ""}`],
    ["Salida a recolección", r.fechaSalida, r.horaSalida, r.fechaSalida ? `Placa ${r.unidad} · el precio del AD es el de este día` : null],
    ["Recolección en el punto", j.recoleccion?.fecha, j.recoleccion?.hora, j.recoleccion ? `${cant(j.recoleccion.recogidas, "recogida", "recogidas")} · ${cant(j.recoleccion.noRecogidas, "no recogida", "no recogidas")}` : null],
    ["Llenado en planta", j.llenado?.fecha, j.llenado?.hora, j.llenado ? `${cant(j.llenado.llenadas, "llena", "llenas")} · ${num(j.llenado.noLlenadas)} ${j.llenado.noLlenadas === 1 ? "no admitió" : "no admitieron"} llenado` : null],
    ["Devolución al punto", j.devolucion?.fecha, j.devolucion?.hora, j.devolucion ? `${cant(j.devolucion.devueltas, "devuelta", "devueltas")}, llenas y vacías` : null],
    ["Cierre del AD", r.cerradaEn, r.horaCierre, r.cerradaEn ? `${num(c.entregadas)} entregadas · ${num(c.replanificadas)} a replanificación · ${num(c.abonadas)} abonadas${r.recepcion?.receptor ? ` · recibió ${r.recepcion.receptor}` : ""}` : null],
  ];
  const bitacora = [
    ...(r.notaUnidad ? [{ fecha: r.fechaPlan, por: "Planificación", texto: r.notaUnidad }] : []),
    ...(r.bitacoraCambios || []),
    // Las incidencias por cliente corregidas al cerrar: quién, qué había y qué quedó.
    ...(j.correcciones || []).flatMap((co) => co.cambios.map((x) => ({ fecha: co.fecha, por: co.por,
      texto: `${usr(solicitudes.find((s) => s.id === x.solicitud)?.usuario).nombre || x.solicitud} (${x.solicitud}) · ${x.antes} → ${x.despues}${x.observacion ? ` · ${x.observacion}` : ""}` }))),
  ];

  return <>
    <div className="dx-modal-bg"><div className="dx-detail">
      <header><div><small>AD {r.ad} · {tipoADInfo(r).nombre}</small><h2>{r.comunidad}</h2><p>{r.comuna}{r.parroquia ? ` · ${r.parroquia}` : ""}</p></div>
        <button onClick={onClose}><X size={17} /></button></header>
      <main>
        <div className="dx-summary-strip">
          <div><span>Estado</span><b>{e.nombre}</b><small>{siguienteAccionAD(r)?.nombre || "Sin acciones pendientes"}</small></div>
          <div><span>Fecha de la jornada</span><b>{fecha(r.fechaJornada || r.fechaPlan)}</b><small>Ruta {r.ruta || "—"}</small></div>
          <div><span>Bombonas</span><b>{num(cil)}</b>{hoja > 0 && hoja !== cil && <small>Planificado en hoja: {num(hoja)}</small>}</div>
          <div><span>GLP {c.cerrada ? "entregado" : "convocado"}</span><b><KgL kg={kgAD(c)} /></b></div>
          <div><span>Vehículo</span><b>{r.unidad || "—"}</b><small>{tipoFlota[r.transportistaTipo] || ""}{r.epsdc ? ` · ${r.epsdc}` : ""}</small></div>
          <div><span>Conductor</span><b>{r.conductor || "Por asignar"}</b><small>{r.conductorCedula || "—"}</small></div>
          <div><span>Ayudante</span><b>{r.ayudante || "—"}</b><small>{r.ayudanteCedula || "—"}</small></div>
          <div><span>Pedidos convocados</span><b>{num(c.convocadas)}</b></div>
        </div>
        <CuadreChips c={c} />
        <h3>Momentos de la jornada</h3>
        <ol className="dx-momentos">{momentos.map(([t, f, h, d]) => <li key={t} className={f ? "hecho" : ""}>
          <b>{t}</b><span>{f ? `${fecha(f)}${h ? ` · ${h}` : ""}` : "Pendiente"}</span>{d && <small>{d}</small>}</li>)}</ol>
        {(tipoInc || r.obsIncidencia) && <div className="dx-flota-alerta"><AlertTriangle size={15} />
          <div><b>Incidencia{tipoInc ? ` · ${tipoInc}` : ""}{r.horaIncidencia ? ` · ${r.horaIncidencia}` : ""}{r.incidenciaResuelta ? " · resuelta" : ""}</b>
            <span>{r.obsIncidencia || "Sin detalle"}{r.notaResolucion ? ` · Resolución: ${r.notaResolucion}` : ""}</span></div></div>}
        {tipoAD(r) === "ESPECIAL" && (r.paradas || []).length > 0 && <><h3>Paradas por domicilio</h3>
          <ol className="dx-paradas">{r.paradas.map((p) => <li key={p.solicitudId}><b>{p.orden}. {p.nombre}</b>
            <span><MapPin size={11} /> {p.direccion}{p.sector && p.sector !== "—" ? ` · ${p.sector}` : ""}</span>
            <em>{p.motivo ? motivoNoEntrega(p.motivo).nombre : "Pagado sin AD · entrega directa"}</em></li>)}</ol></>}
        {bitacora.length > 0 && <><h3>Bitácora de cambios</h3>
          <ul className="dx-bitacora">{bitacora.map((b, i) => <li key={i}><History size={12} /><span>{fecha(b.fecha)} · {b.por || "Distribución"}</span><b>{b.texto}</b></li>)}</ul></>}
        <h3>Personas</h3>
        <ListaPersonasAD ruta={r} solicitudes={solicitudes} onVerUsuario={onVerUsuario} />
      </main>
      <footer><button className="dx-secondary" onClick={onClose}>Cerrar</button>
        <div className="dx-foot-acc"><button className="dx-secondary" onClick={() => setDoc(true)}><FileText size={14} />Imprimir</button>
          {EDITABLE.includes(e.id) && <button className="dx-primary" onClick={() => setReasignar(true)}><RefreshCw size={14} />Editar planificación</button>}</div></footer>
    </div></div>
    {reasignar && <Reasignar r={r} onClose={() => setReasignar(false)} onSave={(d) => { actualizar(r.id, d); setReasignar(false); aviso(`AD ${r.ad} reasignada`); }} />}
    {doc && <ReporteADViewer rutas={[r]} solicitudes={solicitudes} onClose={() => setDoc(false)} />}
  </>;
}

/* Reportes se retiro el 01/09/2026 y se repartio: el cumplimiento vive en Resumen y la
   impresion y el CSV de AD, en AD del dia. La hoja impresa sale de los datos vivos. */
function ReporteADViewer({ rutas, solicitudes, onClose }) {
  const todas = rutas.length > 1;
  const datos = rutas.map((r) => ({ r, c: cuadreJornada(r, solicitudes) }));
  const cilindros = datos.reduce((a, { r }) => a + totalCil(r.cilindros), 0);
  const convocadas = datos.reduce((a, { c }) => a + c.convocadas, 0);
  const kg = datos.reduce((a, { c }) => a + kgAD(c), 0);
  return <div className="dx-print-root">
    <div className="dx-print-shell">
      <div><b>{todas ? "Libro de AD · Distribución" : `AD ${rutas[0]?.ad || ""}`}</b><span>Vista previa del mismo documento que se imprimirá</span></div>
      <div><button className="dx-secondary" onClick={onClose}>Cerrar</button><button className="dx-primary" onClick={() => window.print()}><FileText size={14} />Imprimir</button></div>
    </div>
    <div className="dx-print-scroll">
      <div className="dx-print-paper">
        {todas && <section className="dx-print-cover">
          <div className="dx-print-brand"><img src={LOGO_GASLARA} alt="" /><div><small>C.D.T. GRAL. JACINTO LARA</small><h1>LIBRO DE AD · DISTRIBUCIÓN</h1><p>Generado el {fecha(HOY)}</p></div></div>
          <div className="dx-print-cover-grid"><div><span>AD incluidas</span><b>{rutas.length}</b></div><div><span>Bombonas planificadas</span><b>{num(cilindros)}</b></div>
            <div><span>Pedidos convocados</span><b>{num(convocadas)}</b></div><div><span>GLP</span><b><KgL kg={kg} /></b></div></div>
          <p className="dx-print-cover-note">Documento consolidado generado desde los datos vivos de Distribución. Cada AD se presenta en una sección independiente con su gente y el resultado de su jornada.</p>
        </section>}
        {datos.map(({ r, c }, i) => <ReporteAD key={`${r.id}-${i}`} r={r} c={c} solicitudes={solicitudes} pageBreak={todas && i > 0} />)}
      </div>
    </div>
  </div>;
}

function ReporteAD({ r, c, solicitudes, pageBreak }) {
  const u = unidadDistribucion(r.unidad);
  const especial = tipoAD(r) === "ESPECIAL";
  const orden = new Map((r.paradas || []).map((p) => [p.solicitudId, p.orden]));
  // Mientras el AD vive, la hoja lista a las convocadas; cerrado, a quienes pasaron por él y su resultado.
  const personas = (c.cerrada ? personasDeAD(r, solicitudes).filter((s) => (s.historialAD || []).some((h) => h.rutaId === r.id)) : convocadasDeAD(r, solicitudes))
    .slice().sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));
  const j = r.jornada || {};
  return <section className={`dx-print-ad ${pageBreak ? "page-break" : ""}`}>
    <div className="dx-print-brand"><img src={LOGO_GASLARA} alt="" /><div><small>C.D.T. GRAL. JACINTO LARA · DEPARTAMENTO DE DISTRIBUCIÓN</small><h1>REPORTE DE ASIGNACIÓN DE DESPACHO (AD)</h1>
      <p>Planificada el {fecha(r.fechaPlan)} · jornada del {fecha(r.fechaJornada || r.fechaPlan)}</p></div>
      <div className="dx-print-ad-box"><span>AD</span><b>{r.ad}</b><em>{estadoAD(r.estadoRuta).nombre}</em></div></div>

    <div className="dx-print-section-title">1. Identificación de la jornada</div>
    <div className="dx-print-info-grid">
      <InfoPrint label="Tipo de AD" value={tipoADInfo(r).nombre} />
      <InfoPrint label="Ruta" value={r.ruta || "—"} />
      <InfoPrint label="Bloque / parroquia" value={r.parroquia || r.bloque || "—"} />
      <InfoPrint label="Comuna" value={r.comuna || "—"} />
      <InfoPrint label={especial ? "Recorrido" : "Punto comunal"} value={r.comunidad || "—"} />
      <InfoPrint label="Planificada por" value={r.planificadaPor || "Distribución"} />
      <InfoPrint label="Fecha de planificación" value={fecha(r.fechaPlan)} />
      <InfoPrint label="Fecha de la jornada" value={fecha(r.fechaJornada || r.fechaPlan)} />
    </div>

    <div className="dx-print-section-title">2. Asignación logística</div>
    <div className="dx-print-info-grid four">
      <InfoPrint label="Vehículo / placa" value={r.unidad || "—"} />
      <InfoPrint label="Código interno" value={r.unidadCodigoInterno || u.codigoInterno || "—"} />
      <InfoPrint label="Conductor" value={r.conductor || "—"} />
      <InfoPrint label="Cédula del conductor" value={r.conductorCedula || "—"} />
      <InfoPrint label="Ayudante" value={r.ayudante || "—"} />
      <InfoPrint label="Cédula del ayudante" value={r.ayudanteCedula || "—"} />
      <InfoPrint label="Transportista" value={tipoFlota[r.transportistaTipo] || tipoFlota[u.tipo] || "—"} />
      <InfoPrint label="EPSDC" value={r.epsdc || "No aplica"} />
    </div>

    <div className="dx-print-section-title">3. Bombonas de la jornada</div>
    <div className="dx-print-load-grid">
      {Object.entries(r.cilindros || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => <div key={k}><span>Bombona {k} kg</span><b>{num(v)}</b></div>)}
      <div className="strong"><span>Total bombonas</span><b>{num(totalCil(r.cilindros))}</b></div>
      <div className="strong"><span>GLP {c.cerrada ? "entregado" : "convocado"}</span><b><KgL kg={kgAD(c)} /></b></div>
      <div><span>Pedidos convocados</span><b>{num(c.convocadas)}</b></div>
      {c.cerrada && <div><span>Entregadas · a replanificación · abonadas</span><b>{num(c.entregadas)} · {num(c.replanificadas)} · {num(c.abonadas)}</b></div>}
    </div>
    {r.notaPlan && <div className="dx-print-auth"><b>Nota de la planificación</b><span>{r.notaPlan}</span></div>}

    <div className="dx-print-section-title">4. {especial ? "Paradas por domicilio" : "Personas convocadas"}</div>
    <div className="dx-print-table-wrap"><table className="dx-print-table"><thead><tr><th>#</th><th>Solicitud</th><th>Persona</th><th>Cédula / RIF</th><th>{especial ? "Dirección" : "Comunidad"}</th><th>Producto</th><th>Cant.</th><th>GLP</th><th>Resultado</th></tr></thead>
      <tbody>{personas.map((s, i) => { const us = usr(s.usuario); const res = resultadoDe(r, s); return <tr key={s.id}>
        <td>{i + 1}</td><td>{s.id}</td><td>{us.nombre}</td><td>{us.doc}</td><td>{especial ? (us.dir || us.sector || "—") : (s.comunidad || r.comunidad)}</td>
        <td>{cpt(s.concepto).corto}</td><td>{s.cantidad}</td><td><KgL kg={kgDeSolicitud(s)} /></td>
        <td>{res && res.texto !== "Convocada" ? `${res.texto}${res.despues ? ` → ${res.despues}` : ""}` : ""}</td></tr>; })}</tbody>
      <tfoot><tr><td colSpan="6">TOTALES · {num(personas.length)} pedidos</td><td>{num(personas.reduce((a, s) => a + Number(s.cantidad || 1), 0))}</td>
        <td><KgL kg={personas.reduce((a, s) => a + kgDeSolicitud(s), 0)} /></td><td></td></tr></tfoot></table></div>

    <div className="dx-print-section-title">5. Control de la jornada</div>
    <div className="dx-print-info-grid">
      <InfoPrint label="Salida a recolección" value={r.fechaSalida ? `${fecha(r.fechaSalida)} · ${r.horaSalida || "—"}` : "Pendiente"} />
      <InfoPrint label="Recolección en el punto" value={j.recoleccion ? `${j.recoleccion.hora} · ${num(j.recoleccion.recogidas)} recogidas` : "Pendiente"} />
      <InfoPrint label="Llenado en planta" value={j.llenado ? `${j.llenado.hora} · ${num(j.llenado.llenadas)} llenas` : "Pendiente"} />
      <InfoPrint label="Devolución al punto" value={j.devolucion ? `${j.devolucion.hora} · ${num(j.devolucion.devueltas)} devueltas` : "Pendiente"} />
    </div>
    <div className="dx-print-observations"><b>Observaciones / incidencias</b><div>{r.obsIncidencia || ""}</div></div>
    <div className="dx-print-signatures">
      <div><span>Elaborado por Distribución</span><i></i><small>{r.planificadaPor || "Nombre / firma"}</small></div>
      <div><span>Conductor</span><i></i><small>{r.conductor || "Nombre / firma"} · {r.conductorCedula || ""}</small></div>
      <div><span>{especial ? "Recibido por cada usuario" : "Responsable del punto comunal"}</span><i></i>
        <small>{r.recepcion?.receptor ? `${r.recepcion.receptor} · ${r.recepcion.cedula || ""}` : "Nombre, cédula y firma"}</small></div>
    </div>
    <div className="dx-print-footer"><span>GasLara · Sistema Integrado de Distribución</span><span>AD {r.ad} · generado el {fecha(HOY)}</span></div>
  </section>;
}

function InfoPrint({ label, value }) { return <div><span>{label}</span><b>{value}</b></div>; }

/* ── COMUNAS Y USUARIOS ─────────────────────────────────────────────────────────
   La entrega física es en el punto comunal; el control interno conserva a cada persona, su
   pedido, su pago y su AD. Se agrupa por la comuna de la persona, no por la de la ruta:
   quien pasó a una AD especial sigue siendo de su comunidad. */
function Comunas({ pedidos, onVerUsuario }) {
  const residenciales = useMemo(() => pedidos.filter((p) => p.segmento === "RESIDENCIAL").map((p) => ({ ...p, comunaReal: comunaOf(p.comunaId).nombre })), [pedidos]);
  const comunas = useMemo(() => [...new Set(residenciales.map((p) => p.comunaReal))].sort(), [residenciales]);
  const [comuna, setComuna] = useState(() => comunas[0] || "");
  const [comunidad, setComunidad] = useState("TODAS");
  const [estado, setEstado] = useState("TODOS");
  const deComuna = useMemo(() => residenciales.filter((p) => p.comunaReal === comuna), [residenciales, comuna]);
  const comunidades = useMemo(() => [...new Set(deComuna.map((p) => p.comunidad).filter(Boolean))].sort(), [deComuna]);
  useEffect(() => { if (comunidad !== "TODAS" && !comunidades.includes(comunidad)) setComunidad("TODAS"); }, [comunidades, comunidad]);
  const filas = deComuna.filter((p) => comunidad === "TODAS" || p.comunidad === comunidad);
  const visibles = filas.filter((p) => estado === "TODOS" || p.estado === estado);
  const cuenta = (...ks) => filas.filter((p) => ks.includes(p.estado)).length;
  const ads = [...new Set(filas.filter((p) => p.incluidoAD).map((p) => p.ad))];

  return <div className="dx-content">
    <Card title="Comunas y usuarios" subtitle="Cada persona que pidió su bombona, con su estado, su pago y su AD. Las cifras cuentan pedidos; las personas se cuentan una vez.">
      <div className="dx-filters">
        <label><span>Comuna</span><select value={comuna} onChange={(e) => { setComuna(e.target.value); setComunidad("TODAS"); }}>{comunas.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span>Comunidad</span><select value={comunidad} onChange={(e) => setComunidad(e.target.value)}><option value="TODAS">Todas</option>{comunidades.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label><span>Estado</span><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="TODOS">Todos</option>{ESTADOS_SOLICITUD.map((x) => <option key={x.key} value={x.key}>{x.admin}</option>)}</select></label>
      </div>
      <div className="dx-summary-strip">
        <div><span>Personas</span><b>{num(new Set(filas.map((p) => p.usuario)).size)}</b><small>{num(filas.length)} pedidos</small></div>
        <div><span>Pagados por planificar</span><b>{num(cuenta("PAGADA"))}</b></div>
        <div><span>En AD</span><b>{num(cuenta("EN_AD"))}</b><small>{ads.length ? `AD ${ads.slice(0, 3).join(", ")}${ads.length > 3 ? "…" : ""}` : "Sin AD activa"}</small></div>
        <div><span>Por replanificar</span><b>{num(cuenta("POR_REPLANIFICAR"))}</b></div>
        <div><span>Fuera por el pago</span><b>{num(cuenta("SIN_PAGO", "POR_COMPLETAR"))}</b></div>
        <div><span>Entregados</span><b>{num(cuenta("CULMINADO"))}</b></div>
      </div>
      <div className="dx-table-wrap users"><table className="dx-table"><thead><tr><th>Persona</th><th>Cédula</th><th>Pedido</th><th>Comunidad</th><th>Producto</th><th>Estado</th><th>Pago</th><th>AD</th></tr></thead>
        <tbody>{visibles.slice(0, 600).map((p) => { const [tp, lp] = PAGO_TAG[p.estadoPago] || ["slate", p.estadoPago]; return <tr key={p.id}>
          <td><button className="dx-name-link" onClick={() => onVerUsuario(p.usuario)}>{p.nombre}</button></td><td>{p.cedula}</td>
          <td><b>{p.id}</b><span>{p.fechaPedido}</span></td><td>{p.comunidad}</td><td>{p.cantidad} × {p.kg} kg</td>
          <td><TagSol k={p.estado} />{p.problema && <span>{p.problema.nombre}</span>}</td><td><Tag tone={tp}>{lp}</Tag></td>
          <td>{p.ad ? <><b>{p.ad}</b><span>{p.incluidoAD ? estadoAD(p.estadoRuta).nombre : "—"}</span></> : "—"}</td></tr>; })}</tbody></table>
        {!visibles.length && <div className="dx-vacio-seg">Nadie coincide con el filtro.</div>}</div>
      {visibles.length > 600 && <div className="dx-pagination"><span>Mostrando 600 de {num(visibles.length)}. Elige una comunidad o un estado para ver el resto.</span></div>}
    </Card>
  </div>;
}

function StepTab({ n, label, on, done }) { return <div className={`${on ? "on" : ""} ${done ? "done" : ""}`}><b>{done ? <Check size={13} /> : n}</b><span>{label}</span></div>; }
function Kpi({ icon: I, label, value, foot }) { return <div className="dx-kpi"><I size={18} /><span>{label}</span><b>{value}</b><small>{foot}</small></div>; }
function Card({ title, subtitle, action, children }) { return <section className="dx-card"><div className="dx-card-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>; }
function Stat({ label, value, tone = "slate" }) { return <div className={`dx-stat ${tone}`}><span>{label}</span><b>{num(value)}</b></div>; }
function Tag({ tone = "slate", children }) { return <span className={`dx-tag ${tone}`}>{children}</span>; }
function TagAD({ r }) { const e = estadoAD(r.estadoRuta); return <Tag tone={TONO[e.tono]}>{e.nombre}</Tag>; }
function TagSol({ k }) { const e = estadoSolicitud(k); return <Tag tone={TONO[e.tono]}>{e.admin}</Tag>; }
function Empty({ text }) { return <div className="dx-empty"><CircleDot size={15} />{text}</div>; }
function siguienteAD(rutas) { let m = 76000; rutas.forEach((r) => { String(r.ad || "").split(/\D+/).forEach((x) => { const n = Number(x); if (n > m && n < 999999) m = n; }); }); return m + 1; }
const titulo = (v) => ({ inicio: "Resumen de distribución", pedidos: "Pedidos en tiempo real", ads: "AD del día", replan: "Replanificación", ejecucion: "Ejecución y cierre de AD",
  flota: "Flota y operadores", planta: "Movimiento de planta", granel: "Granel", movil: "Planta móvil", comunas: "Comunas y usuarios" }[v]);
const subtitulo = (v) => ({
  inicio: "Lo esencial de la jornada en una sola vista.",
  pedidos: "Cada solicitud de bombona del sistema, antes y después de entrar en un AD. Lo que entra por el portal o por taquilla aparece aquí al instante.",
  ads: "Planificar, consultar, reasignar e imprimir las AD. Sólo entran pedidos pagados completos; cada AD abre a su gente.",
  replan: "Los pedidos que tuvieron un problema en la jornada siguen vivos: se atienden en una AD especial por usuario antes del cierre del ciclo.",
  ejecucion: "Recolección en el punto, llenado en planta, devolución al mismo punto y cierre. El cierre factura lo devuelto lleno, emite la BOP y descuenta el inventario.",
  flota: "Disponibilidad real de vehículos, conductores y ayudantes, con su ocupación en las AD activas.",
  planta: "Registro del operador de planta: las gandolas y los movimientos que produce cada jornada.",
  granel: "Clientes con tanque propio, niveles de reposición y histórico de despachos medidos en sitio.",
  movil: "Jornadas de llenado en calle, atención a usuarios sin código y arqueo de la caja.",
  comunas: "La entrega física es en el punto comunal; el control interno conserva a cada persona, su pago y su AD.",
}[v]);

function Estilos() {
  return <style>{`
.dx{min-height:100vh;background:#F5F7F9;color:#17232C;font-family:Inter,Segoe UI,system-ui,sans-serif;display:grid;grid-template-columns:250px 1fr}
.dx-side{background:#111A22;color:#EAF0F4;padding:22px 16px;display:flex;flex-direction:column;gap:16px}.dx-brand{display:flex;align-items:center;gap:10px}.dx-brand img{width:68px;background:#fff;border-radius:9px;padding:5px}.dx-brand b{display:block;font-size:18px}.dx-brand span{font-size:11px;color:#9EADB9}.dx-side>p{font-size:12px;line-height:1.55;color:#B9C4CD;margin:0}
.dx-side nav{display:flex;flex-direction:column;gap:7px}.dx-side nav button{border:0;background:transparent;color:#BDC7D0;border-radius:10px;padding:11px 10px;display:flex;align-items:center;gap:9px;text-align:left;font-size:12px;font-weight:700;cursor:pointer}.dx-side nav button.on{background:#EAF4EE;color:#174B32}.dx-side nav em{margin-left:auto;background:#D88B22;color:white;font-style:normal;font-size:10px;border-radius:999px;padding:2px 6px}
.dx-rule{margin-top:auto;border-top:1px solid #26343F;padding-top:14px}.dx-rule small{display:block;color:#82929F;font-size:10px}.dx-rule b{display:block;font-size:13px;margin:4px 0}.dx-rule span{font-size:11px;color:#AAB6C0;line-height:1.45;display:block}
.dx-main{padding:24px 26px 34px;min-width:0;overflow-x:hidden}.dx-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.dx-head>div>span{font-size:10px;font-weight:800;color:#26704C;background:#EAF4EE;padding:6px 9px;border-radius:999px}.dx-head h1{font-size:27px;margin:10px 0 5px}.dx-head p{margin:0;color:#687681;font-size:13px}.dx-date{background:white;border:1px solid #DDE4EA;border-radius:10px;padding:9px 11px;display:flex;gap:7px;align-items:center;font-size:12px}
.dx-content{display:flex;flex-direction:column;gap:16px}.dx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px}.dx-kpi,.dx-card{background:white;border:1px solid #E0E6EB;border-radius:16px;box-shadow:0 5px 16px rgba(20,30,40,.035)}.dx-kpi{padding:14px;display:flex;flex-direction:column;gap:6px}.dx-kpi>span{color:#697784;font-size:11px}.dx-kpi>b{font-size:25px}.dx-kpi>small{font-size:11px;color:#85929C}
.dx-grid{display:grid;gap:16px}.dx-grid.two{grid-template-columns:1fr 1fr}.dx-card{padding:16px}.dx-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}.dx-card h2{font-size:16px;margin:0 0 4px}.dx-card-head p{font-size:12px;color:#72808C;margin:0;line-height:1.45}
.dx-primary,.dx-secondary,.dx-link,.dx-iconbtn{border:0;border-radius:10px;font-weight:800;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.dx-primary{background:#17623F;color:#fff;padding:9px 12px}.dx-secondary{background:#EEF2F5;color:#2F3C46;padding:9px 12px}.dx-link{background:transparent;color:#17623F;padding:2px}.dx-iconbtn{background:#EEF2F5;color:#34434E;width:32px;height:32px;justify-content:center}.dx-primary:disabled,.dx-secondary:disabled{opacity:.45;cursor:not-allowed}
.dx-list,.dx-community-list{display:flex;flex-direction:column;gap:9px}.dx-list-row,.dx-community{border:1px solid #E5EAEE;background:#FBFCFD;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.dx-list-row b,.dx-community b{display:block;font-size:13px}.dx-list-row span,.dx-community span{display:block;font-size:11px;color:#74818C;margin-top:3px}
.dx-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dx-stat{padding:11px;border-radius:11px;background:#F1F4F6}.dx-stat.amber{background:#FFF3E5}.dx-stat.blue{background:#EAF1FA}.dx-stat.green{background:#EAF5EE}.dx-stat.red{background:#FBE9E9}.dx-stat span{font-size:10px;color:#667582}.dx-stat b{display:block;font-size:20px;margin-top:4px}
.dx-ad-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.dx-ad-card{border:1px solid #E4EAEE;background:#FBFCFD;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.dx-ad-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.dx-ad-top>span{font-size:10px;color:#75838F}.dx-ad-card>b{font-size:13px}.dx-ad-card p{font-size:11px;color:#6E7B87;margin:4px 0 10px;line-height:1.35}.dx-ad-foot{display:flex;justify-content:space-between;color:#65737F;font-size:10px}.dx-ad-next{display:block;margin-top:8px;font-size:10px;color:#17623F;font-weight:700}
.dx-tag{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800}.dx-tag.green{background:#E7F4EC;color:#1C6945}.dx-tag.amber{background:#FFF1E0;color:#A66A16}.dx-tag.blue{background:#E8F0FB;color:#2E67AE}.dx-tag.red{background:#FBE9E9;color:#A13D3D}.dx-tag.slate{background:#EEF2F5;color:#5D6974}
.dx-toolbar{display:flex;justify-content:flex-end}.dx-search{background:white;border:1px solid #DBE3E9;border-radius:10px;padding:9px 10px;display:flex;align-items:center;gap:7px;min-width:290px}.dx-search input{border:0;outline:none;width:100%;font:inherit;font-size:12px}
.dx-community{display:grid;grid-template-columns:1.4fr 1fr auto}.dx-community-main{display:flex;gap:10px;align-items:flex-start}.dx-community-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-community-counts>div{background:#F2F5F7;padding:7px;border-radius:8px}.dx-community-counts span{font-size:9px!important;margin:0!important}.dx-community-counts b{font-size:13px;margin-top:2px}
.dx-table-wrap{border:1px solid #E3E9ED;border-radius:12px;overflow:auto}.dx-table-wrap.users{max-height:430px}.dx-table{width:100%;border-collapse:collapse;font-size:11px}.dx-table thead{position:sticky;top:0;background:#F4F6F8;z-index:1}.dx-table th,.dx-table td{padding:9px 10px;border-bottom:1px solid #E9EDF0;text-align:left;white-space:nowrap}.dx-table th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#697783}.dx-table td>b{display:block;font-size:11px}.dx-table td>span{display:block;font-size:10px;color:#77848F;margin-top:2px}.dx-table td>.dx-tag{display:inline-flex;margin:0 0 2px}.dx-table tr.muted{background:#FAFAFA;color:#89949C}
.dx-filters{display:grid;grid-template-columns:1fr 1fr .7fr;gap:10px;margin-bottom:12px}.dx-filters label span,.dx-formgrid label span{font-size:10px;color:#697783;display:block;margin-bottom:5px}.dx-filters select,.dx-formgrid select,.dx-formgrid input{width:100%;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:9px;font:inherit;font-size:11px;background:white}.dx-formgrid input[readonly]{background:#F5F7F8}
.dx-summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 12px}.dx-summary-strip>div{background:#F4F7F8;padding:10px;border-radius:10px}.dx-summary-strip span{font-size:9px;color:#687682;display:block}.dx-summary-strip b{font-size:14px;display:block;margin-top:3px}.dx-summary-strip small{display:block;font-size:10px;color:#6D7A85;margin-top:3px;line-height:1.35}
.dx-empty{padding:15px;border:1px dashed #D5DEE5;border-radius:10px;color:#6C7985;font-size:11px;display:flex;gap:6px;align-items:center}
.dx-modal-bg{position:fixed;inset:0;background:rgba(15,22,28,.48);display:grid;place-items:center;padding:18px;z-index:50}.dx-wizard,.dx-detail{width:min(1050px,97vw);max-height:94vh;background:white;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 70px rgba(0,0,0,.2)}.dx-wizard>header,.dx-detail>header{padding:16px 18px;border-bottom:1px solid #E6EBEF;display:flex;justify-content:space-between}.dx-wizard header small,.dx-detail header small{font-size:9px;color:#6D7A85;font-weight:800}.dx-wizard h2,.dx-detail h2{font-size:19px;margin:3px 0}.dx-wizard header p,.dx-detail header p{font-size:11px;color:#6D7A85;margin:0}.dx-wizard header button,.dx-detail header button{border:1px solid #DDE4E9;background:white;width:32px;height:32px;border-radius:9px}
.dx-wsteps{padding:12px 18px;background:#FAFBFC;display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:1px solid #E7ECEF}.dx-wsteps>div{display:flex;align-items:center;gap:6px;color:#84909A;font-size:10px}.dx-wsteps>div b{width:23px;height:23px;border-radius:50%;background:#E9EDF0;display:grid;place-items:center}.dx-wsteps>div.on,.dx-wsteps>div.done{color:#17623F;font-weight:800}.dx-wsteps>div.on b,.dx-wsteps>div.done b{background:#DFF0E6;color:#17623F}.dx-wsteps>i{width:42px;height:1px;background:#D9E0E5}
.dx-wizard>main,.dx-detail>main{padding:16px 18px;overflow:auto;flex:1}.dx-wintro{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px}.dx-wintro b{display:block;font-size:13px}.dx-wintro span{display:block;font-size:11px;color:#6F7C87;margin-top:3px}.dx-wcounts{display:flex;gap:6px}.dx-wcounts span{background:#F1F4F6;padding:6px 8px;border-radius:999px;font-size:9px;margin:0;white-space:nowrap}
.dx-user-toolbar{display:flex;gap:7px;align-items:center;margin-bottom:9px;flex-wrap:wrap}.dx-user-toolbar .dx-search{margin-right:auto}.dx-user-toolbar .dx-segmentos{margin:0 auto 0 0}.dx-user-toolbar .dx-filter-select{min-width:190px}
.dx-wizard>footer,.dx-detail>footer{padding:12px 18px;border-top:1px solid #E6EBEF;display:flex;justify-content:space-between}.dx-foot-acc{display:flex;gap:7px}
.dx-formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.dx-load{margin-top:14px;border:1px solid #DDE9E2;background:#F4F9F6;border-radius:12px;padding:12px}.dx-load h3,.dx-preview h3,.dx-detail main h3{font-size:12px;margin:0 0 9px}.dx-detail main h3{margin-top:16px}.dx-load>div{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-load span{background:white;border-radius:8px;padding:7px;font-size:9px}.dx-load span b{font-size:14px;display:block;margin-top:2px}.dx-load strong{display:block;font-size:11px;margin-top:9px}
.dx-confirm{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.dx-confirm>div{background:#F4F7F8;padding:10px;border-radius:10px}.dx-confirm span{display:block;font-size:9px;color:#697783}.dx-confirm b{display:block;font-size:12px;margin-top:3px}.dx-confirm small{display:block;font-size:9px;color:#6D7B86;margin-top:2px}
.dx-preview{margin-top:12px}.dx-preview>div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #E8EDF0;padding:7px 0;font-size:11px}.dx-detail{width:min(960px,96vw)}.dx-abono{width:min(620px,96vw)}
.dx-toast{position:fixed;right:18px;bottom:18px;background:#15222A;color:white;border-radius:10px;padding:10px 12px;display:flex;gap:7px;align-items:center;font-size:11px;z-index:200;max-width:560px;line-height:1.45}.dx-toast.warn{background:#7A4E12}
.dx-error{display:flex;gap:8px;align-items:flex-start;background:#FBE9E9;border:1px solid #F0C9C9;color:#8E3434;border-radius:10px;padding:10px;margin-top:12px;font-size:11px;line-height:1.45}
.dx-fuentes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:11px}
.dx-fuente{border:1px solid #E0E6EB;border-left-width:4px;border-radius:13px;padding:14px;background:#FBFCFD;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:3px}.dx-fuente:hover{background:#F5F8F9}
.dx-fuente>span{font-size:8.5px;font-weight:800;letter-spacing:.06em;color:#7A8791}.dx-fuente>b{font-size:25px;margin:4px 0 0}.dx-fuente>em{font-style:normal;font-size:11px;color:#4B5A66}.dx-fuente>small{font-size:10px;color:#7C8892;margin-top:4px;line-height:1.4}
.dx-fuente.com{border-left-color:#2D65B0}.dx-fuente.com>b{color:#2D65B0}.dx-fuente.ope{border-left-color:#1C7A50}.dx-fuente.ope>b{color:#1C7A50}.dx-fuente.flo{border-left-color:#A2701A}.dx-fuente.flo>b{color:#A2701A}
.dx-flota-alerta{display:flex;gap:9px;align-items:flex-start;margin-top:11px;background:#FFF6E7;border:1px solid #EED8B2;color:#82561D;border-radius:11px;padding:11px}.dx-flota-alerta>div>b,.dx-flota-alerta>div>span{display:block}.dx-flota-alerta b{font-size:11px;margin-bottom:3px}.dx-flota-alerta span{font-size:10px;line-height:1.45}
.dx-livebar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#F0F7F3;border:1px solid #D6E8DD;border-radius:12px;padding:11px 13px}.dx-livebar>div{display:flex;align-items:center;gap:8px;color:#285E43}.dx-livebar b{font-size:12px}.dx-livebar span{font-size:11px;color:#607267}.dx-livebar .dx-primary{white-space:nowrap}
.dx-kpis.orders{grid-template-columns:repeat(4,1fr)}.dx-orders-filters{display:grid;grid-template-columns:2fr repeat(4,minmax(130px,1fr));gap:8px;margin-bottom:12px;align-items:end}.dx-search.wide{min-width:0}.dx-filter-select span{display:block;font-size:9px;color:#687682;margin-bottom:4px}.dx-filter-select select{width:100%;border:1px solid #DBE3E9;border-radius:9px;background:white;padding:9px 8px;font:inherit;font-size:10px;color:#30404B}
.dx-clear{border:1px solid #DDE4E9;background:white;color:#4D5B66;border-radius:9px;padding:9px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer}.orders-table{max-height:570px}.dx-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:10px;color:#6D7A85}.dx-pagination>div{display:flex;gap:6px}
.dx-driver-card{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.dx-driver-card>div{border:1px solid #DFE7EC;background:#F8FAFB;border-radius:11px;padding:11px;display:grid;grid-template-columns:auto 1fr;column-gap:8px}.dx-driver-card svg{grid-row:1/5;color:#17623F}.dx-driver-card span{font-size:9px;color:#6A7884}.dx-driver-card b{font-size:12px;margin-top:2px}.dx-driver-card small{font-size:10px;color:#6B7984;margin-top:2px}
.dx-orders-help{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.dx-orders-help>div{background:#F7F9FA;border:1px solid #E3E9ED;border-radius:10px;padding:10px}.dx-orders-help b{display:block;font-size:10px}.dx-orders-help span{display:block;font-size:10px;color:#6C7984;line-height:1.4;margin-top:3px}
.dx-selectionbar{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#F4F8F5;border:1px solid #DCE9E1;border-radius:11px;padding:9px 11px;margin-bottom:10px}.dx-selectionbar>div:first-child b{display:block;font-size:11px}.dx-selectionbar>div:first-child span{display:block;font-size:9px;color:#64736B;margin-top:2px}.dx-selectionbar>div:last-child{display:flex;gap:6px;flex-wrap:wrap}
.dx-custom-warning{display:flex;gap:8px;align-items:flex-start;background:#FFF5E8;border:1px solid #F0D7B2;color:#8A5815;border-radius:10px;padding:10px;margin:8px 0 11px;font-size:10px;line-height:1.45}
.dx-justification{display:block;margin-top:12px}.dx-justification>span{display:block;font-size:10px;color:#697783;margin-bottom:5px}.dx-justification textarea{width:100%;min-height:62px;resize:vertical;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:9px;font:inherit;font-size:11px}.dx-wizard.custom{width:min(1180px,97vw)}
.dx-row-plan{border:1px solid #CFE1D6;background:#EEF7F1;color:#185B3B;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.dx-row-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.dx-user-link{border:1px solid #D7E1E7;background:#fff;color:#335363;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap}
.dx-name-link{border:0;background:none;padding:0;font:inherit;font-size:11px;font-weight:700;color:#17623F;cursor:pointer;text-align:left;display:block}.dx-name-link:hover{text-decoration:underline}.dx-celda-larga{white-space:normal!important;max-width:260px}
.dx-report-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.dx-hoja{font-style:normal;font-weight:600;color:#A2701A;font-size:10px}
.dx-momentos{list-style:none;margin:0 0 12px;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dx-momentos li{border:1px solid #E4EAEE;border-left:3px solid #D5DDE3;border-radius:10px;padding:9px 10px;background:#FAFBFC}.dx-momentos li.hecho{border-left-color:#2DA268;background:#F4FAF6}.dx-momentos b,.dx-momentos span,.dx-momentos small{display:block}.dx-momentos b{font-size:11px}.dx-momentos span{font-size:10px;color:#6D7A85;margin-top:2px}.dx-momentos small{font-size:10px;color:#4F5D68;margin-top:4px;line-height:1.4}
.dx-paradas{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.dx-paradas li{display:grid;grid-template-columns:minmax(180px,1fr) 1.3fr auto;gap:10px;align-items:center;border:1px solid #E4EAEE;border-radius:9px;padding:8px 10px;background:#FBFCFD;font-size:11px}.dx-paradas span{color:#65737F;display:inline-flex;gap:4px;align-items:center}.dx-paradas em{font-style:normal;font-size:10px;color:#8A5A16;background:#FFF3E2;border-radius:99px;padding:3px 8px;white-space:nowrap}
.dx-especiales{display:flex;flex-direction:column;gap:10px}.dx-especial{border:1px solid #E0E6EB;border-radius:12px;padding:12px;background:#fff}.dx-especial-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px}.dx-especial-head b,.dx-especial-head span{display:block}.dx-especial-head b{font-size:13px}.dx-especial-head span{font-size:11px;color:#6D7A85;margin-top:2px}.dx-especial-head>div:last-child{display:flex;gap:7px;align-items:center}.dx-especial>small{display:block;margin-top:8px;font-size:10.5px;color:#6D7A85}
.dx-bitacora{list-style:none;margin:0 0 12px;padding:0;display:flex;flex-direction:column}.dx-bitacora li{display:flex;gap:8px;align-items:center;font-size:11px;border-bottom:1px solid #EDF1F3;padding:6px 0}.dx-bitacora span{color:#6D7A85;white-space:nowrap}
.dx-print-root{position:fixed;inset:0;background:#E9EEF2;z-index:120;display:flex;flex-direction:column}.dx-print-shell{height:62px;background:#101820;color:white;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;flex:0 0 auto}.dx-print-shell>div:first-child b{display:block;font-size:13px}.dx-print-shell>div:first-child span{display:block;font-size:9px;color:#AAB5BE;margin-top:3px}.dx-print-shell>div:last-child{display:flex;gap:8px}.dx-print-scroll{overflow:auto;flex:1;padding:22px}.dx-print-paper{width:min(1180px,96vw);margin:0 auto;background:white;box-shadow:0 15px 45px rgba(13,24,31,.15);padding:32px;box-sizing:border-box}
.dx-print-cover{min-height:900px;display:flex;flex-direction:column;justify-content:center}.dx-print-cover-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:35px 0}.dx-print-cover-grid>div{border:1px solid #DCE4E9;background:#F7F9FA;border-radius:10px;padding:16px}.dx-print-cover-grid span{display:block;font-size:10px;color:#6B7883}.dx-print-cover-grid b{display:block;font-size:24px;margin-top:5px}.dx-print-cover-note{max-width:760px;color:#5F6D78;font-size:12px;line-height:1.7}
.dx-print-ad{font-family:Arial,Helvetica,sans-serif;color:#101820;font-size:10px}.dx-print-ad.page-break{page-break-before:always;padding-top:4px}.dx-print-brand{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;border-bottom:2px solid #18222B;padding-bottom:13px;margin-bottom:16px}.dx-print-brand img{width:82px}.dx-print-brand small{display:block;font-size:8px;letter-spacing:.05em;color:#53616C;font-weight:700}.dx-print-brand h1{font-size:17px;margin:3px 0}.dx-print-brand p{margin:0;font-size:9px;color:#68757F}
.dx-print-ad-box{border:1px solid #1D2932;border-radius:6px;min-width:92px;text-align:center;padding:8px 10px}.dx-print-ad-box span{display:block;font-size:8px}.dx-print-ad-box b{display:block;font-size:18px;margin:2px 0}.dx-print-ad-box em{display:block;font-style:normal;font-size:8px;color:#4B5A65}
.dx-print-section-title{font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.04em;background:#EEF2F4;border-left:4px solid #1D6A46;padding:7px 9px;margin:14px 0 9px}.dx-print-info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-print-info-grid.four{grid-template-columns:repeat(4,1fr)}.dx-print-info-grid>div{border:1px solid #DDE4E8;padding:7px 8px;border-radius:5px;min-height:37px}.dx-print-info-grid span{display:block;font-size:7.5px;color:#65727C;text-transform:uppercase}.dx-print-info-grid b{display:block;font-size:9px;margin-top:3px;line-height:1.3}
.dx-print-load-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-print-load-grid>div{border:1px solid #DDE4E8;background:#FAFBFC;padding:8px;border-radius:5px}.dx-print-load-grid>div.strong{background:#F0F6F2;border-color:#D1E2D8}.dx-print-load-grid span{display:block;font-size:8px;color:#64717B}.dx-print-load-grid b{display:block;font-size:13px;margin-top:3px}
.dx-print-auth{border:1px solid #E2C98B;background:#FFF9E9;border-radius:5px;padding:8px 9px;margin-top:9px}.dx-print-auth b,.dx-print-auth span{display:block}.dx-print-auth span{margin-top:3px;line-height:1.45}
.dx-print-table-wrap{overflow:visible}.dx-print-table{width:100%;border-collapse:collapse;font-size:7.8px}.dx-print-table th,.dx-print-table td{border:1px solid #D6DEE3;padding:4px 5px;text-align:left;vertical-align:top}.dx-print-table th{background:#EDF1F3;text-transform:uppercase;font-size:7px;letter-spacing:.03em}.dx-print-table tfoot td{font-weight:800;background:#F3F6F7}
.dx-print-observations{border:1px solid #D9E1E6;padding:8px;margin-top:9px}.dx-print-observations b{display:block}.dx-print-observations div{min-height:42px;margin-top:6px;border-bottom:1px solid #CBD5DB}
.dx-print-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:34px 0 18px}.dx-print-signatures>div{text-align:center}.dx-print-signatures span{display:block;font-weight:700}.dx-print-signatures i{display:block;height:34px;border-bottom:1px solid #2A343C}.dx-print-signatures small{display:block;font-size:7.5px;color:#65727C;margin-top:4px}
.dx-print-footer{display:flex;justify-content:space-between;border-top:1px solid #D7DFE4;padding-top:7px;color:#67747E;font-size:7.5px}.dx-print-cover .dx-print-brand{grid-template-columns:auto 1fr}.dx-print-cover .dx-print-brand h1{font-size:25px}
@media print{body *{visibility:hidden!important}.dx-print-root,.dx-print-root *{visibility:visible!important}.dx-print-root{position:absolute!important;inset:0!important;background:white!important;display:block!important}.dx-print-shell{display:none!important}.dx-print-scroll{overflow:visible!important;padding:0!important}.dx-print-paper{width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important}.dx-print-cover{page-break-after:always;min-height:auto;padding-top:22mm}.dx-print-ad{page-break-inside:auto}.dx-print-table thead{display:table-header-group}.dx-print-table tfoot{display:table-footer-group}.dx-print-table tr{page-break-inside:avoid}.dx-print-section-title,.dx-print-brand,.dx-print-load-grid,.dx-print-info-grid,.dx-print-signatures{page-break-inside:avoid}@page{size:landscape;margin:9mm}}
@media(max-width:1100px){.dx-orders-filters{grid-template-columns:repeat(3,1fr)}.dx-search.wide{grid-column:1/-1}.dx-kpis,.dx-ad-grid{grid-template-columns:repeat(2,1fr)}.dx-grid.two{grid-template-columns:1fr}.dx-community{grid-template-columns:1fr}.dx-community-counts{order:2}.dx-community>button{justify-self:start}.dx{grid-template-columns:210px 1fr}.dx-momentos{grid-template-columns:repeat(2,1fr)}.dx-paradas li{grid-template-columns:1fr}}
@media(max-width:1000px){.dx-fuentes-grid{grid-template-columns:1fr}}
@media(max-width:800px){.dx-orders-filters,.dx-driver-card{grid-template-columns:1fr}.dx{grid-template-columns:1fr}.dx-side{display:none}.dx-main{padding:15px}.dx-kpis,.dx-kpis.orders,.dx-ad-grid,.dx-status,.dx-filters,.dx-summary-strip,.dx-formgrid,.dx-confirm,.dx-orders-help,.dx-momentos{grid-template-columns:1fr}.dx-head{flex-direction:column;gap:10px}.dx-user-toolbar{flex-wrap:wrap}.dx-search{min-width:0;width:100%}}
`}</style>;
}
