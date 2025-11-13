# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Update package list and install essential packages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    lsb-release \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 and npm using NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install PostgreSQL 17 client tools for database backup/restore
# Add PostgreSQL official repository for version 17
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y postgresql-client-17 && \
    rm -rf /var/lib/apt/lists/*

# Install Ghostscript and GraphicsMagick
RUN apt-get update && apt-get install -y \
    ghostscript \
    graphicsmagick \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && \
    npm --version && \
    pg_dump --version && \
    psql --version && \
    gs --version && \
    gm version

COPY [ "./docker/backend/entrypoint.sh", "/entrypoint.sh" ]
RUN chmod +x /entrypoint.sh

# Set the working directory
WORKDIR /backend
# Create a non-root user
# Create a non-root user

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /backend

# Don't switch to appuser yet - we need root for the entrypoint
ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["bash"]
