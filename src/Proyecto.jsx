import React from "react";
import {
  ArrowRight, Building2, Users, Truck, Smartphone, Gauge, CircleDollarSign,
  ClipboardList, FileText, Boxes, CheckCircle2, ShieldCheck, Factory, RefreshCw, Wallet,
  Landmark, Route, Scale, TriangleAlert, Network, BadgePercent, Calculator, FolderOpen, LayoutDashboard,
} from "lucide-react";
import { LOGO_GASLARA, LOGO_LARA, CDTS, COMUNAS, FASES, HOY, KG_POR_LITRO_GLP, kgALitros, num, fecha } from "./datos.jsx";

const accesos = [
  { id: "portal", titulo: "Portal del usuario", sub: "El ciudadano pide y paga; con el rol de comuna, el coordinador consulta a sus miembros y su jornada", icon: Smartphone, tono: "mo" },
  { id: "distribucion", titulo: "Distribución", sub: "Planificación del AD, jornada por momentos, cierre del AD y bandeja de replanificación", icon: Route, tono: "am" },
  { id: "admin", titulo: "Comercialización", sub: "Taquilla, padrón, libro de ventas, saldos a favor, inventario y cierre del período", icon: Building2, tono: "az" },
  { id: "gestion", titulo: "Centro de gestión", sub: "Dashboard ejecutivo, reportes, auditoría y roles · sólo consulta", icon: LayoutDashboard, tono: "gr" },
  { id: "nomina", titulo: "Nómina", sub: "Backoffice interno: expedientes, cálculo legal, prestaciones, vacaciones y reportes", icon: Calculator, tono: "vd" },
];

/* La portada no calcula nada: cada número sale de `cifras`, la misma fuente que leen el panel,
   el cierre, Distribución y el Centro de gestión. */
export default function Proyecto({ onNavigate, cifras }) {
  const { dinero, glp, ad, replanificacion } = cifras;
  const factor = KG_POR_LITRO_GLP.toFixed(3).replace(".", ",");
  const peldanos = FASES.map((f) => f.cliente.toLowerCase()).join(" → ");

  return (
    <div className="pj">
      <Estilos />
      <section className="pj-hero">
        <div className="pj-hero-copy">
          <img src={LOGO_GASLARA} alt="GasLara" className="pj-logo" />
          <div className="pj-eyebrow">PROTOTIPO FUNCIONAL · DISTRIBUCIÓN Y COMERCIALIZACIÓN DE GLP</div>
          <h1>Un solo flujo para el pedido: pago verificado, jornada comunal, llenado en planta y cierre del AD.</h1>
          <p>La persona pide y paga desde el portal o en la taquilla, y la API verifica el pago y aplica la regla: el dinero queda pendiente por despachar y el GLP comprometido, sin tocar el inventario físico. La venta ocurre al cerrar el AD, cuando la bombona vuelve llena al punto comunal: ahí se factura al precio del día, se emite la BOP y sale el inventario.</p>
          <div className="pj-hero-actions">
            <button onClick={() => onNavigate("distribucion")} className="pj-btn pri">Abrir Distribución <ArrowRight size={16}/></button>
            <button onClick={() => onNavigate("portal")} className="pj-btn">Ver Portal del usuario <Users size={16}/></button>
          </div>
        </div>
        <div className="pj-metric-panel">
          <div className="pj-metric"><span>Inventario físico</span><b>{num(glp.fisico)} kg</b><small>{num(kgALitros(glp.fisico))} L en los tanques de los CDT</small></div>
          <div className="pj-metric warn"><span>Comprometido</span><b>{num(glp.comprometido)} kg</b><small>{num(kgALitros(glp.comprometido))} L pagados y sin despachar: siguen en el CDT</small></div>
          <div className="pj-metric ok"><span>Disponible real</span><b>{num(glp.disponible)} kg</b><small>{num(kgALitros(glp.disponible))} L · físico menos comprometido</small></div>
          <div className="pj-mini-grid">
            <div><b>{num(dinero.pendienteDespacho.n)}</b><span>pedidos pagados pendientes por despachar</span></div>
            <div><b>{num(ad.enJornada)}</b><span>AD en jornada</span></div>
            <div><b>{num(replanificacion.n)}</b><span>pedidos por replanificar</span></div>
            <div><b>{num(dinero.porCompletar.n)}</b><span>pedidos por completar</span></div>
          </div>
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-title"><span>01</span><div><h2>Flujo operativo</h2><p>Un solo objeto —la solicitud— atraviesa el sistema. El pago no es la venta: la venta ocurre al cierre del AD.</p></div></div>
        <div className="pj-flow">
          <Paso icon={CircleDollarSign} n="1" t="Pide y paga" d="Desde el portal o en la taquilla. La API verifica el pago y aplica la regla: exacto o de más (el excedente queda a su favor), de menos (queda por completar) o referencia repetida (se rechaza)." />
          <Paso icon={Boxes} n="2" t="Pagada" d="El dinero queda pendiente por despachar y el GLP comprometido: sigue en el CDT, pero ya no está disponible para otra venta." />
          <Paso icon={ClipboardList} n="3" t="AD de jornada" d="Distribución planifica la jornada de cada comunidad sólo con pedidos pagados completos, con vehículo, conductor y ayudante disponibles." />
          <Paso icon={Users} n="4" t="Recolección" d="El día de la jornada cada persona lleva su bombona vacía al punto comunal. Quien no llegó o llevó una bombona no apta queda anotado con su motivo." />
          <Paso icon={Factory} n="5" t="Llenado en planta" d="Las bombonas recogidas se llenan en planta. La que está mala no se llena y vuelve vacía." />
          <Paso icon={Truck} n="6" t="Devolución al punto" d="Todas vuelven al mismo punto: llenas, o vacías si no se pudieron llenar. Salen diez, vuelven diez." />
          <Paso icon={FileText} n="7" t="Cierre del AD" d="Factura al precio del día de salida, BOP y salida de inventario; se quita el pendiente. Aquí termina la responsabilidad de GasLara." />
        </div>
        <div className="pj-aside">
          <RefreshCw size={18}/>
          <p><b>Si algo falla, el pedido no se pierde.</b> No estaba, no llevó su bombona, la bombona fue rechazada en el punto o en planta, llevó otro formato o falló la planta: el pedido pasa a <b>por replanificar</b> y Distribución lo atiende en un <b>AD especial por usuario</b>, con ruta por domicilio. El saldo a favor es el último recurso: sólo si la persona desiste, si Distribución decide no replanificar o si vence el ciclo.</p>
        </div>
      </section>

      <section className="pj-section pj-soft">
        <div className="pj-title"><span>02</span><div><h2>Problemas detectados y cómo los resuelve el sistema</h2><p>Se evita crear controles paralelos que terminen mostrando cifras distintas.</p></div></div>
        <div className="pj-problems">
          <Problema icon={Route} problema="La logística se arma en Excel y se reporta por WhatsApp" solucion="Distribución ve en una bandeja las comunidades con pedidos pagados, planifica la jornada con vehículo, conductor y ayudante disponibles y registra cada momento en el mismo sistema." />
          <Problema icon={TriangleAlert} problema="Pago y despacho pueden ocurrir en meses distintos" solucion="El pago deja el dinero pendiente por despachar y el GLP comprometido. La BOP, la salida de inventario y la factura nacen del cierre del AD: no existe una segunda salida manual." />
          <Problema icon={Gauge} problema="Inventario aparentemente descuadrado" solucion="Tres cifras en kg y litros: físico, comprometido y disponible real. El llenado de un AD queda por cerrar hasta su cierre: el mismo kilo nunca baja dos veces." />
          <Problema icon={RefreshCw} problema="La persona no estaba, no llevó su bombona o la bombona estaba mala" solucion="El pedido no se abona de una vez: pasa a por replanificar y Distribución lo atiende en un AD especial por usuario. El saldo a favor queda como último recurso." />
          <Problema icon={CircleDollarSign} problema="Los precios cambian cada mes" solucion="Siempre rige el precio actual. Si la tarifa sube mientras el pedido espera, queda por completar hasta cubrir la diferencia —primero con su saldo a favor, luego con una transferencia—, y la factura sale al precio del día en que salió el AD." />
          <Problema icon={ShieldCheck} problema="Conciliar pagos a mano frena el despacho" solucion="La API verifica cada pago y aplica la regla automática; nadie concilia a mano. La referencia repetida se rechaza sin tocar el saldo." />
          <Problema icon={Wallet} problema="El saldo a favor crecía sin control" solucion="El saldo es el menor posible: se descuenta solo en el próximo pedido y para cubrir diferencias. No hay reembolsos en efectivo y el tope es una bombona por núcleo familiar en cada ciclo." />
          <Problema icon={Landmark} problema="Cada pantalla mostraba su propia cifra" solucion="Una sola fuente de cifras: el panel, el cierre, los saldos, Distribución, el Centro de gestión y esta portada leen los mismos números." />
          <Problema icon={Scale} problema="Tratamiento fiscal de bombonas 10 y 18 kg" solucion="Uso residencial: exonerado de IVA. Uso comercial: gravado, aunque sea la misma presentación de 10 o 18 kg." />
          <Problema icon={BadgePercent} problema="Control de transporte EPSDC" solucion="La unidad asignada al AD identifica si el transporte fue propio o de una EPSDC; lo que se cierra con una EPSDC alimenta su resumen de venta transportada y el soporte del 30%." />
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-two">
          <article className="pj-module">
            <div className="pj-module-icon"><Building2 size={22}/></div>
            <div className="pj-kicker">MÓDULO DE COMERCIALIZACIÓN</div>
            <h2>Una sola fuente para ventas, saldos, inventario y cierre.</h2>
            <ul>
              <li><CheckCircle2/> Taquilla para quien llega sin usar el portal: se registra la solicitud y la regla de pago se aplica igual que en el portal.</li>
              <li><CheckCircle2/> Padrón con bitácora: la condición de pago (contado o crédito) y la tarifaria (regular, exonerado, protegido) se activan con su aval; exonerado y protegido vencen solos.</li>
              <li><CheckCircle2/> Libro de ventas con las facturas del cierre del AD, de los servicios de la O.A.U., del talonario y de las ventas sin contrato.</li>
              <li><CheckCircle2/> Pendiente por despachar y por completar con Base, IVA y total; inventario físico, comprometido y disponible en <b>kg y litros</b> (1 L = {factor} kg).</li>
              <li><CheckCircle2/> Saldos a favor: el menor posible; se descuentan solos en el próximo pedido y para cubrir diferencias de tarifa.</li>
              <li><CheckCircle2/> Cierre del período: lo que no se replanificó ni se completó pasa a saldo a favor, y queda el acta de cierre.</li>
            </ul>
            <button onClick={() => onNavigate("admin")} className="pj-link">Entrar a Comercialización <ArrowRight size={15}/></button>
          </article>

          <article className="pj-module comuna">
            <div className="pj-module-icon"><Network size={22}/></div>
            <div className="pj-kicker">PORTAL DEL USUARIO · ROL DE COMUNA</div>
            <h2>El ciudadano pide y paga; el coordinador de comuna consulta.</h2>
            <ul>
              <li><CheckCircle2/> El ciudadano pide su bombona, paga desde el portal y sigue su pedido paso a paso: {peldanos}.</li>
              <li><CheckCircle2/> Si transfirió de menos o subió la tarifa, el portal le dice cuánto le falta; si la jornada tuvo un problema, le avisa que su pedido se reprograma.</li>
              <li><CheckCircle2/> Una bombona por núcleo familiar en cada ciclo; su saldo a favor se descuenta solo en el próximo pedido.</li>
              <li><CheckCircle2/> El coordinador de comuna es un rol dentro del portal: consulta a los miembros de su comuna y cómo va su jornada.</li>
              <li><CheckCircle2/> La comuna no compra por sus miembros ni guarda bombonas: la responsabilidad de GasLara termina cuando la bombona vuelve al punto.</li>
            </ul>
            <button onClick={() => onNavigate("portal")} className="pj-link">Entrar al portal <ArrowRight size={15}/></button>
          </article>
        </div>
      </section>

      <section className="pj-section pj-soft">
        <div className="pj-title"><span>03</span><div><h2>Distribución · centro de la logística operativa</h2><p>La planificación nace de los pedidos pagados, agrupados por comunidad. Lo que falla en la jornada no se pierde: vuelve a la bandeja de replanificación.</p></div></div>
        <div className="pj-two">
          <article className="pj-module">
            <div className="pj-module-icon"><Route size={22}/></div>
            <div className="pj-kicker">MÓDULO DE DISTRIBUCIÓN</div>
            <h2>Del Excel y WhatsApp a una jornada registrada por momentos.</h2>
            <ul>
              <li><CheckCircle2/> Planifica la jornada de cada comunidad sólo con pedidos pagados completos; el vehículo se elige por placa y debe estar realmente disponible (certificación, póliza, mantenimiento y ayudante).</li>
              <li><CheckCircle2/> Registra cada momento: salida a recolección, recolección en el punto (quién no llevó su bombona y por qué), llenado en planta y devolución al mismo punto.</li>
              <li><CheckCircle2/> Cierra el AD cuando las bombonas vuelven al punto: ahí se factura lo entregado, se emite la BOP y sale el inventario.</li>
              <li><CheckCircle2/> Bandeja de replanificación con el motivo, el plazo (fin del ciclo) y la prioridad de cada caso; se resuelve en un AD especial por usuario.</li>
              <li><CheckCircle2/> Ve banco, referencia y fecha de pago para la trazabilidad, sin importes en bolívares.</li>
            </ul>
            <button onClick={() => onNavigate("distribucion")} className="pj-link">Entrar a Distribución <ArrowRight size={15}/></button>
          </article>
          <article className="pj-module comuna">
            <div className="pj-module-icon"><Truck size={22}/></div>
            <div className="pj-kicker">DATA COMPARTIDA · AL {fecha(HOY)}</div>
            <h2>{num(ad.cilindrosConvocados)} bombonas convocadas en {num(ad.activas)} AD activas.</h2>
            <ul>
              <li><CheckCircle2/> {num(ad.enJornada)} AD en jornada: en recolección, en planta o devueltas al punto.</li>
              <li><CheckCircle2/> {num(ad.porPlanificar)} comunidades con {num(ad.personasPorPlanificar)} pedidos pagados esperan su jornada.</li>
              <li><CheckCircle2/> {num(replanificacion.n)} pedidos por replanificar, {num(replanificacion.prioridad)} con prioridad por falla de la empresa.</li>
              <li><CheckCircle2/> {num(ad.entregadas)} pedidos entregados al cierre de un AD.</li>
              <li><CheckCircle2/> Comercialización, el portal y el Centro de gestión leen estas mismas cifras: no existe otra carga paralela.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-title"><span>04</span><div><h2>Nómina · backoffice interno del departamento</h2><p>Los trabajadores son expedientes administrados; no son usuarios del sistema.</p></div></div>
        <div className="pj-two">
          <article className="pj-module">
            <div className="pj-module-icon"><Calculator size={22}/></div>
            <div className="pj-kicker">DEPARTAMENTO DE NÓMINA</div>
            <h2>De carpetas, correo y Excel a un expediente digital calculable.</h2>
            <ul>
              <li><CheckCircle2/> Expediente digital completo: personal, laboral, seguridad social, familia, estudios, documentos y cuenta bancaria.</li>
              <li><CheckCircle2/> Novedades registradas por los administradores: reposos, permisos, horas extra, vacaciones, préstamos, juguetes, medicinas y uniformes.</li>
              <li><CheckCircle2/> Motor legal versionado para salario, vacaciones, prestaciones, anticipos, descuentos y aportes obligatorios.</li>
              <li><CheckCircle2/> Prestaciones sociales con cuenta individual, intereses mensuales, histórico, anticipos y estado de cuenta.</li>
              <li><CheckCircle2/> Nómina genera información contable por concepto y valida que débitos y créditos cuadren antes del cierre.</li>
            </ul>
            <button onClick={() => onNavigate("nomina")} className="pj-link">Entrar al Módulo de Nómina <ArrowRight size={15}/></button>
          </article>
          <article className="pj-module comuna">
            <div className="pj-module-icon"><FolderOpen size={22}/></div>
            <div className="pj-kicker">CONTROL ADMINISTRATIVO</div>
            <h2>El trabajador no llena formularios dentro del sistema.</h2>
            <ul>
              <li><CheckCircle2/> El Departamento de Nómina recibe la solicitud o soporte y realiza la carga.</li>
              <li><CheckCircle2/> Cada movimiento conserva usuario interno, fecha, origen y documento de respaldo.</li>
              <li><CheckCircle2/> Las reglas LOTTT permanecen bloqueadas; beneficios contractuales se mantienen separados y versionados.</li>
              <li><CheckCircle2/> Reportes: constancias, caja de ahorro, personal por ubicación, asistencia, permisos, vacaciones, utilidades y prestaciones.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="pj-section pj-soft">
        <div className="pj-title"><span>05</span><div><h2>Acceso a las caras del prototipo</h2><p>Cada vista representa un rol distinto dentro del mismo flujo y comparte los mismos datos.</p></div></div>
        <div className="pj-access">
          {accesos.map(({ id, titulo, sub, icon: Icon, tono }) => (
            <button key={id} className={`pj-access-card ${tono}`} onClick={() => onNavigate(id)}>
              <div className="pj-access-icon"><Icon size={21}/></div>
              <div><b>{titulo}</b><span>{sub}</span></div><ArrowRight size={18}/>
            </button>
          ))}
        </div>
      </section>

      <footer className="pj-foot">
        <img src={LOGO_LARA} alt="Gobierno de Lara"/><div><b>GasLara · Prototipo de distribución y comercialización</b><span>{CDTS.length} CDT · {COMUNAS.length} comunas · datos al {fecha(HOY)} · demostrativos, sin validez fiscal</span></div>
      </footer>
    </div>
  );
}

function Paso({ icon: Icon, n, t, d }) { return <div className="pj-step"><div className="pj-step-head"><span>{n}</span><Icon size={18}/></div><b>{t}</b><p>{d}</p></div>; }
function Problema({ icon: Icon, problema, solucion }) { return <div className="pj-problem"><div className="pj-pr-icon"><Icon size={18}/></div><div><span>PROBLEMA</span><b>{problema}</b><p><strong>Solución:</strong> {solucion}</p></div></div>; }

function Estilos(){return <style>{`
.pj{--ink:#112019;--mut:#65756d;--line:#dfe7e2;--bg:#f5f8f6;--green:#1f8a57;--greenw:#e8f6ef;--navy:#17372d;--amber:#b87318;--blue:#236d9d;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:#fff;min-height:calc(100vh - 46px)}.pj *{box-sizing:border-box}.pj button{font:inherit}.pj-hero{background:linear-gradient(135deg,#10251d 0%,#17372d 58%,#245c46 100%);padding:56px max(32px,calc((100vw - 1240px)/2));display:grid;grid-template-columns:minmax(0,1.25fr) 420px;gap:54px;color:#fff}.pj-logo{width:165px;filter:brightness(0) invert(1);margin-bottom:30px}.pj-eyebrow,.pj-kicker{font-size:10px;font-weight:800;letter-spacing:.11em;color:#76d4a4}.pj-hero h1{font-size:43px;line-height:1.08;letter-spacing:-1.5px;margin:10px 0 18px;max-width:760px}.pj-hero p{font-size:16px;line-height:1.7;color:#c9d9d2;max-width:760px;margin:0}.pj-hero-actions{display:flex;gap:10px;margin-top:28px}.pj-btn{border:1px solid #ffffff38;background:#ffffff0d;color:#fff;border-radius:9px;padding:11px 15px;font-weight:700;font-size:12.5px;display:flex;align-items:center;gap:8px;cursor:pointer}.pj-btn.pri{background:#fff;color:#163126;border-color:#fff}.pj-metric-panel{background:#0c1d17aa;border:1px solid #ffffff1f;border-radius:18px;padding:20px;align-self:center;box-shadow:0 22px 60px #0003}.pj-metric{padding:13px 14px;border-bottom:1px solid #ffffff17}.pj-metric span,.pj-metric small{display:block;color:#9db9ad}.pj-metric span{font-size:10px;text-transform:uppercase;letter-spacing:.08em}.pj-metric b{font-size:27px;display:block;margin:4px 0}.pj-metric small{font-size:11px}.pj-metric.warn b{color:#f3c476}.pj-metric.ok b{color:#74d8a5}.pj-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.pj-mini-grid div{background:#ffffff0c;border-radius:10px;padding:11px}.pj-mini-grid b,.pj-mini-grid span{display:block}.pj-mini-grid b{font-size:18px}.pj-mini-grid span{font-size:9.5px;color:#98aea5;margin-top:2px}.pj-section{padding:46px max(32px,calc((100vw - 1240px)/2))}.pj-section.pj-soft{background:var(--bg);border-top:1px solid #edf1ef;border-bottom:1px solid #edf1ef}.pj-title{display:flex;gap:14px;align-items:flex-start;margin-bottom:24px}.pj-title>span{width:34px;height:34px;border-radius:9px;background:var(--greenw);color:var(--green);display:grid;place-items:center;font-size:11px;font-weight:800}.pj-title h2{font-size:25px;letter-spacing:-.6px;margin:0 0 5px}.pj-title p{margin:0;color:var(--mut);font-size:13px}.pj-flow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.pj-step{border:1px solid var(--line);border-radius:13px;padding:15px;background:#fff;min-height:182px}.pj-step-head{display:flex;justify-content:space-between;color:var(--green);margin-bottom:18px}.pj-step-head span{font-size:10px;font-weight:800;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:var(--greenw)}.pj-step>b{display:block;font-size:14px}.pj-step p{font-size:11.3px;line-height:1.5;color:var(--mut);margin:7px 0 0}.pj-aside{display:flex;gap:12px;align-items:flex-start;margin-top:14px;padding:14px 16px;border-radius:13px;background:#fff8ec;border:1px solid #f1dfbd;color:#5f4312}.pj-aside svg{flex:none;margin-top:2px;color:var(--amber)}.pj-aside p{margin:0;font-size:12.5px;line-height:1.6}.pj-problems{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.pj-problem{display:flex;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px}.pj-pr-icon{width:35px;height:35px;border-radius:9px;background:#fff4e5;color:#a76511;display:grid;place-items:center;flex:none}.pj-problem span{font-size:8.5px;font-weight:800;letter-spacing:.09em;color:#a17642}.pj-problem b{display:block;font-size:13px;margin:2px 0 5px}.pj-problem p{font-size:11.4px;line-height:1.5;color:var(--mut);margin:0}.pj-problem strong{color:#2b453a}.pj-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pj-module{border:1px solid var(--line);border-radius:17px;padding:24px;background:#fff;box-shadow:0 10px 30px #1d392b0a}.pj-module.comuna{background:#f7fbf9}.pj-module-icon{width:44px;height:44px;border-radius:12px;background:#e9f2f8;color:var(--blue);display:grid;place-items:center;margin-bottom:18px}.pj-module.comuna .pj-module-icon{background:var(--greenw);color:var(--green)}.pj-module .pj-kicker{color:#4f7e68}.pj-module h2{font-size:23px;line-height:1.2;letter-spacing:-.5px;margin:7px 0 16px}.pj-module ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}.pj-module li{display:flex;gap:9px;font-size:12px;line-height:1.45;color:#52655c}.pj-module li svg{color:var(--green);width:15px;height:15px;flex:none;margin-top:1px}.pj-link{border:0;background:none;color:var(--green);font-weight:800;font-size:12px;display:flex;gap:7px;align-items:center;padding:0;margin-top:22px;cursor:pointer}.pj-access{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.pj-access-card{border:1px solid var(--line);background:#fff;border-radius:13px;padding:16px;text-align:left;display:grid;grid-template-columns:38px 1fr auto;gap:11px;align-items:center;cursor:pointer;color:var(--ink)}.pj-access-card:hover{transform:translateY(-1px);box-shadow:0 8px 24px #0000000b}.pj-access-icon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:#eef3f0;color:#49665a}.pj-access-card.az .pj-access-icon{background:#e8f1f8;color:#236d9d}.pj-access-card.vd .pj-access-icon{background:#e7f5ed;color:#238b59}.pj-access-card.am .pj-access-icon{background:#fff1df;color:#b87318}.pj-access-card.mo .pj-access-icon{background:#efeafb;color:#6852a1}.pj-access-card.gr .pj-access-icon{background:#edf1f4;color:#3a4f60}.pj-access-card b,.pj-access-card span{display:block}.pj-access-card b{font-size:12.5px}.pj-access-card span{font-size:10.3px;line-height:1.35;color:var(--mut);margin-top:3px}.pj-foot{padding:23px max(32px,calc((100vw - 1240px)/2));background:#10231c;color:#b5c8bf;display:flex;gap:13px;align-items:center}.pj-foot img{width:43px;background:#fff;border-radius:7px;padding:3px}.pj-foot b,.pj-foot span{display:block}.pj-foot b{font-size:12px;color:#fff}.pj-foot span{font-size:10px;margin-top:2px}
@media(max-width:1250px){.pj-flow{grid-template-columns:repeat(4,minmax(0,1fr))}.pj-access{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1050px){.pj-hero{grid-template-columns:1fr}.pj-metric-panel{max-width:650px}.pj-access{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.pj-hero,.pj-section,.pj-foot{padding-left:18px;padding-right:18px}.pj-hero{padding-top:36px}.pj-hero h1{font-size:32px}.pj-flow,.pj-problems,.pj-two,.pj-access{grid-template-columns:1fr}.pj-hero-actions{flex-direction:column}.pj-step{min-height:0}}
`}</style>}
