-- Simpele invoer voor crypto/spaarrekening/vastgoed/pensioen: bestaande zware
-- verplichte velden worden optioneel, vastgoed-adres wordt gesplitst.

-- crypto_details.ticker: simpele crypto-posities hebben geen ticker (geen
-- live koers) — currentValue komt dan uit asset_valuations.
ALTER TABLE "crypto_details" ALTER COLUMN "ticker" DROP NOT NULL;

-- real_estate_details: straat/postcode/plaats i.p.v. één vrij adresveld.
ALTER TABLE "real_estate_details" ADD COLUMN "street" text;
ALTER TABLE "real_estate_details" ADD COLUMN "postal_code" text;
ALTER TABLE "real_estate_details" ADD COLUMN "city" text;

-- Best-effort migratie van bestaande data: het oude vrije adresveld kan niet
-- betrouwbaar in straat/postcode/plaats gesplitst worden, dus zetten we het
-- volledig over naar "city" zodat er niets stilzwijgend verdwijnt.
UPDATE "real_estate_details" SET "city" = "address" WHERE "address" IS NOT NULL;

ALTER TABLE "real_estate_details" DROP COLUMN "address";

-- purchase_price/purchase_date: simpele invoer vraagt geen aankoopprijs/-datum.
ALTER TABLE "real_estate_details" ALTER COLUMN "purchase_price" DROP NOT NULL;
ALTER TABLE "real_estate_details" ALTER COLUMN "purchase_date" DROP NOT NULL;
