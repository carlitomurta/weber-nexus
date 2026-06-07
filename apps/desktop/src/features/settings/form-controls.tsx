import type { ReactNode } from "react";

export const inputCls =
  "w-full h-9 px-2.5 rounded bg-background border border-border text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
