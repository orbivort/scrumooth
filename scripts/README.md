# Scripts Directory

This directory contains all utility scripts for the scrumooth project, organized by functional category.

## Directory Structure

```
scripts/
├── deployment/        # Deployment scripts
├── maintenance/       # Maintenance scripts
│   └── database/      # Database maintenance scripts
└── utility/           # Utility scripts
```

## Categories

### 🚀 deployment/

Scripts for deploying Scrumooth to production environments.

| Script      | Purpose                           |
| ----------- | --------------------------------- |
| `deploy.sh` | One-command production deployment |
| `README.md` | Deployment scripts documentation  |

**Quick Reference:**

```bash
# Deploy latest to localhost
./scripts/deployment/deploy.sh

# Deploy specific version to domain
./scripts/deployment/deploy.sh 1.0.0 example.com
```

See [deployment/README.md](./deployment/README.md) for detailed documentation.

### 🔧 maintenance/

Scripts for maintaining the application, including database operations.

#### maintenance/

Guards that keep the product's published claims in step with the code that backs them.

| Script                      | Purpose                                                           | Usage                   |
| --------------------------- | ----------------------------------------------------------------- | ----------------------- |
| `verify-gate-catalogue.mjs` | Verifies the gate contract, taxonomy, catalogue and README totals | `pnpm run gates:verify` |

**Gate catalogue verification:**

The README claims that a rule it does not enforce is not claimed at all, and it states how many
refusal codes the contract holds. Both claims are checked: every gate code must be defined,
classified, published in `docs/api/README.md` with the same HTTP status, and counted identically in
the README, and the rule-level README must name no individual code.

#### maintenance/database/

PostgreSQL database maintenance scripts for backup, restore, and validation.

| Script                    | Purpose                      |
| ------------------------- | ---------------------------- |
| `db-backup.sh`            | Create compressed SQL backup |
| `db-restore.sh`           | Restore from SQL backup      |
| `db-validate.sh`          | Validate database integrity  |
| `db-volume-backup.sh`     | Create volume-level backup   |
| `db-volume-restore.sh`    | Restore from volume backup   |
| `DATABASE_MAINTENANCE.md` | Comprehensive documentation  |

**Quick Reference:**

```bash
# Validate database
./scripts/maintenance/database/db-validate.sh

# Create backup
./scripts/maintenance/database/db-backup.sh [./backups]

# Restore from backup
./scripts/maintenance/database/db-restore.sh <backup_file>
```

See [DATABASE_MAINTENANCE.md](./maintenance/database/DATABASE_MAINTENANCE.md) for detailed documentation.

### 🛠️ utility/

General utility scripts for development and code quality.

| Script                        | Purpose                                  | Usage                                                       |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `add-import-extensions.js`    | Add `.js` extensions to relative imports | `node scripts/utility/add-import-extensions.js`             |
| `check-package-manager.js`    | Enforces pnpm usage                      | Auto-run via npm pre-scripts                                |
| `create-git-branch.js`        | Create git branch with validation        | `pnpm run branch:create feat/user-dashboard`                |
| `eslint-plugin-icon-rules.js` | ESLint plugin for icon usage             | Integrated in ESLint config                                 |
| `generate-icon-types.ts`      | Generate TypeScript types for icons      | `pnpm --filter=@scrumooth/frontend run generate:icon-types` |
| `validate-git-branch.js`      | Validate git branch names                | `pnpm run branch:validate [branch-name]`                    |

**Branch Name Validation:**

Git branch names must follow the conventional pattern: `<type>/<description>`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

```bash
# Validate current branch
pnpm run branch:validate

# Validate specific branch name
pnpm run branch:validate feat/user-dashboard

# Create new branch with validation
pnpm run branch:create feat/user-dashboard
pnpm run branch:create fix login validation  # Converts to fix/login-validation
```

**Examples:**

- ✅ `feat/user-dashboard`
- ✅ `fix/login-validation`
- ✅ `chore/update-dependencies`
- ❌ `my-feature` (missing type prefix)
- ❌ `feature/user-dashboard` (invalid type)

## Naming Conventions

- **Shell scripts**: Use kebab-case with `.sh` extension (e.g., `db-backup.sh`)
- **JavaScript/TypeScript**: Use kebab-case with appropriate extension (e.g., `check-package-manager.js`)
- **PowerShell**: Use kebab-case with `.ps1` extension (e.g., `deploy.ps1`)
- **Documentation**: Use UPPERCASE with `.md` extension (e.g., `DATABASE_MAINTENANCE.md`)

## Adding New Scripts

When adding new scripts:

1. Determine the appropriate category subdirectory
2. Follow the naming conventions above
3. Include a header comment explaining the script's purpose
4. Update this README with the new script's documentation
5. If the script affects project configuration, update relevant documentation

## Related Documentation

- [Deployment Guide](../docs/deployment/DEPLOYMENT.md)
- [Database Maintenance](./maintenance/database/DATABASE_MAINTENANCE.md)
- [Development Standards](../CONTRIBUTING.md#code-quality-standards)
