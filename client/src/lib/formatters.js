// Shared formatters and unit normalization for AgriTech

export const formatINR = (val) => {
  const num = Number(val) || 0;
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num)}`;
};

export const formatKg = (val) => {
  const num = Number(val) || 0;
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(num)} kg`;
};

export const normalizeYieldToKg = (quantity, unit = 'kg') => {
  const qty = Number(quantity) || 0;
  if (!unit) return qty;
  const u = String(unit).toLowerCase().trim();
  if (u === 'quintal' || u === 'quintals' || u === 'qtl') return Math.round(qty * 100 * 100) / 100;
  if (u === 'tonne' || u === 'tonnes' || u === 'ton' || u === 'tons' || u === 't' || u === 'mt') return Math.round(qty * 1000 * 100) / 100;
  if (u === 'g' || u === 'grams' || u === 'gram') return Math.round((qty / 1000) * 100) / 100;
  return Math.round(qty * 100) / 100; // default kg
};

export const formatDate = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

