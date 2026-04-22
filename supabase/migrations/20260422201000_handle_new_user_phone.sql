-- v2.1: extend new-user trigger to read phone from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    CASE
      WHEN NEW.email = ANY(ARRAY['chaudy@gmail.com', 'jordi.vanvelzen@gmail.com'])
      THEN 'admin'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$function$;
