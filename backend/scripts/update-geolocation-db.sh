#!/bin/bash
# Updates MaxMind GeoLite2 database
# Run monthly via cron: 0 0 1 * * /path/to/update-geolocation-db.sh

MAXMIND_LICENSE_KEY="${MAXMIND_LICENSE_KEY}"
DB_DIR="$(dirname "$0")/../private/geolocation"
DB_FILE="$DB_DIR/GeoLite2-Country.mmdb"
TEMP_FILE="$DB_DIR/GeoLite2-Country.tar.gz"

mkdir -p "$DB_DIR"

if [ -z "$MAXMIND_LICENSE_KEY" ]; then
    echo "❌ MAXMIND_LICENSE_KEY environment variable not set"
    echo "To get a license key:"
    echo "1. Sign up at https://www.maxmind.com/en/geolite2/signup"
    echo "2. Generate a license key at https://www.maxmind.com/en/accounts/current/license-key"
    echo "3. Set MAXMIND_LICENSE_KEY environment variable"
    exit 1
fi

echo "📥 Downloading GeoLite2-Country database..."
curl -L "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-Country&license_key=$MAXMIND_LICENSE_KEY&suffix=tar.gz" \
    -o "$TEMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Download failed"
    exit 1
fi

echo "📦 Extracting database..."
tar -xzf "$TEMP_FILE" -C "$DB_DIR" --strip-components=1 --wildcards '*.mmdb'

if [ $? -eq 0 ]; then
    echo "✅ Database updated successfully"
    rm "$TEMP_FILE"
    ls -lh "$DB_FILE"
else
    echo "❌ Extraction failed"
    exit 1
fi
