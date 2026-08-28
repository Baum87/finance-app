ALTER TABLE "investment_assumptions" DROP CONSTRAINT "investment_assumptions_tenant_id_unique";--> statement-breakpoint
ALTER TABLE "investment_assumptions" ADD COLUMN "category" text DEFAULT 'stock_etf' NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_assumptions" ADD CONSTRAINT "investment_assumptions_tenant_category_unique" UNIQUE("tenant_id","category");--> statement-breakpoint
ALTER TABLE "investment_assumptions" ADD CONSTRAINT "investment_assumptions_category_check" CHECK ("investment_assumptions"."category" IN ('stock_etf', 'real_estate'));