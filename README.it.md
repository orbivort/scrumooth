# Scrumooth — lo Scrum Guide, applicato.

**Giudica uno strumento Scrum dalle regole che rispetta, non dalle board che disegna.**

**Scrumooth** è un'applicazione web self-hosted e open source per i team che fanno Scrum. È pensata per Scrum Master, Product Owner e team guidati dall'ingegneria che vogliono che il processo si misuri con la Guide. Trasforma le regole della **Scrum Guide 2020** in barriere che il backend applica ovunque uno strumento possa farlo — e dichiara i punti in cui deliberatamente non lo fa.

**Non** è un sostituto del tuo strumento di tracciamento delle issue. Come livello di applicazione della Scrum Guide che il tuo strumento non ha, è proprietario del ciclo di vita dello Sprint, dei ruoli e delle barriere, e rifiuta che una violazione del processo passi in silenzio. Il tuo strumento conserva il tuo registro; questo conserva le tue regole. Ogni regola che applica è elencata in [Cosa applica Scrumooth](#what-scrumooth-enforces) — e nessuna regola al di fuori di quell'elenco viene rivendicata.

Gestire un secondo strumento ha un costo reale — qualcos'altro da distribuire, proteggere, sottoporre a backup e mantenere. Scrumooth è deliberatamente il sistema più piccolo in grado di sostenerlo: un unico stack Compose —reverse proxy, backend, frontend, PostgreSQL e backup pianificati— e un solo database di cui occuparsi.

> **Lingue:** [English](README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Italiano](README.it.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml/badge.svg)](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/orbivort/scrumooth/graph/badge.svg)](https://codecov.io/github/orbivort/scrumooth)
[![GitHub release](https://img.shields.io/github/v/release/orbivort/scrumooth?include_prereleases)](https://github.com/orbivort/scrumooth/releases)
[![GitHub issues](https://img.shields.io/github/issues/orbivort/scrumooth)](https://github.com/orbivort/scrumooth/issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791.svg)](https://www.postgresql.org/)

<p align="center">
  <img src="docs/screenshots/scrumooth_it.png" alt="Scrumooth" width="800" />
</p>

<a id="live-demo"></a>

## 🖥️ Demo dal vivo

Prova subito Scrumooth nel tuo browser, senza alcuna installazione. La demo viene eseguita con dati simulati (nessun backend necessario), così puoi esplorare immediatamente l'intero ciclo di vita di Scrum.

<p align="center">
  <a href="https://orbivort.github.io/scrumooth/" target="_blank" rel="noopener noreferrer">
    <strong>👉 Avvia la demo dal vivo su GitHub Pages</strong>
  </a>
</p>

> **Nota:** La demo utilizza dati simulati in memoria — qualsiasi modifica apporti è locale alla sessione del browser e viene azzerata al refresh. Per dati persistenti e collaborazione multi-utente, segui la guida all'[Installazione](#installation) per ospitare autonomamente la tua istanza.

---

## Indice

**Capire Scrumooth**

- [Demo dal vivo](#live-demo)
- [Il manifesto](#the-manifesto)
- [Cosa applica Scrumooth](#what-scrumooth-enforces)
- [A chi è destinato](#who-its-for)
- [Perché puoi fidarti](#why-you-can-trust-it)
- [Funzionalità](#features)

**Self-hosting e sviluppo**

- [Stack tecnologico](#tech-stack)
- [Struttura del progetto](#project-structure)
- [Avvio rapido](#quick-start)
- [Prerequisiti](#prerequisites)
- [Installazione](#installation)
- [Comandi di sviluppo più comuni](#development-commands)
- [Test](#testing)
- [Test di carico (k6)](#load-testing-k6)
- [Qualità del codice](#code-quality)
- [Gestione del database](#database-management)
- [Supporto Docker](#docker-support)
- [Distribuzione](#deployment)
- [Risoluzione dei problemi](#troubleshooting)

**Progetto**

- [Documentazione](#documentation)
- [Roadmap](#roadmap)
- [Contribuire](#contributing)
- [Licenza](#license)

---

<a id="the-manifesto"></a>

## 📜 Il manifesto — Perché Scrumooth esiste

> La maggior parte degli strumenti di gestione dei progetti è costruita per **registrare** ciò che è accaduto. Ti danno board, registrano i tuoi clic, disegnano grafici accurati —dopo che lo Sprint è finito. Registrare è davvero utile, e quegli strumenti lo fanno bene.
>
> Ma un registro è una descrizione, non una decisione. La Scrum Guide 2020 è piena di regole a cui uno strumento potrebbe tenerti: uno Sprint si chiude solo dopo il suo Sprint Review e la sua Sprint Retrospective, solo i Developers stimano il lavoro, un solo Product Owner possiede il Product Backlog, e «Done» significa che la Definition of Done è stata soddisfatta. Quando una di queste scivola —uno Sprint chiuso prima che si sia tenuta la sua Sprint Retrospective, un Product Owner che stima il lavoro per conto dei Developers, un elemento contrassegnato come Done senza che i suoi criteri siano stati verificati—, di solito quella violazione resta invisibile fino alla fine dello Sprint. Nella maggior parte degli strumenti queste regole sono indicative: una comprensione condivisa di cui ci si fida che il team ricordi.
>
> **Scrumooth le tratta come regole.**
>
> La disciplina non è l'ingrediente mancante —se bastasse da sola, nessun team avrebbe mai chiuso uno Sprint senza la sua Sprint Retrospective. La Guide dice a un team cosa fare; non può accorgersi quando il team smette di farlo. Per questo integriamo la **Scrum Guide 2020** come codice eseguibile e la **facciamo rispettare** lato server, dove né l'interfaccia né una chiamata diretta all'API possono aggirarla. Siamo un **guardiano, non un annotatore**.
>
> Meno dibattiti sui processi. Più tempo per consegnare software funzionante.

<a id="what-scrumooth-enforces"></a>

## 🔒 Cosa applica Scrumooth

Queste sono barriere, non avvisi o suggerimenti. In tutti i casi seguenti la risposta è no — e ogni risposta vale nel livello di servizio del backend, così che una scorciatoia nel frontend non possa aggirarla.

| Una regola della Scrum Guide 2020, posta come domanda                                      | La risposta di Scrumooth                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uno Sprint può essere chiuso prima del suo Sprint Review e della sua Sprint Retrospective? | Il completamento dello Sprint viene rifiutato finché entrambi gli eventi non sono registrati ([API sprints](docs/api/sprints.md)).                                                                    |
| Un elemento può essere chiamato Done senza la sua Definition of Done?                      | Completare uno Sprint non contrassegna mai gli elementi come Done — ogni elemento deve superare la sua checklist della Definition of Done ([API Definition of Done](docs/api/definition-of-done.md)). |
| Un team può avere più di un Product Owner o più di un Scrum Master?                        | L'aggiunta di un secondo titolare di uno dei due ruoli viene rifiutata ([API teams](docs/api/teams.md)).                                                                                              |
| Un team può superare la dimensione di uno Scrum Team?                                      | La dimensione del team è limitata — `TEAM_MAX_SIZE`, predefinito `10` ([API teams](docs/api/teams.md)).                                                                                               |
| Qualcuno che non sia un Developer può stimare il lavoro?                                   | Solo i Developers possono stimare gli elementi del Product Backlog — ogni altro ruolo riceve `403 Forbidden` ([API Product Backlog](docs/api/product-backlog.md)).                                    |
| Il Product Owner o lo Scrum Master possono redigere il Daily Scrum?                        | Solo i Developers possono redigere o partecipare al registro giornaliero; il Product Owner e lo Scrum Master osservano ([API Daily Scrum](docs/api/daily-scrum.md)).                                  |
| Uno Sprint può essere annullato da qualcuno che non sia il Product Owner?                  | L'annullamento è riservato al Product Owner, e solo mentre lo Sprint è `ACTIVE` ([API sprints](docs/api/sprints.md)).                                                                                 |
| Un Increment consegnato può essere riscritto?                                              | Gli Increments consegnati sono bloccati contro ulteriori modifiche ([API increments](docs/api/increments.md)).                                                                                        |

**Dove Scrumooth deliberatamente non applica nulla:** la Prime Directive della Sprint Retrospective resta a chi facilita, e le timebox degli eventi vengono mostrate tramite un timer condiviso del team invece di terminare un evento con la forza. La Guide chiede l'autogestione esattamente in quei punti, quindi Scrumooth non decide al posto del team.

**Come si presenta una barriera nella pratica.** È venerdì, lo Sprint deve concludersi, l'Increment è distribuito — e la Sprint Retrospective non è mai stata pianificata. Uno strumento di registrazione chiude lo Sprint e la Sprint Retrospective slitta alla settimana successiva, che è il fallimento che l'ultimo evento della Guide esiste per prevenire; Scrumooth rifiuta la chiusura finché entrambi gli eventi non sono registrati. Il team tiene allora la Sprint Retrospective, oppure si ferma e discute perché no —la versione di quella decisione che la Guide si aspetta che un team prenda consapevolmente.

Perché gli strumenti che già usi non aggiungono semplicemente tutto questo? A nostro avviso, perché una barriera che si può disattivare è un'impostazione, non una regola, e la configurabilità è il loro argomento di vendita e non una loro dimenticanza. Né un servizio ospitato può promettere facilmente che i tuoi dati di processo non lasceranno mai la tua infrastruttura. Scrumooth non è una funzionalità che manca loro; è un compromesso che hanno già preso nella direzione opposta.

Le barriere qui sopra sono l'intera rivendicazione: se una regola non è nella tabella, Scrumooth non la applica — e poiché una configurazione che infrange la Scrum Guide 2020 non viene mai offerta, **il rifiuto è il prodotto.**

<a id="who-its-for"></a>

## 🎯 A chi è destinato

**Scrumooth è pensato per una situazione in particolare:** organizzazioni guidate dall'ingegneria che devono poter dimostrare come uno Sprint è stato realmente condotto, e per cui i dati di processo non possono lasciare la propria infrastruttura — settori regolamentati, i loro fornitori e team del settore pubblico.

**Scrumooth fa per te se…**

- Sei uno **Scrum Master o un Product Owner**, il tuo team fatica a tenere la Scrum Guide 2020 e vuoi che lo strumento rifiuti la deriva invece di permetterla in silenzio.
- Guidi un **team di ingegneria** che vuole ospitare autonomamente i propri dati di processo per ragioni di privacy, conformità o sovranità dei dati.
- Hai bisogno di un **registro difendibile e verificabile** di come ogni Sprint è stato realmente condotto — chi ha cambiato cosa, quando e con quale ruolo.
- Vuoi che i confini della Scrum Guide siano codificati una volta sola, così che i nuovi membri del team imparino il processo usandolo.

**Scrumooth non fa per te se…**

- Cerchi uno strumento di tracciamento delle issue generalista, un pianificatore di roadmap o una board Kanban per lavoro non Scrum. Scrumooth si rifiuta di essere uno di questi.
- Vuoi che ogni regola sia configurabile. Scrumooth rifiuta le configurazioni che infrangono la Scrum Guide.
- Vuoi un SaaS completamente gestito. Scrumooth è self-hosted per progettazione.
- Hai bisogno di gestione di portafoglio, pianificazione delle risorse o monitoraggio finanziario approfonditi su molti progetti non correlati.
- Segui un framework scalato che adatta la Guide per un'organizzazione più ampia, oppure Scrum non è ancora il modo di lavorare del tuo team. Scrumooth applica la Scrum Guide 2020 così com'è scritta, per un singolo Scrum Team.

<a id="why-you-can-trust-it"></a>

## 🛡 Perché puoi fidarti

**Perché non un servizio ospitato**

- **Self-hosted per progettazione.** I tuoi dati di processo non lasciano mai la tua infrastruttura.
- **Sovranità dei dati integrata.** L'esportazione dei dati GDPR, un periodo di tolleranza di 14 giorni per la cancellazione e il tracciamento del consenso fanno parte del prodotto.
- **Verificabile.** Ogni cambio di ruolo e ogni transizione di stato vengono scritti in un registro di audit dedicato e separato per la conformità.
- **Accesso limitato.** Le sessioni simultanee sono limitate e le più vecchie vengono revocate automaticamente.

**Perché non un altro strumento self-hosted**

- **Aperto e ispezionabile.** Apache-2.0, CI pubblica, copertura pubblicata — una **barriera dell'80 % su righe, rami, funzioni e istruzioni** è applicata nella pipeline.
- **Testato sotto carico, non solo con test unitari.** 10 scenari k6 predefiniti, tra cui un picco di Sprint Planning. Vedi [Test di carico](#load-testing-k6).
- **Rigido per costruzione.** Modalità strict di TypeScript su backend, frontend e pacchetti condivisi.
- **Localizzato dove conta.** L'interfaccia è disponibile in inglese, tedesco, spagnolo, francese e italiano, con terminologia Scrum presa dalla Scrum Guide ufficiale.

**Per chi deve approvarlo internamente.** La guida alla distribuzione, l'architettura di sicurezza e il processo di segnalazione delle vulnerabilità sono documentati nel repository: [Distribuzione](#deployment), [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) e [`SECURITY.md`](SECURITY.md).

<a id="features"></a>

## ✨ Funzionalità

### Il flusso di lavoro Scrum

Tutto ciò che serve per condurre lo Sprint — i cinque eventi, tre artefatti e tre impegni della Guide — con la regola che ciascuno sostiene. Le clausole in grassetto ripetono le barriere di [Cosa applica Scrumooth](#what-scrumooth-enforces); quella tabella resta l'unico elenco di regole che Scrumooth rivendica.

- **Product Goal** - Allineamento strategico e monitoraggio degli obiettivi; l'impegno a cui serve il backlog
- **Product Backlog** - Prioritizzazione MoSCoW (Must, Should, Could, Won't); **solo i Developers stimano il lavoro**
- **Sprint Planning** - Durate dello Sprint configurabili e pianificazione della capacità; **solo i Developers salvano lo Sprint Backlog**
- **Sprint Execution** - Board Kanban interattiva con drag-and-drop; **solo il Product Owner può annullare, e solo mentre lo Sprint è `ACTIVE`**
- **Daily Scrum** - Registro giornaliero condiviso, con emersione degli Impediments; **solo i Developers lo redigono — il Product Owner e lo Scrum Master osservano**
- **Impediment** - Identificazione dei blocchi e monitoraggio della risoluzione; **uno Sprint non può chiudersi prima che i suoi Impediments siano risolti**
- **Increment** - Gestione dell'Increment di prodotto; **nel momento in cui un elemento del Product Backlog soddisfa la Definition of Done, nasce un Increment**
- **Sprint Review** - Gestione della revisione, feedback degli stakeholder e adeguamento del backlog; **uno Sprint non può chiudersi prima che il suo Sprint Review sia registrato**
- **Sprint Retrospective** - Riflessione del team e miglioramento monitorato; **uno Sprint non può chiudersi prima che la sua Sprint Retrospective sia registrata**

### Governance e operatività

- **Motore di workflow** - Permessi basati sui ruoli e transizioni di stato controllate, **applicate lato server**
- **Definition of Done/Ready** - Checklist personalizzabili; **nulla è Done finché la sua checklist non è superata**
- **Integrità degli Increments** - **Il lavoro consegnato non può essere riscritto in silenzio**

### Team e organizzazione

- **Composizione del team** - Un Product Owner e uno Scrum Master; **dimensione del team limitata** (`TEAM_MAX_SIZE`, predefinito `10`)
- **Registrazione di audit** - Registro dedicato e separato per la conformità; **ogni cambio di ruolo e ogni transizione di stato registrati**
- **Dashboard e reportistica** - Metriche e visualizzazioni in tempo reale
- **Comunicazione del team** - Notifiche e messaggistica integrate
- **Team Health Check** - Verifica periodica rispetto ai cinque valori Scrum
- **Timebox degli eventi condivise** - Un unico orologio per tutti i partecipanti; **le timebox vengono mostrate, mai chiuse con la forza**
- **Controlli sulla privacy** - Diritti di esportazione e cancellazione dei dati, più tracciamento del consenso

<a id="tech-stack"></a>

## 🛠 Stack tecnologico

### Backend

- **Runtime:** Node.js 24+
- **Framework:** Express.js 5
- **Linguaggio:** TypeScript (modalità strict)
- **Database:** PostgreSQL 18+ con Prisma ORM 7
- **Autenticazione:** JWT con bcrypt
- **Validazione:** Zod
- **Job pianificati:** node-cron
- **Email:** Nodemailer (provider SMTP, SendGrid, AWS SES)
- **Logging:** Winston con transport di file rotanti

### Frontend

- **Framework:** React 19 con Vite
- **Linguaggio:** TypeScript (modalità strict)
- **Routing:** React Router 8
- **Gestione dello stato:** TanStack Query (React Query) + Zustand
- **Visualizzazione:** Chart.js
- **Stili:** CSS Modules con Design Token
- **Monitoraggio errori:** Sentry (opzionale, via `VITE_SENTRY_DSN`)

### Condiviso

- Tipi e interfacce TypeScript
- Costanti ed enumerazioni
- Funzioni di utilità

### Test e qualità

- **Unitari / Integrazione:** Vitest
- **End-to-End:** Playwright (frontend) + Vitest (backend)
- **Test di carico:** k6 (10 scenari predefiniti)
- **Linting:** ESLint + Stylelint
- **Formattazione:** Prettier
- **Git Hook:** Husky + lint-staged

<a id="project-structure"></a>

## 📁 Struttura del progetto

```
scrumooth/
├── packages/
│   ├── backend/              # API REST Express.js
│   │   ├── src/
│   │   │   ├── controllers/  # Gestori delle route API
│   │   │   ├── services/     # Livello di logica di business
│   │   │   ├── middleware/   # Middleware Express
│   │   │   ├── routes/       # Definizioni delle route API
│   │   │   ├── utils/        # Funzioni di utilità
│   │   │   └── __tests__/    # Test unitari, di integrazione ed e2e
│   │   ├── prisma/           # Schema del database e migrazioni
│   │   ├── Dockerfile        # Immagine di produzione
│   │   └── Dockerfile.dev    # Immagine di sviluppo
│   ├── frontend/             # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/   # Componenti React
│   │   │   ├── pages/        # Pagine a livello di route
│   │   │   ├── hooks/        # Hook React personalizzati
│   │   │   ├── services/     # Servizi client API
│   │   │   ├── stores/       # Store Zustand
│   │   │   └── styles/       # CSS e design token
│   │   ├── e2e/              # Test end-to-end Playwright
│   │   ├── Dockerfile        # Immagine di produzione
│   │   └── Dockerfile.dev    # Immagine di sviluppo
│   └── shared/               # Tipi, costanti e utilità condivisi
├── docs/
│   ├── api/                  # Riferimento API REST
│   ├── architecture/         # Progettazione del sistema, modello dati, sicurezza
│   ├── deployment/           # Guide alla distribuzione
│   └── user-guide/           # Documentazione e guide per l'utente
├── k6/                       # Scenari di test di carico (k6)
│   └── scripts/scenarios/    # scenari di test di carico predefiniti
├── scripts/                  # Script di build e di utilità
├── .github/workflows/        # CI, Release e distribuzione GitHub Pages
├── docker-compose.yml        # Docker Compose di produzione
├── docker-compose.dev.yml    # Docker Compose di sviluppo
├── CHANGELOG.md              # Cronologia delle versioni
├── SECURITY.md               # Politica di sicurezza e segnalazione
├── CONTRIBUTING.md           # Linee guida per i contributi
├── CODE_OF_CONDUCT.md        # Codice di condotta della community
└── THIRD-PARTY-NOTICES.md    # Attribuzioni delle licenze di terze parti
```

<a id="quick-start"></a>

## ⚡ Avvio rapido

Il modo più rapido per eseguire un'istanza locale è usare Docker Compose:

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
cp packages/backend/.env.production.example packages/backend/.env.production
docker compose up -d
```

Questo avvia il reverse proxy Caddy, il backend, il frontend e PostgreSQL. Una volta in esecuzione, apri <http://localhost> (HTTPS è abilitato per impostazione predefinita sulla porta 443). Per una configurazione manuale completa (senza Docker), consulta [Installazione](#installation).

> **Nota:** Lo stack Compose di produzione richiede `packages/backend/.env.production`. Se preferisci un ambiente di sviluppo completamente preconfigurato con hot reload, usa invece `docker compose -f docker-compose.dev.yml up`.

<a id="prerequisites"></a>

## 📋 Prerequisiti

- **Node.js** v24.19.0 o superiore
- **pnpm** v11.21.0 o superiore
- **PostgreSQL** v18 o superiore
- **Docker** e **Docker Compose** (opzionale, per l'avvio rapido)

<a id="installation"></a>

## 🚀 Installazione

### 1. Clonare il repository

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
```

### 2. Installare le dipendenze

Questo progetto utilizza pnpm come gestore di pacchetti. Il progetto impone pnpm tramite script di preinstallazione.

```bash
pnpm install
```

### 3. Configurazione dell'ambiente

Copia i file di ambiente di esempio e configura le tue impostazioni:

```bash
# Backend configuration
cp packages/backend/.env.example packages/backend/.env

# Frontend configuration
cp packages/frontend/.env.example packages/frontend/.env
```

Modifica i file di ambiente con la tua configurazione:

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

### 4. Configurazione del database

Genera il client Prisma, poi crea lo schema del database. Per lo sviluppo locale puoi utilizzare uno qualsiasi dei due approcci:

```bash
# Generate Prisma client (always required)
pnpm run db:generate

# Option A: Push schema directly (fast iteration, no migration files)
pnpm run db:push

# Option B: Create and apply a migration (recommended for tracked changes)
pnpm run db:migrate
```

Per i deployment di produzione, utilizza `pnpm run db:migrate:prod` per applicare le migrazioni esistenti senza prompt interattivi.

### 5. Avviare il server di sviluppo

```bash
pnpm run dev
```

Questo avvierà sia il server backend sia quello frontend in modo concorrente. Per eseguirli in modo indipendente:

```bash
pnpm run dev:backend    # Backend only (http://localhost:5001)
pnpm run dev:frontend   # Frontend only (http://localhost:5173)
```

<a id="development-commands"></a>

## 🛠 Comandi di sviluppo più comuni

Per chi sviluppa, l'analogia più vicina è un linter per il tuo processo Scrum — con la differenza che conta: un linter segnala una violazione, una barriera la rifiuta.

I comandi più comuni per lo sviluppo quotidiano:

| Attività                    | Comando                 |
| --------------------------- | ----------------------- |
| Avviare backend + frontend  | `pnpm run dev`          |
| Avviare solo il backend     | `pnpm run dev:backend`  |
| Avviare solo il frontend    | `pnpm run dev:frontend` |
| Compilare tutti i pacchetti | `pnpm run build`        |

<a id="testing"></a>

## 🧪 Test

```bash
pnpm run test              # Tutti i test
pnpm run test:coverage     # Con report di copertura
pnpm run test:unit         # Solo test unitari
pnpm run test:integration  # Test di integrazione del backend
pnpm run test:e2e          # End-to-end (backend Vitest + frontend Playwright)
pnpm run test:watch        # Modalità watch
```

Soglie di copertura applicate: **80 % righe, funzioni, istruzioni e rami**.

<a id="load-testing-k6"></a>

### Test di carico (k6)

Gli scenari di test di carico predefiniti si trovano in [`k6/scripts/scenarios/`](k6/scripts/scenarios). Copia [`k6/.env.k6.example`](k6/.env.k6.example) in `k6/.env.k6`, configura il tuo target, quindi esegui uno scenario come:

```bash
pnpm run loadtest:normal    # Realistic everyday load
pnpm run loadtest:peak      # Sprint planning rush (worst-case concurrency)
pnpm run loadtest:stress    # Push the system until it breaks
```

> **Prerequisito:** Installa [k6](https://k6.io/docs/get-started/installation/) e assicurati che il backend di destinazione sia in esecuzione. Dieci scenari si trovano in [`k6/scripts/scenarios/`](k6/scripts/scenarios); gli script `loadtest:*` in [`package.json`](package.json) ne espongono otto, tra cui endurance, multi-team, daily-scrum, auth e database stress.

<a id="code-quality"></a>

## 🔍 Qualità del codice

| Attività                     | Comando              |
| ---------------------------- | -------------------- |
| Lint (ESLint)                | `pnpm run lint`      |
| Lint e correzione automatica | `pnpm run lint:fix`  |
| Lint CSS (Stylelint)         | `pnpm run lint:css`  |
| Formattazione (Prettier)     | `pnpm run format`    |
| Verifica dei tipi            | `pnpm run typecheck` |
| Audit di sicurezza           | `pnpm run audit`     |

Consulta [`CONTRIBUTING.md`](CONTRIBUTING.md) per il flusso di lavoro di sviluppo completo e le barriere di qualità.

<a id="database-management"></a>

## 🗄 Gestione del database

```bash
pnpm run db:generate     # Generare il client Prisma (dopo modifiche allo schema)
pnpm run db:migrate      # Creare e applicare una migrazione (sviluppo)
pnpm run db:migrate:prod # Applicare le migrazioni in produzione (non interattivo)
pnpm run db:studio       # Aprire Prisma Studio (GUI del database)
```

Ulteriori comandi per il database (`db:push`, `db:reset`, `db:validate`, `db:migrate:test`) sono documentati in [`CONTRIBUTING.md`](CONTRIBUTING.md).

<a id="docker-support"></a>

## 🐳 Supporto Docker

Il progetto include la configurazione Docker sia per lo sviluppo sia per il deployment in produzione.

### Utilizzare Docker Compose

```bash
# Development environment (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production environment (detached)
docker compose up -d

# Tear down
docker compose down
```

### Costruire le immagini Docker manualmente

> **Nota:** Tutti i Dockerfile fanno riferimento a percorsi relativi alla radice del repository (file del workspace monorepo come `package.json`, `pnpm-lock.yaml` e `packages/shared/`). Devi costruirli dalla **radice del repository** e usare `-f` per puntare al Dockerfile — passare la directory del pacchetto come contesto di build non funzionerà.

```bash
# Development images (with dev dependencies and watch mode)
docker build -t scrumooth-backend:dev -f packages/backend/Dockerfile.dev .
docker build -t scrumooth-frontend:dev -f packages/frontend/Dockerfile.dev .

# Production images (build from the repo root)
docker build -t scrumooth-backend -f packages/backend/Dockerfile .
docker build -t scrumooth-frontend -f packages/frontend/Dockerfile .
```

<details>
<summary>Utilizzare un mirror registry/apt</summary>

Se ti trovi dietro una rete che richiede un registry npm o un mirror apt, puoi configurarli come argomenti di build o variabili di ambiente:

```bash
# Docker Compose
$env:NPM_REGISTRY="https://your_mirror_url"
$env:APT_MIRROR="your_mirror_url"

# Manual build
docker build --build-arg NPM_REGISTRY=https://your_mirror_url --build-arg APT_MIRROR=your_mirror_url .
```

</details>

<a id="deployment"></a>

## ☁️ Distribuzione

### Produzione self-hosted

Consulta [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) per la guida completa alla distribuzione in produzione, che copre la configurazione dell'ambiente, la migrazione del database, la configurazione del reverse proxy e le migliori pratiche operative.

### Distribuzione della demo su GitHub Pages

Il branch `main` viene distribuito automaticamente su GitHub Pages tramite il workflow [`Deploy to GitHub Pages`](.github/workflows/deploy-github-pages.yml), utilizzando una **Mock API** in memoria (nessun backend o database richiesto). Consulta la [Demo dal vivo](#live-demo) qui sopra per provarla.

<a id="documentation"></a>

## 📚 Documentazione

| Area                            | Posizione                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Guida utente**                | [`docs/user-guide/`](docs/user-guide) — primi passi, funzionalità principali, flussi di lavoro Scrum                                         |
| **Riferimento API REST**        | [`docs/api/`](docs/api) — gruppi di endpoint che coprono autenticazione, sprint, backlog, report e altro                                     |
| **Architettura di sistema**     | [`docs/architecture/`](docs/architecture) — progettazione del sistema, modello dati, progettazione dei componenti, architettura di sicurezza |
| **Guida alla distribuzione**    | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)                                                                             |
| **Politica di sicurezza**       | [`SECURITY.md`](SECURITY.md) — procedura di segnalazione delle vulnerabilità                                                                 |
| **Contribuire**                 | [`CONTRIBUTING.md`](CONTRIBUTING.md) — linee guida e flusso di lavoro di sviluppo                                                            |
| **Codice di condotta**          | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — standard della community                                                                        |
| **Cronologia dei release**      | [`CHANGELOG.md`](CHANGELOG.md)                                                                                                               |
| **Attribuzioni di terze parti** | [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)                                                                                           |

<a id="troubleshooting"></a>

## 🛟 Risoluzione dei problemi

### `Cannot find module @scrumooth/shared`

Il pacchetto condiviso deve essere compilato prima che backend/frontend possano risolvere gli import.

```bash
pnpm --filter=@scrumooth/shared run build
```

Questo viene normalmente gestito automaticamente da `pnpm install` e dagli script di sviluppo, ma è necessario dopo un `pnpm run clean` manuale.

### `pnpm install` fallisce con "Use pnpm instead"

Il repository impone pnpm tramite uno script `preinstall`. Installa pnpm globalmente:

```bash
npm install -g pnpm@11.21.0
```

### Errori di connessione al database all'avvio

Verifica che la tua `DATABASE_URL` in `packages/backend/.env` punti a un'istanza PostgreSQL 18+ in esecuzione e che il database esista. Esegui `pnpm run db:validate` per validare lo schema Prisma rispetto alla connessione.

### Porta già in uso (5001 o 5173)

Le porte predefinite possono essere sovrascritte tramite variabili di ambiente:

- Backend: `PORT` in `packages/backend/.env`
- Frontend: `VITE_DEV_PORT` in `packages/frontend/.env`

### Il frontend non riesce a raggiungere il backend

Verifica che `VITE_API_URL` in `packages/frontend/.env` corrisponda all'indirizzo effettivo del backend e che `CORS_ORIGIN` in `packages/backend/.env` consenta l'origine del frontend.

### Vuoi sviluppare senza backend?

Imposta `VITE_USE_MOCK_API=true` in `packages/frontend/.env` per utilizzare la stessa Mock API che alimenta la demo dal vivo.

<a id="roadmap"></a>

## 🗺 Roadmap

Scrumooth è in fase di sviluppo attivo. Le priorità seguenti approfondiscono ciò che Scrumooth applica, invece di ampliarlo in uno strumento di tracciamento generalista:

- [ ] **Report di conformità alla Scrum Guide** — una dichiarazione per Sprint su quali regole si applicavano e come ciascuna è stata soddisfatta
- [ ] **Pacchetto di evidenze dello Sprint esportabile** — un registro condivisibile per audit e revisioni di conformità
- [ ] **Più regole applicabili** — ampliare la superficie coperta della Scrum Guide 2020
- [ ] **Automazione più profonda di Definition of Done / Definition of Ready**
- [ ] **Report che fanno emergere la deriva di processo**, non solo le metriche di consegna
- [ ] **Integrazioni e webhook**, così che Scrumooth possa affiancarsi agli strumenti che già usi
- [ ] Rafforzamento di prestazioni e scalabilità

Lo stato del progetto e le ultime modifiche sono tracciati nel [CHANGELOG](CHANGELOG.md). Feedback e richieste di funzionalità sono benvenuti tramite [GitHub Issues](https://github.com/orbivort/scrumooth/issues).

<a id="contributing"></a>

## 🤝 Contribuire

I contributi sono benvenuti! Leggi [`CONTRIBUTING.md`](CONTRIBUTING.md) per il flusso di lavoro di sviluppo, gli standard di codice e il processo di pull request, e consulta il [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) prima di partecipare.

<a id="license"></a>

## 📝 Licenza

Questo progetto è concesso in licenza sotto la [Apache License 2.0](LICENSE).

---

_Giudica uno strumento Scrum dalle regole che rispetta, non dalle board che disegna._
