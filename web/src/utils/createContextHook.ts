import {
  createContext,
  useContext,
  createElement,
  type ReactNode,
  type FunctionComponent,
} from "react";

/**
 * Creates a React context from a custom hook.
 * Returns a tuple `[Provider, useHook]` where:
 * - `Provider` is a component that wraps children with the context value.
 * - `useHook` is a hook that returns the current context value.
 *
 * The `useHook` will throw if called outside of a `<Provider>`.
 */
export default function createContextHook<T>(
  hook: () => T,
  displayName?: string,
): [FunctionComponent<{ children: ReactNode }>, () => T] {
  const Ctx = createContext<T | null>(null);
  if (displayName) {
    Ctx.displayName = displayName;
  }

  function Provider({ children }: { children: ReactNode }) {
    const value = hook();
    return createElement(Ctx.Provider, { value }, children);
  }

  function useHook(): T {
    const value = useContext(Ctx);
    if (value === null) {
      throw new Error(
        `${displayName || "useHook"} must be used within its Provider`,
      );
    }
    return value;
  }

  return [Provider, useHook];
}
