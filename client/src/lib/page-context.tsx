import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

export interface PageContext {
  currentPage: string;
  activeFilters: Record<string, any>;
  selectedEntity: string | null;
}

const defaultCtx: PageContext = {
  currentPage: "/",
  activeFilters: {},
  selectedEntity: null,
};

interface PageContextState {
  ctx: PageContext;
  setCtx: (patch: Partial<PageContext>) => void;
}

const Ctx = createContext<PageContextState>({
  ctx: defaultCtx,
  setCtx: () => {},
});

export function PageContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtxState] = useState<PageContext>(defaultCtx);
  const value = useMemo(
    () => ({
      ctx,
      setCtx: (patch: Partial<PageContext>) => setCtxState((prev) => ({ ...prev, ...patch })),
    }),
    [ctx]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageContext() {
  return useContext(Ctx);
}
