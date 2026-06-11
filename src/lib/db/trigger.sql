-- Trigger: automatisch tenant aanmaken bij nieuwe auth-gebruiker
-- Uitvoeren in Supabase SQL Editor na het uitrollen van het schema (npm run db:push)

-- ─── FK: public.users → auth.users ──────────────────────────────────────────
-- Drizzle beheert geen cross-schema FK's; hier handmatig toegevoegd.

ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── Trigger-functie ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- 1. Spiegel de user in public.users
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);

  -- 2. Maak een nieuwe tenant aan (naam = e-mailadres als placeholder)
  INSERT INTO public.tenants (name)
  VALUES (NEW.email)
  RETURNING id INTO new_tenant_id;

  -- 3. Koppel de user als owner aan de nieuwe tenant
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- ─── Trigger koppelen aan auth.users ─────────────────────────────────────────

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
