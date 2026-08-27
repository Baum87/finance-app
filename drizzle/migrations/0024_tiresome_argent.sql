CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal_type" text NOT NULL,
	"target_amount" numeric(15, 2),
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_tenant_id_unique" UNIQUE("tenant_id"),
	CONSTRAINT "goals_type_check" CHECK ("goals"."goal_type" IN ('savings', 'net_worth', 'passive_income_coverage')),
	CONSTRAINT "goals_target_amount_check" CHECK ("goals"."target_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;