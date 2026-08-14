import { notFound } from 'next/navigation';
import { UIShowcase } from '@/components/ui/UIShowcase';

export default function UIShowcasePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <UIShowcase />;
}
