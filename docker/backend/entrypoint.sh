#!/bin/bash

# This script runs as root initially to fix permissions, then switches to appuser
cd /backend

# Fix permissions and ownership for the public/uploads/pdf folder after volume mount
if [ -d "public/uploads/pdf" ]; then
    echo "Setting up permissions for public/uploads/pdf folder..."
    
    # Set directory permissions to 755 (readable/executable by all, writable by owner)
    find public/uploads/pdf -type d -exec chmod 755 {} \;

    # Set file permissions to 644 (readable by all, writable by owner)  
    find public/uploads/pdf -type f -exec chmod 644 {} \;

    # Change ownership to appuser (requires root)
    chown -R appuser:appuser /public/uploads/pdf
    
    echo "Fixed permissions and ownership for public/uploads/pdf folder"
    ls -la public/uploads/pdf
else
    echo "public/uploads/pdf folder not found"
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
