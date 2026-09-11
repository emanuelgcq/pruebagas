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

## Distribución · AD personalizada desde pedidos

- La bandeja **Pedidos en tiempo real** permite seleccionar cualquier pedido que esté **Sin AD**.
- Existe botón principal **Planificar AD personalizada**, acción por fila **Planificar** y selección múltiple sobre los resultados filtrados.
- La planificación comunal sigue disponible como flujo rápido para agrupar pedidos pagados de una misma comunidad.
- Una AD personalizada puede mezclar personas de distintas comunidades/comunas y genera su propia lista de paradas.
- Los pedidos con pago verificado pueden entrar en una AD normal.
- Un pedido sin pago solo puede incluirse si el usuario de Distribución selecciona una modalidad autorizada (exonerado, apoyo, institucional o excepción) y registra una justificación.
- Al crear una AD personalizada, los pedidos seleccionados pasan a `EN_AD`, se eliminan de la cola disponible de sus comunidades de origen y aparecen en Operaciones para el conductor/placa asignados.
- El vehículo se identifica por placa venezolana alfanumérica de seis caracteres y el operador por nombre y cédula.

## Reportes imprimibles de Distribución

- La vista **Reportes** incluye un listado de todas las AD creadas del día.
- Cada AD tiene acción **Ver / imprimir** y utiliza la misma data viva de planificación.
- Existe **Imprimir todas las AD** para generar un libro operativo completo de la jornada.
- Cada reporte AD contiene: estado, tipo de planificación, ruta, comuna/comunidad, placa, código interno, operador y cédula, transportista, carga por tamaño, kg, litros reales, pedidos incluidos, estado de pago/autorización y espacios de firma/observaciones.
- Las AD residenciales imprimen el detalle individual persona por persona; las institucionales/comerciales conservan el detalle del pedido correspondiente.
- El libro consolidado inicia con totales de AD, cilindros, kg y litros reales y luego separa cada AD para impresión.
- El CSV consolidado de AD usa la misma data de la pantalla y del documento imprimible.


## Ficha 360° auditable del usuario

- **Comercialización**: cada usuario abre una ficha 360° con datos maestros, solicitudes, pagos bancarios (banco, número de operación, fecha, Base, IVA y Total Bs), despachos, BOP, facturas y trazabilidad de auditoría.
- **Distribución**: desde Pedidos en tiempo real o Comunas y usuarios se abre la misma lógica 360°, pero los pagos muestran banco, número de operación, fecha y validación **sin importes en bolívares**.
- La trazabilidad usa los identificadores de la operación (pedido/solicitud → operación bancaria → AD → BOP → factura) para poder reconstruir el historial.
- Cada ficha permite exportar su auditoría a CSV; Comercialización incluye importes y Distribución los excluye por perfil de acceso.

## Panel ejecutivo de Comercialización

El Panel de Comercialización incorpora filtros Día / Semana / Mes y siete visualizaciones gerenciales alimentadas por la misma data de solicitudes, pagos, facturas, inventario y AD:

1. Gestión monetaria: recaudado, facturado/entregado, recaudado sin despachar y por recaudar.
2. Inventario GLP por CDT: físico, comprometido y disponible real en kg; los litros conservan la relación 1 L = 0,540 kg.
3. Estado de AD/solicitudes: realizadas, en distribución y pagadas todavía sin AD.
4. Movimiento de GLP: despachado físicamente vs comprometido por pagos.
5. Facturación por segmento: residencial, comercial e institucional, incluyendo IVA.
6. Ingresos por concepto: ranking de conceptos facturados.
7. Desempeño por CDT: facturado vs recaudación pendiente de despacho.

El gráfico monetario es la visualización principal y los accesos rápidos llevan al detalle operativo correspondiente sin crear consolidaciones paralelas.

## Ampliación integral del prototipo · 17/08/2026

Esta versión amplía el demo para poder recorrer visualmente los principales procesos de punta a punta sin depender de backend ni integraciones externas. El estado sigue siendo demostrativo y vive en memoria.

### Comercialización
- Panel gerencial con siete gráficos, filtros Día / Semana / Mes y comparación contra el período inmediatamente anterior.
- Control / pre-cierre con validaciones visuales, inconsistencias, histórico de cierres y acciones de acta/cierre.
- Cartera demostrativa con saldo, parciales, vencidos y antigüedad.
- Pagos y conciliación visual con referencias bancarias y casos Verificado / Diferencia / Duplicado / Pendiente.
- Inventario con físico, comprometido, disponible, salidas por BOP y kardex visual de recepción, compromiso, transferencia y ajuste.
- Facturación con casos visuales de anulación y sustitución sin borrar el documento original.
- Liquidaciones EPSDC con ciclo Pendiente → Revisada → Aprobada → Pagada y soporte de operación simulado.

### Distribución
- Pedidos individuales en tiempo real con filtros por AD, pago, segmento, comuna, comunidad, municipio, parroquia, bombona, estado logístico, vehículo, operador, antigüedad, prioridad, tipo de AD y período.
- Edad del pedido y prioridad visibles por fila.
- Planificación comunal y AD personalizada desde cualquier selección de pedidos Sin AD.
- Ciclo visual del AD: Borrador → Planificada → Asignada → Preparando carga → Lista para salida → En ruta → Parcial → Entregada → Cerrada.
- Agenda diaria de jornadas.
- Preparación y carga: planificado vs cargado, capacidad del vehículo, diferencias y pedidos afectados.
- Replanificación: reasignar vehículo/operador/ruta, mover pedidos, dividir, fusionar, reprogramar y cancelar de forma demostrativa.
- Flota y operadores con placa, nombre, cédula, capacidad y disponibilidad.
- Tablero de incidencias.
- Reportes imprimibles por AD y libro completo de AD.

### Operaciones
- El operador recibe únicamente AD asignadas por Distribución.
- Ejecución por paradas.
- Planificado vs entregado y cilindros devueltos.
- Entrega parcial, motivo de diferencia e incidencias.
- Recepción con responsable, cédula, firma/foto/ubicación simuladas.

### Portal Comuna
- Recepción de jornada comunal con planificado vs recibido.
- Entrega persona por persona con Retirada / No retiró / Incidencia.
- Histórico de jornadas.
- El retiro final se comparte con el estado de solicitudes del prototipo para que el Portal del usuario pueda distinguir entrega a comuna de retiro ciudadano.

### Portal del usuario
- Seguimiento: solicitud → pago → planificación → AD → camino a comuna → entregado a comuna → disponible para retiro → retirado.
- Entregado a comuna y retirado por el ciudadano son estados distintos.
- Histórico de retiros.

### Ficha 360°
- Línea de tiempo visual de una operación completa, además de históricos de solicitudes, pagos, despachos, BOP, facturas y auditoría.
- Comercialización muestra importes en Bs; Distribución conserva trazabilidad bancaria sin importes.

### Nómina
- Bandeja y procesamiento visual de novedades.
- Calendario demostrativo de asistencia.
- Vacaciones causadas, disfrutadas y pendientes.
- Prestaciones como estado de cuenta de movimientos.
- Cronograma de préstamos.
- Liquidación mediante flujo paso a paso.
- Ciclo de nómina: Borrador → Calculada → Revisada → Cerrada → Orden de pago → Pagada.

### Centro de gestión
- Dashboard ejecutivo transversal.
- Centro de documentos y reportes con búsqueda, impresión y exportación demostrativa.
- Auditoría global con filtros.
- Matriz visual de roles y permisos.


## Corrección Pagos y conciliación · 17/08/2026

- La vista **Pagos y conciliación** excluye correctamente registros con `pago.estado = "NO_APLICA"` y sin referencia bancaria.
- Los formateadores comunes de fecha (`fecha`, `fechaCorta`, `fechaGuion`, `mesCorto`, `fechaLarga`) ahora toleran valores nulos o inválidos y muestran `—` en vez de provocar un error de renderizado.

---

# Requerimientos de la Gerencia de Comercialización · 01/09/2026

Esta sección documenta lo implementado a partir del oficio de sugerencias de la Gerencia.

## Cambios de regla que modifican el comportamiento anterior

### 1. El que no compra en el AD queda con dinero abonado, no con servicio pendiente

Es el cambio de fondo. Antes, una entrega parcial generaba una **solicitud remanente** que volvía a la
cola de despacho. Ahora no: lo no entregado se cierra y su valor se **abona al código del usuario**.

- La solicitud pasa al estado terminal `ABONADA`.
- El GLP **deja de estar comprometido** y regresa a disponible real.
- El abono es **nominal en bolívares**, no indexado.

Ejemplo del propio requerimiento: transfiere Bs 3.000 por una bombona de Bs 1.700 → quedan Bs 1.300
abonados. Si vuelve cuando la bombona cuesta Bs 2.600, devenga sus Bs 1.300 y transfiere Bs 1.300.

El saldo tiene salida: puede reintegrarse en efectivo por taquilla, y el movimiento queda asentado
como cargo en el estado de cuenta del usuario.

### 2. Factor de conversión unificado en 0,540 kg/L

Convivían **tres** factores distintos: 0,540 kg/L en el inventario y 0,500 kg/L en las hojas de
distribución, y el requerimiento mencionaba 0,504 kg/L. Ahora hay uno solo.

El factor operativo es **0,540 kg/L**. La densidad del GLP depende de la composición de la mezcla:

| Composición | Densidad a 15 °C |
|---|---|
| 100% propano | 0,504 – 0,510 kg/L |
| Mezcla 70/30 propano-butano (típica venezolana) | ~0,530 kg/L |
| Mezcla 60/40 | 0,5376 → **0,540 como factor comercial** |
| 100% butano | ~0,580 kg/L |

El requerimiento indica *"un litro pesa 0,504 kg, **si es 100% propano**"*. Esa condición importa:
GasLara despacha GLP de bombona, que es mezcla propano-butano, no propano puro. Por eso el factor
aplicable es 0,540, el que usa la industria y el que ya venía aplicando el sistema.

Queda expuesto como parámetro nombrado (`COMPOSICIONES_GLP` / `COMPOSICION_ACTIVA`) con las cuatro
composiciones tabuladas, de modo que ajustarlo sea cambiar una línea. En producción debería ser
configurable **por CDT y por lote recibido**, y corregirse por temperatura: el GLP se dilata cerca de
0,3% por cada grado.

El inventario se controla en kg y en litros. El portal del ciudadano muestra **solo kg**, que es la
nomenclatura con la que compra.

### 3. Los precios se versionan, no se cambian

Cada factura resuelve su precio contra el **mes de su fecha**, no contra el precio actual. Antes el
precio era una constante y el monto se calculaba en vivo: cambiar una tarifa reescribía el libro de
ventas hacia atrás.

### 4. Dos CDT

El catálogo pasa de cuatro a dos: **C.D.T. Gral. Jacinto Lara** y **C.D.T. Juan Guillermo Iribarren**.

## Comercialización

- **Libro de Ventas Digital** consultable, imprimible y exportable, con base imponible, exento, IVA y
  total. Incluye **control de correlativo**: detecta saltos en la numeración, que es lo que una
  fiscalización presume como ocultamiento de ingresos.
- **Saldos a favor**, que diferencia con claridad los tres estados del dinero del usuario:
  entregado y facturado · recaudado pendiente de despacho · saldo a favor.
- **Lista de precios** con vigencia mensual, variación contra el mes anterior, histórico de seis
  períodos y campo para la resolución que respalda cada tarifa.
- **Ventas sin contrato** contra código genérico por CDT y por tamaño de cilindro. Usan inventario,
  generan ingreso y entran al libro. Con tope por operación, identificación obligatoria del comprador
  y alerta cuando superan el 15% del despacho.
- **Padrón de usuarios** editable, con bitácora de cambios y campos de identidad protegidos.
- Acción **No compró** en Recaudación por despachar, que convierte la solicitud en abono.

### Clasificación del usuario: dos ejes, no una lista

El requerimiento pide definir usuario de contado, crédito, exonerado y protegido. Se modelan como
**dos atributos independientes**, porque un usuario puede ser crédito y protegido a la vez:

- **Condición de pago** — cuándo paga: `CONTADO` o `CREDITO`.
- **Condición tarifaria** — cuánto paga: `REGULAR`, `EXONERADO` (no paga) o `PROTEGIDO` (tarifa social).

Exonerado y protegido **no se asignan con un clic**: exigen documento que lo respalde, quién autorizó
y fecha de vencimiento. El sistema los caduca solo y vuelve a tarifa regular cuando el aval vence.

### Usuarios inactivos a 180 días

Es una **etiqueta, nunca un bloqueo**. Sirve para depurar padrón y priorizar, no para negar servicio.
El reloj **se pausa** si a la comuna del usuario no se le planificó ninguna jornada: la falta de
movimiento es imputable a la empresa y no debe contarse en su contra. La reactivación es automática.

## Distribución

- **Movimiento de planta**, el registro del operador de planta: todo el gas que entra y sale, en
  cilindros y en gandolas. Hasta ahora el sistema solo podía descontar inventario — la recepción por
  gandola es lo que permite reponerlo.
  - Gandola: afecta la existencia del CDT de una vez, porque ocurre en la planta.
  - Cilindros: la carga se registra como **tránsito**, no como salida contable. La salida la produce
    la BOP al cerrar el AD, y lo devuelto se concilia contra la carga. El mismo kilo nunca baja dos veces.
- **Granel** como sub-módulo: clientes con tanque propio, nivel actual, autonomía estimada, niveles de
  reposición e histórico de despachos con lectura de medidor y temperatura.
- **Planta móvil**: jornadas de llenado en calle, balance de carga contra llenado, atención a usuarios
  con y sin código, y **arqueo de caja** — si la unidad vende en la calle hay efectivo, y sin arqueo
  contra lo llenado no hay forma de saber si el gas que salió coincide con el dinero que entró.
- **Panel de insumos** en el resumen, que muestra de dónde se alimenta la planificación:
  Comercialización (solicitudes canceladas), control de planta (gas disponible) y Flota (vehículos
  con conductor y ayudante), más la cobertura del disponible sobre lo solicitado.
- **Ayudante de chofer** en el modelo de flota, que no existía. Un vehículo solo está disponible si
  tiene certificación GLP y póliza vigentes, mantenimiento al día y ayudante asignado.

## Portal del ciudadano

- Vista **Mi saldo** con el dinero disponible, su equivalencia en bombonas al precio de hoy y el
  detalle de movimientos.
- El saldo se **devenga primero** en el wizard de pedido: solo se transfiere la diferencia. Si el saldo
  cubre el pedido completo, no hace falta transferir.

## Correcciones incluidas

- El kardex de inventario consultaba un CDT inexistente (`CDT-01`) y mostraba saldo cero en las cuatro filas.
- Las bombonas de 15, 21 y 43 kg se despachaban sin tarifa y facturaban Bs 0. Ahora tienen precio a la
  misma tasa por kilo que el resto.

---

# Reglas de operación · definición de la Gerencia

Ocho decisiones que gobiernan el ciclo completo, implementadas y verificadas.

## 1 · Momento de la venta

La venta ocurre **al despachar desde planta** al consejo comunal o punto de distribución.
La comuna actúa como **consignatario**: recibe mercancía en custodia, no la compra.

Consecuencia: **si la comuna no entrega, responde ante la empresa** — no el usuario ante la comuna.
Un usuario que pagó y no recibió reclama contra GasLara, y GasLara contra la comuna consignataria.

La vista **Consignación comunal** lleva esa cuenta: recibidas, entregadas, en custodia y valor del
que cada comuna responde.

## 2 · Precio aplicable

Manda el precio del **día del despacho**, no el del pedido. Siendo tarifa regulada por gaceta,
cambia por resolución y no a diario, así que la ventana de riesgo es baja.

## 3 · Envase: sin vacío no hay canje

El intercambio vacío-por-lleno es la norma. **Sin cilindro vacío no hay despacho.** No existe
depósito ni recargo: el usuario debe tener su bombona.

Se agregó el **parque de envases**, con serial, estado y trazabilidad por usuario. Un envase en
taller o no localizado impide el canje, y el operador lo ve marcado antes de intentar la entrega.

## 4 · Cilindro defectuoso

**Reposición física**, canje 1:1 de envase. Se retira el defectuoso, se entrega uno operativo y el
retirado entra a taller. **No hay abono monetario** y el GLP no se libera: el pedido sigue vivo.

## 5 · Formato no disponible

**No se entrega un formato por otro.** El regulador fija precio por formato, no por kilo, así que
sustituir un 18 kg por un 10 kg no tiene base legal clara. Se espera al tamaño correcto.

## 6 · Cancelación

El usuario puede cancelar antes de la entrega. Lo usual es dejar **saldo a favor** para el próximo
despacho; el reintegro en efectivo procede pero es excepcional.

## 7 · Tope por ciclo

**Una bombona por núcleo familiar por ciclo mensual.** El núcleo se identifica por contrato: varias
personas de una vivienda comparten cupo. Sin tope hay acaparamiento y reventa.

## 8 · Pago antes del compromiso

**Pago verificado → reserva de inventario → despacho.** Una solicitud sin conciliar no compromete
GLP. La bandeja **Conciliación de pagos** es donde eso ocurre: mientras el pago está ahí, el gas
sigue disponible para otros.

---

# El ciclo completo, de punta a punta

## Un solo universo de datos

Antes había **dos bases paralelas**: 82 solicitudes de Comercialización y 2.631 pedidos de
Distribución, **sin un solo identificador compartido**. El usuario que pagaba en el portal nunca
aparecía en un AD.

Ahora la planificación se convierte en solicitudes reales del sistema: **2.707 solicitudes**, de las
cuales 2.625 provienen de las comunidades planificadas, cada una con su envase, su pago y su cupo.
Distribución, Operaciones y Comercialización miran la misma lista.

## La jornada persona por persona

El operador llevaba 124 personas en un AD y solo tenía **cuatro contadores** — uno por tamaño de
cilindro — y un texto libre para toda la ruta. Era imposible decir quién no recibió y por qué.

Ahora cada persona es una fila con su nombre, su cédula, su producto y su envase. Se marca entregada
o no entregada con **motivo tipificado**, y cada motivo produce su consecuencia al cerrar:

| Motivo | Consecuencia | Libera GLP |
|---|---|---|
| Entregada | Factura al precio del despacho + BOP + salida de inventario + canje de envase | sí, sale físicamente |
| No se encontraba | Abono a su código | sí |
| No presentó envase vacío | Abono a su código | sí |
| Formato no disponible | Abono a su código | sí |
| Dirección no ubicada | Abono + marca el padrón para verificación | sí |
| Rechazó / canceló | Abono a su código | sí |
| **Cilindro defectuoso** | **Reposición física, sin abono** — envase a taller | **no** |

## Qué produce el cierre del AD

En un solo acto, verificado sobre un AD real de 78 personas:

```
71 entregadas   →  71 facturas · Bs 71.521,47 · 774 kg de salida física
 7 no entregadas →  7 abonos por Bs 7.207,59 · el GLP vuelve a disponible
71 envases      →  entran a planta como vacíos
71 cilindros    →  quedan bajo custodia de la comuna consignataria
```

Antes esto no ocurría: cerrar un AD solo cambiaba el estado de la ruta y **no tenía ningún efecto
contable**. La función que facturaba existía en el código pero ninguna pantalla llegaba a ella.

## Puntos que siguen requiriendo definición de la Gerencia

- **Tipo de usuario por nivel** en granel: se modeló por volumen mensual contratado, que determina
  prioridad y frecuencia de reposición. Si el criterio es otro — nivel del tanque o nivel tarifario —
  el corte se ajusta sin tocar el resto del módulo.
- **Qué es "TIPS"** en el requerimiento de la O.A.U.
- **Vencimiento del saldo a favor**: hoy no caduca. Sin política de prescripción, el pasivo se acumula.
- **Cupo mensual del usuario protegido**: el prototipo usa 18 kg como referencia, sin validarlo.
- **Capacidad del vehículo**: 13 de 25 AD de la planificación semilla exceden la capacidad del camión
  asignado, una hasta 247%. El planificador no lo valida. Falta definir si el tope es rígido o si
  admite varios viajes por jornada.
- **Qué pasa con el envase de quien no lo tiene**: hoy queda sin servicio y con su dinero abonado.
  Habría que definir si existe una vía para que adquiera uno.
- **Correlativo del número de control**: hoy deriva del número de pedido y por tanto salta. SENIAT
  espera correlativo continuo asignado por imprenta digital autorizada.

---

# Visibilidad contable y unidades · 01/09/2026

Tres cosas que la Gerencia señaló al revisar el prototipo: el libro de ventas no se
encontraba, lo contable estaba disperso y los kilos aparecían sin su equivalencia en
litros. Se corrigieron junto con los huecos funcionales que quedaban del repaso anterior.

## El menú se agrupó por oficio

Once entradas en lista plana escondían lo importante: el **libro de ventas** —que es el
soporte contable oficial de ingresos— vivía como una pestaña dentro de «Documentos».
Ahora el menú tiene tres bloques y lo contable va primero:

```
CONTABILIDAD          Libro de ventas · Facturas y boletas · Ventas sin contrato
                      Saldos a favor · Cierre del período
OPERACIÓN COMERCIAL   Solicitudes · Inventario GLP · Consignación comunal · EPSDC 30%
ADMINISTRACIÓN        Padrón de usuarios · Lista de precios · Reclamos
```

**Libro de ventas** y **Ventas sin contrato** salieron a entrada propia. «Documentos» pasó
a llamarse **Facturas y boletas** y quedó con lo que sí es documental: boletas emitidas,
facturas emitidas y control de correlativo.

## Ningún kilo sin su litro

El GLP se compra por litro y se factura por kilo. Mostrar una sola unidad obliga a
convertir de cabeza, y ahí se cometen los errores. Regla del sistema: **ninguna cantidad
de GLP se muestra en una sola unidad**, y las dos van al mismo tamaño de fuente.

Vive en `src/Unidades.jsx`: `<KgL>` para línea, `<KgLBloque>` para tarjetas y `<NotaFactor>`
para encabezados. Toda conversión pasa por `KG_POR_LITRO_GLP`, que sale de la composición
activa. Si la Gerencia cambia la composición, cambia en un sitio.

### El factor doble que descuadraba

Los despachos de granel estaban escritos a mano con **0,504 kg/L** mientras el resto del
sistema convertía a **0,540**. El mismo litro pesaba dos cosas según la pantalla. Ahora el
granel guarda **solo litros** —que es lo que marca el medidor de la gandola— y los kilos se
derivan con el factor único. La tabla de composiciones conserva 0,504 como opción para
propano 100%, tal como está redactado en el requerimiento.

## Huecos funcionales cerrados

**Alta de usuarios** (`crearUsuario`). No existía: todo el padrón venía precargado, así que
no había forma de crear un consumidor exonerado ni de recorrer la secuencia que pidió la
Gerencia. Ahora se registra la información base y el usuario **nace CONTADO y REGULAR**; el
crédito, la exoneración y la tarifa protegida se activan **después** desde su ficha, donde
sí se pide aval, vigencia y quién autorizó. El código y el contrato los asigna el sistema.

**Servicios culminables** (`culminarServicio`). Una visita técnica o un cambio de válvula no
sale en gandola: no entra a un AD y por eso no tenía forma de cerrarse. El pedido quedaba
pagado para siempre y, si el técnico hacía el trabajo, el sistema solo sabía cancelarlo.
Ahora dispara la misma cadena contable —boleta, factura, libro de ventas— sin exigir ruta,
y pide lo que sustenta un servicio: quién lo prestó, dónde y qué encontró. Factura a la
tarifa del día en que se prestó, no a la del día en que se pidió.

**Estado del padrón definible** (`definirEstadoUsuario`). El reloj de 180 días no sabe que
alguien falleció, se mudó o tiene el contrato suspendido. Seis motivos tipificados
sobreescriben el cálculo, y el chip distingue lo decidido de lo calculado: si figura
inactivo alguien que compró la semana pasada, se ve por qué y quién lo definió. Se puede
devolver al automatismo.

**Resumen por tipo de cliente.** El padrón contaba por estado y por tarifa, pero no decía
cuántos residenciales, comercios e instituciones hay — que es lo que define el tratamiento
fiscal. Tres tarjetas con activos, inactivos, crédito, tarifa especial y saldo acumulado;
al pulsarlas filtran el padrón.

**Venta sin contrato con boleta.** Nacía facturada, sin boleta, así que movía inventario por
un documento que el control documental no podía rastrear. Ahora emite su BOP como cualquier
otra salida física.

## Lo que se dejó fuera a propósito

**El cierre del AD sigue en una sola mano.** La Gerencia lo quiere controlado por
Distribución *y* Comercialización —una actualiza atendidos, la otra factura y abona— y hoy
lo ejecuta únicamente Operaciones desde la calle. Los *efectos* caen donde deben, pero el
control en dos etapas no está. Las piezas existen sin usar (`entregar()`, `abrirAD()`).
Queda pendiente por decisión, no por olvido.

## Verificación

Build limpio. Los 13 módulos de Comercialización cargan con datos y sin errores de consola.
Probado de punta a punta en el navegador: servicio culminado (`SOL-2412` → `BOP-0850` +
factura `U-01000545` por Bs 800,40, asentada en el libro), usuario dado de alta
(código 4343001, contrato 1223001) y estado definido a mano (`Se mudó fuera del área` →
Inactivo, con constancia). Granel convierte 3.175 L → 1.715 kg con el factor del sistema.

---

# Consolidación de caras · 01/09/2026

El prototipo tenía nueve caras en el conmutador; tres de ellas no correspondían a un
sistema distinto, sino al mismo sistema visto desde otro sitio. Se retiraron.

## El AD lo cierra Distribución, no el conductor

**Se eliminó la app móvil del repartidor.** El conductor ejecuta la ruta que Distribución
le planificó y reporta lo que ocurrió; quien confirma las incidencias y firma el cierre
—con su facturación, su salida de inventario y sus abonos— es el gerente que respondió
por esa AD. Poner ese acto contable en el teléfono de quien maneja el camión nunca fue
la separación correcta.

Toda la información que la app manejaba vive ahora en **Distribución → Ejecución y
cierre**: qué lleva cada unidad, quién conduce, con qué ayudante, cuántas personas,
las paradas que definió la planificación, el estado de la ruta y el resultado del cierre.
Lo que cambia es quién decide, y desde dónde.

- `DistribucionEjecucion.jsx` — el panel del gerente: lista de AD por estado, ficha de
  cada una, marcar salida, confirmar incidencia y cerrar.
- `DistribucionCierreAD.jsx` — el cierre persona por persona (antes `OperacionesJornada`).

La incidencia dejó de ser un texto libre: se tipifica —avería, punto cerrado, sin
receptor, seguridad, clima, carga errada— y exige quién la confirma. Sin responsable, una
incidencia no es constancia de nada.

## El Portal Comuna es un rol, no un sistema

**Se eliminó la cara Portal Comuna.** Un coordinador de comuna es antes que nada un
usuario con su contrato y su bombona; lo que cambia es que además responde por el lote
que recibe en custodia. Eso es permisología, no otro producto.

Vive en `PortalRolComuna.jsx` y se activa desde el selector de rol del portal. Con el
permiso aparece el grupo **Mi comuna** —miembros, recepción de jornada, entrega a
miembros, histórico— encima de las secciones propias del usuario. Sin él, no existe.

## La app móvil del usuario se retiró

Era el mismo portal con otra caja. Un portal responsivo cubre el caso sin mantener dos
árboles de componentes que se desincronizan.

## Resultado

El conmutador pasó de nueve caras a seis: **Proyecto · Centro de gestión · Portal del
usuario · Distribución · Comercialización · Nómina**. Tres archivos menos
(`AppMovil.jsx`, `AppOperaciones.jsx`, `PortalComuna.jsx`), ninguna función perdida.

**Verificación:** las seis caras cargan sin errores de consola. Probado de punta a punta
el cierre desde Distribución sobre la AD 76892 —120 personas, 110 entregadas, 10 abonos,
Bs 117.147,37 facturados, 1.254 kg · 2.322 L de salida— y el registro de una incidencia
con su validación de responsable. El rol de comuna abre y cierra sus cuatro secciones.

---

# Cómo es la jornada · corrección de modelo · 01/09/2026

El prototipo asumía que el camión salía del CDT **cargado con bombonas llenas**, entregaba,
y devolvía las no entregadas. La Gerencia corrigió: no es así.

**La gente lleva su bombona vacía al punto comunal. El operador la recoge, se la lleva a
planta, la llena y la vuelve a dejar en el mismo punto. Si se lleva diez, regresan diez.**

El camión sale a recoger, no a repartir. Todo lo que se había construido sobre el modelo
anterior cuadraba mal.

## Las incidencias tienen dos momentos

```
ANTES DEL AD    Una sola cosa: pagó o no pagó. Eso decide quién entra a la jornada.
EN EL SITIO     Quién llevó su bombona, cuáles volvieron llenas y cuáles no se
                pudieron llenar por estar malas.
```

Adelantar un hallazgo de sitio a la planificación es inventarse un dato que todavía nadie
recogió. Por eso:

- `problemaDe()` en la vista de AD **solo mira el pago**. La condición del envase salió de
  ahí: no se sabe hasta que la persona llega al punto con su bombona o sin ella.
- El panel de cierre **ya no pre-marca a nadie** como «sin envase». Todos arrancan como
  entregados y el gerente corrige contra lo que reportó el conductor.
- En la fila de cada persona, lo que el sistema recuerda del parque pasó a ser un
  antecedente —*«su bombona figuraba en taller»*— y no un veredicto. Antes decía
  «Sin envase» junto a «Entregada», que se contradecía.

## El cuadre de la jornada

Dejó de ser *planificado contra entregado* y pasó a ser **recogidas contra devueltas
llenas**. La única diferencia legítima son las bombonas que no admitieron llenado:

```
Bombonas recogidas      120   de 120 personas convocadas
Devueltas llenas        119   1.344 kg · 2.489 L
No se pudieron llenar     1   bombonas malas · van a taller
No llevaron bombona       0   no hubo qué recoger
```

## La bombona mala ya no se repone

`DEFECTUOSO` pasó de `REPOSICION` a `ABONO`. Decisión de la Gerencia: **no hay reposición
en el momento**. La bombona vuelve vacía, el envase entra a taller y el dinero le queda
abonado al usuario para su próxima compra. El GLP se libera porque nunca llegó a cargarse.

Con eso, **los siete motivos de no entrega abonan**. No queda ninguno que deje a la persona
con un pedido vivo y sin dinero.

## En la vista de AD

Cada AD abre a su listado nominal —lo que antes solo existía al planificar y al cerrar— y
su tarjeta cuadra contra la gente:

```
124 en la lista · 120 convocadas · 2 sin pago · 2 pago rechazado
```

Y arriba, el total del día: *«106 personas de la lista no entran hoy a la jornada»*, con el
desglose entre quienes no reportaron pago y quienes lo tienen rechazado por la regla.

**Verificación:** marcar una bombona como mala mueve el cuadre de 120/120 a 120 recogidas /
119 devueltas / 1 a taller, y el abono de Bs 0,00 a Bs 924,05. Nadie viene pre-marcado —120
de 120 arrancan como entregadas. Las seis caras cargan sin errores de consola.

---

# Distribución · de quince entradas a diez · 01/09/2026

Cuatro pantallas mostraban la misma lista de 27 rutas con otro filtro y otro layout.
Se fusionaron sin quitarle peso al AD, que sigue siendo la unidad operativa: la ruta,
el camión y el conductor.

```
Resumen                 Pedidos en tiempo real       AD del día
Preparación y carga     Ejecución y cierre           Flota y operadores
Movimiento de planta    Granel                       Planta móvil
Comunas y usuarios
```

## AD del día absorbió tres vistas

**Planificar AD**, **Replanificar AD** y **Agenda diaria** pasaron a ser segmentos y
acciones de la misma pantalla:

```
Por planificar 2 · Activas 25 · En ruta · Con incidencia · Cerradas · Todas 27
```

- *Por planificar* muestra las comunidades con su conteo —en la lista, pagados, sin pago,
  bombonas— y el botón que abre el planificador. Es lo que hacía la vista Planificar.
- Replanificar es una acción por fila que abre el mismo modal `Reasignar` de siempre.
- La agenda **se eliminó**: repartía las AD en nueve franjas horarias calculadas con el
  índice de la ruta módulo nueve. La hora no salía de ningún dato. La real vive en
  `horaSalida` y ahora se ve en la columna *Ruta y salida*.

Y absorbió de **Reportes** la impresión y el CSV consolidado de AD, que es donde están
las AD.

## Incidencias dejó de ser decorativa

El tablero anterior mezclaba tres incidencias escritas en duro con las reales, y su botón
*Resolver* solo movía un `Set` en memoria: al recargar volvían a estar abiertas. Además
su texto decía *«reportada por Operaciones»*, un módulo que ya no existe.

Registrar y resolver vive ahora en **Ejecución y cierre**, y **escribe**. Resolver obliga
a decir en qué queda la AD —*vuelve a ruta* o *se reprograma*— con nota y responsable,
porque una incidencia resuelta no es un estado: es una decisión sobre si la jornada sigue
hoy o se retoma otro día.

## Reportes se repartió

Mezclaba datos vivos con un reporte congelado del día anterior sin avisarlo. El
cumplimiento del despacho ya vivía en Resumen; la impresión y el CSV se fueron a AD del
día. La entrada desapareció.

## Cuatro componentes retirados

`AgendaDistribucion`, `ReplanificarDistribucion`, `IncidenciasDistribucion` y `Reportes`,
más la vista local `Planificar`. `DistribucionExtra.jsx` pasó de 300 a 57 líneas.

**Verificación:** los seis segmentos de AD del día responden con sus conteos (2 por
planificar, 25 activas, 27 todas), el listado nominal abre con 124 personas, y el ciclo
completo de incidencia —registrar, confirmar, resolver— mueve la AD de *Activas* a *Con
incidencia* y de vuelta a *En ruta*. Las seis caras cargan sin errores de consola.
