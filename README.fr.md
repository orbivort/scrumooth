# Scrumooth — le Scrum Guide, appliqué.

**Jugez un outil Scrum sur les règles qu'il fait respecter, non sur les tableaux qu'il dessine.**

**Scrumooth** est une application web auto-hébergée et open source destinée aux équipes qui pratiquent Scrum. Elle est conçue pour les Scrum Masters, les Product Owners et les équipes pilotées par l'ingénierie qui veulent que le processus se tienne au Guide. Elle transforme les règles du **Scrum Guide 2020** en barrières que le backend fait respecter partout où un outil le peut — et déclare les endroits où elle ne le fait délibérément pas.

Elle **ne remplace pas** votre outil de suivi des tickets. En tant que couche d'application du Scrum Guide que votre outil n'a pas, elle est responsable du cycle de vie du Sprint, des rôles et des barrières, et elle refuse qu'une violation du processus passe sous silence. Votre outil conserve votre enregistrement ; Scrumooth conserve vos règles. Chaque règle qu'elle applique est listée dans [Ce que Scrumooth applique](#what-scrumooth-enforces) — et aucune règle en dehors de cette liste n'est revendiquée.

Faire tourner un second outil a un coût réel — quelque chose de plus à déployer, sécuriser, sauvegarder et maintenir. Scrumooth est délibérément le plus petit système capable de le porter : une seule pile Compose —proxy inverse, backend, frontend, PostgreSQL et sauvegardes planifiées— et une seule base de données à surveiller.

> **Langues :** [English](README.md) | [Deutsch](README.de.md) | [Español](README.es.md) | [Français](README.fr.md) | [Italiano](README.it.md)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml/badge.svg)](https://github.com/orbivort/scrumooth/actions/workflows/ci.yml)
[![codecov](https://codecov.io/github/orbivort/scrumooth/graph/badge.svg)](https://codecov.io/github/orbivort/scrumooth)
[![GitHub release](https://img.shields.io/github/v/release/orbivort/scrumooth?include_prereleases)](https://github.com/orbivort/scrumooth/releases)
[![GitHub issues](https://img.shields.io/github/issues/orbivort/scrumooth)](https://github.com/orbivort/scrumooth/issues)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18+-336791.svg)](https://www.postgresql.org/)

<p align="center">
  <img src="docs/screenshots/scrumooth_fr.png" alt="Scrumooth" width="800" />
</p>

<a id="live-demo"></a>

## 🖥️ Démo en ligne

Essayez Scrumooth instantanément dans votre navigateur — aucune installation requise. La démo s'exécute avec des données simulées (aucun backend nécessaire), ce qui vous permet d'explorer immédiatement l'ensemble du cycle de vie Scrum.

<p align="center">
  <a href="https://orbivort.github.io/scrumooth/" target="_blank" rel="noopener noreferrer">
    <strong>👉 Lancer la démo en ligne sur GitHub Pages</strong>
  </a>
</p>

> **Remarque :** La démo utilise des données simulées en mémoire — toute modification que vous apportez reste locale à votre session de navigateur et est réinitialisée lors du rafraîchissement. Pour des données persistantes et une collaboration multi-utilisateurs, suivez le guide d'[Installation](#installation) afin d'auto-héberger votre propre instance.

---

## Table des matières

**Comprendre Scrumooth**

- [Démo en ligne](#live-demo)
- [Le manifeste](#the-manifesto)
- [Ce que Scrumooth applique](#what-scrumooth-enforces)
- [À qui elle s'adresse](#who-its-for)
- [Pourquoi vous pouvez lui faire confiance](#why-you-can-trust-it)
- [Fonctionnalités](#features)

**Auto-hébergement et développement**

- [Pile technologique](#tech-stack)
- [Structure du projet](#project-structure)
- [Démarrage rapide](#quick-start)
- [Prérequis](#prerequisites)
- [Installation](#installation)
- [Commandes de développement courantes](#development-commands)
- [Tests](#testing)
- [Tests de charge (k6)](#load-testing-k6)
- [Qualité du code](#code-quality)
- [Gestion de la base de données](#database-management)
- [Prise en charge de Docker](#docker-support)
- [Déploiement](#deployment)
- [Dépannage](#troubleshooting)

**Projet**

- [Documentation](#documentation)
- [Feuille de route](#roadmap)
- [Contribuer](#contributing)
- [Licence](#license)

---

<a id="the-manifesto"></a>

## 📜 Le manifeste — Pourquoi Scrumooth existe

> La plupart des outils de gestion de projet sont conçus pour **enregistrer** ce qui s'est passé. Ils vous fournissent des tableaux, ils consignent vos clics, ils dessinent des graphiques précis —une fois le Sprint terminé. Enregistrer est réellement utile, et ces outils le font bien.
>
> Mais un enregistrement est une description, pas une décision. Le Scrum Guide 2020 regorge de règles auxquelles un outil pourrait vous tenir : un Sprint ne se clôture qu'après son Sprint Review et sa Sprint Retrospective, seuls les Developers estiment le travail, un seul Product Owner possède le Product Backlog, et « Done » signifie que la Definition of Done a été satisfaite. Quand l'une d'elles passe entre les mailles —un Sprint clôturé avant que sa Sprint Retrospective n'ait eu lieu, un Product Owner estimant le travail au nom des Developers, un élément marqué Done sans que ses critères aient été vérifiés—, cet écart reste généralement invisible jusqu'à la fin du Sprint. Dans la plupart des outils, ces règles sont indicatives : une compréhension partagée dont on fait confiance à l'équipe pour se souvenir.
>
> **Scrumooth les traite comme des règles.**
>
> La discipline n'est pas l'ingrédient manquant —si elle suffisait à elle seule, aucune équipe n'aurait jamais clôturé un Sprint sans sa Sprint Retrospective. Le Guide dit à une équipe quoi faire ; il ne peut pas remarquer quand l'équipe cesse de le faire. C'est pourquoi nous intégrons le **Scrum Guide 2020** sous forme de code exécutable et le **faisons respecter** côté serveur, là où ni l'interface ni un appel direct à l'API ne peuvent le contourner. Nous sommes un **gardien, pas un preneur de notes**.
>
> Moins de débats sur les processus. Plus de temps à livrer des logiciels fonctionnels.

<a id="what-scrumooth-enforces"></a>

## 🔒 Ce que Scrumooth applique

Ce sont des barrières, pas des avertissements ni des suggestions. Dans tous les cas ci-dessous, la réponse est non — et chaque réponse tient dans la couche de service du backend, de sorte qu'un raccourci côté frontend ne peut pas la contourner.

| Une règle du Scrum Guide 2020, posée comme une question                             | La réponse de Scrumooth                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Un Sprint peut-il être clôturé avant son Sprint Review et sa Sprint Retrospective ? | La clôture du Sprint est refusée tant que les deux événements ne sont pas enregistrés ([API sprints](docs/api/sprints.md)).                                                                          |
| Un élément peut-il être déclaré Done sans sa Definition of Done ?                   | Terminer un Sprint ne marque jamais les éléments comme Done — chaque élément doit franchir sa liste de contrôle de la Definition of Done ([API Definition of Done](docs/api/definition-of-done.md)). |
| Une équipe peut-elle avoir plus d'un Product Owner ou plus d'un Scrum Master ?      | L'ajout d'un second titulaire de l'un ou l'autre rôle est refusé ([API teams](docs/api/teams.md)).                                                                                                   |
| Une équipe peut-elle dépasser la taille d'une Scrum Team ?                          | La taille de l'équipe est plafonnée — `TEAM_MAX_SIZE`, par défaut `10` ([API teams](docs/api/teams.md)).                                                                                             |
| Quelqu'un d'autre qu'un Developer peut-il estimer le travail ?                      | Seuls les Developers peuvent estimer les éléments du Product Backlog — tout autre rôle reçoit `403 Forbidden` ([API Product Backlog](docs/api/product-backlog.md)).                                  |
| Le Product Owner ou le Scrum Master peuvent-ils rédiger le Daily Scrum ?            | Seuls les Developers peuvent rédiger ou rejoindre l'enregistrement quotidien ; le Product Owner et le Scrum Master observent ([API Daily Scrum](docs/api/daily-scrum.md)).                           |
| Un Sprint peut-il être annulé par quelqu'un d'autre que le Product Owner ?          | L'annulation est réservée au Product Owner, et uniquement tant que le Sprint est `ACTIVE` ([API sprints](docs/api/sprints.md)).                                                                      |
| Un Increment livré peut-il être réécrit ?                                           | Les Increments livrés sont verrouillés contre toute modification ultérieure ([API increments](docs/api/increments.md)).                                                                              |

**Là où Scrumooth n'applique délibérément rien :** la Prime Directive de la Sprint Retrospective reste du ressort de la facilitation, et les timeboxes des événements sont rendues visibles par un minuteur d'équipe partagé plutôt que de mettre fin à un événement de force. Le Guide demande l'autogestion exactement à ces endroits, Scrumooth ne décide donc pas à la place de l'équipe.

**À quoi ressemble une barrière en pratique.** C'est vendredi, le Sprint doit se terminer, l'Increment est déployé — et la Sprint Retrospective n'a jamais été planifiée. Un outil d'enregistrement clôture le Sprint et la Sprint Retrospective glisse à la semaine suivante, ce qui est l'échec que le dernier événement du Guide existe pour prévenir ; Scrumooth refuse la clôture tant que les deux événements ne sont pas enregistrés. L'équipe tient alors sa Sprint Retrospective, ou s'arrête et débat de la raison de ne pas le faire —la version de cette décision que le Guide attend d'une équipe qu'elle prenne consciemment.

Pourquoi les outils que vous utilisez déjà n'ajouteraient-ils pas simplement cela ? À notre avis, parce qu'une barrière que l'on peut désactiver est un réglage, pas une règle, et que la configurabilité est leur argument de vente et non leur omission. Pas plus qu'un service hébergé ne peut facilement promettre que vos données de processus ne quitteront jamais votre infrastructure. Scrumooth n'est pas une fonctionnalité qui leur manque ; c'est un compromis qu'ils ont déjà tranché dans l'autre sens.

Les barrières ci-dessus constituent toute la revendication : si une règle ne figure pas dans le tableau, Scrumooth ne l'applique pas — et comme une configuration qui enfreint le Scrum Guide 2020 n'est jamais proposée, **le refus est le produit.**

<a id="who-its-for"></a>

## 🎯 À qui elle s'adresse

**Scrumooth est conçue pour une situation en particulier :** les organisations pilotées par l'ingénierie qui doivent pouvoir démontrer comment un Sprint a réellement été mené, et pour lesquelles les données de processus ne peuvent pas quitter leur propre infrastructure — secteurs réglementés, leurs fournisseurs et équipes du secteur public.

**Scrumooth est faite pour vous si…**

- Vous êtes **Scrum Master ou Product Owner**, votre équipe a du mal à tenir le Scrum Guide 2020, et vous voulez que l'outil refuse la dérive au lieu de la tolérer en silence.
- Vous dirigez une **équipe d'ingénierie** qui souhaite auto-héberger ses données de processus pour des raisons de confidentialité, de conformité ou de souveraineté des données.
- Vous avez besoin d'un **enregistrement défendable et auditable** de la manière dont chaque Sprint a réellement été mené — qui a modifié quoi, quand et sous quel rôle.
- Vous voulez que les limites du Scrum Guide soient codées une fois pour toutes, afin que les nouveaux membres de l'équipe apprennent le processus en l'utilisant.

**Scrumooth n'est pas faite pour vous si…**

- Vous cherchez un outil de suivi des tickets généraliste, un planificateur de feuille de route ou un tableau Kanban pour du travail hors Scrum. Scrumooth refuse d'être l'un d'eux.
- Vous voulez que chaque règle soit configurable. Scrumooth refuse les configurations qui enfreignent le Scrum Guide.
- Vous voulez un SaaS entièrement géré. Scrumooth est auto-hébergée par conception.
- Vous avez besoin d'une gestion de portefeuille, d'une planification des ressources ou d'un suivi financier poussés sur de nombreux projets sans lien entre eux.
- Vous suivez un framework à l'échelle qui adapte le Guide pour une organisation plus large, ou Scrum n'est pas encore la façon de travailler de votre équipe. Scrumooth applique le Scrum Guide 2020 tel qu'écrit, pour une seule Scrum Team.

<a id="why-you-can-trust-it"></a>

## 🛡 Pourquoi vous pouvez lui faire confiance

**Pourquoi pas un service hébergé**

- **Auto-hébergée par conception.** Vos données de processus ne quittent jamais votre infrastructure.
- **Souveraineté des données intégrée.** L'export de données RGPD, un délai de grâce de 14 jours avant suppression et le suivi du consentement sont inclus dans le produit.
- **Auditable.** Chaque changement de rôle et chaque transition d'état sont consignés dans un journal d'audit dédié et séparé pour la conformité.
- **Accès borné.** Les sessions simultanées sont plafonnées et les plus anciennes sont révoquées automatiquement.

**Pourquoi pas un autre outil auto-hébergé**

- **Ouverte et inspectable.** Apache-2.0, CI publique, couverture publiée — une **barrière de 80 % sur les lignes, branches, fonctions et instructions** est appliquée dans la chaîne d'intégration.
- **Testée sous charge, pas seulement en tests unitaires.** 10 scénarios k6 préconstruits, dont un pic de Sprint Planning. Voir [Tests de charge](#load-testing-k6).
- **Stricte par construction.** Mode strict TypeScript sur le backend, le frontend et les paquets partagés.
- **Localisée là où cela compte.** L'interface est disponible en anglais, allemand, espagnol, français et italien, avec une terminologie Scrum issue du Scrum Guide officiel.

**Pour celles et ceux qui doivent l'approuver en interne.** Le guide de déploiement, l'architecture de sécurité et le processus de signalement des vulnérabilités sont documentés dans le dépôt : [Déploiement](#deployment), [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) et [`SECURITY.md`](SECURITY.md).

<a id="features"></a>

## ✨ Fonctionnalités

### Le flux de travail Scrum

Tout ce qu'il faut pour mener le Sprint — les cinq événements, trois artefacts et trois engagements du Guide — avec la règle qu'il porte attachée à chacun. Les clauses en gras reprennent les barrières de [Ce que Scrumooth applique](#what-scrumooth-enforces) ; ce tableau reste la seule liste des règles que Scrumooth revendique.

- **Product Goal** - Alignement stratégique et suivi des objectifs ; l'engagement au service du backlog
- **Product Backlog** - Priorisation MoSCoW (Must, Should, Could, Won't) ; **seuls les Developers estiment le travail**
- **Sprint Planning** - Durées de Sprint configurables et planification de la capacité ; **seuls les Developers enregistrent le Sprint Backlog**
- **Sprint Execution** - Tableau Kanban interactif avec glisser-déposer ; **seul le Product Owner peut annuler, et uniquement tant que le Sprint est `ACTIVE`**
- **Daily Scrum** - Enregistrement quotidien partagé, avec remontée des Impediments ; **seuls les Developers le rédigent — le Product Owner et le Scrum Master observent**
- **Impediment** - Identification des blocages et suivi de leur résolution ; **un Sprint ne peut pas être clôturé avant que ses Impediments soient résolus**
- **Increment** - Gestion des Increments du produit ; **dès qu'un élément du Product Backlog satisfait la Definition of Done, un Increment naît**
- **Sprint Review** - Gestion de la revue, retours des parties prenantes et ajustement du backlog ; **un Sprint ne peut pas être clôturé avant que son Sprint Review ne soit enregistré**
- **Sprint Retrospective** - Réflexion d'équipe et amélioration suivie ; **un Sprint ne peut pas être clôturé avant que sa Sprint Retrospective ne soit enregistrée**

### Gouvernance et exploitation

- **Moteur de workflow** - Autorisations basées sur les rôles et transitions d'état contrôlées, **appliquées côté serveur**
- **Definition of Done/Ready** - Listes de contrôle personnalisables ; **rien n'est Done tant que sa liste de contrôle n'est pas franchie**
- **Intégrité des Increments** - **Le travail livré ne peut pas être réécrit en silence**

### Équipe et organisation

- **Composition de l'équipe** - Un Product Owner et un Scrum Master ; **taille de l'équipe plafonnée** (`TEAM_MAX_SIZE`, par défaut `10`)
- **Journalisation d'audit** - Journal dédié et séparé pour la conformité ; **chaque changement de rôle et chaque transition d'état enregistrés**
- **Tableau de bord et rapports** - Métriques et visualisations en temps réel
- **Communication d'équipe** - Notifications et messagerie intégrées
- **Team Health Check** - Point périodique sur les cinq valeurs Scrum
- **Timeboxes d'événements partagées** - Une horloge pour tous les participants ; **les timeboxes sont affichées, jamais closes de force**
- **Contrôles de confidentialité** - Droits d'export et d'effacement des données, plus suivi du consentement

<a id="tech-stack"></a>

## 🛠 Pile technologique

### Backend

- **Runtime :** Node.js 24+
- **Framework :** Express.js 5
- **Langage :** TypeScript (mode strict)
- **Base de données :** PostgreSQL 18+ avec Prisma ORM 7
- **Authentification :** JWT avec bcrypt
- **Validation :** Zod
- **Tâches planifiées :** node-cron
- **E-mail :** Nodemailer (fournisseurs SMTP, SendGrid, AWS SES)
- **Journalisation :** Winston avec transports de fichiers rotatifs

### Frontend

- **Framework :** React 19 avec Vite
- **Langage :** TypeScript (mode strict)
- **Routage :** React Router 8
- **Gestion d'état :** TanStack Query (React Query) + Zustand
- **Visualisation :** Chart.js
- **Styles :** CSS Modules avec Design Tokens
- **Suivi des erreurs :** Sentry (optionnel, via `VITE_SENTRY_DSN`)

### Partagé

- Types et interfaces TypeScript
- Constantes et énumérations
- Fonctions utilitaires

### Tests et qualité

- **Unitaires / Intégration :** Vitest
- **End-to-End :** Playwright (frontend) + Vitest (backend)
- **Tests de charge :** k6 (10 scénarios préconstruits)
- **Linting :** ESLint + Stylelint
- **Formatage :** Prettier
- **Git Hooks :** Husky + lint-staged

<a id="project-structure"></a>

## 📁 Structure du projet

```
scrumooth/
├── packages/
│   ├── backend/              # API REST Express.js
│   │   ├── src/
│   │   │   ├── controllers/  # Gestionnaires de routes API
│   │   │   ├── services/     # Couche de logique métier
│   │   │   ├── middleware/   # Middleware Express
│   │   │   ├── routes/       # Définitions des routes API
│   │   │   ├── utils/        # Fonctions utilitaires
│   │   │   └── __tests__/    # Tests unitaires, d'intégration et e2e
│   │   ├── prisma/           # Schéma de base de données et migrations
│   │   ├── Dockerfile        # Image de production
│   │   └── Dockerfile.dev    # Image de développement
│   ├── frontend/             # Frontend React + Vite
│   │   ├── src/
│   │   │   ├── components/   # Composants React
│   │   │   ├── pages/        # Pages au niveau des routes
│   │   │   ├── hooks/        # Hooks React personnalisés
│   │   │   ├── services/     # Services client API
│   │   │   ├── stores/       # Stores Zustand
│   │   │   └── styles/       # CSS et design tokens
│   │   ├── e2e/              # Tests end-to-end Playwright
│   │   ├── Dockerfile        # Image de production
│   │   └── Dockerfile.dev    # Image de développement
│   └── shared/               # Types, constantes et utilitaires partagés
├── docs/
│   ├── api/                  # Référence de l'API REST
│   ├── architecture/         # Conception système, modèle de données, sécurité
│   ├── deployment/           # Guides de déploiement
│   └── user-guide/           # Documentation utilisateur et guides
├── k6/                       # Scénarios de tests de charge (k6)
│   └── scripts/scenarios/    # scénarios de tests de charge préconstruits
├── scripts/                  # Scripts de build et utilitaires
├── .github/workflows/        # CI, Release et déploiement GitHub Pages
├── docker-compose.yml        # Docker Compose de production
├── docker-compose.dev.yml    # Docker Compose de développement
├── CHANGELOG.md              # Historique des versions
├── SECURITY.md               # Politique de sécurité et signalement
├── CONTRIBUTING.md           # Directives de contribution
├── CODE_OF_CONDUCT.md        # Code de conduite de la communauté
└── THIRD-PARTY-NOTICES.md    # Attributions de licences tierces
```

<a id="quick-start"></a>

## ⚡ Démarrage rapide

Le moyen le plus rapide d'exécuter une instance locale est d'utiliser Docker Compose :

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
cp packages/backend/.env.production.example packages/backend/.env.production
docker compose up -d
```

Cela démarre le proxy inverse Caddy, le backend, le frontend et PostgreSQL. Une fois en cours d'exécution, ouvrez <http://localhost> (HTTPS est activé par défaut sur le port 443). Pour une configuration manuelle complète (sans Docker), consultez [Installation](#installation).

> **Remarque :** Le stack Compose de production nécessite `packages/backend/.env.production`. Si vous préférez un environnement de développement entièrement préconfiguré avec rechargement à chaud, utilisez plutôt `docker compose -f docker-compose.dev.yml up`.

<a id="prerequisites"></a>

## 📋 Prérequis

- **Node.js** v24.19.0 ou supérieur
- **pnpm** v11.21.0 ou supérieur
- **PostgreSQL** v18 ou supérieur
- **Docker** et **Docker Compose** (optionnel, pour le démarrage rapide)

<a id="installation"></a>

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/orbivort/scrumooth.git
cd scrumooth
```

### 2. Installer les dépendances

Ce projet utilise pnpm comme gestionnaire de paquets. Le projet impose pnpm via des scripts de préinstallation.

```bash
pnpm install
```

### 3. Configuration de l'environnement

Copiez les fichiers d'environnement d'exemple et configurez vos paramètres :

```bash
# Backend configuration
cp packages/backend/.env.example packages/backend/.env

# Frontend configuration
cp packages/frontend/.env.example packages/frontend/.env
```

Modifiez les fichiers d'environnement avec votre configuration :

**Backend** (`packages/backend/.env`) :

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

**Frontend** (`packages/frontend/.env`) :

```env
# Backend API URL
VITE_API_URL=http://localhost:5001/api/v1

# Use mock API (set to false for real backend)
VITE_USE_MOCK_API=false
```

### 4. Configuration de la base de données

Générez le client Prisma, puis créez votre schéma de base de données. Pour le développement local, vous pouvez utiliser l'une ou l'autre approche :

```bash
# Generate Prisma client (always required)
pnpm run db:generate

# Option A: Push schema directly (fast iteration, no migration files)
pnpm run db:push

# Option B: Create and apply a migration (recommended for tracked changes)
pnpm run db:migrate
```

Pour les déploiements de production, utilisez `pnpm run db:migrate:prod` pour appliquer les migrations existantes sans invite interactive.

### 5. Démarrer le serveur de développement

```bash
pnpm run dev
```

Cela démarrera les serveurs backend et frontend simultanément. Pour les exécuter indépendamment :

```bash
pnpm run dev:backend    # Backend only (http://localhost:5001)
pnpm run dev:frontend   # Frontend only (http://localhost:5173)
```

<a id="development-commands"></a>

## 🛠 Commandes de développement courantes

Pour les développeurs, l'analogie la plus proche est un linter pour votre processus Scrum — avec la différence qui compte : un linter signale une infraction, une barrière la refuse.

Les commandes les plus courantes pour le développement quotidien :

| Tâche                           | Commande                |
| ------------------------------- | ----------------------- |
| Démarrer backend + frontend     | `pnpm run dev`          |
| Démarrer uniquement le backend  | `pnpm run dev:backend`  |
| Démarrer uniquement le frontend | `pnpm run dev:frontend` |
| Construire tous les paquets     | `pnpm run build`        |

<a id="testing"></a>

## 🧪 Tests

```bash
pnpm run test              # Tous les tests
pnpm run test:coverage     # Avec rapport de couverture
pnpm run test:unit         # Tests unitaires uniquement
pnpm run test:integration  # Tests d'intégration du backend
pnpm run test:e2e          # End-to-end (backend Vitest + frontend Playwright)
pnpm run test:watch        # Mode watch
```

Seuils de couverture imposés : **80 % de lignes, fonctions, instructions et branches**.

<a id="load-testing-k6"></a>

### Tests de charge (k6)

Les scénarios de tests de charge préconstruits se trouvent dans [`k6/scripts/scenarios/`](k6/scripts/scenarios). Copiez [`k6/.env.k6.example`](k6/.env.k6.example) vers `k6/.env.k6`, configurez votre cible, puis exécutez un scénario tel que :

```bash
pnpm run loadtest:normal    # Realistic everyday load
pnpm run loadtest:peak      # Sprint planning rush (worst-case concurrency)
pnpm run loadtest:stress    # Push the system until it breaks
```

> **Prérequis :** Installez [k6](https://k6.io/docs/get-started/installation/) et assurez-vous que votre backend cible est en cours d'exécution. Dix scénarios se trouvent dans [`k6/scripts/scenarios/`](k6/scripts/scenarios) ; les scripts `loadtest:*` de [`package.json`](package.json) en exposent huit, dont endurance, multi-team, daily-scrum, auth et database stress.

<a id="code-quality"></a>

## 🔍 Qualité du code

| Tâche                          | Commande             |
| ------------------------------ | -------------------- |
| Lint (ESLint)                  | `pnpm run lint`      |
| Lint et correction automatique | `pnpm run lint:fix`  |
| Lint CSS (Stylelint)           | `pnpm run lint:css`  |
| Formatage (Prettier)           | `pnpm run format`    |
| Vérification des types         | `pnpm run typecheck` |
| Audit de sécurité              | `pnpm run audit`     |

Consultez [`CONTRIBUTING.md`](CONTRIBUTING.md) pour le flux de travail de développement complet et les barrières qualité.

<a id="database-management"></a>

## 🗄 Gestion de la base de données

```bash
pnpm run db:generate     # Générer le client Prisma (après des changements de schéma)
pnpm run db:migrate      # Créer et appliquer une migration (développement)
pnpm run db:migrate:prod # Appliquer les migrations en production (non interactif)
pnpm run db:studio       # Ouvrir Prisma Studio (interface graphique de base de données)
```

Des commandes de base de données supplémentaires (`db:push`, `db:reset`, `db:validate`, `db:migrate:test`) sont documentées dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

<a id="docker-support"></a>

## 🐳 Prise en charge de Docker

Le projet inclut une configuration Docker pour le développement et le déploiement en production.

### Utiliser Docker Compose

```bash
# Development environment (with hot reload)
docker compose -f docker-compose.dev.yml up

# Production environment (detached)
docker compose up -d

# Tear down
docker compose down
```

### Construire les images Docker manuellement

> **Remarque :** Tous les Dockerfiles référencent des chemins relatifs à la racine du dépôt (fichiers du workspace monorepo tels que `package.json`, `pnpm-lock.yaml` et `packages/shared/`). Vous devez les construire depuis la **racine du dépôt** et utiliser `-f` pour pointer vers le Dockerfile — passer le répertoire du paquet comme contexte de build échouera.

```bash
# Development images (with dev dependencies and watch mode)
docker build -t scrumooth-backend:dev -f packages/backend/Dockerfile.dev .
docker build -t scrumooth-frontend:dev -f packages/frontend/Dockerfile.dev .

# Production images (build from the repo root)
docker build -t scrumooth-backend -f packages/backend/Dockerfile .
docker build -t scrumooth-frontend -f packages/frontend/Dockerfile .
```

<details>
<summary>Utiliser un miroir registry/apt</summary>

Si vous êtes derrière un réseau qui nécessite un registry npm ou un miroir apt, vous pouvez les définir comme arguments de build ou variables d'environnement :

```bash
# Docker Compose
$env:NPM_REGISTRY="https://your_mirror_url"
$env:APT_MIRROR="your_mirror_url"

# Manual build
docker build --build-arg NPM_REGISTRY=https://your_mirror_url --build-arg APT_MIRROR=your_mirror_url .
```

</details>

<a id="deployment"></a>

## ☁️ Déploiement

### Production auto-hébergée

Consultez [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md) pour un guide complet de déploiement en production, couvrant la configuration de l'environnement, la migration de la base de données, la configuration du proxy inverse et les bonnes pratiques opérationnelles.

### Déploiement de la démo sur GitHub Pages

La branche `main` est automatiquement déployée sur GitHub Pages via le workflow [`Deploy to GitHub Pages`](.github/workflows/deploy-github-pages.yml), en utilisant une **Mock API** en mémoire (aucun backend ni base de données requis). Consultez la [Démo en ligne](#live-demo) ci-dessus pour l'essayer.

<a id="documentation"></a>

## 📚 Documentation

| Domaine                     | Emplacement                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Guide utilisateur**       | [`docs/user-guide/`](docs/user-guide) — prise en main, fonctionnalités principales, flux de travail Scrum                              |
| **Référence API REST**      | [`docs/api/`](docs/api) — groupes d'endpoints couvrant l'authentification, les sprints, le backlog, les rapports et plus               |
| **Architecture système**    | [`docs/architecture/`](docs/architecture) — conception système, modèle de données, conception des composants, architecture de sécurité |
| **Guide de déploiement**    | [`docs/deployment/DEPLOYMENT.md`](docs/deployment/DEPLOYMENT.md)                                                                       |
| **Politique de sécurité**   | [`SECURITY.md`](SECURITY.md) — procédure de signalement des vulnérabilités                                                             |
| **Contribuer**              | [`CONTRIBUTING.md`](CONTRIBUTING.md) — directives et flux de travail de développement                                                  |
| **Code de conduite**        | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — normes de la communauté                                                                   |
| **Historique des releases** | [`CHANGELOG.md`](CHANGELOG.md)                                                                                                         |
| **Mentions tierces**        | [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)                                                                                     |

<a id="troubleshooting"></a>

## 🛟 Dépannage

### `Cannot find module @scrumooth/shared`

Le paquet partagé doit être construit avant que le backend/frontend puisse résoudre les imports.

```bash
pnpm --filter=@scrumooth/shared run build
```

Cela est normalement géré automatiquement par `pnpm install` et les scripts de développement, mais est nécessaire après un `pnpm run clean` manuel.

### `pnpm install` échoue avec « Use pnpm instead »

Le dépôt impose pnpm via un script `preinstall`. Installez pnpm globalement :

```bash
npm install -g pnpm@11.21.0
```

### Erreurs de connexion à la base de données au démarrage

Vérifiez que votre `DATABASE_URL` dans `packages/backend/.env` pointe vers une instance PostgreSQL 18+ en cours d'exécution et que la base de données existe. Exécutez `pnpm run db:validate` pour valider le schéma Prisma par rapport à la connexion.

### Port déjà utilisé (5001 ou 5173)

Les ports par défaut peuvent être remplacés via des variables d'environnement :

- Backend : `PORT` dans `packages/backend/.env`
- Frontend : `VITE_DEV_PORT` dans `packages/frontend/.env`

### Le frontend ne peut pas atteindre le backend

Vérifiez que `VITE_API_URL` dans `packages/frontend/.env` correspond à l'adresse réelle du backend et que `CORS_ORIGIN` dans `packages/backend/.env` autorise l'origine du frontend.

### Vous souhaitez développer sans backend ?

Définissez `VITE_USE_MOCK_API=true` dans `packages/frontend/.env` pour utiliser la même Mock API que celle qui alimente la démo en ligne.

<a id="roadmap"></a>

## 🗺 Feuille de route

Scrumooth est en développement actif. Les priorités ci-dessous approfondissent ce que Scrumooth applique plutôt que de l'élargir à un outil de suivi généraliste :

- [ ] **Rapport de conformité au Scrum Guide** — un état par Sprint des règles qui s'appliquaient et de la manière dont chacune a été satisfaite
- [ ] **Pack de preuves de Sprint exportable** — un enregistrement partageable pour les audits et les revues de conformité
- [ ] **Davantage de règles applicables** — étendre la surface couverte du Scrum Guide 2020
- [ ] **Automatisation plus poussée de la Definition of Done / Definition of Ready**
- [ ] **Des rapports qui font remonter la dérive du processus**, et pas seulement les métriques de livraison
- [ ] **Intégrations et webhooks**, pour que Scrumooth cohabite avec les outils que vous utilisez déjà
- [ ] Renforcement des performances et de l'évolutivité

L'état du projet et les dernières modifications sont suivis dans le [CHANGELOG](CHANGELOG.md). Les retours et les demandes de fonctionnalités sont les bienvenus via [GitHub Issues](https://github.com/orbivort/scrumooth/issues).

<a id="contributing"></a>

## 🤝 Contribuer

Les contributions sont les bienvenues ! Veuillez lire [`CONTRIBUTING.md`](CONTRIBUTING.md) pour le flux de travail de développement, les normes de code et le processus de pull request, et consultez le [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) avant de participer.

<a id="license"></a>

## 📝 Licence

Ce projet est sous licence [Apache License 2.0](LICENSE).

---

_Jugez un outil Scrum sur les règles qu'il fait respecter, non sur les tableaux qu'il dessine._
