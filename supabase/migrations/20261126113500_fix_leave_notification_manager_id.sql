-- Fix trg_fn_leave_notification() field mismatch (`reporting_manager_id` -> `manager_id`)
-- and cast `leave_status` enum to text before `INITCAP()` on status transitions.

CREATE OR REPLACE FUNCTION public.trg_fn_leave_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_mgr public.employees%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_emp
    FROM public.employees
    WHERE id = NEW.employee_id;

    IF v_emp.manager_id IS NOT NULL THEN
      SELECT * INTO v_mgr
      FROM public.employees
      WHERE id = v_emp.manager_id;

      IF v_mgr.user_id IS NOT NULL AND v_mgr.id IS DISTINCT FROM v_emp.id THEN
        INSERT INTO public.notifications (
          user_id,
          organization_id,
          employee_id,
          title,
          message,
          link,
          type,
          priority
        ) VALUES (
          v_mgr.user_id,
          v_emp.organization_id,
          v_mgr.id,
          'New Leave Application',
          v_emp.full_name || ' applied for leave (' || NEW.from_date || ' to ' || NEW.to_date || ').',
          '/leaves',
          'leave',
          'normal'
        );
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT * INTO v_emp
    FROM public.employees
    WHERE id = NEW.employee_id;

    IF v_emp.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        organization_id,
        employee_id,
        title,
        message,
        link,
        type,
        priority
      ) VALUES (
        v_emp.user_id,
        v_emp.organization_id,
        v_emp.id,
        'Leave Request ' || INITCAP(NEW.status::text),
        'Your leave application for ' || NEW.from_date || ' has been ' || NEW.status::text || '.',
        '/leaves',
        'leave',
        CASE WHEN NEW.status = 'approved'::public.leave_status THEN 'normal' ELSE 'high' END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
