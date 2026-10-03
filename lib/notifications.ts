import { supabase } from './supabase'

export type NotifType = 'batting' | 'demerit' | 'merit' | 'leave' | 'announcement'

/**
 * Filter a list of recipient user IDs down to those who have NOT opted out
 * of the given notification type. Users with no preference row are included
 * by default (all notifications on).
 */
export async function filterRecipients(userIds: string[], type: NotifType): Promise<string[]> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data } = await supabase
    .from('notification_preferences')
    .select('user_id')
    .in('user_id', ids)
    .eq(type, false)
  const optedOut = new Set((data || []).map((r: { user_id: string }) => r.user_id))
  return ids.filter(id => !optedOut.has(id))
}

