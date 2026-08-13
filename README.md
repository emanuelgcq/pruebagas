# GasLara · Prototipo de distribución, comercialización y comunas

Prototipo navegable con datos demostrativos. No tiene backend: el estado vive en memoria y se reinicia al recargar la página.

## Página inicial del proyecto

El prototipo abre en **Proyecto**, una página ejecutiva ubicada junto al acceso a los portales. Allí se explican los problemas operativos, la solución propuesta, el flujo completo y el alcance de **Comercialización**, **Portal Comuna**, **Operaciones** y **Portal del usuario**.

## Regla central: pago ≠ salida física

- Una persona puede pagar una bombona y recibirla días o semanas después.
- El pago verificado crea un **compromiso/reserva de GLP**; no descuenta la existencia física.
- Comercialización muestra tres cifras por CDT: **inventario físico**, **GLP comprometido** y **disponible real**.
- **Disponible real = físico − comprometido**.
- El inventario físico solo disminuye al entregar y cerrar realmente el AD.
- Un pago puede cruzar de un mes a otro pendiente de despacho sin forzar una salida ni descuadrar el cierre.
- Existe una vista de **Recaudación pendiente de despacho** con antigüedad, comuna, producto, kg/litros comprometidos, Base, IVA y Total ya recaudado. El IVA se conserva según el tratamiento fiscal real de cada solicitud.
- Se permiten **entregas parciales**: se cierra únicamente lo entregado y el saldo conserva el pago y vuelve a la cola de despacho.

## Flujo operativo

**Solicitud/pago → compromiso de inventario → AD → asignación GasLara o EPSDC → entrega en comuna → firma → cuadre automático → cierre AD → BOP automática → salida física → factura cuando corresponda.**

No existe un verificador obligatorio en todos los despachos. Antes del cierre se valida automáticamente AD, pago cuando aplica, cantidad y existencia física; una inconsistencia impide el cierre normal y se trata como incidencia.

## Comunas

- Estructura: **CDT → comuna → personas/usuarios**.
- Cada usuario pertenece a una comuna.
- La comuna es un punto de organización y distribución; no compra el gas por sus miembros.
- El usuario solicita y paga individualmente.
- El **Portal Comuna** muestra miembros, quién pagó, quién no pagó, quién pagó pero aún espera despacho y cuántas bombonas/kg están pendientes de recibir.
- Los pagos pendientes de meses anteriores siguen visibles hasta la entrega.
- Los datos demo priorizan personas naturales; se conservan únicamente unos pocos casos institucionales para probar correctamente los flujos institucionales y fiscales.

## Comercialización

- Seguimiento de distribución sin un segundo cierre manual.
- Inventario en **kg y litros**, usando **1 L de GLP = 0,540 kg**.
- BOP y salida de inventario nacen del cierre físico del AD.
- **Cierre mensual unificado**: por cada concepto muestra lo entregado/facturado, lo recaudado aún no despachado y el GLP despachado vs comprometido. No existe un resumen paralelo.
- Comunidades heredadas sin código pueden registrarse y normalizarse después.
- Facturación automática al cierre del AD cuando el tipo de despacho lo requiere.
- Bombonas de **10 kg y 18 kg**: uso residencial **exonerado de IVA**; uso comercial o institucional **gravado**.

## EPSDC

- Perfil de despacho distinto de la unidad propia GasLara.
- Los AD efectivamente entregados y cerrados por EPSDC alimentan el **Resumen de Venta Transportada por EPSDC**.
- El soporte del **30%** se calcula en el prototipo desde la venta efectivamente transportada/cerrada, no desde pagos pendientes.

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Netlify

Ejecuta `npm run build` y publica `dist/`, o conecta el repositorio. `netlify.toml` incluye el comando de build y el directorio de publicación.

## Nota

Precios, RIF, usuarios, comunas, EPSDC, CDT y documentos son ficticios y no tienen validez fiscal.

## Ajustes de flujo comunal y cierre (13/08/2026)

- El reparto residencial se organiza por **jornada comunal**: GasLara/EPSDC entrega un lote consolidado a la comuna en una sola parada y la comuna distribuye luego a sus miembros.
- Las solicitudes y pagos siguen siendo individuales para trazabilidad, reserva de inventario y facturación.
- El Portal Comuna demo muestra **8 personas**: 6 con pago reciente (<=14 días) y 2 con pago anterior verificado de más de 14 días, todos pendientes de despacho; las 6 solicitudes residenciales comparten la jornada del 12/08/2026.
- Los usos comerciales se muestran como excepción de entrega directa.
- Se eliminó la tabla paralela de POA. El cierre mensual vuelve a ser **una sola tabla**.
- Para bombonas, el cierre separa filas por tamaño y uso: 10 kg residencial/comercial, 18 kg residencial/comercial y 27 kg comercial. Residencial 10/18 kg muestra IVA 0%; uso comercial muestra IVA 16%.

## Cuadre mensual unificado

- La pantalla **Cierre mensual**, el **Acta de cierre** y el **CSV** usan la misma función de consolidación.
- Cada fila separa **Entregado / facturado** de **Recaudado pendiente de despacho**.
- Cada fila muestra **GLP despachado físicamente (kg/L)** y **GLP comprometido pendiente (kg/L)**.
- Los pagos pendientes no se suman a la facturación entregada hasta que exista despacho real.
- El stock físico total se reconcilia con: **Inventario físico − comprometido = disponible real**.
- El stock físico no se distribuye artificialmente por producto: por producto se controla movimiento físico y compromiso.
- Las facturas manuales de productos con inventario generan una salida manual identificada para que facturación e inventario permanezcan conciliados.

## Módulo de Nómina · Backoffice interno

Se incorpora un prototipo administrativo exclusivo para el personal del Departamento de Nómina / Talento Humano. Los trabajadores registrados no son usuarios del sistema y no tienen acceso directo.

Incluye:

- Expediente digital del trabajador con datos personales, laborales, bancarios, seguridad social, familia, estudios, tallas, beneficios y documentos.
- Registro administrativo de novedades recibidas: reposos, permisos, horas extraordinarias, vacaciones, préstamos, anticipos de prestaciones, medicinas, juguetes, uniformes y cargas familiares.
- Motor de cálculo demostrativo con trazabilidad de base, fórmula y norma.
- Vacaciones y bono vacacional LOTTT.
- Prestaciones sociales: garantía trimestral de 15 días, salario integral con alícuotas, intereses mensuales, anticipos hasta el límite legal y estado de cuenta individual.
- Límites de préstamos durante la relación y al egreso.
- IVSS, Régimen Prestacional de Empleo y FAOV/BANAVIH; INCES y SINTEL tratados según su naturaleza jurídica/contractual.
- Procesamiento de nómina, aportes patronales, asiento contable preliminar y reportes.

### Parámetros que deben validarse antes de producción

- Clasificación de riesgo patronal real ante IVSS (el seed usa 11% solo para demostrar el cálculo).
- Condición jurídica de GasLara frente al aporte patronal INCES.
- Convención colectiva vigente: prima por hijo, profesionalización, caja de ahorro, SINTEL, juguetes, medicinas, uniformes, días o beneficios superiores a mínimos legales.
- Plan de cuentas definitivo del departamento administrativo/contable.
- Catálogo histórico de tasas aplicables a prestaciones sociales y sus vigencias.

### Base normativa modelada en el prototipo

- LOTTT Art. 122: salario base de prestaciones con integración de conceptos salariales y alícuotas de bono vacacional/utilidades.
- LOTTT Art. 131: participación en beneficios para entidades con fines de lucro, mínimo 30 días y máximo 4 meses por trabajador; la naturaleza jurídica de GasLara debe definirse antes de producción.
- LOTTT Arts. 142–144: garantía de prestaciones, ubicación de la garantía, intereses y anticipos.
- LOTTT Art. 154: límites de amortización de deudas con el patrono.
- LOTTT Arts. 190, 192 y 194: vacaciones, bono vacacional y oportunidad de pago.
- LOTTT: recargos por horas extraordinarias, jornada nocturna y feriados modelados como reglas legales mínimas.
- Ley del Régimen Prestacional de Empleo, Art. 46: 2,5% total (2% patrono / 0,5% trabajador) sobre la base legal aplicable.
- Ley del Régimen Prestacional de Vivienda y Hábitat 2024, Art. 33: FAOV 3% del salario integral (2% patrono / 1% trabajador).
- IVSS: aporte trabajador y aporte patronal según clasificación de riesgo; el riesgo patronal real debe validarse.
- INCES: se mantiene condicionado a la naturaleza jurídica del empleador y al tipo de remuneración; no se trata como 0,5% mensual ordinario del trabajador.
