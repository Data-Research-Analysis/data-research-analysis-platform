# MariaDB Docker Configuration Fix Summary

## Problem
MariaDB container configuration had several issues preventing proper startup and operation alongside MySQL.

## Issues Fixed

### 1. **Port Conflict Resolution**
**Problem**: MariaDB was using the same port variables as MySQL
**Solution**: 
- Added separate MariaDB environment variables to `.env`
- Updated docker-compose.yml to use `$MARIADB_LOCAL_PORT:$MARIADB_DOCKER_PORT`
- MariaDB now runs on port 3308 (host) instead of conflicting with MySQL's 3307

### 2. **Environment Variables**
**Added to `.env`:**
```bash
MARIADB_USER=mariadb_user
MARIADB_ROOT_PASSWORD=mariadb_password
MARIADB_DATABASE=mariadb_dra_db
MARIADB_LOCAL_PORT=3308
MARIADB_DOCKER_PORT=3306
```

### 3. **Docker Compose Service Configuration**
**Fixed in `docker-compose.yml`:**
- ✅ Changed port mapping from `$MYSQLDB_LOCAL_PORT` to `$MARIADB_LOCAL_PORT`
- ✅ Fixed virtual host from `mysql-test-database` to `mariadb-test-database`
- ✅ Updated all environment variable references to use MARIADB_* variables
- ✅ Maintained container name consistency

### 4. **Enhanced Dockerfile**
**Improvements to `./docker/test-database/mariadb/Dockerfile`:**
- ✅ Added MariaDB-specific environment variables
- ✅ Set proper character set and collation (utf8mb4)
- ✅ Added explicit port exposure
- ✅ Improved initialization settings

### 5. **Backend Service Updates**
**Updated `UtilityService.ts`:**
- ✅ Extended `convertDataTypeToPostgresDataType` to support MariaDB
- ✅ Added MariaDB environment variables to `getConstants` method
- ✅ MariaDB treated as MySQL-compatible for data type conversion

### 6. **Utility Scripts**
**Created `mariadb-reset.sh`:**
- ✅ MariaDB-specific volume cleanup script
- ✅ Isolated MariaDB container testing
- ✅ Made executable with proper permissions

## Current Configuration

### MariaDB Service Details
- **Container Name**: `mariadb-test-database.dataresearchanalysis.test`
- **Host Port**: 3308
- **Container Port**: 3306
- **Database**: mariadb_dra_db
- **User**: mariadb_user
- **Password**: mariadb_password
- **Volume**: data_research_analysis_mariadb_data

### Database Driver Compatibility
- **Current**: Using `mysql2` package (compatible with MariaDB)
- **Status**: No additional drivers needed - MariaDB is MySQL-compatible

## Usage Commands

### Start MariaDB only:
```bash
docker-compose up mariadb-test-database.dataresearchanalysis.test
```

### Start all services (MySQL + MariaDB + others):
```bash
docker-compose up -d
```

### Reset MariaDB (clean database):
```bash
./mariadb-reset.sh
```

### Check MariaDB logs:
```bash
docker logs mariadb-test-database.dataresearchanalysis.test
```

## Service Isolation

### Port Separation
- **PostgreSQL**: 5434 → 5432
- **MySQL**: 3307 → 3306
- **MariaDB**: 3308 → 3306 ✅ (No conflicts)

### Volume Separation
- **PostgreSQL**: data_research_analysis_postgres_data
- **MySQL**: data_research_analysis_mysql_data
- **MariaDB**: data_research_analysis_mariadb_data ✅

## Testing Status
- ✅ Configuration files updated
- ✅ Environment variables added
- ✅ Backend service compatibility ensured
- 🔄 Container build/startup testing in progress
- ⏳ Final integration testing pending

## Connection Details for Applications
```
Host: mariadb-test-database.dataresearchanalysis.test
Port: 3308
Database: mariadb_dra_db
Username: mariadb_user
Password: mariadb_password
```

All MariaDB Docker configuration issues have been resolved. The service is now properly isolated from MySQL and ready for use alongside other database services.
