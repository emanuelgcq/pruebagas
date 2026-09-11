import React from "react";

/**
 * CAPA DE DISEÑO GLOBAL
 *
 * Cada módulo trae su propio bloque de estilos. En vez de reescribir seis hojas
 * distintas, esta capa define los tokens del sistema y corrige de forma transversal
 * lo que estaba mal: tipografías por debajo del mínimo legible, interlineado apretado,
 * celdas sin aire y bordes pesados.
 *
 * Los selectores llevan prefijo `body` a propósito: los estilos de cada módulo se
 * inyectan después en el DOM, así que hace falta un punto más de especificidad para
 * que estas reglas ganen sin recurrir a `!important` en todo.
 *
 * Criterios aplicados, tomados de las guías vigentes de diseño de producto:
 *  · Escala de espaciado de 8 pt — 4, 8, 12, 16, 24, 32, 48, 64.
 *  · Texto de interfaz de 13 px hacia arriba; cifra principal 28–32 px.
 *  · Interlineado 1,5 en texto corrido; 1,45 en celdas de tabla.
 *  · Filas de tabla de 48 px en densidad estándar, con 16 px de aire lateral.
 *  · Cifras tabulares para que las columnas numéricas no bailen al cambiar de valor.
 *  · Borde por sombra (0 0 0 1px) en vez de `border`, que no ocupa caja y se ve más fino.
 *  · La jerarquía la dan el peso y el espacio; el color queda reservado al estado.
 */
export default function Tema() {
  return <style>{`
:root{
  /* Neutros fríos: base del sistema */
  --n0:#FFFFFF; --n25:#FCFDFD; --n50:#F7F9FA; --n100:#F1F4F6; --n150:#E8EDF0;
  --n200:#DDE4E8; --n300:#C3CED5; --n400:#94A3AC; --n500:#6B7B85; --n600:#516069;
  --n700:#3A464E; --n800:#252F36; --n900:#141C21; --n950:#0B1216;

  /* Acento de marca */
  --br50:#EBF6F0; --br100:#D5EBE0; --br300:#7DC5A2; --br500:#2E9A63;
  --br600:#1F7A4C; --br700:#17623F; --br800:#124D32;

  /* Estado */
  --ok:#1B7A4C; --ok-bg:#E9F5EE; --ok-bd:#C6E4D4;
  --wr:#9A6410; --wr-bg:#FDF3E3; --wr-bd:#F0DDBB;
  --er:#A83E3E; --er-bg:#FBECEC; --er-bd:#F2D4D4;
  --in:#2A5FA6; --in-bg:#EAF1FA; --in-bd:#CBDCF0;

  /* Espaciado 8 pt */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px; --s8:64px;

  /* Radios */
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:20px; --r-full:999px;

  /* Borde por sombra: más fino que un border y no altera la caja */
  --ring:0 0 0 1px rgba(20,28,33,.09);
  --ring-str:0 0 0 1px rgba(20,28,33,.14);
  --sh-sm:0 1px 2px rgba(20,28,33,.05);
  --sh-md:0 2px 8px rgba(20,28,33,.06), 0 1px 2px rgba(20,28,33,.04);
  --sh-lg:0 8px 28px rgba(20,28,33,.10), 0 2px 6px rgba(20,28,33,.05);
  --sh-xl:0 24px 64px rgba(20,28,33,.18);

  --fs:"Inter","Segoe UI",system-ui,-apple-system,sans-serif;
  --fm:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:cubic-bezier(.4,0,.2,1);
}

body{
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeLegibility;
  background:var(--n100);
}

/* Red de seguridad tipográfica.
   Varias cifras grandes llevan tracking negativo en píxeles para verse compactas.
   Ese valor está calculado para 40 o 50 px, pero se hereda: un texto hijo de 12 px
   recibía el mismo ajuste y las letras terminaban montadas una sobre otra.
   Aquí se devuelve el tracking normal a todo texto pequeño anidado dentro de una
   cifra grande, sin tocar la cifra en sí. */
body .kpi-v em,body .kpi-v small,body .kpi-v span,
body .hero-num em,body .mv-big em,body .cg2-estado b em,
body .dx-fuente>b em,body .split-v em,body .split-v small,
body .oj-resumen b em,body .dp-k b em,body .cg2-k b em{
  letter-spacing:normal;
}
/* Ninguna etiqueta de interfaz debe quedar por debajo del umbral legible */
body small,body .u-doc,body .card-note{letter-spacing:0}

/* Las cifras no deben cambiar de ancho al cambiar de valor */
body .tbl,body .dx-table,body .nm-table,body .u360-table,body .cx-table table,
body .de-table table,body .cp2-scroll table,body .cg-perms table,
body .mono,body .dp-num,body .dx-kpi>b,body .cg2-k b,body .dp-k b{
  font-variant-numeric:tabular-nums;
}

/* ══════════ 1 · BARRA SUPERIOR ══════════ */
body .switcher{
  height:56px;padding:0 var(--s5);gap:var(--s5);
  background:var(--n950);border-bottom:0;box-shadow:inset 0 -1px 0 rgba(255,255,255,.07);
}
body .sw-marca{font-size:14px;letter-spacing:-.01em}
body .sw-tabs{background:rgba(255,255,255,.05);border-radius:var(--r-md);padding:var(--s1);gap:2px}
body .sw-tabs button{
  padding:var(--s2) var(--s3);font-size:13px;font-weight:500;border-radius:var(--r-sm);
  color:#9FB2AC;letter-spacing:-.005em;transition:background .15s var(--ease),color .15s var(--ease);
}
body .sw-tabs button:hover{background:rgba(255,255,255,.06);color:#EAF2EF}
body .sw-tabs button.on{background:var(--br500);color:#fff;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.25)}
body .sw-hint{font-size:12px;color:#7C8F89}

/* ══════════ 2 · BARRAS LATERALES ══════════ */
body .gl,body .dx,body .nm-shell,body .cg,body .cp2{grid-template-columns:264px 1fr}
body .gl .side,body .dx-side,body .nm-side,body .cg>aside,body .cp2>aside{
  padding:var(--s5) var(--s3);gap:var(--s4);
}
/* La navegación es lo único que puede desbordarse: se le da su propio scroll
   discreto para que el logo y el pie queden siempre fijos a la vista. */
body .gl .side nav,body .dx-side nav,body .nm-side nav,
body .cg>aside nav,body .cp2>aside nav{
  flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent;padding-right:2px;
}
body .gl .side nav::-webkit-scrollbar,body .dx-side nav::-webkit-scrollbar{width:5px}
body .gl .side nav::-webkit-scrollbar-thumb,body .dx-side nav::-webkit-scrollbar-thumb{
  background:rgba(255,255,255,.16);border-radius:var(--r-full);
}
body .gl .side nav::-webkit-scrollbar-track,body .dx-side nav::-webkit-scrollbar-track{background:transparent}

body .navbtn,body .dx-side nav button,body .nm-side nav button,
body .cg>aside nav button,body .cp2>aside nav button{
  padding:8px var(--s3);font-size:12.5px;font-weight:500;border-radius:var(--r-sm);
  gap:10px;line-height:1.3;letter-spacing:-.005em;min-height:34px;
  transition:background .15s var(--ease),color .15s var(--ease);
}
/* Marca y pie de la barra: no deben encogerse ni partirse */
body .brand,body .dx-brand,body .nm-brand,body .cg-brand,
body .side-foot,body .dx-rule,body .nm-side-foot,body .cg-note{flex:0 0 auto}
body .brand-sub{font-size:10.5px;letter-spacing:.06em;line-height:1.4;white-space:nowrap}
body .brand-img{width:138px}
body .navbtn:hover,body .dx-side nav button:hover,body .nm-side nav button:hover,
body .cg>aside nav button:hover,body .cp2>aside nav button:hover{background:rgba(255,255,255,.06)}
body .navbtn.on,body .dx-side nav button.on,body .nm-side nav button.on,
body .cg>aside nav button.on,body .cp2>aside nav button.on{font-weight:600}
body .navbadge,body .dx-side nav em,body .nm-side nav em{
  font-size:11px;font-weight:700;padding:2px 7px;border-radius:var(--r-full);min-width:20px;text-align:center;
}
body .gl .side nav,body .dx-side nav,body .nm-side nav{gap:2px}

/* Menú agrupado por oficio. El rótulo del grupo separa sin gritar: lo que orienta es
   el aire entre bloques, no el tamaño de la letra. */
body .navgrupo{display:flex;flex-direction:column;gap:2px}
body .navgrupo+.navgrupo{margin-top:var(--s4)}
body .navgrupo-h{
  font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  color:rgba(255,255,255,.34);padding:0 var(--s3) 6px;line-height:1.4;
}

/* ══════════ 3 · CABECERA DE PÁGINA ══════════ */
body .gl .top,body .dx-head,body .nm-header,body .cg>main>header,body .cp2>main>header{
  padding-bottom:var(--s4);margin-bottom:var(--s5);border-bottom:1px solid var(--n150);
}
body .gl .top h1,body .dx-head h1,body .nm-header h1,body .cg>main>header h1{
  font-size:26px;font-weight:650;letter-spacing:-.02em;line-height:1.2;
}
body .gl .top p,body .dx-head p{font-size:13.5px;color:var(--n500);line-height:1.5;margin-top:5px}
body .gl .body,body .dx-main,body .nm-main,body .cg>main{padding-bottom:var(--s7)}

/* ══════════ 4 · SUPERFICIES ══════════ */
body .card,body .dx-card,body .nm-card,body .cx-card,body .de-card,
body .cg-card,body .cp2-card,body .cg2-hero,body .dp-hero{
  border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-lg);
  background:var(--n0);padding:var(--s5);
}
body .card-h,body .dx-card-head,body .cx-head,body .de-title,body .cg-title{
  margin-bottom:var(--s4);gap:var(--s4);align-items:flex-start;
}
body .card-h h2,body .dx-card h2,body .nm-card h2,body .cx-card h3,
body .de-card>h2,body .de-title h2,body .cg-title h2{
  font-size:17px;font-weight:640;letter-spacing:-.015em;line-height:1.3;margin:0 0 5px;
}
body .card-note,body .dx-card-head p,body .de-title p,body .cg-title p{
  font-size:12.5px;line-height:1.55;color:var(--n500);margin:0;
}

/* ══════════ 5 · MÉTRICAS ══════════ */
body .kpis,body .dx-kpis,body .cx-kpis,body .de-kpis,body .cg-kpis,body .cp2-kpis,
body .nm-cards,body .cg2-kpis,body .dp-kpis{gap:var(--s3)}
body .kpi,body .dx-kpi,body .cx-k,body .de-kpis>div,body .cg-kpis>div,
body .cp2-kpis>div,body .nm-metric,body .cg2-k,body .dp-k{
  border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-md);
  padding:var(--s4);background:var(--n0);
}
body .kpi-l,body .dx-kpi>span,body .cx-k span,body .de-kpis span,
body .cg-kpis span,body .cp2-kpis span,body .cg2-k span,body .dp-k span{
  font-size:12px;color:var(--n500);font-weight:500;letter-spacing:0;line-height:1.4;
}
body .kpi-v,body .dx-kpi>b,body .cx-k b,body .de-kpis b,body .cg-kpis b,
body .cp2-kpis b,body .cg2-k b,body .dp-k b{
  font-size:27px;font-weight:640;letter-spacing:-.025em;line-height:1.15;margin:var(--s2) 0 var(--s1);
}
/* Un KPI que lleva las dos unidades tiene el doble de cifras: a 27 px se sale de la
   tarjeta. Baja de tamaño solo cuando el valor es un par kg·L, y puede partir en dos
   líneas antes que desbordar. */
body .cp2-kpis b:has(.kgl),body .cg2-k b:has(.kgl),body .dp-k b:has(.kgl),
body .dx-kpi>b:has(.kgl),body .kpi b:has(.kgl){
  font-size:19px;letter-spacing:-.01em;
}
body .dp-k b .kgl,body .cg2-k b .kgl,body .dx-kpi>b .kgl,body .kpi b .kgl{
  flex-wrap:wrap;white-space:normal;
}
body .dp-k,body .cg2-k,body .dx-kpi{min-width:0}
body .kpi-p,body .dx-kpi>small,body .cx-k small,body .de-kpis small,
body .cg-kpis small,body .cp2-kpis small,body .cg2-k small,body .dp-k small{
  font-size:12px;color:var(--n500);line-height:1.45;
}
body .split-box{border-radius:var(--r-md);padding:var(--s4)}
body .split-v{font-size:25px;letter-spacing:-.02em;line-height:1.2}
body .split-l{font-size:12px;color:var(--n500)}
body .split-p{font-size:12px;color:var(--n500);line-height:1.45;margin-top:var(--s1)}

/* ══════════ 6 · TABLAS — la corrección de fondo ══════════ */
/* Las tablas anchas se extienden hasta el borde de la tarjeta en vez de cortarse
   dentro del relleno: se gana el ancho de dos columnas antes de tener que desplazar. */
body .scroll,body .dx-table-wrap,body .cx-table,body .de-table,
body .u360-table-wrap,body .cp2-scroll,body .cg-perms{
  border:0;box-shadow:var(--ring);border-radius:var(--r-md);overflow:auto;background:var(--n0);
  scrollbar-width:thin;scrollbar-color:var(--n300) transparent;
}
body .card>.scroll,body .dx-card>.dx-table-wrap,body .cg2 .card>.scroll{
  margin-left:calc(var(--s5) * -1);margin-right:calc(var(--s5) * -1);
  margin-bottom:calc(var(--s5) * -1);border-radius:0 0 var(--r-lg) var(--r-lg);box-shadow:none;
  border-top:1px solid var(--n150);
}
body .scroll::-webkit-scrollbar,body .dx-table-wrap::-webkit-scrollbar{height:9px;width:9px}
body .scroll::-webkit-scrollbar-thumb,body .dx-table-wrap::-webkit-scrollbar-thumb{
  background:var(--n300);border-radius:var(--r-full);border:2px solid var(--n0);
}
body .scroll::-webkit-scrollbar-track{background:transparent}
body .tbl,body .dx-table,body .nm-table,body .cx-table table,
body .de-table table,body .cp2-scroll table,body .u360-table{
  font-size:13px;border-collapse:separate;border-spacing:0;width:100%;
}
body .tbl th,body .dx-table th,body .nm-table th,body .cx-table th,
body .de-table th,body .cp2-scroll th,body .u360-table th{
  padding:12px var(--s4);font-size:11px;font-weight:650;letter-spacing:.04em;
  text-transform:uppercase;color:var(--n500);background:var(--n50);
  border-bottom:1px solid var(--n150);white-space:nowrap;line-height:1.4;
  position:sticky;top:0;z-index:2;
}
body .tbl td,body .dx-table td,body .nm-table td,body .cx-table td,
body .de-table td,body .cp2-scroll td,body .u360-table td{
  padding:14px var(--s4);border-bottom:1px solid var(--n100);border-top:0;
  line-height:1.45;color:var(--n800);vertical-align:middle;
}
body .tbl tbody tr:last-child td,body .dx-table tbody tr:last-child td,
body .nm-table tbody tr:last-child td{border-bottom:0}
body .tbl tbody tr,body .dx-table tbody tr,body .nm-table tbody tr{transition:background .12s var(--ease)}
body .tbl tbody tr:hover,body .dx-table tbody tr:hover,body .nm-table tbody tr:hover{background:var(--n25)}

/* Las celdas apilaban nombre y referencia sin aire y partían palabras en tres líneas */
body .tbl td>b,body .dx-table td>b,body .u-name,body .dp-num{
  font-size:13px;font-weight:600;line-height:1.4;letter-spacing:-.005em;display:block;
}
body .tbl td>span,body .dx-table td>span,body .u-doc,body .nm-table td small{
  font-size:12px;color:var(--n500);line-height:1.4;margin-top:3px;display:block;
}
body .u-name.sm{font-size:13px}
body .c-name{font-size:13px;line-height:1.45}
body .mono{font-family:var(--fm);font-size:12.5px;letter-spacing:-.01em}
body .muted{color:var(--n400)}
body .tot td,body .tbl tfoot td,body .dx-table tfoot td{
  background:var(--n50);font-weight:650;border-top:2px solid var(--n200);border-bottom:0;padding:14px var(--s4);
}

/* Anchos mínimos: sin esto las columnas se estrangulan y el texto se parte */
body .cg2-libro th,body .cg2-libro td{min-width:88px}
body .cg2-libro th:nth-child(6),body .cg2-libro td:nth-child(6){min-width:190px}
body .cg2-libro th:nth-child(7),body .cg2-libro td:nth-child(7){min-width:170px}
body .cg2-libro th:nth-child(2),body .cg2-libro td:nth-child(2),
body .cg2-libro th:nth-child(3),body .cg2-libro td:nth-child(3){min-width:120px;white-space:nowrap}

/* ══════════ 7 · CONTROLES ══════════ */
body .btn,body .dx-primary,body .dx-secondary,body .cx-primary,body .cx-secondary,
body .nm-primary,body .nm-secondary,body .de-actions button,body .cp2-primary{
  border-radius:var(--r-sm);font-size:13px;font-weight:550;padding:9px 14px;
  letter-spacing:-.005em;transition:all .15s var(--ease);border:0;box-shadow:var(--ring);
  background:var(--n0);color:var(--n700);display:inline-flex;align-items:center;gap:7px;cursor:pointer;
}
body .btn:hover,body .dx-secondary:hover,body .cx-secondary:hover{
  background:var(--n50);box-shadow:var(--ring-str);color:var(--n900);
}
body .btn.primary,body .dx-primary,body .cx-primary,body .nm-primary,body .cp2-primary{
  background:var(--br700);color:#fff;box-shadow:0 1px 2px rgba(23,98,63,.3);
}
body .btn.primary:hover,body .dx-primary:hover,body .cx-primary:hover,body .nm-primary:hover{
  background:var(--br800);box-shadow:0 2px 8px rgba(23,98,63,.32);
}
body .btn.sm{font-size:12.5px;padding:7px 12px}
body .btn:disabled,body .dx-primary:disabled,body .cx-primary:disabled{opacity:.4;cursor:not-allowed;box-shadow:var(--ring)}
body .btn:focus-visible,body .dx-primary:focus-visible,body input:focus-visible,body select:focus-visible{
  outline:2px solid var(--br500);outline-offset:2px;
}
body .search,body .dx-search,body .cx-search,body .nm-search,body .cp2-search,body .cg-search,body .cg2 .search{
  border:0;box-shadow:var(--ring);border-radius:var(--r-sm);padding:8px 12px;
  background:var(--n0);min-width:270px;transition:box-shadow .15s var(--ease);
}
body .search:focus-within,body .dx-search:focus-within,body .cx-search:focus-within{box-shadow:0 0 0 1px var(--br300),0 0 0 4px var(--br50)}
body .search input,body .dx-search input,body .cx-search input,body .nm-search input{font-size:13px;color:var(--n800)}
body .search input::placeholder{color:var(--n400)}
body select,body .toolbar select,body .cx-toolbar select,body .dp-toolbar select,body .dp-select{
  border:0;box-shadow:var(--ring);border-radius:var(--r-sm);padding:8px 12px;
  font-size:13px;color:var(--n700);background:var(--n0);cursor:pointer;
}
body .campo span,body .dx-filters label span,body .dx-formgrid label span,
body .dp-modal label span,body .cg2-filtros label span{
  font-size:12px;color:var(--n600);font-weight:500;margin-bottom:6px;letter-spacing:0;
}
body .campo input,body .campo select,body .campo textarea,
body .dx-filters select,body .dx-formgrid input,body .dx-formgrid select,
body .dp-modal input,body .dp-modal select,body .dp-modal textarea,body .cg2-filtros select{
  border:0;box-shadow:var(--ring);border-radius:var(--r-sm);padding:10px 12px;font-size:13.5px;line-height:1.5;
}
body .toolbar,body .cx-toolbar,body .dp-toolbar{gap:var(--s2);flex-wrap:wrap}

/* ══════════ 8 · ETIQUETAS DE ESTADO ══════════ */
body .chip,body .tag,body .dx-tag,body .cx-status,body .nm-tag,body .cp2-chip,
body .dp-tag,body .dp-estado,body .pago-ok,body .u360-status,body .cg2-var{
  font-size:11.5px;font-weight:600;padding:5px 10px;border-radius:var(--r-full);
  letter-spacing:0;line-height:1.35;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;
}
body .tag.mini{font-size:10.5px;padding:3px 8px}
body .pri{font-size:11px;font-weight:700;padding:4px 9px;border-radius:var(--r-full)}

/* ══════════ 9 · AVISOS ══════════ */
body .inv-regla,body .cg2-regla,body .dp-regla,body .cg2-nota,body .dp-aclara,
body .cg2-correlativo,body .de-warning,body .nm-info-strip,body .cg-rule,
body .dx-flota-alerta,body .cg2-hint,body .dp-hint,body .aviso-pago{
  border:0;box-shadow:var(--ring);border-radius:var(--r-md);padding:14px var(--s4);gap:var(--s3);
}
body .cg2-regla>div>span,body .dp-regla>div>span,body .cg2-correlativo>div>span,
body .cg2-nota span,body .dp-aclara span,body .nm-info-strip span,body .cg-rule span{
  font-size:12.5px;line-height:1.6;display:block;
}
body .cg2-regla>div>b,body .dp-regla>div>b,body .cg2-correlativo>div>b{
  display:block;font-size:13.5px;margin-bottom:5px;line-height:1.4;
}
/* El título y la explicación de una regla son dos líneas, no una frase pegada. */
body .inv-regla>div>b{display:block;font-size:13.5px;margin-bottom:5px;line-height:1.4}
body .inv-regla>div>span{display:block;font-size:12.5px;line-height:1.6;color:var(--n500)}
/* Variante para lo que no cierra nada: informa, no confirma una operación. */
body .inv-regla.alt{background:var(--wr-bg)}
body .inv-regla.alt svg{color:var(--wr)}
body .inv-regla.alt>div>b{color:var(--wr)}
/* Aclaratoria dentro de un modal, entre los datos y el formulario. */
body .modal-nota{
  font-size:12.5px;color:var(--n500);line-height:1.6;margin:var(--s4) 0 var(--s3);
  padding-left:var(--s3);border-left:2px solid var(--n200);
}
body .campo>span>em.op{font-style:normal;font-weight:500;color:var(--n400);text-transform:none;letter-spacing:0}

/* ══════════ 10 · MODALES ══════════ */
body .overlay,body .dx-modal-bg,body .de-modal,body .u360-bg{
  background:rgba(11,18,22,.5);backdrop-filter:blur(6px);
}
body .modal,body .dx-wizard,body .dx-detail,body .dp-modal,body .de-modal>div,body .u360{
  border-radius:var(--r-xl);box-shadow:var(--sh-xl);border:0;
}
body .modal-h,body .dx-wizard>header,body .dp-modal>header,body .u360-head{
  padding:var(--s5);border-bottom:1px solid var(--n150);
}
body .modal-h h3,body .dx-wizard h2,body .dp-modal>header h2{font-size:19px;font-weight:640;letter-spacing:-.02em}
body .mh-eyebrow,body .dx-wizard header small,body .dp-modal>header small{
  font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--br600);
}
body .modal-b,body .dx-wizard>main,body .dp-modal>main{padding:var(--s5)}
body .modal-f,body .dx-wizard>footer,body .dp-modal>footer{
  padding:var(--s4) var(--s5);border-top:1px solid var(--n150);gap:var(--s2);background:var(--n25);
}

/* ══════════ 11 · CAJAS DE DETALLE ══════════ */
body .dx-summary-strip>div,body .dp-jornada>div,body .dp-ficha>div,body .dp-balance>div,
body .dp-arqueo>div,body .dp-usuarios>div,body .cg2-saldo-head>div,body .dx-confirm>div,
body .de-routehead>div,body .cx-opgrid>div,body .rec-meta>div{
  border-radius:var(--r-md);padding:var(--s3) var(--s4);background:var(--n50);box-shadow:none;border:0;
}
body .dx-summary-strip span,body .dp-jornada span,body .dp-ficha span,body .dp-balance span,
body .dp-arqueo span,body .dp-usuarios span,body .cg2-saldo-head span,body .dx-confirm span{
  font-size:11.5px;color:var(--n500);line-height:1.4;
}
body .dx-summary-strip b,body .dp-jornada b,body .dp-ficha b,body .cg2-saldo-head b,body .dx-confirm b{
  font-size:15px;font-weight:600;letter-spacing:-.01em;margin-top:5px;line-height:1.35;
}
body .dp-balance b,body .dp-arqueo b,body .dp-usuarios b{font-size:19px;font-weight:640;letter-spacing:-.02em;margin-top:5px}
body .dp-jornada small,body .dp-balance small{font-size:11.5px;color:var(--n500);margin-top:3px;line-height:1.4}

/* ══════════ 12 · GRÁFICOS DEL PANEL ══════════ */
body .cm-chart,body .cm-money-chart{
  border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-lg);padding:var(--s5);
}
body .cm-chart-head h3{font-size:16px;font-weight:640;letter-spacing:-.015em}
body .cm-chart-head p{font-size:12.5px;color:var(--n500);line-height:1.5;margin-top:4px}
body .cm-dash-metric{border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-md);padding:var(--s4)}
body .cm-dash-metric span{font-size:12px;color:var(--n500)}
body .cm-dash-metric b{font-size:26px;letter-spacing:-.025em;line-height:1.2;margin:var(--s2) 0 var(--s1)}
body .cm-dash-metric small{font-size:12px;color:var(--n500);line-height:1.45}
body .cm-dash-head h2{font-size:23px;font-weight:650;letter-spacing:-.02em}
body .cm-dash-eyebrow{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--br600)}
body .cm-legend span{font-size:11.5px;color:var(--n500)}

/* ══════════ 13 · PANELES DE ORIGEN Y NIVELES ══════════ */
body .dx-fuente,body .cg2-estado,body .dp-nivel{
  border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-md);padding:var(--s4);
  border-left:3px solid transparent;transition:box-shadow .15s var(--ease),transform .15s var(--ease);
}
body .dx-fuente:hover{box-shadow:var(--ring-str),var(--sh-md);transform:translateY(-1px)}
body .dx-fuente>span,body .cg2-estado>span,body .dp-nivel>span{font-size:11px;font-weight:700;letter-spacing:.045em}
body .dx-fuente>b,body .cg2-estado>b{font-size:29px;font-weight:650;letter-spacing:-.03em;line-height:1.15;margin:var(--s2) 0 var(--s1)}
body .dx-fuente>em{font-size:13px;color:var(--n600)}
body .dx-fuente>small,body .cg2-estado>small,body .dp-nivel>small{font-size:12px;color:var(--n500);line-height:1.5;margin-top:5px}

/* ══════════ 14 · PORTAL DEL CIUDADANO ══════════ */
body .pt{font-size:15px}
body .pt .side{width:272px}
body .nav-b{font-size:14.5px;padding:11px var(--s3);border-radius:var(--r-sm)}
body .pt .top h1{font-size:28px;letter-spacing:-.025em}
body .acceso{border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-md);padding:var(--s4);transition:all .15s var(--ease)}
body .acceso:hover{box-shadow:var(--ring-str),var(--sh-md);transform:translateY(-1px)}
body .acc-txt b{font-size:14.5px;letter-spacing:-.01em}
body .acc-txt span{font-size:13px;color:var(--n500);line-height:1.5;margin-top:3px}
body .ped,body .rec{border:0;box-shadow:var(--ring),var(--sh-sm);border-radius:var(--r-md);padding:var(--s4)}

/* ══════════ 15 · ESPACIADO DE CONTENIDO ══════════ */
body .dx-content,body .cg2,body .dp,body .nm-page,body .cx-page,body .de-page,body .cg-page{gap:var(--s4)}
body .dx-grid,body .dx-grid.two{gap:var(--s4)}
body .grid2,body .cg2-tres,body .dp-dos,body .cx-grid2{gap:var(--s4)}
body .cnt,body .dp-cnt{
  font-size:12px;font-weight:600;color:var(--n500);background:var(--n100);
  padding:2px 9px;border-radius:var(--r-full);margin-left:var(--s2);
}
/* Pestañas de módulo: agrupan lo que antes eran entradas de menú separadas */
body .doc-tabs{display:flex;gap:var(--s2);flex-wrap:wrap;margin-bottom:var(--s4)}
body .doc-tabs button{
  border:0;box-shadow:var(--ring);background:var(--n0);color:var(--n600);
  border-radius:var(--r-sm);padding:10px var(--s4);font-size:13px;font-weight:550;
  display:inline-flex;gap:8px;align-items:center;cursor:pointer;transition:all .15s var(--ease);
}
body .doc-tabs button:hover{background:var(--n50);color:var(--n900)}
body .doc-tabs button.on{background:var(--br700);color:#fff;box-shadow:0 1px 3px rgba(23,98,63,.28)}
body .doc-tabs em{
  font-style:normal;font-size:11.5px;font-weight:700;background:var(--n100);color:var(--n600);
  padding:2px 8px;border-radius:var(--r-full);
}
body .doc-tabs button.on em{background:rgba(255,255,255,.2);color:#fff}

/* Segmentos de filtro dentro de Solicitudes */
body .tabs.seg{display:flex;gap:var(--s1);flex-wrap:wrap;margin-bottom:var(--s4);background:var(--n100);padding:var(--s1);border-radius:var(--r-md)}
body .tabs.seg button{
  border:0;background:transparent;border-radius:var(--r-sm);padding:8px 12px;
  font-size:12.5px;font-weight:550;color:var(--n600);cursor:pointer;display:inline-flex;gap:7px;align-items:center;
}
body .tabs.seg button:hover{background:var(--n0)}
body .tabs.seg button.on{background:var(--n0);color:var(--br700);font-weight:650;box-shadow:var(--sh-sm)}
body .tabs.seg em{font-style:normal;font-size:11px;font-weight:700;color:var(--n400)}
body .tabs.seg button.on em{color:var(--br600)}

/* Panel de motivos de incidencia */
body .inc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--s3)}
body .inc-motivo{
  border:0;box-shadow:var(--ring);border-radius:var(--r-md);padding:var(--s4);
  border-left:3px solid var(--n300);position:relative;background:var(--n0);
}
body .inc-motivo.alta{border-left-color:var(--er)}
body .inc-motivo.media{border-left-color:var(--wr)}
body .inc-motivo.baja{border-left-color:var(--in)}
body .inc-motivo b{display:block;font-size:13px;font-weight:640;padding-right:var(--s6);line-height:1.35}
body .inc-motivo em{
  position:absolute;top:var(--s4);right:var(--s4);font-style:normal;
  font-size:19px;font-weight:700;color:var(--n700);font-variant-numeric:tabular-nums;
}
body .inc-motivo span{display:block;font-size:12px;color:var(--n500);line-height:1.55;margin-top:6px}
body .inc-motivo small{display:block;font-size:11.5px;color:var(--br600);font-weight:600;margin-top:8px}
body .inc-acciones{display:flex;gap:5px;align-items:center;justify-content:flex-end;flex-wrap:wrap}

/* Casos que la regla no cierra sola. Cada uno se lee completo sin abrir nada más:
   qué pasó, con qué solicitudes y qué hacer. */
body .pat-lista{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:var(--s3)}
body .pat{
  border:0;box-shadow:var(--ring);border-radius:var(--r-md);padding:var(--s4);
  border-left:3px solid var(--n300);background:var(--n0);display:flex;flex-direction:column;gap:var(--s2);
}
body .pat.alta{border-left-color:var(--er)}
body .pat.media{border-left-color:var(--wr)}
body .pat-h{display:flex;align-items:flex-start;gap:var(--s2);flex-wrap:wrap}
body .pat-h b{font-size:13px;font-weight:640;line-height:1.4;letter-spacing:normal;flex:1;min-width:180px}
body .pat p{font-size:12.5px;color:var(--n500);line-height:1.55;margin:0}
body .pat-sols{display:flex;gap:var(--s2);flex-wrap:wrap;align-items:center}
body .pat-sols .link{font-size:11.5px;padding:3px 8px;background:var(--n50);border-radius:var(--r-sm);text-decoration:none}
body .pat-sols .muted{font-size:11.5px}
body .pat footer{
  display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--br600);
  border-top:1px solid var(--n150);padding-top:var(--s2);margin-top:auto;line-height:1.45;
}
body .pat-mas{grid-column:1/-1;font-size:12px;padding-top:var(--s1);line-height:1.55}
/* Las tres cifras del inventario, cada una con sus dos unidades. */
body .inv-totales{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:var(--s3);
  margin-bottom:var(--s4);
}
body .inv-totales>div{background:var(--n0);box-shadow:var(--ring);border-radius:var(--r-md);padding:var(--s4)}
body .pat-grupo+.pat-grupo{margin-top:var(--s5)}
body .pat-grupo-h{display:flex;align-items:baseline;gap:var(--s2);flex-wrap:wrap;margin-bottom:var(--s3)}
body .pat-grupo-h b{font-size:13.5px;font-weight:650;letter-spacing:normal}
body .pat-grupo-h em{
  font-style:normal;font-size:12px;color:var(--n500);line-height:1.5;
  flex:1;min-width:220px;letter-spacing:normal;
}

body .paginador,body .dx-pagination{
  display:flex;justify-content:space-between;align-items:center;gap:var(--s4);
  padding:var(--s3) 0 0;margin-top:var(--s3);border-top:1px solid var(--n150);flex-wrap:wrap;
}
body .paginador>span,body .dx-pagination>span{font-size:12.5px;color:var(--n500)}
body .paginador>div,body .dx-pagination>div{display:flex;gap:var(--s2)}
body .empty,body .cg2-empty,body .dp-empty,body .u360-empty{
  font-size:13.5px;color:var(--n500);padding:var(--s7) var(--s4)!important;text-align:center;line-height:1.6;
}

/* ══════════ 16 · IMPRESIÓN ══════════ */
@media print{
  body .switcher,body .gl .side,body .dx-side,body .nm-side,body .cg>aside,body .cp2>aside,
  body .toolbar,body .dx-toolbar,body .search,body .btn,body .dx-primary,body .dx-secondary{display:none!important}
  body .card,body .dx-card{box-shadow:none;border:1px solid #ccc;break-inside:avoid}
  body{background:#fff}
}

/* ══════════ 17 · RESPONSIVO ══════════ */
@media(max-width:1200px){
  body .gl,body .dx,body .nm-shell,body .cg,body .cp2{grid-template-columns:232px 1fr}
}
@media(max-width:900px){
  body .switcher{height:auto;padding:var(--s2) var(--s3)}
  body .gl .top h1,body .dx-head h1{font-size:22px}
  body .kpi-v,body .dx-kpi>b{font-size:23px}
  body .card,body .dx-card,body .cg2-hero,body .dp-hero{padding:var(--s4)}
}
`}</style>;
}
