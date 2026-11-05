ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'rejected';

CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','moderator'))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
CREATE POLICY "Staff update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_profile_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
    NEW.is_verified := OLD.is_verified;
    NEW.is_suspended := OLD.is_suspended;
    NEW.rating := OLD.rating;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard_flags BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_flags();

CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_suspended FROM public.profiles WHERE id = _user_id), false)
$$;

-- platform settings
CREATE TABLE public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  require_approval boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings readable" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.platform_settings (id, require_approval) VALUES (true, false) ON CONFLICT DO NOTHING;

-- listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS rejection_reason text;
DROP POLICY IF EXISTS "Sellers can insert own listings" ON public.listings;
CREATE POLICY "Sellers can insert own listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "Staff view all listings" ON public.listings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update listings" ON public.listings FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete listings" ON public.listings FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.listing_moderation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff boolean := auth.uid() IS NOT NULL AND public.is_staff(auth.uid());
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT staff THEN
      NEW.is_featured := false;
      NEW.rejection_reason := NULL;
      IF COALESCE((SELECT require_approval FROM public.platform_settings LIMIT 1), false) THEN
        NEW.status := 'pending';
      ELSIF NEW.status::text NOT IN ('active','draft') THEN
        NEW.status := 'active';
      END IF;
    END IF;
  ELSIF NOT staff THEN
    NEW.is_featured := OLD.is_featured;
    NEW.rejection_reason := OLD.rejection_reason;
    IF OLD.status::text IN ('pending','rejected','removed') THEN
      NEW.status := OLD.status;
    ELSIF NEW.status::text IN ('pending','rejected','removed') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listings_moderation_guard BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.listing_moderation_guard();

-- messages: suspended users can't send
DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND NOT public.is_suspended(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));

-- reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users file reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND status = 'open');
CREATE POLICY "Users view own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Staff view reports" ON public.reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff update reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete reports" ON public.reports FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX reports_status_idx ON public.reports(status, created_at DESC);

-- banners
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  link text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active banners public" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins read banners" ON public.banners FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins write banners" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
