-- Required by attendance upserts. Run against a backed-up database before deployment.
-- If duplicate register entries exist, this fails without deleting any records;
-- reconcile those entries before retrying the migration.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_class_date_period_key
  ON public.attendance (student_id, class_id, date, period);
