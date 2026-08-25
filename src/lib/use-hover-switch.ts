import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** 悬停开关延迟：进入 180ms 防误触，离开 240ms 留出移进面板的宽限（与树气泡 / 会话操作菜单同源） */
const HOVER_OPEN_MS = 180;
const HOVER_CLOSE_MS = 240;

/**
 * 悬停开关：鼠标悬停 180ms 开、移开 240ms 关（移进面板调用 hoverStay 取消关闭）。
 * 悬停只对 pointerType=mouse 生效，触摸设备保持点击开关避免点按竞态。
 * 不传 open/onOpenChange 时自持状态；传入即为受控（如「+N」胶带与树气泡共用 open 的场景）。
 */
export function useHoverSwitch(controlled?: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlled?.open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? (controlled?.open ?? false) : internalOpen;
  const openTimer = useRef(0);
  const closeTimer = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) controlled?.onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [controlled, isControlled],
  );

  const hoverOpen = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      window.clearTimeout(closeTimer.current);
      openTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS);
    },
    [setOpen],
  );

  const hoverClose = useCallback(
    (event?: ReactPointerEvent) => {
      if (event && event.pointerType !== 'mouse') return;
      window.clearTimeout(openTimer.current);
      closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
    },
    [setOpen],
  );

  const hoverStay = useCallback(() => {
    window.clearTimeout(closeTimer.current);
  }, []);

  return { open, setOpen, hoverOpen, hoverClose, hoverStay };
}
