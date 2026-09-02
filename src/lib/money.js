export function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function splitEqual(amount, ids) {
  if (!ids || ids.length === 0) return {};
  const totalCents = Math.round(Number(amount) * 100);
  const n = ids.length;
  const baseCents = Math.floor(totalCents / n);
  const remainder = totalCents - baseCents * n;

  const shares = {};
  ids.forEach((id, index) => {
    const cents = index < remainder ? baseCents + 1 : baseCents;
    shares[id] = cents / 100;
  });
  return shares;
}

export function percentsSumTo100(percents) {
  const values = Object.values(percents).map(Number);
  if (values.length === 0) return false;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum * 100) === 10000;
}


export function splitByPercent(amount, percents) {
  const entries = Object.entries(percents);
  if (entries.length === 0) return {};
  const totalCents = Math.round(Number(amount) * 100);

  const shares = {};
  let allocatedCents = 0;

  entries.forEach(([id, pct], index) => {
    if (index === entries.length - 1) {
      shares[id] = (totalCents - allocatedCents) / 100;
    } else {
      const shareCents = Math.round((totalCents * Number(pct)) / 100);
      allocatedCents += shareCents;
      shares[id] = shareCents / 100;
    }
  });

  return shares;
}

export function sharesForExpense(expense) {
  if (expense.splitType === "percent" && expense.percents) {
    return splitByPercent(expense.amount, expense.percents);
  }
  return splitEqual(expense.amount, expense.splitWith);
}

