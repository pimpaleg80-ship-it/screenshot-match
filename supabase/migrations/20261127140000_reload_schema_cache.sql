-- Reload PostgREST schema cache to fix "Database error querying schema" on sign-in.
-- Required after the previous migration added the work_location_stats view and
-- altered the people view security settings without issuing a schema reload.

-- Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

-- Also ensure the people view security_invoker is properly set and refreshed
-- (belt-and-suspenders: re-apply the same change so PostgREST picks it up)
ALTER VIEW public.people SET (security_invoker = true);
ALTER VIEW public.work_location_stats SET (security_invoker = true);

-- Re-notify after the view alterations to guarantee schema is refreshed
NOTIFY pgrst, 'reload schema';
