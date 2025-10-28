#!/bin/bash
# MariaDB Volume Reset Script
# Use this script when MariaDB initialization fails or you want to start with a clean database

echo "🛑 Stopping all containers..."
docker-compose down

echo "🗑️  Removing MariaDB volume (this will delete all MariaDB data)..."
docker volume rm data_research_analysis_mariadb_data 2>/dev/null || echo "Volume not found or already removed"

echo "🐬 Starting MariaDB container..."
docker-compose up mariadb-test-database.dataresearchanalysis.test

echo "✅ MariaDB reset complete!"
echo ""
echo "If you want to start all services, run:"
echo "docker-compose up"
