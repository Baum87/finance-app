ALTER TABLE "assets" ADD COLUMN "is_liquid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mortgages" ADD COLUMN "interest_rate_fixed_until" date;--> statement-breakpoint
ALTER TABLE "mortgages" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "mortgages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fees" numeric(15, 2) DEFAULT '0' NOT NULL;