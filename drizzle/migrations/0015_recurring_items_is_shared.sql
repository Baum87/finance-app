-- Markering "gezamenlijk betaald" voor vaste lasten/inkomsten die vanaf een
-- gedeelde rekening lopen (bijv. met een partner). Puur zichtbaarheid, geen
-- splitsing/percentage — het bedrag dat je invoert is en blijft jouw aandeel.

ALTER TABLE "recurring_items" ADD COLUMN "is_shared" boolean NOT NULL DEFAULT false;
