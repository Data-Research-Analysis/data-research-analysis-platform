# Use Ubuntu 22.04 as the base image
FROM ubuntu:22.04

# Set environment variables to avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Runtime UID/GID for the app user. Default to the host user's UID/GID so the
# bind-mounted /backend tree stays owned by the host user across restarts.
# Override with --build-arg APP_UID=<uid> APP_GID=<gid> on other machines.
ARG APP_UID=1000
ARG APP_GID=1000

# Update package list and install essential packages
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    lsb-release \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24.x and npm using NodeSource repository
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    rm -f /etc/apt/sources.list.d/nodesource.list && \
    apt-get install -y nodejs

# Install PostgreSQL 18 client tools for database backup/restore
# Add PostgreSQL official repository for version 18
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y postgresql-client-18 && \
    rm -rf /var/lib/apt/lists/*

# Install Ghostscript, GraphicsMagick and the native libraries WeasyPrint
# needs to render markdown deliverables to PDF.
RUN apt-get update && apt-get install -y \
    ghostscript \
    graphicsmagick \
    python3 \
    python3-pip \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libfontconfig1 \
    libjpeg-turbo8 \
    libopenjp2-7 \
    libffi8 \
    shared-mime-info \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install python-pptx for the plan strategy-deck build script, and
# markdown + WeasyPrint for markdown -> PDF deliverable rendering.
# Use `python3 -m pip` so the packages land in the same interpreter that runs
# the render scripts, and verify the imports at build time so a broken image
# fails the build instead of failing at runtime.
RUN python3 -m pip install --no-cache-dir python-pptx markdown weasyprint && \
    python3 -c "import markdown, weasyprint; print('markdown', markdown.__version__, '| weasyprint', weasyprint.__version__)"

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

# Create a non-root user matching the host user's UID/GID so bind-mounted
# files (and files the container writes) map to the host user's ownership
# instead of an arbitrary system UID like 999.
RUN groupadd -g ${APP_GID} appuser && useradd -g appuser -u ${APP_UID} -m -d /home/appuser appuser

# Set HOME environment variable for npm
ENV HOME=/home/appuser

RUN chown -R appuser:appuser /backend /home/appuser

# Run everything (including the entrypoint) as the non-root appuser.
# The bind-mounted /backend tree is owned by the host user (same UID), so no
# root-level chown is needed at startup.
USER appuser

ENTRYPOINT [ "/entrypoint.sh" ]
CMD ["bash"]
