# Database Maintenance Guide

This guide covers PostgreSQL database validation, backup, restore procedures, and production enhancements for the Scrumooth application.

## Quick Reference

| Task                  | Command                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| Validate Database     | `./scripts/maintenance/database/db-validate.sh`                             |
| Create SQL Backup     | `./scripts/maintenance/database/db-backup.sh [./backups]`                   |
| Create Volume Backup  | `./scripts/maintenance/database/db-volume-backup.sh [./backups/volumes]`    |
| Restore SQL Backup    | `./scripts/maintenance/database/db-restore.sh <backup_file>`                |
| Restore Volume Backup | `./scripts/maintenance/database/db-volume-restore.sh <backup_file.tar.gz>`  |
| View PostgreSQL Logs  | `docker logs scrumooth-postgres` or `cat ./logs/postgresql/*.log`           |
| Check PgBouncer Stats | `docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW STATS;"`   |
| Manual Backup         | `docker exec scrumooth-postgres pg_dump -U postgres scrumooth > backup.sql` |
| Manual Restore        | `docker exec -i scrumooth-postgres psql -U postgres scrumooth < backup.sql` |

---

## Database Validation

### What It Checks

The validation script performs comprehensive checks on your database:

1. **Container Status** - Verifies PostgreSQL container is running and healthy
2. **Database Connectivity** - Tests connection and retrieves PostgreSQL version
3. **Database Statistics** - Shows database size and table statistics
4. **Integrity Checks**:
   - Tables without primary keys
   - Long-running queries (> 5 minutes)
   - Blocking locks
5. **Prisma Migration Status** - Checks migration table and failed migrations
6. **Disk Space** - Monitors PostgreSQL data directory usage
7. **Connection Pool** - Shows current/max connections and connection states

### Usage

```bash
# Make script executable (first time only)
chmod +x ./scripts/maintenance/database/db-validate.sh

# Run validation
./scripts/maintenance/database/db-validate.sh
```

### Sample Output

```
=== Container Status ===
[INFO] Container 'scrumooth-postgres' is running
[INFO] Container health: healthy

=== Database Connectivity ===
[INFO] Database is accepting connections
[INFO] PostgreSQL version: PostgreSQL 18.2 on x86_64-pc-linux-musl...

=== Database Statistics ===
[INFO] Database size: 15 MB
[INFO] Table statistics:
 schemaname | table_name | row_count | total_size
------------+------------+-----------+------------
 public     | User       |       150 | 8192 bytes
 public     | Team       |        25 | 8192 bytes
...
```

---

## Database Backup

### Automated Backup Script

The backup script creates compressed SQL dumps with automatic cleanup.

#### Features

- **Compressed backups** - Uses gzip to reduce storage
- **Automatic cleanup** - Removes backups older than 7 days
- **Timestamped filenames** - Easy identification
- **Container health check** - Ensures PostgreSQL is running

#### Usage

```bash
# Make script executable (first time only)
chmod +x ./scripts/maintenance/database/db-backup.sh

# Backup to default directory (./backups)
./scripts/maintenance/database/db-backup.sh

# Backup to custom directory
./scripts/maintenance/database/db-backup.sh /path/to/backup/directory
```

#### Backup File Naming

```
scrumooth_backup_YYYYMMDD_HHMMSS.sql.gz
```

Example: `scrumooth_backup_20250427_143022.sql.gz`

#### Manual Backup

```bash
# Simple backup
docker exec scrumooth-postgres pg_dump -U postgres scrumooth > backup.sql

# Compressed backup
docker exec scrumooth-postgres pg_dump -U postgres scrumooth | gzip > backup.sql.gz

# With custom filename
docker exec scrumooth-postgres pg_dump -U postgres scrumooth > "backup_$(date +%Y%m%d).sql"
```

---

## Database Restore

### Restore Script

The restore script provides a safe way to restore from backups with pre-restore safety backup.

#### Safety Features

- **Pre-restore backup** - Automatically creates backup before restore
- **Application stop** - Stops backend/frontend during restore
- **Confirmation prompt** - Requires explicit confirmation
- **Post-restore verification** - Validates database after restore

#### Usage

```bash
# Make script executable (first time only)
chmod +x ./scripts/maintenance/database/db-restore.sh

# Restore from compressed backup
./scripts/maintenance/database/db-restore.sh ./backups/scrumooth_backup_20250427_143022.sql.gz

# Restore from uncompressed backup
./scripts/maintenance/database/db-restore.sh ./backups/scrumooth_backup_20250427_143022.sql
```

#### Manual Restore

```bash
# Restore from SQL file
docker exec -i scrumooth-postgres psql -U postgres scrumooth < backup.sql

# Restore from compressed file
gunzip < backup.sql.gz | docker exec -i scrumooth-postgres psql -U postgres scrumooth
```

---

## Automated Backup with Docker Compose

### Option 1: Using Cron in Host

Add to your host's crontab:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/scrumooth && ./scripts/maintenance/database/db-backup.sh ./backups >> ./logs/backup.log 2>&1
```

### Option 2: Using Backup Container

The production `docker-compose.yml` already includes a fully configured backup service. See the [docker-compose.yml](../../../docker-compose.yml) `backup` service definition (lines 278-308) for the actual configuration.

---

## Volume Backup (File-Level)

> ⚠️ **Important Note for Windows/Docker Desktop Users**: Volume backups have limitations on Windows with Docker Desktop because Docker volumes are stored inside the WSL2 VM. The SQL backup method (`db-backup.sh`) is recommended and fully supported on all platforms.

Volume backups create a complete snapshot of the PostgreSQL data files. This is useful for disaster recovery and faster restores for large databases.

### When to Use Volume Backups

- **Large databases** (> 10GB) where SQL dumps are slow
- **Disaster recovery** - complete data directory snapshot
- **Migration** - moving to new hardware or Docker host
- **Point-in-time recovery** - with WAL archiving enabled
- **Linux production servers** - Volume backups work fully on native Linux

### Platform Support

| Platform                 | SQL Backup | Volume Backup | Notes                        |
| ------------------------ | ---------- | ------------- | ---------------------------- |
| Linux                    | Full       | Full          | Both methods work natively   |
| macOS                    | Full       | Full          | Both methods work natively   |
| Windows (Docker Desktop) | Full       | Limited       | Use SQL backup (recommended) |

### Volume Backup Script

```bash
# Make script executable
chmod +x ./scripts/maintenance/database/db-volume-backup.sh

# Create volume backup
./scripts/maintenance/database/db-volume-backup.sh

# Custom backup directory
./scripts/maintenance/database/db-volume-backup.sh /custom/backup/path
```

**Note for Windows users**: If the backup file is empty (87 bytes), this is due to Docker Desktop's volume storage architecture. Use SQL backup instead.

### Volume Restore Script

```bash
# Make script executable
chmod +x ./scripts/maintenance/database/db-volume-restore.sh

# Restore from volume backup (⚠️ Destructive - replaces current data)
./scripts/maintenance/database/db-volume-restore.sh ./backups/volumes/postgres_volume_20250427_143022.tar.gz

# List available volume backups
ls -la ./backups/volumes/postgres_volume_*.tar.gz
```

### Volume vs SQL Backup Comparison

| Aspect                    | SQL Backup (pg_dump)        | Volume Backup (tar)                  |
| ------------------------- | --------------------------- | ------------------------------------ |
| **Portability**           | High - SQL is universal     | Low - tied to PostgreSQL version     |
| **Size**                  | Smaller (compressed)        | Larger (all data files)              |
| **Speed**                 | Slower for large DBs        | Faster for large DBs                 |
| **Granularity**           | Table-level restore         | All-or-nothing                       |
| **Version compatibility** | Works across versions       | Same version required                |
| **Windows support**       | Full support                | Limited (Docker Desktop)             |
| **Use case**              | Regular backups, migrations | Disaster recovery, large DBs (Linux) |

### Recommended Backup Strategy

```
./backups/
├── sql/                          # SQL dumps (daily)
│   ├── daily/
│   │   ├── scrumooth_backup_20250427_020000.sql.gz
│   │   └── scrumooth_backup_20250428_020000.sql.gz
│   ├── weekly/
│   │   └── scrumooth_backup_20250427_020000.sql.gz
│   └── monthly/
│       └── scrumooth_backup_20250401_020000.sql.gz
└── volumes/                      # Volume backups (weekly)
    └── postgres_volume_20250427_030000.tar.gz
```

### Offsite Backup

```bash
# Sync SQL backups to cloud storage
rclone sync ./backups/sql remote:scrumooth-backups/sql

# Sync volume backups (less frequently due to size)
rclone sync ./backups/volumes remote:scrumooth-backups/volumes

# Or using AWS CLI
aws s3 sync ./backups s3://your-bucket/scrumooth-backups/
```

---

## PostgreSQL Logging

PostgreSQL logging is now enabled in production to help with debugging and performance monitoring.

### Log Configuration

The following logging settings are enabled in `docker-compose.yml`:

| Setting                      | Value | Description                   |
| ---------------------------- | ----- | ----------------------------- |
| `logging_collector`          | on    | Enable log collection         |
| `log_statement`              | mod   | Log DDL and DML statements    |
| `log_connections`            | on    | Log successful connections    |
| `log_disconnections`         | on    | Log disconnections            |
| `log_checkpoints`            | on    | Log checkpoint activity       |
| `log_lock_waits`             | on    | Log lock wait timeouts        |
| `log_min_duration_statement` | 1000  | Log slow queries (> 1 second) |

### Viewing Logs

```bash
# View logs via Docker
docker logs scrumooth-postgres

# View log files (mounted to host)
ls -la ./logs/postgresql/
cat ./logs/postgresql/postgresql-2025-04-27_143022.log

# Follow logs in real-time
docker logs -f scrumooth-postgres

# Search for specific errors
docker logs scrumooth-postgres 2>&1 | grep ERROR
```

### Log Rotation

PostgreSQL automatically rotates logs daily. Old logs are managed by:

- Docker logging driver (max 5 files, 10MB each)
- PostgreSQL's built-in rotation

### Common Log Patterns

```bash
# Find slow queries
grep "duration:" ./logs/postgresql/*.log | sort -k3 -n | tail -20

# Find connection issues
grep "connection" ./logs/postgresql/*.log | grep -v "authorized"

# Find lock waits
grep "lock wait" ./logs/postgresql/*.log
```

---

## PgBouncer Connection Pooling

PgBouncer is a lightweight connection pooler for PostgreSQL that improves performance and resource utilization.

### Why Use PgBouncer?

- **Reduces connection overhead** - Reuses connections instead of creating new ones
- **Handles connection spikes** - Queues requests when all connections are busy
- **Protects PostgreSQL** - Prevents connection exhaustion
- **Improves performance** - Faster connection acquisition for applications

### Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Backend    │───▶│  PgBouncer  │───▶│  PostgreSQL │
│  (Prisma)   │    │   :6432     │    │   :5432     │
└─────────────┘    └─────────────┘    └─────────────┘
                    connection pool (min: 5, max: 20)
```

### Configuration

PgBouncer is configured in `docker-compose.yml` with these settings:

| Setting               | Value       | Description                                   |
| --------------------- | ----------- | --------------------------------------------- |
| `POOL_MODE`           | transaction | Pool per transaction (recommended for Prisma) |
| `MAX_CLIENT_CONN`     | 100         | Maximum client connections                    |
| `DEFAULT_POOL_SIZE`   | 20          | Default connections per database              |
| `MIN_POOL_SIZE`       | 5           | Minimum pooled connections                    |
| `SERVER_IDLE_TIMEOUT` | 600         | Close idle server connections (seconds)       |
| `SERVER_LIFETIME`     | 3600        | Maximum connection lifetime (seconds)         |

### Connection Strings

**Direct PostgreSQL (development):**

```
postgresql://postgres:password@postgres:5432/scrumooth
```

**Via PgBouncer (production recommended):**

```
postgresql://postgres:password@pgbouncer:6432/scrumooth
```

The `.env.production` file is already configured to use PgBouncer.

### Monitoring PgBouncer

```bash
# Check PgBouncer stats
docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW STATS;"

# Check active connections
docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW POOLS;"

# Check server connections
docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW SERVERS;"

# Check client connections
docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW CLIENTS;"
```

### PgBouncer Stats Explained

```bash
# SHOW STATS output columns:
# - total_requests: Total SQL requests pooled
# - total_received: Total bytes received from clients
# - total_sent: Total bytes sent to clients
# - total_query_time: Total time spent in queries (microseconds)
# - avg_query_time: Average query time (microseconds)
# - avg_wait_time: Average time waiting for connection (microseconds)
```

### Troubleshooting PgBouncer

**Connection refused:**

```bash
# Check if PgBouncer is running
docker ps | grep pgbouncer

# Check PgBouncer logs
docker logs scrumooth-pgbouncer
```

**Pool exhaustion:**

```bash
# Check pool usage
docker exec scrumooth-pgbouncer psql -p 6432 pgbouncer -c "SHOW POOLS;"

# Look for high cl_active or sv_active values
# If maxed out, consider increasing DEFAULT_POOL_SIZE
```

---

## Troubleshooting

### Common Issues

#### 1. Container Not Running

```bash
# Check container status
docker ps -a | grep scrumooth-postgres

# Start containers
docker compose up -d postgres
```

#### 2. Permission Denied

```bash
# Fix script permissions
chmod +x ./scripts/*.sh

# Fix backup directory permissions
mkdir -p ./backups
chmod 755 ./backups
```

#### 3. Database Connection Failed

```bash
# Check PostgreSQL logs
docker logs scrumooth-postgres

# Verify environment variables
docker exec scrumooth-postgres env | grep POSTGRES
```

#### 4. Backup File Corrupted

```bash
# Test gzip integrity
gunzip -t backup.sql.gz

# If corrupted, check disk space
df -h
```

### Recovery Procedures

#### Complete Data Loss Recovery

1. **Stop all containers**:

   ```bash
   docker compose down
   ```

2. **Remove old volume** (⚠️ Destructive):

   ```bash
   docker volume rm scrumooth_scrumooth_postgres_data
   ```

3. **Start fresh**:

   ```bash
   docker compose up -d postgres
   ```

4. **Restore from backup**:
   ```bash
   ./scripts/maintenance/database/db-restore.sh ./backups/latest_backup.sql.gz
   ```

#### Point-in-Time Recovery

If you need to recover to a specific point in time:

1. Identify the backup closest to your target time
2. Restore that backup
3. Apply any additional migrations if needed

---

## Best Practices

### Backup Strategy (3-2-1 Rule)

- **3** copies of your data
- **2** different media types
- **1** offsite copy

### Recommended Backup Schedule

| Backup Type   | Frequency            | Retention | Method                                             |
| ------------- | -------------------- | --------- | -------------------------------------------------- |
| SQL Daily     | Every day at 2 AM    | 7 days    | `scripts/maintenance/database/db-backup.sh`        |
| SQL Weekly    | Every Sunday         | 4 weeks   | `scripts/maintenance/database/db-backup.sh`        |
| SQL Monthly   | 1st of month         | 12 months | `scripts/maintenance/database/db-backup.sh`        |
| Volume Weekly | Every Sunday at 3 AM | 2 weeks   | `scripts/maintenance/database/db-volume-backup.sh` |

### Validation Schedule

- **Daily**: Automated backup verification
- **Weekly**: Full database validation (`scripts/maintenance/database/db-validate.sh`)
- **Monthly**: Test restore procedure on staging environment

### Monitoring Schedule

- **Daily**: Check PostgreSQL logs for errors
- **Weekly**: Review PgBouncer stats for connection pool health
- **Monthly**: Analyze slow query logs for optimization opportunities

---

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Volume Backup](https://docs.docker.com/storage/volumes/#backup-restore-or-migrate-data-volumes)
- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
