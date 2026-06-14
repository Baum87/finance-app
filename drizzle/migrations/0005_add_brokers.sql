CREATE TABLE "brokers" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"  uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name"       text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "brokers_tenant_id_idx" ON "brokers" ("tenant_id");

ALTER TABLE "brokers" ENABLE ROW LEVEL SECURITY;
