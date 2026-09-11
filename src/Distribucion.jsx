import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ClipboardPlus, ClipboardList, Users, BarChart3, CalendarDays, Search,
  CheckCircle2, AlertTriangle, Building2, Route, Fuel, Package2, MapPin, UserRound,
  ChevronRight, Download, X, Truck, Clock3, CircleDot, ChevronLeft, Check, FileText,
  Radio, RefreshCw, Filter, CarFront, Factory, Droplets, Caravan, ClipboardCheck,
} from "lucide-react";
import { EMPRESA, LOGO_GASLARA, descargar, csv, num, kgALitros, kgDeSolicitud } from "./datos.jsx";
import {
  PLANIFICACION_1408, UNIDADES_DISTRIBUCION, OPERADORES_DISTRIBUCION, unidadDistribucion, operadorDistribucion, operadoresParaUnidad,
  cilindrosFila, kgFila, litrosInventarioFila, beneficiariosDeRuta, pedidosDeRutas, historialDistribucionPersona, REPORTE_1308,
  ayudanteDistribucion, disponibilidadUnidad, AYUDANTES_DISTRIBUCION,
} from "./distribucionSeed.js";
import Usuario360Modal from "./Usuario360.jsx";
import { KgL, NotaFactor, UnidadesStyles, kgYL } from "./Unidades.jsx";
import EjecucionAD from "./DistribucionEjecucion.jsx";
import { cuadreAD, ListaPersonasAD, CuadreChips, PersonasStyles } from "./DistribucionPersonas.jsx";
import { PreparacionCarga, FlotaDistribucion, Reasignar } from "./DistribucionExtra.jsx";
import { MovimientoPlanta, GranelDistribucion, PlantaMovil } from "./DistribucionPlanta.jsx";

const fmt = (n, d = 0) => Number(n || 0).toLocaleString("es-VE", { minimumFractionDigits:d, maximumFractionDigits:d });
const pct = (a,b) => b ? `${fmt(a/b*100,1)}%` : "0,0%";
const estados = {
  SIN_PLANIFICAR:{label:"Sin planificar",tone:"amber"}, ASIGNADA:{label:"Asignada",tone:"slate"},
  PREPARANDO:{label:"Preparando carga",tone:"amber"}, LISTA_SALIDA:{label:"Lista para salida",tone:"blue"},
  EN_RUTA:{label:"En ruta",tone:"blue"}, PARCIAL:{label:"Entrega parcial",tone:"amber"}, ENTREGADA:{label:"Entregada",tone:"green"}, CERRADA:{label:"Cerrada",tone:"green"},
  INCIDENCIA:{label:"Incidencia",tone:"red"}, REPROGRAMADA:{label:"Reprogramada",tone:"amber"}, CANCELADA:{label:"Cancelada",tone:"red"},
};
const tipoFlota = { FUERZA_PROPIA:"Fuerza propia", EPSDC:"EPSDC", POR_ASIGNAR:"Por asignar" };
const usuariosRuta = (r) => (r.beneficiariosSnapshot || beneficiariosDeRuta(r)).filter((p) => !(r.customAssignedPedidoIds || []).includes(p.id));

export default function Distribucion({
  rutasDistribucion = PLANIFICACION_1408,
  actualizarRutaDistribucion = () => {},
  crearRutaDistribucionPersonalizada = () => {},
  movPlanta = [], existencias = {}, disponibles = {}, solicitudes = [], parqueEnvases = [],
  cerrarAD = () => ({ ok: false }),
  crearMovimientoPlanta = () => {}, crearVentaGenerica = () => {},
}) {
  const [vista,setVista]=useState("inicio");
  const [wizard,setWizard]=useState(null);
  const [customWizard,setCustomWizard]=useState(null);
  const [detalle,setDetalle]=useState(null);
  const [usuario360,setUsuario360]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [toast,setToast]=useState("");
  const aviso=(m)=>{setToast(m);setTimeout(()=>setToast(""),2300)};

  const resumen=useMemo(()=>{
    const total=rutasDistribucion.reduce((a,r)=>a+cilindrosFila(r),0);
    const entregado=rutasDistribucion.filter(r=>r.estadoRuta==="ENTREGADA").reduce((a,r)=>a+cilindrosFila(r),0);
    const enRuta=rutasDistribucion.filter(r=>r.estadoRuta==="EN_RUTA").reduce((a,r)=>a+cilindrosFila(r),0);
    const pendientes=rutasDistribucion.filter(r=>r.estadoRuta==="SIN_PLANIFICAR");
    const asignadas=rutasDistribucion.filter(r=>r.estadoRuta!=="SIN_PLANIFICAR");
    return {total,entregado,enRuta,pendiente:total-entregado,pendientes,asignadas,kg:rutasDistribucion.reduce((a,r)=>a+kgFila(r),0)};
  },[rutasDistribucion]);

  const pedidos=useMemo(()=>pedidosDeRutas(rutasDistribucion),[rutasDistribucion]);
  const pedidosSinAD=pedidos.filter(p=>!p.ad).length;
  // AD que ya salieron y todavia no tienen cierre firmado: es lo que le queda por hacer al gerente.
  const porCerrar=rutasDistribucion.filter(r=>r.ad&&String(r.ad)!=="0"&&r.estadoRuta!=="SIN_PLANIFICAR"
    &&!["ENTREGADA","CERRADA","PARCIAL"].includes(r.estadoRuta)).length;

  const filtradas=useMemo(()=>{
    const q=buscar.trim().toLowerCase();
    return rutasDistribucion.filter(r=>!q||[r.comuna,r.comunidad,r.parroquia,r.ad,r.unidad,r.ruta].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[rutasDistribucion,buscar]);

  function abrirPlanificador(r){setWizard({ruta:r,paso:1});}
  function abrirPlanificadorCustom(seleccion){setCustomWizard({pedidos:seleccion});}
  function guardarPlan(ruta, payload){
    actualizarRutaDistribucion(ruta.id,payload);
    setWizard(null); aviso(`AD ${payload.ad} planificada y asignada`);
  }

  return <div className="dx">
    <Estilos />
    <UnidadesStyles />
    <aside className="dx-side">
      <div className="dx-brand"><img src={LOGO_GASLARA}/><div><b>Distribución</b><span>{EMPRESA.nombre}</span></div></div>
      <p>Recibe los pedidos individuales, agrupa los pagados por comunidad y asigna AD, ruta, vehículo y operador.</p>
      <nav>
        <Nav id="inicio" icon={LayoutDashboard} label="Resumen" {...{vista,setVista}}/>
        <Nav id="pedidos" icon={Radio} label="Pedidos en tiempo real" badge={pedidosSinAD} {...{vista,setVista}}/>
        <Nav id="ads" icon={ClipboardList} label="AD del día" badge={resumen.pendientes.length} {...{vista,setVista}}/>
        <Nav id="carga" icon={Package2} label="Preparación y carga" {...{vista,setVista}}/>
        <Nav id="ejecucion" icon={ClipboardCheck} label="Ejecución y cierre" badge={porCerrar} {...{vista,setVista}}/>
        <Nav id="flota" icon={CarFront} label="Flota y operadores" {...{vista,setVista}}/>
        <Nav id="planta" icon={Factory} label="Movimiento de planta" {...{vista,setVista}}/>
        <Nav id="granel" icon={Droplets} label="Granel" {...{vista,setVista}}/>
        <Nav id="movil" icon={Caravan} label="Planta móvil" {...{vista,setVista}}/>
        <Nav id="comunas" icon={Users} label="Comunas y usuarios" {...{vista,setVista}}/>
      </nav>
      <div className="dx-rule"><small>Flujo</small><b>Pedidos → AD → Ruta → Cierre</b><span>El conductor ejecuta la ruta que aquí se define. El cierre lo firma Distribución.</span></div>
    </aside>

    <main className="dx-main">
      <header className="dx-head"><div><span>C.D.T. GRAL. JACINTO LARA</span><h1>{titulo(vista)}</h1><p>{subtitulo(vista)}</p></div><div className="dx-date"><CalendarDays size={15}/>14-08-2026</div></header>
      {vista==="inicio"&&<Inicio {...{resumen,rutas:rutasDistribucion,abrirPlanificador,setVista,setDetalle,solicitudes,disponibles,existencias,movPlanta}}/>}
      {vista==="pedidos"&&<Pedidos pedidos={pedidos} rutas={rutasDistribucion} aviso={aviso} onPlanCustom={abrirPlanificadorCustom} onVerUsuario={setUsuario360}/>} 
      {vista==="ads"&&<ADs rutas={filtradas} solicitudes={solicitudes} buscar={buscar} setBuscar={setBuscar}
        setDetalle={setDetalle} abrirPlanificador={abrirPlanificador} actualizar={actualizarRutaDistribucion}
        onVerUsuario={setUsuario360} aviso={aviso}/>}
      {vista==="carga"&&<PreparacionCarga rutas={rutasDistribucion} actualizar={actualizarRutaDistribucion} aviso={aviso}/>}
      {vista==="ejecucion"&&<EjecucionAD rutas={rutasDistribucion} solicitudes={solicitudes} parqueEnvases={parqueEnvases}
        actualizar={actualizarRutaDistribucion} cerrarAD={cerrarAD} aviso={aviso}/>}
      {vista==="flota"&&<FlotaDistribucion rutas={rutasDistribucion}/>}
      {vista==="planta"&&<MovimientoPlanta movPlanta={movPlanta} existencias={existencias} onRegistrar={crearMovimientoPlanta} aviso={aviso}/>}
      {vista==="granel"&&<GranelDistribucion aviso={aviso}/>}
      {vista==="movil"&&<PlantaMovil onVender={crearVentaGenerica} aviso={aviso}/>}
      {vista==="comunas"&&<Comunas rutas={rutasDistribucion} onVerUsuario={setUsuario360}/>} 
    </main>

    {wizard&&<WizardAD ruta={wizard.ruta} rutas={rutasDistribucion} onClose={()=>setWizard(null)} onSave={guardarPlan}/>} 
    {customWizard&&<WizardADPersonalizada pedidos={customWizard.pedidos} rutas={rutasDistribucion} onClose={()=>setCustomWizard(null)} onSave={(nueva,seleccion)=>{crearRutaDistribucionPersonalizada(nueva,seleccion);setCustomWizard(null);aviso(`AD ${nueva.ad} personalizada creada`)}}/>}
    {detalle&&<DetalleAD ruta={detalle} onClose={()=>setDetalle(null)} onPlan={()=>{setDetalle(null);abrirPlanificador(detalle)}}/>}
    {usuario360&&<FichaUsuarioDistribucion pedido={usuario360} onClose={()=>setUsuario360(null)}/>}
    {toast&&<div className="dx-toast"><CheckCircle2 size={15}/>{toast}</div>}
  </div>;
}

function Nav({id,icon:I,label,badge=0,vista,setVista}){return <button className={vista===id?"on":""} onClick={()=>setVista(id)}><I size={17}/><span>{label}</span>{badge>0&&<em>{badge}</em>}</button>}

function Inicio({resumen,rutas,abrirPlanificador,setVista,setDetalle,solicitudes=[],disponibles={},existencias={},movPlanta=[]}){
  const pendientes=resumen.pendientes;
  const top=[...rutas].filter(r=>r.estadoRuta!=="SIN_PLANIFICAR").sort((a,b)=>cilindrosFila(b)-cilindrosFila(a)).slice(0,6);
  return <div className="dx-content">
    <FuentesDistribucion {...{solicitudes,disponibles,existencias,movPlanta,setVista}}/>
    <div className="dx-kpis">
      <Kpi icon={ClipboardList} label="AD planificadas" value={resumen.asignadas.length} foot={`${rutas.length} comunidades en la jornada`}/>
      <Kpi icon={Package2} label="Cilindros programados" value={num(resumen.total)} foot={<KgL kg={resumen.kg} />}/>
      <Kpi icon={Truck} label="Despachados" value={num(resumen.entregado)} foot={`${pct(resumen.entregado,resumen.total)} de la jornada`}/>
      <Kpi icon={Clock3} label="Pendientes de despacho" value={num(resumen.pendiente)} foot={`${resumen.pendientes.length} comunidades sin AD`}/>
    </div>

    <div className="dx-grid two">
      <Card title="Pendientes por planificar" subtitle="Comunidades con pedidos listos pero sin AD definitiva">
        <div className="dx-list">
          {pendientes.length?pendientes.map(r=><div className="dx-list-row" key={r.id}><div><b>{r.comunidad}</b><span>{r.comuna} · {cilindrosFila(r)} pedidos pagados</span></div><button className="dx-primary" onClick={()=>abrirPlanificador(r)}><ClipboardPlus size={14}/>Planificar AD</button></div>):<Empty text="Todas las comunidades del día ya tienen AD."/>}
        </div>
      </Card>
      <Card title="Estado de la jornada" subtitle="Seguimiento sencillo del despacho">
        <div className="dx-status"><Stat label="Sin planificar" value={resumen.pendientes.length} tone="amber"/><Stat label="Asignadas" value={rutas.filter(r=>r.estadoRuta==="ASIGNADA").length}/><Stat label="En ruta" value={rutas.filter(r=>r.estadoRuta==="EN_RUTA").length} tone="blue"/><Stat label="Entregadas" value={rutas.filter(r=>r.estadoRuta==="ENTREGADA").length} tone="green"/></div>
        <div className="dx-progressbox"><div><span>Cumplimiento</span><b>{pct(resumen.entregado,resumen.total)}</b></div><Progress value={resumen.entregado} total={resumen.total}/><small>{num(resumen.entregado)} entregados · {num(resumen.total-resumen.entregado)} por entregar</small></div>
      </Card>
    </div>

    <Card title="AD con mayor carga" subtitle="Vista rápida de las rutas ya planificadas" action={<button className="dx-link" onClick={()=>setVista("ads")}>Ver todas <ChevronRight size={14}/></button>}>
      <div className="dx-ad-grid">{top.map(r=><button className="dx-ad-card" key={r.id} onClick={()=>setDetalle(r)}><div className="dx-ad-top"><Tag tone={estados[r.estadoRuta]?.tone}>{estados[r.estadoRuta]?.label}</Tag><span>AD {r.ad}</span></div><b>{r.comunidad}</b><p>{r.comuna}</p><div><span>{cilindrosFila(r)} cilindros</span><span>Placa {unidadDistribucion(r.unidad).placa||r.unidad}</span></div></button>)}</div>
    </Card>
  </div>
}

/* Distribución no planifica en el vacío: toma solicitudes canceladas de Comercialización,
   gas disponible del control de planta y unidades con conductor y ayudante de Flota.
   Este panel deja visible de dónde sale cada insumo antes de armar una AD. */
function FuentesDistribucion({solicitudes=[],disponibles={},existencias={},movPlanta=[],setVista}){
  const canceladas=solicitudes.filter(s=>s.pago?.estado==="VERIFICADO"&&s.estado!=="CULMINADO"&&s.estado!=="ABONADA");
  const kgSolicitado=canceladas.reduce((a,s)=>a+kgDeSolicitud(s),0);
  const dispKg=Object.values(disponibles).reduce((a,v)=>a+Number(v||0),0);
  const fisKg=Object.values(existencias).reduce((a,v)=>a+Number(v||0),0);
  const recepciones=movPlanta.filter(m=>m.tipo==="ENTRADA_GANDOLA").reduce((a,m)=>a+Number(m.kg||0),0);
  const flota=UNIDADES_DISTRIBUCION.filter(u=>!u.granel).map(u=>({u,d:disponibilidadUnidad(u)}));
  const listas=flota.filter(x=>x.d.disponible);
  const trabadas=flota.filter(x=>!x.d.disponible);
  const cobertura=kgSolicitado?Math.min(100,(dispKg/kgSolicitado)*100):100;

  return <section className="dx-card dx-fuentes">
    <div className="dx-card-head">
      <div><h2>Insumos para planificar</h2><p>Distribución se alimenta de Comercialización, del control de planta y de Flota. Estas tres cifras condicionan lo que se puede planificar hoy.</p></div>
    </div>
    <div className="dx-fuentes-grid">
      <button className="dx-fuente com" onClick={()=>setVista("pedidos")}>
        <span>DESDE COMERCIALIZACIÓN</span>
        <b>{num(canceladas.length)}</b>
        <em>solicitudes canceladas por el usuario</em>
        <small><KgL kg={kgSolicitado} /> por despachar</small>
      </button>
      <button className="dx-fuente ope" onClick={()=>setVista("planta")}>
        <span>DESDE EL CONTROL DE PLANTA</span>
        <b><KgL kg={dispKg} /></b>
        <em>gas disponible real</em>
        <small><KgL kg={fisKg} /> físicos · <KgL kg={recepciones} /> por gandola</small>
      </button>
      <button className="dx-fuente flo" onClick={()=>setVista("flota")}>
        <span>DESDE FLOTA</span>
        <b>{listas.length} / {flota.length}</b>
        <em>vehículos con conductor y ayudante</em>
        <small>{trabadas.length?`${trabadas.length} no disponible(s): ${trabadas.map(x=>x.u.placa).join(", ")}`:"toda la flota operativa"}</small>
      </button>
    </div>
    <div className={`dx-cobertura ${cobertura>=100?"ok":cobertura>=70?"medio":"bajo"}`}>
      <div><span>Cobertura del disponible sobre lo solicitado</span><b>{cobertura.toFixed(0)}%</b></div>
      <div className="dx-cob-barra"><i style={{width:`${Math.min(100,cobertura)}%`}}/></div>
      <small>{cobertura>=100
        ? "El gas disponible alcanza para atender todas las solicitudes canceladas."
        : `El disponible cubre ${cobertura.toFixed(0)}% de lo solicitado. Faltan ${kgYL(Math.max(0,kgSolicitado-dispKg))} para atender a todos.`}</small>
    </div>
    {trabadas.length>0&&<div className="dx-flota-alerta">
      <AlertTriangle size={15}/>
      <div><b>{trabadas.length} unidad(es) fuera de servicio</b>
        <span>{trabadas.map(x=>`${x.u.placa}: ${x.d.motivos.join(" · ")}`).join(" | ")}</span></div>
    </div>}
  </section>;
}

function Pedidos({pedidos,rutas,aviso,onPlanCustom,onVerUsuario}){
  const [q,setQ]=useState("");
  const [estadoAD,setEstadoAD]=useState("TODOS");
  const [pago,setPago]=useState("TODOS");
  const [comuna,setComuna]=useState("TODAS");
  const [comunidad,setComunidad]=useState("TODAS");
  const [kg,setKg]=useState("TODOS");
  const [estadoLog,setEstadoLog]=useState("TODOS");
  const [placa,setPlaca]=useState("TODAS");
  const [operador,setOperador]=useState("TODOS");
  const [segmento,setSegmento]=useState("TODOS");
  const [municipio,setMunicipio]=useState("TODOS");
  const [parroquia,setParroquia]=useState("TODAS");
  const [antiguedad,setAntiguedad]=useState("TODAS");
  const [prioridad,setPrioridad]=useState("TODAS");
  const [tipoPlan,setTipoPlan]=useState("TODOS");
  const [periodo,setPeriodo]=useState("HOY");
  const [pagina,setPagina]=useState(1);
  const [seleccion,setSeleccion]=useState(()=>new Set());
  const pageSize=60;
  const comunas=useMemo(()=>[...new Set(pedidos.map(p=>p.comuna).filter(Boolean))].sort(),[pedidos]);
  const comunidades=useMemo(()=>[...new Set(pedidos.filter(p=>comuna==="TODAS"||p.comuna===comuna).map(p=>p.comunidad).filter(Boolean))].sort(),[pedidos,comuna]);
  const parroquias=useMemo(()=>[...new Set(pedidos.map(p=>p.parroquia).filter(Boolean))].sort(),[pedidos]);
  const filtrados=useMemo(()=>{
    const qq=q.trim().toLowerCase();
    return pedidos.filter(p=>{
      const route=rutas.find(r=>r.id===p.rutaId);
      const opid=p.operadorId||route?.operadorId||"";
      const unidad=p.unidad||route?.unidad||"";
      const hasAD=Boolean(p.ad&&String(p.ad)!=="0");
      const par=String(p.parroquia||route?.parroquia||"").toUpperCase();
      const mun=/CABUDARE|JOSÉ GREGORIO BASTIDAS|JOSE GREGORIO BASTIDAS/.test(par)?"PALAVECINO":"IRIBARREN";
      const age=Math.max(0,Number(p.diasEspera??route?.dias??0));
      if(qq && ![p.pedidoId,p.nombre,p.cedula,p.comuna,p.comunidad,p.ad].filter(Boolean).join(" ").toLowerCase().includes(qq)) return false;
      if(estadoAD==="EN_AD"&&!hasAD) return false;
      if(estadoAD==="SIN_AD"&&hasAD) return false;
      if(pago==="PAGADO"&&!p.pagado) return false;
      if(pago==="PENDIENTE"&&p.pagado) return false;
      if(comuna!=="TODAS"&&p.comuna!==comuna) return false;
      if(comunidad!=="TODAS"&&p.comunidad!==comunidad) return false;
      if(kg!=="TODOS"&&String(p.kg)!==kg) return false;
      if(estadoLog!=="TODOS"&&(p.estadoRuta||route?.estadoRuta)!==estadoLog) return false;
      if(placa!=="TODAS"&&String(unidad)!==placa) return false;
      if(operador!=="TODOS"&&String(opid)!==operador) return false;
      if(segmento!=="TODOS"&&p.segmento!==segmento) return false;
      if(municipio!=="TODOS"&&mun!==municipio) return false;
      if(parroquia!=="TODAS"&&par!==String(parroquia).toUpperCase()) return false;
      if(antiguedad==="0_7"&&!(age<=7)) return false;
      if(antiguedad==="8_15"&&!(age>=8&&age<=15)) return false;
      if(antiguedad==="16_30"&&!(age>=16&&age<=30)) return false;
      if(antiguedad==="31_MAS"&&!(age>=31)) return false;
      const pri=age>=31?"ALTA":age>=16?"MEDIA":"NORMAL";
      if(prioridad!=="TODAS"&&pri!==prioridad) return false;
      const tp=route?.tipoPlanificacion==="PERSONALIZADA"?"PERSONALIZADA":"COMUNAL";
      if(tipoPlan!=="TODOS"&&tp!==tipoPlan) return false;
      if(periodo==="HOY" && p.fechaPedido && p.fechaPedido!=="14/08/2026") return false;
      return true;
    }).sort((a,b)=>(`${b.fechaPedido||""} ${b.horaPedido||""}`).localeCompare(`${a.fechaPedido||""} ${a.horaPedido||""}`));
  },[pedidos,rutas,q,estadoAD,pago,comuna,comunidad,kg,estadoLog,placa,operador,segmento,municipio,parroquia,antiguedad,prioridad,tipoPlan,periodo]);
  useEffect(()=>setPagina(1),[q,estadoAD,pago,comuna,comunidad,kg,estadoLog,placa,operador,segmento,municipio,parroquia,antiguedad,prioridad,tipoPlan,periodo]);
  useEffect(()=>{if(comunidad!=="TODAS"&&!comunidades.includes(comunidad))setComunidad("TODAS")},[comuna,comunidades,comunidad]);
  const pages=Math.max(1,Math.ceil(filtrados.length/pageSize));
  const visible=filtrados.slice((pagina-1)*pageSize,pagina*pageSize);
  const pagados=filtrados.filter(p=>p.pagado).length;
  const enAD=filtrados.filter(p=>p.ad&&String(p.ad)!=="0").length;
  const kgTotal=filtrados.reduce((a,p)=>a+Number(p.totalKg??((p.kg||0)*(p.cantidad||1))),0);
  const seleccionados=pedidos.filter(p=>seleccion.has(p.id)&&!p.ad);
  const seleccionadosSinPago=seleccionados.filter(p=>!p.pagado).length;
  const toggle=(p)=>{if(p.ad)return;setSeleccion(prev=>{const n=new Set(prev);n.has(p.id)?n.delete(p.id):n.add(p.id);return n})};
  const seleccionarPagados=()=>setSeleccion(prev=>{const n=new Set(prev);filtrados.filter(p=>p.pagado&&!p.ad).forEach(p=>n.add(p.id));return n});
  const seleccionarSinAD=()=>setSeleccion(prev=>{const n=new Set(prev);filtrados.filter(p=>!p.ad).forEach(p=>n.add(p.id));return n});
  function limpiar(){setQ("");setEstadoAD("TODOS");setPago("TODOS");setComuna("TODAS");setComunidad("TODAS");setKg("TODOS");setEstadoLog("TODOS");setPlaca("TODAS");setOperador("TODOS");setSegmento("TODOS");setMunicipio("TODOS");setParroquia("TODAS");setAntiguedad("TODAS");setPrioridad("TODAS");setTipoPlan("TODOS");setPeriodo("HOY")}
  function exportar(){
    const rows=filtrados.map(p=>{const r=rutas.find(x=>x.id===p.rutaId);const op=operadorDistribucion(p.operadorId||r?.operadorId);const age=Math.max(0,Number(p.diasEspera??r?.dias??0));const par=p.parroquia||r?.parroquia||"";const mun=/CABUDARE|JOSÉ GREGORIO BASTIDAS|JOSE GREGORIO BASTIDAS/i.test(par)?"PALAVECINO":"IRIBARREN";return [p.pedidoId,p.fechaPedido,p.horaPedido,p.nombre,p.cedula,p.segmento,mun,par,p.comuna,p.comunidad,p.estadoPago,age,age>=31?"ALTA":age>=16?"MEDIA":"NORMAL",p.cantidad||1,p.kg||0,p.totalKg??((p.kg||0)*(p.cantidad||1)),Number(p.litros||((p.kg||0)*(p.cantidad||1)/.54)).toFixed(2),p.ad||"",p.ad?"EN AD":"SIN AD",p.unidad||r?.unidad||"",op.nombre!=="Por asignar"?`${op.nombre} · ${op.cedula}`:""]});
    descargar("pedidos-distribucion-14082026.csv",csv([["PEDIDOS DE DISTRIBUCIÓN","14-08-2026"],["Pedido","Fecha","Hora","Solicitante","Cédula/RIF","Segmento","Municipio","Parroquia","Comuna","Comunidad","Pago","Días esperando","Prioridad","Cantidad","Kg por unidad","Kg total","Litros reales","AD","Estado AD","Placa","Operador"],...rows]));aviso("Listado de pedidos exportado");
  }

  return <div className="dx-content">
    <div className="dx-livebar"><div><Radio size={15}/><b>Pedidos en vivo</b><span>Cada fila representa una solicitud individual que entra al flujo central del prototipo en tiempo real.</span></div><div className="dx-live-actions"><button className="dx-secondary" onClick={()=>aviso("Bandeja sincronizada")}><RefreshCw size={14}/>Actualizar</button><button className="dx-primary" disabled={!seleccionados.length} onClick={()=>onPlanCustom(seleccionados)}><ClipboardPlus size={14}/>Planificar AD personalizada {seleccionados.length?`(${seleccionados.length})`:""}</button></div></div>
    <div className="dx-kpis orders"><Kpi icon={ClipboardList} label="Pedidos visibles" value={num(filtrados.length)} foot={`${num(pagados)} con pago verificado`}/><Kpi icon={FileText} label="Dentro de AD" value={num(enAD)} foot={`${num(filtrados.length-enAD)} todavía sin AD`}/><Kpi icon={Fuel} label="GLP solicitado" value={<KgL kg={kgTotal} />} foot="facturado por kilo, medido por litro"/><Kpi icon={Users} label="Selección actual" value={num(seleccionados.length)} foot={seleccionadosSinPago?`${seleccionadosSinPago} sin pago requieren autorización`:`Lista para AD personalizada`}/></div>
    <Card title="Bandeja individual de pedidos" subtitle="Filtra, revisa y selecciona cualquier pedido SIN AD. Puedes crear una jornada comunal o una AD completamente personalizada." action={<button className="dx-secondary" onClick={exportar}><Download size={14}/>CSV</button>}>
      <div className="dx-orders-help"><div><b>AD normal</b><span>Usualmente se seleccionan pedidos pagados de una misma comunidad.</span></div><div><b>AD personalizada</b><span>Puede mezclar comunidades o casos individuales. Los no pagados solo se permiten con autorización y motivo.</span></div></div>
      <div className="dx-orders-filters">
        <div className="dx-search wide"><Search size={15}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar pedido, persona, cédula, comuna o AD"/></div>
        <FilterSelect label="AD" value={estadoAD} set={setEstadoAD} options={[["TODOS","Todos"],["SIN_AD","Sin AD"],["EN_AD","En AD"]]}/><FilterSelect label="Pago" value={pago} set={setPago} options={[["TODOS","Todos"],["PAGADO","Pagado"],["PENDIENTE","Pendiente"]]}/><FilterSelect label="Segmento" value={segmento} set={setSegmento} options={[["TODOS","Todos"],["RESIDENCIAL","Residencial"],["COMERCIAL","Comercial"],["INSTITUCIONAL","Institucional"]]}/><FilterSelect label="Comuna" value={comuna} set={setComuna} options={[["TODAS","Todas"],...comunas.map(x=>[x,x])]}/><FilterSelect label="Comunidad" value={comunidad} set={setComunidad} options={[["TODAS","Todas"],...comunidades.map(x=>[x,x])]}/><FilterSelect label="Bombona" value={kg} set={setKg} options={[["TODOS","Todas"],["10","10 kg"],["18","18 kg"],["27","27 kg"],["43","43 kg"]]}/><FilterSelect label="Estado logístico" value={estadoLog} set={setEstadoLog} options={[["TODOS","Todos"],["SIN_PLANIFICAR","Sin planificar"],["ASIGNADA","Asignada"],["PREPARANDO","Preparando carga"],["LISTA_SALIDA","Lista para salida"],["EN_RUTA","En ruta"],["PARCIAL","Entrega parcial"],["ENTREGADA","Entregada"],["CERRADA","Cerrada"],["REPROGRAMADA","Reprogramada"],["INCIDENCIA","Incidencia"]]}/><FilterSelect label="Vehículo" value={placa} set={setPlaca} options={[["TODAS","Todas las placas"],...UNIDADES_DISTRIBUCION.filter(u=>!u.granel).map(u=>[u.placa,u.placa])]}/><FilterSelect label="Operador" value={operador} set={setOperador} options={[["TODOS","Todos"],...OPERADORES_DISTRIBUCION.filter(o=>o.activo).map(o=>[o.id,`${o.nombre} · ${o.cedula}`])]}/><FilterSelect label="Municipio" value={municipio} set={setMunicipio} options={[["TODOS","Todos"],["IRIBARREN","Iribarren"],["PALAVECINO","Palavecino"]]}/><FilterSelect label="Parroquia" value={parroquia} set={setParroquia} options={[["TODAS","Todas"],...parroquias.map(x=>[x,x])]}/><FilterSelect label="Antigüedad" value={antiguedad} set={setAntiguedad} options={[["TODAS","Todas"],["0_7","0–7 días"],["8_15","8–15 días"],["16_30","16–30 días"],["31_MAS","+30 días"]]}/><FilterSelect label="Prioridad" value={prioridad} set={setPrioridad} options={[["TODAS","Todas"],["NORMAL","Normal"],["MEDIA","Media"],["ALTA","Alta"]]}/><FilterSelect label="Tipo de AD" value={tipoPlan} set={setTipoPlan} options={[["TODOS","Todos"],["COMUNAL","Jornada comunal"],["PERSONALIZADA","Personalizada"]]}/><FilterSelect label="Período" value={periodo} set={setPeriodo} options={[["HOY","Hoy"],["SEMANA","Esta semana"],["MES","Este mes"]]}/><button className="dx-clear" onClick={limpiar}><X size={13}/>Limpiar filtros</button>
      </div>
      <div className="dx-selectionbar"><div><b>{seleccionados.length} seleccionados</b><span>{seleccionados.filter(p=>p.pagado).length} pagados · {seleccionadosSinPago} sin pago</span></div><div><button className="dx-secondary" onClick={seleccionarPagados}>Seleccionar pagados filtrados</button><button className="dx-secondary" onClick={seleccionarSinAD}>Seleccionar todos Sin AD</button><button className="dx-secondary" onClick={()=>setSeleccion(new Set())}>Limpiar selección</button><button className="dx-primary" disabled={!seleccionados.length} onClick={()=>onPlanCustom(seleccionados)}><ClipboardPlus size={14}/>Planificar AD</button></div></div>
      <div className="dx-table-wrap orders-table"><table className="dx-table"><thead><tr><th></th><th>Pedido</th><th>Solicitante</th><th>Comuna / comunidad</th><th>Pago</th><th>Edad / prioridad</th><th>Solicitud</th><th>GLP</th><th>AD</th><th>Logística</th><th>Acción</th></tr></thead><tbody>{visible.map(p=>{const r=rutas.find(x=>x.id===p.rutaId);const op=operadorDistribucion(p.operadorId||r?.operadorId);const unidad=unidadDistribucion(p.unidad||r?.unidad);return <tr key={p.id} className={!p.pagado?"muted":""}><td><input type="checkbox" disabled={Boolean(p.ad)} checked={seleccion.has(p.id)} onChange={()=>toggle(p)}/></td><td><b>{p.pedidoId}</b><span>{p.fechaPedido} · {p.horaPedido}</span></td><td><b>{p.nombre}</b><span>{p.cedula} · {p.segmento}</span></td><td><b>{p.comunidad}</b><span>{p.comuna}</span></td><td><Tag tone={p.pagado?"green":"amber"}>{p.pagado?"Verificado":"Sin pago"}</Tag></td><td>{(()=>{const age=Math.max(0,Number(p.diasEspera??r?.dias??0));return <><Tag tone={age>=31?"red":age>=16?"amber":"slate"}>{age} días</Tag><span>{age>=31?"Prioridad alta":age>=16?"Prioridad media":"Normal"}</span></>})()}</td><td><b>{p.cantidad||1} × {p.kg} kg</b></td><td><b><KgL kg={p.totalKg??((p.kg||0)*(p.cantidad||1))} /></b></td><td>{p.ad?<><b>{p.ad}</b><Tag tone="green">En AD</Tag></>:<Tag tone="amber">Sin AD</Tag>}</td><td>{p.ad?<><b>{unidad.placa||p.unidad}</b><span>{op.nombre} · {op.cedula}</span></>:<span>Disponible para planificación</span>}</td><td><div className="dx-row-actions"><button className="dx-user-link" onClick={()=>onVerUsuario(p)}>Ver usuario</button>{!p.ad&&<button className="dx-row-plan" onClick={()=>onPlanCustom([p])}><ClipboardPlus size={12}/>Planificar</button>}</div></td></tr>})}</tbody></table></div>
      <div className="dx-pagination"><span>Mostrando {visible.length} de {num(filtrados.length)} pedidos · página {pagina} de {pages}</span><div><button className="dx-secondary" disabled={pagina<=1} onClick={()=>setPagina(p=>Math.max(1,p-1))}>Anterior</button><button className="dx-secondary" disabled={pagina>=pages} onClick={()=>setPagina(p=>Math.min(pages,p+1))}>Siguiente</button></div></div>
    </Card>
  </div>
}


function FilterSelect({label,value,set,options}){return <label className="dx-filter-select"><span>{label}</span><select value={value} onChange={e=>set(e.target.value)}>{options.map(([v,l])=><option key={`${label}-${v}`} value={v}>{l}</option>)}</select></label>}

/* La vista Planificar se retiro el 01/09/2026: es el segmento «Por planificar» de
   AD del dia. Eran la misma lista de comunidades con el mismo boton, en dos
   pantallas distintas. */


/* ── AD DEL DÍA ────────────────────────────────────────────────────────────────
   Una sola pantalla para las AD. Antes eran cuatro —Planificar, AD del día,
   Replanificar y Agenda— que mostraban la misma lista de 27 rutas con otro filtro
   y otro layout. Aquí son segmentos, y el AD conserva su peso: sigue siendo la
   unidad operativa, la ruta, el camión y el conductor.

   Lo que cambió es que ahora se abre a su gente. Antes del AD la única incidencia
   es el pago; lo que ocurra con las bombonas se sabe en el punto y se registra al
   cerrar. */
function ADs({rutas,solicitudes=[],buscar,setBuscar,setDetalle,abrirPlanificador,actualizar,onVerUsuario,aviso}){
  const [abierta,setAbierta]=useState(null);
  const [seg,setSeg]=useState("ACTIVAS");
  const [reasignar,setReasignar]=useState(null);
  const [doc,setDoc]=useState(null);

  const porPlanificar=rutas.filter(r=>r.estadoRuta==="SIN_PLANIFICAR");
  const creadas=rutas.filter(r=>r.estadoRuta!=="SIN_PLANIFICAR");
  const CERRADAS=["ENTREGADA","CERRADA","PARCIAL"];
  const grupos={
    POR_PLANIFICAR:porPlanificar,
    ACTIVAS:creadas.filter(r=>!CERRADAS.includes(r.estadoRuta)),
    EN_RUTA:creadas.filter(r=>r.estadoRuta==="EN_RUTA"),
    INCIDENCIA:creadas.filter(r=>r.estadoRuta==="INCIDENCIA"),
    CERRADAS:creadas.filter(r=>CERRADAS.includes(r.estadoRuta)),
    TODAS:rutas,
  };
  const lista=grupos[seg]||creadas;

  const cuadres=useMemo(()=>Object.fromEntries(rutas.map(r=>[r.id,cuadreAD(r,solicitudes)])),[rutas,solicitudes]);
  const tot=creadas.reduce((a,r)=>{const c=cuadres[r.id];return{
    plan:a.plan+c.planificado,per:a.per+c.personas.length,conv:a.conv+c.convocadas.length,
    sinPago:a.sinPago+c.sinPago.length,rech:a.rech+c.rechazados.length};},
    {plan:0,per:0,conv:0,sinPago:0,rech:0});
  const fuera=tot.sinPago+tot.rech;

  function exportarADs(){
    const rows=[["REPORTE CONSOLIDADO DE AD","14-08-2026"],[],
      ["AD","Estado","Comuna","Comunidad","Ruta","Placa","Operador","Personas","Convocadas","Sin pago","Bombonas en lista","Kg","Litros"]];
    creadas.forEach(r=>{const c=cuadres[r.id];const u=unidadDistribucion(r.unidad)||{};
      rows.push([r.ad,estados[r.estadoRuta]?.label||r.estadoRuta,r.comuna,r.comunidad,r.ruta||"",
        u.placa||r.unidad||"",r.conductor||"",c.personas.length,c.convocadas.length,
        c.sinPago.length+c.rechazados.length,c.planificado,kgFila(r),kgALitros(kgFila(r)).toFixed(2)]);});
    descargar("reporte-consolidado-ad-14-08-2026.csv",csv(rows));
    aviso?.("Reporte de AD exportado");
  }

  const SEGMENTOS=[["POR_PLANIFICAR","Por planificar"],["ACTIVAS","Activas"],["EN_RUTA","En ruta"],
    ["INCIDENCIA","Con incidencia"],["CERRADAS","Cerradas"],["TODAS","Todas"]];

  return <div className="dx-content">
    <PersonasStyles/>
    <div className="dx-toolbar"><div className="dx-search"><Search size={15}/><input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar AD, comuna, placa, operador o ruta"/></div></div>

    {fuera>0&&<div className="dx-flota-alerta"><AlertTriangle size={16}/>
      <div><b>{num(fuera)} personas de la lista no entran hoy a la jornada.</b>
        <span>La lista se armó con {num(tot.plan)} bombonas para {num(tot.per)} personas. De ellas, {num(tot.sinPago)} no han
          reportado pago y {num(tot.rech)} lo tienen rechazado por la regla: solo {num(tot.conv)} están convocadas.
          Lo que ocurra con sus bombonas —quién la llevó al punto, cuáles volvieron llenas— se sabe en el sitio.</span></div></div>}

    <Card title="AD del día"
      subtitle="Cada AD abre a su listado de personas. Antes de salir, lo único que decide quién entra es el pago."
      action={<div className="dx-report-actions">
        <button className="dx-secondary" onClick={exportarADs}><Download size={14}/>CSV</button>
        <button className="dx-primary" onClick={()=>setDoc({tipo:"TODAS",rutas:creadas})}><FileText size={14}/>Imprimir todas</button>
      </div>}>
      <div className="dx-segmentos">
        {SEGMENTOS.map(([k,l])=><button key={k} className={seg===k?"on":""} onClick={()=>{setSeg(k);setAbierta(null)}}>{l} <em>{num((grupos[k]||[]).length)}</em></button>)}
      </div>

      {seg==="POR_PLANIFICAR"
        ? <div className="dx-community-list">
            {lista.map(r=>{const us=usuariosRuta(r),pag=us.filter(x=>x.pagado).length,sin=us.length-pag;
              return <div className="dx-community" key={r.id}>
                <div className="dx-community-main"><Tag tone="amber">Pendiente</Tag>
                  <div><b>{r.comunidad}</b><span>{r.comuna} · {r.parroquia||r.bloque}</span></div></div>
                <div className="dx-community-counts">
                  <div><span>En la lista</span><b>{us.length}</b></div>
                  <div><span>Pagados</span><b>{pag}</b></div>
                  <div><span>Sin pago</span><b>{sin}</b></div>
                  <div><span>Bombonas</span><b>{cilindrosFila(r)}</b></div></div>
                <button className="dx-primary" onClick={()=>abrirPlanificador(r)}><ClipboardPlus size={14}/>Planificar AD</button>
              </div>;})}
            {!lista.length&&<div className="dx-vacio-seg">No queda ninguna comunidad por planificar.</div>}
          </div>
        : <div className="dx-table-wrap"><table className="dx-table"><thead><tr>
            <th>AD</th><th className="dp-ad-comuna">Comuna / comunidad</th><th className="dp-ad-carga">Bombonas y personas</th>
            <th className="dp-ad-ruta">Ruta y salida</th><th className="dp-ad-veh">Vehículo / operador</th><th>Estado</th><th></th>
          </tr></thead><tbody>
            {lista.map(r=>{const u=unidadDistribucion(r.unidad)||{};const c=cuadres[r.id];const ab=abierta===r.id;
              return <React.Fragment key={r.id}>
                <tr className={ab?"dx-fila-on":""}>
                  <td><b>{r.ad}</b>{r.tipoPlanificacion==="PERSONALIZADA"&&<Tag tone="blue">Personalizada</Tag>}</td>
                  <td className="dp-ad-comuna"><b>{r.comunidad}</b><span>{r.comuna}</span></td>
                  <td className="dp-ad-carga"><b>{num(c.planificado)} bombonas en lista</b><span><KgL kg={kgFila(r)} /></span><CuadreChips c={c}/></td>
                  <td className="dp-ad-ruta"><b>{r.ruta||"—"}</b><span>{r.horaSalida?`Salió ${r.horaSalida}`:"Sin salida registrada"}</span></td>
                  <td className="dp-ad-veh"><b>Placa {u.placa||r.unidad}</b><span>{r.conductor||"Por asignar"} · {r.conductorCedula||"—"}</span></td>
                  <td><Tag tone={estados[r.estadoRuta]?.tone}>{estados[r.estadoRuta]?.label}</Tag></td>
                  <td className="dx-ad-acc">
                    <button className="dx-secondary" onClick={()=>setAbierta(ab?null:r.id)}><Users size={13}/>{ab?"Ocultar":"Personas"}</button>
                    {!CERRADAS.includes(r.estadoRuta)&&<button className="dx-secondary" onClick={()=>setReasignar(r)} title="Cambiar vehículo, operador o ruta"><RefreshCw size={13}/></button>}
                    <button className="dx-secondary" onClick={()=>setDoc({tipo:"AD",rutas:[r]})} title="Ver e imprimir"><FileText size={13}/></button>
                    <button className="dx-iconbtn" onClick={()=>setDetalle(r)}><ChevronRight size={15}/></button>
                  </td>
                </tr>
                {ab&&<tr className="dx-fila-personas"><td colSpan={7}>
                  <ListaPersonasAD ruta={r} solicitudes={solicitudes} onVerUsuario={onVerUsuario}/>
                </td></tr>}
              </React.Fragment>;})}
          </tbody>
          <tfoot><tr>
            <td colSpan={2}>TOTALES · {num(creadas.length)} AD creadas</td>
            <td><b>{num(tot.plan)} bombonas en lista</b><span>{num(tot.per)} personas · {num(tot.conv)} convocadas</span></td>
            <td colSpan={4}></td>
          </tr></tfoot>
          </table>
          {!lista.length&&<div className="dx-vacio-seg">Ninguna AD en este segmento.</div>}
        </div>}
    </Card>

    {reasignar&&<Reasignar r={reasignar} onClose={()=>setReasignar(null)}
      onSave={d=>{actualizar(reasignar.id,d);setReasignar(null);aviso?.(`AD ${reasignar.ad} reasignada`)}}/>}
    {doc&&<ReporteADViewer doc={doc} onClose={()=>setDoc(null)}/>}
  </div>;
}

function Comunas({rutas,onVerUsuario}){
  const comunas=useMemo(()=>[...new Set(rutas.filter(r=>!["COMERCIO","INSTITUCIÓN"].includes(r.bloque)&&r.tipoPlanificacion!=="PERSONALIZADA").map(r=>r.comuna))].sort(),[rutas]);
  const [comuna,setComuna]=useState(comunas[0]||"");
  const communities=useMemo(()=>rutas.filter(r=>r.comuna===comuna),[rutas,comuna]);
  const [community,setCommunity]=useState(communities[0]?.id||"");
  useEffect(()=>{if(!communities.some(r=>r.id===community))setCommunity(communities[0]?.id||"")},[communities,community]);
  const ruta=communities.find(r=>r.id===community)||communities[0];
  const rows=ruta?usuariosRuta(ruta):[];
  const [filtro,setFiltro]=useState("TODOS");
  const visible=rows.filter(x=>filtro==="TODOS"||(filtro==="PAGADOS"?x.pagado:!x.pagado));
  return <div className="dx-content">
    <Card title="Comunas y usuarios" subtitle="La entrega física es a la comuna; el control interno conserva cada persona y cada pago.">
      <div className="dx-filters"><label><span>Comuna</span><select value={comuna} onChange={e=>setComuna(e.target.value)}>{comunas.map(c=><option key={c}>{c}</option>)}</select></label><label><span>Comunidad</span><select value={community} onChange={e=>setCommunity(e.target.value)}>{communities.map(r=><option key={r.id} value={r.id}>{r.comunidad}</option>)}</select></label><label><span>Estado</span><select value={filtro} onChange={e=>setFiltro(e.target.value)}><option value="TODOS">Todos</option><option value="PAGADOS">Pagados</option><option value="SIN_PAGO">Sin pago</option></select></label></div>
      {ruta&&<><div className="dx-summary-strip"><div><span>Registrados</span><b>{rows.length}</b></div><div><span>Pagados</span><b>{rows.filter(x=>x.pagado).length}</b></div><div><span>Sin pago</span><b>{rows.filter(x=>!x.pagado).length}</b></div><div><span>AD</span><b>{ruta.ad&&String(ruta.ad)!=="0"?ruta.ad:"Sin crear"}</b></div></div>
      <UserTable rows={visible} compact={false} onVerUsuario={onVerUsuario}/></>}
    </Card>
  </div>
}

/* Reportes se retiro el 01/09/2026 y se repartio.
   Mezclaba datos vivos con un reporte congelado del dia anterior sin avisarlo. El
   cumplimiento del despacho ya vivia en Resumen; la impresion y el CSV de AD se
   fueron a AD del dia, que es donde estan las AD. */


function pedidosReporteAD(r){
  return pedidosDeRutas([r]).filter(p=>p.ad&&String(p.ad)===String(r.ad));
}

function ReporteADViewer({doc,onClose}){
  const rutas=doc.rutas||[];
  const todas=doc.tipo==="TODAS";
  const totalCil=rutas.reduce((a,r)=>a+cilindrosFila(r),0),totalKg=rutas.reduce((a,r)=>a+kgFila(r),0);
  return <div className="dx-print-root">
    <div className="dx-print-shell">
      <div><b>{todas?"Libro de AD · Distribución":`AD ${rutas[0]?.ad||""}`}</b><span>Vista previa del mismo documento que se imprimirá</span></div>
      <div><button className="dx-secondary" onClick={onClose}>Cerrar</button><button className="dx-primary" onClick={()=>window.print()}><FileText size={14}/>Imprimir</button></div>
    </div>
    <div className="dx-print-scroll">
      <div className="dx-print-paper">
        {todas&&<section className="dx-print-cover">
          <div className="dx-print-brand"><img src={LOGO_GASLARA}/><div><small>C.D.T. GRAL. JACINTO LARA</small><h1>LIBRO DE AD · DISTRIBUCIÓN</h1><p>Jornada operativa 14-08-2026</p></div></div>
          <div className="dx-print-cover-grid"><div><span>AD incluidas</span><b>{rutas.length}</b></div><div><span>Cilindros</span><b>{num(totalCil)}</b></div><div><span>GLP</span><b><KgL kg={totalKg} /></b></div></div>
          <p className="dx-print-cover-note">Documento consolidado generado desde la misma planificación utilizada por Distribución y Operaciones. Cada AD se presenta en una sección independiente con su respaldo individual.</p>
        </section>}
        {rutas.map((r,i)=><ReporteAD key={`${r.id}-${i}`} ruta={r} pageBreak={todas&&i>0}/>) }
      </div>
    </div>
  </div>
}

function ReporteAD({ruta,pageBreak}){
  const pedidos=pedidosReporteAD(ruta),u=unidadDistribucion(ruta.unidad);
  const pagados=pedidos.filter(p=>p.pagado),sinPago=pedidos.filter(p=>!p.pagado);
  const totalCant=pedidos.reduce((a,p)=>a+Number(p.cantidad||1),0),totalKg=pedidos.reduce((a,p)=>a+Number(p.totalKg??((p.kg||0)*(p.cantidad||1))),0);
  return <section className={`dx-print-ad ${pageBreak?"page-break":""}`}>
    <div className="dx-print-brand"><img src={LOGO_GASLARA}/><div><small>C.D.T. GRAL. JACINTO LARA · DEPARTAMENTO DE DISTRIBUCIÓN</small><h1>REPORTE DE ASIGNACIÓN DE DESPACHO (AD)</h1><p>Fecha de planificación: {ruta.fechaPlanificacion||"14/08/2026"}</p></div><div className="dx-print-ad-box"><span>AD</span><b>{ruta.ad}</b><em>{estados[ruta.estadoRuta]?.label||ruta.estadoRuta}</em></div></div>

    <div className="dx-print-section-title">1. Identificación de la jornada</div>
    <div className="dx-print-info-grid">
      <InfoPrint label="Tipo de planificación" value={ruta.tipoPlanificacion==="PERSONALIZADA"?"AD personalizada":"Jornada comunal"}/>
      <InfoPrint label="Modalidad" value={ruta.tipoDespachoCustom||"NORMAL"}/>
      <InfoPrint label="Ruta" value={ruta.ruta||"—"}/>
      <InfoPrint label="Bloque / parroquia" value={ruta.parroquia||ruta.bloque||"—"}/>
      <InfoPrint label="Comuna" value={ruta.comuna||"—"}/>
      <InfoPrint label="Comunidad" value={ruta.comunidad||"—"}/>
      <InfoPrint label="Última atención" value={ruta.ufa||"—"}/>
      <InfoPrint label="Fecha agenda" value={ruta.faa||"—"}/>
    </div>

    <div className="dx-print-section-title">2. Asignación logística</div>
    <div className="dx-print-info-grid four">
      <InfoPrint label="Vehículo / placa" value={u.placa||ruta.placa||ruta.unidad||"—"}/>
      <InfoPrint label="Código interno" value={ruta.unidadCodigoInterno||u.codigoInterno||"—"}/>
      <InfoPrint label="Operador / conductor" value={ruta.conductor||"—"}/>
      <InfoPrint label="Cédula operador" value={ruta.conductorCedula||"—"}/>
      <InfoPrint label="Transportista" value={tipoFlota[u.tipo]||ruta.transportistaTipo||"—"}/>
      <InfoPrint label="EPSDC" value={ruta.epsdc||"No aplica"}/>
      <InfoPrint label="Hora salida" value={ruta.horaSalida||"Pendiente"}/>
      <InfoPrint label="Hora entrega" value={ruta.horaEntrega||"Pendiente"}/>
    </div>

    <div className="dx-print-section-title">3. Resumen de carga</div>
    <div className="dx-print-load-grid">
      {[10,18,27,43].map(k=><div key={k}><span>Bombona {k} kg</span><b>{ruta.cilindros[k]||0}</b></div>)}
      <div className="strong"><span>Total cilindros</span><b>{cilindrosFila(ruta)}</b></div>
      <div className="strong"><span>Total GLP</span><b><KgL kg={kgFila(ruta)} /></b></div>
      <div><span>Pedidos / beneficiarios</span><b>{pedidos.length}</b></div>
    </div>

    {ruta.tipoPlanificacion==="PERSONALIZADA"&&ruta.justificacionCustom&&<div className="dx-print-auth"><b>Autorización / justificación de AD personalizada</b><span>{ruta.justificacionCustom}</span></div>}

    <div className="dx-print-section-title">4. Detalle de pedidos incluidos en la AD</div>
    <div className="dx-print-table-wrap"><table className="dx-print-table"><thead><tr><th>#</th><th>Pedido</th><th>Solicitante</th><th>Cédula / RIF</th><th>Comunidad</th><th>Pago</th><th>Cant.</th><th>Cilindro</th><th>GLP</th></tr></thead><tbody>{pedidos.map((p,i)=>{const kg=Number(p.totalKg??((p.kg||0)*(p.cantidad||1)));return <tr key={p.id}><td>{i+1}</td><td>{p.pedidoId||p.id}</td><td>{p.nombre}</td><td>{p.cedula}</td><td>{p.comunidad||ruta.comunidad}</td><td>{p.pagado?"PAGO VERIFICADO":`AUTORIZADO · ${p.autorizacionSinPago?.tipo||ruta.tipoDespachoCustom||"EXCEPCIÓN"}`}</td><td>{p.cantidad||1}</td><td>{p.kg?`${p.kg} kg`:"—"}</td><td><KgL kg={kg} /></td></tr>})}</tbody><tfoot><tr><td colSpan="6">TOTALES</td><td>{totalCant}</td><td></td><td><KgL kg={totalKg} /></td></tr></tfoot></table></div>

    <div className="dx-print-summary-line"><span>Pagados: <b>{pagados.length}</b></span><span>Sin pago incluidos bajo autorización: <b>{sinPago.length}</b></span><span>Pedidos totales: <b>{pedidos.length}</b></span></div>

    <div className="dx-print-section-title">5. Control de ejecución y recepción</div>
    <div className="dx-print-observations"><b>Observaciones / incidencias</b><div>{ruta.incidencia||ruta.observacion||""}</div></div>
    <div className="dx-print-signatures"><div><span>Elaborado por Distribución</span><i></i><small>Nombre / firma</small></div><div><span>Operador / conductor</span><i></i><small>{ruta.conductor||"Nombre / firma"} · {ruta.conductorCedula||""}</small></div><div><span>Recibido por comuna / beneficiario</span><i></i><small>Nombre, cédula y firma</small></div></div>
    <div className="dx-print-footer"><span>GasLara · Sistema Integrado de Distribución</span><span>AD {ruta.ad} · Generado desde la planificación operativa</span></div>
  </section>
}

function InfoPrint({label,value}){return <div><span>{label}</span><b>{value}</b></div>}

function WizardADPersonalizada({pedidos,rutas,onClose,onSave}){
  const [paso,setPaso]=useState(1);
  const [incluidos,setIncluidos]=useState(()=>new Set(pedidos.map(p=>p.id)));
  const [ad,setAd]=useState(()=>String(siguienteAD(rutas)));
  const [route,setRoute]=useState("RUTA PERSONALIZADA");
  const [unidad,setUnidad]=useState(UNIDADES_DISTRIBUCION.find(u=>!u.granel)?.id||"");
  const unidadObj=unidadDistribucion(unidad);
  const opsCompatibles=useMemo(()=>operadoresParaUnidad(unidad),[unidad]);
  const [operadorId,setOperadorId]=useState(unidadObj.operadorDefault||opsCompatibles[0]?.id||"");
  const [tipo,setTipo]=useState("NORMAL");
  const [justificacion,setJustificacion]=useState("");
  useEffect(()=>{if(!opsCompatibles.some(o=>o.id===operadorId))setOperadorId(unidadDistribucion(unidad).operadorDefault||opsCompatibles[0]?.id||"")},[unidad,opsCompatibles,operadorId]);
  const operador=operadorDistribucion(operadorId);
  const selected=pedidos.filter(p=>incluidos.has(p.id));
  const sinPago=selected.filter(p=>!p.pagado);
  const counts={10:0,18:0,27:0,43:0};
  selected.forEach(p=>{const k=Number(p.kg||0),q=Number(p.cantidad||1);if(counts[k]!=null)counts[k]+=q});
  const totalKg=selected.reduce((a,p)=>a+Number(p.totalKg??((p.kg||0)*(p.cantidad||1))),0);
  const comunas=[...new Set(selected.map(p=>p.comuna).filter(Boolean))];
  const comunidades=[...new Set(selected.map(p=>p.comunidad).filter(Boolean))];
  const segmentos=[...new Set(selected.map(p=>p.segmento).filter(Boolean))];
  const paradas=Object.values(selected.reduce((acc,p)=>{const key=`${p.comuna}|${p.comunidad}`;if(!acc[key])acc[key]={comuna:p.comuna,comunidad:p.comunidad,pedidos:0,cilindros:0,kg:0};acc[key].pedidos++;acc[key].cilindros+=Number(p.cantidad||1);acc[key].kg+=Number(p.totalKg??((p.kg||0)*(p.cantidad||1)));return acc},{}));
  const requiereAutorizacion=sinPago.length>0;
  const autorizacionValida=!requiereAutorizacion||(tipo!=="NORMAL"&&justificacion.trim().length>=8);
  const toggle=id=>setIncluidos(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n});
  function crear(){
    if(!selected.length||!unidad||!operadorId||!autorizacionValida)return;
    const snapshot=selected.map(p=>({...p,incluidoAD:true,ad,estadoAD:"EN_AD",autorizacionSinPago:!p.pagado?{tipo,justificacion}:null}));
    const nueva={
      id:`CUSTOM-${ad}`,bloque:"PERSONALIZADA",zona:"PERSONALIZADA",ruta:route||"RUTA PERSONALIZADA",
      comuna:comunas.length===1?comunas[0]:`${comunas.length} COMUNAS`,comunidad:comunidades.length===1?comunidades[0]:`${comunidades.length} COMUNIDADES`,
      parroquia:paradas.length===1?(selected[0]?.parroquia||""):"MÚLTIPLES PARADAS",cilindros:counts,ad,
      unidad:unidadObj.placa,placa:unidadObj.placa,unidadCodigoInterno:unidadObj.codigoInterno,operadorId:operador.id,
      conductor:operador.nombre,conductorCedula:operador.cedula,transportistaTipo:unidadObj.tipo,epsdc:unidadObj.epsdc||null,
      estadoRuta:"ASIGNADA",horaSalida:null,horaEntrega:null,ufa:"",faa:"14/08/2026",dias:0,
      beneficiariosSnapshot:snapshot,fechaPlanificacion:"14/08/2026",tipoPlanificacion:"PERSONALIZADA",tipoDespachoCustom:tipo,
      justificacionCustom:justificacion,paradas,segmentos,pedidosOrigen:selected.map(p=>p.id),
    };
    onSave(nueva,selected);
  }
  return <div className="dx-modal-bg"><div className="dx-wizard custom">
    <header><div><small>AD personalizada</small><h2>Planificación manual desde pedidos</h2><p>{selected.length} pedidos seleccionados · {comunidades.length} comunidades · {comunas.length} comunas</p></div><button onClick={onClose}><X size={17}/></button></header>
    <div className="dx-wsteps"><StepTab n="1" label="Pedidos" on={paso===1} done={paso>1}/><i/><StepTab n="2" label="Logística y autorización" on={paso===2} done={paso>2}/><i/><StepTab n="3" label="Confirmar" on={paso===3}/></div>
    <main>
      {paso===1&&<><div className="dx-wintro"><div><b>1. Define exactamente qué pedidos entran</b><span>Esta AD no depende de una sola comuna. Puedes mezclar pedidos SIN AD según la necesidad operativa.</span></div><div className="dx-wcounts"><span>{selected.length} incluidos</span><span>{selected.filter(p=>p.pagado).length} pagados</span><span>{sinPago.length} sin pago</span></div></div>{sinPago.length>0&&<div className="dx-custom-warning"><AlertTriangle size={15}/><span>Hay {sinPago.length} pedidos sin pago. Pueden permanecer seleccionados, pero en el siguiente paso debes registrar el tipo de autorización y una justificación.</span></div>}<div className="dx-user-toolbar"><button className="dx-secondary" onClick={()=>setIncluidos(new Set(pedidos.filter(p=>p.pagado).map(p=>p.id)))}>Dejar solo pagados</button><button className="dx-secondary" onClick={()=>setIncluidos(new Set(pedidos.map(p=>p.id)))}>Restaurar selección</button></div><UserTable rows={pedidos} selected={incluidos} toggle={toggle} allowUnpaid/></>}
      {paso===2&&<><div className="dx-wintro"><div><b>2. Asigna la logística de la AD</b><span>Distribución elige ruta, vehículo y operador. Si hay pedidos no pagados, documenta por qué se autorizan.</span></div></div><div className="dx-formgrid"><label><span>Número AD</span><input value={ad} onChange={e=>setAd(e.target.value)}/></label><label><span>Ruta / descripción</span><input value={route} onChange={e=>setRoute(e.target.value)} placeholder="Ej. Ruta especial Palavecino"/></label><label><span>Vehículo / placa</span><select value={unidad} onChange={e=>setUnidad(e.target.value)}>{UNIDADES_DISTRIBUCION.filter(u=>!u.granel).map(u=><option key={u.id} value={u.id}>{u.placa} · {u.etiqueta}</option>)}</select></label><label><span>Operador / conductor</span><select value={operadorId} onChange={e=>setOperadorId(e.target.value)}>{opsCompatibles.map(o=><option key={o.id} value={o.id}>{o.nombre} · {o.cedula}</option>)}</select></label><label><span>Modalidad del AD</span><select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="NORMAL">Normal · requiere pago</option><option value="EXONERADO">Exonerado autorizado</option><option value="APOYO">Apoyo / programa especial</option><option value="INSTITUCIONAL">Institucional</option><option value="EXCEPCION">Excepción autorizada</option></select></label><label><span>Transportista</span><input readOnly value={tipoFlota[unidadObj.tipo]||unidadObj.tipo}/></label></div>{requiereAutorizacion&&<label className="dx-justification"><span>Justificación obligatoria para pedidos sin pago</span><textarea value={justificacion} onChange={e=>setJustificacion(e.target.value)} placeholder="Ej. Despacho exonerado autorizado mediante oficio..."/><small>{tipo==="NORMAL"?"Selecciona una modalidad autorizada distinta de Normal.":justificacion.trim().length<8?"Escribe una justificación de al menos 8 caracteres.":"Autorización documentada para esta demostración."}</small></label>}<div className="dx-driver-card"><div><UserRound size={17}/><span>Operador</span><b>{operador.nombre}</b><small>{operador.cedula}</small></div><div><CarFront size={17}/><span>Vehículo</span><b>{unidadObj.placa}</b><small>{unidadObj.etiqueta}</small></div></div><div className="dx-load"><h3>Carga de la AD personalizada</h3><div>{[10,18,27,43].map(k=><span key={k}>{k} kg<b>{counts[k]||0}</b></span>)}</div><strong>{selected.length} pedidos · <KgL kg={totalKg} /> · {paradas.length} paradas</strong></div></>}
      {paso===3&&<><div className="dx-wintro"><div><b>3. Revisa la AD antes de crearla</b><span>Los pedidos pasarán de Sin AD a En AD y desaparecerán de la cola disponible para otras planificaciones.</span></div></div><div className="dx-confirm"><div><span>AD</span><b>{ad}</b></div><div><span>Modalidad</span><b>{tipo}</b></div><div><span>Pedidos</span><b>{selected.length}</b><small>{sinPago.length} sin pago</small></div><div><span>Paradas</span><b>{paradas.length}</b></div><div><span>Comunas</span><b>{comunas.length}</b></div><div><span>Comunidades</span><b>{comunidades.length}</b></div><div><span>Placa</span><b>{unidadObj.placa}</b></div><div><span>Operador</span><b>{operador.nombre}</b><small>{operador.cedula}</small></div></div><div className="dx-preview"><h3>Paradas incluidas</h3>{paradas.map((p,i)=><div key={`${p.comuna}-${p.comunidad}`}><span>{i+1}. {p.comunidad} · {p.comuna}</span><b>{p.pedidos} pedidos · <KgL kg={p.kg} /></b></div>)}</div>{requiereAutorizacion&&<div className="dx-custom-warning ok"><CheckCircle2 size={15}/><span>{sinPago.length} pedidos sin pago serán incluidos bajo modalidad <b>{tipo}</b>. Justificación: {justificacion}</span></div>}</>}
    </main>
    <footer><button className="dx-secondary" onClick={()=>paso===1?onClose():setPaso(paso-1)}>{paso===1?"Cancelar":<><ChevronLeft size={14}/>Atrás</>}</button>{paso<3?<button className="dx-primary" disabled={!selected.length||(paso===2&&!autorizacionValida)} onClick={()=>setPaso(paso+1)}>Continuar <ChevronRight size={14}/></button>:<button className="dx-primary" disabled={!selected.length||!autorizacionValida||!unidad||!operadorId} onClick={crear}><Check size={14}/>Crear AD personalizada</button>}</footer>
  </div></div>
}


function WizardAD({ruta,rutas,onClose,onSave}){
  const base=useMemo(()=>usuariosRuta(ruta),[ruta]);
  const pagados=base.filter(x=>x.pagado);
  const [paso,setPaso]=useState(1);
  const [sel,setSel]=useState(()=>new Set(base.filter(x=>x.pagado&&(ruta.estadoRuta==="SIN_PLANIFICAR"||x.incluidoAD!==false)).map(x=>x.id)));
  const [route,setRoute]=useState(ruta.ruta||"");
  const [unidad,setUnidad]=useState(String(ruta.unidad||UNIDADES_DISTRIBUCION.find(u=>!u.granel)?.id||""));
  const unidadObj=unidadDistribucion(unidad);
  const opsCompatibles=useMemo(()=>operadoresParaUnidad(unidad),[unidad]);
  const [operadorId,setOperadorId]=useState(ruta.operadorId||unidadObj.operadorDefault||opsCompatibles[0]?.id||"");
  const [ad,setAd]=useState(()=>ruta.ad&&String(ruta.ad)!=="0"?String(ruta.ad):String(siguienteAD(rutas)));
  const [busca,setBusca]=useState("");
  useEffect(()=>{
    if(!opsCompatibles.some(o=>o.id===operadorId)) setOperadorId(unidadDistribucion(unidad).operadorDefault||opsCompatibles[0]?.id||"");
  },[unidad,opsCompatibles,operadorId]);
  const operador=operadorDistribucion(operadorId);
  const selected=base.filter(x=>sel.has(x.id)&&x.pagado);
  const counts={10:0,18:0,27:0,43:0}; selected.forEach(x=>{if(x.kg)counts[x.kg]=(counts[x.kg]||0)+Number(x.cantidad||1)});
  const kg=Object.entries(counts).reduce((a,[k,v])=>a+Number(k)*v,0);
  const filtered=base.filter(x=>!busca||[x.nombre,x.cedula,x.pedidoId].join(" ").toLowerCase().includes(busca.toLowerCase()));
  const toggle=id=>setSel(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n});
  const snapshot=base.map(x=>({...x,incluidoAD:sel.has(x.id)&&x.pagado,ad:sel.has(x.id)&&x.pagado?ad:null,estadoAD:sel.has(x.id)&&x.pagado?"EN_AD":"SIN_AD"}));
  function crear(){if(!selected.length||!operadorId||!unidad)return;onSave(ruta,{ad, ruta:route||ruta.ruta||"POR DEFINIR", unidad:unidadObj.placa, placa:unidadObj.placa, unidadCodigoInterno:unidadObj.codigoInterno, operadorId:operador.id, conductor:operador.nombre, conductorCedula:operador.cedula, transportistaTipo:unidadObj.tipo, epsdc:unidadObj.epsdc||null, estadoRuta:"ASIGNADA", cilindros:counts, beneficiariosSnapshot:snapshot, fechaPlanificacion:"14/08/2026"})}
  return <div className="dx-modal-bg"><div className="dx-wizard">
    <header><div><small>Planificación de AD</small><h2>{ruta.comunidad}</h2><p>{ruta.comuna}</p></div><button onClick={onClose}><X size={17}/></button></header>
    <div className="dx-wsteps"><StepTab n="1" label="Pedidos" on={paso===1} done={paso>1}/><i/><StepTab n="2" label="Logística" on={paso===2} done={paso>2}/><i/><StepTab n="3" label="Confirmar AD" on={paso===3}/></div>
    <main>
      {paso===1&&<><div className="dx-wintro"><div><b>1. Selecciona los pedidos que entrarán al AD</b><span>El detalle sigue siendo individual aunque la jornada se entregue agrupada a la comunidad.</span></div><div className="dx-wcounts"><span>{base.length} pedidos</span><span>{pagados.length} pagados</span><span>{base.length-pagados.length} pendientes de pago</span></div></div><div className="dx-user-toolbar"><div className="dx-search"><Search size={14}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar pedido, persona o cédula"/></div><button className="dx-secondary" onClick={()=>setSel(new Set(pagados.map(x=>x.id)))}>Seleccionar pagados</button><button className="dx-secondary" onClick={()=>setSel(new Set())}>Limpiar</button></div><UserTable rows={filtered} selected={sel} toggle={toggle}/></>}
      {paso===2&&<><div className="dx-wintro"><div><b>2. Asigna ruta, vehículo y operador</b><span>El vehículo se identifica por placa y el operador por nombre y cédula. Esta asignación pasa directamente a Operaciones.</span></div></div><div className="dx-formgrid"><label><span>Número AD</span><input value={ad} onChange={e=>setAd(e.target.value)}/></label><label><span>Ruta</span><input value={route} onChange={e=>setRoute(e.target.value)} placeholder="Ej. 03"/></label><label><span>Vehículo / placa</span><select value={unidad} onChange={e=>setUnidad(e.target.value)}>{UNIDADES_DISTRIBUCION.filter(u=>!u.granel).map(u=><option key={u.id} value={u.id}>{u.placa} · {u.etiqueta}</option>)}</select></label><label><span>Operador / conductor</span><select value={operadorId} onChange={e=>setOperadorId(e.target.value)}>{opsCompatibles.map(o=><option key={o.id} value={o.id}>{o.nombre} · {o.cedula}</option>)}</select></label><label><span>Cédula del operador</span><input readOnly value={operador.cedula}/></label><label><span>Transportista</span><input readOnly value={tipoFlota[unidadObj.tipo]||unidadObj.tipo}/></label></div><div className="dx-driver-card"><div><UserRound size={17}/><span>Operador asignado</span><b>{operador.nombre}</b><small>{operador.cedula}</small></div><div><CarFront size={17}/><span>Vehículo</span><b>{unidadObj.placa}</b><small>{unidadObj.etiqueta}</small></div></div><div className="dx-load"><h3>Carga calculada automáticamente</h3><div>{[10,18,27,43].map(k=><span key={k}>{k} kg<b>{counts[k]||0}</b></span>)}</div><strong>{selected.length} pedidos · <KgL kg={kg} /></strong></div></>}
      {paso===3&&<><div className="dx-wintro"><div><b>3. Confirma la creación del AD</b><span>Al confirmar, todos los pedidos seleccionados quedarán vinculados al AD y la ruta aparecerá al operador asignado.</span></div></div><div className="dx-confirm"><div><span>AD</span><b>{ad}</b></div><div><span>Comuna</span><b>{ruta.comuna}</b></div><div><span>Comunidad</span><b>{ruta.comunidad}</b></div><div><span>Ruta</span><b>{route||"POR DEFINIR"}</b></div><div><span>Placa</span><b>{unidadObj.placa}</b></div><div><span>Operador</span><b>{operador.nombre}</b><small>{operador.cedula}</small></div><div><span>Pedidos incluidos</span><b>{selected.length}</b></div><div><span>Carga</span><b><KgL kg={kg} /></b></div></div><div className="dx-preview"><h3>Distribución por cilindro</h3>{[10,18,27,43].map(k=><div key={k}><span>{k} kg</span><b>{counts[k]||0}</b></div>)}</div></>}
    </main>
    <footer><button className="dx-secondary" onClick={()=>paso===1?onClose():setPaso(paso-1)}>{paso===1?"Cancelar":<><ChevronLeft size={14}/>Atrás</>}</button>{paso<3?<button className="dx-primary" disabled={paso===1&&!selected.length} onClick={()=>setPaso(paso+1)}>Continuar <ChevronRight size={14}/></button>:<button className="dx-primary" disabled={!operadorId||!unidad} onClick={crear}><Check size={14}/>Crear y asignar AD</button>}</footer>
  </div></div>
}

function UserTable({rows,selected,toggle,compact=true,allowUnpaid=false,onVerUsuario}){return <div className={`dx-table-wrap users ${compact?"compact":""}`}><table className="dx-table"><thead><tr>{selected&&<th></th>}<th>Pedido</th><th>Persona</th><th>Cédula</th><th>Comunidad</th><th>Pago</th><th>Solicitud</th><th>Litros</th><th>AD</th>{onVerUsuario&&<th></th>}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className={!r.pagado?"muted":""}>{selected&&<td><input type="checkbox" checked={selected.has(r.id)} disabled={!r.pagado&&!allowUnpaid} onChange={()=>toggle(r.id)}/></td>}<td><b>{r.pedidoId||r.id}</b><span>{r.fechaPedido||"14/08/2026"} · {r.horaPedido||"—"}</span></td><td><b>{r.nombre}</b></td><td>{r.cedula}</td><td>{r.comunidad}</td><td><Tag tone={r.pagado?"green":"amber"}>{r.pagado?"Pago verificado":"Pendiente"}</Tag></td><td>{r.kg?`${r.cantidad||1} × ${r.kg} kg`:"—"}</td><td>{r.kg?`${fmt((r.kg*(r.cantidad||1))/.54,2)} L`:"—"}</td><td>{r.ad||"Sin AD"}</td>{onVerUsuario&&<td><button className="dx-user-link" onClick={()=>onVerUsuario(r)}>Ver ficha</button></td>}</tr>)}</tbody></table></div>}

function DetalleAD({ruta,onClose,onPlan}){const us=usuariosRuta(ruta);return <div className="dx-modal-bg"><div className="dx-detail"><header><div><small>AD {ruta.ad||"Sin crear"}</small><h2>{ruta.comunidad}</h2><p>{ruta.comuna}</p></div><button onClick={onClose}><X size={17}/></button></header><main><div className="dx-summary-strip"><div><span>Cilindros</span><b>{cilindrosFila(ruta)}</b></div><div><span>GLP</span><b>{num(kgFila(ruta))} kg</b></div><div><span>Vehículo</span><b>{unidadDistribucion(ruta.unidad).placa||ruta.unidad}</b></div><div><span>Estado</span><b>{estados[ruta.estadoRuta]?.label}</b></div><div><span>Operador</span><b>{ruta.conductor||"Por asignar"}</b><small>{ruta.conductorCedula||"—"}</small></div></div><h3>Personas incluidas</h3><UserTable rows={us.filter(x=>x.incluidoAD)}/></main><footer><button className="dx-secondary" onClick={onClose}>Cerrar</button><button className="dx-primary" onClick={onPlan}>Editar planificación</button></footer></div></div>}

function FichaUsuarioDistribucion({pedido,onClose}){
  const h=historialDistribucionPersona(pedido);
  const perfil={
    id:pedido.cedula?.replace(/\D/g,"")||pedido.id,nombre:pedido.nombre,doc:pedido.cedula,
    tipo:pedido.segmento||"RESIDENCIAL",uso:pedido.segmento||"RESIDENCIAL",comuna:pedido.comuna,
    comunidad:pedido.comunidad,cdt:"C.D.T. Gral. Jacinto Lara",direccion:`Registrado en ${pedido.comunidad || pedido.comuna || "comunidad"}`,
    desde:"Histórico operativo disponible",tel:"—",
  };
  return <Usuario360Modal mode="distribucion" perfil={perfil} solicitudes={h.solicitudes} pagos={h.pagos} despachos={h.despachos} auditoria={h.auditoria} onClose={onClose}/>;
}

function StepTab({n,label,on,done}){return <div className={`${on?"on":""} ${done?"done":""}`}><b>{done?<Check size={13}/>:n}</b><span>{label}</span></div>}
function Kpi({icon:I,label,value,foot}){return <div className="dx-kpi"><I size={18}/><span>{label}</span><b>{value}</b><small>{foot}</small></div>}
function Card({title,subtitle,action,children}){return <section className="dx-card"><div className="dx-card-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>}
function Stat({label,value,tone="slate"}){return <div className={`dx-stat ${tone}`}><span>{label}</span><b>{value}</b></div>}
function Tag({tone="slate",children}){return <span className={`dx-tag ${tone}`}>{children}</span>}
function Progress({value,total}){return <div className="dx-progress"><i style={{width:`${Math.min(100,total?value/total*100:0)}%`}}/></div>}
function Empty({text}){return <div className="dx-empty"><CircleDot size={15}/>{text}</div>}
function Bars({rows,total}){return <div className="dx-bars">{rows.map(([l,v,t])=><div key={l}><div><span>{l}</span><b>{num(v)} · {pct(v,total)}</b></div><div className="dx-bar"><i className={t} style={{width:`${Math.min(100,total?v/total*100:0)}%`}}/></div></div>)}</div>}
function siguienteAD(rutas){let m=76000;rutas.forEach(r=>{String(r.ad||"").split(/\D+/).forEach(x=>{const n=Number(x);if(n>m&&n<999999)m=n})});return m+1}
const titulo=v=>({inicio:"Resumen de distribución",pedidos:"Pedidos en tiempo real",ads:"AD del día",carga:"Preparación y carga",ejecucion:"Ejecución y cierre de AD",flota:"Flota y operadores",planta:"Movimiento de planta",granel:"Granel",movil:"Planta móvil",comunas:"Comunas y usuarios"}[v]);
const subtitulo=v=>({inicio:"Lo esencial de la jornada en una sola vista.",pedidos:"Bandeja individual de solicitudes recibidas desde el sistema, antes y después de entrar en un AD.",planificar:"Convierte pedidos pagados de una comunidad en una ruta lista para despacho.",ads:"Planificar, consultar, replanificar e imprimir las AD. Cada una abre a su listado de personas; antes de salir, lo único que decide quién entra es el pago.",agenda:"Orden cronológico de las jornadas, unidades y comunidades del día.",carga:"Compara lo planificado con lo cargado físicamente antes de liberar el vehículo.",ejecucion:"El conductor ejecuta y reporta; Distribución confirma las incidencias y firma el cierre que factura, descuenta inventario y abona.",replanificar:"Mueve, reasigna, divide o reprograma una AD dejando visible la bitácora del cambio.",flota:"Disponibilidad de vehículos y operadores con placa, cédula y asignación actual.",planta:"Registro del operador de planta: todo el gas que entra y sale, en cilindros y en gandolas.",granel:"Clientes con tanque propio, niveles de reposición y histórico de despachos medidos en sitio.",movil:"Jornadas de llenado en calle, atención a usuarios sin código y arqueo de la caja.",incidencias:"Control visual de diferencias de carga, flota y entregas parciales.",comunas:"Revisa el detalle individual que soporta cada entrega comunal.",reportes:"Métricas de ejecución, cobertura y flota generadas directamente dentro del sistema."}[v]);

function Estilos(){return <style>{`
.dx{min-height:100vh;background:#F5F7F9;color:#17232C;font-family:Inter,Segoe UI,system-ui,sans-serif;display:grid;grid-template-columns:250px 1fr}.dx-side{background:#111A22;color:#EAF0F4;padding:22px 16px;display:flex;flex-direction:column;gap:16px}.dx-brand{display:flex;align-items:center;gap:10px}.dx-brand img{width:68px;background:#fff;border-radius:9px;padding:5px}.dx-brand b{display:block;font-size:18px}.dx-brand span{font-size:11px;color:#9EADB9}.dx-side>p{font-size:12px;line-height:1.55;color:#B9C4CD;margin:0}.dx-side nav{display:flex;flex-direction:column;gap:7px}.dx-side nav button{border:0;background:transparent;color:#BDC7D0;border-radius:10px;padding:11px 10px;display:flex;align-items:center;gap:9px;text-align:left;font-size:12px;font-weight:700;cursor:pointer}.dx-side nav button.on{background:#EAF4EE;color:#174B32}.dx-side nav em{margin-left:auto;background:#D88B22;color:white;font-style:normal;font-size:10px;border-radius:999px;padding:2px 6px}.dx-rule{margin-top:auto;border-top:1px solid #26343F;padding-top:14px}.dx-rule small{display:block;color:#82929F;font-size:10px}.dx-rule b{display:block;font-size:13px;margin:4px 0}.dx-rule span{font-size:11px;color:#AAB6C0;line-height:1.45;display:block}.dx-main{padding:24px 26px 34px;min-width:0;overflow-x:hidden}.dx-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.dx-head>div>span{font-size:10px;font-weight:800;color:#26704C;background:#EAF4EE;padding:6px 9px;border-radius:999px}.dx-head h1{font-size:27px;margin:10px 0 5px}.dx-head p{margin:0;color:#687681;font-size:13px}.dx-date{background:white;border:1px solid #DDE4EA;border-radius:10px;padding:9px 11px;display:flex;gap:7px;align-items:center;font-size:12px}.dx-content{display:flex;flex-direction:column;gap:16px}.dx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px}.dx-kpi,.dx-card{background:white;border:1px solid #E0E6EB;border-radius:16px;box-shadow:0 5px 16px rgba(20,30,40,.035)}.dx-kpi{padding:14px;display:flex;flex-direction:column;gap:6px}.dx-kpi>span{color:#697784;font-size:11px}.dx-kpi>b{font-size:25px}.dx-kpi>small{font-size:11px;color:#85929C}.dx-grid{display:grid;gap:16px}.dx-grid.two{grid-template-columns:1fr 1fr}.dx-card{padding:16px}.dx-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px}.dx-card h2{font-size:16px;margin:0 0 4px}.dx-card-head p{font-size:12px;color:#72808C;margin:0;line-height:1.45}.dx-primary,.dx-secondary,.dx-link,.dx-iconbtn{border:0;border-radius:10px;font-weight:800;display:inline-flex;align-items:center;gap:6px;cursor:pointer}.dx-primary{background:#17623F;color:#fff;padding:9px 12px}.dx-secondary{background:#EEF2F5;color:#2F3C46;padding:9px 12px}.dx-link{background:transparent;color:#17623F;padding:2px}.dx-iconbtn{background:#EEF2F5;color:#34434E;width:32px;height:32px;justify-content:center}.dx-primary:disabled{opacity:.45;cursor:not-allowed}.dx-list,.dx-community-list{display:flex;flex-direction:column;gap:9px}.dx-list-row,.dx-community{border:1px solid #E5EAEE;background:#FBFCFD;border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px}.dx-list-row b,.dx-community b{display:block;font-size:13px}.dx-list-row span,.dx-community span{display:block;font-size:11px;color:#74818C;margin-top:3px}.dx-status{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.dx-stat{padding:11px;border-radius:11px;background:#F1F4F6}.dx-stat.amber{background:#FFF3E5}.dx-stat.blue{background:#EAF1FA}.dx-stat.green{background:#EAF5EE}.dx-stat span{font-size:10px;color:#667582}.dx-stat b{display:block;font-size:20px;margin-top:4px}.dx-progressbox{margin-top:13px}.dx-progressbox>div:first-child{display:flex;justify-content:space-between;font-size:11px}.dx-progressbox small{font-size:10px;color:#7C8994}.dx-progress{height:8px;background:#EAF0ED;border-radius:99px;overflow:hidden;margin:8px 0}.dx-progress i{display:block;height:100%;background:#28A167;border-radius:99px}.dx-ad-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.dx-ad-card{border:1px solid #E4EAEE;background:#FBFCFD;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.dx-ad-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.dx-ad-top>span{font-size:10px;color:#75838F}.dx-ad-card>b{font-size:13px}.dx-ad-card p{font-size:11px;color:#6E7B87;margin:4px 0 10px;line-height:1.35}.dx-ad-card>div:last-child{display:flex;justify-content:space-between;color:#65737F;font-size:10px}.dx-tag{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:800}.dx-tag.green{background:#E7F4EC;color:#1C6945}.dx-tag.amber{background:#FFF1E0;color:#A66A16}.dx-tag.blue{background:#E8F0FB;color:#2E67AE}.dx-tag.red{background:#FBE9E9;color:#A13D3D}.dx-tag.slate{background:#EEF2F5;color:#5D6974}.dx-toolbar{display:flex;justify-content:flex-end}.dx-search{background:white;border:1px solid #DBE3E9;border-radius:10px;padding:9px 10px;display:flex;align-items:center;gap:7px;min-width:290px}.dx-search input{border:0;outline:none;width:100%;font:inherit;font-size:12px}.dx-community{display:grid;grid-template-columns:1.4fr 1fr auto}.dx-community-main{display:flex;gap:10px;align-items:flex-start}.dx-community-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-community-counts>div{background:#F2F5F7;padding:7px;border-radius:8px}.dx-community-counts span{font-size:9px!important;margin:0!important}.dx-community-counts b{font-size:13px;margin-top:2px}.dx-table-wrap{border:1px solid #E3E9ED;border-radius:12px;overflow:auto}.dx-table-wrap.users{max-height:430px}.dx-table-wrap.users.compact{max-height:365px}.dx-table{width:100%;border-collapse:collapse;font-size:11px}.dx-table thead{position:sticky;top:0;background:#F4F6F8;z-index:1}.dx-table th,.dx-table td{padding:9px 10px;border-bottom:1px solid #E9EDF0;text-align:left;white-space:nowrap}.dx-table th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#697783}.dx-table td>b{display:block;font-size:11px}.dx-table td>span{display:block;font-size:10px;color:#77848F;margin-top:2px}.dx-table tr.muted{background:#FAFAFA;color:#89949C}.dx-filters{display:grid;grid-template-columns:1fr 1fr .7fr;gap:10px;margin-bottom:12px}.dx-filters label span,.dx-formgrid label span{font-size:10px;color:#697783;display:block;margin-bottom:5px}.dx-filters select,.dx-formgrid select,.dx-formgrid input{width:100%;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:9px;font:inherit;font-size:11px;background:white}.dx-summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 12px}.dx-summary-strip>div{background:#F4F7F8;padding:10px;border-radius:10px}.dx-summary-strip span{font-size:9px;color:#687682;display:block}.dx-summary-strip b{font-size:14px;display:block;margin-top:3px}.dx-bars{display:flex;flex-direction:column;gap:12px}.dx-bars>div>div:first-child{display:flex;justify-content:space-between;font-size:11px}.dx-bar{height:8px;background:#EDF1F4;border-radius:99px;overflow:hidden;margin-top:6px}.dx-bar i{height:100%;display:block;background:#8E9CAA}.dx-bar i.green{background:#2DA268}.dx-bar i.blue{background:#3B77C7}.dx-bar i.amber{background:#D78B20}.dx-report-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.dx-report-grid>div{background:#F4F7F8;padding:11px;border-radius:10px}.dx-report-grid span{display:block;font-size:10px;color:#6E7C87}.dx-report-grid b{display:block;font-size:18px;margin-top:4px}.dx-empty{padding:15px;border:1px dashed #D5DEE5;border-radius:10px;color:#6C7985;font-size:11px;display:flex;gap:6px;align-items:center}.dx-modal-bg{position:fixed;inset:0;background:rgba(15,22,28,.48);display:grid;place-items:center;padding:18px;z-index:50}.dx-wizard,.dx-detail{width:min(1050px,97vw);max-height:94vh;background:white;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 70px rgba(0,0,0,.2)}.dx-wizard>header,.dx-detail>header{padding:16px 18px;border-bottom:1px solid #E6EBEF;display:flex;justify-content:space-between}.dx-wizard header small,.dx-detail header small{font-size:9px;color:#6D7A85;font-weight:800}.dx-wizard h2,.dx-detail h2{font-size:19px;margin:3px 0}.dx-wizard header p,.dx-detail header p{font-size:11px;color:#6D7A85;margin:0}.dx-wizard header button,.dx-detail header button{border:1px solid #DDE4E9;background:white;width:32px;height:32px;border-radius:9px}.dx-wsteps{padding:12px 18px;background:#FAFBFC;display:flex;align-items:center;justify-content:center;gap:8px;border-bottom:1px solid #E7ECEF}.dx-wsteps>div{display:flex;align-items:center;gap:6px;color:#84909A;font-size:10px}.dx-wsteps>div b{width:23px;height:23px;border-radius:50%;background:#E9EDF0;display:grid;place-items:center}.dx-wsteps>div.on,.dx-wsteps>div.done{color:#17623F;font-weight:800}.dx-wsteps>div.on b,.dx-wsteps>div.done b{background:#DFF0E6;color:#17623F}.dx-wsteps>i{width:42px;height:1px;background:#D9E0E5}.dx-wizard>main,.dx-detail>main{padding:16px 18px;overflow:auto;flex:1}.dx-wintro{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px}.dx-wintro b{display:block;font-size:13px}.dx-wintro span{display:block;font-size:11px;color:#6F7C87;margin-top:3px}.dx-wcounts{display:flex;gap:6px}.dx-wcounts span{background:#F1F4F6;padding:6px 8px;border-radius:999px;font-size:9px;margin:0}.dx-user-toolbar{display:flex;gap:7px;align-items:center;margin-bottom:9px}.dx-user-toolbar .dx-search{margin-right:auto}.dx-wizard>footer,.dx-detail>footer{padding:12px 18px;border-top:1px solid #E6EBEF;display:flex;justify-content:space-between}.dx-formgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.dx-load{margin-top:14px;border:1px solid #DDE9E2;background:#F4F9F6;border-radius:12px;padding:12px}.dx-load h3,.dx-preview h3,.dx-detail main h3{font-size:12px;margin:0 0 9px}.dx-load>div{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-load span{background:white;border-radius:8px;padding:7px;font-size:9px}.dx-load span b{font-size:14px;display:block;margin-top:2px}.dx-load strong{display:block;font-size:11px;margin-top:9px}.dx-confirm{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.dx-confirm>div{background:#F4F7F8;padding:10px;border-radius:10px}.dx-confirm span{display:block;font-size:9px;color:#697783}.dx-confirm b{display:block;font-size:12px;margin-top:3px}.dx-preview{margin-top:12px}.dx-preview>div{display:flex;justify-content:space-between;border-bottom:1px solid #E8EDF0;padding:7px 0;font-size:11px}.dx-detail{width:min(900px,96vw)}.dx-toast{position:fixed;right:18px;bottom:18px;background:#15222A;color:white;border-radius:10px;padding:10px 12px;display:flex;gap:7px;align-items:center;font-size:11px;z-index:80}
.dx-fuentes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:11px}
.dx-fuente{border:1px solid #E0E6EB;border-left-width:4px;border-radius:13px;padding:14px;background:#FBFCFD;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:3px}
.dx-fuente:hover{background:#F5F8F9}
.dx-fuente>span{font-size:8.5px;font-weight:800;letter-spacing:.06em;color:#7A8791}
.dx-fuente>b{font-size:25px;margin:4px 0 0}
.dx-fuente>em{font-style:normal;font-size:11px;color:#4B5A66}
.dx-fuente>small{font-size:10px;color:#7C8892;margin-top:4px;line-height:1.4}
.dx-fuente.com{border-left-color:#2D65B0}.dx-fuente.com>b{color:#2D65B0}
.dx-fuente.ope{border-left-color:#1C7A50}.dx-fuente.ope>b{color:#1C7A50}
.dx-fuente.flo{border-left-color:#A2701A}.dx-fuente.flo>b{color:#A2701A}
.dx-cobertura{margin-top:12px;border-radius:12px;padding:12px 14px;background:#F5F8F9;border:1px solid #E4EAEE}
.dx-cobertura>div:first-child{display:flex;justify-content:space-between;align-items:baseline}
.dx-cobertura span{font-size:11px;color:#5D6B76}
.dx-cobertura b{font-size:18px}
.dx-cobertura small{display:block;font-size:10px;color:#7C8892;margin-top:6px;line-height:1.45}
.dx-cob-barra{height:9px;background:#E7EDF0;border-radius:99px;overflow:hidden;margin-top:8px}
.dx-cob-barra i{display:block;height:100%;border-radius:99px;background:#2E9963}
.dx-cobertura.medio .dx-cob-barra i{background:#D08A24}.dx-cobertura.medio b{color:#A2701A}
.dx-cobertura.bajo .dx-cob-barra i{background:#B4571F}.dx-cobertura.bajo b{color:#B4571F}
.dx-cobertura.ok b{color:#1C7A50}
.dx-flota-alerta{display:flex;gap:9px;align-items:flex-start;margin-top:11px;background:#FFF6E7;border:1px solid #EED8B2;color:#82561D;border-radius:11px;padding:11px}
.dx-flota-alerta>div>b,.dx-flota-alerta>div>span{display:block}
.dx-flota-alerta b{font-size:11px;margin-bottom:3px}
.dx-flota-alerta span{font-size:10px;line-height:1.45}
@media(max-width:1000px){.dx-fuentes-grid{grid-template-columns:1fr}}
.dx-livebar{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#F0F7F3;border:1px solid #D6E8DD;border-radius:12px;padding:11px 13px}.dx-livebar>div{display:flex;align-items:center;gap:8px;color:#285E43}.dx-livebar b{font-size:12px}.dx-livebar span{font-size:11px;color:#607267}.dx-kpis.orders{grid-template-columns:repeat(4,1fr)}.dx-orders-filters{display:grid;grid-template-columns:2fr repeat(4,minmax(130px,1fr));gap:8px;margin-bottom:12px;align-items:end}.dx-search.wide{min-width:0}.dx-filter-select span{display:block;font-size:9px;color:#687682;margin-bottom:4px}.dx-filter-select select{width:100%;border:1px solid #DBE3E9;border-radius:9px;background:white;padding:9px 8px;font:inherit;font-size:10px;color:#30404B}.dx-clear{border:1px solid #DDE4E9;background:white;color:#4D5B66;border-radius:9px;padding:9px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer}.orders-table{max-height:570px}.dx-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:10px;color:#6D7A85}.dx-pagination>div{display:flex;gap:6px}.dx-lifecycle{display:flex;align-items:center;gap:6px;overflow:auto;padding:10px 0 14px;margin-bottom:4px}.dx-lifecycle span{white-space:nowrap;border:1px solid #DFE7E3;background:#F7FAF8;color:#385347;border-radius:999px;padding:6px 9px;font-size:8.5px;font-weight:800}.dx-lifecycle i{font-style:normal;color:#A1ADA7;font-size:11px}.dx-driver-card{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.dx-driver-card>div{border:1px solid #DFE7EC;background:#F8FAFB;border-radius:11px;padding:11px;display:grid;grid-template-columns:auto 1fr;column-gap:8px}.dx-driver-card svg{grid-row:1/5;color:#17623F}.dx-driver-card span{font-size:9px;color:#6A7884}.dx-driver-card b{font-size:12px;margin-top:2px}.dx-driver-card small{font-size:10px;color:#6B7984;margin-top:2px}.dx-confirm small{display:block;font-size:9px;color:#6D7B86;margin-top:2px}
.dx-live-actions{display:flex;gap:7px;align-items:center}.dx-livebar .dx-primary{white-space:nowrap}.dx-orders-help{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.dx-orders-help>div{background:#F7F9FA;border:1px solid #E3E9ED;border-radius:10px;padding:10px}.dx-orders-help b{display:block;font-size:10px}.dx-orders-help span{display:block;font-size:10px;color:#6C7984;line-height:1.4;margin-top:3px}.dx-selectionbar{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#F4F8F5;border:1px solid #DCE9E1;border-radius:11px;padding:9px 11px;margin-bottom:10px}.dx-selectionbar>div:first-child b{display:block;font-size:11px}.dx-selectionbar>div:first-child span{display:block;font-size:9px;color:#64736B;margin-top:2px}.dx-selectionbar>div:last-child{display:flex;gap:6px;flex-wrap:wrap}.dx-custom-warning{display:flex;gap:8px;align-items:flex-start;background:#FFF5E8;border:1px solid #F0D7B2;color:#8A5815;border-radius:10px;padding:10px;margin:8px 0 11px;font-size:10px;line-height:1.45}.dx-custom-warning.ok{background:#EDF7F1;border-color:#D3E8DA;color:#2C6545}.dx-justification{display:block;margin-top:12px}.dx-justification>span{display:block;font-size:10px;color:#697783;margin-bottom:5px}.dx-justification textarea{width:100%;min-height:70px;resize:vertical;box-sizing:border-box;border:1px solid #DCE4E9;border-radius:9px;padding:9px;font:inherit;font-size:11px}.dx-justification small{display:block;font-size:9px;color:#7A8791;margin-top:4px}.dx-wizard.custom{width:min(1180px,97vw)}
.dx-row-plan{border:1px solid #CFE1D6;background:#EEF7F1;color:#185B3B;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800;display:inline-flex;align-items:center;gap:4px;cursor:pointer}

.dx-row-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.dx-user-link{border:1px solid #D7E1E7;background:#fff;color:#335363;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap}
.dx-report-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.dx-report-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.dx-report-toolbar>span{font-size:10px;color:#6D7A85}.dx-ad-report-list{display:flex;flex-direction:column;gap:8px}.dx-ad-report-row{display:grid;grid-template-columns:minmax(280px,1.4fr) .7fr minmax(280px,1fr) auto;gap:12px;align-items:center;border:1px solid #E2E8EC;background:#FBFCFD;border-radius:12px;padding:11px 12px}.dx-ad-report-main{display:flex;gap:10px;align-items:center}.dx-ad-number{width:54px;height:48px;background:#EEF5F1;border:1px solid #D9E8DF;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#225C40;flex:0 0 auto}.dx-ad-number span{font-size:8px;font-weight:800}.dx-ad-number b{font-size:14px}.dx-ad-report-main strong{display:block;font-size:11px}.dx-ad-report-main>div>span{display:block;font-size:10px;color:#74818B;margin-top:2px}.dx-ad-report-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.dx-ad-report-stats>div{background:#F2F5F7;border-radius:8px;padding:7px}.dx-ad-report-stats span{display:block;font-size:8px;color:#74818B}.dx-ad-report-stats b{display:block;font-size:11px;margin-top:2px}.dx-ad-report-log b{display:block;font-size:11px}.dx-ad-report-log>span{display:block;font-size:9px;color:#71808A;margin:3px 0 5px}.dx-print-root{position:fixed;inset:0;background:#E9EEF2;z-index:120;display:flex;flex-direction:column}.dx-print-shell{height:62px;background:#101820;color:white;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;flex:0 0 auto}.dx-print-shell>div:first-child b{display:block;font-size:13px}.dx-print-shell>div:first-child span{display:block;font-size:9px;color:#AAB5BE;margin-top:3px}.dx-print-shell>div:last-child{display:flex;gap:8px}.dx-print-scroll{overflow:auto;flex:1;padding:22px}.dx-print-paper{width:min(1180px,96vw);margin:0 auto;background:white;box-shadow:0 15px 45px rgba(13,24,31,.15);padding:32px;box-sizing:border-box}.dx-print-cover{min-height:900px;display:flex;flex-direction:column;justify-content:center}.dx-print-cover-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:35px 0}.dx-print-cover-grid>div{border:1px solid #DCE4E9;background:#F7F9FA;border-radius:10px;padding:16px}.dx-print-cover-grid span{display:block;font-size:10px;color:#6B7883}.dx-print-cover-grid b{display:block;font-size:24px;margin-top:5px}.dx-print-cover-note{max-width:760px;color:#5F6D78;font-size:12px;line-height:1.7}.dx-print-ad{font-family:Arial,Helvetica,sans-serif;color:#101820;font-size:10px}.dx-print-ad.page-break{page-break-before:always;padding-top:4px}.dx-print-brand{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;border-bottom:2px solid #18222B;padding-bottom:13px;margin-bottom:16px}.dx-print-brand img{width:82px}.dx-print-brand small{display:block;font-size:8px;letter-spacing:.05em;color:#53616C;font-weight:700}.dx-print-brand h1{font-size:17px;margin:3px 0}.dx-print-brand p{margin:0;font-size:9px;color:#68757F}.dx-print-ad-box{border:1px solid #1D2932;border-radius:6px;min-width:92px;text-align:center;padding:8px 10px}.dx-print-ad-box span{display:block;font-size:8px}.dx-print-ad-box b{display:block;font-size:18px;margin:2px 0}.dx-print-ad-box em{display:block;font-style:normal;font-size:8px;color:#4B5A65}.dx-print-section-title{font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.04em;background:#EEF2F4;border-left:4px solid #1D6A46;padding:7px 9px;margin:14px 0 9px}.dx-print-info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-print-info-grid.four{grid-template-columns:repeat(4,1fr)}.dx-print-info-grid>div{border:1px solid #DDE4E8;padding:7px 8px;border-radius:5px;min-height:37px}.dx-print-info-grid span{display:block;font-size:7.5px;color:#65727C;text-transform:uppercase}.dx-print-info-grid b{display:block;font-size:9px;margin-top:3px;line-height:1.3}.dx-print-load-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.dx-print-load-grid>div{border:1px solid #DDE4E8;background:#FAFBFC;padding:8px;border-radius:5px}.dx-print-load-grid>div.strong{background:#F0F6F2;border-color:#D1E2D8}.dx-print-load-grid span{display:block;font-size:8px;color:#64717B}.dx-print-load-grid b{display:block;font-size:13px;margin-top:3px}.dx-print-auth{border:1px solid #E2C98B;background:#FFF9E9;border-radius:5px;padding:8px 9px;margin-top:9px}.dx-print-auth b,.dx-print-auth span{display:block}.dx-print-auth span{margin-top:3px;line-height:1.45}.dx-print-table-wrap{overflow:visible}.dx-print-table{width:100%;border-collapse:collapse;font-size:7.8px}.dx-print-table th,.dx-print-table td{border:1px solid #D6DEE3;padding:4px 5px;text-align:left;vertical-align:top}.dx-print-table th{background:#EDF1F3;text-transform:uppercase;font-size:7px;letter-spacing:.03em}.dx-print-table tfoot td{font-weight:800;background:#F3F6F7}.dx-print-summary-line{display:flex;gap:16px;flex-wrap:wrap;background:#F7F9FA;border:1px solid #E0E6EA;padding:7px 9px;margin-top:7px}.dx-print-observations{border:1px solid #D9E1E6;padding:8px}.dx-print-observations b{display:block}.dx-print-observations div{height:42px;margin-top:6px;border-bottom:1px solid #CBD5DB}.dx-print-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin:34px 0 18px}.dx-print-signatures>div{text-align:center}.dx-print-signatures span{display:block;font-weight:700}.dx-print-signatures i{display:block;height:34px;border-bottom:1px solid #2A343C}.dx-print-signatures small{display:block;font-size:7.5px;color:#65727C;margin-top:4px}.dx-print-footer{display:flex;justify-content:space-between;border-top:1px solid #D7DFE4;padding-top:7px;color:#67747E;font-size:7.5px}.dx-print-cover .dx-print-brand{grid-template-columns:auto 1fr}.dx-print-cover .dx-print-brand h1{font-size:25px}
@media print{body *{visibility:hidden!important}.dx-print-root,.dx-print-root *{visibility:visible!important}.dx-print-root{position:absolute!important;inset:0!important;background:white!important;display:block!important}.dx-print-shell{display:none!important}.dx-print-scroll{overflow:visible!important;padding:0!important}.dx-print-paper{width:100%!important;margin:0!important;padding:0!important;box-shadow:none!important}.dx-print-cover{page-break-after:always;min-height:auto;padding-top:22mm}.dx-print-ad{page-break-inside:auto}.dx-print-table thead{display:table-header-group}.dx-print-table tfoot{display:table-footer-group}.dx-print-table tr{page-break-inside:avoid}.dx-print-section-title,.dx-print-brand,.dx-print-load-grid,.dx-print-info-grid,.dx-print-summary-line,.dx-print-signatures{page-break-inside:avoid}@page{size:landscape;margin:9mm}}
@media(max-width:1100px){.dx-orders-filters{grid-template-columns:repeat(3,1fr)}.dx-search.wide{grid-column:1/-1}.dx-kpis,.dx-ad-grid{grid-template-columns:repeat(2,1fr)}.dx-grid.two{grid-template-columns:1fr}.dx-community{grid-template-columns:1fr}.dx-community-counts{order:2}.dx-community>button{justify-self:start}.dx{grid-template-columns:210px 1fr}}@media(max-width:800px){.dx-orders-filters,.dx-driver-card{grid-template-columns:1fr}.dx{grid-template-columns:1fr}.dx-side{display:none}.dx-main{padding:15px}.dx-kpis,.dx-ad-grid,.dx-status,.dx-filters,.dx-summary-strip,.dx-formgrid,.dx-confirm{grid-template-columns:1fr}.dx-head{flex-direction:column;gap:10px}.dx-user-toolbar{flex-wrap:wrap}.dx-search{min-width:0;width:100%}}
`}</style>}
