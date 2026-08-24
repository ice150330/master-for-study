/**
 * 老师风格系统（产品设计蓝图 §5）。
 * 六种风格决定聊天的讲解方式：全局默认存 `workspace_settings.teacher_style`，
 * 会话内可临时切换（仅影响当前浏览会话，不落库、不写事件流）。
 */

export const TEACHER_STYLE_VALUES = [
  'socratic',
  'lecturer',
  'feynman',
  'practical',
  'companion',
  'strict',
] as const;

export type TeacherStyle = (typeof TEACHER_STYLE_VALUES)[number];

export const DEFAULT_TEACHER_STYLE: TeacherStyle = 'lecturer';

export const TEACHER_STYLES: Array<{ value: TeacherStyle; label: string; tagline: string }> = [
  { value: 'socratic', label: '苏格拉底', tagline: '反问引导，让你自己想通' },
  { value: 'lecturer', label: '讲师', tagline: '结构化讲授，由浅入深讲透' },
  { value: 'feynman', label: '费曼', tagline: '先听你复述，再指出漏洞' },
  { value: 'practical', label: '实战', tagline: '边写代码边讲，给最小可运行示例' },
  { value: 'companion', label: '陪伴', tagline: '耐心鼓励，小步前进' },
  { value: 'strict', label: '严师', tagline: '犀利追问，直指薄弱点' },
];

/** 各风格注入系统提示词的行为指令（追加在术语标注指令之后）。 */
const STYLE_DIRECTIVES: Record<TeacherStyle, string> = {
  socratic:
    '你现在以「苏格拉底式」老师身份回答：优先用由浅入深的反问引导用户自己推理，不直接给出最终答案；只有当用户明确要求直接给答案、或同一问题连续两次答错时，才给出结论并解释完整的推理链。',
  lecturer:
    '你现在以「讲师式」老师身份回答：结构化、由浅入深地把概念讲透，先给整体框架再展开细节，主动补充初学者容易忽略的边界与误区；直接给出完整清晰的解释。',
  feynman:
    '你现在以「费曼式」老师身份回答：先请用户用自己的话复述当前理解，再针对复述中的漏洞提问和纠偏；解释时坚持用最朴素的语言和生活化类比，发现表述含混就要求用户重新讲一遍。',
  practical:
    '你现在以「实战式」工程师老师身份回答：边写代码边讲，优先给出最小可运行示例（标注语言与运行方式），再逐段解释关键行；概念讲解服务于把示例跑通，避免脱离代码的抽象论述。',
  companion:
    '你现在以「陪伴式」老师身份回答：耐心、鼓励、照顾挫败情绪，把大目标拆成小步骤，每一步确认用户跟上了再继续；用户答错时先肯定思路中正确的部分，再温和地指出偏差。',
  strict:
    '你现在以「严师式」老师身份回答：标准严格、直指薄弱点，对模糊表述立即追问"精确定义是什么"，指出错误时明确说明错在哪、为什么错；不放过似是而非的回答，但在用户确实卡住时给出梯子式提示。',
};

export function isTeacherStyle(value: unknown): value is TeacherStyle {
  return typeof value === 'string' && (TEACHER_STYLE_VALUES as readonly string[]).includes(value);
}

/** 宽松取风格指令：未知值回退默认风格，保证调用方永远拿到可用指令。 */
export function teacherStyleDirective(style: string): string {
  return isTeacherStyle(style) ? STYLE_DIRECTIVES[style] : STYLE_DIRECTIVES[DEFAULT_TEACHER_STYLE];
}

/** 宽松取风格展示名：未知值回退默认风格标签。 */
export function teacherStyleLabel(style: string): string {
  const hit = TEACHER_STYLES.find((item) => item.value === style);
  return (hit ?? TEACHER_STYLES.find((item) => item.value === DEFAULT_TEACHER_STYLE))!.label;
}

/** 回答深浅（蓝图 §6 内容深浅）：一句话 / 详解 / 带代码。 */
export const ANSWER_DEPTH_VALUES = ['brief', 'standard', 'deep'] as const;

export type AnswerDepth = (typeof ANSWER_DEPTH_VALUES)[number];

export const DEFAULT_ANSWER_DEPTH: AnswerDepth = 'standard';

export const ANSWER_DEPTHS: Array<{ value: AnswerDepth; label: string }> = [
  { value: 'brief', label: '一句话' },
  { value: 'standard', label: '详解' },
  { value: 'deep', label: '带代码' },
];

const DEPTH_DIRECTIVES: Record<AnswerDepth, string> = {
  brief: '回答长度偏好「一句话」：先给一句直击要害的结论，仅在用户追问时再展开细节。',
  standard: '回答长度偏好「详解」：给出完整解释，配必要的例子，不刻意压缩也不冗长。',
  deep: '回答长度偏好「带代码」：在详解基础上附上可运行的代码示例（标注语言与运行方式），用代码落实概念。',
};

export function isAnswerDepth(value: unknown): value is AnswerDepth {
  return typeof value === 'string' && (ANSWER_DEPTH_VALUES as readonly string[]).includes(value);
}

/** 宽松取深浅指令：未知值回退默认。 */
export function answerDepthDirective(depth: string): string {
  return isAnswerDepth(depth) ? DEPTH_DIRECTIVES[depth] : DEPTH_DIRECTIVES[DEFAULT_ANSWER_DEPTH];
}

/**
 * 场景绑定（蓝图 §5 第 2 层）：把 6 型老师风格映射到面试模块自有的三型风格。
 * 严师→严格型；实战→简洁型；其余（苏格拉底/讲师/费曼/陪伴）→引导型。
 */
export type InterviewStyleOption = 'guided' | 'rigorous' | 'concise';

const INTERVIEW_STYLE_BY_TEACHER: Record<TeacherStyle, InterviewStyleOption> = {
  socratic: 'guided',
  lecturer: 'guided',
  feynman: 'guided',
  practical: 'concise',
  companion: 'guided',
  strict: 'rigorous',
};

export function interviewStyleFromTeacher(style: string): InterviewStyleOption {
  return isTeacherStyle(style) ? INTERVIEW_STYLE_BY_TEACHER[style] : 'guided';
}

/** 复习完成语按场景风格措辞（默认与未知风格用中性文案）。 */
export function reviewCompletionCopy(style: string): { title: string; note: string } {
  switch (isTeacherStyle(style) ? style : DEFAULT_TEACHER_STYLE) {
    case 'strict':
      return { title: '本轮复习完成', note: '别松劲——没记牢的概念会在最短间隔内回来。' };
    case 'companion':
      return { title: '今天的复习完成啦', note: '已经很棒了，剩下的交给时间与间隔。' };
    case 'feynman':
      return { title: '本轮复习完成', note: '能讲出来的才算记住——答不出的记得回去复述一遍。' };
    case 'socratic':
      return { title: '本轮复习完成', note: '今天的追问都问到点子上了吗？' };
    case 'practical':
      return { title: '本轮复习完成', note: '下次动手时试着用上今天复习的概念。' };
    default:
      return { title: '本轮复习完成', note: '今日到期内容已处理完。' };
  }
}
