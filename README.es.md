# Scrumooth — la Scrum Guide, aplicada.

**Juzgue una herramienta Scrum por las reglas que respeta, no por los tableros que dibuja.**

**Scrumooth** es una aplicación web autohospedada y de código abierto para equipos que trabajan con Scrum. Está pensada para Scrum Masters, Product Owners y equipos liderados por ingeniería que quieren que el proceso se someta a la Guide. Convierte las reglas de la **Scrum Guide 2020** en barreras que el backend aplica siempre que una herramienta puede hacerlo — y declara los puntos en los que deliberadamente no lo hace.

**No** es un sustituto de su gestor de incidencias. Como la capa de aplicación de la Scrum Guide que su gestor no tiene, es propietario del ciclo de vida del Sprint, de los roles y de las barreras, y se niega a que una violación del proceso pase en silencio. Su gestor conserva su registro; esto conserva sus reglas. Todas las reglas que aplica figuran en [Qué aplica Scrumooth](#what-scrumooth-enforces) — y no se reivindica ninguna regla fuera de esa lista.

Ejecutar una segunda herramienta tiene un coste real — algo más que desplegar, proteger, respaldar y mantener. Scrumooth es deliberadamente el sistema más pequeño capaz de asumirlo: un único stack de Compose —proxy inverso, backend, frontend, PostgreSQL y copias de seguridad programadas— y una sola base de datos de la que ocuparse.

> **Idiomas:** [English](README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Italiano](README.it.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml/badge.svg)](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/orbivort/scrumooth/graph/badge.svg)](https://codecov.io/github/orbivort/scrumooth)
[![GitHub release](https://img.shields.io/github/v/release/orbivort/scrumooth?include_prereleases)](https://github.com/orbivort/scrumooth/releases)
[![GitHub issues](https://img.shields.io/github/issues/orbivort/scrumooth)](https://github.com/orbivort/scrumooth/issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791.svg)](https://www.postgresql.org/)

<p align="center">
  <img src="docs/screenshots/scrumooth_es.png" alt="Scrumooth" width="800" />
</p>

<a id="live-demo"></a>

## 🖥️ Demo en vivo

Pruebe Scrumooth al instante en su navegador, sin necesidad de instalación. La demo se ejecuta con datos simulados (no requiere backend), de modo que puede explorar el ciclo de vida completo de Scrum de inmediato.

<p align="center">
  <a href="https://orbivort.github.io/scrumooth/" target="_blank" rel="noopener noreferrer">
    <strong>👉 Abrir la demo en vivo en GitHub Pages</strong>
  </a>
</p>

> **Nota:** La demo utiliza datos simulados en memoria — cualquier cambio que realice es local a su sesión del navegador y se restablece al recargar la página. Para datos persistentes y colaboración multiusuario, siga la guía de [Instalación](#installation) para autohospedar su propia instancia.

---

## Tabla de contenidos

**Entender Scrumooth**

- [Demo en vivo](#live-demo)
- [El manifiesto](#the-manifesto)
- [Qué aplica Scrumooth](#what-scrumooth-enforces)
- [Para quién es](#who-its-for)
- [Por qué puede confiar en él](#why-you-can-trust-it)
- [Características](#features)

**Autohospedaje y desarrollo**

- [Stack tecnológico](#tech-stack)
- [Estructura del proyecto](#project-structure)
- [Inicio rápido](#quick-start)
- [Requisitos previos](#prerequisites)
- [Instalación](#installation)
- [Comandos de desarrollo habituales](#development-commands)
- [Pruebas](#testing)
- [Pruebas de carga (k6)](#load-testing-k6)
- [Calidad del código](#code-quality)
- [Gestión de la base de datos](#database-management)
- [Soporte de Docker](#docker-support)
- [Despliegue](#deployment)
- [Solución de problemas](#troubleshooting)

**Proyecto**

- [Documentación](#documentation)
- [Hoja de ruta](#roadmap)
- [Contribuciones](#contributing)
- [Licencia](#license)

---

<a id="the-manifesto"></a>

## 📜 El manifiesto — Por qué existe Scrumooth

> La mayoría de las herramientas de gestión de proyectos están hechas para **registrar** lo que ha ocurrido. Le dan tableros, registran sus clics, dibujan gráficos precisos —después de que el Sprint haya terminado. Registrar es genuinamente útil, y esas herramientas lo hacen bien.
>
> Pero un registro es una descripción, no una decisión. La Scrum Guide 2020 está llena de reglas a las que una herramienta podría obligarle: un Sprint se cierra solo después de su Sprint Review y su Sprint Retrospective, solo los Developers estiman el trabajo, un único Product Owner es dueño del Product Backlog, y «Done» significa que se ha cumplido la Definition of Done. Cuando una de ellas se escapa —un Sprint cerrado antes de que se celebrara su Sprint Retrospective, un Product Owner estimando el trabajo en nombre de los Developers, un elemento marcado como Done sin verificar sus criterios—, ese incumplimiento suele pasar inadvertido hasta que el Sprint termina. En la mayoría de las herramientas, esas reglas son orientativas: un entendimiento compartido que se confía a la memoria del equipo.
>
> **Scrumooth las trata como reglas.**
>
> La disciplina no es el ingrediente que falta —si bastara por sí sola, ningún equipo habría cerrado jamás un Sprint sin su Sprint Retrospective. La Guide dice a un equipo qué hacer; no puede advertir cuándo el equipo deja de hacerlo. Por eso incorporamos la **Scrum Guide 2020** como código ejecutable y la **aplicamos** en el servidor, donde ni la interfaz ni una llamada directa a la API pueden eludirla. Somos un **guardián, no un tomador de notas**.
>
> Menos debates sobre procesos. Más tiempo entregando software que funciona.

<a id="what-scrumooth-enforces"></a>

## 🔒 Qué aplica Scrumooth

Estas son barreras, no advertencias ni sugerencias. En todos los casos siguientes la respuesta es no — y cada respuesta se sostiene en la capa de servicio del backend, de modo que un atajo en el frontend no puede sortearla.

| Una regla de la Scrum Guide 2020, planteada como pregunta                      | La respuesta de Scrumooth                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Puede cerrarse un Sprint antes de su Sprint Review y su Sprint Retrospective? | Se rechaza la finalización del Sprint hasta que ambos eventos queden registrados ([API de sprints](docs/api/sprints.md)).                                                                         |
| ¿Puede un elemento llamarse Done sin su Definition of Done?                    | Completar un Sprint nunca marca elementos como Done — cada elemento debe superar su lista de verificación de la Definition of Done ([API de Definition of Done](docs/api/definition-of-done.md)). |
| ¿Puede un equipo tener más de un Product Owner o más de un Scrum Master?       | Se rechaza añadir un segundo titular de cualquiera de los dos roles ([API de equipos](docs/api/teams.md)).                                                                                        |
| ¿Puede un equipo superar el tamaño de un Scrum Team?                           | El tamaño del equipo está limitado — `TEAM_MAX_SIZE`, por defecto `10` ([API de equipos](docs/api/teams.md)).                                                                                     |
| ¿Puede alguien que no sea un Developer estimar el trabajo?                     | Solo los Developers pueden estimar elementos del Product Backlog — cualquier otro rol recibe `403 Forbidden` ([API de Product Backlog](docs/api/product-backlog.md)).                             |
| ¿Pueden el Product Owner o el Scrum Master redactar el Daily Scrum?            | Solo los Developers pueden redactar el registro diario o unirse a él; el Product Owner y el Scrum Master observan ([API de Daily Scrum](docs/api/daily-scrum.md)).                                |
| ¿Puede cancelar un Sprint alguien que no sea el Product Owner?                 | La cancelación es exclusiva del Product Owner, y solo mientras el Sprint está `ACTIVE` ([API de sprints](docs/api/sprints.md)).                                                                   |
| ¿Puede reescribirse un Increment ya entregado?                                 | Los Increments entregados quedan bloqueados frente a nuevas ediciones ([API de increments](docs/api/increments.md)).                                                                              |

**Donde Scrumooth deliberadamente no aplica nada:** la Prime Directive de la Sprint Retrospective queda en manos de quien facilita, y las timeboxes de los eventos se muestran mediante un temporizador compartido del equipo en lugar de dar por terminado un evento por la fuerza. La Guide pide autogestión exactamente en esos puntos, así que Scrumooth no decide por el equipo.

**Cómo se ve una barrera en la práctica.** Es viernes, el Sprint debe terminar, el Increment está desplegado — y la Sprint Retrospective nunca se programó. Una herramienta de registro cierra el Sprint y la Sprint Retrospective se pospone a la semana siguiente, que es el fallo que el evento final de la Guide existe para prevenir; Scrumooth rechaza el cierre hasta que ambos eventos queden registrados. El equipo celebra entonces la Sprint Retrospective, o se detiene y debate por qué no —la versión de esa decisión que la Guide espera que un equipo tome de forma consciente.

¿Por qué las herramientas que ya utiliza no van a añadir esto sin más? En nuestra opinión, porque una barrera que se puede desactivar es una configuración, no una regla, y la configurabilidad es su argumento de venta y no su descuido. Tampoco un servicio alojado puede prometer fácilmente que sus datos de proceso nunca saldrán de su infraestructura. Scrumooth no es una función que les falte; es una disyuntiva que ya han resuelto en el otro sentido.

Las barreras anteriores son toda la afirmación: si una regla no está en la tabla, Scrumooth no la aplica — y, dado que nunca se ofrece una configuración que rompa la Scrum Guide 2020, **la negativa es el producto.**

<a id="who-its-for"></a>

## 🎯 Para quién es

**Scrumooth está pensado para una situación concreta:** organizaciones lideradas por ingeniería que deben poder demostrar cómo se ejecutó realmente un Sprint y para las que los datos del proceso no pueden salir de su propia infraestructura — sectores regulados, sus proveedores y equipos del sector público.

**Scrumooth es para usted si…**

- Es **Scrum Master o Product Owner**, a su equipo le cuesta mantener la Scrum Guide 2020 y quiere que la herramienta rechace la deriva en lugar de permitirla en silencio.
- Lidera un **equipo de ingeniería** que quiere autohospedar sus datos de proceso por motivos de privacidad, cumplimiento normativo o soberanía de datos.
- Necesita un **registro defendible y auditable** de cómo se ejecutó realmente cada Sprint — quién cambió qué, cuándo y con qué rol.
- Quiere que los límites de la Scrum Guide se codifiquen una sola vez, para que los nuevos miembros del equipo aprendan el proceso usándolo.

**Scrumooth no es para usted si…**

- Busca una herramienta de seguimiento de incidencias de propósito general, un planificador de hoja de ruta o un tablero Kanban para trabajo que no sea Scrum. Scrumooth se niega a ser una de ellas.
- Quiere que todas las reglas sean configurables. Scrumooth rechaza las configuraciones que rompen la Scrum Guide.
- Quiere un SaaS totalmente gestionado. Scrumooth es autohospedado por diseño.
- Necesita gestión de carteras, planificación de recursos o seguimiento financiero en profundidad para muchos proyectos no relacionados.
- Sigue un marco escalado que adapta la Guide para una organización más amplia, o Scrum todavía no es la forma de trabajar de su equipo. Scrumooth aplica la Scrum Guide 2020 tal como está escrita, para un único Scrum Team.

<a id="why-you-can-trust-it"></a>

## 🛡 Por qué puede confiar en él

**Por qué no un servicio alojado**

- **Autohospedado por diseño.** Sus datos de proceso nunca salen de su infraestructura.
- **Soberanía de datos integrada.** La exportación de datos del RGPD, un periodo de gracia de 14 días para el borrado y el seguimiento del consentimiento vienen con el producto.
- **Auditable.** Cada cambio de rol y cada transición de estado se escriben en un registro de auditoría dedicado y separado por cumplimiento normativo.
- **Acceso acotado.** Las sesiones simultáneas están limitadas y las más antiguas se revocan automáticamente.

**Por qué no otra herramienta autohospedada**

- **Abierta e inspeccionable.** Apache-2.0, CI pública, cobertura publicada — se aplica una **barrera del 80 % en líneas, ramas, funciones y sentencias** en la canalización.
- **Probada bajo carga, no solo con pruebas unitarias.** 10 escenarios k6 predefinidos, incluido un pico de Sprint Planning. Consulte [Pruebas de carga](#load-testing-k6).
- **Estricta por construcción.** Modo estricto de TypeScript en el backend, el frontend y los paquetes compartidos.
- **Localizada donde importa.** La interfaz se ofrece en inglés, alemán, español, francés e italiano, con terminología Scrum procedente de la Scrum Guide oficial.

**Para quienes tienen que aprobarla internamente.** La guía de despliegue, la arquitectura de seguridad y el proceso de notificación de vulnerabilidades están documentados en el repositorio: [Despliegue](#deployment), [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) y [`SECURITY.md`](SECURITY.md).

<a id="features"></a>

## ✨ Características

### El flujo de trabajo Scrum

Todo lo necesario para ejecutar el Sprint — los cinco eventos, tres artefactos y tres compromisos de la Guide — con la regla que sostiene cada uno. Las cláusulas en negrita repiten las barreras de [Qué aplica Scrumooth](#what-scrumooth-enforces); esa tabla sigue siendo la única lista de reglas que Scrumooth reivindica.

- **Product Goal** - Alineación estratégica y seguimiento de objetivos; el compromiso al que sirve el backlog
- **Product Backlog** - Priorización MoSCoW (Must, Should, Could, Won't); **solo los Developers estiman el trabajo**
- **Sprint Planning** - Duraciones de Sprint configurables y planificación de la capacidad; **solo los Developers guardan el Sprint Backlog**
- **Sprint Execution** - Tablero Kanban interactivo con arrastrar y soltar; **solo el Product Owner puede cancelar, y solo mientras el Sprint está `ACTIVE`**
- **Daily Scrum** - Registro diario compartido, con afloramiento de Impediments; **solo los Developers lo redactan — el Product Owner y el Scrum Master observan**
- **Impediment** - Identificación de bloqueos y seguimiento de su resolución; **un Sprint no puede cerrarse antes de que se resuelvan sus Impediments**
- **Increment** - Gestión del Increment de producto; **en el momento en que un elemento del Product Backlog cumple la Definition of Done, nace un Increment**
- **Sprint Review** - Gestión de la revisión, comentarios de las partes interesadas y ajuste del backlog; **un Sprint no puede cerrarse antes de que se registre su Sprint Review**
- **Sprint Retrospective** - Reflexión del equipo y mejora con seguimiento; **un Sprint no puede cerrarse antes de que se registre su Sprint Retrospective**

### Gobernanza y operaciones

- **Motor de flujo de trabajo** - Permisos basados en roles y transiciones de estado controladas, **aplicadas en el servidor**
- **Definition of Done/Ready** - Listas de verificación personalizables; **nada está Done hasta que se supera su lista de verificación**
- **Integridad de los Increments** - **El trabajo entregado no puede reescribirse en silencio**

### Equipo y organización

- **Composición del equipo** - Un Product Owner y un Scrum Master; **tamaño del equipo limitado** (`TEAM_MAX_SIZE`, por defecto `10`)
- **Registro de auditoría** - Registro dedicado y separado por cumplimiento normativo; **cada cambio de rol y cada transición de estado registrados**
- **Panel e informes** - Métricas y visualizaciones en tiempo real
- **Comunicación del equipo** - Notificaciones y mensajería integradas
- **Team Health Check** - Comprobación periódica frente a los cinco valores de Scrum
- **Timeboxes de eventos compartidas** - Un reloj para todos los participantes; **las timeboxes se muestran, nunca se cierran a la fuerza**
- **Controles de privacidad** - Derechos de exportación y borrado de datos, además de seguimiento del consentimiento

<a id="tech-stack"></a>

## 🛠 Stack tecnológico

### Backend

- **Runtime:** Node.js 24+
- **Framework:** Express.js 5
- **Lenguaje:** TypeScript (modo estricto)
- **Base de datos:** PostgreSQL 18+ con Prisma ORM 7
- **Autenticación:** JWT con bcrypt
- **Validación:** Zod
- **Trabajos programados:** node-cron
- **Correo electrónico:** Nodemailer (proveedores SMTP, SendGrid, AWS SES)
- **Registro:** Winston con transports de archivos rotativos

### Frontend

- **Framework:** React 19 con Vite
- **Lenguaje:** TypeScript (modo estricto)
- **Enrutamiento:** React Router 8
- **Gestión de estado:** TanStack Query (React Query) + Zustand
- **Visualización:** Chart.js
- **Estilos:** CSS Modules con Design Tokens
- **Seguimiento de errores:** Sentry (opcional, vía `VITE_SENTRY_DSN`)

### Compartido

- Tipos e interfaces de TypeScript
- Constantes y enumeraciones
- Funciones de utilidad

### Pruebas y calidad

- **Unitarias / Integración:** Vitest
- **End-to-End:** Playwright (frontend) + Vitest (backend)
- **Pruebas de carga:** k6 (10 escenarios predefinidos)
- **Linting:** ESLint + Stylelint
- **Formato:** Prettier
- **Git Hooks:** Husky + lint-staged

<a id="project-structure"></a>

## 📁 Estructura del proyecto

```
scrumooth/
├── packages/
│   ├── backend/              # API REST Express.js
│   │   ├── src/
│   │   │   ├── controllers/  # Manejadores de rutas API
│   │   │   ├── services/     # Capa de lógica de negocio
│   │   │   ├── middleware/   # Middleware de Express
│   │   │   ├── routes/       # Definiciones de rutas API
│   │   │   ├── utils/        # Funciones de utilidad
│   │   │   └── __tests__/    # Pruebas unitarias, de integración y e2e
│   │   ├── prisma/           # Esquema de base de datos y migraciones
│   │   ├── Dockerfile        # Imagen de producción
│   │   └── Dockerfile.dev    # Imagen de desarrollo
│   ├── frontend/             # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/   # Componentes React
│   │   │   ├── pages/        # Páginas a nivel de ruta
│   │   │   ├── hooks/        # Hooks de React personalizados
│   │   │   ├── services/     # Servicios de cliente API
│   │   │   ├── stores/       # Stores de Zustand
│   │   │   └── styles/       # CSS y design tokens
│   │   ├── e2e/              # Pruebas end-to-end de Playwright
│   │   ├── Dockerfile        # Imagen de producción
│   │   └── Dockerfile.dev    # Imagen de desarrollo
│   └── shared/               # Tipos, constantes y utilidades compartidas
├── docs/
│   ├── api/                  # Referencia de la API REST
│   ├── architecture/         # Diseño del sistema, modelo de datos, seguridad
│   ├── deployment/           # Guías de despliegue
│   └── user-guide/           # Documentación y guías de usuario
├── k6/                       # Escenarios de pruebas de carga (k6)
│   └── scripts/scenarios/    # escenarios de pruebas de carga predefinidos
├── scripts/                  # Scripts de build y utilidades
├── .github/workflows/        # CI, Release y despliegue en GitHub Pages
├── docker-compose.yml        # Docker Compose de producción
├── docker-compose.dev.yml    # Docker Compose de desarrollo
├── CHANGELOG.md              # Historial de versiones
├── SECURITY.md               # Política de seguridad y reportes
├── CONTRIBUTING.md           # Directrices de contribución
├── CODE_OF_CONDUCT.md        # Código de conducta de la comunidad
└── THIRD-PARTY-NOTICES.md    # Atribuciones de licencias de terceros
```

<a id="quick-start"></a>

## ⚡ Inicio rápido

La forma más rápida de ejecutar una instancia local es con Docker Compose:

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
cp packages/backend/.env.production.example packages/backend/.env.production
docker compose up -d
```

Esto inicia el proxy inverso Caddy, el backend, el frontend y PostgreSQL. Una vez en ejecución, abra <http://localhost> (HTTPS está habilitado por defecto en el puerto 443). Para una configuración manual completa (sin Docker), consulte [Instalación](#installation).

> **Nota:** El stack de Compose de producción requiere `packages/backend/.env.production`. Si prefiere un entorno de desarrollo completamente preconfigurado con recarga en caliente, utilice `docker compose -f docker-compose.dev.yml up` en su lugar.

<a id="prerequisites"></a>

## 📋 Requisitos previos

- **Node.js** v24.19.0 o superior
- **pnpm** v11.21.0 o superior
- **PostgreSQL** v18 o superior
- **Docker** y **Docker Compose** (opcional, para el inicio rápido)

<a id="installation"></a>

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
```

### 2. Instalar dependencias

Este proyecto utiliza pnpm como gestor de paquetes. El proyecto exige pnpm mediante scripts de preinstalación.

```bash
pnpm install
```

### 3. Configuración del entorno

Copie los archivos de entorno de ejemplo y configure sus ajustes:

```bash
# Backend configuration
cp packages/backend/.env.example packages/backend/.env

# Frontend configuration
cp packages/frontend/.env.example packages/frontend/.env
```

Edite los archivos de entorno con su configuración:

**Backend** (`packages/backend/.env`):

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/scrumooth

# JWT Configuration (generate with: openssl rand -hex 64)
JWT_SECRET=your-64-character-secret-key-here

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Optional: restrict new-account registration to specific email domains.
# Leave empty/unset for open registration. Enforced server-side (HTTP 403 on
# disallowed domains). Tenant-control gate only, not email verification.
REGISTRATION_ALLOWED_EMAIL_DOMAINS=example.com,example.eu
```

**Frontend** (`packages/frontend/.env`):

```env
# Backend API URL
VITE_API_URL=http://localhost:5001/api/v1

# Use mock API (set to false for real backend)
VITE_USE_MOCK_API=false
```

### 4. Configuración de la base de datos

Genere el cliente de Prisma y luego cree el esquema de su base de datos. Para el desarrollo local puede utilizar cualquiera de los dos enfoques:

```bash
# Generate Prisma client (always required)
pnpm run db:generate

# Option A: Push schema directly (fast iteration, no migration files)
pnpm run db:push

# Option B: Create and apply a migration (recommended for tracked changes)
pnpm run db:migrate
```

Para despliegues en producción, utilice `pnpm run db:migrate:prod` para aplicar las migraciones existentes sin solicitudes interactivas.

### 5. Iniciar el servidor de desarrollo

```bash
pnpm run dev
```

Esto iniciará los servidores de backend y frontend de forma simultánea. Para ejecutarlos de forma independiente:

```bash
pnpm run dev:backend    # Backend only (http://localhost:5001)
pnpm run dev:frontend   # Frontend only (http://localhost:5173)
```

<a id="development-commands"></a>

## 🛠 Comandos de desarrollo habituales

Para quienes desarrollan, la analogía más cercana es un linter para su proceso Scrum — con la diferencia que importa: un linter informa de una infracción, una barrera la rechaza.

Los comandos más comunes para el desarrollo diario:

| Tarea                        | Comando                 |
| ---------------------------- | ----------------------- |
| Iniciar backend + frontend   | `pnpm run dev`          |
| Iniciar solo backend         | `pnpm run dev:backend`  |
| Iniciar solo frontend        | `pnpm run dev:frontend` |
| Construir todos los paquetes | `pnpm run build`        |

<a id="testing"></a>

## 🧪 Pruebas

```bash
pnpm run test              # Todas las pruebas
pnpm run test:coverage     # Con informe de cobertura
pnpm run test:unit         # Solo pruebas unitarias
pnpm run test:integration  # Pruebas de integración del backend
pnpm run test:e2e          # End-to-end (backend Vitest + frontend Playwright)
pnpm run test:watch        # Modo watch
```

Umbrales de cobertura aplicados: **80 % de líneas, funciones, sentencias y ramas**.

<a id="load-testing-k6"></a>

### Pruebas de carga (k6)

Los escenarios de pruebas de carga predefinidos se encuentran en [`k6/scripts/scenarios/`](k6/scripts/scenarios). Copie [`k6/.env.k6.example`](k6/.env.k6.example) a `k6/.env.k6`, configure su destino y, a continuación, ejecute un escenario como:

```bash
pnpm run loadtest:normal    # Realistic everyday load
pnpm run loadtest:peak      # Sprint planning rush (worst-case concurrency)
pnpm run loadtest:stress    # Push the system until it breaks
```

> **Requisito previo:** Instale [k6](https://k6.io/docs/get-started/installation/) y asegúrese de que su backend de destino esté en ejecución. Hay diez escenarios en [`k6/scripts/scenarios/`](k6/scripts/scenarios); los scripts `loadtest:*` de [`package.json`](package.json) exponen ocho de ellos, incluidos endurance, multi-team, daily-scrum, auth y database stress.

<a id="code-quality"></a>

## 🔍 Calidad del código

| Tarea                  | Comando              |
| ---------------------- | -------------------- |
| Lint (ESLint)          | `pnpm run lint`      |
| Lint y autocorrección  | `pnpm run lint:fix`  |
| Lint CSS (Stylelint)   | `pnpm run lint:css`  |
| Formato (Prettier)     | `pnpm run format`    |
| Verificación de tipos  | `pnpm run typecheck` |
| Auditoría de seguridad | `pnpm run audit`     |

Consulte [`CONTRIBUTING.md`](CONTRIBUTING.md) para conocer el flujo de trabajo de desarrollo completo y las barreras de calidad.

<a id="database-management"></a>

## 🗄 Gestión de la base de datos

```bash
pnpm run db:generate     # Generar el cliente Prisma (tras cambios de esquema)
pnpm run db:migrate      # Crear y aplicar una migración (desarrollo)
pnpm run db:migrate:prod # Aplicar migraciones en producción (no interactivo)
pnpm run db:studio       # Abrir Prisma Studio (GUI de base de datos)
```

Comandos de base de datos adicionales (`db:push`, `db:reset`, `db:validate`, `db:migrate:test`) están documentados en [`CONTRIBUTING.md`](CONTRIBUTING.md).

<a id="docker-support"></a>

## 🐳 Soporte de Docker

El proyecto incluye configuración de Docker tanto para desarrollo como para despliegue en producción.

### Usar Docker Compose

```bash
# Development environment (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production environment (detached)
docker compose up -d

# Tear down
docker compose down
```

### Construir imágenes Docker manualmente

> **Nota:** Todos los Dockerfiles referencian rutas relativas a la raíz del repositorio (archivos del workspace del monorepo como `package.json`, `pnpm-lock.yaml` y `packages/shared/`). Debe construirlos desde la **raíz del repositorio** y usar `-f` para apuntar al Dockerfile — pasar el directorio del paquete como contexto de build fallará.

```bash
# Development images (with dev dependencies and watch mode)
docker build -t scrumooth-backend:dev -f packages/backend/Dockerfile.dev .
docker build -t scrumooth-frontend:dev -f packages/frontend/Dockerfile.dev .

# Production images (build from the repo root)
docker build -t scrumooth-backend -f packages/backend/Dockerfile .
docker build -t scrumooth-frontend -f packages/frontend/Dockerfile .
```

<details>
<summary>Usar un mirror de registry/apt</summary>

Si se encuentra detrás de una red que requiere un registry de npm o un mirror de apt, puede configurarlos como argumentos de build o variables de entorno:

```bash
# Docker Compose
$env:NPM_REGISTRY="https://your_mirror_url"
$env:APT_MIRROR="your_mirror_url"

# Manual build
docker build --build-arg NPM_REGISTRY=https://your_mirror_url --build-arg APT_MIRROR=your_mirror_url .
```

</details>

<a id="deployment"></a>

## ☁️ Despliegue

### Producción autohospedada

Consulte [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) para obtener una guía completa de despliegue en producción, que cubre la configuración del entorno, la migración de la base de datos, la configuración del proxy inverso y las buenas prácticas operativas.

### Despliegue de la demo en GitHub Pages

La rama `main` se despliega automáticamente en GitHub Pages mediante el workflow [`Deploy to GitHub Pages`](.github/workflows/deploy-github-pages.yml), utilizando una **Mock API** en memoria (no requiere backend ni base de datos). Consulte la [Demo en vivo](#live-demo) más arriba para probarla.

<a id="documentation"></a>

## 📚 Documentación

| Área                          | Ubicación                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Guía de usuario**           | [`docs/user-guide/`](docs/user-guide) — primeros pasos, características principales, flujos de trabajo Scrum                      |
| **Referencia de la API REST** | [`docs/api/`](docs/api) — grupos de endpoints que cubren autenticación, sprints, backlog, informes y más                          |
| **Arquitectura del sistema**  | [`docs/architecture/`](docs/architecture) — diseño del sistema, modelo de datos, diseño de componentes, arquitectura de seguridad |
| **Guía de despliegue**        | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)                                                                  |
| **Política de seguridad**     | [`SECURITY.md`](SECURITY.md) — procedimiento de reporte de vulnerabilidades                                                       |
| **Contribuciones**            | [`CONTRIBUTING.md`](CONTRIBUTING.md) — directrices y flujo de trabajo de desarrollo                                               |
| **Código de conducta**        | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — normas de la comunidad                                                               |
| **Historial de releases**     | [`CHANGELOG.md`](CHANGELOG.md)                                                                                                    |
| **Avisos de terceros**        | [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)                                                                                |

<a id="troubleshooting"></a>

## 🛟 Solución de problemas

### `Cannot find module @scrumooth/shared`

El paquete compartido debe compilarse antes de que el backend o el frontend puedan resolver las importaciones.

```bash
pnpm --filter=@scrumooth/shared run build
```

Esto normalmente se gestiona automáticamente mediante `pnpm install` y los scripts de desarrollo, pero es necesario tras un `pnpm run clean` manual.

### `pnpm install` falla con "Use pnpm instead"

El repositorio exige pnpm mediante un script `preinstall`. Instale pnpm globalmente:

```bash
npm install -g pnpm@11.21.0
```

### Errores de conexión a la base de datos al iniciar

Verifique que su `DATABASE_URL` en `packages/backend/.env` apunte a una instancia de PostgreSQL 18+ en ejecución y que la base de datos exista. Ejecute `pnpm run db:validate` para validar el esquema de Prisma contra la conexión.

### Puerto ya en uso (5001 o 5173)

Los puertos predeterminados se pueden sobrescribir mediante variables de entorno:

- Backend: `PORT` en `packages/backend/.env`
- Frontend: `VITE_DEV_PORT` en `packages/frontend/.env`

### El frontend no puede alcanzar el backend

Compruebe que `VITE_API_URL` en `packages/frontend/.env` coincida con la dirección real del backend y que `CORS_ORIGIN` en `packages/backend/.env` permita el origen del frontend.

### ¿Quiere desarrollar sin un backend?

Establezca `VITE_USE_MOCK_API=true` en `packages/frontend/.env` para usar la misma Mock API que impulsa la demo en vivo.

<a id="roadmap"></a>

## 🗺 Hoja de ruta

Scrumooth está en desarrollo activo. Las siguientes prioridades profundizan en lo que Scrumooth aplica, en lugar de ampliarlo hacia una herramienta de seguimiento de propósito general:

- [ ] **Informe de conformidad con la Scrum Guide** — una declaración por Sprint de qué reglas se aplicaron y cómo se cumplió cada una
- [ ] **Paquete de evidencias del Sprint exportable** — un registro compartible para auditorías y revisiones de cumplimiento
- [ ] **Más reglas aplicables** — ampliar la superficie cubierta de la Scrum Guide 2020
- [ ] **Mayor automatización de la Definition of Done / Definition of Ready**
- [ ] **Informes que afloren la deriva del proceso**, no solo métricas de entrega
- [ ] **Integraciones y webhooks**, para que Scrumooth conviva con las herramientas que ya utiliza
- [ ] Refuerzo del rendimiento y la escalabilidad

El estado del proyecto y los últimos cambios se registran en el [CHANGELOG](CHANGELOG.md). Los comentarios y las solicitudes de funciones son bienvenidos a través de [GitHub Issues](https://github.com/orbivort/scrumooth/issues).

<a id="contributing"></a>

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Lea [`CONTRIBUTING.md`](CONTRIBUTING.md) para conocer el flujo de trabajo de desarrollo, los estándares de código y el proceso de pull request, y revise el [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) antes de participar.

<a id="license"></a>

## 📝 Licencia

Este proyecto está licenciado bajo la [Apache License 2.0](LICENSE).

---

_Juzgue una herramienta Scrum por las reglas que respeta, no por los tableros que dibuja._
