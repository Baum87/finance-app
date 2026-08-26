CREATE TABLE "woz_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"woz_date" date NOT NULL,
	"value" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "woz_values_value_check" CHECK ("woz_values"."value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "woz_values" ADD CONSTRAINT "woz_values_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "woz_values_asset_id_idx" ON "woz_values" USING btree ("asset_id");