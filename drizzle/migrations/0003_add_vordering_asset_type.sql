CREATE TABLE "vordering_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"counterparty" text NOT NULL,
	"principal_amount" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(8, 4),
	"start_date" date,
	"end_date" date,
	"loan_type" text DEFAULT 'family' NOT NULL,
	CONSTRAINT "vordering_details_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "vordering_loan_type_check" CHECK ("vordering_details"."loan_type" IN ('family', 'business', 'other'))
);
--> statement-breakpoint
ALTER TABLE "assets" DROP CONSTRAINT "assets_asset_type_check";--> statement-breakpoint
ALTER TABLE "vordering_details" ADD CONSTRAINT "vordering_details_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_check" CHECK ("assets"."asset_type" IN ('stock_etf', 'crypto', 'savings', 'real_estate', 'pension', 'vordering'));