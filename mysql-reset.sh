#!/bin/bash
# MySQL Volume Reset Script
# Use this script when MySQL initialization fails or you want to start with a clean database

echo "🛑 Stopping all containers..."
docker-compose down

echo "🗑️  Removing MySQL volume (this will delete all MySQL data)..."
docker volume rm data_research_analysis_mysql_data 2>/dev/null || echo "Volume not found or already removed"

echo "🐬 Starting MySQL container..."
docker-compose up mysql-test-database.dataresearchanalysis.test

echo "✅ MySQL reset complete!"
echo ""
echo "If you want to start all services, run:"
echo "docker-compose up"
