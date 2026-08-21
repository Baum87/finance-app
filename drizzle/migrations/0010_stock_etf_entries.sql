-- Aandelen/ETF krijgt tijdelijk dezelfde eenvoudige invoerlijst als
-- crypto/pensioen/spaarrekening/vastgoed. De gedetailleerde transactieflow
-- (src/app/portfolio/_archief-aandelen-etf/) blijft in de codebase staan
-- als private Next.js-map (niet gerouteerd) om later weer op te pakken.

CREATE TABLE "stock_etf_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker" text NOT NULL,
  "invested" numeric(15,2) NOT NULL,
  "current_value" numeric(15,2) NOT NULL,
  "entry_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "stock_etf_entries_tenant_id_idx" ON "stock_etf_entries" ("tenant_id");

ALTER TABLE "stock_etf_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_etf_entries_select" ON "stock_etf_entries"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "stock_etf_entries_insert" ON "stock_etf_entries"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "stock_etf_entries_delete" ON "stock_etf_entries"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
