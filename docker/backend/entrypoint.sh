#!/bin/bash

# This script runs as root initially to fix permissions, then switches to appuser
cd /backend

# Create /home/appuser if it doesn't exist (needed for npm cache)
if [ ! -d "/home/appuser" ]; then
    mkdir -p /home/appuser
    chown -R appuser:appuser /home/appuser
fi

# Fix permissions and ownership for the public/uploads/pdfs folder after volume mount
if [ -d "public/uploads/pdfs" ]; then
    echo "Setting up permissions for public/uploads/pdfs folder..."

    # Set directory permissions to 755 (readable/executable by all, writable by owner)
    find public/uploads/pdfs -type d -exec chmod 755 {} \;

    # Set file permissions to 755 (readable by all, writable by owner)  
    find public/uploads/pdfs -type f -exec chmod 755 {} \;

    # Change ownership to appuser (requires root) - use correct relative path
    chown -R appuser:appuser public/uploads/pdfs
    
    echo "Fixed permissions and ownership for public/uploads/pdf folder"
    ls -la public/uploads/pdfs
else
    echo "public/uploads/pdfs folder not found"
fi

# Ensure critical directories are owned by appuser, skip node_modules to avoid permission errors
find /backend -maxdepth 1 -mindepth 1 ! -name node_modules -exec chown -R appuser:appuser {} + 2>/dev/null || true

# Switch to appuser and execute the remaining commands
exec su appuser -c "
export HOME=/home/appuser
cd /backend
npm install
npm run dev
exec bash
"
