# DB Lab (Docker)

Avvio:
docker run -d --name rebis-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=rebis_secure \
  -p 5432:5432 \
  -v rebis_pgdata:/var/lib/postgresql/data \
  postgres:16

Connessione:
psql "postgresql://postgres:postgres@localhost:5432/rebis_secure"

Apply migration:
psql "postgresql://postgres:postgres@localhost:5432/rebis_secure" -f infra/scripts/001_init.sql

Stop/Start:
docker stop rebis-pg
docker start rebis-pg

Cleanup:
docker rm -f rebis-pg
docker volume rm rebis_pgdata
