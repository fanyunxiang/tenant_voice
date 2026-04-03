export type NotificationCategory = 'system' | 'bid' | 'social' | 'project';

export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationFilter {
  userId: string;
  unreadOnly?: boolean;
  category?: NotificationCategory;
}
