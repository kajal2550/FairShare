import { useEffect, useState } from "react";
import { formatMoney } from "../lib/money.js";
import { dateValue, formatDate } from "../lib/format.js";

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ExpenseRow({ expense, memberMap, onDelete, onSaveAmount }) {
  const [draft, setDraft] = useState(String(expense.amount));
  const payer = memberMap[expense.paidBy] ?? memberMap[Number(expense.paidBy)];

  useEffect(() => {
    setDraft(String(expense.amount));
  }, [expense.amount]);

  const splitMeta =
    expense.splitType === "percent"
      ? `custom % split (${expense.splitWith?.length ?? 0} people)`
      : `split ${expense.splitWith?.length ?? 0} ways`;

  return (
    <article className="expense">
      <span className="avatar" style={{ background: payer?.color ?? "#888" }}>
        {payer ? initials(payer.name) : "?"}
      </span>
      <div>
        <div className="expense-title">
          {expense.description}
          <span className="cat">{expense.category}</span>
        </div>
        <div className="expense-meta">
          {payer?.name ?? "Unknown"} · {formatDate(expense.date)} · {splitMeta}
        </div>
        <div className="actions">
          <input
            className="edit-amount"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const n = Number(draft);
              if (Number.isFinite(n) && n > 0 && n !== Number(expense.amount)) {
                onSaveAmount(n);
              }
            }}
            aria-label={`Edit amount for ${expense.description}`}
          />
          <button type="button" className="btn danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <div className="amount">{formatMoney(expense.amount)}</div>
    </article>
  );
}

export default function ExpenseList({
  expenses,
  members,
  onDelete,
  onUpdate,
  onDeleteAt,
  onUpdateAt,
}) {
  const memberMap = Object.fromEntries(
    members.flatMap((m) => [
      [m.id, m],
      [String(m.id), m],
    ])
  );
  const sorted = [...expenses].sort((a, b) => dateValue(b.date) - dateValue(a.date));

  return (
    <section className="card">
      <h2>Expenses</h2>
      <p className="sort-label">Newest first</p>
      {sorted.length === 0 ? (
        <p className="empty">No expenses match these filters.</p>
      ) : (
        sorted.map((expense, index) => (
          <ExpenseRow
            key={expense.id ?? index}
            expense={expense}
            memberMap={memberMap}
            onDelete={() => (onDelete ? onDelete(expense.id) : onDeleteAt?.(index))}
            onSaveAmount={(amount) =>
              onUpdate ? onUpdate(expense.id, { amount }) : onUpdateAt?.(index, { amount })
            }
          />
        ))
      )}
    </section>
  );
}

