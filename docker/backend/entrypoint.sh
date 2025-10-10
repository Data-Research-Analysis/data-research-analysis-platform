#!/bin/bash

# This script runs as root initially to fix permissions, then switches to appuser
cd /backend

# Fix permissions and ownership for the public/uploads/pdfs folder after volume mount
if [ -d "public/uploads/pdfs" ]; then
    echo "Setting up permissions for public/uploads/pdfs folder..."

    # Set directory permissions to 755 (readable/executable by all, writable by owner)
    find public/uploads/pdfs -type d -exec chmod 755 {} \;

    # Set file permissions to 755 (readable by all, writable by owner)  
    find public/uploads/pdfs -type f -exec chmod 755 {} \;

    # Change ownership to appuser (requires root)
    chown -R appuser:appuser /public/uploads/pdfs
    
    echo "Fixed permissions and ownership for public/uploads/pdf folder"
    ls -la public/uploads/pdfs
else
    echo "public/uploads/pdfs folder not found"
fi

# Ensure /backend is owned by appuser
chown -R appuser:appuser /backend

# Switch to appuser and execute the remaining commands
exec su appuser -c "
cd /backend
npm install
npm run dev
exec bash
"
