function toISODate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function fromISODate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function dateDiffInDays(fromDate, toDate) {
  const from = fromISODate(fromDate);
  const to = fromISODate(toDate);
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / 86400000);
}

function subtractDays(isoDate, days) {
  const date = fromISODate(isoDate);
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return toISODate(date);
}

module.exports = {
  toISODate,
  dateDiffInDays,
  subtractDays
};
