-- Eenvoudige invoerlijsten voor crypto/pensioen/spaarrekening/vastgoed:
-- geen "asset"-entiteit, gewoon een append-only logboek per categorie.
-- De meest recente rij (op entry_date) is de huidige waarde van die categorie.

CREATE TABLE "crypto_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker" text NOT NULL,
  "invested" numeric(15,2) NOT NULL,
  "current_value" numeric(15,2) NOT NULL,
  "entry_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "crypto_entries_tenant_id_idx" ON "crypto_entries" ("tenant_id");

CREATE TABLE "pension_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker" text NOT NULL,
  "invested" numeric(15,2) NOT NULL,
  "current_value" numeric(15,2) NOT NULL,
  "entry_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "pension_entries_tenant_id_idx" ON "pension_entries" ("tenant_id");

CREATE TABLE "savings_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "bank" text NOT NULL,
  "balance" numeric(15,2) NOT NULL,
  "entry_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "savings_entries_tenant_id_idx" ON "savings_entries" ("tenant_id");

CREATE TABLE "real_estate_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "street" text NOT NULL,
  "postal_code" text NOT NULL,
  "city" text NOT NULL,
  "woz_value" numeric(15,2) NOT NULL,
  "entry_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "real_estate_entries_tenant_id_idx" ON "real_estate_entries" ("tenant_id");

-- RLS
ALTER TABLE "crypto_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pension_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "savings_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "real_estate_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crypto_entries_select" ON "crypto_entries"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "crypto_entries_insert" ON "crypto_entries"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "crypto_entries_delete" ON "crypto_entries"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "pension_entries_select" ON "pension_entries"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "pension_entries_insert" ON "pension_entries"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "pension_entries_delete" ON "pension_entries"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "savings_entries_select" ON "savings_entries"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "savings_entries_insert" ON "savings_entries"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "savings_entries_delete" ON "savings_entries"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "real_estate_entries_select" ON "real_estate_entries"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "real_estate_entries_insert" ON "real_estate_entries"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "real_estate_entries_delete" ON "real_estate_entries"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
