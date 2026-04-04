import { z } from 'zod';
import { supabase } from '../db/supabaseClient.js';
import {
  NotificationFilter,
  NotificationRecord,
  NotificationCategory,
} from '../types/notifications.js';

const notificationTable = 'notifications';
const notificationCategorySchema = z.enum(['system', 'bid', 'social', 'project']);

const notificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  body: z.string(),
  category: notificationCategorySchema,
  link: z.string().optional(),
  is_read: z.boolean(),
  created_at: z.string(),
});

const assertCategory = (category?: string): NotificationCategory | undefined => {
  if (!category) return undefined;

  const parsedCategory = notificationCategorySchema.safeParse(category);
  if (parsedCategory.success) {
    return parsedCategory.data;
  }

  throw new Error(`Unsupported notification category: ${category}`);
};

export async function listNotifications(filter: NotificationFilter) {
  const { userId, unreadOnly, category } = filter;
  let query = supabase.from(notificationTable).select('*').eq('user_id', userId).order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const normalizedCategory = assertCategory(category as NotificationCategory | undefined);
  if (normalizedCategory) {
    query = query.eq('category', normalizedCategory);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return z.array(notificationSchema).parse(data ?? []) as NotificationRecord[];
}

export async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from(notificationTable)
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createNotification(payload: Omit<NotificationRecord, 'id' | 'created_at' | 'is_read'>) {
  const record = {
    ...payload,
    is_read: false,
  };

  const { error } = await supabase.from(notificationTable).insert(record);
  if (error) {
    throw new Error(error.message);
  }
}
