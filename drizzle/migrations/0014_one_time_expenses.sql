-- Eenmalige (grote) uitgaven, los van de doorlopende vaste lasten in
-- recurring_items. Geen frequentie/annualisatie — telt mee als "dit jaar
-- uitgegeven", niet in de maandelijkse cashflow-KPI's.

CREATE TABLE "one_time_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "amount" numeric(15,2) NOT NULL,
  "expense_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "one_time_expenses_tenant_id_idx" ON "one_time_expenses" ("tenant_id");

ALTER TABLE "one_time_expenses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "one_time_expenses_select" ON "one_time_expenses"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "one_time_expenses_insert" ON "one_time_expenses"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "one_time_expenses_update" ON "one_time_expenses"
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "one_time_expenses_delete" ON "one_time_expenses"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
