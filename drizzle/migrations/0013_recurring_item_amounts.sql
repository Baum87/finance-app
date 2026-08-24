-- Bedraghistorie voor vaste lasten & inkomsten: het bedrag wordt niet langer
-- overschreven bij een wijziging, maar krijgt een nieuwe rij met een
-- ingangsdatum (zelfde patroon als asset_valuations). Zo blijft een oudere
-- periode (bijv. zorgverzekering €100 t/m maart) zichtbaar nadat het bedrag
-- is aangepast naar €120.

BEGIN;

CREATE TABLE "recurring_item_amounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recurring_item_id" uuid NOT NULL REFERENCES "recurring_items"("id") ON DELETE CASCADE,
  "amount" numeric(15,2) NOT NULL,
  "effective_date" date NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "recurring_item_amounts_item_id_idx" ON "recurring_item_amounts" ("recurring_item_id");
CREATE INDEX "recurring_item_amounts_effective_date_idx" ON "recurring_item_amounts" ("effective_date");

-- Backfill: bestaand bedrag wordt de eerste (huidige) periode, ingangsdatum
-- = de dag dat de post oorspronkelijk is aangemaakt.
INSERT INTO "recurring_item_amounts" ("recurring_item_id", "amount", "effective_date")
SELECT "id", "amount", "created_at"::date FROM "recurring_items";

ALTER TABLE "recurring_items" DROP COLUMN "amount";

ALTER TABLE "recurring_item_amounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_item_amounts_select" ON "recurring_item_amounts"
  FOR SELECT USING (
    recurring_item_id IN (
      SELECT ri.id FROM "recurring_items" ri
      JOIN "tenant_users" tu ON tu.tenant_id = ri.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "recurring_item_amounts_insert" ON "recurring_item_amounts"
  FOR INSERT WITH CHECK (
    recurring_item_id IN (
      SELECT ri.id FROM "recurring_items" ri
      JOIN "tenant_users" tu ON tu.tenant_id = ri.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "recurring_item_amounts_update" ON "recurring_item_amounts"
  FOR UPDATE USING (
    recurring_item_id IN (
      SELECT ri.id FROM "recurring_items" ri
      JOIN "tenant_users" tu ON tu.tenant_id = ri.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "recurring_item_amounts_delete" ON "recurring_item_amounts"
  FOR DELETE USING (
    recurring_item_id IN (
      SELECT ri.id FROM "recurring_items" ri
      JOIN "tenant_users" tu ON tu.tenant_id = ri.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

COMMIT;
