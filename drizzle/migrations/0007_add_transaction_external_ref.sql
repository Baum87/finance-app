-- external_ref: broker-specifieke unieke referentie (bv. Degiro "Order ID"),
-- gezet bij xlsx-import. Voorkomt dubbele import van dezelfde transactie bij
-- een herupload. NULL bij handmatig ingevoerde transacties.
ALTER TABLE "transactions" ADD COLUMN "external_ref" text;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_asset_external_ref_unique" UNIQUE ("asset_id", "external_ref");
