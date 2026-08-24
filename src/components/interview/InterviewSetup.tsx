import { ArrowRight, Clock3, History, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_ROLES,
  INTERVIEW_STYLES,
  INTERVIEW_TOPICS,
  interviewOptionLabel,
  type InterviewSettings,
} from '@/lib/interview/types';
import type { InterviewSessionDetailDto } from './types';

export function InterviewSetup({
  settings,
  onSettingsChange,
  onStart,
  busy,
  history,
  onResume,
}: {
  settings: InterviewSettings;
  onSettingsChange(settings: InterviewSettings): void;
  onStart(): void;
  busy: boolean;
  history: InterviewSessionDetailDto[];
  onResume(detail: InterviewSessionDetailDto): void;
}) {
  return (
    <div className="paper-panel grid min-h-[620px] overflow-hidden rounded-[2px] border-2 border-dashed min-[1120px]:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="p-7" aria-labelledby="interview-setup-title">
        <div className="flex items-center gap-2 text-primary">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <p className="text-xs font-semibold">练习设置</p>
        </div>
        <h2 id="interview-setup-title" className="doodle-heading mt-3 text-xl font-extrabold text-card-foreground">
          定义这次面试的目标
        </h2>
        <div className="mt-6 grid gap-7">
          <SettingRow title="目标岗位" description="决定题目的工程语境与考察深度">
            <SegmentedControl
              ariaLabel="目标岗位"
              className="flex-wrap"
              value={settings.role}
              items={INTERVIEW_ROLES.map((item) => ({ ...item }))}
              onValueChange={(role) => onSettingsChange({ ...settings, role: role as InterviewSettings['role'] })}
            />
          </SettingRow>
          <SettingRow title="重点主题" description="本场只围绕一个主要能力域推进">
            <SegmentedControl
              ariaLabel="重点主题"
              className="flex-wrap"
              value={settings.topic}
              items={INTERVIEW_TOPICS.map((item) => ({ ...item }))}
              onValueChange={(topic) => onSettingsChange({ ...settings, topic: topic as InterviewSettings['topic'] })}
            />
          </SettingRow>
          <div className="grid gap-7 border-y border-dashed border-border py-7 min-[980px]:grid-cols-2">
            <SettingRow title="起始难度" description="后续会按表现升降档">
              <SegmentedControl
                ariaLabel="起始难度"
                value={settings.difficulty}
                items={INTERVIEW_DIFFICULTIES.map((item) => ({ ...item }))}
                onValueChange={(difficulty) => onSettingsChange({ ...settings, difficulty: difficulty as InterviewSettings['difficulty'] })}
              />
            </SettingRow>
            <SettingRow title="面试轮数" description="约 10-20 分钟完成">
              <SegmentedControl
                ariaLabel="面试轮数"
                value={String(settings.totalRounds)}
                items={[{ value: '3', label: '3 题' }, { value: '5', label: '5 题' }]}
                onValueChange={(rounds) => onSettingsChange({ ...settings, totalRounds: Number(rounds) as 3 | 5 })}
              />
            </SettingRow>
          </div>
          <SettingRow title="面试官风格" description="影响提问与追问方式，不改变评分标准">
            <SegmentedControl
              ariaLabel="面试官风格"
              value={settings.teacherStyle}
              items={INTERVIEW_STYLES.map((item) => ({ ...item }))}
              onValueChange={(teacherStyle) => onSettingsChange({ ...settings, teacherStyle: teacherStyle as InterviewSettings['teacherStyle'] })}
            />
          </SettingRow>
        </div>

        <div className="mt-9 flex items-center justify-between border-t border-dashed border-border pt-5">
          <p className="text-xs text-muted">
            {interviewOptionLabel(INTERVIEW_ROLES, settings.role)} · {interviewOptionLabel(INTERVIEW_TOPICS, settings.topic)} · {settings.totalRounds} 题
          </p>
          <Button size="lg" loading={busy} onClick={onStart}>
            开始面试
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </section>

      <aside className="paper-subtle border-l border-dashed border-border p-5" aria-label="最近面试">
        <div className="flex items-center gap-2">
          <History aria-hidden="true" className="size-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">最近场次</h2>
        </div>
        {history.length === 0 ? (
          <p className="mt-5 text-xs leading-5 text-muted">完成第一场后，这里会保留题目、回答版本和评分。</p>
        ) : (
          <div className="mt-4 grid gap-2">
            {history.slice(0, 6).map((detail) => {
              const latest = detail.questions.at(-1)?.attempts.at(-1);
              return (
                <button
                  key={detail.session.id}
                  type="button"
                  onClick={() => onResume(detail)}
                  className="doodle-row rounded-[2px] border border-dashed border-border bg-card px-3 py-3 text-left hover:border-accent hover:bg-highlight/10"
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate text-xs text-card-foreground">
                      {interviewOptionLabel(INTERVIEW_ROLES, detail.session.role)}
                    </strong>
                    <span className="text-[11px] text-muted">{detail.session.currentRound}/{detail.session.totalRounds}</span>
                  </span>
                  <span className="mt-1.5 block truncate text-xs text-muted">
                    {interviewOptionLabel(INTERVIEW_TOPICS, detail.session.topic)} · {latest ? strategyLabel(latest.nextStrategy) : '待作答'}
                  </span>
                  <span className="mt-2 flex items-center gap-1 text-[11px] text-muted">
                    <Clock3 aria-hidden="true" className="size-3" />
                    {new Date(detail.session.updatedAt).toLocaleDateString('zh-CN')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-start gap-4 min-[900px]:grid-cols-[10rem_minmax(0,1fr)]">
      <div>
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function strategyLabel(strategy: 'advance' | 'stay' | 'downgrade') {
  return strategy === 'advance' ? '提升难度' : strategy === 'downgrade' ? '回到前置知识' : '保持难度';
}
