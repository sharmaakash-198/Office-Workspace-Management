import { useCallback, useState } from 'react';

const DEFAULT_MAX_STEPS = 5;

function pushPastLimited<T>(past: T[], entry: T, maxSteps: number): T[] {
  const next = [...past, entry];
  return next.length > maxSteps ? next.slice(next.length - maxSteps) : next;
}

/**
 * Undo/redo stack capped at `maxSteps` past entries.
 * Use `set` for discrete edits, `replace` for live drag previews,
 * then `commitDrag(before)` on mouse-up to record one undo step.
 */
export function useHistory<T>(initial: T, maxSteps: number = DEFAULT_MAX_STEPS) {
  const [stack, setStack] = useState<{ past: T[]; present: T; future: T[] }>({
    past: [],
    present: initial,
    future: [],
  });

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStack((s) => {
        const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
        return {
          past: pushPastLimited(s.past, s.present, maxSteps),
          present: value,
          future: [],
        };
      });
    },
    [maxSteps],
  );

  const replace = useCallback((next: T | ((prev: T) => T)) => {
    setStack((s) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(s.present) : next;
      return { ...s, present: value };
    });
  }, []);

  /** After a drag that used `replace`, record `before` as the undo snapshot. */
  const commitDrag = useCallback(
    (before: T) => {
      setStack((s) => ({
        past: pushPastLimited(s.past, before, maxSteps),
        present: s.present,
        future: [],
      }));
    },
    [maxSteps],
  );

  const undo = useCallback(() => {
    setStack((s) => {
      if (s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future].slice(0, maxSteps),
      };
    });
  }, [maxSteps]);

  const redo = useCallback(() => {
    setStack((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        past: pushPastLimited(s.past, s.present, maxSteps),
        present: next,
        future: s.future.slice(1),
      };
    });
  }, [maxSteps]);

  const reset = useCallback((value: T) => {
    setStack({ past: [], present: value, future: [] });
  }, []);

  return {
    present: stack.present,
    set,
    replace,
    commitDrag,
    undo,
    redo,
    reset,
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
  };
}
