#!/bin/bash
cd /backend

# Ensure the uploads/pdf directory exists for the app
mkdir -p public/uploads/pdfs

export HOME=/home/appuser
npm install
npm run dev
exec bash
