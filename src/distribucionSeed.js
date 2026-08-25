/* ═══════════════════════════════════════════════════════════════════
   DISTRIBUCIÓN — DATA COMPARTIDA DE DEMOSTRACIÓN
   La planificación 14-08-2026 reproduce los cuadros suministrados.
   Distribución, Operaciones y Comercialización consumen esta misma fuente.
   ═══════════════════════════════════════════════════════════════════ */

export const FECHA_PLANIFICACION = new Date(2026, 7, 14);
export const FECHA_REPORTE = new Date(2026, 7, 13);

export const OPERADORES_DISTRIBUCION = [
  { id: "OP-FP-01", nombre: "José Manuel Rodríguez", cedula: "V-12.845.733", tipo: "FUERZA_PROPIA", activo: true },
  { id: "OP-FP-02", nombre: "Carlos Eduardo Pérez", cedula: "V-14.217.604", tipo: "FUERZA_PROPIA", activo: true },
  { id: "OP-FP-03", nombre: "Luis Alberto Mendoza", cedula: "V-10.934.285", tipo: "FUERZA_PROPIA", activo: true },
  { id: "OP-FP-04", nombre: "Rafael Antonio Torres", cedula: "V-16.208.491", tipo: "FUERZA_PROPIA", activo: true },
  { id: "OP-FP-05", nombre: "Miguel Ángel Castillo", cedula: "V-13.772.916", tipo: "FUERZA_PROPIA", activo: true, granel: true },
  { id: "OP-CE-01", nombre: "Pedro José Rivero", cedula: "V-15.406.822", tipo: "EPSDC", epsdc: "CERCADO", activo: true },
  { id: "OP-CE-02", nombre: "Julio César Silva", cedula: "V-11.628.394", tipo: "EPSDC", epsdc: "CERCADO", activo: true },
  { id: "OP-UN-01", nombre: "Andrés Felipe Vargas", cedula: "V-17.205.631", tipo: "EPSDC", epsdc: "UNION", activo: true },
];

// En el sistema nuevo la unidad se identifica por placa. El código anterior solo se conserva
// como referencia de migración de las hojas de trabajo existentes.
export const UNIDADES_DISTRIBUCION = [
  { id: "A73KD2", placa: "A73KD2", codigoInterno: "1521", tipo: "FUERZA_PROPIA", etiqueta: "Fuerza propia", capacidad: 1050, operadorDefault: "OP-FP-01" },
  { id: "B41MX8", placa: "B41MX8", codigoInterno: "1578", tipo: "FUERZA_PROPIA", etiqueta: "Fuerza propia", capacidad: 1050, operadorDefault: "OP-FP-02" },
  { id: "A92RT5", placa: "A92RT5", codigoInterno: "2115", tipo: "FUERZA_PROPIA", etiqueta: "Fuerza propia", capacidad: 1050, operadorDefault: "OP-FP-03" },
  { id: "C56NP1", placa: "C56NP1", codigoInterno: "1449", tipo: "FUERZA_PROPIA", etiqueta: "Fuerza propia", capacidad: 1050, operadorDefault: "OP-FP-04" },
  { id: "D18GL7", placa: "D18GL7", codigoInterno: "2388", tipo: "FUERZA_PROPIA", etiqueta: "Fuerza propia · granel", capacidad: 10000, granel: true, operadorDefault: "OP-FP-05" },
  { id: "E34CR9", placa: "E34CR9", codigoInterno: "3763", tipo: "EPSDC", etiqueta: "EPSDC Cercado", epsdc: "CERCADO", capacidad: 1050, operadorDefault: "OP-CE-01" },
  { id: "F21CE6", placa: "F21CE6", codigoInterno: "1", tipo: "EPSDC", etiqueta: "EPSDC Cercado", epsdc: "CERCADO", capacidad: 1050, operadorDefault: "OP-CE-02" },
  { id: "G85UN4", placa: "G85UN4", codigoInterno: "9078", tipo: "EPSDC", etiqueta: "EPSDC Unión", epsdc: "UNION", capacidad: 1050, operadorDefault: "OP-UN-01" },
];


const fila = (id, bloque, zona, ruta, comuna, comunidad, b10, b18, b27, b43, ad, unidad, ufa, faa, dias, parroquia = "") => ({
  id, bloque, zona, ruta, comuna, comunidad, parroquia, cilindros: { 10: b10, 18: b18, 27: b27, 43: b43 },
  ad: String(ad), unidad: String(unidad), ufa, faa, dias,
});

export const PLANIFICACION_1408 = [
  fila("JGB-13", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "13", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "LA LAGUNITA", 109, 11, 0, 2, 76892, 1, "12/07/2026", "14/08/2026", 33, "JOSÉ GREGORIO BASTIDAS"),
  fila("JGB-11", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "11", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "LA AGUADA", 88, 14, 0, 2, 76897, 1, "15/07/2026", "14/08/2026", 30, "JOSÉ GREGORIO BASTIDAS"),
  fila("JGB-12", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "12", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "TRES TOPIAS", 49, 9, 0, 0, 76902, 1, "11/07/2026", "14/08/2026", 34, "JOSÉ GREGORIO BASTIDAS"),
  fila("JGB-02", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "2", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "AGUA LINDA", 83, 10, 0, 0, 76881, 3763, "11/07/2026", "14/08/2026", 34, "JOSÉ GREGORIO BASTIDAS"),
  fila("JGB-16", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "16", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "COCO E MONO", 93, 30, 0, 1, 76883, 3763, "11/07/2026", "14/08/2026", 34, "JOSÉ GREGORIO BASTIDAS"),
  fila("JGB-17", "JOSÉ GREGORIO BASTIDAS", "J.G.B.1", "17", "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", "CONCEPCIÓN DOS CERROS", 35, 1, 0, 0, 76884, 1, "11/07/2026", "14/08/2026", 34, "JOSÉ GREGORIO BASTIDAS"),

  fila("TAM-09", "TAMACA", "5", "9", "CIRCUITO FUERZA REVOLUCIONARIA TAMACA", "SANTA CRUZ 1", 69, 9, 0, 0, 76536, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("TAM-10", "TAMACA", "5", "10", "CIRCUITO FUERZA REVOLUCIONARIA TAMACA", "SANTA CRUZ 2", 21, 5, 0, 2, 76537, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("TAM-01", "TAMACA", "6", "1", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "LAS PLAYITAS", 176, 13, 0, 14, 76539, 2115, "14/07/2026", "14/08/2026", 31, "TAMACA"),
  fila("TAM-02", "TAMACA", "6", "2", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "TOROY", 119, 13, 0, 2, 76540, 2115, "14/07/2026", "14/08/2026", 31, "TAMACA"),
  fila("TAM-03", "TAMACA", "6", "3", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "SANTA INÉS", 58, 5, 0, 0, 0, 1449, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("TAM-04", "TAMACA", "6", "4", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "SORAGE", 44, 0, 0, 0, 76542, 1449, "14/07/2026", "14/08/2026", 31, "TAMACA"),
  fila("TAM-05", "TAMACA", "6", "5", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "LA ESCALERA", 15, 0, 0, 1, 76543, 1449, "14/07/2026", "14/08/2026", 31, "TAMACA"),
  fila("TAM-06", "TAMACA", "6", "6", "LUCHADORES DE LA PATRIA DE BOLÍVAR Y CHÁVEZ", "PLAZUELA", 69, 1, 0, 0, 76544, 1449, "14/07/2026", "14/08/2026", 31, "TAMACA"),

  fila("INS-01", "INSTITUCIÓN", "", "", "INSTITUCIÓN", "GOBERNACIÓN", 250, 0, 0, 0, 0, 1521, "", "14/08/2026", 0, ""),

  fila("UNI-11", "UNIÓN", "3", "11", "ECOSOCIALISTA RENACIENDO CON 5 RAÍCES", "PEÑA 2 LA GRANJA", 286, 8, 0, 6, "75983-76759", 9078, "11/07/2026", "14/08/2026", 34, "UNIÓN"),
  fila("UNI-36", "UNIÓN", "3", "36", "ECOSOCIALISTA RENACIENDO CON 5 RAÍCES", "PEÑA 1 LAS FLORES", 138, 3, 0, 1, 0, 9078, "11/07/2026", "14/08/2026", 34, "UNIÓN"),

  fila("RES-01", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "RASTROJITOS CENTRO", 127, 54, 0, 17, 76527, 2115, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-02", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "DIVINO NIÑO", 116, 5, 0, 0, 76529, 2115, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-03", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "TULIPANES", 168, 2, 0, 0, 76521, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-04", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "TRINITARIAS", 50, 2, 0, 2, 76531, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-05", "RESGUARDOS", "5", "", "CIRCUITO FUERZA REVOLUCIONARIA TAMACA", "VALLE HONDO 1", 28, 16, 1, 3, 76533, 1449, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-06", "RESGUARDOS", "5", "", "CIRCUITO FUERZA REVOLUCIONARIA TAMACA", "VALLE HONDO 2", 85, 52, 0, 5, 76535, 1449, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-07", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "JOSÉ GREGORIO 1", 112, 18, 0, 2, 76522, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),
  fila("RES-08", "RESGUARDOS", "5", "", "FUERZAS REVOLUCIONARIAS", "JOSÉ GREGORIO 2", 71, 13, 0, 0, 76524, 1521, "13/07/2026", "14/08/2026", 32, "TAMACA"),

  fila("COM-01", "COMERCIO", "", "", "COMERCIO", "ZONA CENTRO / UNIÓN", 5, 12, 0, 40, 76988, 1521, "", "14/08/2026", 0, ""),
  fila("COM-02", "COMERCIO", "", "", "COMERCIO", "ZONA PALAVECINO", 0, 4, 0, 8, 76987, 1521, "", "14/08/2026", 0, ""),
];

export const BLOQUES_PLANIFICACION = ["JOSÉ GREGORIO BASTIDAS", "TAMACA", "INSTITUCIÓN", "UNIÓN", "RESGUARDOS", "COMERCIO"];

export const cilindrosFila = (r) => Object.values(r.cilindros).reduce((a, b) => a + Number(b || 0), 0);
export const kgFila = (r) => Number(r.cilindros[10] || 0) * 10 + Number(r.cilindros[18] || 0) * 18 + Number(r.cilindros[27] || 0) * 27 + Number(r.cilindros[43] || 0) * 43;
// Equivalencia nominal utilizada en las hojas Excel suministradas: 20/36/54/86 litros por cilindro.
export const litrosNominalesFila = (r) => Number(r.cilindros[10] || 0) * 20 + Number(r.cilindros[18] || 0) * 36 + Number(r.cilindros[27] || 0) * 54 + Number(r.cilindros[43] || 0) * 86;
export const litrosInventarioFila = (r) => kgFila(r) / 0.540;

export const unidadDistribucion = (id) => UNIDADES_DISTRIBUCION.find((u) => u.id === String(id) || u.placa === String(id) || u.codigoInterno === String(id)) || { id: String(id || ""), placa: String(id || ""), tipo: "POR_ASIGNAR", etiqueta: "Por asignar", capacidad: 0 };
export const operadorDistribucion = (id) => OPERADORES_DISTRIBUCION.find((o) => o.id === String(id)) || { id: String(id || ""), nombre: "Por asignar", cedula: "—", tipo: "POR_ASIGNAR" };
export const operadoresParaUnidad = (unidadId) => {
  const u = unidadDistribucion(unidadId);
  return OPERADORES_DISTRIBUCION.filter((o) => o.activo && o.tipo === u.tipo && (u.tipo !== "EPSDC" || o.epsdc === u.epsdc));
};

export const resumenPlanificacion = (filas = PLANIFICACION_1408) => {
  const total = filas.reduce((a, r) => a + cilindrosFila(r), 0);
  const fuerza = filas.filter((r) => unidadDistribucion(r.unidad).tipo === "FUERZA_PROPIA").reduce((a, r) => a + cilindrosFila(r), 0);
  const epsdc = filas.filter((r) => unidadDistribucion(r.unidad).tipo === "EPSDC").reduce((a, r) => a + cilindrosFila(r), 0);
  const kg = filas.reduce((a, r) => a + kgFila(r), 0);
  const litrosNominales = filas.reduce((a, r) => a + litrosNominalesFila(r), 0);
  return { total, fuerza, epsdc, pctFuerza: total ? fuerza / total * 100 : 0, pctEpsdc: total ? epsdc / total * 100 : 0,
    kg, litrosInventario: kg / 0.540, litrosNominales };
};

export const RESUMEN_PLAN_1408 = resumenPlanificacion();

export const crearAsignacionesIniciales = () => PLANIFICACION_1408.map((r) => {
  const u = unidadDistribucion(r.unidad);
  const op = operadorDistribucion(u.operadorDefault);
  return {
    ...r,
    unidadCodigoInterno: String(r.unidad),
    unidad: u.placa,
    placa: u.placa,
    operadorId: op.id,
    conductor: op.nombre,
    conductorCedula: op.cedula,
    transportistaTipo: u.tipo,
    epsdc: u.epsdc || null,
    estadoRuta: ((!r.ad || String(r.ad) === "0") && !["INSTITUCIÓN", "COMERCIO"].includes(r.bloque)) ? "SIN_PLANIFICAR" : "ASIGNADA",
    horaSalida: null,
    horaEntrega: null,
  };
});

/* Control individual de una comuna: la planificación sale consolidada, pero el sistema conserva
   todas las personas registradas y el estado de pago para saber quién entra al AD.

   Los datos personales de demostración se generan con un serial global único. De esta forma,
   aunque existan miles de pedidos, no se repiten nombres completos ni cédulas entre comunidades. */
const NOMBRES_PERSONA = [
  "MARÍA ALEJANDRA","JOSÉ ANTONIO","CARMEN ELENA","LUIS EDUARDO","ANA CAROLINA","CARLOS ANDRÉS","YOLIMAR JOSEFINA","PEDRO JOSÉ",
  "ROSA ELENA","RAMÓN ANTONIO","LUZ MARINA","MIGUEL ÁNGEL","NELLY CAROLINA","JESÚS ALBERTO","GLADYS MARÍA","JULIO CÉSAR",
  "MARITZA COROMOTO","RAFAEL JOSÉ","ELENA MARÍA","JORGE LUIS","MARÍA TERESA","JUAN CARLOS","ANGÉLICA MARÍA","FRANCISCO JAVIER",
  "DANIELA ALEJANDRA","MANUEL ALEJANDRO","MARIANELA JOSEFINA","RICARDO JOSÉ","ANDREA CAROLINA","EDGAR RAMÓN","KARLA ANDREÍNA","HÉCTOR LUIS",
  "VERÓNICA DEL VALLE","WILMER JOSÉ","YENNY CAROLINA","ALEXANDER JOSÉ","GÉNESIS MARÍA","JONATHAN EDUARDO","MAYERLING JOSEFINA","OSCAR ALBERTO",
  "MARÍA GABRIELA","JOSÉ GREGORIO","LEIDY CAROLINA","ÁNGEL DAVID","MÓNICA ALEJANDRA","FREDDY ANTONIO","DAYANA CAROLINA","EDUARDO JOSÉ",
  "MARÍA FERNANDA","JOSÉ LUIS","BEATRIZ ELENA","VICTOR MANUEL","SANDRA PATRICIA","GERARDO ANTONIO","DUBRASKA JOSEFINA","REINALDO JOSÉ",
  "MARÍA EUGENIA","JOSÉ MIGUEL","IRIS COROMOTO","ALBERTO JOSÉ","NORKA BEATRIZ","ROBERTO CARLOS","ARIANNA MARÍA","SAMUEL DAVID"
];
const APELLIDOS_PERSONA = [
  "GONZÁLEZ","PÉREZ","RODRÍGUEZ","HERNÁNDEZ","MENDOZA","CASTILLO","TORRES","SILVA",
  "FLORES","VARGAS","MEDINA","GUTIÉRREZ","RIVAS","LÓPEZ","COLMENÁREZ","SUÁREZ",
  "RIVERO","MORA","QUINTERO","MARTÍNEZ","GARCÍA","RAMÍREZ","DÍAZ","ROJAS",
  "SÁNCHEZ","BRICEÑO","CAMACHO","PARRA","MONTILLA","ESCALONA","ALVARADO","AGUILAR",
  "MORALES","BARRIOS","SALAZAR","PERDOMO","CARRASCO","JIMÉNEZ","ARTEAGA","OROPEZA",
  "SEQUERA","LINARES","MELÉNDEZ","INFANTE","ACOSTA","MÁRQUEZ","GUERRERO","VELÁSQUEZ",
  "FREITEZ","MOLINA","NAVARRO","PACHECO","CARDOZO","VILLANUEVA","CHIRINOS","APONTE",
  "ESCALANTE","MÉNDEZ","GUEVARA","ZAMBRANO","BUSTAMANTE","DELGADO","LEAL","NÚÑEZ"
];

const extraSinPagoDeRuta = (r) => Math.min(10, Math.max(2, Math.round(cilindrosFila(r) * 0.02)));
const esRutaPersonas = (r) => !["INSTITUCIÓN", "COMERCIO"].includes(r.bloque);
const baseSerialRuta = (r) => {
  const idx = PLANIFICACION_1408.findIndex((x) => x.id === r.id);
  if (idx <= 0) return 0;
  return PLANIFICACION_1408.slice(0, idx).filter(esRutaPersonas)
    .reduce((acc, x) => acc + cilindrosFila(x) + extraSinPagoDeRuta(x), 0);
};
const personaDemo = (serial) => {
  // 262144 = 64³. Como 13849 es impar, esta permutación es biyectiva en ese rango.
  // Por eso un serial distinto produce una combinación de nombre y apellidos distinta.
  const p = ((serial * 13849) + 7919) % 262144;
  const nombre = NOMBRES_PERSONA[p & 63];
  const apellido1 = APELLIDOS_PERSONA[(p >> 6) & 63];
  const apellido2 = APELLIDOS_PERSONA[(p >> 12) & 63];
  const ci = 6_000_000 + (((serial * 7919) + 123457) % 23_000_000);
  return {
    nombre: `${nombre} ${apellido1} ${apellido2}`,
    cedula: `V-${String(ci).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`,
  };
};

export const BENEFICIARIOS_JGB = Array.from({ length: 547 }, (_, i) => {
  const pagado = i < 537;
  const persona = personaDemo(10_000 + i);
  const comunidades = [
    ["LA LAGUNITA", 122], ["LA AGUADA", 104], ["TRES TOPIAS", 58], ["AGUA LINDA", 93], ["COCO E MONO", 124], ["CONCEPCIÓN DOS CERROS", 36],
  ];
  let pos = i, comunidad = "CONCEPCIÓN DOS CERROS";
  for (const [c, n] of comunidades) { if (pos < n) { comunidad = c; break; } pos -= n; }
  return {
    id: `JGB-U-${String(i + 1).padStart(4, "0")}`,
    nombre: persona.nombre,
    cedula: persona.cedula,
    comuna: "COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA",
    comunidad,
    pagado,
    pago: pagado ? `PAGO-${String(930000 + i)}` : null,
    estadoPago: pagado ? "PAGO VERIFICADO" : "SIN PAGO",
    incluidoAD: pagado,
  };
});

export const REPORTE_1308 = {
  cdt: "C.D.T. GRAL. JACINTO LARA",
  fecha: "13-08-2026",
  nivelInicio: 11,
  nivelCierre: null,
  fuerzaPropia: ["1449", "1578", "2115", "1521", "2388 · GRANEL"],
  epsdc: ["UNIÓN · 01", "CERCADO · 02", "CAMILO CIEN FUEGO · 00"],
  autogestion: 0,
  municipios: [
    { municipio: "IRIBARREN", parroquias: [
      { parroquia: "UNIÓN", comunas: [
        { comuna: "ECOSOCIALISTA ÁNGEL MARÍA COLMENÁREZ", comunidades: ["BARRIO LA PEÑA SECTOR 2 UNIDOS · 248", "LA PEÑA SECTOR 3 VENCEDORES · 321"], cilindros: {10:561,18:8,27:0,43:0}, total:569 },
      ]},
      { parroquia: "TAMACA", comunas: [
        { comuna: "GENERAL PEDRO ZARAZA", comunidades: ["SÁBILA 4 NEGRO ANDRESOTE · 122", "SÁBILA 4 CAMILO CIEN FUEGOS · 133", "PAMPERO · 168", "LOS LIBERTADORES · 235", "VICENTE RIVERO · 87"], cilindros:{10:665,18:71,27:0,43:9}, total:745 },
        { comuna: "FUERZAS REVOLUCIONARIAS", comunidades:["LOS PINOS · 85"], cilindros:{10:85,18:0,27:0,43:0}, total:85 },
        { comuna: "CIRCUITO FUERZA REVOLUCIONARIA TAMACA", comunidades:["BICENTENARIO · 13"], cilindros:{10:13,18:0,27:0,43:0}, total:13 },
      ]},
    ]},
    { municipio: "PALAVECINO", parroquias: [
      { parroquia: "CABUDARE", comunas: [
        { comuna:"COMUNA LA CEIBA DE CABUDARE", comunidades:["URBANIZACIÓN RIBEREÑA 2 · 50", "URBANIZACIÓN RIBEREÑA 3 · 05", "URBANIZACIÓN VILLA TABURE 2 · 19", "URBANIZACIÓN DIVINA PASTORA · 05", "URBANIZACIÓN VILLA TABURE 1 · 25"], cilindros:{10:28,18:67,27:0,43:9}, total:104 },
      ]},
      { parroquia: "JOSÉ GREGORIO BASTIDAS", comunas: [
        { comuna:"COMUNA LA MORITA", comunidades:["LOMA REDONDA · 29", "LA MORITA · 13", "QUEBRADA SECA · 21", "LA NUEVA MORITA · 47"], cilindros:{10:110,18:0,27:0,43:0}, total:110 },
        { comuna:"COMUNA CHAVISTA EZEQUIEL ZAMORA AGROPRODUCTIVA", comunidades:["ALIANZA POPULAR · 54", "CERRO MUERTO VALLE EL TITIARAL · 49"], cilindros:{10:84,18:18,27:0,43:1}, total:103 },
      ]},
    ]},
  ],
  especiales: {
    exonerados: {10:107,15:18,18:1,21:0,27:0,43:1,total:127},
    instituciones: {10:105,15:0,18:24,21:0,27:0,43:27,total:156},
    comercial: {10:1,15:0,18:4,21:0,27:0,43:7,total:12},
    residencial: {10:1551,18:165,27:0,43:21,total:1737},
    total: {10:1764,15:18,18:194,21:0,27:0,43:56,total:2032},
  },
  familias: 1737,
  comunidades: 20,
  institucionesDetalle: [
    ["POLILARA",124],["FUERTE TEREPAIMA",12],["TRANSBARCA",6],["PNB FERROVIARIO",2],["PNB",2],
    ["CIRCUNSCRIPCIÓN MILITAR",1],["DERECHOS FUNDAMENTALES DE LA MUJER",2],["PNB UNIÓN",3],["PNB ANA SOTO",2],["PNB",2],
  ],
  granel: {
    residencial: [
      ["RUEZGA 2 BLOQUE 18",665],["RUEZGA 2 BLOQUE 20",840],["RUEZGA 2 BLOQUE 19",500],["PARQUE VIVIENDO HUGO CHÁVEZ",1600],
    ],
    comercial: [
      ["CORRUGADORA LARA",1000],["PANIFICADORA PAN CELESTIAL",500],["CECOSESOLA",1200],["POLLO LA 33",380],["PND LA CASCADA",200],["PND FOCACCIA",450],["BRASAMAL Y COPAS",1634],
    ],
  },
};

export function reporteWhatsApp1308() {
  const r = REPORTE_1308;
  const lineas = [
    `*${r.cdt}*`, `*REPORTE DE DISTRIBUCIÓN*`, `FECHA: ${r.fecha}`,
    `NIVELES DE INICIO: ${r.nivelInicio}%`, `NIVELES DE CIERRE: ${r.nivelCierre ?? "—"}%`, "",
    `*FUERZA PROPIA* · ${r.fuerzaPropia.join(" · ")}`,
    `*EPSDC* · ${r.epsdc.join(" · ")}`, `AUTOGESTIÓN: ${r.autogestion}`, "",
  ];
  for (const m of r.municipios) {
    lineas.push(`🚩 *MUNICIPIO: ${m.municipio}*`);
    for (const p of m.parroquias) {
      lineas.push(`PARROQUIA: ${p.parroquia}`);
      for (const c of p.comunas) {
        lineas.push(`COMUNA: ${c.comuna}`);
        c.comunidades.forEach((x, i) => lineas.push(`${i + 1}. ${x}`));
        lineas.push(`10KG: ${c.cilindros[10] || 0} · 18KG: ${c.cilindros[18] || 0} · 27KG: ${c.cilindros[27] || 0} · 43KG: ${c.cilindros[43] || 0}`);
        lineas.push(`TOTAL CILINDROS DE COMUNA: ${c.total}`, "");
      }
    }
  }
  const e = r.especiales;
  lineas.push(`🚩 *CILINDROS EXONERADOS* · 10KG ${e.exonerados[10]||0} · 15KG ${e.exonerados[15]||0} · 18KG ${e.exonerados[18]||0} · 43KG ${e.exonerados[43]||0} · TOTAL ${e.exonerados.total}`);
  lineas.push(`🚩 *INSTITUCIONES*`);
  r.institucionesDetalle.forEach((x,i)=>lineas.push(`${i+1}. ${x[0]} · ${x[1]}`));
  lineas.push(`10KG ${e.instituciones[10]||0} · 18KG ${e.instituciones[18]||0} · 43KG ${e.instituciones[43]||0} · TOTAL ${e.instituciones.total}`);
  lineas.push(`🚩 *CILINDROS COMERCIAL* · TOTAL ${e.comercial.total}`);
  lineas.push(`🚩 *CILINDROS RESIDENCIAL* · TOTAL ${e.residencial.total}`);
  lineas.push(`🚩 *TOTAL CILINDROS DISTRIBUIDOS: ${e.total.total}*`);
  lineas.push(`TOTAL FAMILIAS: ${r.familias} · TOTAL COMUNIDADES: ${r.comunidades}`, "");
  const gr = r.granel.residencial.reduce((a,x)=>a+x[1],0), gc = r.granel.comercial.reduce((a,x)=>a+x[1],0);
  lineas.push(`🚛 *GRANEL* · Residencial ${gr.toLocaleString("es-VE")} L · Comercial ${gc.toLocaleString("es-VE")} L`);
  return lineas.join("\n");
}

export function beneficiariosDeRuta(r) {
  if (r.bloque === "INSTITUCIÓN" || r.bloque === "COMERCIO") return [];
  const filas = [];
  const serialBase = baseSerialRuta(r);
  let n = 0;
  for (const kg of [10, 18, 27, 43]) {
    const cant = Number(r.cilindros[kg] || 0);
    for (let j = 0; j < cant; j++) {
      const i = n++;
      const adActivo = r.estadoRuta !== "SIN_PLANIFICAR" && r.ad && String(r.ad) !== "0";
      const hh = String(7 + ((i * 7 + r.id.length) % 6)).padStart(2, "0");
      const mm = String((i * 13 + r.id.length * 3) % 60).padStart(2, "0");
      filas.push({
        id: `${r.id}-U-${String(i + 1).padStart(4, "0")}`,
        pedidoId: `PED-${r.id}-${String(i + 1).padStart(4, "0")}`,
        fechaPedido: "14/08/2026", horaPedido: `${hh}:${mm}`,
        nombre: personaDemo(serialBase + i).nombre,
        cedula: personaDemo(serialBase + i).cedula,
        comuna: r.comuna, comunidad: r.comunidad, parroquia: r.parroquia, rutaId: r.id,
        cantidad: 1, kg, litros: kg / 0.540, segmento: "RESIDENCIAL",
        pagado: true, estadoPago: "PAGO VERIFICADO", incluidoAD: Boolean(adActivo), ad: adActivo ? r.ad : null,
        estadoAD: adActivo ? "EN_AD" : "SIN_AD",
      });
    }
  }
  // La lista maestra de la comunidad contiene también residentes sin pago; no entran al AD.
  const extra = extraSinPagoDeRuta(r);
  for (let j = 0; j < extra; j++) {
    const i = n + j;
    const kgPendiente = j % 6 === 0 ? 18 : 10;
    filas.push({
      id: `${r.id}-NP-${String(j + 1).padStart(3, "0")}`,
      pedidoId: `PED-${r.id}-NP-${String(j + 1).padStart(3, "0")}`,
      fechaPedido: "14/08/2026", horaPedido: `12:${String((22 + j * 7) % 60).padStart(2, "0")}`,
      nombre: personaDemo(serialBase + i).nombre,
      cedula: personaDemo(serialBase + i).cedula,
      comuna: r.comuna, comunidad: r.comunidad, parroquia: r.parroquia, rutaId: r.id,
      cantidad: 1, kg: kgPendiente, litros: kgPendiente / 0.540, segmento: "RESIDENCIAL",
      pagado: false, estadoPago: "PENDIENTE DE PAGO", incluidoAD: false, ad: null, estadoAD: "SIN_AD",
    });
  }
  return filas;
}


export function pedidosDeRutas(rutas = []) {
  return rutas.flatMap((r) => {
    const asignadosCustom = new Set(r.customAssignedPedidoIds || []);
    if (["INSTITUCIÓN", "COMERCIO"].includes(r.bloque)) {
      const adActivo = r.estadoRuta !== "SIN_PLANIFICAR" && r.ad && String(r.ad) !== "0";
      return [10,18,27,43].filter((kg) => Number(r.cilindros[kg] || 0) > 0).map((kg, idx) => ({
        id: `PED-${r.id}-${kg}`,
        pedidoId: `PED-${r.id}-${kg}`,
        fechaPedido: "14/08/2026", horaPedido: `09:${String(10 + idx * 9).padStart(2,"0")}`,
        nombre: r.comunidad,
        cedula: r.bloque === "INSTITUCIÓN" ? "RIF INSTITUCIONAL" : "RIF COMERCIAL",
        comuna: r.comuna, comunidad: r.comunidad, parroquia: r.parroquia, rutaId: r.id,
        cantidad: Number(r.cilindros[kg] || 0), kg, litros: kg / 0.540 * Number(r.cilindros[kg] || 0),
        totalKg: kg * Number(r.cilindros[kg] || 0), segmento: r.bloque === "INSTITUCIÓN" ? "INSTITUCIONAL" : "COMERCIAL",
        pagado: true, estadoPago: "PAGO VERIFICADO", incluidoAD: Boolean(adActivo), ad: adActivo ? r.ad : null,
        estadoAD: adActivo ? "EN_AD" : "SIN_AD", estadoRuta: r.estadoRuta, unidad: adActivo ? r.unidad : null,
        operadorId: adActivo ? (r.operadorId || null) : null, conductor: adActivo ? (r.conductor || null) : null,
      })).filter((p) => !asignadosCustom.has(p.id));
    }
    const detalle = (r.beneficiariosSnapshot || beneficiariosDeRuta(r)).filter((p) => !asignadosCustom.has(p.id));
    return detalle.map((p) => {
      const enAD = Boolean(p.ad && String(p.ad) !== "0");
      return { ...p, estadoRuta: r.estadoRuta, unidad: enAD ? r.unidad : null, operadorId: enAD ? (r.operadorId || null) : null, conductor: enAD ? (r.conductor || null) : null };
    });
  });
}

/* ═══════════════════  HISTÓRICO 360° DE USUARIO EN DISTRIBUCIÓN  ═══════════════════
   Dataset determinístico de demostración. Distribución puede auditar la referencia bancaria,
   pero deliberadamente no recibe importes en Bs. La capa financiera queda en Comercialización. */
const BANCOS_AUDITORIA_DIST = ["Banco de Venezuela", "Banco Nacional de Crédito", "Banco Provincial", "Pago Móvil · Banco Activo"];
const digitosCedula = (cedula = "") => Number(String(cedula).replace(/\D/g, "").slice(-7) || 1000000);
const fechaHistDist = (mesesAtras, semilla) => {
  const d = new Date(2026, 7 - mesesAtras, 3 + (semilla % 22));
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};
const operacionBancoDist = (semilla, idx) => String(100000000000 + ((semilla * 7919 + idx * 104729) % 899999999999));

export function historialDistribucionPersona(p = {}) {
  const seed = digitosCedula(p.cedula);
  const previos = 5 + (seed % 3);
  const solicitudes = [];
  const pagos = [];
  const despachos = [];
  const auditoria = [];

  for (let i = previos; i >= 1; i--) {
    const kg = ((seed + i) % 5 === 0) ? 18 : 10;
    const fecha = fechaHistDist(i, seed + i * 13);
    const pedido = `PED-H-${String(seed).slice(-5)}-${String(i).padStart(2,"0")}`;
    const ad = `AD-${74000 + ((seed + i * 97) % 3200)}`;
    const banco = BANCOS_AUDITORIA_DIST[(seed + i) % BANCOS_AUDITORIA_DIST.length];
    const operacion = operacionBancoDist(seed, i);
    const placa = UNIDADES_DISTRIBUCION[(seed + i) % UNIDADES_DISTRIBUCION.filter(u=>!u.granel).length].placa;
    const unidad = unidadDistribucion(placa);
    const op = operadorDistribucion(unidad.operadorDefault);
    solicitudes.push({ id: pedido, fecha, concepto: `Recarga bombona ${kg} kg`, cantidad: 1, kg, litros: kg / 0.540, ad, estado: "ENTREGADA" });
    pagos.push({ solicitud: pedido, banco, operacion, fecha, estado: "PAGO VERIFICADO", validacion: "Conciliado por Comercialización" });
    despachos.push({ ad, fecha, comuna: p.comuna, comunidad: p.comunidad, placa, operador: op.nombre, operadorCedula: op.cedula, bop: `BOP-${8100 + ((seed + i * 31) % 1600)}`, kg, litros: kg/0.540, estado: "ENTREGADA" });
    auditoria.push({ fecha, hora: "08:04", evento: "Pago validado", origen: "Comercialización", referencia: operacion, detalle: `Pedido ${pedido}` });
    auditoria.push({ fecha, hora: "09:16", evento: "Pedido asignado a AD", origen: "Distribución", referencia: ad, detalle: `${p.comunidad || "Comunidad"} · ${placa}` });
    auditoria.push({ fecha, hora: "14:38", evento: "Entrega confirmada", origen: "Operaciones", referencia: despachos[despachos.length-1].bop, detalle: `AD ${ad} · ${kg} kg` });
  }

  const currentKg = Number(p.totalKg ?? ((p.kg || 0) * (p.cantidad || 1)));
  const currentFecha = p.fechaPedido || "14/08/2026";
  const currentPedido = p.pedidoId || p.id || `PED-${String(seed).slice(-6)}`;
  solicitudes.unshift({
    id: currentPedido, fecha: currentFecha, concepto: p.kg ? `Recarga bombona ${p.kg} kg` : "Solicitud de GLP",
    cantidad: p.cantidad || 1, kg: currentKg, litros: currentKg/0.540, ad: p.ad || null,
    estado: p.ad ? (p.estadoRuta === "ENTREGADA" ? "ENTREGADA" : "EN AD") : "SIN AD",
  });
  auditoria.unshift({ fecha: currentFecha, hora: p.horaPedido || "08:20", evento: "Pedido recibido", origen: "Sistema", referencia: currentPedido, detalle: `${p.comunidad || "—"} · ${currentKg} kg` });
  if (p.pagado) {
    const banco = BANCOS_AUDITORIA_DIST[seed % BANCOS_AUDITORIA_DIST.length];
    const operacion = operacionBancoDist(seed, 99);
    pagos.unshift({ solicitud: currentPedido, banco, operacion, fecha: currentFecha, estado: "PAGO VERIFICADO", validacion: "Conciliado por Comercialización" });
    auditoria.splice(1,0,{ fecha: currentFecha, hora: "08:25", evento: "Pago validado", origen: "Comercialización", referencia: operacion, detalle: `Pedido ${currentPedido}` });
  }
  if (p.ad) {
    const unidad = unidadDistribucion(p.unidad);
    const op = operadorDistribucion(p.operadorId || unidad.operadorDefault);
    despachos.unshift({
      ad:p.ad, fecha:currentFecha, comuna:p.comuna, comunidad:p.comunidad, placa:unidad.placa||p.unidad,
      operador:p.conductor||op.nombre, operadorCedula:p.conductorCedula||op.cedula, bop:p.estadoRuta === "ENTREGADA" ? `BOP-${String(p.ad).replace(/\D/g,"").slice(-4)}` : "—",
      kg:currentKg, litros:currentKg/0.540, estado:p.estadoRuta === "ENTREGADA" ? "ENTREGADA" : "ASIGNADA / EN PROCESO",
    });
    auditoria.splice(p.pagado?2:1,0,{ fecha:currentFecha,hora:"09:10",evento:"Asignación logística",origen:"Distribución",referencia:p.ad,detalle:`Placa ${unidad.placa||p.unidad} · ${p.comunidad}` });
  }
  return { solicitudes, pagos, despachos, auditoria };
}
