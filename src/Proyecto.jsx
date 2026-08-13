import React from "react";
import {
  ArrowRight, Building2, Users, Truck, Smartphone, Gauge, CircleDollarSign,
  ClipboardList, FileText, Receipt, Boxes, CheckCircle2, Clock3, ShieldCheck,
  Landmark, Route, Database, Scale, TriangleAlert, Network, BadgePercent, Calculator, FolderOpen,
} from "lucide-react";
import {
  LOGO_GASLARA, LOGO_LARA, CDTS, COMUNAS, USUARIOS, kgALitros, num,
  pagadasPendientesDe, diasEntre, HOY,
} from "./datos.jsx";

const accesos = [
  { id: "admin", titulo: "Comercialización", sub: "Inventario, recaudación pendiente, BOP, facturación, cierre y EPSDC", icon: Building2, tono: "az" },
    { id: "nomina", titulo: "Nómina", sub: "Backoffice interno: expedientes, cálculo legal, prestaciones, vacaciones y reportes", icon: Calculator, tono: "vd" },
  { id: "comuna", titulo: "Portal Comuna", sub: "Miembros, pagos individuales y bombonas pendientes de recibir", icon: Users, tono: "vd" },
  { id: "ops", titulo: "Operaciones", sub: "AD, reparto GasLara/EPSDC, firma y cierre físico", icon: Truck, tono: "am" },
  { id: "portal", titulo: "Portal del usuario", sub: "Solicitud, pago, estado del despacho y documentos", icon: Smartphone, tono: "mo" },
];

export default function Proyecto({ onNavigate, solicitudes, existencias, compromisos, disponibles }) {
  const pendientes = pagadasPendientesDe(solicitudes);
  const masAntiguo = pendientes.length ? Math.max(...pendientes.map((s) => diasEntre(s.pago?.fecha || s.fecha, HOY))) : 0;
  const fisico = Object.values(existencias).reduce((a, x) => a + x, 0);
  const comprometido = Object.values(compromisos).reduce((a, x) => a + x, 0);
  const disponible = Object.values(disponibles).reduce((a, x) => a + x, 0);
  const personas = USUARIOS.filter((u) => u.tipo === "Natural").length;

  return (
    <div className="pj">
      <Estilos />
      <section className="pj-hero">
        <div className="pj-hero-copy">
          <img src={LOGO_GASLARA} alt="GasLara" className="pj-logo" />
          <div className="pj-eyebrow">PROTOTIPO FUNCIONAL · DISTRIBUCIÓN Y COMERCIALIZACIÓN DE GLP</div>
          <h1>Un solo flujo para pago, inventario, comunas, despacho, facturación y control EPSDC.</h1>
          <p>El proyecto separa correctamente el momento en que una persona paga del momento en que el gas sale físicamente. Así el cierre no descuadra inventario aunque una bombona sea pagada hoy y entregada semanas después.</p>
          <div className="pj-hero-actions">
            <button onClick={() => onNavigate("admin")} className="pj-btn pri">Abrir Comercialización <ArrowRight size={16}/></button>
            <button onClick={() => onNavigate("comuna")} className="pj-btn">Ver Portal Comuna <Users size={16}/></button>
          </div>
        </div>
        <div className="pj-metric-panel">
          <div className="pj-metric"><span>Inventario físico</span><b>{num(fisico)} kg</b><small>{num(kgALitros(fisico))} L realmente almacenados</small></div>
          <div className="pj-metric warn"><span>Comprometido</span><b>{num(comprometido)} kg</b><small>pagado/asignado, todavía dentro de GasLara</small></div>
          <div className="pj-metric ok"><span>Disponible real</span><b>{num(disponible)} kg</b><small>físico menos compromisos</small></div>
          <div className="pj-mini-grid">
            <div><b>{pendientes.length}</b><span>recaudación pendiente de despacho</span></div>
            <div><b>{masAntiguo} d</b><span>espera más antigua</span></div>
            <div><b>{COMUNAS.length}</b><span>comunas registradas</span></div>
            <div><b>{personas}</b><span>personas en datos demo</span></div>
          </div>
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-title"><span>01</span><div><h2>Flujo operativo propuesto</h2><p>Un único evento maestro: el cierre real del AD después de la entrega.</p></div></div>
        <div className="pj-flow">
          <Paso icon={CircleDollarSign} n="1" t="Pago" d="La persona paga. El sistema verifica el pago y reserva la cantidad; no descuenta inventario físico." />
          <Paso icon={Boxes} n="2" t="Compromiso" d="El GLP sigue físicamente en el CDT, pero deja de estar disponible para otra venta." />
          <Paso icon={ClipboardList} n="3" t="Jornada comunal" d="Distribución consolida los pagos residenciales de cada comuna y programa una única entrega para todos sus miembros." />
          <Paso icon={Users} n="4" t="Comuna" d="GasLara o EPSDC entrega el lote completo al responsable comunal; luego la comuna distribuye cada bombona a la persona registrada." />
          <Paso icon={ShieldCheck} n="5" t="Cuadre automático" d="Antes del cierre se valida AD, pago, cantidad entregada y existencia física. Solo las excepciones se detienen." />
          <Paso icon={FileText} n="6" t="Cierre AD" d="Firma → BOP automática → salida física → factura → cierre mensual; si es EPSDC también alimenta su soporte 30%." />
        </div>
      </section>

      <section className="pj-section pj-soft">
        <div className="pj-title"><span>02</span><div><h2>Problemas detectados y cómo los resuelve el sistema</h2><p>Se evita crear controles paralelos que terminen mostrando cifras distintas.</p></div></div>
        <div className="pj-problems">
          <Problema icon={TriangleAlert} problema="Pago y despacho pueden ocurrir en meses distintos" solucion="El pago crea un compromiso; el inventario físico solo baja cuando el AD se entrega y cierra." />
          <Problema icon={Gauge} problema="Inventario aparentemente descuadrado" solucion="Comercialización muestra tres cifras: físico, comprometido y disponible real, en kg y litros." />
          <Problema icon={Clock3} problema="Personas pagadas esperando días o semanas" solucion="Nueva vista de Recaudación pendiente de despacho: muestra antigüedad, comuna, producto, kg/litros comprometidos, Base, IVA y Total ya cobrado." />
          <Problema icon={FileText} problema="Boleta y salida de inventario manuales" solucion="La BOP y el movimiento de inventario nacen del cierre del AD. No existe una segunda salida manual." />
          <Problema icon={Landmark} problema="Dos resúmenes distintos pueden duplicar el cierre" solucion="Se conserva una sola tabla de cierre mensual: cada fila separa entregado/facturado, recaudado aún no despachado y GLP físico despachado vs comprometido, manteniendo el IVA correcto." />
          <Problema icon={BadgePercent} problema="Control de transporte EPSDC" solucion="Cada AD cerrado por EPSDC alimenta automáticamente el resumen de venta transportada y el soporte del 30%." />
          <Problema icon={Scale} problema="Tratamiento fiscal de bombonas 10 y 18 kg" solucion="Uso residencial: exonerado de IVA. Uso comercial: gravado, aunque sea la misma presentación de 10 o 18 kg." />
          <Problema icon={ShieldCheck} problema="Un verificador obligatorio frenaría todos los despachos" solucion="El sistema hace cuadre automático. Si algo no cuadra, el AD queda con incidencia; los casos normales cierran solos." />
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-two">
          <article className="pj-module">
            <div className="pj-module-icon"><Building2 size={22}/></div>
            <div className="pj-kicker">MÓDULO DE COMERCIALIZACIÓN</div>
            <h2>Una sola fuente para ventas, inventario y cierre.</h2>
            <ul>
              <li><CheckCircle2/> Panel con ingresos, solicitudes pagadas, AD abiertas y alertas.</li>
              <li><CheckCircle2/> Inventario físico, comprometido y disponible en <b>kg y litros</b> (1 L = 0,540 kg).</li>
              <li><CheckCircle2/> Recaudación pendiente que puede cruzar al siguiente mes mostrando Base, IVA, Total y GLP comprometido sin forzar una salida de inventario.</li>
              <li><CheckCircle2/> BOP e inventario alimentados por el cierre físico del AD.</li>
              <li><CheckCircle2/> Una sola tabla de cierre: entregado/facturado, recaudado pendiente y GLP despachado vs comprometido por concepto; bombonas residenciales IVA 0% y comerciales IVA 16%.</li>
              <li><CheckCircle2/> Resumen EPSDC desde AD efectivamente transportados, no desde simples pagos.</li>
              <li><CheckCircle2/> Despachos parciales: lo entregado cierra; el saldo continúa pagado y pendiente.</li>
            </ul>
            <button onClick={() => onNavigate("admin")} className="pj-link">Entrar a Comercialización <ArrowRight size={15}/></button>
          </article>

          <article className="pj-module comuna">
            <div className="pj-module-icon"><Network size={22}/></div>
            <div className="pj-kicker">PORTAL DE USUARIO · ROL COMUNA</div>
            <h2>La comuna organiza la distribución; no compra por sus miembros.</h2>
            <ul>
              <li><CheckCircle2/> Cada persona pertenece a una comuna y a un CDT de abastecimiento.</li>
              <li><CheckCircle2/> El responsable comunal ve a todas las personas de su comuna.</li>
              <li><CheckCircle2/> Puede identificar quién pagó, quién no y quién tiene gas pagado pendiente de despacho.</li>
              <li><CheckCircle2/> Ve cuántas bombonas y kg deben llegar en la próxima recepción.</li>
              <li><CheckCircle2/> En residencial la empresa hace una sola entrega por jornada en la comuna; no reparte casa por casa. La trazabilidad conserva al usuario final.</li>
              <li><CheckCircle2/> Los datos demo priorizan personas naturales, que son la realidad predominante dentro de las comunas.</li>
            </ul>
            <button onClick={() => onNavigate("comuna")} className="pj-link">Entrar al Portal Comuna <ArrowRight size={15}/></button>
          </article>
        </div>
      </section>

      <section className="pj-section">
        <div className="pj-title"><span>03</span><div><h2>Nómina · backoffice interno del departamento</h2><p>Los trabajadores son expedientes administrados; no son usuarios del sistema.</p></div></div>
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
        <div className="pj-title"><span>04</span><div><h2>Acceso a los portales del prototipo</h2><p>Cada vista representa un rol distinto dentro del mismo flujo y comparte los mismos datos.</p></div></div>
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
        <img src={LOGO_LARA} alt="Gobierno de Lara"/><div><b>GasLara · Prototipo de proceso</b><span>{CDTS.length} CDT · {COMUNAS.length} comunas · datos demostrativos sin validez fiscal</span></div>
      </footer>
    </div>
  );
}

function Paso({ icon: Icon, n, t, d }) { return <div className="pj-step"><div className="pj-step-head"><span>{n}</span><Icon size={18}/></div><b>{t}</b><p>{d}</p></div>; }
function Problema({ icon: Icon, problema, solucion }) { return <div className="pj-problem"><div className="pj-pr-icon"><Icon size={18}/></div><div><span>PROBLEMA</span><b>{problema}</b><p><strong>Solución:</strong> {solucion}</p></div></div>; }

function Estilos(){return <style>{`
.pj{--ink:#112019;--mut:#65756d;--line:#dfe7e2;--bg:#f5f8f6;--green:#1f8a57;--greenw:#e8f6ef;--navy:#17372d;--amber:#b87318;--blue:#236d9d;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:var(--ink);background:#fff;min-height:calc(100vh - 46px)}.pj *{box-sizing:border-box}.pj button{font:inherit}.pj-hero{background:linear-gradient(135deg,#10251d 0%,#17372d 58%,#245c46 100%);padding:56px max(32px,calc((100vw - 1240px)/2));display:grid;grid-template-columns:minmax(0,1.25fr) 420px;gap:54px;color:#fff}.pj-logo{width:165px;filter:brightness(0) invert(1);margin-bottom:30px}.pj-eyebrow,.pj-kicker{font-size:10px;font-weight:800;letter-spacing:.11em;color:#76d4a4}.pj-hero h1{font-size:43px;line-height:1.08;letter-spacing:-1.5px;margin:10px 0 18px;max-width:760px}.pj-hero p{font-size:16px;line-height:1.7;color:#c9d9d2;max-width:760px;margin:0}.pj-hero-actions{display:flex;gap:10px;margin-top:28px}.pj-btn{border:1px solid #ffffff38;background:#ffffff0d;color:#fff;border-radius:9px;padding:11px 15px;font-weight:700;font-size:12.5px;display:flex;align-items:center;gap:8px;cursor:pointer}.pj-btn.pri{background:#fff;color:#163126;border-color:#fff}.pj-metric-panel{background:#0c1d17aa;border:1px solid #ffffff1f;border-radius:18px;padding:20px;align-self:center;box-shadow:0 22px 60px #0003}.pj-metric{padding:13px 14px;border-bottom:1px solid #ffffff17}.pj-metric span,.pj-metric small{display:block;color:#9db9ad}.pj-metric span{font-size:10px;text-transform:uppercase;letter-spacing:.08em}.pj-metric b{font-size:27px;display:block;margin:4px 0}.pj-metric small{font-size:11px}.pj-metric.warn b{color:#f3c476}.pj-metric.ok b{color:#74d8a5}.pj-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.pj-mini-grid div{background:#ffffff0c;border-radius:10px;padding:11px}.pj-mini-grid b,.pj-mini-grid span{display:block}.pj-mini-grid b{font-size:18px}.pj-mini-grid span{font-size:9.5px;color:#98aea5;margin-top:2px}.pj-section{padding:46px max(32px,calc((100vw - 1240px)/2))}.pj-section.pj-soft{background:var(--bg);border-top:1px solid #edf1ef;border-bottom:1px solid #edf1ef}.pj-title{display:flex;gap:14px;align-items:flex-start;margin-bottom:24px}.pj-title>span{width:34px;height:34px;border-radius:9px;background:var(--greenw);color:var(--green);display:grid;place-items:center;font-size:11px;font-weight:800}.pj-title h2{font-size:25px;letter-spacing:-.6px;margin:0 0 5px}.pj-title p{margin:0;color:var(--mut);font-size:13px}.pj-flow{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.pj-step{border:1px solid var(--line);border-radius:13px;padding:15px;background:#fff;min-height:182px}.pj-step-head{display:flex;justify-content:space-between;color:var(--green);margin-bottom:18px}.pj-step-head span{font-size:10px;font-weight:800;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:var(--greenw)}.pj-step>b{display:block;font-size:14px}.pj-step p{font-size:11.3px;line-height:1.5;color:var(--mut);margin:7px 0 0}.pj-problems{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}.pj-problem{display:flex;gap:12px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:15px}.pj-pr-icon{width:35px;height:35px;border-radius:9px;background:#fff4e5;color:#a76511;display:grid;place-items:center;flex:none}.pj-problem span{font-size:8.5px;font-weight:800;letter-spacing:.09em;color:#a17642}.pj-problem b{display:block;font-size:13px;margin:2px 0 5px}.pj-problem p{font-size:11.4px;line-height:1.5;color:var(--mut);margin:0}.pj-problem strong{color:#2b453a}.pj-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pj-module{border:1px solid var(--line);border-radius:17px;padding:24px;background:#fff;box-shadow:0 10px 30px #1d392b0a}.pj-module.comuna{background:#f7fbf9}.pj-module-icon{width:44px;height:44px;border-radius:12px;background:#e9f2f8;color:var(--blue);display:grid;place-items:center;margin-bottom:18px}.pj-module.comuna .pj-module-icon{background:var(--greenw);color:var(--green)}.pj-module .pj-kicker{color:#4f7e68}.pj-module h2{font-size:23px;line-height:1.2;letter-spacing:-.5px;margin:7px 0 16px}.pj-module ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}.pj-module li{display:flex;gap:9px;font-size:12px;line-height:1.45;color:#52655c}.pj-module li svg{color:var(--green);width:15px;height:15px;flex:none;margin-top:1px}.pj-link{border:0;background:none;color:var(--green);font-weight:800;font-size:12px;display:flex;gap:7px;align-items:center;padding:0;margin-top:22px;cursor:pointer}.pj-access{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.pj-access-card{border:1px solid var(--line);background:#fff;border-radius:13px;padding:16px;text-align:left;display:grid;grid-template-columns:38px 1fr auto;gap:11px;align-items:center;cursor:pointer;color:var(--ink)}.pj-access-card:hover{transform:translateY(-1px);box-shadow:0 8px 24px #0000000b}.pj-access-icon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:#eef3f0;color:#49665a}.pj-access-card.az .pj-access-icon{background:#e8f1f8;color:#236d9d}.pj-access-card.vd .pj-access-icon{background:#e7f5ed;color:#238b59}.pj-access-card.am .pj-access-icon{background:#fff1df;color:#b87318}.pj-access-card.mo .pj-access-icon{background:#efeafb;color:#6852a1}.pj-access-card b,.pj-access-card span{display:block}.pj-access-card b{font-size:12.5px}.pj-access-card span{font-size:10.3px;line-height:1.35;color:var(--mut);margin-top:3px}.pj-foot{padding:23px max(32px,calc((100vw - 1240px)/2));background:#10231c;color:#b5c8bf;display:flex;gap:13px;align-items:center}.pj-foot img{width:43px;background:#fff;border-radius:7px;padding:3px}.pj-foot b,.pj-foot span{display:block}.pj-foot b{font-size:12px;color:#fff}.pj-foot span{font-size:10px;margin-top:2px}
@media(max-width:1050px){.pj-hero{grid-template-columns:1fr}.pj-metric-panel{max-width:650px}.pj-flow{grid-template-columns:repeat(3,1fr)}.pj-access{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.pj-hero,.pj-section,.pj-foot{padding-left:18px;padding-right:18px}.pj-hero{padding-top:36px}.pj-hero h1{font-size:32px}.pj-flow,.pj-problems,.pj-two,.pj-access{grid-template-columns:1fr}.pj-hero-actions{flex-direction:column}.pj-step{min-height:0}}
`}</style>}
