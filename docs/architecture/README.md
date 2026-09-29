# Scrumooth Architecture Documentation

Design documentation for Scrumooth, the self-hosted Scrum Guide enforcement layer.

Each document below owns a single concern. Start with the system overview, then follow the document that matches your concern.

| Document                                                      | Covers                                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [System Architecture](./system-architecture.md)               | Layers, components, communication protocols, scaling and reliability design                                                 |
| [Component Design](./component-design.md)                     | Frontend components, backend services, shared-package internals                                                             |
| [Data Model](./data-model.md)                                 | Entity relationships, database schema, data flows, migration strategy                                                       |
| [API Specifications](./api-specifications.md)                 | REST design, versioning, envelopes and error handling (consumer reference: [docs/api](../api/README.md))                    |
| [Security Architecture](./security-architecture.md)           | Authentication, authorization, data protection, threat model                                                                |
| [Deployment Architecture](./deployment-architecture.md)       | Container topology, CI/CD, environment configuration, observability (runbook: [DEPLOYMENT.md](../deployment/DEPLOYMENT.md)) |
| [i18n Architecture](./i18n-architecture.md)                   | i18next integration, locale detection, translation organisation, new-language onboarding                                    |
| [Frontend Mock Architecture](./frontend-mock-architecture.md) | How the frontend runs without a backend, and why the mock sits at the HTTP boundary                                         |

## Reading Paths

- **New to the codebase:** [System Architecture](./system-architecture.md) → [Component Design](./component-design.md) → [Data Model](./data-model.md)
- **Contributing code:** [CONTRIBUTING.md](../../CONTRIBUTING.md)
- **Operating an instance:** [Deployment Architecture](./deployment-architecture.md) → [Deployment Guide](../deployment/DEPLOYMENT.md) → [Security Architecture](./security-architecture.md)
- **Translating:** [i18n Architecture](./i18n-architecture.md)

Feature-level and API-level documentation live in [docs/user-guide](../user-guide/README.md) and [docs/api](../api/README.md). The technology stack is listed in the [project README](../../README.md).
