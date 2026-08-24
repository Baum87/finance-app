-- Zelfde "gezamenlijk betaald"-markering als recurring_items, nu ook voor
-- eenmalige uitgaven.

ALTER TABLE "one_time_expenses" ADD COLUMN "is_shared" boolean NOT NULL DEFAULT false;
