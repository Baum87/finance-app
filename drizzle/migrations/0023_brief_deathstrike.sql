CREATE TABLE "recurring_cashflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"cashflow_type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recurring_cashflows_type_check" CHECK ("recurring_cashflows"."cashflow_type" IN ('rental_income', 'cost')),
	CONSTRAINT "recurring_cashflows_frequency_check" CHECK ("recurring_cashflows"."frequency" IN ('monthly', 'once')),
	CONSTRAINT "recurring_cashflows_amount_check" CHECK ("recurring_cashflows"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "recurring_cashflows" ADD CONSTRAINT "recurring_cashflows_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_cashflows_asset_id_idx" ON "recurring_cashflows" USING btree ("asset_id");