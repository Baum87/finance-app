-- Stap 1: voeg broker_id FK kolom toe (nullable)
ALTER TABLE "stock_etf_details"
  ADD COLUMN "broker_id" uuid REFERENCES "brokers"("id") ON DELETE SET NULL;

-- Stap 2: migreer bestaande data — koppel broker-naam aan broker-ID via tenant
UPDATE "stock_etf_details" sed
SET broker_id = b.id
FROM "brokers" b
INNER JOIN "assets" a ON a.id = sed.asset_id
WHERE b.name = sed.broker
  AND b.tenant_id = a.tenant_id;

-- Stap 3: verwijder oude text-kolom
ALTER TABLE "stock_etf_details" DROP COLUMN "broker";
