-- Vaste lasten & inkomsten: eenvoudige registratie van terugkerende posten
-- (salaris, verzekering, abonnement, hypotheek, gemeentelijke belasting,
-- boodschappen). Geen historie/versiebeheer — een bedrag wijzigen is een
-- update, stoppen is is_active = false. Voedt de FIRE-berekening.

CREATE TABLE "recurring_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "item_type" text NOT NULL,
  "category" text NOT NULL,
  "amount" numeric(15,2) NOT NULL,
  "frequency" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "recurring_items_item_type_check" CHECK ("recurring_items"."item_type" IN ('income', 'expense')),
  CONSTRAINT "recurring_items_category_check" CHECK ("recurring_items"."category" IN ('salary', 'insurance', 'subscription', 'mortgage', 'municipal_tax', 'groceries', 'other')),
  CONSTRAINT "recurring_items_frequency_check" CHECK ("recurring_items"."frequency" IN ('monthly', 'quarterly', 'yearly'))
);
CREATE INDEX "recurring_items_tenant_id_idx" ON "recurring_items" ("tenant_id");

ALTER TABLE "recurring_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_items_select" ON "recurring_items"
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "recurring_items_insert" ON "recurring_items"
  FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "recurring_items_update" ON "recurring_items"
  FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
CREATE POLICY "recurring_items_delete" ON "recurring_items"
  FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));
