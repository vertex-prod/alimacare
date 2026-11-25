import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-gray-200">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr className={`transition-colors hover:bg-gray-50 ${className}`}>{children}</tr>
  );
}

export function TableHead({
  children,
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-sm text-gray-700 ${className}`} {...props}>
      {children}
    </td>
  );
}