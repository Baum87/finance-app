-- Geen enkele geldkolom had een DB-niveau CHECK tegen negatieve waarden — alleen
-- Zod aan de rand. Live data is gecontroleerd (geen negatieve waarden aanwezig)
-- vóór deze migratie is geschreven. Zie docs/review/audit-codebase-volledig.md M-2.

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fees_check" CHECK ("fees" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_quantity_check" CHECK ("quantity" >= 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_price_per_unit_check" CHECK ("price_per_unit" >= 0);

ALTER TABLE "asset_valuations" ADD CONSTRAINT "asset_valuations_value_check" CHECK ("value" >= 0);

ALTER TABLE "stock_etf_entries" ADD CONSTRAINT "stock_etf_entries_invested_check" CHECK ("invested" >= 0);
ALTER TABLE "stock_etf_entries" ADD CONSTRAINT "stock_etf_entries_current_value_check" CHECK ("current_value" >= 0);

ALTER TABLE "crypto_entries" ADD CONSTRAINT "crypto_entries_invested_check" CHECK ("invested" >= 0);
ALTER TABLE "crypto_entries" ADD CONSTRAINT "crypto_entries_current_value_check" CHECK ("current_value" >= 0);

ALTER TABLE "pension_entries" ADD CONSTRAINT "pension_entries_invested_check" CHECK ("invested" >= 0);
ALTER TABLE "pension_entries" ADD CONSTRAINT "pension_entries_current_value_check" CHECK ("current_value" >= 0);

ALTER TABLE "savings_entries" ADD CONSTRAINT "savings_entries_balance_check" CHECK ("balance" >= 0);

ALTER TABLE "real_estate_entries" ADD CONSTRAINT "real_estate_entries_woz_value_check" CHECK ("woz_value" >= 0);

ALTER TABLE "savings_details" ADD CONSTRAINT "savings_details_interest_rate_check" CHECK ("interest_rate" >= 0);
ALTER TABLE "savings_details" ADD CONSTRAINT "savings_details_monthly_deposit_amount_check" CHECK ("monthly_deposit_amount" >= 0);

ALTER TABLE "pension_details" ADD CONSTRAINT "pension_details_projected_annual_benefit_check" CHECK ("projected_annual_benefit" >= 0);

ALTER TABLE "vordering_details" ADD CONSTRAINT "vordering_principal_amount_check" CHECK ("principal_amount" >= 0);
ALTER TABLE "vordering_details" ADD CONSTRAINT "vordering_interest_rate_check" CHECK ("interest_rate" >= 0);

ALTER TABLE "real_estate_details" ADD CONSTRAINT "real_estate_purchase_price_check" CHECK ("purchase_price" >= 0);
ALTER TABLE "real_estate_details" ADD CONSTRAINT "real_estate_purchase_costs_check" CHECK ("purchase_costs" >= 0);
ALTER TABLE "real_estate_details" ADD CONSTRAINT "real_estate_woz_value_check" CHECK ("woz_value" >= 0);

ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_original_amount_check" CHECK ("original_amount" >= 0);
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_interest_rate_check" CHECK ("interest_rate" >= 0);

ALTER TABLE "mortgage_balances" ADD CONSTRAINT "mortgage_balances_outstanding_balance_check" CHECK ("outstanding_balance" >= 0);

ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_interest_rate_check" CHECK ("interest_rate" >= 0);

ALTER TABLE "recurring_item_amounts" ADD CONSTRAINT "recurring_item_amounts_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "one_time_expenses" ADD CONSTRAINT "one_time_expenses_amount_check" CHECK ("amount" >= 0);
