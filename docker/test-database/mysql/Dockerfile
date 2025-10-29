FROM mysql:oraclelinux9

# Set proper permissions and configuration
RUN mkdir -p /var/lib/mysql && chown -R mysql:mysql /var/lib/mysql

# Add custom MySQL configuration if needed
# COPY my.cnf /etc/mysql/conf.d/

# Ensure proper initialization
ENV MYSQL_ALLOW_EMPTY_PASSWORD=false