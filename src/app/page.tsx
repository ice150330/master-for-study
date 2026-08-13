export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background p-8">
      {/* 标题区 */}
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Mentor
        </h1>
        <p className="mt-3 text-muted">
          本地 AI 学习老师 · card-stack 设计风格
        </p>
      </div>

      {/* 彩色卡片堆叠展示 */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="flex h-28 w-44 flex-col justify-between rounded-2xl bg-primary p-4 shadow-lg">
          <span className="font-mono text-xs text-foreground/70">primary</span>
          <span className="text-2xl font-bold text-foreground">#6c5ce7</span>
        </div>
        <div className="flex h-28 w-44 flex-col justify-between rounded-2xl bg-accent p-4 shadow-lg">
          <span className="font-mono text-xs text-background/70">accent</span>
          <span className="text-2xl font-bold text-background">#00cec9</span>
        </div>
        <div className="flex h-28 w-44 flex-col justify-between rounded-2xl bg-pink p-4 shadow-lg">
          <span className="font-mono text-xs text-background/70">pink</span>
          <span className="text-2xl font-bold text-background">#fd79a8</span>
        </div>
        <div className="flex h-28 w-44 flex-col justify-between rounded-2xl bg-yellow p-4 shadow-lg">
          <span className="font-mono text-xs text-background/70">yellow</span>
          <span className="text-2xl font-bold text-background">#ffeaa7</span>
        </div>
        <div className="flex h-28 w-44 flex-col justify-between rounded-2xl bg-card p-4 shadow-lg">
          <span className="font-mono text-xs text-background/50">card</span>
          <span className="text-2xl font-bold text-background">#f0f0f5</span>
        </div>
      </div>
    </main>
  );
}
