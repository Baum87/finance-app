-- Loon (en andere posten) kunnen 4-wekelijks uitbetaald worden i.p.v. maandelijks
-- (13 periodes per jaar i.p.v. 12). Vervangt de frequency-check op recurring_items.

ALTER TABLE "recurring_items" DROP CONSTRAINT "recurring_items_frequency_check";
ALTER TABLE "recurring_items" ADD CONSTRAINT "recurring_items_frequency_check"
  CHECK ("recurring_items"."frequency" IN ('monthly', 'four_weekly', 'quarterly', 'yearly'));
