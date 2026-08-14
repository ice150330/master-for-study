'use client';

import {
  Archive,
  BookOpen,
  MoreHorizontal,
  Pin,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from './Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { Field, Input, Textarea } from './Field';
import { IconButton } from './IconButton';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { SegmentedControl } from './SegmentedControl';
import { Skeleton } from './Skeleton';
import { EmptyState, ErrorState } from './StatePanel';
import { useToast } from './Toast';

const modes = [
  { value: 'focus', label: '专注', icon: <BookOpen /> },
  { value: 'explore', label: '探索', icon: <Sparkles /> },
];

export function UIShowcase() {
  const [mode, setMode] = useState('focus');
  const toast = useToast();

  return (
    <PageShell
      title="交互基础件"
      description="学习工作台的语义令牌、控件状态与浮层基线"
      width="lg"
    >
      <div className="space-y-8 pb-12">
        <ShowcaseSection title="动作层级" description="主要动作保持克制，危险动作独立表达。">
          <div className="flex flex-wrap items-center gap-3">
            <Button>开始学习</Button>
            <Button variant="secondary">加入复习</Button>
            <Button variant="outline">查看来源</Button>
            <Button variant="ghost">稍后处理</Button>
            <Button variant="danger">删除记录</Button>
            <Button loading>正在保存</Button>
            <Button disabled>不可用</Button>
          </div>
        </ShowcaseSection>

        <ShowcaseSection title="工具与模式" description="图标按钮具备固定尺寸、可见焦点和文字提示。">
          <div className="flex flex-wrap items-center gap-3">
            <IconButton data-testid="focus-demo" label="搜索知识">
              <Search />
            </IconButton>
            <IconButton label="置顶会话">
              <Pin />
            </IconButton>
            <IconButton label="工作区设置">
              <Settings2 />
            </IconButton>
            <SegmentedControl
              ariaLabel="学习模式"
              value={mode}
              items={modes}
              onValueChange={setMode}
            />
          </div>
        </ShowcaseSection>

        <ShowcaseSection title="输入状态" description="标签、提示和错误与输入控件形成稳定关系。">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="学习目标" htmlFor="goal" hint="用于调整今日任务和题目难度。">
              <Input id="goal" placeholder="例如：掌握 SQL 聚合查询" />
            </Field>
            <Field label="资源地址" htmlFor="resource" error="请输入有效的 http 或 https 地址。">
              <Input id="resource" aria-invalid="true" defaultValue="example" />
            </Field>
            <Field label="补充说明" htmlFor="context" className="md:col-span-2">
              <Textarea id="context" placeholder="记录当前理解、疑问或需要关联的上下文" />
            </Field>
          </div>
        </ShowcaseSection>

        <ShowcaseSection title="浮层与反馈" description="焦点管理、退出行为和层级由统一 primitive 负责。">
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">打开对话框</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="text-base font-semibold">保存为学习目标</DialogTitle>
                <DialogDescription className="mt-1 text-sm leading-relaxed text-muted">
                  目标会影响今日任务排序和练习推荐，不会修改已有学习记录。
                </DialogDescription>
                <Field label="目标名称" htmlFor="dialog-goal" className="mt-5">
                  <Input id="dialog-goal" defaultValue="完成 SQL 基础复习" />
                </Field>
                <div className="mt-6 flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="ghost">取消</Button>
                  </DialogClose>
                  <Button>保存目标</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">查看学习上下文</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-xs font-medium text-muted">当前概念</p>
                <p className="mt-1 text-sm font-semibold">数据库索引</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  来自会话“SQL 性能优化”，当前掌握状态为学习中。
                </p>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  更多操作
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>会话</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Pin /> 置顶
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive /> 归档
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive>删除会话</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  tone: 'success',
                  title: '已加入复习队列',
                  description: '首次复习安排在今天稍后。',
                })
              }
            >
              显示通知
            </Button>
          </div>
        </ShowcaseSection>

        <ShowcaseSection title="内容状态" description="状态直接说明发生了什么，以及用户接下来能做什么。">
          <div className="grid gap-6 lg:grid-cols-3">
            <div aria-label="加载状态" className="space-y-3 py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-9 w-24" />
            </div>
            <EmptyState
              title="还没有学习资源"
              description="把正在阅读的资料放进输入箱。"
              actionLabel="添加资源"
              onAction={() => undefined}
            />
            <ErrorState
              title="会话加载失败"
              description="本地服务暂时没有响应，当前输入已保留。"
              actionLabel="重新加载"
              onAction={() => undefined}
            />
          </div>
        </ShowcaseSection>
      </div>
    </PageShell>
  );
}

function ShowcaseSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}
