CREATE TABLE "asset_tax_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"box" integer NOT NULL,
	"is_exempt" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_tax_metadata_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "asset_tax_metadata_box_check" CHECK ("asset_tax_metadata"."box" IN (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "asset_valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"valuation_date" date NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"asset_type" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_asset_type_check" CHECK ("assets"."asset_type" IN ('stock_etf', 'crypto', 'savings', 'real_estate', 'pension'))
);
--> statement-breakpoint
CREATE TABLE "crypto_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"wallet_or_exchange" text,
	CONSTRAINT "crypto_details_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" text NOT NULL,
	"to_currency" text NOT NULL,
	"rate" numeric(15, 6) NOT NULL,
	"rate_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_currency_date_unique" UNIQUE("from_currency","to_currency","rate_date")
);
--> statement-breakpoint
CREATE TABLE "liabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"liability_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(8, 4),
	"start_date" date,
	"end_date" date,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgage_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mortgage_id" uuid NOT NULL,
	"balance_date" date NOT NULL,
	"outstanding_balance" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mortgages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"lender" text NOT NULL,
	"original_amount" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(8, 4) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"mortgage_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mortgages_type_check" CHECK ("mortgages"."mortgage_type" IN ('annuity', 'linear', 'interest_only'))
);
--> statement-breakpoint
CREATE TABLE "pension_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"pension_type" text NOT NULL,
	"projected_annual_benefit" numeric(15, 2),
	CONSTRAINT "pension_details_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "real_estate_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"address" text,
	"property_type" text NOT NULL,
	"purchase_price" numeric(15, 2) NOT NULL,
	"purchase_costs" numeric(15, 2) DEFAULT '0' NOT NULL,
	"purchase_date" date NOT NULL,
	"woz_value" numeric(15, 2),
	"is_rental" boolean GENERATED ALWAYS AS (property_type = 'rental') STORED,
	CONSTRAINT "real_estate_details_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "real_estate_property_type_check" CHECK ("real_estate_details"."property_type" IN ('rental', 'primary_residence', 'vacation'))
);
--> statement-breakpoint
CREATE TABLE "savings_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_type" text DEFAULT 'savings',
	"interest_rate" numeric(8, 4),
	CONSTRAINT "savings_details_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "stock_etf_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"ticker" text NOT NULL,
	"isin" text,
	"broker" text,
	"account_type" text DEFAULT 'taxable',
	CONSTRAINT "stock_etf_details_asset_id_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_users_tenant_user_unique" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "tenant_users_role_check" CHECK ("tenant_users"."role" IN ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"quantity" numeric(15, 8),
	"price_per_unit" numeric(15, 4),
	"transaction_date" date NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"fx_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."transaction_type" IN ('buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'interest', 'rental_income', 'cost'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_tax_metadata" ADD CONSTRAINT "asset_tax_metadata_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_valuations" ADD CONSTRAINT "asset_valuations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crypto_details" ADD CONSTRAINT "crypto_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgage_balances" ADD CONSTRAINT "mortgage_balances_mortgage_id_mortgages_id_fk" FOREIGN KEY ("mortgage_id") REFERENCES "public"."mortgages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pension_details" ADD CONSTRAINT "pension_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "real_estate_details" ADD CONSTRAINT "real_estate_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_details" ADD CONSTRAINT "savings_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_etf_details" ADD CONSTRAINT "stock_etf_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_valuations_asset_id_idx" ON "asset_valuations" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "asset_valuations_date_idx" ON "asset_valuations" USING btree ("valuation_date");--> statement-breakpoint
CREATE INDEX "assets_tenant_id_idx" ON "assets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "assets_asset_type_idx" ON "assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "liabilities_tenant_id_idx" ON "liabilities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "mortgage_balances_mortgage_id_idx" ON "mortgage_balances" USING btree ("mortgage_id");--> statement-breakpoint
CREATE INDEX "mortgages_asset_id_idx" ON "mortgages" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_asset_id_idx" ON "transactions" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("transaction_date");