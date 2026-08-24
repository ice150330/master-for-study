'use client';

import { Download, Flag, GraduationCap, Gauge, Layers, Bell, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/Toast';
import {
  ANSWER_DEPTHS,
  DEFAULT_ANSWER_DEPTH,
  DEFAULT_TEACHER_STYLE,
  TEACHER_STYLES,
  isAnswerDepth,
  isTeacherStyle,
  teacherStyleLabel,
} from '@/lib/ai/teacher-style';
import { setThemeMode, useThemeMode } from '@/lib/theme-client';

/** 面板关心的设置字段子集（服务端还有场景覆盖等保留列）。 */
type PanelSettings = {
  teacherStyle: string;
  interviewStyle: string | null;
  reviewStyle: string | null;
  growthGoal: string | null;
  dailyNewLimit: number;
  retentionTarget: number;
  answerDepth: string;
  memoryInjection: boolean;
};

const GOAL_PRESETS = ['后端工程师', '前端工程师', '算法·AI', '在校学生', '转行求职', '自由学习'];

/**
 * 工作台设置面板（蓝图 §6 用户可配置项）：
 * 老师风格 / 内容深浅 / 复习保留率 / 每日新学量 / 成长目标 + 纸张色温。
 * 读写 /api/settings，乐观更新、失败回滚。
 */
export function SettingsPanel() {
  const toast = useToast();
  const mode = useThemeMode();
  const [settings, setSettings] = useState<PanelSettings | null>(null);
  const [goalDraft, setGoalDraft] = useState('');
  const [limitDraft, setLimitDraft] = useState('');
  // 弹层内容仅在客户端打开时挂载，惰性读取通知权限是安全的
  const [notifyPermission, setNotifyPermission] = useState<'unsupported' | 'default' | 'granted' | 'denied'>(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
  );
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const loadRan = useRef(false);

  useEffect(() => {
    if (loadRan.current) return;
    loadRan.current = true;
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data: unknown = await res.json();
        const raw = (data as { settings?: Partial<PanelSettings> })?.settings ?? {};
        applySettings(setSettings, setGoalDraft, setLimitDraft, raw);
      } catch {
        // 拉不到设置时保持空态，控件禁用
      }
    })();
  }, []);

  async function patch(update: Partial<PanelSettings>) {
    if (!settings) return;
    const previous = settings;
    const optimistic = { ...settings, ...update };
    setSettings(optimistic);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const raw = (data as { settings?: Partial<PanelSettings> })?.settings ?? {};
      applySettings(setSettings, setGoalDraft, setLimitDraft, raw);
    } catch {
      setSettings(previous);
      applySettings(setSettings, setGoalDraft, setLimitDraft, previous);
      toast({ title: '设置保存失败', description: '请稍后重试', tone: 'error' });
    }
  }

  /** B1 导入：选文件 → 确认弹窗（提示先导出）→ POST 整库替换 → 刷新页面。 */
  function handleImportFile(file: File | null) {
    if (!file) return;
    pendingFileRef.current = file;
    setImportOpen(true);
  }

  async function confirmImport() {
    const file = pendingFileRef.current;
    if (!file || importBusy) return;
    setImportBusy(true);
    try {
      const text = await file.text();
      const body: unknown = JSON.parse(text);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `导入失败（HTTP ${res.status}）`);
      }
      window.location.reload();
    } catch (error) {
      toast({ title: '导入失败', description: error instanceof Error ? error.message : '文件无效', tone: 'error' });
      setImportBusy(false);
      setImportOpen(false);
    }
  }

  /** 成长目标 / 每日新学量输入框的落盘提交（失焦或回车）。 */
  function commitGoal() {
    const next = goalDraft.trim();
    if (!settings) return;
    if ((settings.growthGoal ?? '') === next) return;
    if (!next) {
      // 置空 = 清除目标（服务端 schema 允许 null）
      void patch({ growthGoal: null });
    } else {
      void patch({ growthGoal: next });
    }
  }

  function commitLimit() {
    if (!settings) return;
    const parsed = Number.parseInt(limitDraft, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 200 || parsed === settings.dailyNewLimit) {
      setLimitDraft(String(settings.dailyNewLimit));
      return;
    }
    void patch({ dailyNewLimit: parsed });
  }

  if (!settings) {
    return <p className="py-6 text-center text-xs text-muted">设置加载中…</p>;
  }

  return (
    <div className="max-h-[min(34rem,70vh)] space-y-3 overflow-y-auto">
      <p className="text-[13px] font-semibold text-foreground">工作台设置</p>

      {/* 老师风格：全局默认（会话内临时切换不受影响） */}
      <section>
        <div className="flex items-center gap-1.5">
          <GraduationCap aria-hidden="true" className="size-3.5 text-primary" />
          <p className="text-xs font-medium text-foreground">老师风格（全局默认）</p>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {TEACHER_STYLES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={settings.teacherStyle === item.value}
              title={item.tagline}
              onClick={() => void patch({ teacherStyle: item.value })}
              className={`rounded-[2px] border border-dashed px-1 py-1.5 text-xs font-semibold transition-[transform,box-shadow,background-color] active:translate-x-[2px] active:translate-y-[2px] ${
                settings.teacherStyle === item.value
                  ? 'border-foreground bg-foreground text-background shadow-[2px_2px_0_var(--marker-yellow)]'
                  : 'border-border text-muted hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 场景绑定（B6）：面试 / 复习各自的风格覆盖，null = 跟随全局 */}
      <section>
        <p className="text-xs font-medium text-foreground">场景绑定</p>
        <div className="mt-1.5 space-y-1.5">
          <SceneStyleRow
            label="面试风格"
            value={settings.interviewStyle}
            fallbackLabel={teacherStyleLabel(settings.teacherStyle)}
            onChange={(next) => void patch({ interviewStyle: next })}
          />
          <SceneStyleRow
            label="复习语气"
            value={settings.reviewStyle}
            fallbackLabel={teacherStyleLabel(settings.teacherStyle)}
            onChange={(next) => void patch({ reviewStyle: next })}
          />
        </div>
      </section>

      {/* 内容深浅 */}
      <section>
        <div className="flex items-center gap-1.5">
          <Layers aria-hidden="true" className="size-3.5 text-accent" />
          <p className="text-xs font-medium text-foreground">内容深浅</p>
        </div>
        <div className="mt-1.5">
          <SegmentedControl
            ariaLabel="内容深浅"
            value={isAnswerDepth(settings.answerDepth) ? settings.answerDepth : DEFAULT_ANSWER_DEPTH}
            items={ANSWER_DEPTHS.map((item) => ({ value: item.value, label: item.label }))}
            onValueChange={(value) => void patch({ answerDepth: value })}
          />
        </div>
      </section>

      {/* 学习节奏：保留率 + 每日新学量 */}
      <section>
        <div className="flex items-center gap-1.5">
          <Gauge aria-hidden="true" className="size-3.5 text-primary" />
          <p className="text-xs font-medium text-foreground">学习节奏</p>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">复习保留率目标</p>
          <SegmentedControl
            ariaLabel="复习保留率目标"
            value={settings.retentionTarget === 0.9 ? '0.9' : '0.85'}
            items={[
              { value: '0.85', label: '85%' },
              { value: '0.9', label: '90%' },
            ]}
            onValueChange={(value) => void patch({ retentionTarget: Number(value) })}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted">每日新学量（张）</p>
          <Input
            aria-label="每日新学量"
            inputMode="numeric"
            value={limitDraft}
            onChange={(event) => setLimitDraft(event.target.value)}
            onBlur={commitLimit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            className="h-8 w-20 text-right"
          />
        </div>
      </section>

      {/* 成长目标 */}
      <section>
        <div className="flex items-center gap-1.5">
          <Flag aria-hidden="true" className="size-3.5 text-accent" />
          <p className="text-xs font-medium text-foreground">成长目标</p>
        </div>
        <Input
          aria-label="成长目标"
          value={goalDraft}
          placeholder="如：后端工程师 · 在职提升"
          onChange={(event) => setGoalDraft(event.target.value)}
          onBlur={commitGoal}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="mt-1.5 h-8"
        />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {GOAL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setGoalDraft(preset);
                void patch({ growthGoal: preset });
              }}
              className={`rounded-[2px] border border-dashed px-1.5 py-0.5 text-[11px] transition-[background-color,border-color] ${
                settings.growthGoal === preset
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </section>

      {/* 老师记忆：画像注入开关 */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">老师记忆</p>
            <p className="mt-0.5 text-[11px] text-muted">让老师跨会话记得你学过什么</p>
          </div>
          <SegmentedControl
            ariaLabel="老师记忆注入"
            value={settings.memoryInjection ? 'on' : 'off'}
            items={[
              { value: 'on', label: '开启' },
              { value: 'off', label: '关闭' },
            ]}
            onValueChange={(value) => void patch({ memoryInjection: value === 'on' })}
          />
        </div>
      </section>

      {/* 纸张色温 */}
      <section className="border-t border-dashed border-border/70 pt-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs font-medium text-foreground">纸张色温</p>
          <SegmentedControl
            ariaLabel="界面主题"
            value={mode}
            items={[
              { value: 'light', label: '纸白' },
              { value: 'dark', label: '暖纸' },
            ]}
            onValueChange={(value) => setThemeMode(value === 'dark' ? 'dark' : 'light')}
          />
        </div>
      </section>

      {/* 复习提醒（A4）：浏览器通知授权，应用打开期间每日至多提醒一次 */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <Bell aria-hidden="true" className="size-3.5 text-primary" />
              <p className="text-xs font-medium text-foreground">复习提醒</p>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              {notifyPermission === 'granted'
                ? '已开启 · 有到期卡时每日提醒一次'
                : notifyPermission === 'denied'
                  ? '已被浏览器拒绝，可在浏览器设置中重新允许'
                  : notifyPermission === 'unsupported'
                    ? '当前浏览器不支持通知'
                    : '开启后应用打开期间到期即提醒'}
            </p>
          </div>
          {notifyPermission === 'default' ? (
            <button
              type="button"
              onClick={() => {
                void Notification.requestPermission().then((result) => setNotifyPermission(result));
              }}
              className="rounded-[2px] border-2 border-dashed border-foreground bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground transition-[transform,box-shadow] hover:-translate-x-px hover:-translate-y-px active:translate-x-[2px] active:translate-y-[2px]"
            >
              开启提醒
            </button>
          ) : (
            <span aria-hidden className="text-[11px] text-muted">
              {notifyPermission === 'granted' ? '✓' : '—'}
            </span>
          )}
        </div>
      </section>

      {/* 数据备份：全量导出 / 导入 JSON（蓝图 §1 私有原则：可随时导出 / 备份 / 迁移） */}
      <section className="border-t border-dashed border-border/70 pt-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-foreground">数据备份</p>
            <p className="mt-0.5 text-[11px] text-muted">导出全部本地数据，或从备份恢复</p>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href="/api/export"
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border-2 border-dashed border-foreground bg-card px-3 text-xs font-semibold text-foreground transition-[transform,box-shadow,background-color] hover:-translate-x-px hover:-translate-y-px hover:bg-highlight/15 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <Download aria-hidden="true" className="size-3.5" />
              导出
            </a>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-dashed border-border px-3 text-xs font-semibold text-muted transition-[background-color,border-color,color] hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground"
            >
              <Upload aria-hidden="true" className="size-3.5" />
              导入
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="选择备份文件"
              onChange={(event) => {
                handleImportFile(event.target.files?.[0] ?? null);
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </section>

      <Dialog open={importOpen} onOpenChange={(open) => {
        setImportOpen(open);
        if (!open) pendingFileRef.current = null;
      }}>
        <DialogContent className="w-96">
          <DialogTitle>确认导入备份？</DialogTitle>
          <DialogDescription>
            导入会<strong className="text-foreground">覆盖当前全部数据</strong>（会话、概念、复习记录与设置），恢复到备份时刻。此操作不可撤销，建议先导出当前数据留底。
          </DialogDescription>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importBusy}>取消</Button>
            <Button onClick={() => void confirmImport()} loading={importBusy}>
              {importBusy ? '导入中…' : '覆盖导入'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="border-t border-dashed border-border/70 pt-2 text-[11px] leading-relaxed text-muted">
        老师风格与深浅影响对话讲解方式；保留率与每日新学量决定复习调度。学习记录保存在本地
        SQLite；发送给老师的内容会用于 DeepSeek 在线推理。
      </div>
    </div>
  );
}

/** 把服务端设置行写进面板状态与两个草稿输入框。 */
function applySettings(
  setSettings: (next: PanelSettings) => void,
  setGoalDraft: (value: string) => void,
  setLimitDraft: (value: string) => void,
  raw: Partial<PanelSettings>,
) {
  const next: PanelSettings = {
    teacherStyle: isTeacherStyle(raw.teacherStyle) ? raw.teacherStyle : DEFAULT_TEACHER_STYLE,
    interviewStyle: isTeacherStyle(raw.interviewStyle) ? raw.interviewStyle : null,
    reviewStyle: isTeacherStyle(raw.reviewStyle) ? raw.reviewStyle : null,
    growthGoal: typeof raw.growthGoal === 'string' ? raw.growthGoal : null,
    dailyNewLimit: typeof raw.dailyNewLimit === 'number' ? raw.dailyNewLimit : 10,
    retentionTarget: raw.retentionTarget === 0.9 ? 0.9 : 0.85,
    answerDepth: isAnswerDepth(raw.answerDepth) ? raw.answerDepth : DEFAULT_ANSWER_DEPTH,
    memoryInjection: typeof raw.memoryInjection === 'boolean' ? raw.memoryInjection : true,
  };
  setSettings(next);
  setGoalDraft(next.growthGoal ?? '');
  setLimitDraft(String(next.dailyNewLimit));
}

/** 场景绑定行：当前生效风格 + chips（跟随全局 / 六型）。 */
function SceneStyleRow({
  label,
  value,
  fallbackLabel,
  onChange,
}: {
  label: string;
  value: string | null;
  fallbackLabel: string;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="mt-1 text-[11px] text-muted">
        {label}
        <span className="ml-1 text-foreground">
          （{value ? teacherStyleLabel(value) : `跟随全局 · ${fallbackLabel}`}）
        </span>
      </p>
      <div className="flex max-w-[13rem] flex-wrap justify-end gap-1">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`rounded-[2px] border border-dashed px-1.5 py-0.5 text-[11px] transition-[background-color,border-color] ${
            value === null
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground'
          }`}
        >
          跟随全局
        </button>
        {TEACHER_STYLES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={value === item.value}
            onClick={() => onChange(item.value)}
            className={`rounded-[2px] border border-dashed px-1.5 py-0.5 text-[11px] transition-[background-color,border-color] ${
              value === item.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted hover:border-accent/60 hover:bg-highlight/10 hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
