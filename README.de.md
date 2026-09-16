# Scrumooth — der Scrum Guide, durchgesetzt.

**Beurteilen Sie ein Scrum-Werkzeug nach den Regeln, die es einhält — nicht nach den Boards, die es zeichnet.**

**Scrumooth** ist eine selbst gehostete Open-Source-Webanwendung für Teams, die Scrum praktizieren. Sie ist für Scrum Master, Product Owner und technologiegeführte Teams gedacht, die möchten, dass der Prozess sich am Guide messen lassen muss. Sie verwandelt die Regeln des **Scrum Guide 2020** in Gates, die das Backend überall dort erzwingt, wo ein Werkzeug es kann — und benennt die Stellen, an denen es dies bewusst nicht tut.

Es ist **kein** Ersatz für Ihren Issue-Tracker. Als die Durchsetzungsschicht für den Scrum Guide, die Ihr Tracker nicht hat, besitzt es den Sprint-Lebenszyklus, die Rollen und die Gates, und es lässt keinen Prozessverstoß stillschweigend durchgehen. Ihr Tracker führt Ihre Aufzeichnung; Scrumooth hält Ihre Regeln. Jede Regel, die es durchsetzt, ist unter [Was Scrumooth durchsetzt](#what-scrumooth-enforces) aufgeführt — und keine Regel außerhalb dieser Liste wird beansprucht.

Ein zweites Werkzeug zu betreiben, kostet wirklich etwas — etwas, das bereitgestellt, abgesichert, gesichert und gepflegt werden muss. Scrumooth ist bewusst das kleinste System, das das tragen kann: ein einziger Compose-Stack — Reverse-Proxy, Backend, Frontend, PostgreSQL und geplante Backups — und eine Datenbank, um die man sich kümmert.

> **Sprachen:** [English](README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Italiano](README.it.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml/badge.svg)](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/orbivort/scrumooth/graph/badge.svg)](https://codecov.io/github/orbivort/scrumooth)
[![GitHub release](https://img.shields.io/github/v/release/orbivort/scrumooth?include_prereleases)](https://github.com/orbivort/scrumooth/releases)
[![GitHub issues](https://img.shields.io/github/issues/orbivort/scrumooth)](https://github.com/orbivort/scrumooth/issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791.svg)](https://www.postgresql.org/)

<p align="center">
  <img src="docs/screenshots/scrumooth_de.png" alt="Scrumooth" width="800" />
</p>

<a id="live-demo"></a>

## 🖥️ Live-Demo

Probieren Sie Scrumooth sofort in Ihrem Browser aus — keine Installation erforderlich. Die Demo läuft mit Mock-Daten (kein Backend erforderlich), sodass Sie den gesamten Scrum-Lebenszyklus sofort erkunden können.

<p align="center">
  <a href="https://orbivort.github.io/scrumooth/" target="_blank" rel="noopener noreferrer">
    <strong>👉 Live-Demo auf GitHub Pages starten</strong>
  </a>
</p>

> **Hinweis:** Die Demo verwendet In-Memory-Mock-Daten — alle von Ihnen vorgenommenen Änderungen sind nur lokal in Ihrer Browser-Sitzung gültig und werden beim Aktualisieren zurückgesetzt. Für persistente Daten und Mehrbenutzer-Zusammenarbeit folgen Sie der Anleitung unter [Installation](#installation), um Ihre eigene Instanz selbst zu hosten.

---

## Inhaltsverzeichnis

**Scrumooth verstehen**

- [Live-Demo](#live-demo)
- [Das Manifest](#the-manifesto)
- [Was Scrumooth durchsetzt](#what-scrumooth-enforces)
- [Für wen es gedacht ist](#who-its-for)
- [Warum Sie ihm vertrauen können](#why-you-can-trust-it)
- [Funktionen](#features)

**Selbst hosten & entwickeln**

- [Tech-Stack](#tech-stack)
- [Projektstruktur](#project-structure)
- [Schnellstart](#quick-start)
- [Voraussetzungen](#prerequisites)
- [Installation](#installation)
- [Häufige Entwicklungsbefehle](#development-commands)
- [Testen](#testing)
- [Lasttests (k6)](#load-testing-k6)
- [Code-Qualität](#code-quality)
- [Datenbankverwaltung](#database-management)
- [Docker-Unterstützung](#docker-support)
- [Deployment](#deployment)
- [Fehlerbehebung](#troubleshooting)

**Projekt**

- [Dokumentation](#documentation)
- [Roadmap](#roadmap)
- [Mitwirken](#contributing)
- [Lizenz](#license)

---

<a id="the-manifesto"></a>

## 📜 Das Manifest — Warum Scrumooth existiert

> Die meisten Projektmanagement-Werkzeuge sind darauf ausgelegt, **aufzuzeichnen**, was geschehen ist. Sie liefern Ihnen Boards, sie protokollieren Ihre Klicks, sie zeichnen exakte Diagramme — nachdem der Sprint vorbei ist. Aufzeichnen ist wirklich nützlich, und das tun diese Werkzeuge gut.
>
> Doch eine Aufzeichnung ist eine Beschreibung, keine Entscheidung. Der Scrum Guide 2020 steckt voller Regeln, an die ein Werkzeug Sie halten könnte: Ein Sprint endet erst nach seinem Sprint Review und seiner Sprint Retrospective, nur die Developers schätzen den Umfang der Arbeit, ein einziger Product Owner besitzt das Product Backlog, und „Done" heißt, dass die Definition of Done erfüllt ist. Wenn eine davon durchrutscht — ein Sprint, der geschlossen wird, bevor seine Sprint Retrospective stattfand, ein Product Owner, der die Arbeit im Namen der Developers schätzt, ein Eintrag, der als Done markiert wird, ohne dass seine Kriterien geprüft wurden —, bleibt dieser Verstoß meist unsichtbar, bis der Sprint vorbei ist. In den meisten Werkzeugen sind diese Regeln unverbindliche Empfehlungen: ein gemeinsames Verständnis, von dem man annimmt, dass das Team sich daran erinnert.
>
> **Scrumooth behandelt sie als Regeln.**
>
> Disziplin ist nicht die fehlende Zutat — wäre sie allein ausreichend, hätte kein Team jemals einen Sprint ohne Sprint Retrospective geschlossen. Der Guide sagt einem Team, was zu tun ist; er kann nicht bemerken, wenn das Team aufhört, es zu tun. Deshalb gießen wir den **Scrum Guide 2020** in ausführbaren Code und **setzen ihn** serverseitig **durch**, wo weder die Oberfläche noch ein direkter API-Aufruf ihn umgehen kann. Wir sind ein **Gatekeeper, kein Protokollführer**.
>
> Weniger Prozessdebatten. Mehr Zeit für funktionierende Software.

<a id="what-scrumooth-enforces"></a>

## 🔒 Was Scrumooth durchsetzt

Das sind Gates, keine Warnungen oder Hinweise. In jedem der folgenden Fälle lautet die Antwort nein — und jede Antwort gilt in der Service-Schicht des Backends, sodass eine Abkürzung im Frontend sie nicht umgehen kann.

| Eine Regel des Scrum Guide 2020, als Frage gestellt                                                       | Scrumooths Antwort                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kann ein Sprint geschlossen werden, bevor sein Sprint Review und seine Sprint Retrospective erfasst sind? | Das Abschließen des Sprints wird verweigert, bis beide Ereignisse erfasst sind ([Sprint-API](docs/api/sprints.md)).                                                                            |
| Kann ein Eintrag als Done bezeichnet werden, ohne seine Definition of Done zu erfüllen?                   | Das Abschließen eines Sprints markiert niemals Einträge als Done — jeder Eintrag muss seine Definition-of-Done-Checkliste bestehen ([Definition-of-Done-API](docs/api/definition-of-done.md)). |
| Kann ein Team mehr als einen Product Owner oder Scrum Master haben?                                       | Einen zweiten Inhaber einer der beiden Rollen hinzuzufügen, wird verweigert ([Team-API](docs/api/teams.md)).                                                                                   |
| Kann ein Team über die Scrum-Team-Größe hinaus wachsen?                                                   | Die Teamgröße ist begrenzt — `TEAM_MAX_SIZE`, Standard `10` ([Team-API](docs/api/teams.md)).                                                                                                   |
| Kann jemand anderes als ein Developer den Umfang der Arbeit schätzen?                                     | Nur Developers dürfen Product Backlog Items schätzen — jede andere Rolle erhält `403 Forbidden` ([Product-Backlog-API](docs/api/product-backlog.md)).                                          |
| Können der Product Owner oder der Scrum Master das Daily Scrum verfassen?                                 | Nur Developers dürfen die Tagesaufzeichnung verfassen oder ihr beitreten; der Product Owner und der Scrum Master beobachten ([Daily-Scrum-API](docs/api/daily-scrum.md)).                      |
| Kann ein Sprint von jemand anderem als dem Product Owner abgebrochen werden?                              | Ein Abbruch ist nur dem Product Owner möglich, und nur solange der Sprint `ACTIVE` ist ([Sprint-API](docs/api/sprints.md)).                                                                    |
| Kann ein geliefertes Increment umgeschrieben werden?                                                      | Gelieferte Increments sind gegen weitere Änderungen gesperrt ([Increments-API](docs/api/increments.md)).                                                                                       |

**Wo Scrumooth bewusst nichts durchsetzt:** Die Prime Directive der Sprint Retrospective bleibt der Moderation überlassen, und die Timeboxen der Ereignisse werden über einen gemeinsamen Team-Timer sichtbar gemacht, statt ein Ereignis zwangsweise zu beenden. Genau an diesen Stellen verlangt der Guide Selbstmanagement — deshalb entscheidet Scrumooth nicht für das Team.

**Wie sich ein Gate in der Praxis zeigt.** Es ist Freitag, der Sprint soll enden, das Increment ist ausgeliefert — und die Sprint Retrospective wurde nie angesetzt. Ein Aufzeichnungswerkzeug schließt den Sprint, und die Sprint Retrospective rutscht auf die nächste Woche — genau das Scheitern, das das letzte Ereignis des Guide verhindern soll; Scrumooth verweigert den Abschluss, bis beide Ereignisse erfasst sind. Das Team führt die Sprint Retrospective dann durch — oder hält inne und bespricht, warum nicht: die Version dieser Entscheidung, die der Guide von einem Team erwartet, das sie bewusst trifft.

Warum werden die Werkzeuge, die Sie bereits nutzen, das nicht einfach ergänzen? Aus unserer Sicht, weil ein Gate, das man abschalten kann, eine Einstellung ist und keine Regel — und Konfigurierbarkeit ihr Verkaufsargument ist, nicht ihr Versäumnis. Ebenso wenig kann ein gehosteter Dienst ohne Weiteres versprechen, dass Ihre Prozessdaten Ihre Infrastruktur nie verlassen. Scrumooth ist kein Feature, das ihnen fehlt; es ist eine Abwägung, die sie bereits in die andere Richtung getroffen haben.

Die Gates oben sind der gesamte Anspruch: Steht eine Regel nicht in der Tabelle, setzt Scrumooth sie nicht durch — und weil eine Konfiguration, die den Scrum Guide 2020 verletzt, nie angeboten wird, **ist die Verweigerung das Produkt.**

<a id="who-its-for"></a>

## 🎯 Für wen es gedacht ist

**Scrumooth ist für eine Situation im Besonderen gebaut:** technologiegeführte Organisationen, die belegen können müssen, wie ein Sprint tatsächlich durchgeführt wurde, und für die Prozessdaten die eigene Infrastruktur nicht verlassen dürfen — regulierte Branchen, ihre Zulieferer und Teams im öffentlichen Sektor.

**Scrumooth ist das Richtige für Sie, wenn …**

- Sie **Scrum Master oder Product Owner** sind, Ihr Team sich schwer damit tut, den Scrum Guide 2020 einzuhalten, und Sie möchten, dass das Werkzeug die Abweichung verweigert, statt sie stillschweigend zuzulassen.
- Sie ein **Engineering-Team** führen, das seine Prozessdaten aus Gründen des Datenschutzes, der Compliance oder der Datenhoheit selbst hosten möchte.
- Sie eine **belastbare, prüfbare Aufzeichnung** darüber benötigen, wie jeder Sprint tatsächlich durchgeführt wurde — wer was wann und in welcher Rolle geändert hat.
- Sie möchten, dass die Grenzen des Scrum Guide einmal kodiert werden, damit neue Teammitglieder den Prozess durch seine Nutzung lernen.

**Scrumooth ist nichts für Sie, wenn …**

- Sie einen Allzweck-Issue-Tracker, einen Roadmap-Planer oder ein Kanban-Board für Nicht-Scrum-Arbeit suchen. Scrumooth weigert sich, eines davon zu sein.
- Sie möchten, dass jede Regel konfigurierbar ist. Scrumooth verweigert Konfigurationen, die den Scrum Guide verletzen.
- Sie ein vollständig verwaltetes SaaS möchten. Scrumooth ist von Grund auf selbst gehostet.
- Sie umfassendes Portfolio-Management, Ressourcenplanung oder Finanzverfolgung über viele unzusammenhängende Projekte hinweg benötigen.
- Sie folgen ein skaliertes Framework, das den Guide für eine größere Organisation anpasst, oder Scrum ist noch nicht die Arbeitsweise Ihres Teams. Scrumooth setzt den Scrum Guide 2020 wortgetreu durch, für ein einzelnes Scrum Team.

<a id="why-you-can-trust-it"></a>

## 🛡 Warum Sie ihm vertrauen können

**Warum kein gehosteter Dienst**

- **Von Grund auf selbst gehostet.** Ihre Prozessdaten verlassen Ihre Infrastruktur nie.
- **Datenhoheit ist eingebaut.** DSGVO-Datenexport, eine 14-tägige Löschfrist und Consent-Tracking sind Teil des Produkts.
- **Prüfbar.** Jede Rollenänderung und jeder Statusübergang wird in ein eigenes, compliance-getrenntes Audit-Log geschrieben.
- **Begrenzter Zugang.** Gleichzeitige Sitzungen sind begrenzt, und die ältesten Sitzungen werden automatisch widerrufen.

**Warum kein anderes selbst gehostetes Werkzeug**

- **Offen und überprüfbar.** Apache-2.0, öffentliche CI, veröffentlichte Coverage — ein **Gate von 80 % bei Zeilen, Branches, Funktionen und Anweisungen** wird in der Pipeline erzwungen.
- **Unter Last getestet, nicht nur mit Unit-Tests.** 10 vorgefertigte k6-Szenarien, darunter eine Sprint-Planning-Spitze. Siehe [Lasttests](#load-testing-k6).
- **Strikt von Konstruktion wegen.** TypeScript-Strict-Mode in Backend, Frontend und Shared-Paket.
- **Lokalisiert, wo es zählt.** Die Oberfläche erscheint auf Englisch, Deutsch, Spanisch, Französisch und Italienisch, mit Scrum-Terminologie aus dem offiziellen Scrum Guide.

**Für alle, die es intern genehmigen müssen.** Deployment-Anleitung, Sicherheitsarchitektur und der Prozess zur Meldung von Sicherheitslücken sind im Repository dokumentiert: [Deployment](#deployment), [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) und [`SECURITY.md`](SECURITY.md).

<a id="features"></a>

## ✨ Funktionen

### Der Scrum-Workflow

Alles, was zum Durchführen des Sprints nötig ist — die fünf Ereignisse, drei Artefakte und drei Verpflichtungen des Guide — jeweils mit der zugehörigen Regel. Fett gesetzte Klauseln wiederholen die Gates aus [Was Scrumooth durchsetzt](#what-scrumooth-enforces); diese Tabelle bleibt die einzige Liste der Regeln, die Scrumooth beansprucht.

- **Product Goal** - Strategische Ausrichtung und Zielverfolgung; die Verpflichtung, der das Backlog dient
- **Product Backlog** - MoSCoW-Priorisierung (Must, Should, Could, Won't); **nur die Developers schätzen den Umfang der Arbeit**
- **Sprint Planning** - Konfigurierbare Sprint-Dauern und Kapazitätsplanung; **nur die Developers speichern das Sprint Backlog**
- **Sprint Execution** - Interaktives Kanban-Board mit Drag-and-Drop; **nur der Product Owner kann abbrechen, und nur solange der Sprint `ACTIVE` ist**
- **Daily Scrum** - Gemeinsame Tagesaufzeichnung mit Sichtbarmachung von Impediments; **nur die Developers verfassen sie — der Product Owner und der Scrum Master beobachten**
- **Impediment** - Erkennung von Blockern und Verfolgung der Behebung; **ein Sprint kann nicht abgeschlossen werden, bevor seine Impediments gelöst sind**
- **Increment** - Verwaltung des Produkt-Increments; **in dem Moment, in dem ein Product Backlog Item die Definition of Done erfüllt, entsteht ein Increment**
- **Sprint Review** - Review-Verwaltung, Stakeholder-Feedback und Backlog-Anpassung; **ein Sprint kann nicht abgeschlossen werden, bevor sein Sprint Review erfasst ist**
- **Sprint Retrospective** - Teamreflexion und nachverfolgte Verbesserung; **ein Sprint kann nicht abgeschlossen werden, bevor seine Sprint Retrospective erfasst ist**

### Governance und Betrieb

- **Workflow Engine** - Rollenbasierte Berechtigungen und abgesicherte Statusübergänge, **serverseitig erzwungen**
- **Definition of Done/Ready** - Anpassbare Checklisten; **nichts ist Done, solange seine Checkliste nicht bestanden ist**
- **Integrität des Increments** - **Gelieferte Arbeit kann nicht stillschweigend umgeschrieben werden**

### Team und Organisation

- **Teamzusammensetzung** - Ein Product Owner und ein Scrum Master; **Teamgröße begrenzt** (`TEAM_MAX_SIZE`, Standard `10`)
- **Audit-Protokollierung** - Eigenes, compliance-getrenntes Log; **jede Rollenänderung und jeder Statusübergang erfasst**
- **Dashboard & Reporting** - Echtzeit-Metriken und Visualisierungen
- **Teamkommunikation** - Integrierte Benachrichtigungen und Nachrichten
- **Team-Health-Check** - Regelmäßiger Check-in entlang der fünf Scrum-Werte
- **Gemeinsame Timeboxen für Ereignisse** - Eine Uhr für alle Teilnehmenden; **Timeboxen werden angezeigt, nie zwangsweise beendet**
- **Datenschutzkontrollen** - Datenexport- und Löschrechte sowie Consent-Tracking

<a id="tech-stack"></a>

## 🛠 Tech-Stack

### Backend

- **Runtime:** Node.js 24+
- **Framework:** Express.js 5
- **Sprache:** TypeScript (Strict Mode)
- **Datenbank:** PostgreSQL 18+ mit Prisma ORM 7
- **Authentifizierung:** JWT mit bcrypt
- **Validierung:** Zod
- **Geplante Jobs:** node-cron
- **E-Mail:** Nodemailer (Anbieter SMTP, SendGrid, AWS SES)
- **Protokollierung:** Winston mit rotierenden Datei-Transports

### Frontend

- **Framework:** React 19 mit Vite
- **Sprache:** TypeScript (Strict Mode)
- **Routing:** React Router 8
- **State Management:** TanStack Query (React Query) + Zustand
- **Visualisierung:** Chart.js
- **Styling:** CSS Modules mit Design Tokens
- **Fehlerverfolgung:** Sentry (optional, über `VITE_SENTRY_DSN`)

### Shared

- TypeScript-Typen und -Schnittstellen
- Konstanten und Enumerationen
- Hilfsfunktionen

### Testen & Qualität

- **Unit / Integration:** Vitest
- **End-to-End:** Playwright (Frontend) + Vitest (Backend)
- **Lasttests:** k6 (10 vorgefertigte Szenarien)
- **Linting:** ESLint + Stylelint
- **Formatierung:** Prettier
- **Git Hooks:** Husky + lint-staged

<a id="project-structure"></a>

## 📁 Projektstruktur

```
scrumooth/
├── packages/
│   ├── backend/              # Express.js REST-API
│   │   ├── src/
│   │   │   ├── controllers/  # API-Routen-Handler
│   │   │   ├── services/     # Geschäftslogikschicht
│   │   │   ├── middleware/   # Express-Middleware
│   │   │   ├── routes/       # API-Routendefinitionen
│   │   │   ├── utils/        # Hilfsfunktionen
│   │   │   └── __tests__/    # Unit-, Integrations- und E2E-Tests
│   │   ├── prisma/           # Datenbankschema und Migrationen
│   │   ├── Dockerfile        # Produktions-Image
│   │   └── Dockerfile.dev    # Entwicklungs-Image
│   ├── frontend/             # React + Vite Frontend
│   │   ├── src/
│   │   │   ├── components/   # React-Komponenten
│   │   │   ├── pages/        # Seiten auf Routenebene
│   │   │   ├── hooks/        # Eigene React Hooks
│   │   │   ├── services/     # API-Client-Dienste
│   │   │   ├── stores/       # Zustand-Stores
│   │   │   └── styles/       # CSS und Design Tokens
│   │   ├── e2e/              # Playwright-End-to-End-Tests
│   │   ├── Dockerfile        # Produktions-Image
│   │   └── Dockerfile.dev    # Entwicklungs-Image
│   └── shared/               # Gemeinsame Typen, Konstanten, Hilfsfunktionen
├── docs/
│   ├── api/                  # REST-API-Referenz
│   ├── architecture/         # Systemdesign, Datenmodell, Sicherheit
│   ├── deployment/           # Deployment-Anleitungen
│   └── user-guide/           # Benutzerdokumentation und Anleitungen
├── k6/                       # Lasttest-Szenarien (k6)
│   └── scripts/scenarios/    # vorgefertigte Lasttest-Szenarien
├── scripts/                  # Build- und Hilfsskripte
├── .github/workflows/        # CI-, Release- und GitHub-Pages-Deployment
├── docker-compose.yml        # Produktions-Docker-Compose
├── docker-compose.dev.yml    # Entwicklungs-Docker-Compose
├── CHANGELOG.md              # Versionshistorie
├── SECURITY.md               # Sicherheitsrichtlinie und Meldeverfahren
├── CONTRIBUTING.md           # Beitragsrichtlinien
├── CODE_OF_CONDUCT.md        # Verhaltenskodex der Community
└── THIRD-PARTY-NOTICES.md    # Drittanbieter-Lizenzhinweise
```

<a id="quick-start"></a>

## ⚡ Schnellstart

Der schnellste Weg, eine lokale Instanz zu betreiben, ist Docker Compose:

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
cp packages/backend/.env.production.example packages/backend/.env.production
docker compose up -d
```

Dies startet den Caddy-Reverse-Proxy, das Backend, das Frontend und PostgreSQL. Sobald alles läuft, öffnen Sie <http://localhost> (HTTPS ist standardmäßig auf Port 443 aktiviert). Für ein vollständiges manuelles Setup (ohne Docker) siehe [Installation](#installation).

> **Hinweis:** Der Produktions-Compose-Stack erfordert `packages/backend/.env.production`. Wenn Sie eine vollständig vorkonfigurierte Entwicklungsumgebung mit Hot Reload bevorzugen, verwenden Sie stattdessen `docker compose -f docker-compose.dev.yml up`.

<a id="prerequisites"></a>

## 📋 Voraussetzungen

- **Node.js** v24.19.0 oder höher
- **pnpm** v11.21.0 oder höher
- **PostgreSQL** v18 oder höher
- **Docker** & **Docker Compose** (optional, für den Schnellstart)

<a id="installation"></a>

## 🚀 Installation

### 1. Repository klonen

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
```

### 2. Abhängigkeiten installieren

Dieses Projekt verwendet pnpm als Paketmanager. Das Projekt erzwingt pnpm über Preinstall-Skripte.

```bash
pnpm install
```

### 3. Umgebungskonfiguration

Kopieren Sie die Beispiel-Umgebungsdateien und konfigurieren Sie Ihre Einstellungen:

```bash
# Backend configuration
cp packages/backend/.env.example packages/backend/.env

# Frontend configuration
cp packages/frontend/.env.example packages/frontend/.env
```

Bearbeiten Sie die Umgebungsdateien mit Ihrer Konfiguration:

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

### 4. Datenbank einrichten

Generieren Sie den Prisma-Client und erstellen Sie anschließend Ihr Datenbankschema. Für die lokale Entwicklung können Sie einen der beiden Ansätze wählen:

```bash
# Generate Prisma client (always required)
pnpm run db:generate

# Option A: Push schema directly (fast iteration, no migration files)
pnpm run db:push

# Option B: Create and apply a migration (recommended for tracked changes)
pnpm run db:migrate
```

Für Produktions-Deployments verwenden Sie `pnpm run db:migrate:prod`, um bestehende Migrationen ohne Rückfragen anzuwenden.

### 5. Entwicklungsserver starten

```bash
pnpm run dev
```

Dies startet Backend- und Frontend-Server gleichzeitig. Um sie unabhängig voneinander auszuführen:

```bash
pnpm run dev:backend    # Backend only (http://localhost:5001)
pnpm run dev:frontend   # Frontend only (http://localhost:5173)
```

<a id="development-commands"></a>

## 🛠 Häufige Entwicklungsbefehle

Für Entwickler ist die nächstliegende Analogie ein Linter für Ihren Scrum-Prozess — mit dem Unterschied, auf den es ankommt: Ein Linter meldet einen Verstoß, ein Gate verweigert ihn.

Die gängigsten Befehle für die tägliche Entwicklung:

| Aufgabe                    | Befehl                  |
| -------------------------- | ----------------------- |
| Backend + Frontend starten | `pnpm run dev`          |
| Nur Backend starten        | `pnpm run dev:backend`  |
| Nur Frontend starten       | `pnpm run dev:frontend` |
| Alle Pakete bauen          | `pnpm run build`        |

<a id="testing"></a>

## 🧪 Testen

```bash
pnpm run test              # Alle Tests
pnpm run test:coverage     # Mit Coverage-Bericht
pnpm run test:unit         # Nur Unit-Tests
pnpm run test:integration  # Backend-Integrationstests
pnpm run test:e2e          # End-to-End (Backend Vitest + Frontend Playwright)
pnpm run test:watch        # Watch-Modus
```

Erzwungene Coverage-Schwellenwerte: **80 % Zeilen, Funktionen, Anweisungen, Branches**.

<a id="load-testing-k6"></a>

### Lasttests (k6)

Vorgefertigte Lasttest-Szenarien liegen unter [`k6/scripts/scenarios/`](k6/scripts/scenarios). Kopieren Sie [`k6/.env.k6.example`](k6/.env.k6.example) nach `k6/.env.k6`, konfigurieren Sie Ihr Ziel und führen Sie anschließend ein Szenario aus, zum Beispiel:

```bash
pnpm run loadtest:normal    # Realistic everyday load
pnpm run loadtest:peak      # Sprint planning rush (worst-case concurrency)
pnpm run loadtest:stress    # Push the system until it breaks
```

> **Voraussetzung:** Installieren Sie [k6](https://k6.io/docs/get-started/installation/) und stellen Sie sicher, dass Ihr Ziel-Backend läuft. Zehn Szenarien liegen in [`k6/scripts/scenarios/`](k6/scripts/scenarios); die `loadtest:*`-Skripte in [`package.json`](package.json) stellen acht davon bereit, darunter endurance, multi-team, daily-scrum, auth und database stress.

<a id="code-quality"></a>

## 🔍 Code-Qualität

| Aufgabe                       | Befehl               |
| ----------------------------- | -------------------- |
| Lint (ESLint)                 | `pnpm run lint`      |
| Lint & automatische Korrektur | `pnpm run lint:fix`  |
| CSS-Lint (Stylelint)          | `pnpm run lint:css`  |
| Formatieren (Prettier)        | `pnpm run format`    |
| Typprüfung                    | `pnpm run typecheck` |
| Sicherheits-Audit             | `pnpm run audit`     |

Vollständiger Entwicklungs-Workflow und Quality Gates finden Sie in [`CONTRIBUTING.md`](CONTRIBUTING.md).

<a id="database-management"></a>

## 🗄 Datenbankverwaltung

```bash
pnpm run db:generate     # Prisma-Client generieren (nach Schemaänderungen)
pnpm run db:migrate      # Migration erstellen und anwenden (Entwicklung)
pnpm run db:migrate:prod # Migrationen in Produktion anwenden (nicht-interaktiv)
pnpm run db:studio       # Prisma Studio öffnen (Datenbank-GUI)
```

Weitere Datenbankbefehle (`db:push`, `db:reset`, `db:validate`, `db:migrate:test`) sind in [`CONTRIBUTING.md`](CONTRIBUTING.md) dokumentiert.

<a id="docker-support"></a>

## 🐳 Docker-Unterstützung

Das Projekt enthält Docker-Konfiguration für Entwicklungs- und Produktions-Deployment.

### Docker Compose verwenden

```bash
# Development environment (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production environment (detached)
docker compose up -d

# Tear down
docker compose down
```

### Docker-Images manuell bauen

> **Hinweis:** Alle Dockerfiles referenzieren Pfade relativ zum Repository-Root (Monorepo-Workspace-Dateien wie `package.json`, `pnpm-lock.yaml` und `packages/shared/`). Sie müssen sie vom **Repository-Root** aus bauen und `-f` verwenden, um auf das Dockerfile zu zeigen — das Übergeben des Paketverzeichnisses als Build-Kontext schlägt fehl.

```bash
# Development images (with dev dependencies and watch mode)
docker build -t scrumooth-backend:dev -f packages/backend/Dockerfile.dev .
docker build -t scrumooth-frontend:dev -f packages/frontend/Dockerfile.dev .

# Production images (build from the repo root)
docker build -t scrumooth-backend -f packages/backend/Dockerfile .
docker build -t scrumooth-frontend -f packages/frontend/Dockerfile .
```

<details>
<summary>Registry/apt-Mirror verwenden</summary>

Wenn Sie sich hinter einem Netzwerk befinden, das einen npm-Registry- oder apt-Mirror erfordert, können Sie diese als Build-Argumente oder Umgebungsvariablen setzen:

```bash
# Docker Compose
$env:NPM_REGISTRY="https://your_mirror_url"
$env:APT_MIRROR="your_mirror_url"

# Manual build
docker build --build-arg NPM_REGISTRY=https://your_mirror_url --build-arg APT_MIRROR=your_mirror_url .
```

</details>

<a id="deployment"></a>

## ☁️ Deployment

### Selbst gehostete Produktion

Vollständige Anleitung zum Produktions-Deployment mit Umgebungskonfiguration, Datenbankmigration, Reverse-Proxy-Einrichtung und operativen Best Practices finden Sie in [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md).

### Demo-Deployment auf GitHub Pages

Der `main`-Branch wird über den Workflow [`Deploy to GitHub Pages`](.github/workflows/deploy-github-pages.yml) automatisch auf GitHub Pages bereitgestellt, unter Verwendung einer In-Memory-**Mock-API** (kein Backend oder keine Datenbank erforderlich). Probieren Sie es über die [Live-Demo](#live-demo) oben aus.

<a id="documentation"></a>

## 📚 Dokumentation

| Bereich                    | Ort                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Benutzerhandbuch**       | [`docs/user-guide/`](docs/user-guide) — Erste Schritte, Kernfunktionen, Scrum-Workflows                           |
| **REST-API-Referenz**      | [`docs/api/`](docs/api) — Endpunktgruppen zu Authentifizierung, Sprints, Backlog, Berichten und mehr              |
| **Systemarchitektur**      | [`docs/architecture/`](docs/architecture) — Systemdesign, Datenmodell, Komponenten-Design, Sicherheitsarchitektur |
| **Deployment-Anleitung**   | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)                                                  |
| **Sicherheitsrichtlinie**  | [`SECURITY.md`](SECURITY.md) — Meldeverfahren für Schwachstellen                                                  |
| **Mitwirken**              | [`CONTRIBUTING.md`](CONTRIBUTING.md) — Richtlinien und Entwicklungs-Workflow                                      |
| **Verhaltenskodex**        | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Standards der Community                                              |
| **Release-Historie**       | [`CHANGELOG.md`](CHANGELOG.md)                                                                                    |
| **Drittanbieter-Hinweise** | [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)                                                                |

<a id="troubleshooting"></a>

## 🛟 Fehlerbehebung

### `Cannot find module @scrumooth/shared`

Das Shared-Paket muss gebaut werden, bevor Backend/Frontend Importe auflösen können.

```bash
pnpm --filter=@scrumooth/shared run build
```

Dies wird normalerweise automatisch von `pnpm install` und den Dev-Skripten erledigt, ist aber nach einem manuellen `pnpm run clean` erforderlich.

### `pnpm install` schlägt mit „Use pnpm instead" fehl

Das Repository erzwingt pnpm über ein `preinstall`-Skript. Installieren Sie pnpm global:

```bash
npm install -g pnpm@11.21.0
```

### Datenbankverbindungsfehler beim Start

Überprüfen Sie, ob Ihre `DATABASE_URL` in `packages/backend/.env` auf eine laufende PostgreSQL-18+-Instanz zeigt und die Datenbank existiert. Führen Sie `pnpm run db:validate` aus, um das Prisma-Schema gegen die Verbindung zu validieren.

### Port bereits belegt (5001 oder 5173)

Standard-Ports können über Umgebungsvariablen überschrieben werden:

- Backend: `PORT` in `packages/backend/.env`
- Frontend: `VITE_DEV_PORT` in `packages/frontend/.env`

### Frontend erreicht das Backend nicht

Prüfen Sie, ob `VITE_API_URL` in `packages/frontend/.env` mit der tatsächlichen Backend-Adresse übereinstimmt und `CORS_ORIGIN` in `packages/backend/.env` die Frontend-Origin erlaubt.

### Möchten Sie ohne Backend entwickeln?

Setzen Sie `VITE_USE_MOCK_API=true` in `packages/frontend/.env`, um dieselbe Mock-API zu verwenden, die auch die Live-Demo antreibt.

<a id="roadmap"></a>

## 🗺 Roadmap

Scrumooth wird aktiv weiterentwickelt. Die folgenden Prioritäten vertiefen das, was Scrumooth durchsetzt, statt es zu einem Allzweck-Tracker auszuweiten:

- [ ] **Konformitätsbericht zum Scrum Guide** — eine Aussage pro Sprint darüber, welche Regeln galten und wie jede einzelne erfüllt wurde
- [ ] **Exportierbares Sprint-Nachweispaket** — eine teilbare Aufzeichnung für Audits und Compliance-Prüfungen
- [ ] **Mehr durchsetzbare Regeln** — Ausweitung der abgedeckten Fläche des Scrum Guide 2020
- [ ] **Tiefere Automatisierung von Definition of Done / Definition of Ready**
- [ ] **Berichte, die Prozessabweichungen sichtbar machen**, nicht nur Liefermetriken
- [ ] **Integrationen und Webhooks**, damit Scrumooth neben den Werkzeugen bestehen kann, die Sie bereits nutzen
- [ ] Härtung von Performance und Skalierbarkeit

Projektstatus und neueste Änderungen werden im [CHANGELOG](CHANGELOG.md) verfolgt. Feedback und Funktionswünsche sind über [GitHub Issues](https://github.com/orbivort/scrumooth/issues) willkommen.

<a id="contributing"></a>

## 🤝 Mitwirken

Beiträge sind willkommen! Bitte lesen Sie [`CONTRIBUTING.md`](CONTRIBUTING.md) für Entwicklungs-Workflow, Codestandards und den Pull-Request-Prozess, und lesen Sie den [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) vor der Teilnahme.

<a id="license"></a>

## 📝 Lizenz

Dieses Projekt ist unter der [Apache License 2.0](LICENSE) lizenziert.

---

_Beurteilen Sie ein Scrum-Werkzeug nach den Regeln, die es einhält — nicht nach den Boards, die es zeichnet._
