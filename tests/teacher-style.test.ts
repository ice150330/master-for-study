import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEACHER_STYLE,
  TEACHER_STYLES,
  TEACHER_STYLE_VALUES,
  isTeacherStyle,
  teacherStyleDirective,
  teacherStyleLabel,
} from '../src/lib/ai/teacher-style';

describe('老师风格系统', () => {
  it('六种风格各自有非空且互不相同的指令与展示名', () => {
    const directives = new Set<string>();
    for (const style of TEACHER_STYLE_VALUES) {
      const directive = teacherStyleDirective(style);
      expect(directive.length).toBeGreaterThan(10);
      directives.add(directive);
      expect(teacherStyleLabel(style)).toBeTruthy();
    }
    expect(directives.size).toBe(TEACHER_STYLE_VALUES.length);
  });

  it('目录带展示名与标语，默认风格在目录中', () => {
    expect(TEACHER_STYLES).toHaveLength(6);
    expect(TEACHER_STYLES.map((item) => item.value)).toContain(DEFAULT_TEACHER_STYLE);
    for (const item of TEACHER_STYLES) {
      expect(item.tagline.length).toBeGreaterThan(4);
    }
  });

  it('未知风格宽松回退默认风格', () => {
    expect(isTeacherStyle('wizard')).toBe(false);
    expect(isTeacherStyle(null)).toBe(false);
    expect(teacherStyleDirective('wizard')).toBe(teacherStyleDirective(DEFAULT_TEACHER_STYLE));
    expect(teacherStyleLabel('wizard')).toBe(teacherStyleLabel(DEFAULT_TEACHER_STYLE));
    // 空串、历史脏值同样回退
    expect(teacherStyleDirective('')).toBe(teacherStyleDirective(DEFAULT_TEACHER_STYLE));
  });
});
