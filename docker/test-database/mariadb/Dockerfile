FROM mariadb:lts-ubi9

# Set proper permissions and configuration
RUN mkdir -p /var/lib/mysql && chown -R mysql:mysql /var/lib/mysql

# Add custom MariaDB configuration if needed
# COPY mariadb.cnf /etc/mysql/conf.d/mariadb.cnf

# Set MariaDB-specific environment variables
ENV MYSQL_ALLOW_EMPTY_PASSWORD=false
ENV MYSQL_RANDOM_ROOT_PASSWORD=false

# Expose MariaDB port
EXPOSE 3306

# Set proper character set and collation for MariaDB
ENV MYSQL_CHARSET=utf8mb4
ENV MYSQL_COLLATION=utf8mb4_unicode_ci