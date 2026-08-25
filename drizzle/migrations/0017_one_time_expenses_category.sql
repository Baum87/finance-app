-- Categorie voor eenmalige uitgaven (vakantie, woning, witgoed, etc.) — zelfde
-- patroon als recurring_items.category: vaste waardenlijst via CHECK-constraint.
-- Bestaande rijen krijgen 'other' als default, zodat de NOT NULL-constraint
-- niet faalt op reeds ingevoerde uitgaven.

ALTER TABLE "one_time_expenses" ADD COLUMN "category" text NOT NULL DEFAULT 'other';
ALTER TABLE "one_time_expenses" ADD CONSTRAINT "one_time_expenses_category_check" CHECK ("category" IN ('vacation', 'housing', 'appliances_electronics', 'furniture', 'car_transport', 'gifts_events', 'other'));
