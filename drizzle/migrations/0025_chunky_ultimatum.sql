CREATE TABLE "investment_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"expected_annual_return" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "investment_assumptions_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "investment_assumptions_return_check" CHECK ("investment_assumptions"."expected_annual_return" >= -100)
);
--> statement-breakpoint
CREATE TABLE "stock_annual_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"return_pct" numeric(8, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_annual_returns_tenant_year_unique" UNIQUE("tenant_id","year"),
	CONSTRAINT "stock_annual_returns_return_check" CHECK ("stock_annual_returns"."return_pct" >= -100)
);
--> statement-breakpoint
ALTER TABLE "investment_assumptions" ADD CONSTRAINT "investment_assumptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_annual_returns" ADD CONSTRAINT "stock_annual_returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_annual_returns_tenant_id_idx" ON "stock_annual_returns" USING btree ("tenant_id");