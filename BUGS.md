# Bugs found

Add one section per issue. Bug 1 is filled in to show the format — fix it, then write what you changed. Copy the blank template for the rest.

Keep this file in the repo and **commit it** with your fixes.

---

## Bug 1

**How to reproduce:** Open the app. The expense list says “Newest first”. The first row is Wine (7 Mar). Board game (15 Mar) is further down.

**What is wrong:** The list is showing oldest expenses first. Newest should be at the top. Also, subtracting raw date objects or date strings in `.sort()` returned `NaN`.

**What I changed:** Updated the sort comparator in `src/components/ExpenseList.jsx` and `src/lib/format.js` to compute numeric millisecond timestamps via `dateValue(b.date) - dateValue(a.date)`, correctly sorting newest expenses first.

---

## Bug 2

**How to reproduce:** Open the app and observe the Balances panel on the right. Ben Okonkwo (who paid $276 and consumed $217, net +$59) is shown with red text as "owes $59.00". Aisha Khan (net -$85.01) is shown with green text as "is owed $85.00".

**What is wrong:** The labels and CSS classes in `src/components/BalancesPanel.jsx` were inverted. Positive balances (creditors) were shown as "owes" (red), while negative balances (debtors) were shown as "is owed" (green).

**What I changed:** Swapped the conditions in `src/components/BalancesPanel.jsx` so that `bal > 0.005` renders `is owed ${formatMoney(bal)}` with class `owed`, and `bal < -0.005` renders `owes ${formatMoney(-bal)}` with class `owe`.

---

## Bug 3

**How to reproduce:** Check the seed expense "Uber to airport" where Diya Patel paid $60 for Aisha and Ben. Look at the group total balance sum or Diya's balance.

**What is wrong:** `computeBalances` in `src/lib/balances.js` had a block that checked if `!(exp.paidBy in shares)` and subtracted `exp.amount / n` from the payer. This incorrectly penalized payers who booked or paid for expenses on behalf of others without participating in the consumption, violating the closed group conservation of money ($\sum \text{balances} \neq 0$).

**What I changed:** Removed the erroneous penalty block in `src/lib/balances.js` so payers always receive full credit for the amount paid, ensuring the closed group balance sum equals exactly $0.00.

---

## Bug 4

**How to reproduce:** Create a group or test scenario where one member owes $50 and another member is owed $50. View the "Settle up" panel.

**What is wrong:** In `src/lib/settle.js`, the `while` loop had an `else` branch for when debtor amount equals creditor amount (`d.amount === c.amount`) that merely incremented `i += 1; j += 1;` without pushing any transfer to `transfers`. As a result, exact matching debts were dropped and never settled.

**What I changed:** Fixed `src/lib/settle.js` to record the transfer for the matching amount before advancing the pointers.

---

## Bug 5

**How to reproduce:** Filter the expenses list (e.g. by category "Stay" or search "Airbnb"), or leave the list sorted, then click "Delete" on an expense or edit its amount.

**What is wrong:** `ExpenseList.jsx` passed the filtered/sorted array index to `onDeleteAt(index)` and `onUpdateAt(index, patch)`. The reducer in `src/state/store.js` spliced/mutated `state.expenses[action.index]` at that index in the original unfiltered array, deleting or editing the wrong expense.

**What I changed:** Updated `src/App.jsx`, `src/state/store.js`, and `src/components/ExpenseList.jsx` to identify expenses by `id` rather than array index for both `DELETE_EXPENSE` and `UPDATE_EXPENSE` actions, and keyed `ExpenseRow` by `expense.id`.

---

## Bug 6

**How to reproduce:** In the Filter card, select any person from the "Paid by" dropdown (e.g., "Aisha Khan").

**What is wrong:** The expenses list becomes completely empty. The `<select>` element returns a string ID (e.g., `"1"`), whereas `e.paidBy` is stored as a number (`1`). The filter used strict inequality `e.paidBy !== paidBy` which evaluated to `true`, filtering out every expense.

**What I changed:** Updated the filter check in `src/App.jsx` to `String(e.paidBy) !== String(paidBy)` to handle string and number IDs consistently.

---

## Bug 7

**How to reproduce:** Add an expense or refresh the page so data is loaded from `localStorage`. Check the expense date display.

**What is wrong:** `loadState` in `src/state/store.js` returned `JSON.parse(raw)` directly on reloads without converting ISO date strings back into `Date` objects. Furthermore, `formatDate` in `src/lib/format.js` returned raw ISO slices when given strings and suffered from timezone offset day-shifting.

**What I changed:** Updated `loadState` to run `hydrate(JSON.parse(raw))` so date objects are always properly initialized, and updated `formatDate` and `dateValue` in `src/lib/format.js` to parse date strings without timezone shifts.

---

## Bug 8

**How to reproduce:** Split $100 equally between 3 people. Each person was assigned $33.33, totaling $99.99, losing $0.01 from the group balance. Similarly, custom percentage splits could invent or lose cents.

**What is wrong:** `splitEqual` and `splitByPercent` in `src/lib/money.js` calculated each participant's share with independent `toFixed(2)` rounding, without distributing remainder cents.

**What I changed:** Updated `splitEqual` and `splitByPercent` in `src/lib/money.js` to calculate shares in integer cents and distribute remainder cents among participants, guaranteeing that the sum of individual shares always matches the total expense amount to the exact cent.

---

## Bug 9

**How to reproduce:** Add a custom percentage expense with 3 people set to 33.33%, 33.33%, and 33.34%. Click "Save expense".

**What is wrong:** An error "Percentages must add to 100" is shown. In JavaScript floating point arithmetic, `33.33 + 33.33 + 33.34 === 100.00000000000001`, which failed the strict `=== 100` equality check in `percentsSumTo100`.

**What I changed:** Updated `percentsSumTo100` in `src/lib/money.js` to compare `Math.round(sum * 100) === 10000` to properly accommodate floating point precision while rejecting genuine non-100 sums.

---

## Bug 10

**How to reproduce:** Add a new member (e.g. "Maya") using the "Add member" form in the Summary card.

**What is wrong:** The "Paid so far" list in the Summary card did not show the new member until a new expense was added or the page was refreshed.

**What I changed:** Added `members` to the `useMemo` dependency array for `perPerson` in `src/components/SummaryCards.jsx`.

---

## Bug 11

**How to reproduce:** Enter a description and amount in "Add expense" and click "Save expense".

**What is wrong:** The form inputs remained populated with the previous values instead of clearing.

**What I changed:** Added reset calls for `description`, `amount`, and `error` in `src/components/AddExpenseForm.jsx` upon successful submission.

---

