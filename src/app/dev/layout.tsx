import { notFound } from 'next/navigation';

/**
 * dev 演示页守卫：fixture 页仅开发环境可用，生产构建直接 404。
 * （08-14 计划阶段 1：「基础组件视觉测试页，仅在开发环境使用，不进入正式导航」）
 */
export default function DevLayout({ children }: LayoutProps<'/dev'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  return children;
}
