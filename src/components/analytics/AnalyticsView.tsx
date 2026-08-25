'use client';

import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FlaskConical,
  Gauge,
  MessageSquareText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageShell } from '@/components/shell/PageShell';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getErrorMessage, requestJson } from '@/lib/http/client';
import type {
  AnalyticsActivity,
  AnalyticsActivityCategory,
  AnalyticsDay,
  AnalyticsRange,
  LearningAnalytics,
} from '@/lib/analytics/types';

type ActivityFilter = 'all' | AnalyticsActivityCategory;

const categoryMeta = {
  learning: { label: '学习活动', color: 'bg-primary', text: 'text-primary', icon: MessageSquareText },
  assessment: { label: '评测结果', color: 'bg-accent', text: 'text-accent', icon: FlaskConical },
  review: { label: '复习记录', color: 'bg-warning', text: 'text-warning', icon: Brain },
};

export function AnalyticsView({ initialData }: { initialData: LearningAnalytics }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState<AnalyticsRange>(initialData.rangeDays);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredActivities = useMemo(() => data.recentActivities.filter((activity) => (
    (!selectedDate || activity.date === selectedDate)
      && (filter === 'all' || activity.category === filter)
  )), [data.recentActivities, filter, selectedDate]);

  async function changeRange(value: string) {
    const next = Number(value) as AnalyticsRange;
    if (next === range || loading) return;
    setRange(next);
    setSelectedDate(null);
    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<{ analytics: LearningAnalytics }>(`/api/analytics?days=${next}`);
      setData(response.analytics);
    } catch (requestError) {
      setRange(data.rangeDays);
      setError(getErrorMessage(requestError, '暂时无法加载分析数据'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell
      pageKey="analytics"
      width="xl"
      actions={(
        <SegmentedControl
          value={String(range)}
          onValueChange={changeRange}
          ariaLabel="分析时间范围"
          items={[{ value: '7', label: '近 7 天' }, { value: '30', label: '近 30 天' }]}
        />
      )}
    >
      {error ? (
        <InlineNotice
          className="mb-4"
          tone="error"
          title="时间范围切换失败"
          description={error}
          actionLabel="重试"
          onAction={() => changeRange(String(range === data.rangeDays ? (range === 7 ? 30 : 7) : range))}
        />
      ) : null}

      <div className={loading ? 'pointer-events-none opacity-55 transition-opacity' : 'transition-opacity'}>
        <TodayBand data={data} />

        <section className="mt-8" aria-labelledby="trend-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-muted">学习节律</p>
            <h2 id="trend-heading" className="doodle-heading mt-1 text-base font-extrabold text-foreground">
                每一天做了什么
              </h2>
            </div>
            <TrendLegend />
          </div>

          <div className="mt-4 grid min-[1180px]:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 border-y border-dashed border-border py-5 min-[1180px]:pr-7">
              <ActivityTrend
                days={data.trend}
                selectedDate={selectedDate}
                onSelectDate={(date) => setSelectedDate((current) => current === date ? null : date)}
              />
            </div>
            <WeakSkills skills={data.weakSkills} />
          </div>
        </section>

        <MetricStrip metrics={data.metrics} />
        <ProgressStrip progress={data.progress} />

        <ActivityLedger
          activities={filteredActivities}
          filter={filter}
          selectedDate={selectedDate}
          onFilter={setFilter}
          onClearDate={() => setSelectedDate(null)}
        />
      </div>
    </PageShell>
  );
}

function TodayBand({ data }: { data: LearningAnalytics }) {
  const { today, recommendation } = data;
  return (
    <section className="paper-panel grid overflow-hidden rounded-[2px] border-2 border-dashed min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(31rem,0.8fr)]">
      <div className="doodle-feature relative min-h-56 px-7 py-6 text-foreground">
        <Sparkles aria-hidden="true" className="size-5 opacity-75" />
        <p className="mt-5 text-[11px] font-semibold text-primary">{recommendation.eyebrow}</p>
        <h2 className="doodle-heading mt-1 max-w-2xl text-[25px] font-extrabold leading-tight">{recommendation.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/80">{recommendation.description}</p>
        <Link
          href={recommendation.href}
          className="doodle-action mt-6 inline-flex h-8 items-center gap-2 rounded-[2px] border-2 border-dashed border-foreground bg-card px-3.5 text-xs font-semibold text-foreground transition-[transform,box-shadow,background-color] hover:-translate-x-px hover:-translate-y-px hover:bg-highlight/15 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
        >
          {recommendation.actionLabel}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 bg-card-soft/70 text-card-foreground">
        <LoadValue icon={Brain} label="今天到期" value={`${today.dueReviews} 个`} detail={`${today.overdueReviews} 个已逾期`} />
        <LoadValue icon={Clock3} label="预计负荷" value={`${today.estimatedMinutes} 分钟`} detail="按当前到期队列估算" />
        <LoadValue icon={CheckCircle2} label="今日已完成" value={`${today.completedActions} 次`} detail="来自有效学习事件" />
        <LoadValue icon={Gauge} label="当前节奏" value={today.completedActions > 0 ? '已启动' : '待开始'} detail="不以连续签到替代学习" />
      </div>
    </section>
  );
}

function LoadValue({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-h-28 border-b border-l border-dashed border-border px-5 py-4 even:border-r-0 [&:nth-child(n+3)]:border-b-0">
      <div className="flex items-center gap-2 text-xs text-muted"><Icon aria-hidden="true" className="size-4" />{label}</div>
      <p className="mt-3 text-xl font-semibold text-card-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

function TrendLegend() {
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-[11px] text-muted">
      {Object.entries(categoryMeta).map(([key, meta]) => (
        <span key={key} className="inline-flex items-center gap-1.5"><i className={`size-2 rounded-[2px] ${meta.color}`} />{meta.label}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><i className="size-2 rotate-45 bg-danger" />提示次数</span>
    </div>
  );
}

function ActivityTrend({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: AnalyticsDay[];
  selectedDate: string | null;
  onSelectDate(date: string): void;
}) {
  const max = Math.max(1, ...days.map((day) => day.total));
  const labelEvery = days.length > 7 ? 5 : 1;
  const hasData = days.some((day) => day.total > 0);
  return (
    <div data-testid="activity-trend" className="relative h-60">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 grid h-48 grid-rows-4">
        {[0, 1, 2, 3].map((line) => <i key={line} className="border-t border-dashed border-border/70" />)}
      </div>
      {!hasData ? (
        <div className="absolute inset-x-0 top-16 text-center">
          <MessageSquareText aria-hidden="true" className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm font-medium text-foreground">这段时间还没有学习证据</p>
          <p className="mt-1 text-xs text-muted">完成一次对话、练习或复习后，节律会出现在这里。</p>
        </div>
      ) : null}
      <div className="absolute inset-0 flex items-end gap-1.5 pb-7" role="group" aria-label="每日学习行为">
        {days.map((day, index) => {
          const selected = selectedDate === day.date;
          const height = day.total === 0 ? 2 : Math.max(12, Math.round((day.total / max) * 176));
          return (
            <button
              key={day.date}
              type="button"
              aria-label={`${day.date}：学习 ${day.learning}，评测 ${day.assessment}，复习 ${day.review}，提示 ${day.hints}`}
              aria-pressed={selected}
              onClick={() => onSelectDate(day.date)}
              className={`group relative flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center rounded-[3px] px-0.5 transition-colors ${selected ? 'bg-primary/10' : 'hover:bg-surface'}`}
            >
              {day.hints > 0 ? (
                <span className="absolute top-1 flex size-4 rotate-[-3deg] items-center justify-center rounded-[2px] border border-dashed border-foreground/40 bg-danger text-[9px] font-semibold text-danger-foreground">{day.hints}</span>
              ) : null}
              <span className="flex w-full max-w-7 flex-col-reverse overflow-hidden rounded-[3px]" style={{ height }}>
                {day.learning ? <i className="bg-primary" style={{ flex: day.learning }} /> : null}
                {day.assessment ? <i className="bg-accent" style={{ flex: day.assessment }} /> : null}
                {day.review ? <i className="bg-warning" style={{ flex: day.review }} /> : null}
                {day.total === 0 ? <i className="h-0.5 bg-border" /> : null}
              </span>
              {(index % labelEvery === 0 || index === days.length - 1) ? (
                <span className={`absolute bottom-0 rounded-sm bg-background px-1 text-[10px] ${selected ? 'font-semibold text-primary' : 'text-muted'}`}>{day.label}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeakSkills({ skills }: { skills: LearningAnalytics['weakSkills'] }) {
  return (
    <aside className="border-b border-dashed border-border py-5 min-[1180px]:border-l min-[1180px]:border-t min-[1180px]:pl-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">薄弱技能</h3>
        <span className="text-[10px] text-muted">按证据优先级</span>
      </div>
      {skills.length === 0 ? (
        <div className="py-9 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-5 text-accent" />
          <p className="mt-2 text-xs font-medium text-foreground">没有足够证据判断薄弱项</p>
          <p className="mt-1 text-[11px] text-muted">继续完成评测或复习后再判断。</p>
        </div>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {skills.map((skill) => (
            <article key={skill.conceptId} className="py-3 first:pt-0">
              <div className="flex items-center justify-between gap-3">
                <Link href={skill.href} className="doodle-link truncate text-sm font-semibold text-foreground hover:text-primary">
                  {skill.name}
                </Link>
                <span className="shrink-0 text-[10px] text-muted">{skill.sampleSize} 条行为证据</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-[1px] border border-dashed border-border bg-surface">
                <div className="h-full bg-danger" style={{ width: `${Math.min(100, Math.max(12, skill.priority))}%` }} />
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">{skill.evidence.join('；')}</p>
              <Link href={skill.actionHref} className="doodle-link mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
                {skill.actionLabel}<ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}

function MetricStrip({ metrics }: { metrics: LearningAnalytics['metrics'] }) {
  return (
    <section className="mt-8 grid border-y border-dashed border-border min-[780px]:grid-cols-2 min-[1180px]:grid-cols-4" aria-label="关键学习指标">
      {metrics.map((metric, index) => (
        <Link
          key={metric.id}
          href={metric.href}
          className={`group min-h-36 px-5 py-4 transition-[transform,box-shadow,background-color] hover:-translate-y-px hover:bg-highlight/10 hover:shadow-[inset_0_-4px_0_rgba(255,217,61,0.32)] ${index > 0 ? 'border-t border-dashed border-border min-[780px]:border-l min-[780px]:border-t-0' : ''} ${index === 2 ? 'min-[780px]:border-l-0 min-[1180px]:border-l' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted">{metric.label}</span>
            {metric.status === 'insufficient' ? <CircleAlert aria-label="样本不足" className="size-4 text-warning" /> : <ArrowRight aria-hidden="true" className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" />}
          </div>
          <p className={`mt-4 font-semibold ${metric.status === 'insufficient' ? 'text-base text-warning' : 'text-2xl text-foreground'}`}>{metric.value}</p>
          <p className="mt-1.5 text-[11px] leading-4 text-muted">{metric.detail}</p>
          <p className="mt-2 truncate text-[9px] font-medium text-muted">{metric.source}</p>
        </Link>
      ))}
    </section>
  );
}

function ProgressStrip({ progress }: { progress: LearningAnalytics['progress'] }) {
  if (progress.length === 0) return null;
  return (
    <section className="mt-8" aria-labelledby="progress-heading">
      <div className="flex items-center gap-2">
        <CheckCircle2 aria-hidden="true" className="size-4 text-accent" />
        <h2 id="progress-heading" className="text-sm font-semibold text-foreground">最近真实进步</h2>
      </div>
      <div className="mt-3 grid divide-y divide-dashed divide-border border-y border-dashed border-border min-[900px]:grid-cols-3 min-[900px]:divide-x min-[900px]:divide-y-0">
        {progress.map((item) => (
          <Link key={item.id} href={item.href} className="group px-4 py-3 first:pl-0 last:pr-0">
            <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">{item.title}</p>
            <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
            <time className="mt-1.5 block text-[10px] text-muted">{formatTime(item.createdAt)}</time>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ActivityLedger({
  activities,
  filter,
  selectedDate,
  onFilter,
  onClearDate,
}: {
  activities: AnalyticsActivity[];
  filter: ActivityFilter;
  selectedDate: string | null;
  onFilter(filter: ActivityFilter): void;
  onClearDate(): void;
}) {
  return (
    <section id="activity-ledger" className="mt-8 scroll-mt-20" aria-labelledby="activity-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="activity-heading" className="doodle-heading text-base font-extrabold text-foreground">证据流水</h2>
          <p className="mt-1 text-xs text-muted">
            {selectedDate ? `正在查看 ${selectedDate}` : '对象、结果与来源可继续下钻'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDate ? (
            <Button size="sm" variant="ghost" onClick={onClearDate}><RefreshCw aria-hidden="true" className="size-3.5" />全部日期</Button>
          ) : null}
          <SegmentedControl
            value={filter}
            onValueChange={(value) => onFilter(value as ActivityFilter)}
            ariaLabel="活动类型筛选"
            items={[
              { value: 'all', label: '全部' },
              { value: 'learning', label: '学习' },
              { value: 'assessment', label: '评测' },
              { value: 'review', label: '复习' },
            ]}
          />
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="mt-3 border-y border-dashed border-border py-12 text-center">
          <MessageSquareText aria-hidden="true" className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm font-medium text-foreground">当前筛选没有记录</p>
          <p className="mt-1 text-xs text-muted">切换活动类型或清除日期筛选。</p>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden border-y border-dashed border-border">
          <div className="grid grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,0.9fr)_8rem] gap-4 border-b border-dashed border-border bg-surface px-3 py-2 text-[10px] font-semibold text-muted">
            <span>行为</span><span>对象</span><span>结果</span><span className="text-right">时间</span>
          </div>
          <div className="divide-y divide-dashed divide-border">
            {activities.map((activity) => {
              const meta = categoryMeta[activity.category];
              const Icon = meta.icon;
              return (
                <Link
                  key={activity.id}
                  href={activity.href}
                  className="group grid min-h-12 grid-cols-[9rem_minmax(12rem,1fr)_minmax(10rem,0.9fr)_8rem] items-center gap-4 px-3 py-2 text-xs transition-[transform,background-color,box-shadow] hover:translate-x-0.5 hover:bg-highlight/10 hover:shadow-[inset_3px_0_0_var(--marker-teal)]"
                >
                  <span className={`inline-flex items-center gap-2 ${meta.text}`}><Icon aria-hidden="true" className="size-3.5" />{activity.actionLabel}</span>
                  <span className="truncate font-medium text-foreground group-hover:text-primary">{activity.objectTitle}</span>
                  <span className="truncate text-muted">{activity.resultLabel}</span>
                  <time className="text-right text-[10px] text-muted">{formatTime(activity.createdAt)}</time>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
