// Only these REST resources are reachable through the authenticated gateway.
export const DATA_TABLES = new Set([
  'schools', 'users', 'students', 'classes', 'subjects', 'allocations', 'class_students',
  'attendance', 'demerit_types', 'demerits', 'merit_types', 'merits', 'notifications',
  'notification_preferences', 'timetable_entries', 'period_config', 'batting', 'messages',
  'leave_register', 'community_service', 'community_service_settings', 'community_service_types',
  'monitors', 'hand_in_log', 'on_duty_register', 'monitor_demerits', 'monitor_demerit_types',
])
