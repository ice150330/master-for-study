import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  ClipboardCheck,
  Library,
  MessageCircle,
  Network,
  NotebookText,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconKey } from '@/lib/nav';

/** 导航图标映射：侧栏、索引标签页头共用。 */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  today: CalendarDays,
  chat: MessageCircle,
  notes: NotebookText,
  resources: Library,
  interview: ClipboardCheck,
  review: BookOpenText,
  analytics: BarChart3,
  whiteboard: Network,
};
