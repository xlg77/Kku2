// localStorage 는 막혀 있을 수 있으므로 항상 try/catch
export const load = (key, fallback) => {
  try { const v = localStorage.getItem('kkutu:' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
};
export const save = (key, value) => {
  try { localStorage.setItem('kkutu:' + key, JSON.stringify(value)); } catch { /* ignore */ }
};
