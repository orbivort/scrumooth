# Scrumooth — lo Scrum Guide, applicato.

**Giudica uno strumento Scrum dalle regole che rispetta, non dalle board che disegna.**

**Scrumooth** è un'applicazione web self-hosted e open source per i team che fanno Scrum. È pensata per Scrum Master, Product Owner e team guidati dall'ingegneria che vogliono che il processo si conformi alla Guida. Trasforma le regole della **Scrum Guide 2020** in barriere che il backend applica ovunque uno strumento possa farlo — e dichiara i punti in cui deliberatamente non lo fa.

**Non** è un sostituto del tuo strumento di tracciamento delle issue. Come livello di applicazione della Scrum Guide che il tuo strumento non ha, è proprietario del ciclo di vita dello Sprint, dei ruoli e delle barriere, e rifiuta che una violazione del processo passi in silenzio. Il tuo strumento conserva il tuo registro; questo conserva le tue regole. Ogni regola che applica è riassunta in [Cosa applica Scrumooth](#what-scrumooth-enforces) e catalogata codice per codice nel [catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections) — e nessuna regola al di fuori di quel catalogo viene rivendicata.

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

> **Nota:** La demo viene eseguita interamente nel tuo browser, su un universo immaginario di persone, team e prodotti inventati — nessun nome reale, datore di lavoro o dato vi compare. Accedi con un solo clic dalle schede dei personaggi nella pagina di accesso, e scegli un ruolo per vedere cosa quel ruolo può fare (una persona ricopre deliberatamente un ruolo diverso in ciascun team). Le richieste sono servite da un backend simulato, quindi qualsiasi modifica apporti dura per la tua sessione e viene azzerata al refresh. Per dati persistenti e collaborazione multi-utente, segui la guida all'[Installazione](#installation) per ospitare autonomamente la tua istanza.

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
> La disciplina non è l'ingrediente mancante —se bastasse da sola, nessun team avrebbe mai chiuso uno Sprint senza la sua Sprint Retrospective. La Guida dice a un team cosa fare; non può accorgersi quando il team smette di farlo. Per questo integriamo la **Scrum Guide 2020** come codice eseguibile e la **facciamo rispettare** lato server, dove né l'interfaccia né una chiamata diretta all'API possono aggirarla. Siamo un **guardiano, non un annotatore**.
>
> Meno dibattiti sui processi. Più tempo per consegnare software funzionante.

<a id="what-scrumooth-enforces"></a>

## 🔒 Cosa applica Scrumooth

Queste sono barriere, non avvisi o suggerimenti. In tutti i casi seguenti la risposta è no — e ogni risposta vale nel livello di servizio del backend, così che una scorciatoia nel frontend non possa aggirarla.

Ciascuna è un rifiuto distinto che il backend può restituire, e il contratto ne contiene **68**: 39 barriere della Guida, 5 barriere di pratiche complementari e 24 barriere di integrità del processo — contate da quel singolo contratto e verificate in CI, così che i totali qui non possano discostarsi da ciò che il codice applica.

Le tabelle seguenti raggruppano le barriere in base a ciò che proteggono e indicano la regola principale che ciascuna applica. Il **catalogo completo, codice per codice** — ogni codice di rifiuto `GATE_*` con lo stato HTTP con cui viene restituito — è il [catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections), che è l'unica fonte di verità. Questa sezione è una visita guidata di quel catalogo, non un suo sostituto.

| Una regola della Scrum Guide 2020, posta come domanda                                                               | La risposta di Scrumooth                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Uno Sprint può essere chiuso prima del suo Sprint Review e della sua Sprint Retrospective?                          | Il completamento dello Sprint viene rifiutato finché entrambi gli eventi non sono registrati ([API sprints](docs/api/sprints.md)).                                                                                                                                                                                       |
| Un elemento può essere chiamato Done senza la sua Definition of Done?                                               | Completare uno Sprint non contrassegna mai gli elementi come Done — ogni elemento deve superare la sua checklist della Definition of Done ([API Definition of Done](docs/api/definition-of-done.md)).                                                                                                                    |
| Un team può avere più di un Product Owner o più di un Scrum Master?                                                 | L'aggiunta di un secondo titolare di uno dei due ruoli viene rifiutata ([API teams](docs/api/teams.md)).                                                                                                                                                                                                                 |
| Un team può superare la dimensione di uno Scrum Team?                                                               | La dimensione del team è limitata — `TEAM_MAX_SIZE`, predefinito `10` ([API teams](docs/api/teams.md)).                                                                                                                                                                                                                  |
| Due team su un unico prodotto possono avere due Definition of Done?                                                 | No: un gruppo di team possiede un'unica Definition of Done che i suoi team leggono, un team raggruppato non può modificare la propria e l'adesione registra la versione adottata ([API Team Groups](docs/api/team-groups.md)).                                                                                           |
| Qualcuno che non sia un Developer può stimare il lavoro?                                                            | Solo i Developers possono stimare gli elementi del Product Backlog — ogni altro ruolo riceve `403 Forbidden` ([API Product Backlog](docs/api/product-backlog.md)).                                                                                                                                                       |
| Il Product Owner o lo Scrum Master possono redigere il Daily Scrum?                                                 | Solo i Developers possono redigere o partecipare al registro giornaliero; il Product Owner e lo Scrum Master osservano ([API Daily Scrum](docs/api/daily-scrum.md)).                                                                                                                                                     |
| Uno Sprint può essere annullato da qualcuno che non sia il Product Owner?                                           | L'annullamento è riservato al Product Owner, e solo mentre lo Sprint è `ACTIVE` ([API sprints](docs/api/sprints.md)).                                                                                                                                                                                                    |
| Un Increment consegnato può essere riscritto?                                                                       | Gli Increments consegnati e archiviati sono terminali — né gli uni né gli altri possono essere riscritti, riconsegnati o riattivati ([API increments](docs/api/increments.md)).                                                                                                                                          |
| La Definition of Done può essere svuotata?                                                                          | Una Definition of Done deve mantenere almeno un elemento attivo; uno Sprint Backlog non può essere confermato, e uno Sprint non può iniziare, finché un team non ne ha una; e il lavoro non può essere contrassegnato come Done finché un team non ne ha una ([API Definition of Done](docs/api/definition-of-done.md)). |
| Un Increment può essere dichiarato utilizzabile, o consegnato, senza prove?                                         | Un Increment deve essere attestato utilizzabile per iscritto — con chi lo ha attestato e quando — prima di poter essere verificato o consegnato ([API increments](docs/api/increments.md)).                                                                                                                              |
| Qualcuno esterno al team può leggere o consegnare un Increment?                                                     | Un Increment appartiene al suo Scrum Team: leggerlo, verificarlo o consegnarlo richiede l'appartenenza al team ([API increments](docs/api/increments.md)).                                                                                                                                                               |
| Un Increment può omettere in silenzio il lavoro che ha raggiunto Done?                                              | La composizione riporta il suo esito (composta, saltata con una motivazione o fallita), e l'Increment di uno Sprint può essere riconciliato a partire dai suoi elementi Done ([API increments](docs/api/increments.md)).                                                                                                 |
| Uno Sprint può chiudersi mentre ha ancora impedimenti irrisolti?                                                    | No: uno Sprint non può essere completato finché un impedimento è ancora `OPEN` o `IN_PROGRESS`, ed entrambi gli stati terminali di un impedimento richiedono una risoluzione scritta ([API impediments](docs/api/impediments.md), [API sprints](docs/api/sprints.md)).                                                   |
| La Sprint Review o la Sprint Retrospective possono svolgersi fuori ordine, o prima della data di fine dello Sprint? | No: la Sprint Retrospective non può completarsi prima della sua Sprint Review, e nessuno dei due eventi può completarsi prima del giorno indicato dalla data di fine dello Sprint ([API sprint reviews](docs/api/sprint-reviews.md), [API retrospectives](docs/api/retrospectives.md)).                                  |
| Lo Sprint Goal può cambiare, o lo Sprint Backlog muoversi contro di esso, una volta che lo Sprint è in corso?       | No: lo Sprint Goal è bloccato una volta che lo Sprint è in corso, e una modifica che mette a rischio lo Sprint Goal resta in sospeso finché il Product Owner non ne prende atto ([API sprints](docs/api/sprints.md)).                                                                                                    |
| Il registro del Daily Scrum può omettere ciò che ha adattato?                                                       | No: un registro deve dichiarare almeno un adeguamento dello Sprint Backlog, oppure riconoscere esplicitamente che nessuno era necessario ([API Daily Scrum](docs/api/daily-scrum.md)).                                                                                                                                   |
| Uno Sprint può durare più di un mese, sovrapporsi a un altro Sprint o iniziare dopo una pausa?                      | No: uno Sprint può durare al massimo `SPRINT_MAX_DURATION_DAYS`, un team esegue un solo Sprint alla volta, e un nuovo Sprint inizia immediatamente dopo il precedente ([API sprints](docs/api/sprints.md)).                                                                                                              |
| Lo Sprint Backlog può essere creato senza l'intero Scrum Team?                                                      | No: uno Sprint non può iniziare a meno che la partecipazione alla pianificazione non sia registrata e includa il Product Owner e almeno un Developer, e a meno che il piano non rientri nella capacità registrata ([API sprints](docs/api/sprints.md)).                                                                  |
| Qualcuno che non sia il Product Owner può ordinare il Product Backlog?                                              | No: l'ordinamento del backlog e la fascia MoSCoW sono decisione esclusiva del Product Owner ([API Product Backlog](docs/api/product-backlog.md)).                                                                                                                                                                        |
| Un team può perseguire più di un Product Goal, o lasciare che il lavoro del backlog se ne allontani?                | No: un solo Product Goal `ACTIVE` alla volta; gli elementi vi sono ancorati; il Product Goal è riservato al Product Owner e non può completarsi senza prove registrate ([API Product Goals](docs/api/product-goals.md)).                                                                                                 |
| Uno Sprint può iniziare senza un Product Goal?                                                                      | No: uno Sprint non può iniziare finché non è collegato a un Product Goal ([API sprints](docs/api/sprints.md)).                                                                                                                                                                                                           |
| Un Increment può essere verificato prima di integrarsi con gli Increments precedenti?                               | No: si verifica che sia «additivo rispetto a tutti gli Increments precedenti e accuratamente verificato» prima che un Increment possa essere `VERIFIED` o consegnato ([API increments](docs/api/increments.md)).                                                                                                         |
| Un Increment può essere consegnato con una semplice scrittura di stato?                                             | No: `DELIVERED` è raggiungibile solo tramite l'azione di consegna, che registra come il valore ha raggiunto gli utenti ([API increments](docs/api/increments.md)).                                                                                                                                                       |
| Un miglioramento della Retrospective può essere scollegato in silenzio?                                             | No: una volta che un miglioramento ha prodotto un elemento del Product Backlog, o è stato collegato a uno, quel collegamento è la prova che è stato affrontato e non può essere rimosso ([API retrospectives](docs/api/retrospectives.md)).                                                                              |
| Una Sprint Review può completarsi senza giudicare lo Sprint Goal?                                                   | No: una Sprint Review di uno Sprint che ha uno Sprint Goal non può completarsi senza il verdetto registrato del team, e uno Sprint privo di Sprint Goal non può averne alcuno ([API sprint reviews](docs/api/sprint-reviews.md)).                                                                                        |

### Pratiche complementari che anche Scrumooth applica

Queste **non sono regole della Scrum Guide 2020** — i tre artefatti della Guida sono il Product Backlog, lo Sprint Backlog e l'Increment, e la Definition of Ready non è nessuno di essi. Sono aggiunte del prodotto stesso, etichettate come tali nell'interfaccia, ed elencate qui separatamente perché la tabella sopra continui a significare esattamente ciò che dice.

| Una pratica che Scrumooth applica, posta come domanda                                               | La risposta di Scrumooth                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un team può concordare cosa significa «ready» e poi pianificare comunque?                           | No: la Definition of Ready del team viene applicata al confine dello Sprint. Confermare uno Sprint Backlog o avviare uno Sprint viene rifiutato finché un elemento selezionato ha ancora un criterio di prontezza attivo non verificato — il rifiuto nomina gli elementi — e viene rifiutato finché il team non ha alcun criterio attivo ([API Definition of Ready](docs/api/definition-of-ready.md)). |
| Uno Sprint Backlog può includere un elemento che non è stato raffinato fino a «ready»?              | No: un elemento deve essere raffinato fino a `READY` prima di poter entrare in uno Sprint — al momento della pianificazione esattamente come quando viene aggiunto a Sprint in corso ([API Product Backlog](docs/api/product-backlog.md)).                                                                                                                                                             |
| Chi mantiene l'accordo sulla prontezza?                                                             | Solo lo Scrum Master del team. L'accordo sulla prontezza è la pratica dichiarata di un singolo ruolo anziché l'impegno condiviso dello Scrum Team, quindi spetta allo Scrum Master definirlo o ritirarlo ([API Definition of Ready](docs/api/definition-of-ready.md)).                                                                                                                                 |
| Qualcuno esterno al team può leggere l'accordo sulla prontezza o registrare un verdetto su di esso? | No: leggerlo o registrare una verifica della prontezza richiede l'appartenenza al team che lo possiede ([API Definition of Ready](docs/api/definition-of-ready.md)).                                                                                                                                                                                                                                   |

Vale la pena enunciare chiaramente due conseguenze. Poiché è una regola del prodotto anziché una regola della Guida, un team che non vuole una Definition of Ready la soddisfa comunque: Scrumooth crea sei criteri predefiniti ragionevoli la prima volta che l'accordo viene letto, e lo Scrum Master del team può definirli o ritirarli. E poiché rifiutare uno Sprint per un artefatto estraneo alla Guida è un vero compromesso, la checklist dichiara ciò che è con parole proprie — una pratica complementare, non un artefatto della Guida — invece di prendere in prestito l'autorità della Guida.

### Barriere di integrità del processo e trasparenza

Una terza classe non è né una barriera della Guida né una pratica complementare, ma la lettura che il prodotto dà della trasparenza e dell'autogestione della Guida: il lavoro di uno Scrum Team appartiene a quel team, e il materiale franco appartiene al ruolo che ne è responsabile. Sono elencate separatamente per lo stesso motivo delle pratiche sopra.

| Un confine che Scrumooth applica, posta come domanda                                            | La risposta di Scrumooth                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qualcuno esterno al team può leggere o modificare gli artefatti di un team?                     | No: uno Sprint, un impedimento, una Definition of Done, un Increment, una Sprint Review, una Sprint Retrospective, un health check sui valori Scrum, una barriera organizzativa, un report e gli accordi di lavoro del team sono ciascuno circoscritti al team che li possiede — leggerne o scriverne uno richiede l'appartenenza a quel team ([catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections)). |
| Chiunque tranne lo Scrum Master può leggere o scrivere il materiale proprio dello Scrum Master? | No: le note dello Scrum Master su uno Sprint, una Sprint Review e una Sprint Retrospective, il registro di coaching, la valutazione della cross-funzionalità, i risultati di un health check sui valori e l'accordo sulla prontezza sono suoi soltanto ([catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections)).                                                                                        |
| Un impedimento può essere escalato in una barriera due volte, o da un altro team?               | No: una sola barriera per impedimento, sollevata solo dal team che ha sollevato l'impedimento, e solo lo Scrum Master del team può sollevarla, modificarla, risolverla o chiuderla — uno stato terminale richiede una risoluzione scritta ([API Organizational Barriers](docs/api/organizational-barriers.md)).                                                                                                          |
| Un team può cambiare quale Definition of Done condivisa lo governa senza la sua leadership?     | No: aderire a un gruppo o lasciarlo decide l'impegno a cui il team è tenuto, quindi è decisione del Product Owner o dello Scrum Master del team; un team appartiene al massimo a un gruppo, e un gruppo che ha ancora team non può essere rimosso sotto i loro piedi ([API Team Groups](docs/api/team-groups.md)).                                                                                                       |

**Dove Scrumooth deliberatamente non applica nulla:** la Prime Directive della Sprint Retrospective resta a chi facilita, e le timebox degli eventi vengono mostrate tramite un timer condiviso del team invece di terminare un evento con la forza. La Guida chiede l'autogestione esattamente in quei punti, quindi Scrumooth non decide al posto del team.

**Come si presenta una barriera nella pratica.** È venerdì, lo Sprint deve concludersi, l'Increment è distribuito — e la Sprint Retrospective non è mai stata pianificata. Uno strumento di registrazione chiude lo Sprint e la Sprint Retrospective slitta alla settimana successiva, che è il fallimento che l'ultimo evento della Guida esiste per prevenire; Scrumooth rifiuta la chiusura finché entrambi gli eventi non sono registrati. Il team tiene allora la Sprint Retrospective, oppure si ferma e discute perché no —la versione di quella decisione che la Guida si aspetta che un team prenda consapevolmente.

Perché gli strumenti che già usi non aggiungono semplicemente tutto questo? A nostro avviso, perché una barriera che si può disattivare è un'impostazione, non una regola, e la configurabilità è il loro argomento di vendita e non una loro dimenticanza. Né un servizio ospitato può promettere facilmente che i tuoi dati di processo non lasceranno mai la tua infrastruttura. Scrumooth non è una funzionalità che manca loro; è un compromesso che hanno già preso nella direzione opposta.

Le tabelle sopra sono la rivendicazione relativa alla Scrum Guide 2020, raggruppate per ciò che proteggono, e il [catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections) è il catalogo completo, codice per codice, di ogni rifiuto che Scrumooth può restituire. Se una regola non è applicata in quel catalogo, Scrumooth non la applica — e poiché una configurazione che infrange la Guida non viene mai offerta, **il rifiuto è il prodotto.** Le pratiche complementari e le barriere di integrità del processo sono aggiunte del prodotto stesso, tenute in tabelle separate ed etichettate perché le tre non possano mai essere confuse tra loro — la classe di ciascuna barriera è dichiarata accanto al contratto, così che la separazione è verificata in CI anziché affermata qui.

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
- Segui un framework scalato che adatta la Guida per un'organizzazione più ampia, oppure Scrum non è ancora il modo di lavorare del tuo team. Scrumooth applica la Scrum Guide 2020 così com'è scritta, per un singolo Scrum Team.

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

Tutto ciò che serve per condurre lo Sprint — i cinque eventi, tre artefatti e tre impegni della Guida — con la regola che ciascuno sostiene. Le clausole in grassetto evidenziano le barriere di [Cosa applica Scrumooth](#what-scrumooth-enforces); il catalogo completo è il [catalogo delle barriere rifiutate](docs/api/README.md#gate-rejections).

- **Product Goal** - Allineamento strategico e monitoraggio degli obiettivi; l'impegno a cui serve il backlog; **solo il Product Owner ne crea o modifica uno, solo uno può essere `ACTIVE` alla volta, e non può completarsi senza prove registrate**
- **Product Backlog** - Prioritizzazione MoSCoW (Must, Should, Could, Won't); **solo i Developers stimano il lavoro, e solo il Product Owner lo ordina e ne fissa la fascia**
- **Sprint Planning** - Durate dello Sprint configurabili e pianificazione della capacità; **solo i Developers salvano lo Sprint Backlog**, uno Sprint non può iniziare finché la partecipazione alla pianificazione non è registrata con il Product Owner e un Developer, e nessun elemento entra nello Sprint prima di essere raffinato a `READY`
- **Sprint Execution** - Board Kanban interattiva con drag-and-drop; **solo il Product Owner può annullare, e solo mentre lo Sprint è `ACTIVE`**; lo Sprint Goal è bloccato una volta in corso, e una modifica che mette a rischio lo Sprint Goal attende che il Product Owner ne prenda atto
- **Daily Scrum** - Registro giornaliero condiviso, con emersione degli Impediments; **solo i Developers lo redigono — il Product Owner e lo Scrum Master osservano**; un registro deve dichiarare ciò che ha adattato, oppure che nulla doveva essere adattato
- **Impediment** - Identificazione dei blocchi e monitoraggio della risoluzione con prioritizzazione dell'impatto (Critical/High/Medium/Low) e date obiettivo; **uno Sprint non può chiudersi prima che i suoi Impediments siano risolti**, entrambi gli stati terminali richiedono una risoluzione scritta, ogni scrittura è circoscritta al team che ha sollevato l'impedimento, e un impedimento senza proprietario ricade sullo Scrum Master — che viene notificato quando uno invecchia oltre la soglia di escalation
- **Increment** - Gestione dell'Increment di prodotto; **nel momento in cui un elemento del Product Backlog soddisfa la Definition of Done, nasce un Increment**; un Increment viene verificato solo dopo essersi integrato con ogni Increment precedente, attestato utilizzabile per iscritto prima di poter essere verificato o consegnato, e consegnato solo con un metodo di consegna registrato
- **Sprint Review** - Gestione della revisione, feedback degli stakeholder e adeguamento del backlog; **uno Sprint non può chiudersi prima che la sua Sprint Review sia registrata**; la Sprint Review non può completarsi prima della data di fine dello Sprint, uno Sprint con uno Sprint Goal non può completarsi senza il verdetto del team stesso su di esso, e uno Sprint privo di Sprint Goal non può portare alcun verdetto
- **Sprint Retrospective** - Riflessione del team e miglioramento monitorato; **uno Sprint non può chiudersi prima che la sua Sprint Retrospective sia registrata**; non può completarsi prima della sua Sprint Review, applicare modifiche alla Definition of Done richiede una riflessione registrata, e un miglioramento già collegato a un elemento del Product Backlog non può essere scollegato

### Governance e operatività

- **Motore di workflow** - Permessi basati sui ruoli e transizioni di stato controllate, **applicate lato server**
- **Definition of Done/Ready** - Checklist personalizzabili; **nulla è Done finché la sua checklist non è superata**, l'accordo sulla prontezza è dello Scrum Master del team, e un team in un gruppo è governato dall'unica Definition of Done del gruppo
- **Integrità degli Increments** - **Il lavoro consegnato non può essere riscritto in silenzio**

### Team e organizzazione

- **Composizione del team** - Un Product Owner e uno Scrum Master; **dimensione del team limitata** (`TEAM_MAX_SIZE`, predefinito `10`)
- **Gruppi di team** - Più Scrum Team su un unico prodotto condividono un'unica Definition of Done; **un team raggruppato non può modificare la propria, l'adesione registra la versione adottata, e solo la leadership di un team può aderire a un gruppo o lasciarlo**
- **Registrazione di audit** - Registro dedicato e separato per la conformità; **ogni cambio di ruolo e ogni transizione di stato registrati**
- **Dashboard e reportistica** - Metriche e visualizzazioni in tempo reale; **ogni report è circoscritto al team di cui descrive la cronologia**
- **Comunicazione del team** - Notifiche e messaggistica integrate
- **Team Health Check** - Verifica periodica rispetto ai cinque valori Scrum; **i risultati sono leggibili solo dallo Scrum Master del team**
- **Barriere organizzative** - Il registro di ciò che blocca un team dall'esterno e delle azioni intraprese per rimuoverlo; **solo lo Scrum Master del team può sollevare, modificare, risolvere o chiudere una barriera, e la chiusura richiede una risoluzione scritta**
- **Facilitazione** - Il registro di coaching dello Scrum Master, gli accordi di lavoro del team e la valutazione della cross-funzionalità; **il materiale franco appartiene allo Scrum Master e gli accordi del team al team**
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

Entrambi i file di esempio sono documentati per intero dai loro stessi commenti. Un'esecuzione locale del backend necessita solo di tre valori:

| Variabile      | Scopo                                                         |
| -------------- | ------------------------------------------------------------- |
| `DATABASE_URL` | Stringa di connessione a PostgreSQL                           |
| `JWT_SECRET`   | Chiave di firma, almeno 64 caratteri (`openssl rand -hex 64`) |
| `CORS_ORIGIN`  | L'origine del frontend, ad es. `http://localhost:5173`        |

Il frontend non richiede alcuna configurazione per lo sviluppo locale: `VITE_API_URL` viene risolto dal proxy di sviluppo.
Per sviluppare senza alcun backend, imposta `VITE_USE_MOCK_API=true` ed esegui `pnpm run dev:frontend` —
vedi [Sviluppare senza un backend](./CONTRIBUTING.md#developing-without-a-backend) e
l'[architettura mock](./docs/architecture/frontend-mock-architecture.md). Ogni variabile rimanente è elencata in
[`packages/backend/.env.example`](packages/backend/.env.example) e
[`packages/frontend/.env.example`](packages/frontend/.env.example).

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
pnpm run test              # All tests
pnpm run test:coverage     # With coverage report
pnpm run test:unit         # Unit tests only
pnpm run test:integration  # Backend integration tests
pnpm run test:e2e          # End-to-end (backend Vitest + frontend Playwright)
pnpm run test:watch        # Watch mode
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
pnpm run db:generate     # Generate Prisma client (after schema changes)
pnpm run db:migrate      # Create and apply a migration (development)
pnpm run db:migrate:prod # Apply migrations in production (non-interactive)
pnpm run db:studio       # Open Prisma Studio (database GUI)
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
- [ ] **Più regole applicabili** — le barriere del ciclo di vita dello Sprint, del Product Goal, dei gruppi di team, del health check e delle barriere organizzative consentono ora a uno Scrum Team di eseguire dall'inizio alla fine gli eventi, gli artefatti e gli impegni della Guida; l'ampliamento della superficie coperta continua
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
