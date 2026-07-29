import { Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

interface DataTableRow {
  key: string;
  cells: ReactNode[];
  onClick?: () => void;
  testId?: string;
}

export function LoadingBlock() {
  return (
    <div className="state-panel">
      <Loader2 className="spin" size={22} />
      <span>Đang tải dữ liệu...</span>
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="state-panel danger">
      <XCircle size={22} />
      <span>{message}</span>
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: DataTableRow[] }) {
  if (rows.length === 0) {
    return <p className="empty-text">Chưa có dữ liệu.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid={row.testId} onClick={row.onClick}>
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${columns[index]}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mobile-cards">
        {rows.map((row) => (
          <button
            key={row.key}
            className="mobile-card"
            data-testid={row.testId ? `${row.testId}-mobile` : undefined}
            type="button"
            onClick={row.onClick}
          >
            {row.cells.map((cell, index) => (
              <span key={`${row.key}-mobile-${columns[index]}`}>
                <small>{columns[index]}</small>
                <b>{cell}</b>
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiCheck({
  label,
  items,
  value,
  onChange
}: {
  label: string;
  items: Record<string, any>[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="multi-check">
      <span>{label}</span>
      <div>
        {items.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(event) => {
                onChange(event.target.checked ? [...value, item.id] : value.filter((id) => id !== item.id));
              }}
            />
            {item.fullName ?? item.name}
          </label>
        ))}
      </div>
    </div>
  );
}
