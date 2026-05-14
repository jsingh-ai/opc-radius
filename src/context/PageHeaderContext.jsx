import { createContext, useContext, useMemo, useState } from "react";

const defaultHeaderState = {
  eyebrow: "Production Overview",
  title: "Machine Status Command Center",
  detailLabel: "",
  detailValue: ""
};

const PageHeaderContext = createContext(null);

export function PageHeaderProvider({ children }) {
  const [headerState, setHeaderState] = useState(defaultHeaderState);

  const value = useMemo(
    () => ({
      headerState,
      setHeaderState,
      defaultHeaderState
    }),
    [headerState]
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeader() {
  const value = useContext(PageHeaderContext);

  if (!value) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider.");
  }

  return value;
}
