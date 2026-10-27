CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_form" text NOT NULL,
	"address" text,
	"phone" text,
	"activities" text,
	"structure" text,
	"intrinsic_value" numeric(15, 2),
	"net_profit" numeric(15, 2),
	"estimated_sale_value" numeric(15, 2),
	"holding_liquidity" numeric(15, 2),
	"agreements" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_legal_form_check" CHECK ("businesses"."legal_form" IN ('sole_proprietorship', 'partnership', 'bv', 'holding_bv', 'other')),
	CONSTRAINT "businesses_estimated_sale_value_check" CHECK ("businesses"."estimated_sale_value" >= 0),
	CONSTRAINT "businesses_holding_liquidity_check" CHECK ("businesses"."holding_liquidity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dossier_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" text NOT NULL,
	"company" text,
	"name" text,
	"address" text,
	"phone" text,
	"email" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_contacts_role_check" CHECK ("dossier_contacts"."role" IN ('notary', 'tax_advisor', 'accountant', 'private_banker', 'business_banker', 'insurance_advisor', 'wealth_planner', 'other'))
);
--> statement-breakpoint
CREATE TABLE "dossier_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_date" date,
	"notary" text,
	"location" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_documents_type_check" CHECK ("dossier_documents"."document_type" IN ('marital_agreement', 'cohabitation_agreement', 'will', 'codicil', 'living_will', 'other'))
);
--> statement-breakpoint
CREATE TABLE "dossier_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_notes_tenant_topic_unique" UNIQUE("tenant_id","topic"),
	CONSTRAINT "dossier_notes_topic_check" CHECK ("dossier_notes"."topic" IN ('family_situation', 'work_situation', 'expected_changes', 'wishes', 'open_items', 'digital_legacy', 'other_matters'))
);
--> statement-breakpoint
CREATE TABLE "dossier_persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relation" text NOT NULL,
	"birth_date" date,
	"nationality" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_persons_relation_check" CHECK ("dossier_persons"."relation" IN ('self', 'partner', 'child', 'grandchild', 'parent', 'other'))
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_type" text NOT NULL,
	"insurer" text NOT NULL,
	"policy_number" text,
	"phone" text,
	"contact_person" text,
	"policyholder" text,
	"insured" text,
	"beneficiary" text,
	"start_date" date,
	"end_date" date,
	"annual_premium" numeric(15, 2),
	"premium_end_date" date,
	"insured_amount" numeric(15, 2),
	"current_value" numeric(15, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insurance_policies_type_check" CHECK ("insurance_policies"."policy_type" IN ('capital', 'term_life', 'annuity', 'disability', 'funeral', 'other')),
	CONSTRAINT "insurance_policies_annual_premium_check" CHECK ("insurance_policies"."annual_premium" >= 0),
	CONSTRAINT "insurance_policies_insured_amount_check" CHECK ("insurance_policies"."insured_amount" >= 0),
	CONSTRAINT "insurance_policies_current_value_check" CHECK ("insurance_policies"."current_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_contacts" ADD CONSTRAINT "dossier_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_documents" ADD CONSTRAINT "dossier_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_notes" ADD CONSTRAINT "dossier_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_persons" ADD CONSTRAINT "dossier_persons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "businesses_tenant_id_idx" ON "businesses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dossier_contacts_tenant_id_idx" ON "dossier_contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dossier_documents_tenant_id_idx" ON "dossier_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "dossier_persons_tenant_id_idx" ON "dossier_persons" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "insurance_policies_tenant_id_idx" ON "insurance_policies" USING btree ("tenant_id");