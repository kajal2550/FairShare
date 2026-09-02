export function suggestSettlements(balances, members) {
  const nameOf = (id) => members.find((m) => Number(m.id) === Number(id))?.name ?? `#${id}`;

  const debtors = [];
  const creditors = [];

  for (const [id, raw] of Object.entries(balances)) {
    const amount = Number(raw);
    const memberId = Number(id);
    if (amount < -0.005) {
      debtors.push({ id: memberId, amount: Math.round(-amount * 100) / 100 });
    } else if (amount > 0.005) {
      creditors.push({ id: memberId, amount: Math.round(amount * 100) / 100 });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];

    const settleAmount = Math.round(Math.min(d.amount, c.amount) * 100) / 100;
    if (settleAmount > 0) {
      transfers.push({
        from: d.id,
        to: c.id,
        fromName: nameOf(d.id),
        toName: nameOf(c.id),
        amount: settleAmount,
      });
    }

    d.amount = Math.round((d.amount - settleAmount) * 100) / 100;
    c.amount = Math.round((c.amount - settleAmount) * 100) / 100;

    if (d.amount <= 0.005) i += 1;
    if (c.amount <= 0.005) j += 1;
  }

  return transfers;
}

