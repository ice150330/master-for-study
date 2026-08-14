import Link from 'next/link';

type DashboardData = {
  termStats: {
    total: number;
    new: number;
    learning: number;
    reviewing: number;
    relearning: number;
    due: number;
  };
  eventBreakdown: Record<string, number>;
  interviewStats: { total: number; answered: number; correct: number };
  recentEvents: Array<{
    type: string;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
};

const EVENT_LABELS: Record<string, string> = {
  term_seen: '发现术语',
  term_explained: '解释术语',
  message_sent: '对话',
  reviewed: '复习',
  attempt: '作答',
  mastered: '掌握',
};

export function AnalyticsView({ data }: { data: DashboardData }) {
  const { termStats, eventBreakdown, interviewStats, recentEvents } = data;
  const correctRate = interviewStats.answered
    ? Math.round((interviewStats.correct / interviewStats.answered) * 100)
    : 0;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">成长分析</h1>
          <p className="mt-1 text-sm text-muted">你的学习，看得见</p>
        </div>
        <Link href="/" className="rounded-lg bg-card px-3 py-2 text-sm text-background">
          ← 返回聊天
        </Link>
      </header>

      {/* 术语掌握度 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">术语掌握度</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="总术语" value={termStats.total} />
          <StatCard label="待复习" value={termStats.due} accent />
          <StatCard label="复习中" value={termStats.reviewing} />
          <StatCard label="学习中" value={termStats.learning} />
          <StatCard label="重学中" value={termStats.relearning} />
          <StatCard label="新增" value={termStats.new} />
        </div>
      </section>

      {/* 面试表现 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">面试表现</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="出题数" value={interviewStats.total} />
          <StatCard label="已作答" value={interviewStats.answered} />
          <StatCard label="正确率" value={`${correctRate}%`} accent />
        </div>
      </section>

      {/* 学习事件分布 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">学习行为分布</h2>
        {Object.keys(eventBreakdown).length === 0 ? (
          <p className="text-sm text-muted">暂无学习行为记录</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(eventBreakdown).map(([type, n]) => (
              <div key={type} className="flex items-center justify-between rounded-xl bg-background/40 px-4 py-2 text-sm">
                <span className="text-foreground">{EVENT_LABELS[type] ?? type}</span>
                <span className="font-semibold text-accent">{n}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 最近活动 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">最近活动</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted">暂无活动记录</p>
        ) : (
          <div className="space-y-1.5">
            {recentEvents.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-muted">
                <span>{EVENT_LABELS[e.type] ?? e.type}</span>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-md ${accent ? 'bg-primary text-foreground' : 'bg-card text-background'}`}
    >
      <div className={`text-xs ${accent ? 'text-foreground/70' : 'text-background/60'}`}>{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
