export function formatDate(date) {
  let d = date;
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    } else {
      d = new Date(date);
    }
  }
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return String(date);
}

export function dateValue(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.getTime();
  }
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
    }
    const parsed = new Date(date).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

