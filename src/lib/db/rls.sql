-- RLS policies voor Finance App
-- Uitvoeren in Supabase SQL Editor na het uitrollen van het schema (npm run db:push)

-- ─── RLS inschakelen ────────────────────────────────────────────────────────

ALTER TABLE public.tenants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_valuations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_etf_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_details    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pension_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortgages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mortgage_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liabilities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_tax_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vordering_details  ENABLE ROW LEVEL SECURITY;
-- fx_rates: GEEN RLS — gedeelde tabel, niet user-gebonden

-- ─── users ──────────────────────────────────────────────────────────────────

CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (id = auth.uid());

-- ─── tenants ────────────────────────────────────────────────────────────────

CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE USING (
    id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ─── tenant_users ────────────────────────────────────────────────────────────

CREATE POLICY "tenant_users_select" ON public.tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- ─── assets (isolatie via tenant_users) ─────────────────────────────────────

CREATE POLICY "assets_select" ON public.assets
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_insert" ON public.assets
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_update" ON public.assets
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

CREATE POLICY "assets_delete" ON public.assets
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- ─── hulpfunctie: assets van de ingelogde user ──────────────────────────────
-- Inline subquery hergebruikt in alle detail-tabellen

-- ─── transactions ────────────────────────────────────────────────────────────

CREATE POLICY "transactions_select" ON public.transactions
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_insert" ON public.transactions
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_update" ON public.transactions
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_delete" ON public.transactions
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── asset_valuations ────────────────────────────────────────────────────────

CREATE POLICY "asset_valuations_select" ON public.asset_valuations
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "asset_valuations_insert" ON public.asset_valuations
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "asset_valuations_update" ON public.asset_valuations
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── asset_valuations DELETE ──────────────────────────────────────────────────

CREATE POLICY "asset_valuations_delete" ON public.asset_valuations
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── detail-tabellen (stock_etf, crypto, savings, pension, real_estate) ─────
-- Zelfde patroon: toegankelijk als het gekoppelde asset bij de tenant hoort

CREATE POLICY "stock_etf_details_select" ON public.stock_etf_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "stock_etf_details_insert" ON public.stock_etf_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "stock_etf_details_update" ON public.stock_etf_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "stock_etf_details_delete" ON public.stock_etf_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "crypto_details_select" ON public.crypto_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "crypto_details_insert" ON public.crypto_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "crypto_details_update" ON public.crypto_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "crypto_details_delete" ON public.crypto_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "savings_details_select" ON public.savings_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "savings_details_insert" ON public.savings_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "savings_details_update" ON public.savings_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "savings_details_delete" ON public.savings_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "pension_details_select" ON public.pension_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "pension_details_insert" ON public.pension_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "pension_details_update" ON public.pension_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "pension_details_delete" ON public.pension_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "real_estate_details_select" ON public.real_estate_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "real_estate_details_insert" ON public.real_estate_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "real_estate_details_update" ON public.real_estate_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "real_estate_details_delete" ON public.real_estate_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── vordering_details ───────────────────────────────────────────────────────

CREATE POLICY "vordering_details_select" ON public.vordering_details
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "vordering_details_insert" ON public.vordering_details
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "vordering_details_update" ON public.vordering_details
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "vordering_details_delete" ON public.vordering_details
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── mortgages ───────────────────────────────────────────────────────────────

CREATE POLICY "mortgages_select" ON public.mortgages
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgages_insert" ON public.mortgages
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgages_update" ON public.mortgages
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgages_delete" ON public.mortgages
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── mortgage_balances ───────────────────────────────────────────────────────

CREATE POLICY "mortgage_balances_select" ON public.mortgage_balances
  FOR SELECT USING (
    mortgage_id IN (
      SELECT m.id FROM public.mortgages m
      JOIN public.assets a ON a.id = m.asset_id
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgage_balances_insert" ON public.mortgage_balances
  FOR INSERT WITH CHECK (
    mortgage_id IN (
      SELECT m.id FROM public.mortgages m
      JOIN public.assets a ON a.id = m.asset_id
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgage_balances_update" ON public.mortgage_balances
  FOR UPDATE USING (
    mortgage_id IN (
      SELECT m.id FROM public.mortgages m
      JOIN public.assets a ON a.id = m.asset_id
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "mortgage_balances_delete" ON public.mortgage_balances
  FOR DELETE USING (
    mortgage_id IN (
      SELECT m.id FROM public.mortgages m
      JOIN public.assets a ON a.id = m.asset_id
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );

-- ─── liabilities ─────────────────────────────────────────────────────────────

CREATE POLICY "liabilities_select" ON public.liabilities
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );
CREATE POLICY "liabilities_insert" ON public.liabilities
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );
CREATE POLICY "liabilities_update" ON public.liabilities
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );
CREATE POLICY "liabilities_delete" ON public.liabilities
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

-- ─── asset_tax_metadata ──────────────────────────────────────────────────────

CREATE POLICY "asset_tax_metadata_select" ON public.asset_tax_metadata
  FOR SELECT USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "asset_tax_metadata_insert" ON public.asset_tax_metadata
  FOR INSERT WITH CHECK (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "asset_tax_metadata_update" ON public.asset_tax_metadata
  FOR UPDATE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
CREATE POLICY "asset_tax_metadata_delete" ON public.asset_tax_metadata
  FOR DELETE USING (
    asset_id IN (
      SELECT a.id FROM public.assets a
      JOIN public.tenant_users tu ON tu.tenant_id = a.tenant_id
      WHERE tu.user_id = auth.uid()
    )
  );
