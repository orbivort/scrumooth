# Scrumooth Architecture Documentation

Welcome to the Scrumooth Architecture Documentation. This comprehensive guide provides detailed information about the system's architecture, design decisions, and technical implementation.

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [High-Level Architecture](#high-level-architecture)
- [Documentation Sections](#documentation-sections)
- [Quick Navigation](#quick-navigation)

## Overview

Scrumooth is a **self-hosted Scrum Guide enforcement layer** — a web application that turns the rules of the 2020 Scrum Guide into gates the backend enforces. It is built with modern technologies and follows industry best practices. The architecture is designed to be:

- **Scalable**: Horizontal scaling capability for growing user bases
- **Maintainable**: Clean separation of concerns and modular design
- **Secure**: Security-first approach with multiple layers of protection
- **Performant**: Optimized for speed and efficiency
- **Reliable**: High availability and fault tolerance

### System Context

Scrumooth operates as a web-based application that enables teams to run Scrum, from Product Goals to Sprint Retrospectives, while the backend enforces the rules of the 2020 Scrum Guide.

```
┌────────────────────────────────────────────────────────────┐
│                        Users                               │
│  (Product Owners, Scrum Masters, Developers)               │
└────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌────────────────────────────────────────────────────────────┐
│                      Scrumooth                             │
│  Scrum Guide enforcement layer                             │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   Backend    │  │   Database   │      │
│  │   (React)    │◄─┤  (Express)   │◄─┤ (PostgreSQL) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────────────────────────────────────┘
```

## Architecture Principles

### 1. Separation of Concerns

The system follows a clear separation between:

- **Presentation Layer**: React frontend with component-based architecture
- **Business Logic Layer**: Express.js backend with service-oriented design
- **Data Access Layer**: Prisma ORM with repository pattern

### 2. Monorepo Structure

```
scrumooth/
├── packages/
│   ├── backend/      # Express.js REST API
│   ├── frontend/     # React web application
│   └── shared/       # Shared types and utilities
├── docs/             # Documentation
└── scripts/          # Build and utility scripts
```

### 3. API-First Design

- RESTful API design with versioning
- Consistent request/response formats
- Comprehensive error handling
- Rate limiting and security measures

### 4. Security by Design

- JWT-based authentication with secure cookies
- Role-based access control (RBAC)
- Input validation and sanitization
- Audit logging and monitoring

### 5. Performance Optimization

- Database query optimization with Prisma
- Frontend bundle optimization with Vite
- Caching strategies with TanStack Query
- Lazy loading and code splitting

## High-Level Architecture

### System Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  (Web Browser, Mobile Browser, API Clients)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│  React 19 + Vite + TypeScript                               │
│  - Component-based UI                                       │
│  - State management (TanStack Query + Zustand)              │
│  - Routing (React Router)                                   │
│  - Styling (CSS Modules + Design Tokens)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
│  Express.js + Middleware Stack                              │
│  - Authentication/Authorization                             │
│  - Rate limiting                                            │
│  - Request validation                                       │
│  - Error handling                                           │
│  - Audit logging                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                      │
│  Service Layer + Controllers                                │
│  - Authentication service                                   │
│  - Team management                                          │
│  - Sprint management                                        │
│  - Workflow engine                                          │
│  - Notification system                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Layer                        │
│  Prisma ORM + PostgreSQL                                    │
│  - Type-safe database access                                │
│  - Connection pooling                                       │
│  - Transaction management                                   │
│  - Query optimization                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                     │
│  Docker + CI/CD + Monitoring                                │
│  - Containerization                                         │
│  - Automated testing                                        │
│  - Continuous deployment                                    │
│  - Logging and monitoring                                   │
└─────────────────────────────────────────────────────────────┘
```

## Documentation Sections

### 1. [System Architecture](./system-architecture.md)

Detailed system architecture documentation including:

- Architectural patterns
- System components
- Communication protocols
- Integration points

### 2. [Component Design](./component-design.md)

In-depth component design documentation:

- Frontend components
- Backend services
- Shared utilities
- Component interactions

### 3. [Data Model](./data-model.md)

Database and data model documentation:

- Entity-relationship diagrams
- Database schema
- Data flows
- Migration strategy

### 4. [API Specifications](./api-specifications.md)

API architecture and design:

- RESTful API design
- Authentication and authorization
- Request/response formats
- Error handling

### 5. [Deployment Architecture](./deployment-architecture.md)

Infrastructure and deployment:

- Container architecture
- CI/CD pipeline
- Environment configuration
- Scaling strategy

### 6. [Security Architecture](./security-architecture.md)

Security considerations and implementation:

- Authentication mechanisms
- Authorization model
- Data protection
- Security best practices

### 7. [i18n Architecture](./i18n-architecture.md)

Internationalization architecture and implementation:

- Library selection (`i18next` + `react-i18next`) and locale detection strategy
- Frontend / backend / shared-package integration patterns
- Translation file organization, pluralization, and cultural formatting
- New-language onboarding playbook and modern best-practices alignment (2026)

## Quick Navigation

### For Developers

- **Getting Started**: [README.md](../../README.md)
- **API Documentation**: [API Docs](../api/README.md)
- **Development Guide**: [AGENTS.md](../../AGENTS.md)
- **Internationalization**: [i18n Architecture](./i18n-architecture.md)

### For Architects

- **System Design**: [System Architecture](./system-architecture.md)
- **Component Design**: [Component Design](./component-design.md)
- **Data Model**: [Data Model](./data-model.md)

### For DevOps

- **Deployment**: [Deployment Architecture](./deployment-architecture.md)
- **Security**: [Security Architecture](./security-architecture.md)
- **Monitoring**: [Deployment Architecture - Monitoring](./deployment-architecture.md#monitoring)

### For Product Owners

- **Features**: [README.md - Features](../../README.md#-features)
- **Changelog**: [CHANGELOG.md](../../CHANGELOG.md)

## Technology Stack

### Backend

| Technology | Version | Purpose              |
| ---------- | ------- | -------------------- |
| Node.js    | 24+     | Runtime environment  |
| Express.js | 5.x     | Web framework        |
| TypeScript | 6.x     | Programming language |
| Prisma     | 7.x     | ORM                  |
| PostgreSQL | 18+     | Database             |
| JWT        | -       | Authentication       |
| bcrypt     | 6.x     | Password hashing     |
| Zod        | 4.x     | Request validation   |
| Winston    | 3.x     | Logging              |

### Frontend

| Technology     | Version | Purpose                 |
| -------------- | ------- | ----------------------- |
| React          | 19.x    | UI framework            |
| Vite           | 8.x     | Build tool              |
| TypeScript     | 6.x     | Programming language    |
| TanStack Query | 5.x     | Server state management |
| Zustand        | 5.x     | Client state management |
| React Router   | 8.x     | Routing                 |
| Chart.js       | 4.x     | Data visualization      |
| Axios          | 1.x     | HTTP client             |

### Infrastructure

| Technology     | Purpose            |
| -------------- | ------------------ |
| Docker         | Containerization   |
| GitHub Actions | CI/CD              |
| pnpm           | Package management |
| Husky          | Git hooks          |
| ESLint         | Code linting       |
| Prettier       | Code formatting    |

## Architecture Decisions

Key architectural decisions documented in this section:

### 1. Monorepo Structure

**Decision**: Use a monorepo with pnpm workspaces

**Rationale**:

- Shared code between frontend and backend
- Consistent dependency management
- Simplified development workflow
- Better code reuse

### 2. TypeScript Strict Mode

**Decision**: Enable TypeScript strict mode across all packages

**Rationale**:

- Type safety and error prevention
- Better IDE support
- Improved code quality
- Easier refactoring

### 3. Prisma ORM

**Decision**: Use Prisma as the ORM

**Rationale**:

- Type-safe database access
- Auto-generated types
- Migration management
- Query optimization

### 4. JWT with HTTP-Only Cookies

**Decision**: Use JWT tokens stored in HTTP-only cookies

**Rationale**:

- XSS protection
- Automatic cookie handling
- Stateless authentication
- Secure token storage

### 5. Service Layer Pattern

**Decision**: Implement service layer between controllers and data access

**Rationale**:

- Business logic separation
- Reusable code
- Easier testing
- Better maintainability

## Quality Attributes

### Performance

- **Frontend**: Code splitting, lazy loading, bundle optimization
- **Backend**: Query optimization, connection pooling, caching
- **Database**: Proper indexing, query planning, connection management

### Scalability

- **Horizontal Scaling**: Stateless backend design
- **Database Scaling**: Connection pooling, read replicas (future)
- **Caching**: TanStack Query for frontend, database query caching

### Security

- **Authentication**: JWT with secure cookies
- **Authorization**: Role-based access control
- **Data Protection**: Encryption, input validation, audit logging
- **Network Security**: HTTPS, CORS, rate limiting

### Reliability

- **Error Handling**: Comprehensive error handling with custom errors
- **Logging**: Structured logging with rotation
- **Monitoring**: Health checks, performance monitoring
- **Backup**: Database backup strategy

### Maintainability

- **Code Quality**: TypeScript strict mode, ESLint, Prettier
- **Testing**: Unit, integration, and E2E tests
- **Documentation**: Comprehensive documentation
- **Version Control**: Git with conventional commits

---

**Last Updated**: 2026-08-16  
**Version**: 1.1.0  
**Maintainers**: Orbivort
