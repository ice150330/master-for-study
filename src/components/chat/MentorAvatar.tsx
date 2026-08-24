/**
 * AI 老师头像：戴学士帽的手绘小机器人（呼应壳层 GraduationCap 与「本地 AI 学习老师」）。
 * 纯内联 SVG，颜色全部走主题令牌（var(--card) / var(--foreground) / marker 三色），
 * 四种纸张主题下自动适配；硬边纸影用 0 模糊 drop-shadow 保留手绘错位感。
 * 渲染在 AI 消息气泡正上方靠左，气泡左上的折角尾巴指向它。
 */
export function MentorAvatar({
  className = 'size-6',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 44"
      aria-hidden="true"
      className={className}
      style={{ filter: 'drop-shadow(2px 2px 0 rgba(78, 205, 196, 0.42))' }}
    >
      {/* 天线：黄色 marker 圆点 + 墨线杆 */}
      <line x1="20" y1="7" x2="20" y2="10.5" stroke="var(--foreground)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="20" cy="4.6" r="2.5" fill="var(--marker-yellow)" stroke="var(--foreground)" strokeWidth="1.4" />

      {/* 学士帽：菱形帽面 + 流苏 */}
      <path
        d="M7.5 15.5 L20 10 L32.5 15.5 L20 21 Z"
        fill="var(--card)"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14 18.2 v3.2 q6 2.6 12 0 v-3.2"
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <line x1="32.5" y1="15.5" x2="34" y2="21.5" stroke="var(--foreground)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="34" cy="22.3" r="1.5" fill="var(--marker-red)" stroke="var(--foreground)" strokeWidth="1" />

      {/* 机器人头：圆角方脸 + 两侧螺栓 */}
      <rect x="6" y="26.5" width="4" height="6" rx="1.5" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.4" />
      <rect x="30" y="26.5" width="4" height="6" rx="1.5" fill="var(--card)" stroke="var(--foreground)" strokeWidth="1.4" />
      <rect
        x="9"
        y="23"
        width="22"
        height="16.5"
        rx="3.5"
        fill="var(--card)"
        stroke="var(--foreground)"
        strokeWidth="1.5"
      />

      {/* 表情：圆眼 + 腮红 + 微笑 */}
      <circle cx="16.2" cy="30" r="1.9" fill="var(--foreground)" />
      <circle cx="23.8" cy="30" r="1.9" fill="var(--foreground)" />
      <circle cx="12.8" cy="32.6" r="1.6" fill="var(--marker-red)" opacity="0.45" />
      <circle cx="27.2" cy="32.6" r="1.6" fill="var(--marker-red)" opacity="0.45" />
      <path
        d="M17.9 33 Q20 34.8 22.1 33"
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
