'use strict';
window.AF_SCRIPTS_LOADED = true;
/* =========================================================
   Asrori Fam's — frontend SPA (vanilla JS)
   ========================================================= */

/* ---------- state ---------- */
const S = {
  data: null, token: null, role: null, view: 'home', params: {}, stack: [],
  tree: { rootId: null, scale: 1, x: 0, y: 0, collapsed: new Set(), q: '', showSpouse: true },
  anggota: { q: '', f: 'semua' },
  kas: { jenis: '', bulan: '' },
  lap: { tab: 'arus', from: '', to: '', jenis: '', kategori: '', year: null },
  dash: { year: null },
  galeri: { album: '' },
  agenda: { tab: 'mendatang' },
  cari: { q: '' },
  berita: { tab: 'terbit', kat: '' },
  map: null
};
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BLN = BULAN.map(b => b.slice(0, 3));
const GEN_LABELS = ['Perintis / Kepala', 'Anak', 'Cucu', 'Cicit', 'Canggah', 'Wareng'];
const MAX_GEN = GEN_LABELS.length;
function genLabel(n) { return GEN_LABELS[n - 1] || ('Generasi ' + n); }
function genText(n) { return 'Gen ' + n + ' · ' + genLabel(n); }
function parseGen(v) { const m = /\d+/.exec(String(v || '')); return m ? Number(m[0]) : 0; }
const PALETTE = ['#2f6fed','#22c55e','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#ef4444','#64748b','#0ea5e9','#a3a3a3'];

/* ---------- storage aman ---------- */
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} }
};

/* ---------- API ---------- */
function api(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  return new Promise((resolve, reject) => {
    const done = r => (r && r.ok) ? resolve(r.data) : reject((r && r.error) || { message: 'Tidak ada respons dari server.' });
    if (window.__MOCK__) { window.__MOCK__(fn, args).then(done, reject); return; }
    const onFail = function () {
      reject({ code: 'NETWORK', message: 'Koneksi ke server gagal. Periksa internet lalu coba lagi.' });
    };
    const runner = google.script.run.withSuccessHandler(done).withFailureHandler(onFail);
    if (typeof runner[fn] !== 'function') {
      reject({ code: 'NOT_FOUND', message: 'Fungsi server ' + fn + ' tidak ditemukan. Periksa file Services.gs.' });
      return;
    }
    runner[fn].apply(runner, args);
  });
}

/* ---------- utilitas ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const nf = new Intl.NumberFormat('id-ID');
function rp(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-Rp' : 'Rp') + nf.format(Math.abs(n)); }
function rpShort(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + (a / 1e9).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1e6) return s + (a / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'rb';
  return s + a;
}
function todayStr() { return (S.data && S.data.today) || new Date().toISOString().slice(0, 10); }
function ym(d) { return String(d || '').slice(0, 7); }
function fmtDate(d, withDay) {
  if (!d) return '–';
  const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
  if (!y || !m) return esc(d);
  const s = (dd ? dd + ' ' : '') + BLN[m - 1] + ' ' + y;
  if (!withDay || !dd) return s;
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date(y, m - 1, dd).getDay()];
  return hari + ', ' + s;
}
function fmtMonth(p) { const [y, m] = String(p).split('-').map(Number); return BULAN[m - 1] + ' ' + y; }
function addMonths(p, n) { let [y, m] = p.split('-').map(Number); m += n; while (m < 1) { m += 12; y -= 1; } while (m > 12) { m -= 12; y++; } return y + '-' + String(m).padStart(2, '0'); }
function age(a) {
  if (!a.tgl_lahir) return '';
  const end = a.tgl_wafat || todayStr();
  const [y1, m1, d1] = a.tgl_lahir.split('-').map(Number), [y2, m2, d2] = end.split('-').map(Number);
  let y = y2 - y1; if (m2 < m1 || (m2 === m1 && d2 < d1)) y -= 1;
  return y >= 0 ? y : '';
}
function initials(n) { const w = String(n || '?').replace(/^(h\.|hj\.|dr\.|ir\.)\s*/i, '').replace(/\(.*?\)/g, '').split(/\s+/).map(x => x.replace(/[^A-Za-zÀ-ÿ]/g, '')).filter(Boolean); return (w.slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase(); }
function isAdmin() { return S.role === 'admin'; }
function isActive(a) { return String(a.is_active).toUpperCase() !== 'FALSE'; }
function wajib(a) { return String(a.wajib_iuran).toUpperCase() === 'TRUE'; }
function alive(a) { return !a.tgl_wafat; }
function spouseIds(a) { return String(a && a.pasangan_id || '').split(',').map(s => s.trim()).filter(Boolean); }
function avatar(a, cls = '') {
  if (!a) return `<span class="avatar av-L ${cls}">?</span>`;
  const img = a.foto_url ? `<img src="${esc(a.foto_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(initials(a.nama));
  return `<span class="avatar av-${a.jenis_kelamin === 'P' ? 'P' : 'L'} ${cls}">${img}</span>`;
}
function years(a) {
  const y1 = a.tgl_lahir ? a.tgl_lahir.slice(0, 4) : '';
  if (a.tgl_wafat) return (y1 || '?') + ' – ' + a.tgl_wafat.slice(0, 4);
  return y1 ? 'Lahir ' + y1 + (age(a) !== '' ? ' · ' + age(a) + ' th' : '') : '';
}

/* ---------- indeks & turunan data ---------- */
let IX = null;
function index() {
  if (IX) return IX;
  const byId = {}, kids = {};
  S.data.anggota.forEach(a => { byId[a.id] = a; });
  S.data.anggota.forEach(a => [a.ayah_id, a.ibu_id].forEach(p => { if (p && byId[p]) (kids[p] = kids[p] || []).push(a.id); }));
  Object.values(kids).forEach(list => list.sort((x, y) => String(byId[x].tgl_lahir || '9999').localeCompare(String(byId[y].tgl_lahir || '9999'))));
  const gen = {};
  const g = (id, guard = 0) => {
    if (gen[id]) return gen[id];
    if (guard > 60) return 1;
    const a = byId[id]; let v = 1;
    const parents = [a.ayah_id, a.ibu_id].filter(p => byId[p]);
    if (parents.length) v = Math.max.apply(null, parents.map(p => g(p, guard + 1))) + 1;
    else if (parseGen(a.generasi)) v = parseGen(a.generasi);
    else { const sp = spouseIds(a).find(s => byId[s] && (byId[s].ayah_id || byId[s].ibu_id || parseGen(byId[s].generasi))); if (sp) v = g(sp, guard + 1); }
    return (gen[id] = v);
  };
  S.data.anggota.forEach(a => g(a.id));
  IX = { byId, kids, gen };
  return IX;
}
function invalidate() { IX = null; }
function nameOf(id) { const a = index().byId[id]; return a ? a.nama : ''; }
function descendants(id) { const ix = index(), seen = new Set(), st = (ix.kids[id] || []).slice(); while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); Array.prototype.push.apply(st, ix.kids[x] || []); } return seen; }
function topAncestor(id) {
  const ix = index(); let cur = id, guard = 0;
  while (guard++ < 60) {
    const a = ix.byId[cur]; if (!a) break;
    const next = (ix.byId[a.ayah_id] && a.ayah_id) || (ix.byId[a.ibu_id] && a.ibu_id);
    if (!next) {
      const sp = spouseIds(a).find(s => ix.byId[s] && (ix.byId[s].ayah_id || ix.byId[s].ibu_id));
      if (sp && guard < 3) { cur = sp; continue; }
      break;
    }
    cur = next;
  }
  return cur;
}
function lineage(id) {
  const ix = index(), path = [id]; let cur = id, guard = 0;
  while (guard++ < 60) { const a = ix.byId[cur]; const next = a && ((ix.byId[a.ayah_id] && a.ayah_id) || (ix.byId[a.ibu_id] && a.ibu_id)); if (!next) break; path.unshift(next); cur = next; }
  return path;
}
function rootCandidates() {
  const ix = index(), seen = new Set(), out = [];
  S.data.anggota.filter(a => !ix.byId[a.ayah_id] && !ix.byId[a.ibu_id]).forEach(a => {
    if (seen.has(a.id)) return;
    const sp = spouseIds(a).filter(s => ix.byId[s]);
    // pasangan yang punya orang tua di database = menantu, bukan akar
    if (sp.some(s => ix.byId[s].ayah_id || ix.byId[s].ibu_id)) return;
    sp.forEach(s => seen.add(s)); seen.add(a.id);
    const group = [a].concat(sp.map(s => ix.byId[s]));
    const lead = group.find(x => x.jenis_kelamin === 'L' && (ix.kids[x.id] || []).length) || group[0];
    out.push({ id: lead.id, count: descendants(lead.id).size });
  });
  return out.sort((x, y) => y.count - x.count);
}
function saldoUntil(dateExcl) {
  const st = S.data.settings, s0 = Number(st.saldo_awal) || 0;
  return S.data.kas.reduce((t, k) => (!dateExcl || k.tanggal < dateExcl) ? t + (k.jenis === 'Masuk' ? k.jumlah : -k.jumlah) : t, s0);
}
function sumKas(filter) { return S.data.kas.filter(filter).reduce((t, k) => t + k.jumlah, 0); }
function iuranStatus(periode) {
  const kat = S.data.settings.kategori_iuran || 'Iuran Bulanan';
  const list = S.data.anggota.filter(a => wajib(a) && alive(a));
  const paid = {};
  S.data.kas.forEach(k => { if (k.jenis === 'Masuk' && k.kategori === kat && k.periode === periode && k.anggota_id) paid[k.anggota_id] = (paid[k.anggota_id] || 0) + k.jumlah; });
  const lunas = list.filter(a => paid[a.id]);
  return { list, paid, lunas, belum: list.filter(a => !paid[a.id]), pct: list.length ? Math.round(lunas.length / list.length * 100) : 0 };
}
function upcomingAgenda(days) {
  const t = todayStr(); const lim = new Date(t); lim.setDate(lim.getDate() + days); const l = lim.toISOString().slice(0, 10);
  return S.data.agenda.filter(a => a.tanggal >= t && a.tanggal <= l).sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
}
function birthdaysThisMonth() {
  const m = todayStr().slice(5, 7);
  return S.data.anggota.filter(a => alive(a) && a.tgl_lahir && a.tgl_lahir.slice(5, 7) === m).sort((a, b) => a.tgl_lahir.slice(8).localeCompare(b.tgl_lahir.slice(8)));
}

/* ---------- ikon menu (SVG mengilap seperti referensi) ---------- */
const ICON = {
  keluarga: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ik1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient><linearGradient id="ik2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd66b"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><circle cx="17" cy="13" r="7" fill="url(#ik1)"/><path d="M4 38c0-8 6-14 13-14s13 6 13 14z" fill="url(#ik1)"/><circle cx="33" cy="18" r="6" fill="url(#ik2)"/><path d="M22 40c0-7 5-12 11-12s11 5 11 12z" fill="url(#ik2)"/><ellipse cx="15" cy="10" rx="3" ry="1.6" fill="#fff" opacity=".5"/></svg>`,
  pohon: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ip1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7a0"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs><rect x="21" y="26" width="6" height="18" rx="2" fill="#8b5a2b"/><path d="M24 34l-8-6M24 31l8-6" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="15" r="11" fill="url(#ip1)"/><circle cx="12" cy="22" r="7" fill="url(#ip1)"/><circle cx="36" cy="22" r="7" fill="url(#ip1)"/><circle cx="24" cy="12" r="3.4" fill="#fde68a"/><circle cx="13" cy="21" r="2.8" fill="#fca5a5"/><circle cx="35" cy="21" r="2.8" fill="#93c5fd"/><ellipse cx="20" cy="8" rx="4" ry="2" fill="#fff" opacity=".45"/></svg>`,
  galeri: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ig1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient></defs><rect x="9" y="6" width="32" height="26" rx="5" fill="#bfd4fb" transform="rotate(8 25 19)"/><rect x="5" y="12" width="34" height="28" rx="5" fill="url(#ig1)"/><rect x="9" y="16" width="26" height="20" rx="3" fill="#e8f0ff"/><circle cx="29" cy="21" r="3" fill="#fbbf24"/><path d="M9 34l8-9 6 6 4-4 8 8v1H9z" fill="#22c55e"/></svg>`,
  peta: `<svg viewBox="0 0 48 48"><defs><linearGradient id="im1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a7a"/><stop offset="1" stop-color="#e5372a"/></linearGradient></defs><path d="M4 16l12-5 16 5 12-5v26l-12 5-16-5-12 5z" fill="#dbe7fb" stroke="#7a8aa3" stroke-width="2" stroke-linejoin="round"/><path d="M16 11v26M32 16v26" stroke="#b6c3d8" stroke-width="2"/><path d="M8 30l7-4 6 5 8-6 11 5" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/><path d="M24 4c-6 0-10 4.5-10 10 0 7 10 17 10 17s10-10 10-17c0-5.5-4-10-10-10z" fill="url(#im1)"/><circle cx="24" cy="14" r="4" fill="#fff"/></svg>`,
  kas: `<svg viewBox="0 0 48 48"><defs><linearGradient id="iw1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient><linearGradient id="iw2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs><rect x="6" y="9" width="28" height="10" rx="3" fill="#93c5fd" transform="rotate(-10 20 14)"/><rect x="4" y="15" width="36" height="25" rx="6" fill="url(#iw1)"/><rect x="28" y="23" width="14" height="10" rx="4" fill="#1e3a8a"/><circle cx="33" cy="28" r="2" fill="#fff"/><circle cx="38" cy="11" r="7" fill="url(#iw2)"/><text x="38" y="14.5" font-size="9" text-anchor="middle" fill="#92400e" font-weight="800">Rp</text></svg>`,
  laporan: `<svg viewBox="0 0 48 48"><defs><linearGradient id="il1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0a776"/><stop offset="1" stop-color="#9a5b2c"/></linearGradient></defs><rect x="8" y="7" width="32" height="38" rx="5" fill="url(#il1)"/><rect x="12" y="12" width="24" height="30" rx="2" fill="#fff"/><rect x="17" y="4" width="14" height="7" rx="3" fill="#475569"/><path d="M16 20h12M16 25h16M16 30h10M16 35h14" stroke="#94a3b8" stroke-width="2.4" stroke-linecap="round"/><circle cx="35" cy="11" r="6" fill="#22c55e"/><path d="M32.3 11.2l1.8 1.8 3.6-3.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  dashboard: `<svg viewBox="0 0 48 48"><rect x="4" y="5" width="40" height="38" rx="8" fill="#fff"/><rect x="9" y="10" width="13" height="13" rx="3" fill="#2459d6"/><rect x="26" y="10" width="13" height="13" rx="3" fill="#fbbf24"/><rect x="9" y="27" width="13" height="11" rx="3" fill="#1e3a6e"/><rect x="26" y="27" width="13" height="11" rx="3" fill="#93c5fd"/></svg>`,
  agenda: `<svg viewBox="0 0 48 48"><defs><linearGradient id="ia1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient></defs><rect x="5" y="8" width="38" height="35" rx="7" fill="#fff" stroke="#c7d6ef" stroke-width="1.5"/><path d="M5 15a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v3H5z" fill="url(#ia1)"/><rect x="13" y="3" width="4" height="10" rx="2" fill="#1e3a6e"/><rect x="31" y="3" width="4" height="10" rx="2" fill="#1e3a6e"/><g fill="#fbbf24"><rect x="10" y="22" width="7" height="6" rx="1.5"/><rect x="20.5" y="22" width="7" height="6" rx="1.5"/><rect x="31" y="22" width="7" height="6" rx="1.5" fill="#93c5fd"/><rect x="10" y="31" width="7" height="6" rx="1.5" fill="#93c5fd"/><rect x="20.5" y="31" width="7" height="6" rx="1.5"/><rect x="31" y="31" width="7" height="6" rx="1.5"/></g></svg>`
};
ICON.berita = `<svg viewBox="0 0 48 48"><defs><linearGradient id="ib1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient></defs><rect x="4" y="9" width="34" height="32" rx="6" fill="url(#ib1)"/><rect x="34" y="15" width="10" height="26" rx="4" fill="#1e3a8a"/><rect x="9" y="14" width="14" height="11" rx="2" fill="#fbbf24"/><path d="M27 15h6M27 20h6M9 30h24M9 35h18" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="40" cy="9" r="6" fill="#ef4444"/><path d="M40 6v4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="40" cy="12.4" r="1.2" fill="#fff"/></svg>`;
ICON.ultah = `<svg viewBox="0 0 48 48"><rect x="7" y="24" width="34" height="18" rx="5" fill="#ec4899"/><rect x="7" y="24" width="34" height="6" rx="3" fill="#fbcfe8"/><path d="M7 33c4 3 8 3 11 0s8-3 11 0 8 3 12 0" fill="none" stroke="#fff" stroke-width="2"/><rect x="14" y="14" width="4" height="10" rx="2" fill="#2f6fed"/><rect x="22" y="12" width="4" height="12" rx="2" fill="#22c55e"/><rect x="30" y="14" width="4" height="10" rx="2" fill="#f59e0b"/><path d="M16 9c2 2 0 4 0 4s-2-2 0-4zM24 6c2 2 0 4 0 4s-2-2 0-4zM32 9c2 2 0 4 0 4s-2-2 0-4z" fill="#f97316"/></svg>`;
ICON.cari = `<svg viewBox="0 0 48 48"><defs><linearGradient id="ic1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient></defs><circle cx="21" cy="21" r="13" fill="#e0ecff" stroke="url(#ic1)" stroke-width="6"/><path d="M31 31l10 10" stroke="#1e3a6e" stroke-width="7" stroke-linecap="round"/><ellipse cx="17" cy="16" rx="4" ry="2.4" fill="#fff"/></svg>`;
ICON.akun = `<svg viewBox="0 0 48 48"><defs><linearGradient id="iu1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb2ff"/><stop offset="1" stop-color="#2459d6"/></linearGradient></defs><circle cx="20" cy="15" r="9" fill="url(#iu1)"/><path d="M3 42c0-10 8-16 17-16s17 6 17 16z" fill="url(#iu1)"/><circle cx="37" cy="34" r="9" fill="#475569"/><circle cx="37" cy="34" r="3.5" fill="#fff"/><path d="M37 23v3M37 42v3M26 34h3M45 34h3" stroke="#475569" stroke-width="3" stroke-linecap="round"/></svg>`;
const BELL = '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3.5a1.5 1.5 0 0 0-3 0v.7A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';
const SEARCH_IC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';

/* ---------- toast & sheet ---------- */
let toastT;
function toast(msg, type) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast ' + (type || ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
}
function openSheet(title, html, onMount) {
  $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html; $('#sheet').hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount($('#sheet-body'));
  const first = $('#sheet-body input:not([type=hidden]),#sheet-body select,#sheet-body button'); if (first && window.innerWidth > 700) first.focus();
}
function closeSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; document.body.style.overflow = ''; }
function confirmSheet(title, msg, okLabel) {
  return new Promise(res => {
    openSheet(title, `<p style="margin:4px 0 16px;color:#334155;font-size:14px">${esc(msg)}</p>
      <div class="btn-row"><button class="btn ghost" data-c="0">Batal</button><button class="btn danger" data-c="1">${esc(okLabel || 'Hapus')}</button></div>`,
    body => $$('[data-c]', body).forEach(b => b.onclick = () => { closeSheet(); res(b.dataset.c === '1'); }));
  });
}
function busy(btn, on) { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = 'Menyimpan…'; btn.disabled = true; } else { btn.innerHTML = btn.dataset.l || btn.innerHTML; btn.disabled = false; } }
function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); $$('input[type=checkbox]', form).forEach(c => { o[c.name] = c.checked; }); return o; }
function showErr(form, msg) { let e = $('.form-err', form); if (!e) { e = document.createElement('p'); e.className = 'field err form-err'; form.prepend(e); } e.textContent = msg; e.scrollIntoView({ block: 'nearest' }); }

/* ---------- navigasi ---------- */
function go(view, params = {}, push = true) {
  if (push && S.view !== view) S.stack.push({ view: S.view, params: S.params });
  if (S.stack.length > 30) S.stack.shift();
  S.view = view; S.params = params;
  render(); window.scrollTo(0, 0);
}
function back() { const p = S.stack.pop(); if (p) go(p.view, p.params, false); else go('home', {}, false); }

function subhead(title, opts = {}) {
  return `<header class="subhead"><div class="subhead-row">
    <button class="icon-btn" data-action="back" aria-label="Kembali">←</button>
    <h1>${esc(title)}</h1>${opts.action || ''}</div>${opts.extra || ''}</header>`;
}
function addBtn(action, label) { return isAdmin() ? `<button class="icon-btn" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">＋</button>` : ''; }

/* ---------- render utama ---------- */
const VIEWS = {};
function render() {
  if (window.AF_ADMIN && typeof adminRender === 'function') return adminRender();
  if (S.map) { try { S.map.remove(); } catch (e) {} S.map = null; }
  const v = $('#view');
  if (!S.data) return;
  if (S.data.needLogin) { v.innerHTML = viewLogin(); $('.bottom-nav').classList.add('hidden'); return; }
  $('.bottom-nav').classList.remove('hidden');
  const fn = VIEWS[S.view] || VIEWS.home;
  v.innerHTML = fn();
  if (fn.after) fn.after();
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === S.view));
}

function viewLogin() {
  return `<div class="home-head" style="padding-bottom:60px"><div class="hh-row"><div class="hh-avatar">A</div><div class="hh-text"><h1>${esc(S.data.app.name)}</h1><p>Aplikasi keluarga</p></div></div></div>
  <div class="page"><div class="card" style="margin-top:-30px;position:relative">
    <h3 style="margin:0 0 6px">Masuk</h3><p style="margin:0 0 14px;color:var(--muted);font-size:14px">Aplikasi ini khusus anggota keluarga. Masukkan PIN keluarga.</p>
    <form id="login-form" data-role="anggota">${pinField()}<button class="btn primary block">Masuk</button></form>
  </div></div>`;
}
function pinField() { return `<div class="field"><label for="pin">PIN</label><input class="input" id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" required></div>`; }

/* ===================== BERANDA ===================== */
VIEWS.home = function () {
  const st = S.data.settings, t = todayStr(), p = ym(t);
  const iu = iuranStatus(p);
  const saldo = saldoUntil();
  const masukBln = sumKas(k => k.jenis === 'Masuk' && ym(k.tanggal) === p);
  const keluarBln = sumKas(k => k.jenis === 'Keluar' && ym(k.tanggal) === p);
  const masukLalu = sumKas(k => k.jenis === 'Masuk' && ym(k.tanggal) === addMonths(p, -1));
  const nBerita = isMember() ? beritaBaru() + beritaPending() : 0;
  const notif = upcomingAgenda(7).length + birthdaysThisMonth().filter(a => a.tgl_lahir.slice(5) === t.slice(5)).length + nBerita;
  const newPhoto = S.data.galeri.some(g => (g.created_at || g.tanggal || '') >= addDays(t, -14));
  const logo = st.logo_url ? `<img src="${esc(st.logo_url)}" alt="" referrerpolicy="no-referrer">` : 'A';
  const greet = S.role === 'admin' ? 'Admin' : 'Keluarga';
  const nb = isMember() ? beritaBaru() : 0, np = beritaPending();
  const tiles = [
    ['anggota', 'keluarga', 'Data<br>Keluarga', `<span class="badge" style="background:#1e3a6e">${S.data.anggota.length}</span>`],
    ['berita', 'berita', 'Kabar<br>Keluarga', np ? `<span class="badge" style="background:#f59e0b">${np}</span>` : nb ? `<span class="badge">${nb}</span>` : ''],
    ['pohon', 'pohon', 'Pohon<br>Keluarga', ''],
    ['galeri', 'galeri', 'Galeri', newPhoto ? '<span class="badge new">NEW</span>' : ''],
    ['kas', 'kas', 'Kas<br>Keluarga', ''],
    ['laporan', 'laporan', 'Laporan<br>Keuangan', ''],
    ['dashboard', 'dashboard', 'Dashboard<br>Keuangan', ''],
    ['agenda', 'agenda', 'Agenda', upcomingAgenda(30).length ? `<span class="badge">${upcomingAgenda(30).length}</span>` : ''],
    ['peta', 'peta', 'Peta<br>Keluarga', ''],
    ['@go-ultah', 'ultah', 'Ulang<br>Tahun', birthdaysThisMonth().length ? `<span class="badge" style="background:#ec4899">${birthdaysThisMonth().length}</span>` : ''],
    ['cari', 'cari', 'Cari', ''],
    ['akun', 'akun', 'Akun &amp;<br>Pengaturan', '']
  ];
  const tileHtml = (x, i) => `<button class="tile ${i === 0 ? 'dark' : ''}" ${x[0][0] === '@' ? `data-action="${x[0].slice(1)}"` : `data-nav="${x[0]}"`}>${x[3]}${ICON[x[1]]}<span>${x[2]}</span></button>`;
  const latest = isMember() ? beritaSorted('Terbit').slice(0, 3) : [];
  const ratio = (masukBln + keluarBln) ? Math.round(masukBln / (masukBln + keluarBln) * 100) : 0;
  const recent = S.data.kas.slice().sort((a, b) => (b.tanggal + b.created_at).localeCompare(a.tanggal + a.created_at)).slice(0, 4);
  const nextAg = upcomingAgenda(60)[0];
  const hero = iu.list.length ? `
      <div class="ring" style="--p:${iu.pct}"><b>${iu.pct}%</b></div>
      <div class="hero-txt"><small>Iuran ${esc(BULAN[Number(p.slice(5)) - 1])} ${p.slice(0, 4)}</small>
        <h2><em>${iu.lunas.length}</em> dari ${iu.list.length} Anggota <span>Lunas</span></h2>
        <div class="bar"><i style="width:${iu.pct}%"></i></div></div>` : `
      <div class="ring" style="--p:${ratio}"><b>${ratio}%</b></div>
      <div class="hero-txt"><small>Saldo Kas Keluarga</small><h2><em>${esc(rp(saldo))}</em></h2>
        <div class="bar"><i style="width:${ratio}%"></i></div><small style="font-size:11px;opacity:.7">Tandai anggota "wajib iuran" untuk memantau iuran</small></div>`;

  return `
  <header class="home-head">
    <div class="hh-row">
      <div class="hh-avatar">${logo}</div>
      <div class="hh-text"><h1>Halo ${esc(greet)},</h1><p>${esc(st.nama_keluarga)}</p></div>
      <button class="toggle ${isAdmin() ? 'on' : ''}" data-action="toggle-admin" aria-label="Mode admin ${isAdmin() ? 'aktif' : 'nonaktif'}" title="Mode Admin"><span>ON</span><span>OFF</span></button>
      <button class="bell" data-action="notif" aria-label="Pengingat">${BELL}${notif ? '<span class="dot"></span>' : ''}</button>
    </div>
  </header>
  <div class="hero-wrap">
    <div class="hero">${hero}</div>
    <div class="hero-cta"><button data-action="${iu.list.length ? 'catat-iuran' : 'nav-kas'}">${iu.list.length ? 'Catat Iuran' : 'Lihat Kas'} <i>→</i></button></div>
  </div>

  <section class="section" style="margin-top:42px">
    <div class="section-head"><h3>Menu Utama</h3></div>
    <div class="menu-pages" id="menu-pages">
      <div class="menu-grid">${tiles.slice(0, 8).map(tileHtml).join('')}</div>
      <div class="menu-grid">${tiles.slice(8).map((x, i) => tileHtml(x, i + 8)).join('')}</div>
    </div>
    <div class="dots" id="menu-dots"><i class="on"></i><i></i></div>
  </section>

  ${latest.length ? `<section class="section">
    <div class="section-head"><h3>Kabar Keluarga</h3><button class="link" data-nav="berita">Lihat Semua</button></div>
    <div class="hscroll">${latest.map(b => `<div style="flex:0 0 84%;scroll-snap-align:start">${beritaCard(b, true)}</div>`).join('')}</div>
  </section>` : ''}

  <section class="section">
    <div class="section-head"><h3>Ringkasan Kas</h3><button class="link" data-nav="dashboard">Lihat Semua</button></div>
    <div class="hscroll">
      <button class="kcard c1" data-nav="dashboard" style="text-align:left"><h4>${esc(rpShort(saldo))}</h4><p>*Saldo kas saat ini</p>
        <div class="bar"><i style="width:${ratio}%"></i></div><div class="meta"><span>Masuk vs keluar bulan ini</span><span>${ratio}%</span></div></button>
      <button class="kcard c2" data-nav="kas" style="text-align:left"><h4>${esc(rpShort(masukBln))}</h4><p>*Pemasukan ${esc(BULAN[Number(p.slice(5)) - 1])}</p>
        <div class="bar"><i style="width:${masukLalu ? Math.min(100, Math.round(masukBln / masukLalu * 100)) : 100}%"></i></div>
        <div class="meta"><span>Bulan lalu ${esc(rpShort(masukLalu))}</span><span>${masukLalu ? Math.round((masukBln - masukLalu) / masukLalu * 100) + '%' : '–'}</span></div></button>
      <button class="kcard c3" data-nav="kas" style="text-align:left"><h4>${esc(rpShort(keluarBln))}</h4><p>*Pengeluaran ${esc(BULAN[Number(p.slice(5)) - 1])}</p>
        <div class="bar"><i style="width:${(masukBln + keluarBln) ? 100 - ratio : 0}%;background:#f87171"></i></div><div class="meta"><span>Porsi pengeluaran</span><span>${(masukBln + keluarBln) ? 100 - ratio : 0}%</span></div></button>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h3>Aktivitas Terbaru</h3><button class="link" data-nav="kas">Semua</button></div>
    <div class="list">
      ${nextAg ? `<button class="item" data-action="agenda-detail" data-id="${esc(nextAg.id)}"><span class="ic ev">📅</span><span class="tx"><b>${esc(nextAg.judul)}</b><small>${fmtDate(nextAg.tanggal, true)}${nextAg.jam ? ' · ' + esc(nextAg.jam) : ''}</small></span><span class="chip">Agenda</span></button>` : ''}
      ${recent.map(kasItem).join('') || '<div class="empty"><b>Belum ada transaksi</b>Catat pemasukan pertama lewat tombol A di bawah.</div>'}
    </div>
  </section>`;
};
VIEWS.home.after = function () {
  const pg = $('#menu-pages'), dots = $$('#menu-dots i'); if (!pg) return;
  pg.addEventListener('scroll', () => { const i = Math.round(pg.scrollLeft / pg.clientWidth); dots.forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive: true });
  dots.forEach((d, k) => d.addEventListener('click', () => pg.scrollTo({ left: k * pg.clientWidth, behavior: 'smooth' })));
};
function addDays(d, n) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function kasItem(k) {
  const a = k.anggota_id ? nameOf(k.anggota_id) : '';
  return `<button class="item" data-action="kas-detail" data-id="${esc(k.id)}">
    <span class="ic ${k.jenis === 'Masuk' ? 'in' : 'out'}">${k.jenis === 'Masuk' ? '↓' : '↑'}</span>
    <span class="tx"><b>${esc(k.kategori)}${a ? ' · ' + esc(a) : ''}</b><small>${fmtDate(k.tanggal)}${k.keterangan ? ' · ' + esc(k.keterangan) : ''}</small></span>
    <span class="val ${k.jenis === 'Masuk' ? 'in' : 'out'}">${k.jenis === 'Masuk' ? '+' : '−'}${esc(rp(k.jumlah))}</span></button>`;
}

/* ===================== DATA KELUARGA ===================== */
VIEWS.anggota = function () {
  const f = S.anggota, ix = index(), q = f.q.toLowerCase();
  let list = S.data.anggota.filter(a => !q || (a.nama + ' ' + a.panggilan + ' ' + a.pekerjaan + ' ' + a.tempat_lahir + ' ' + genLabel(ix.gen[a.id])).toLowerCase().includes(q));
  if (f.f === 'L' || f.f === 'P') list = list.filter(a => a.jenis_kelamin === f.f);
  if (f.f === 'iuran') list = list.filter(wajib);
  if (f.f === 'wafat') list = list.filter(a => !alive(a));
  if (f.f === 'ultah') list = birthdaysThisMonth().filter(a => list.includes(a));
  if (/^g\d+$/.test(f.f)) list = list.filter(a => ix.gen[a.id] === Number(f.f.slice(1)));
  if (f.f !== 'ultah') list.sort((a, b) => ix.gen[a.id] - ix.gen[b.id] || String(a.tgl_lahir || '9999').localeCompare(String(b.tgl_lahir || '9999')) || a.nama.localeCompare(b.nama));
  const count = {}; S.data.anggota.forEach(a => { count[ix.gen[a.id]] = (count[ix.gen[a.id]] || 0) + 1; });
  const maxG = Math.max.apply(null, [MAX_GEN].concat(Object.keys(count).map(Number)));
  const genPills = Array.from({ length: maxG }, (_, i) => i + 1)
    .map(g => `<button class="pill ${f.f === 'g' + g ? 'active' : ''}" data-action="f-anggota" data-v="g${g}" title="${esc(genLabel(g))}">Gen ${g} <small style="opacity:.7">${count[g] || 0}</small></button>`).join('');
  const pills = [['semua', 'Semua'], ['L', 'Laki-laki'], ['P', 'Perempuan'], ['iuran', 'Wajib iuran'], ['ultah', 'Ultah bulan ini'], ['wafat', 'Almarhum']];
  const item = a => {
    const parents = [nameOf(a.ayah_id), nameOf(a.ibu_id)].filter(Boolean).join(' & ');
    const sub = parents ? 'Anak dari ' + parents : (spouseIds(a).length ? 'Pasangan ' + spouseIds(a).map(nameOf).filter(Boolean).join(', ') : genLabel(ix.gen[a.id]));
    return `<button class="item" data-action="person" data-id="${esc(a.id)}">${avatar(a)}
      <span class="tx"><b>${esc(a.nama)}</b><small>${esc(sub)}</small></span>
      <span style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="chip gen-${Math.min(ix.gen[a.id], 7)}">Gen ${ix.gen[a.id]}</span>${!alive(a) ? '<span class="chip gray">Alm.</span>' : (wajib(a) ? '<span class="chip green">Iuran</span>' : '')}</span></button>`;
  };
  // kelompokkan per generasi (kecuali filter ulang tahun yang diurutkan per tanggal)
  let body;
  if (f.f === 'ultah') body = `<div class="list">${list.map(item).join('')}</div>`;
  else {
    const groups = {}; list.forEach(a => (groups[ix.gen[a.id]] = groups[ix.gen[a.id]] || []).push(a));
    body = Object.keys(groups).map(Number).sort((x, y) => x - y).map(g => `
      <div class="gen-head"><span class="gen-dot gen-${Math.min(g, 7)}">${g}</span><b>Generasi ${g}</b><span>${esc(genLabel(g))}</span><small>${groups[g].length} orang</small></div>
      <div class="list">${groups[g].map(item).join('')}</div>`).join('');
  }
  return subhead('Data Keluarga', {
    action: addBtn('add-anggota', 'Tambah anggota'),
    extra: `<label class="search">${SEARCH_IC}<input id="q-anggota" type="search" placeholder="Cari nama, pekerjaan, kota, generasi…" value="${esc(f.q)}" aria-label="Cari anggota"></label>`
  }) + `<div class="page">
    <div class="filters">${pills.map(p => `<button class="pill ${f.f === p[0] ? 'active' : ''}" data-action="f-anggota" data-v="${p[0]}">${p[1]}</button>`).join('')}</div>
    <div class="filters" style="margin-top:8px" aria-label="Filter generasi">${genPills}</div>
    <p style="font-size:12px;color:var(--muted);margin:12px 4px 0">${list.length} anggota${/^g\d+$/.test(f.f) ? ' · ' + esc(genText(Number(f.f.slice(1)))) : ''}</p>
    ${list.length ? body : '<div class="empty"><b>Tidak ada anggota</b>Ubah kata kunci atau filter.</div>'}</div>`;
};
VIEWS.anggota.after = () => { bindSearch('#q-anggota', v => { S.anggota.q = v; }, 'anggota'); const act = $$('.filters .pill.active'); act.forEach(b => b.scrollIntoView({ inline: 'center', block: 'nearest' })); window.scrollTo(0, 0); };

function bindSearch(sel, set, view) {
  const el = $(sel); if (!el) return;
  let t; el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { set(el.value); const pos = el.selectionStart; render(); const n = $(sel); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }, 220); });
}

function personDetail(id) {
  const ix = index(), a = ix.byId[id]; if (!a) return;
  const rel = (ids, label) => ids.length ? `<h4 style="margin:16px 0 8px;font-size:13px">${label}</h4><div class="rel-list">${ids.map(i => ix.byId[i]).filter(Boolean).map(p => `<button data-action="person" data-id="${esc(p.id)}">${avatar(p)}${esc(p.panggilan || p.nama)}</button>`).join('')}</div>` : '';
  const parents = [a.ayah_id, a.ibu_id].filter(p => ix.byId[p]);
  const siblings = parents.length ? Array.from(new Set(parents.flatMap(p => ix.kids[p] || []))).filter(x => x !== id) : [];
  const kids = ix.kids[id] || [];
  const cucu = kids.flatMap(k => ix.kids[k] || []);
  const desc = descendants(id).size;
  const path = lineage(id);
  const hp = a.no_hp ? `<a href="https://wa.me/${esc(a.no_hp.replace(/^0/, '62').replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(a.no_hp)}</a>` : '';
  const ttl = [a.tempat_lahir, a.tgl_lahir ? fmtDate(a.tgl_lahir) : ''].filter(Boolean).join(', ');
  openSheet('Profil Anggota', `
    <div class="detail-head">${avatar(a)}<div><h3 style="margin:0;font-size:19px">${esc(a.nama)}</h3>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <span class="chip">${a.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki'}</span><span class="chip gen-${Math.min(ix.gen[id], 7)}">${esc(genText(ix.gen[id]))}</span>
        ${alive(a) ? '<span class="chip green">Hidup</span>' : '<span class="chip gray">Almarhum' + (a.jenis_kelamin === 'P' ? 'ah' : '') + '</span>'}
        ${wajib(a) ? '<span class="chip amber">Wajib iuran</span>' : ''}</div></div></div>
    <dl class="dl">
      ${a.panggilan ? `<dt>Panggilan</dt><dd>${esc(a.panggilan)}</dd>` : ''}
      ${ttl ? `<dt>Lahir</dt><dd>${esc(ttl)}${age(a) !== '' ? ' (' + age(a) + ' th)' : ''}</dd>` : ''}
      ${a.tgl_wafat ? `<dt>Wafat</dt><dd>${fmtDate(a.tgl_wafat)}</dd>` : ''}
      ${a.pekerjaan ? `<dt>Pekerjaan</dt><dd>${esc(a.pekerjaan)}</dd>` : ''}
      ${hp ? `<dt>WhatsApp</dt><dd>${hp}</dd>` : ''}
      ${a.email ? `<dt>Email</dt><dd>${esc(a.email)}</dd>` : ''}
      ${a.alamat ? `<dt>Alamat</dt><dd>${esc(a.alamat)}${a.lat && a.lng ? ` · <a href="https://www.google.com/maps?q=${esc(a.lat)},${esc(a.lng)}" target="_blank" rel="noopener">Peta</a>` : ''}</dd>` : ''}
      <dt>Keturunan</dt><dd>${kids.length} anak · ${cucu.length} cucu · ${desc} total</dd>
      ${a.catatan ? `<dt>Catatan</dt><dd>${esc(a.catatan)}</dd>` : ''}
    </dl>
    ${path.length > 1 ? `<h4 style="margin:16px 0 8px;font-size:13px">Garis silsilah</h4><div class="path">${path.map((p, i) => `<span>${esc(nameOf(p))}</span>${i < path.length - 1 ? '›' : ''}`).join('')}</div>` : ''}
    ${rel(parents, 'Orang tua')}${rel(spouseIds(a), 'Pasangan')}${rel(siblings, 'Saudara kandung')}${rel(kids, 'Anak')}
    <div class="btn-row" style="margin-top:18px"><button class="btn dark" data-action="tree-focus" data-id="${esc(id)}">Lihat di Pohon</button>
      ${isAdmin() ? `<button class="btn ghost" data-action="edit-anggota" data-id="${esc(id)}">Edit</button>` : ''}</div>
    ${isAdmin() ? `<div class="btn-row"><button class="btn ghost" data-action="add-child" data-id="${esc(id)}">+ Tambah anak</button><button class="btn danger" data-action="del-anggota" data-id="${esc(id)}">Hapus</button></div>` : ''}`);
}

function formAnggota(a, preset) {
  a = Object.assign({ jenis_kelamin: '', wajib_iuran: 'FALSE' }, preset || {}, a || {});
  const ix = index();
  // daftar ayah/ibu dikelompokkan per generasi agar mudah dicari saat data sudah 6 generasi
  const opts = (jk, sel) => {
    const cand = S.data.anggota.filter(x => (!jk || x.jenis_kelamin === jk) && x.id !== a.id);
    const byG = {}; cand.forEach(x => (byG[ix.gen[x.id]] = byG[ix.gen[x.id]] || []).push(x));
    return '<option value="">— Tidak diketahui / di luar data —</option>' + Object.keys(byG).map(Number).sort((x, y) => x - y).map(g =>
      `<optgroup label="${esc(genText(g))}">${byG[g].sort((x, y) => x.nama.localeCompare(y.nama)).map(x =>
        `<option value="${esc(x.id)}" data-gen="${g}" ${x.id === sel ? 'selected' : ''} ${g >= MAX_GEN && x.id !== sel ? 'disabled' : ''}>${esc(x.nama)}</option>`).join('')}</optgroup>`).join('');
  };
  const curGen = a.id ? ix.gen[a.id] : (parseGen(a.generasi) || 1);
  const sp = spouseIds(a);
  openSheet(a.id ? 'Edit Anggota' : 'Tambah Anggota', `
  <form id="f-anggota" novalidate>
    <input type="hidden" name="id" value="${esc(a.id || '')}"><input type="hidden" name="foto_url" value="${esc(a.foto_url || '')}">
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
      <span id="foto-prev">${avatar(a)}</span>
      <label class="btn ghost sm" style="cursor:pointer">Unggah foto<input type="file" accept="image/*" id="foto-file" hidden></label>
    </div>
    <div class="field"><label for="fa-nama">Nama lengkap *</label><input class="input" id="fa-nama" name="nama" required maxlength="120" value="${esc(a.nama || '')}"></div>
    <div class="row2"><div class="field"><label for="fa-pg">Panggilan</label><input class="input" id="fa-pg" name="panggilan" maxlength="40" value="${esc(a.panggilan || '')}"></div>
      <div class="field"><label for="fa-jk">Jenis kelamin *</label><select class="input" id="fa-jk" name="jenis_kelamin" required><option value="">Pilih</option><option value="L" ${a.jenis_kelamin === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${a.jenis_kelamin === 'P' ? 'selected' : ''}>Perempuan</option></select></div></div>
    <div class="row2"><div class="field"><label for="fa-tl">Tempat lahir</label><input class="input" id="fa-tl" name="tempat_lahir" value="${esc(a.tempat_lahir || '')}"></div>
      <div class="field"><label for="fa-tgl">Tanggal lahir</label><input class="input" id="fa-tgl" type="date" name="tgl_lahir" value="${esc(a.tgl_lahir || '')}"></div></div>
    <div class="field"><label for="fa-gen">Generasi</label>
      <select class="input" id="fa-gen" name="generasi">${GEN_LABELS.map((l, i) => `<option value="${i + 1}" ${curGen === i + 1 ? 'selected' : ''}>Gen ${i + 1} (${esc(l)})</option>`).join('')}</select>
      <span class="hint" id="fa-gen-hint"></span></div>
    <div class="field"><label for="fa-wf">Tanggal wafat</label><input class="input" id="fa-wf" type="date" name="tgl_wafat" value="${esc(a.tgl_wafat || '')}"><span class="hint">Kosongkan bila masih hidup.</span></div>
    <h4 style="margin:6px 0 10px;font-size:14px">Hubungan keluarga</h4>
    <div class="field"><label for="fa-ayah">Ayah</label><select class="input" id="fa-ayah" name="ayah_id">${opts('L', a.ayah_id)}</select></div>
    <div class="field"><label for="fa-ibu">Ibu</label><select class="input" id="fa-ibu" name="ibu_id">${opts('P', a.ibu_id)}</select></div>
    <div class="field"><label for="fa-ps">Pasangan</label><select class="input" id="fa-ps" name="pasangan_id" multiple size="4">${S.data.anggota.filter(x => x.id !== a.id).sort((x, y) => x.nama.localeCompare(y.nama)).map(x => `<option value="${esc(x.id)}" ${sp.includes(x.id) ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select><span class="hint">Tahan Ctrl/⌘ untuk memilih lebih dari satu. Pasangan otomatis tercatat timbal balik.</span></div>
    <h4 style="margin:6px 0 10px;font-size:14px">Kontak & domisili</h4>
    <div class="row2"><div class="field"><label for="fa-hp">No. HP / WA</label><input class="input" id="fa-hp" name="no_hp" inputmode="tel" value="${esc(a.no_hp || '')}"></div>
      <div class="field"><label for="fa-pk">Pekerjaan</label><input class="input" id="fa-pk" name="pekerjaan" value="${esc(a.pekerjaan || '')}"></div></div>
    <div class="field"><label for="fa-em">Email</label><input class="input" id="fa-em" name="email" type="email" value="${esc(a.email || '')}"></div>
    <div class="field"><label for="fa-al">Alamat</label><textarea class="input" id="fa-al" name="alamat">${esc(a.alamat || '')}</textarea></div>
    <div class="row2"><div class="field"><label for="fa-lat">Latitude</label><input class="input" id="fa-lat" name="lat" inputmode="decimal" value="${esc(a.lat || '')}"></div>
      <div class="field"><label for="fa-lng">Longitude</label><input class="input" id="fa-lng" name="lng" inputmode="decimal" value="${esc(a.lng || '')}"></div></div>
    <button type="button" class="btn ghost sm" data-action="pick-map" style="margin:-4px 0 12px">📍 Pilih di peta</button><div id="picker"></div>
    <label style="display:flex;gap:10px;align-items:center;font-size:14px;margin:6px 0 12px"><input type="checkbox" name="wajib_iuran" ${wajib(a) ? 'checked' : ''}> Wajib membayar iuran bulanan</label>
    <div class="field"><label for="fa-ct">Catatan</label><textarea class="input" id="fa-ct" name="catatan">${esc(a.catatan || '')}</textarea></div>
    <button class="btn primary block" type="submit">Simpan</button>
  </form>`, body => {
    // generasi: otomatis dari orang tua; manual hanya bila orang tua tidak tercatat
    const genSel = $('#fa-gen', body), genHint = $('#fa-gen-hint', body), ayahSel = $('#fa-ayah', body), ibuSel = $('#fa-ibu', body);
    const syncGen = () => {
      const pg = Math.max.apply(null, [ayahSel, ibuSel].map(s => Number((s.selectedOptions[0] || {}).dataset ? s.selectedOptions[0].dataset.gen || 0 : 0)));
      if (pg) {
        const g = pg + 1; genSel.value = String(Math.min(g, MAX_GEN)); genSel.disabled = true;
        genHint.textContent = 'Otomatis dari orang tua: ' + genText(g) + '.';
      } else {
        genSel.disabled = false;
        genHint.textContent = 'Pilih manual karena orang tua tidak tercatat. Untuk menantu, samakan dengan generasi pasangannya.';
      }
      // urutkan pilihan orang tua: generasi tepat di atas generasi terpilih tampil lebih dulu
      if (!pg) [ayahSel, ibuSel].forEach(s => { const want = Number(genSel.value) - 1; $$('optgroup', s).forEach(o => { o.label = o.label.replace(/^★ /, ''); if (o.label.startsWith('Gen ' + want + ' ')) { o.label = '★ ' + o.label; s.insertBefore(o, s.children[1]); } }); });
    };
    [ayahSel, ibuSel].forEach(s => s.addEventListener('change', syncGen)); genSel.addEventListener('change', syncGen); syncGen();
    $('#foto-file', body).onchange = e => uploadPicked(e.target, url => { $('[name=foto_url]', body).value = url; $('#foto-prev', body).innerHTML = avatar(Object.assign({}, a, { foto_url: url })); });
    $('#f-anggota', body).onsubmit = async ev => {
      ev.preventDefault(); const f = ev.target, btn = $('button[type=submit]', f);
      const d = formData(f); d.pasangan_id = $$('#fa-ps option:checked', f).map(o => o.value).join(',');
      if (d.ayah_id || d.ibu_id) d.generasi = ''; else d.generasi = genSel.value;
      if (!d.nama) return showErr(f, 'Nama wajib diisi.');
      if (!d.jenis_kelamin) return showErr(f, 'Jenis kelamin wajib dipilih.');
      busy(btn, true);
      try { await api('apiSaveAnggota', S.token, d); closeSheet(); toast('Data anggota tersimpan', 'ok'); await reload(); }
      catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}

/* ===================== POHON KELUARGA ===================== */
VIEWS.pohon = function () {
  if (!S.data.anggota.length) return subhead('Pohon Keluarga') + '<div class="empty"><b>Belum ada anggota</b>Tambahkan anggota dan isi ayah/ibu untuk membentuk pohon.</div>';
  const ix = index(), cands = rootCandidates(), T = S.tree;
  if (!T.rootId || !ix.byId[T.rootId]) T.rootId = cands.length ? cands[0].id : S.data.anggota[0].id;
  const rootOpts = Array.from(new Map(cands.map(c => [c.id, c]).concat([[T.rootId, { id: T.rootId, count: descendants(T.rootId).size }]])).values());
  const tree = buildTree(T.rootId);
  const st = { n: 0, alive: 0, dead: 0, maxDepth: 0 };
  const walk = (n, d) => { if (n.ref) return; [n.id].concat(T.showSpouse ? n.spouses : []).forEach(i => { st.n++; alive(ix.byId[i]) ? st.alive++ : st.dead++; }); st.maxDepth = Math.max(st.maxDepth, d); n.children.forEach(c => walk(c, d + 1)); };
  walk(tree, 1);
  return subhead('Pohon Keluarga', {
    action: `<button class="icon-btn" data-action="tree-help" aria-label="Bantuan">?</button>`,
    extra: `<label class="search">${SEARCH_IC}<input id="q-tree" type="search" placeholder="Cari & sorot anggota di pohon…" value="${esc(T.q)}" aria-label="Cari di pohon" list="tree-names"></label>
      <datalist id="tree-names">${S.data.anggota.map(a => `<option value="${esc(a.nama)}">`).join('')}</datalist>`
  }) + `<div class="page">
    <div class="tree-toolbar">
      <select class="input" id="tree-root" style="flex:1;min-width:160px;height:40px;padding:6px 10px" aria-label="Tampilkan pohon dari">
        ${rootOpts.map(c => `<option value="${esc(c.id)}" ${c.id === T.rootId ? 'selected' : ''}>Mulai dari: ${esc(nameOf(c.id))} (${c.count} keturunan)</option>`).join('')}
      </select>
      <button class="btn ghost sm" data-action="tree-spouse" title="Tampilkan/sembunyikan pasangan">${T.showSpouse ? '♥ Pasangan: on' : '♡ Pasangan: off'}</button>
      <button class="btn ghost sm" data-action="tree-expand" aria-label="Buka semua cabang">⇲</button>
    </div>
    <div class="tree-stats"><span class="chip">${st.n} orang</span><span class="chip">${st.maxDepth} generasi</span><span class="chip green">${st.alive} hidup</span><span class="chip gray">${st.dead} wafat</span></div>
    <div class="tree-stage" id="tree-stage">
      <div class="gen-rail">Geser · cubit untuk zoom</div>
      <div class="tree-canvas" id="tree-canvas"><ul class="tree">${renderNode(tree, 1)}</ul></div>
      <div class="zoom-ctrl"><button data-action="zoom" data-z="1.2" aria-label="Perbesar">＋</button><button data-action="zoom" data-z="0.8" aria-label="Perkecil">－</button><button data-action="tree-fit" aria-label="Pas layar">⤢</button></div>
    </div>
    <div class="tree-legend"><span><i style="background:#4f8cff"></i>Laki-laki</span><span><i style="background:#ec4899"></i>Perempuan</span><span><i style="background:#f0a5c4"></i>Pasangan</span><span>Kartu pudar = almarhum</span></div>
  </div>`;
};
function buildTree(rootId) {
  const ix = index(), seen = new Set();
  const node = (id, depth) => {
    if (seen.has(id) || depth > 40) return { id, ref: true, spouses: [], children: [] };
    seen.add(id);
    const a = ix.byId[id];
    const spouses = spouseIds(a).filter(s => ix.byId[s]);
    spouses.forEach(s => seen.add(s));
    return { id, spouses, children: (ix.kids[id] || []).map(k => node(k, depth + 1)) };
  };
  return node(rootId, 1);
}
function pnode(a, extra) {
  const T = S.tree, q = T.q.trim().toLowerCase();
  const hl = q && a.nama.toLowerCase().includes(q);
  return `<button class="pnode ${a.jenis_kelamin === 'P' ? 'P' : 'L'} ${extra || ''} ${alive(a) ? '' : 'dead'} ${hl ? 'hl' : ''} ${a.id === T.rootId ? 'root' : ''}" data-action="person" data-id="${esc(a.id)}" data-node="${esc(a.id)}">
    ${a.id === T.rootId ? '<span class="tag">Leluhur</span>' : ''}${avatar(a)}<b>${esc(a.panggilan || a.nama)}</b><small>${esc(years(a)) || '&nbsp;'}</small></button>`;
}
function renderNode(n, depth) {
  const ix = index(), a = ix.byId[n.id], T = S.tree;
  if (n.ref) return `<li><div class="unit">${pnode(a, '')}</div><small style="font-size:10px;color:var(--muted);margin-top:4px">sudah tampil di cabang lain</small></li>`;
  const multi = n.spouses.length > 1;
  const spouses = T.showSpouse ? n.spouses.map(s => `<span class="link-line"></span>${pnode(ix.byId[s], 'spouse')}`).join('') : '';
  const collapsed = T.collapsed.has(n.id);
  const kids = n.children.length ? `<button class="toggle-kids" data-action="tree-toggle" data-id="${esc(n.id)}">${collapsed ? '▸ ' + n.children.length + ' anak' : '▾ ' + n.children.length + ' anak'}</button>` : '';
  const childHtml = n.children.map(c => {
    if (!multi) return renderNode(c, depth + 1);
    const ca = ix.byId[c.id]; const other = [ca.ayah_id, ca.ibu_id].find(p => p && p !== n.id);
    return renderNode(c, depth + 1).replace('<div class="unit">', `<div style="font-size:10px;color:var(--muted);margin-bottom:4px">dari ${esc(nameOf(other) || '?')}</div><div class="unit">`);
  }).join('');
  return `<li class="${collapsed ? 'collapsed' : ''}"><div class="unit">${pnode(a, '')}${spouses}</div>${kids}${n.children.length ? `<ul>${childHtml}</ul>` : ''}</li>`;
}
function applyTreeTransform() { const c = $('#tree-canvas'); if (c) c.style.transform = `translate(${S.tree.x}px,${S.tree.y}px) scale(${S.tree.scale})`; }
function treeFit() {
  const st = $('#tree-stage'), c = $('#tree-canvas'); if (!st || !c) return;
  const w = c.offsetWidth, h = c.offsetHeight, W = st.clientWidth, H = st.clientHeight;
  // utamakan keterbacaan: pas lebar bila memungkinkan, tapi tidak lebih kecil dari 0.55 (sisanya digeser)
  const s = Math.max(0.55, Math.min(1, W / w, H / h));
  Object.assign(S.tree, { scale: s, x: w * s <= W ? (W - w * s) / 2 : 8, y: h * s <= H ? Math.max(8, (H - h * s) / 2) : 8 });
  applyTreeTransform();
}
function treeCenterOn(id, keepScale, topY) {
  const st = $('#tree-stage'), c = $('#tree-canvas'), el = c && $(`[data-node="${CSS.escape(id)}"]`, c);
  if (!el) return false;
  let x = 0, y = 0, n = el; while (n && n !== c) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  if (!keepScale) S.tree.scale = Math.max(S.tree.scale, 0.85);
  S.tree.x = st.clientWidth / 2 - (x + el.offsetWidth / 2) * S.tree.scale;
  S.tree.y = topY !== undefined ? topY - y * S.tree.scale : st.clientHeight / 3 - (y + el.offsetHeight / 2) * S.tree.scale;
  applyTreeTransform(); return true;
}
VIEWS.pohon.after = function () {
  const st = $('#tree-stage'); if (!st) return;
  const T = S.tree;
  if (T.focus) { const id = T.focus; T.focus = null; requestAnimationFrame(() => { treeFit(); treeCenterOn(id); }); }
  else if (!T.placed) { requestAnimationFrame(() => { treeFit(); const c = $('#tree-canvas'); if (c && c.offsetWidth * T.scale > st.clientWidth) treeCenterOn(T.rootId, true, 40); }); T.placed = true; } else applyTreeTransform();
  $('#tree-root').onchange = e => { T.rootId = e.target.value; T.collapsed.clear(); T.placed = false; render(); };
  const q = $('#q-tree');
  q.addEventListener('change', () => {
    T.q = q.value; const hit = S.data.anggota.find(a => T.q && a.nama.toLowerCase().includes(T.q.toLowerCase()));
    if (hit) {
      const lin = lineage(hit.id); lin.forEach(i => T.collapsed.delete(i));
      if (!descendants(T.rootId).has(hit.id) && hit.id !== T.rootId && !spouseIds(index().byId[T.rootId]).includes(hit.id)) {
        const inLine = lin.find(i => rootCandidates().some(c => c.id === i)) || topAncestor(hit.id);
        T.rootId = inLine;
      }
      T.focus = hit.id;
    } else if (T.q) toast('Nama tidak ditemukan');
    render();
  });
  // geser & zoom (mouse, sentuh, pinch)
  const pts = new Map(); let last = null, pinch = null, moved = false;
  st.addEventListener('pointerdown', e => { pts.set(e.pointerId, e); moved = false; if (pts.size === 1) last = { x: e.clientX, y: e.clientY }; });
  st.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
    if (pts.size === 2) {
      const pv = Array.from(pts.values()), a = pv[0], b = pv[1]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch) zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, d / pinch);
      pinch = d; moved = true; return;
    }
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; try { st.setPointerCapture(e.pointerId); } catch (er) {} }
    st.classList.add('dragging');
    T.x += dx; T.y += dy; last = { x: e.clientX, y: e.clientY }; applyTreeTransform();
  });
  const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { last = null; st.classList.remove('dragging'); } };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  st.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  st.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
};
function zoomAt(cx, cy, f) {
  const st = $('#tree-stage').getBoundingClientRect(), T = S.tree;
  const ns = Math.min(2.2, Math.max(0.2, T.scale * f)); const k = ns / T.scale;
  const px = cx - st.left, py = cy - st.top;
  T.x = px - (px - T.x) * k; T.y = py - (py - T.y) * k; T.scale = ns; applyTreeTransform();
}

/* ===================== KAS ===================== */
VIEWS.kas = function () {
  const f = S.kas;
  const months = Array.from(new Set(S.data.kas.map(k => ym(k.tanggal)))).sort().reverse();
  if (f.bulan === '' && months.length) f.bulan = months.includes(ym(todayStr())) ? ym(todayStr()) : months[0];
  const list = S.data.kas.filter(k => (!f.jenis || k.jenis === f.jenis) && (f.bulan === 'semua' || ym(k.tanggal) === f.bulan))
    .sort((a, b) => (b.tanggal + b.created_at).localeCompare(a.tanggal + a.created_at));
  const tin = list.filter(k => k.jenis === 'Masuk').reduce((t, k) => t + k.jumlah, 0), tout = list.filter(k => k.jenis === 'Keluar').reduce((t, k) => t + k.jumlah, 0);
  const groups = {}; list.forEach(k => (groups[k.tanggal] = groups[k.tanggal] || []).push(k));
  return subhead('Kas Keluarga', { action: addBtn('add-kas', 'Catat transaksi') }) + `<div class="page">
    <div class="kpi dark" style="margin-bottom:12px"><small>Saldo kas saat ini</small><b style="font-size:24px">${esc(rp(saldoUntil()))}</b></div>
    <div class="seg" role="tablist">${[['', 'Semua'], ['Masuk', 'Pemasukan'], ['Keluar', 'Pengeluaran']].map(x => `<button class="${f.jenis === x[0] ? 'active' : ''}" data-action="f-kas-jenis" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div class="row2" style="margin-top:10px;align-items:center">
      <select class="input" id="kas-bulan" aria-label="Bulan"><option value="semua" ${f.bulan === 'semua' ? 'selected' : ''}>Semua bulan</option>${months.map(m => `<option value="${m}" ${f.bulan === m ? 'selected' : ''}>${fmtMonth(m)}</option>`).join('')}</select>
      <div style="font-size:12px;text-align:right"><span class="in" style="font-weight:800">+${esc(rpShort(tin))}</span> · <span class="out" style="font-weight:800">−${esc(rpShort(tout))}</span></div>
    </div>
    ${Object.keys(groups).map(d => `<h4 style="margin:16px 4px 8px;font-size:12px;color:var(--muted)">${fmtDate(d, true)}</h4><div class="list">${groups[d].map(kasItem).join('')}</div>`).join('')
      || '<div class="empty"><b>Belum ada transaksi</b>' + (isAdmin() ? 'Tekan ＋ untuk mencatat.' : 'Aktifkan mode Admin untuk mencatat.') + '</div>'}
  </div>`;
};
VIEWS.kas.after = () => { const s = $('#kas-bulan'); if (s) s.onchange = () => { S.kas.bulan = s.value; render(); }; };

function kasDetail(id) {
  const k = S.data.kas.find(x => x.id === id); if (!k) return;
  openSheet('Detail Transaksi', `
    <div style="text-align:center;margin:6px 0 16px"><span class="chip ${k.jenis === 'Masuk' ? 'green' : 'red'}">${esc(k.jenis)}</span>
      <h2 class="${k.jenis === 'Masuk' ? 'in' : 'out'}" style="margin:8px 0 2px;font-size:28px">${esc(rp(k.jumlah))}</h2><small style="color:var(--muted)">${fmtDate(k.tanggal, true)}</small></div>
    <dl class="dl"><dt>Kategori</dt><dd>${esc(k.kategori)}</dd>${k.anggota_id ? `<dt>Anggota</dt><dd>${esc(nameOf(k.anggota_id))}</dd>` : ''}
      ${k.periode ? `<dt>Periode iuran</dt><dd>${fmtMonth(k.periode)}</dd>` : ''}<dt>Metode</dt><dd>${esc(k.metode || '–')}</dd>
      ${k.keterangan ? `<dt>Keterangan</dt><dd>${esc(k.keterangan)}</dd>` : ''}${k.bukti_url ? `<dt>Bukti</dt><dd><a href="${esc(k.bukti_url)}" target="_blank" rel="noopener">Lihat bukti</a></dd>` : ''}
      <dt>ID</dt><dd style="font-size:11px;color:var(--muted)">${esc(k.id)}</dd></dl>
    ${isAdmin() ? `<div class="btn-row" style="margin-top:16px"><button class="btn ghost" data-action="edit-kas" data-id="${esc(id)}">Edit</button><button class="btn danger" data-action="del-kas" data-id="${esc(id)}">Hapus</button></div>` : ''}`);
}

function formKas(k, preset) {
  const st = S.data.settings;
  k = Object.assign({ jenis: 'Masuk', tanggal: todayStr(), metode: 'Tunai' }, preset || {}, k || {});
  const katOpts = j => S.data.kategori.filter(c => c.jenis === j).map(c => `<option ${c.nama === k.kategori ? 'selected' : ''}>${esc(c.nama)}</option>`).join('');
  const iu = iuranStatus(k.periode || ym(k.tanggal));
  const memberOpts = '<option value="">— Tidak terkait anggota —</option>' + iu.belum.concat(S.data.anggota.filter(a => !iu.belum.includes(a)))
    .map(a => `<option value="${esc(a.id)}" ${a.id === k.anggota_id ? 'selected' : ''}>${esc(a.nama)}${iu.belum.includes(a) ? ' • belum iuran' : ''}</option>`).join('');
  openSheet(k.id ? 'Edit Transaksi' : 'Catat Transaksi', `
  <form id="f-kas" novalidate><input type="hidden" name="id" value="${esc(k.id || '')}"><input type="hidden" name="jenis" value="${esc(k.jenis)}">
    <div class="seg" style="margin-bottom:12px"><button type="button" class="${k.jenis === 'Masuk' ? 'active' : ''}" data-j="Masuk">Pemasukan</button><button type="button" class="${k.jenis === 'Keluar' ? 'active' : ''}" data-j="Keluar">Pengeluaran</button></div>
    <div class="field"><label for="fk-j">Jumlah (Rp) *</label><input class="input" id="fk-j" name="jumlah" inputmode="numeric" required value="${k.jumlah ? nf.format(k.jumlah) : ''}" style="font-size:20px;font-weight:800"></div>
    <div class="row2"><div class="field"><label for="fk-t">Tanggal *</label><input class="input" id="fk-t" type="date" name="tanggal" required value="${esc(k.tanggal)}"></div>
      <div class="field"><label for="fk-k">Kategori *</label><select class="input" id="fk-k" name="kategori">${katOpts(k.jenis)}</select></div></div>
    <div class="field" id="fk-aw"><label for="fk-a">Anggota (penyetor/penerima)</label><select class="input" id="fk-a" name="anggota_id">${memberOpts}</select></div>
    <div class="field" id="fk-pw"><label for="fk-p">Periode iuran</label><input class="input" id="fk-p" type="month" name="periode" value="${esc(k.periode || ym(k.tanggal))}"><span class="hint">Bulan yang dibayar, boleh berbeda dengan tanggal bayar.</span></div>
    <div class="row2"><div class="field"><label for="fk-m">Metode</label><select class="input" id="fk-m" name="metode">${['Tunai', 'Transfer', 'QRIS', 'Lainnya'].map(m => `<option ${m === k.metode ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="field"><label for="fk-b">Link bukti</label><input class="input" id="fk-b" name="bukti_url" placeholder="https://" value="${esc(k.bukti_url || '')}"></div></div>
    <div class="field"><label for="fk-ket">Keterangan</label><input class="input" id="fk-ket" name="keterangan" maxlength="300" value="${esc(k.keterangan || '')}"></div>
    <button class="btn primary block" type="submit">Simpan</button>
  </form>`, body => {
    const f = $('#f-kas', body), jumlah = $('#fk-j', f);
    const sync = () => {
      const isIuran = f.jenis.value === 'Masuk' && $('#fk-k', f).value === (st.kategori_iuran || 'Iuran Bulanan');
      $('#fk-pw', f).classList.toggle('hidden', !isIuran);
      if (isIuran && !jumlah.value && Number(st.iuran_bulanan)) jumlah.value = nf.format(Number(st.iuran_bulanan));
    };
    $$('[data-j]', f).forEach(b => b.onclick = () => { f.jenis.value = b.dataset.j; $$('[data-j]', f).forEach(x => x.classList.toggle('active', x === b)); $('#fk-k', f).innerHTML = katOpts(b.dataset.j); sync(); });
    $('#fk-k', f).onchange = sync; sync();
    jumlah.addEventListener('input', () => { const n = jumlah.value.replace(/\D/g, ''); jumlah.value = n ? nf.format(Number(n)) : ''; });
    f.onsubmit = async ev => {
      ev.preventDefault(); const btn = $('button[type=submit]', f); const d = formData(f);
      d.jumlah = d.jumlah.replace(/\D/g, '');
      if (!Number(d.jumlah)) return showErr(f, 'Jumlah harus lebih dari 0.');
      if ($('#fk-pw', f).classList.contains('hidden')) d.periode = '';
      busy(btn, true);
      try { const r = await api('apiSaveKas', S.token, d); upsert('kas', r); closeSheet(); toast('Transaksi tersimpan', 'ok'); render(); }
      catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}

/* ===================== LAPORAN KEUANGAN ===================== */
function lapDefaults() {
  const L = S.lap, t = todayStr();
  if (!L.from) { L.from = t.slice(0, 7) + '-01'; L.to = t; }
  if (!L.year) L.year = Number(t.slice(0, 4));
}
VIEWS.laporan = function () {
  lapDefaults();
  const L = S.lap, st = S.data.settings;
  const tabs = [['arus', 'Arus Kas'], ['kategori', 'Per Kategori'], ['iuran', 'Rekap Iuran']];
  const presets = [['bulan', 'Bulan ini'], ['lalu', 'Bulan lalu'], ['tahun', 'Tahun ini'], ['semua', 'Semua']];
  let body = '', title = '', periodTxt = '';
  if (L.tab === 'iuran') { const r = lapIuran(); body = r.html; title = 'Rekap Iuran Tahun ' + L.year; periodTxt = 'Januari – Desember ' + L.year; }
  else {
    periodTxt = fmtDate(L.from) + ' s.d. ' + fmtDate(L.to);
    if (L.tab === 'arus') { body = lapArus(); title = 'Laporan Arus Kas'; } else { body = lapKategori(); title = 'Rekap Pemasukan & Pengeluaran per Kategori'; }
  }
  const filters = L.tab === 'iuran'
    ? `<div class="field"><label for="lap-year">Tahun</label><select class="input" id="lap-year">${yearOptions(L.year)}</select></div>`
    : `<div class="filters" style="margin-bottom:10px">${presets.map(p => `<button class="pill" data-action="lap-preset" data-v="${p[0]}">${p[1]}</button>`).join('')}</div>
       <div class="row2"><div class="field"><label for="lap-from">Dari</label><input class="input" type="date" id="lap-from" value="${esc(L.from)}"></div>
         <div class="field"><label for="lap-to">Sampai</label><input class="input" type="date" id="lap-to" value="${esc(L.to)}"></div></div>
       ${L.tab === 'arus' ? `<div class="row2"><div class="field"><label for="lap-jenis">Jenis</label><select class="input" id="lap-jenis"><option value="">Semua</option><option ${L.jenis === 'Masuk' ? 'selected' : ''}>Masuk</option><option ${L.jenis === 'Keluar' ? 'selected' : ''}>Keluar</option></select></div>
         <div class="field"><label for="lap-kat">Kategori</label><select class="input" id="lap-kat"><option value="">Semua</option>${Array.from(new Set(S.data.kategori.filter(k => !L.jenis || k.jenis === L.jenis).map(k => k.nama))).map(n => `<option ${L.kategori === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>` : ''}`;
  return subhead('Laporan Keuangan') + `<div class="page">
    <div class="seg no-print" style="margin-bottom:12px">${tabs.map(t => `<button class="${L.tab === t[0] ? 'active' : ''}" data-action="lap-tab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="card no-print" style="margin-bottom:12px">${filters}
      <div class="btn-row" style="margin-top:0"><button class="btn ghost sm" data-action="lap-csv">⬇ Unduh CSV</button><button class="btn dark sm" data-action="lap-print">🖨 Cetak / PDF</button></div></div>
    <div class="print-only kop"><h2>${esc(st.nama_keluarga)}</h2><p><b>${esc(title)}</b></p><p>Periode: ${esc(periodTxt)}</p></div>
    ${body}
    <p style="font-size:11px;color:var(--muted);margin:12px 4px">Dibuat ${fmtDate(todayStr())} · ${esc(S.data.app.name)} v${esc(S.data.app.version)}</p>
  </div>`;
};
VIEWS.laporan.after = function () {
  const L = S.lap, on = (id, fn) => { const e = $(id); if (e) e.onchange = () => { fn(e.value); render(); }; };
  on('#lap-from', v => { L.from = v; if (L.to && L.to < v) L.to = v; }); on('#lap-to', v => { L.to = v; if (L.from && L.from > v) L.from = v; });
  on('#lap-jenis', v => { L.jenis = v; L.kategori = ''; }); on('#lap-kat', v => { L.kategori = v; }); on('#lap-year', v => { L.year = Number(v); });
};
function yearOptions(sel) {
  const ys = new Set(S.data.kas.map(k => Number(k.tanggal.slice(0, 4))).filter(Boolean)); ys.add(Number(todayStr().slice(0, 4)));
  return Array.from(ys).sort((a, b) => b - a).map(y => `<option ${y === sel ? 'selected' : ''}>${y}</option>`).join('');
}
function lapRows() {
  const L = S.lap;
  return S.data.kas.filter(k => k.tanggal >= L.from && k.tanggal <= L.to && (!L.jenis || k.jenis === L.jenis) && (!L.kategori || k.kategori === L.kategori))
    .sort((a, b) => (a.tanggal + a.created_at).localeCompare(b.tanggal + b.created_at));
}
function lapArus() {
  const L = S.lap, rows = lapRows(), filtered = !!(L.jenis || L.kategori);
  const awal = saldoUntil(L.from);
  const tin = rows.filter(k => k.jenis === 'Masuk').reduce((t, k) => t + k.jumlah, 0), tout = rows.filter(k => k.jenis === 'Keluar').reduce((t, k) => t + k.jumlah, 0);
  let run = awal;
  return `<div class="summary" style="margin-bottom:12px">
      <div><small>Saldo awal</small><b>${esc(rp(awal))}</b></div><div><small>Saldo akhir</small><b>${esc(rp(filtered ? saldoUntil(addDays(L.to, 1)) : awal + tin - tout))}</b></div>
      <div><small>Total pemasukan</small><b class="in">${esc(rp(tin))}</b></div><div><small>Total pengeluaran</small><b class="out">${esc(rp(tout))}</b></div></div>
    ${filtered ? '<p class="insight" style="margin:0 0 10px">Filter jenis/kategori aktif: kolom saldo berjalan disembunyikan karena tidak mencerminkan seluruh transaksi.</p>' : ''}
    <div class="table-wrap"><table class="tbl"><thead><tr><th>No</th><th>Tanggal</th><th>Uraian</th><th>Kategori</th><th class="num">Masuk</th><th class="num">Keluar</th>${filtered ? '' : '<th class="num">Saldo</th>'}</tr></thead><tbody>
      ${filtered ? '' : `<tr><td></td><td>${fmtDate(L.from)}</td><td colspan="4"><i>Saldo awal periode</i></td><td class="num">${esc(rp(awal))}</td></tr>`}
      ${rows.map((k, i) => { run += k.jenis === 'Masuk' ? k.jumlah : -k.jumlah; return `<tr><td>${i + 1}</td><td style="white-space:nowrap">${fmtDate(k.tanggal)}</td><td>${esc([k.keterangan, k.anggota_id ? nameOf(k.anggota_id) : ''].filter(Boolean).join(' · ') || '–')}</td><td>${esc(k.kategori)}</td>
        <td class="num">${k.jenis === 'Masuk' ? esc(nf.format(k.jumlah)) : ''}</td><td class="num">${k.jenis === 'Keluar' ? esc(nf.format(k.jumlah)) : ''}</td>${filtered ? '' : `<td class="num">${esc(nf.format(run))}</td>`}</tr>`; }).join('')
      || `<tr><td colspan="7" class="empty">Tidak ada transaksi pada periode ini.</td></tr>`}
    </tbody><tfoot><tr><td colspan="4">Jumlah (${rows.length} transaksi)</td><td class="num">${esc(nf.format(tin))}</td><td class="num">${esc(nf.format(tout))}</td>${filtered ? '' : `<td class="num">${esc(nf.format(run))}</td>`}</tr></tfoot></table></div>`;
}
function lapKategori() {
  const L = S.lap, rows = S.data.kas.filter(k => k.tanggal >= L.from && k.tanggal <= L.to);
  const block = jenis => {
    const m = {}; rows.filter(k => k.jenis === jenis).forEach(k => { m[k.kategori] = m[k.kategori] || { n: 0, t: 0 }; m[k.kategori].n++; m[k.kategori].t += k.jumlah; });
    const tot = Object.values(m).reduce((s, x) => s + x.t, 0);
    const items = Object.entries(m).sort((a, b) => b[1].t - a[1].t);
    return `<div class="card chart-card" style="margin-bottom:12px"><h4>${jenis === 'Masuk' ? 'Pemasukan' : 'Pengeluaran'} <span class="${jenis === 'Masuk' ? 'in' : 'out'}" style="float:right">${esc(rp(tot))}</span></h4>
      ${items.length ? items.map(([k, v], i) => `<div style="margin:12px 0 0"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(k)} <small style="color:var(--muted)">(${v.n}×)</small></span><b>${esc(rp(v.t))}</b></div>
        <div class="bar" style="max-width:none;background:#eef2f7;margin-top:6px;height:7px"><i style="width:${Math.round(v.t / tot * 100)}%;background:${PALETTE[i % PALETTE.length]}"></i></div><small style="color:var(--muted);font-size:11px">${Math.round(v.t / tot * 100)}% dari total</small></div>`).join('') : '<p class="empty" style="padding:12px">Tidak ada data.</p>'}</div>`;
  };
  return block('Masuk') + block('Keluar');
}
function lapIuran() {
  const y = S.lap.year, kat = S.data.settings.kategori_iuran || 'Iuran Bulanan';
  const members = S.data.anggota.filter(a => wajib(a) || S.data.kas.some(k => k.anggota_id === a.id && k.kategori === kat && String(k.periode).startsWith(y + '-')))
    .sort((a, b) => a.nama.localeCompare(b.nama));
  const paid = {}; S.data.kas.forEach(k => { if (k.jenis === 'Masuk' && k.kategori === kat && String(k.periode).startsWith(y + '-') && k.anggota_id) { const key = k.anggota_id + '|' + k.periode; paid[key] = (paid[key] || 0) + k.jumlah; } });
  const curM = todayStr().slice(0, 4) == y ? Number(todayStr().slice(5, 7)) : (y < Number(todayStr().slice(0, 4)) ? 12 : 0);
  const colTot = Array(12).fill(0); let grand = 0, slots = 0, filled = 0;
  const rows = members.map(a => {
    let t = 0;
    const cells = BLN.map((b, i) => {
      const v = paid[a.id + '|' + y + '-' + String(i + 1).padStart(2, '0')] || 0; t += v; colTot[i] += v;
      if (i < curM && wajib(a)) { slots++; if (v) filled++; }
      return `<td class="num ${v ? 'ok' : 'no'}" title="${v ? esc(rp(v)) : 'belum'}">${v ? '✓' : (i < curM && wajib(a) ? '<span style="color:#ef4444">✕</span>' : '·')}</td>`;
    }).join('');
    grand += t;
    return `<tr><td style="white-space:nowrap">${esc(a.nama)}${wajib(a) ? '' : ' <small style="color:var(--muted)">(sukarela)</small>'}</td>${cells}<td class="num">${esc(nf.format(t))}</td></tr>`;
  }).join('');
  const pct = slots ? Math.round(filled / slots * 100) : 0;
  return {
    html: `<div class="summary" style="margin-bottom:12px"><div><small>Total iuran ${y}</small><b class="in">${esc(rp(grand))}</b></div><div><small>Kepatuhan s.d. bulan berjalan</small><b>${pct}% <small style="font-weight:600;color:var(--muted)">(${filled}/${slots})</small></b></div></div>
    <div class="table-wrap"><table class="tbl sticky1"><thead><tr><th>Anggota</th>${BLN.map(b => `<th class="num">${b}</th>`).join('')}<th class="num">Total</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="14" class="empty">Belum ada anggota wajib iuran. Centang "Wajib iuran" pada data anggota.</td></tr>`}</tbody>
    <tfoot><tr><td>Total</td>${colTot.map(v => `<td class="num">${v ? esc(rpShort(v)) : '–'}</td>`).join('')}<td class="num">${esc(nf.format(grand))}</td></tr></tfoot></table></div>
    <p style="font-size:11px;color:var(--muted);margin:8px 4px">✓ lunas · <span style="color:#ef4444">✕</span> belum bayar (bulan sudah lewat) · · bulan mendatang/tidak wajib. Dihitung dari kategori "${esc(kat)}" berdasarkan kolom periode.</p>`
  };
}
function csvCell(v) { const s = String(v === undefined || v === null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadCsv(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportLaporan() {
  const L = S.lap;
  if (L.tab === 'iuran') {
    const kat = S.data.settings.kategori_iuran || 'Iuran Bulanan';
    const rows = [['Anggota'].concat(BULAN, ['Total'])];
    S.data.anggota.filter(wajib).forEach(a => {
      let t = 0; const cells = BULAN.map((_, i) => { const v = S.data.kas.filter(k => k.anggota_id === a.id && k.kategori === kat && k.periode === L.year + '-' + String(i + 1).padStart(2, '0')).reduce((s, k) => s + k.jumlah, 0); t += v; return v; });
      rows.push([a.nama].concat(cells, [t]));
    });
    return downloadCsv(`rekap-iuran-${L.year}.csv`, rows);
  }
  const rows = [['Tanggal', 'Jenis', 'Kategori', 'Anggota', 'Keterangan', 'Metode', 'Periode', 'Jumlah']];
  lapRows().forEach(k => rows.push([k.tanggal, k.jenis, k.kategori, nameOf(k.anggota_id), k.keterangan, k.metode, k.periode, k.jenis === 'Masuk' ? k.jumlah : -k.jumlah]));
  downloadCsv(`laporan-kas-${L.from}_${L.to}.csv`, rows);
}

/* ===================== DASHBOARD KEUANGAN ===================== */
VIEWS.dashboard = function () {
  const D = S.dash, t = todayStr();
  if (!D.year) D.year = Number(t.slice(0, 4));
  const y = D.year, inY = k => k.tanggal.slice(0, 4) == y;
  const masuk = Array(12).fill(0), keluar = Array(12).fill(0);
  S.data.kas.filter(inY).forEach(k => { const m = Number(k.tanggal.slice(5, 7)) - 1; (k.jenis === 'Masuk' ? masuk : keluar)[m] += k.jumlah; });
  const saldoBulan = masuk.map((_, i) => saldoUntil(addMonths(y + '-' + String(i + 1).padStart(2, '0'), 1) + '-01'));
  const lastM = y == t.slice(0, 4) ? Number(t.slice(5, 7)) : 12;
  const tIn = masuk.reduce((a, b) => a + b, 0), tOut = keluar.reduce((a, b) => a + b, 0);
  const saldoNow = saldoUntil();
  const byCat = jenis => { const m = {}; S.data.kas.filter(k => inY(k) && k.jenis === jenis).forEach(k => { m[k.kategori] = (m[k.kategori] || 0) + k.jumlah; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const contrib = {}; S.data.kas.filter(k => inY(k) && k.jenis === 'Masuk' && k.anggota_id).forEach(k => { contrib[k.anggota_id] = (contrib[k.anggota_id] || 0) + k.jumlah; });
  const top = Object.entries(contrib).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const p = ym(t), iu = iuranStatus(p);
  // insight
  const ins = [];
  if (y == t.slice(0, 4) && lastM > 1) {
    const cur = keluar[lastM - 1], prev = keluar.slice(Math.max(0, lastM - 4), lastM - 1), avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    if (avg > 0) { const d = Math.round((cur - avg) / avg * 100); ins.push(`Pengeluaran ${BULAN[lastM - 1]} ${d >= 0 ? 'lebih tinggi' : 'lebih rendah'} <b>${Math.abs(d)}%</b> dibanding rata-rata ${prev.length} bulan sebelumnya.`); }
  }
  const oc = byCat('Keluar'); if (oc.length && tOut) ins.push(`Pos pengeluaran terbesar: <b>${esc(oc[0][0])}</b> (${Math.round(oc[0][1] / tOut * 100)}% dari total).`);
  if (tIn || tOut) ins.push(tIn >= tOut ? `Kas tahun ${y} <b>surplus ${esc(rp(tIn - tOut))}</b>.` : `Kas tahun ${y} <b>defisit ${esc(rp(tOut - tIn))}</b>. Pertimbangkan meninjau pengeluaran.`);
  const avgOut = lastM ? tOut / lastM : 0; if (avgOut > 0 && saldoNow > 0) ins.push(`Dengan rata-rata pengeluaran ${esc(rpShort(avgOut))}/bulan, saldo saat ini cukup untuk sekitar <b>${Math.floor(saldoNow / avgOut)} bulan</b>.`);

  return subhead('Dashboard Keuangan', { action: `<select class="input" id="dash-year" style="width:96px;height:38px;padding:4px 8px;background:#fff;color:#0f1b33" aria-label="Tahun">${yearOptions(y)}</select>` }) + `<div class="page">
    <div class="kpis">
      <div class="kpi dark" style="grid-column:1/-1"><small>Saldo kas saat ini</small><b style="font-size:26px">${esc(rp(saldoNow))}</b><span class="delta" style="color:${tIn >= tOut ? '#86efac' : '#fca5a5'}">${tIn >= tOut ? '▲' : '▼'} ${esc(rp(Math.abs(tIn - tOut)))} sepanjang ${y}</span></div>
      <div class="kpi"><small>Pemasukan ${y}</small><b class="in">${esc(rpShort(tIn))}</b><span class="delta" style="color:var(--muted)">${S.data.kas.filter(k => inY(k) && k.jenis === 'Masuk').length} transaksi</span></div>
      <div class="kpi"><small>Pengeluaran ${y}</small><b class="out">${esc(rpShort(tOut))}</b><span class="delta" style="color:var(--muted)">${S.data.kas.filter(k => inY(k) && k.jenis === 'Keluar').length} transaksi</span></div>
    </div>
    ${ins.length ? `<div class="insight" style="margin-top:12px"><span>💡</span><div>${ins.map(s => `<div style="margin-bottom:4px">${s}</div>`).join('')}</div></div>` : ''}
    <div class="card chart-card" style="margin-top:12px"><h4>Arus kas bulanan</h4><p class="sub">Pemasukan vs pengeluaran ${y}</p><div class="chart">${barChart(masuk, keluar)}</div>
      <div class="legend"><span><i style="background:#22c55e"></i>Masuk</span><span><i style="background:#f87171"></i>Keluar</span></div></div>
    <div class="card chart-card" style="margin-top:12px"><h4>Pergerakan saldo</h4><p class="sub">Saldo akhir tiap bulan</p><div class="chart">${lineChart(saldoBulan.slice(0, lastM), lastM)}</div></div>
    <div class="card chart-card" style="margin-top:12px"><h4>Iuran ${BULAN[Number(p.slice(5)) - 1]}</h4><p class="sub">${iu.lunas.length} dari ${iu.list.length} anggota wajib sudah membayar</p>
      ${iu.list.length ? `<div style="display:flex;gap:16px;align-items:center"><div class="ring" style="--p:${iu.pct};background:conic-gradient(var(--green) ${iu.pct}%,#e2e8f0 0)"><b style="color:var(--text)">${iu.pct}%</b></div>
        <div style="flex:1;min-width:0">${iu.belum.length ? `<small style="color:var(--muted);font-weight:700">Belum bayar</small><div class="rel-list" style="margin-top:6px">${iu.belum.slice(0, 12).map(a => `<button data-action="${isAdmin() ? 'catat-iuran' : 'person'}" data-id="${esc(a.id)}">${avatar(a)}${esc(a.panggilan || a.nama.split(' ')[0])}</button>`).join('')}</div>` : '<b class="in">Semua sudah lunas 🎉</b>'}</div></div>` : '<p class="empty" style="padding:8px">Belum ada anggota yang ditandai wajib iuran.</p>'}
      <style>.chart-card .ring::before{background:#fff}</style></div>
    <div class="card chart-card" style="margin-top:12px"><h4>Komposisi pengeluaran</h4><p class="sub">Per kategori, ${y}</p>${donut(oc)}</div>
    <div class="card chart-card" style="margin-top:12px"><h4>Komposisi pemasukan</h4><p class="sub">Per kategori, ${y}</p>${donut(byCat('Masuk'))}</div>
    <div class="card chart-card" style="margin-top:12px"><h4>Kontributor terbesar</h4><p class="sub">Total setoran anggota ${y}</p>
      ${top.length ? top.map(([id, v], i) => `<div class="rank"><span class="n">${i + 1}</span>${avatar(index().byId[id])}<span style="flex:1">${esc(nameOf(id) || '(terhapus)')}</span><b>${esc(rp(v))}</b></div>`).join('') : '<p class="empty" style="padding:8px">Belum ada setoran yang terkait anggota.</p>'}</div>
    <button class="btn ghost block" style="margin-top:14px" data-nav="laporan">Buka laporan lengkap →</button>
  </div>`;
};
VIEWS.dashboard.after = () => { const s = $('#dash-year'); if (s) s.onchange = () => { S.dash.year = Number(s.value); render(); }; };

function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 1.1) * p; }
function barChart(a, b) {
  const W = 340, H = 190, L = 36, B = 22, T = 8, max = niceMax(Math.max.apply(null, a.concat(b))), cw = (W - L) / 12, bw = Math.min(9, cw / 2 - 2);
  const yy = v => T + (H - T - B) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik arus kas bulanan">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4, Y = yy(v); s += `<line x1="${L}" x2="${W}" y1="${Y}" y2="${Y}" stroke="#eef2f7"/><text x="${L - 4}" y="${Y + 3}" text-anchor="end">${rpShort(v)}</text>`; }
  a.forEach((v, i) => {
    const x = L + i * cw + cw / 2;
    s += `<rect x="${x - bw - 1}" y="${yy(v)}" width="${bw}" height="${Math.max(0, H - B - yy(v))}" rx="3" fill="#22c55e"><title>${BULAN[i]} masuk ${rp(v)}</title></rect>`;
    s += `<rect x="${x + 1}" y="${yy(b[i])}" width="${bw}" height="${Math.max(0, H - B - yy(b[i]))}" rx="3" fill="#f87171"><title>${BULAN[i]} keluar ${rp(b[i])}</title></rect>`;
    s += `<text x="${x}" y="${H - 6}" text-anchor="middle">${BLN[i]}</text>`;
  });
  return s + '</svg>';
}
function lineChart(vals, n) {
  if (!n) return '<p class="empty" style="padding:8px">Belum ada data.</p>';
  const W = 340, H = 150, L = 36, B = 22, T = 10, mn = Math.min.apply(null, [0].concat(vals)), mx = niceMax(Math.max.apply(null, vals.concat([1]))), cw = (W - L) / 12;
  const yy = v => T + (H - T - B) * (1 - (v - mn) / (mx - mn || 1));
  const pts = vals.map((v, i) => [L + i * cw + cw / 2, yy(v)]);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik saldo"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6fed" stop-opacity=".35"/><stop offset="1" stop-color="#2f6fed" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i <= 3; i++) { const v = mn + (mx - mn) * i / 3, Y = yy(v); s += `<line x1="${L}" x2="${W}" y1="${Y}" y2="${Y}" stroke="#eef2f7"/><text x="${L - 4}" y="${Y + 3}" text-anchor="end">${rpShort(v)}</text>`; }
  if (pts.length > 1) s += `<path d="M${pts[0][0]},${H - B} L${pts.map(p => p.join(',')).join(' L')} L${pts[pts.length - 1][0]},${H - B}Z" fill="url(#lg)"/><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#2f6fed" stroke-width="2.5" stroke-linejoin="round"/>`;
  pts.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="#2f6fed" stroke-width="2"><title>${BULAN[i]}: ${rp(vals[i])}</title></circle>`; });
  BLN.forEach((b, i) => { s += `<text x="${L + i * cw + cw / 2}" y="${H - 6}" text-anchor="middle">${b}</text>`; });
  return s + '</svg>';
}
function donut(items) {
  const tot = items.reduce((s, x) => s + x[1], 0);
  if (!tot) return '<p class="empty" style="padding:8px">Belum ada data.</p>';
  // segmen donat digambar sebagai path agar tidak ada celah/artefak antar segmen
  const R = 56, r0 = 36, cx = 65, cy = 65; let a0 = -Math.PI / 2;
  const pt = (rad, a) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)].map(v => v.toFixed(2)).join(' ');
  const arcs = items.map(([k, v], i) => {
    const frac = v / tot, a1 = a0 + frac * 2 * Math.PI - (frac >= 1 ? 1e-4 : 0), big = frac > 0.5 ? 1 : 0;
    const d = `M${pt(R, a0)} A${R} ${R} 0 ${big} 1 ${pt(R, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 ${big} 0 ${pt(r0, a0)}Z`;
    a0 = a1; return `<path d="${d}" fill="${PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="1.5"><title>${esc(k)}: ${rp(v)}</title></path>`;
  }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 130 130">${arcs}<text x="65" y="62" text-anchor="middle" style="font-size:10px;fill:#64748b">Total</text><text x="65" y="78" text-anchor="middle" style="font-size:14px;font-weight:800;fill:#0f1b33">${rpShort(tot)}</text></svg>
    <div class="donut-legend">${items.map(([k, v], i) => `<div><i style="background:${PALETTE[i % PALETTE.length]}"></i><span>${esc(k)}</span><b>${Math.round(v / tot * 100)}%</b></div>`).join('')}</div></div>`;
}

/* ===================== AGENDA ===================== */
VIEWS.agenda = function () {
  const t = todayStr(), tab = S.agenda.tab;
  const up = S.data.agenda.filter(a => a.tanggal >= t).sort((a, b) => (a.tanggal + a.jam).localeCompare(b.tanggal + b.jam));
  const past = S.data.agenda.filter(a => a.tanggal < t).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  const list = tab === 'mendatang' ? up : past;
  const bd = birthdaysThisMonth();
  return subhead('Agenda Keluarga', { action: addBtn('add-agenda', 'Tambah agenda') }) + `<div class="page">
    <div class="seg">${[['mendatang', 'Mendatang (' + up.length + ')'], ['lalu', 'Sudah lewat (' + past.length + ')']].map(x => `<button class="${tab === x[0] ? 'active' : ''}" data-action="f-agenda" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
    <div class="list" style="margin-top:12px">${list.map(a => {
      const [, m, d] = a.tanggal.split('-'); const days = Math.round((new Date(a.tanggal) - new Date(t)) / 864e5);
      return `<button class="item" data-action="agenda-detail" data-id="${esc(a.id)}"><span class="ag-date ${a.tanggal < t ? 'past' : ''}"><b>${Number(d)}</b><small>${BLN[Number(m) - 1]}</small></span>
        <span class="tx"><b>${esc(a.judul)}</b><small>${a.jam ? esc(a.jam) + ' · ' : ''}${esc(a.lokasi || 'Lokasi belum diisi')}</small></span>
        ${a.tanggal >= t ? `<span class="chip ${days <= 7 ? 'amber' : ''}">${days === 0 ? 'Hari ini' : days + ' hari'}</span>` : ''}</button>`;
    }).join('') || '<div class="empty"><b>Tidak ada agenda</b></div>'}</div>
    ${tab === 'mendatang' && bd.length ? `<div class="section-head" style="margin-top:22px"><h3 style="font-size:16px">🎂 Ulang tahun ${BULAN[Number(t.slice(5, 7)) - 1]}</h3></div>
      <div class="list">${bd.map(a => `<button class="item" data-action="person" data-id="${esc(a.id)}">${avatar(a)}<span class="tx"><b>${esc(a.nama)}</b><small>${Number(a.tgl_lahir.slice(8))} ${BULAN[Number(a.tgl_lahir.slice(5, 7)) - 1]} · genap ${Number(t.slice(0, 4)) - Number(a.tgl_lahir.slice(0, 4))} tahun</small></span>${a.tgl_lahir.slice(5) === t.slice(5) ? '<span class="chip green">Hari ini</span>' : ''}</button>`).join('')}</div>` : ''}
  </div>`;
};
function gcalLink(a) {
  const d = a.tanggal.replace(/-/g, ''); let dates;
  if (a.jam) { const s = d + 'T' + a.jam.replace(':', '') + '00'; const [h, m] = a.jam.split(':').map(Number); const e = d + 'T' + String(Math.min(23, h + 2)).padStart(2, '0') + String(m).padStart(2, '0') + '00'; dates = s + '/' + e; }
  else { const n = addDays(a.tanggal, 1).replace(/-/g, ''); dates = d + '/' + n; }
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(a.judul) + '&dates=' + dates + '&ctz=Asia/Jakarta&details=' + encodeURIComponent(a.deskripsi || '') + '&location=' + encodeURIComponent(a.lokasi || '');
}
function agendaDetail(id) {
  const a = S.data.agenda.find(x => x.id === id); if (!a) return;
  const maps = a.lat && a.lng ? `https://www.google.com/maps?q=${a.lat},${a.lng}` : (a.lokasi ? 'https://www.google.com/maps/search/' + encodeURIComponent(a.lokasi) : '');
  openSheet('Agenda', `<h3 style="margin:0 0 6px;font-size:20px">${esc(a.judul)}</h3>
    <dl class="dl"><dt>Tanggal</dt><dd>${fmtDate(a.tanggal, true)}</dd>${a.jam ? `<dt>Jam</dt><dd>${esc(a.jam)} WIB</dd>` : ''}
      ${a.lokasi ? `<dt>Lokasi</dt><dd>${esc(a.lokasi)}</dd>` : ''}${a.penanggung_jawab ? `<dt>PJ</dt><dd>${esc(a.penanggung_jawab)}</dd>` : ''}
      ${a.deskripsi ? `<dt>Keterangan</dt><dd style="white-space:pre-line">${esc(a.deskripsi)}</dd>` : ''}</dl>
    <div class="btn-row" style="margin-top:16px"><a class="btn primary" href="${esc(gcalLink(a))}" target="_blank" rel="noopener">+ Google Calendar</a>${maps ? `<a class="btn ghost" href="${esc(maps)}" target="_blank" rel="noopener">Petunjuk arah</a>` : ''}</div>
    ${isAdmin() ? `<div class="btn-row"><button class="btn ghost" data-action="edit-agenda" data-id="${esc(id)}">Edit</button><button class="btn danger" data-action="del-agenda" data-id="${esc(id)}">Hapus</button></div>` : ''}`);
}
function formAgenda(a) {
  a = Object.assign({ tanggal: todayStr() }, a || {});
  openSheet(a.id ? 'Edit Agenda' : 'Tambah Agenda', `<form id="f-agenda" novalidate><input type="hidden" name="id" value="${esc(a.id || '')}">
    <div class="field"><label for="fg-j">Judul *</label><input class="input" id="fg-j" name="judul" required maxlength="120" value="${esc(a.judul || '')}"></div>
    <div class="row2"><div class="field"><label for="fg-t">Tanggal *</label><input class="input" id="fg-t" type="date" name="tanggal" required value="${esc(a.tanggal)}"></div>
      <div class="field"><label for="fg-h">Jam</label><input class="input" id="fg-h" type="time" name="jam" value="${esc(a.jam || '')}"></div></div>
    <div class="field"><label for="fg-l">Lokasi</label><input class="input" id="fg-l" name="lokasi" value="${esc(a.lokasi || '')}"></div>
    <div class="row2"><div class="field"><label for="fa-lat">Latitude</label><input class="input" id="fa-lat" name="lat" inputmode="decimal" value="${esc(a.lat || '')}"></div>
      <div class="field"><label for="fa-lng">Longitude</label><input class="input" id="fa-lng" name="lng" inputmode="decimal" value="${esc(a.lng || '')}"></div></div>
    <button type="button" class="btn ghost sm" data-action="pick-map" style="margin:-4px 0 12px">📍 Pilih di peta</button><div id="picker"></div>
    <div class="field"><label for="fg-pj">Penanggung jawab</label><input class="input" id="fg-pj" name="penanggung_jawab" value="${esc(a.penanggung_jawab || '')}"></div>
    <div class="field"><label for="fg-d">Keterangan</label><textarea class="input" id="fg-d" name="deskripsi">${esc(a.deskripsi || '')}</textarea></div>
    <button class="btn primary block" type="submit">Simpan</button></form>`, body => {
    $('#f-agenda', body).onsubmit = async ev => {
      ev.preventDefault(); const f = ev.target, btn = $('button[type=submit]', f), d = formData(f);
      if (!d.judul) return showErr(f, 'Judul wajib diisi.');
      busy(btn, true);
      try { const r = await api('apiSaveAgenda', S.token, d); upsert('agenda', r); closeSheet(); toast('Agenda tersimpan', 'ok'); render(); }
      catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}

/* ===================== GALERI ===================== */
VIEWS.galeri = function () {
  const albums = Array.from(new Set(S.data.galeri.map(g => g.album || 'Umum'))).sort();
  const al = S.galeri.album;
  const list = S.data.galeri.filter(g => !al || (g.album || 'Umum') === al).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  return subhead('Galeri Keluarga', { action: addBtn('add-foto', 'Unggah foto') }) + `<div class="page">
    <div class="filters" style="margin-bottom:12px"><button class="pill ${!al ? 'active' : ''}" data-action="f-album" data-v="">Semua (${S.data.galeri.length})</button>${albums.map(a => `<button class="pill ${al === a ? 'active' : ''}" data-action="f-album" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div>
    <div class="gallery">${list.map(g => `<button data-action="foto" data-id="${esc(g.id)}" aria-label="${esc(g.judul)}"><img src="${esc(g.foto_url)}" alt="${esc(g.judul)}" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>
    ${list.length ? '' : '<div class="empty"><b>Belum ada foto</b>' + (isAdmin() ? 'Tekan ＋ untuk mengunggah.' : '') + '</div>'}
  </div>`;
};
function lightbox(id) {
  const list = S.data.galeri.filter(g => !S.galeri.album || (g.album || 'Umum') === S.galeri.album).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
  let i = list.findIndex(g => g.id === id); const lb = $('#lightbox');
  const show = () => { const g = list[i]; lb.innerHTML = `<button class="icon-btn" data-lb="x" aria-label="Tutup">✕</button><img src="${esc(g.foto_url)}" alt="${esc(g.judul)}" referrerpolicy="no-referrer">
    <h3 style="margin:12px 0 2px">${esc(g.judul)}</h3><small style="opacity:.8">${esc(g.album || 'Umum')} · ${fmtDate(g.tanggal)}</small>${g.keterangan ? `<p style="font-size:13px;opacity:.85;max-width:420px">${esc(g.keterangan)}</p>` : ''}
    <div class="btn-row" style="width:100%;max-width:420px"><button class="btn ghost" data-lb="-1" ${i ? '' : 'disabled'}>‹ Sebelumnya</button><button class="btn ghost" data-lb="1" ${i < list.length - 1 ? '' : 'disabled'}>Berikutnya ›</button></div>
    ${isAdmin() ? `<button class="btn danger sm" style="margin-top:10px" data-lb="del">Hapus foto</button>` : ''}`; };
  lb.onclick = async e => {
    const b = e.target.closest('[data-lb]'); if (!b) { if (e.target === lb) lb.hidden = true; return; }
    const v = b.dataset.lb;
    if (v === 'x') lb.hidden = true;
    else if (v === 'del') { lb.hidden = true; if (await confirmSheet('Hapus foto?', 'Foto akan disembunyikan dari galeri. File di Drive tidak ikut terhapus.')) doDelete('apiDeleteGaleri', 'galeri', list[i].id); }
    else { i = Math.max(0, Math.min(list.length - 1, i + Number(v))); show(); }
  };
  show(); lb.hidden = false;
}
function formFoto() {
  const albums = Array.from(new Set(S.data.galeri.map(g => g.album).filter(Boolean)));
  openSheet('Unggah Foto', `<form id="f-foto" novalidate><input type="hidden" name="foto_url"><input type="hidden" name="file_id">
    <label class="card" style="display:grid;place-items:center;min-height:150px;cursor:pointer;border:2px dashed #c7d6ef;box-shadow:none" id="drop"><span style="color:var(--muted);font-size:14px">📷 Pilih foto (maks. 5 MB)</span><input type="file" accept="image/*" id="ff-file" hidden></label>
    <p style="text-align:center;font-size:12px;color:var(--muted)">atau tempel URL gambar:</p>
    <div class="field"><input class="input" id="ff-url" placeholder="https://…" aria-label="URL gambar"></div>
    <div class="field"><label for="ff-j">Judul</label><input class="input" id="ff-j" name="judul" maxlength="120"></div>
    <div class="row2"><div class="field"><label for="ff-a">Album</label><input class="input" id="ff-a" name="album" list="albums" placeholder="Umum"><datalist id="albums">${albums.map(a => `<option value="${esc(a)}">`).join('')}</datalist></div>
      <div class="field"><label for="ff-t">Tanggal</label><input class="input" id="ff-t" type="date" name="tanggal" value="${todayStr()}"></div></div>
    <div class="field"><label for="ff-k">Keterangan</label><textarea class="input" id="ff-k" name="keterangan"></textarea></div>
    <button class="btn primary block" type="submit">Simpan ke Galeri</button></form>`, body => {
    const f = $('#f-foto', body);
    $('#ff-file', f).onchange = e => uploadPicked(e.target, (url, fid) => { f.foto_url.value = url; f.file_id.value = fid; $('#drop', f).innerHTML = `<img src="${esc(url)}" alt="" style="max-width:100%;max-height:220px;border-radius:12px" referrerpolicy="no-referrer">`; });
    f.onsubmit = async ev => {
      ev.preventDefault(); const btn = $('button[type=submit]', f); const d = formData(f);
      if (!d.foto_url && $('#ff-url', f).value) d.foto_url = $('#ff-url', f).value.trim();
      if (!d.foto_url) return showErr(f, 'Pilih foto atau isi URL gambar.');
      busy(btn, true);
      try { const r = await api('apiSaveGaleri', S.token, d); upsert('galeri', r); closeSheet(); toast('Foto tersimpan', 'ok'); render(); }
      catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}
/** Mengecilkan gambar di browser (maks 1600px, JPEG) lalu mengunggah ke Drive. */
function uploadPicked(input, cb) {
  const file = input.files && input.files[0]; if (!file) return;
  if (!/^image\//.test(file.type)) return toast('File harus gambar', 'error');
  const lbl = input.closest('label'); if (lbl) lbl.style.opacity = '.5';
  const img = new Image(), rd = new FileReader();
  rd.onload = () => { img.src = rd.result; };
  img.onload = async () => {
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.85);
    toast('Mengunggah foto…');
    try { const r = await api('apiUploadImage', S.token, data, file.name.replace(/\.\w+$/, '') + '.jpg'); cb(r.url, r.file_id); toast('Foto terunggah', 'ok'); }
    catch (e) { toast(e.message, 'error'); handleAuthErr(e); } finally { if (lbl) lbl.style.opacity = ''; }
  };
  img.onerror = () => toast('Gambar tidak bisa dibaca', 'error');
  rd.readAsDataURL(file);
}

/* ===================== PETA ===================== */
// Leaflet dimuat hanya saat peta dibuka, agar server peta yang lambat tidak menahan aplikasi.
let _leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (_leafletP) return _leafletP;
  _leafletP = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = res; s.onerror = () => { _leafletP = null; rej(new Error('leaflet')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!window.L) { _leafletP = null; rej(new Error('timeout')); } }, 15000);
  });
  return _leafletP;
}
VIEWS.peta = function () {
  const withLoc = S.data.anggota.filter(a => a.lat && a.lng), agLoc = S.data.agenda.filter(a => a.lat && a.lng);
  return subhead('Peta Keluarga') + `<div class="page">
    <p style="font-size:12px;color:var(--muted);margin:0 4px 10px">${withLoc.length} rumah anggota · ${agLoc.length} lokasi agenda${S.role === 'tamu' ? ' · Lokasi rumah hanya tampil setelah login PIN keluarga.' : ''}</p>
    <div id="map" class="map"></div>
    ${!withLoc.length && !agLoc.length ? '<div class="empty"><b>Belum ada koordinat</b>Isi latitude/longitude di data anggota atau agenda (tombol "Pilih di peta").</div>' : ''}
  </div>`;
};
VIEWS.peta.after = function () {
  const box = $('#map'); box.innerHTML = '<div class="empty">Memuat peta…</div>';
  loadLeaflet().then(() => { if (S.view === 'peta' && $('#map') === box) { box.innerHTML = ''; drawPeta(); } })
    .catch(() => { box.innerHTML = '<div class="empty"><b>Peta gagal dimuat</b>Server peta tidak terjangkau. Periksa koneksi lalu buka menu Peta lagi.</div>'; });
};
function drawPeta() {
  const m = L.map('map', { zoomControl: true }).setView([-2.5, 118], 5); S.map = m;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const pts = [];
  const pin = (color, html) => L.divIcon({ className: '', html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};display:grid;place-items:center;box-shadow:0 4px 10px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px">${html}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30] });
  S.data.anggota.filter(a => a.lat && a.lng).forEach(a => {
    const ll = [Number(a.lat), Number(a.lng)]; pts.push(ll);
    L.marker(ll, { icon: pin(a.jenis_kelamin === 'P' ? '#ec4899' : '#2f6fed', esc(initials(a.nama))) }).addTo(m)
      .bindPopup(`<b>${esc(a.nama)}</b><br>${esc(a.alamat || '')}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${ll.join(',')}" target="_blank" rel="noopener">Petunjuk arah</a>`);
  });
  S.data.agenda.filter(a => a.lat && a.lng).forEach(a => {
    const ll = [Number(a.lat), Number(a.lng)]; pts.push(ll);
    L.marker(ll, { icon: pin('#f59e0b', '★') }).addTo(m).bindPopup(`<b>${esc(a.judul)}</b><br>${fmtDate(a.tanggal)} ${esc(a.jam || '')}<br>${esc(a.lokasi || '')}`);
  });
  if (pts.length) m.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  setTimeout(() => m.invalidateSize(), 200);
};
function mapPicker(form) {
  if (!window.L) { toast('Memuat peta…'); loadLeaflet().then(() => mapPicker(form)).catch(() => toast('Peta tidak tersedia. Isi koordinat manual.', 'error')); return; }
  const box = $('#picker', form);
  if (box.dataset.on) { box.innerHTML = ''; delete box.dataset.on; return; }
  box.dataset.on = '1'; box.innerHTML = '<div id="pick-map" style="height:240px;border-radius:14px;margin-bottom:12px"></div>';
  const lat = $('[name=lat]', form), lng = $('[name=lng]', form);
  const start = lat.value && lng.value ? [Number(lat.value), Number(lng.value)] : [-6.9, 109.7];
  const m = L.map('pick-map').setView(start, lat.value ? 15 : 8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(m);
  let mk = lat.value ? L.marker(start).addTo(m) : null;
  m.on('click', e => { lat.value = e.latlng.lat.toFixed(6); lng.value = e.latlng.lng.toFixed(6); if (mk) mk.setLatLng(e.latlng); else mk = L.marker(e.latlng).addTo(m); });
  setTimeout(() => m.invalidateSize(), 150);
  toast('Ketuk peta untuk menandai lokasi');
}

/* ===================== BERITA KELUARGA ===================== */
const BERITA_META = {
  'Kabar Gembira': ['🎉', '#f59e0b', 'Ikut senang'], 'Kelahiran': ['👶', '#ec4899', 'Selamat'], 'Pernikahan': ['💍', '#8b5cf6', 'Selamat'],
  'Prestasi': ['🏆', '#eab308', 'Bangga'], 'Pendidikan': ['🎓', '#2f6fed', 'Selamat'], 'Pekerjaan': ['💼', '#0ea5e9', 'Semangat'],
  'Kesehatan': ['🏥', '#14b8a6', 'Doakan'], 'Duka Cita': ['🕊️', '#64748b', 'Turut berduka'], 'Pengumuman': ['📢', '#1e3a6e', 'Siap'], 'Lainnya': ['📝', '#94a3b8', 'Suka']
};
function bMeta(k) { return BERITA_META[k] || BERITA_META.Lainnya; }
function isMember() { return S.role === 'admin' || S.role === 'anggota'; }
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T')), s = (Date.now() - d.getTime()) / 1000;
  if (isNaN(s)) return '';
  if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; if (s < 604800) return Math.floor(s / 86400) + ' hari lalu';
  return fmtDate(String(iso).slice(0, 10));
}
/** Escape dulu, baru ubah baris baru & tautan https menjadi HTML. */
function richText(t) {
  return esc(t).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
function beritaSorted(status) {
  return S.data.berita.filter(b => !status || b.status === status)
    .sort((a, b) => (b.disematkan - a.disematkan) || String(b.created_at).localeCompare(String(a.created_at)));
}
function komentarOf(id) { return S.data.komentar.filter(k => k.berita_id === id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))); }
function reacted(id) { try { return (JSON.parse(localStorage.getItem('af_reaksi') || '[]')).includes(id); } catch (e) { return false; } }
function markReacted(id) { try { const a = JSON.parse(localStorage.getItem('af_reaksi') || '[]'); a.push(id); localStorage.setItem('af_reaksi', JSON.stringify(a.slice(-300))); } catch (e) {} }
function beritaSeen() { try { return localStorage.getItem('af_berita_seen') || ''; } catch (e) { return ''; } }
function beritaBaru() { const s = beritaSeen(); return S.data.berita.filter(b => b.status === 'Terbit' && String(b.created_at) > s).length; }
function beritaPending() { return isAdmin() ? S.data.berita.filter(b => b.status === 'Menunggu').length : 0; }

function beritaCard(b, compact) {
  const m = bMeta(b.kategori), p = index().byId[b.penulis_id];
  const tags = String(b.terkait_ids || '').split(',').filter(Boolean).map(id => index().byId[id]).filter(Boolean);
  const nK = komentarOf(b.id).length;
  const statusChip = b.status === 'Menunggu' ? '<span class="chip amber">Menunggu persetujuan</span>' : b.status === 'Ditolak' ? '<span class="chip red">Ditolak</span>' : '';
  return `<article class="news ${compact ? 'compact' : ''}" style="--nc:${m[1]}">
    <button class="news-hit" data-action="berita-detail" data-id="${esc(b.id)}" aria-label="Buka berita ${esc(b.judul)}"></button>
    <header class="news-head">${avatar(p)}<div class="news-by"><b>${esc(p ? p.nama : 'Anggota')}</b><small>${esc(timeAgo(b.created_at))}</small></div>
      ${b.disematkan ? '<span class="chip" title="Disematkan">📌</span>' : ''}<span class="news-cat">${m[0]} ${esc(b.kategori)}</span></header>
    ${statusChip ? `<div style="margin:8px 0 0">${statusChip}</div>` : ''}
    <h4 class="news-title">${esc(b.judul)}</h4>
    <p class="news-body">${richText(b.isi)}</p>
    ${b.foto_url && !compact ? `<img class="news-img" src="${esc(b.foto_url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
    ${tags.length && !compact ? `<div class="rel-list" style="margin-top:10px">${tags.map(a => `<span class="chip gray">${esc(a.panggilan || a.nama)}</span>`).join('')}</div>` : ''}
    <footer class="news-foot">
      <button class="react ${reacted(b.id) ? 'on' : ''}" data-action="berita-react" data-id="${esc(b.id)}" ${b.status !== 'Terbit' ? 'disabled' : ''}>${b.kategori === 'Duka Cita' || b.kategori === 'Kesehatan' ? '🤲' : '❤️'} ${esc(m[2])}${b.reaksi ? ' · ' + b.reaksi : ''}</button>
      <span class="news-meta">💬 ${nK}</span>
    </footer>
  </article>`;
}

VIEWS.berita = function () {
  if (!isMember()) return subhead('Kabar Keluarga') + `<div class="page"><div class="card" style="text-align:center">
    <div style="font-size:40px">📰</div><h3 style="margin:8px 0 4px">Khusus anggota keluarga</h3>
    <p style="color:var(--muted);font-size:14px;margin:0 0 14px">Masuk dengan PIN keluarga untuk membaca dan menulis kabar.</p>
    <button class="btn primary" data-action="login-member">Masuk dengan PIN</button></div></div>`;
  try { localStorage.setItem('af_berita_seen', nowLocalIso()); } catch (e) {}
  const f = S.berita;
  const pending = beritaPending();
  let list = f.tab === 'menunggu' ? beritaSorted('Menunggu') : beritaSorted('Terbit');
  if (f.kat) list = list.filter(b => b.kategori === f.kat);
  const kats = S.data.beritaKategori || Object.keys(BERITA_META);
  return subhead('Kabar Keluarga', { action: `<button class="icon-btn" data-action="add-berita" aria-label="Tulis berita" title="Tulis berita">✎</button>` }) + `<div class="page">
    <button class="compose" data-action="add-berita">${avatar(index().byId[store.get('af_me')] || null)}<span>Ada kabar apa hari ini?</span><b>Tulis</b></button>
    ${isAdmin() ? `<div class="seg" style="margin:12px 0 0"><button class="${f.tab !== 'menunggu' ? 'active' : ''}" data-action="f-berita-tab" data-v="terbit">Terbit</button><button class="${f.tab === 'menunggu' ? 'active' : ''}" data-action="f-berita-tab" data-v="menunggu">Menunggu ${pending ? `<span class="badge" style="position:static;display:inline-grid;margin-left:4px">${pending}</span>` : ''}</button></div>` : ''}
    <div class="filters" style="margin-top:12px"><button class="pill ${!f.kat ? 'active' : ''}" data-action="f-berita-kat" data-v="">Semua</button>${kats.map(k => `<button class="pill ${f.kat === k ? 'active' : ''}" data-action="f-berita-kat" data-v="${esc(k)}">${bMeta(k)[0]} ${esc(k)}</button>`).join('')}</div>
    <div class="news-list">${list.map(b => beritaCard(b)).join('') || `<div class="empty"><b>${f.tab === 'menunggu' ? 'Tidak ada yang menunggu' : 'Belum ada kabar'}</b>${f.tab === 'menunggu' ? 'Semua berita sudah ditinjau.' : 'Jadilah yang pertama berbagi kabar keluarga.'}</div>`}</div>
  </div>`;
};
function nowLocalIso() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }

function beritaDetail(id) {
  const b = S.data.berita.find(x => x.id === id); if (!b) return;
  const m = bMeta(b.kategori), p = index().byId[b.penulis_id];
  const tags = String(b.terkait_ids || '').split(',').filter(Boolean).map(i => index().byId[i]).filter(Boolean);
  const kom = komentarOf(id);
  const me = store.get('af_me') || '';
  const memberOpts = S.data.anggota.filter(alive).sort((x, y) => x.nama.localeCompare(y.nama)).map(a => `<option value="${esc(a.id)}" ${a.id === me ? 'selected' : ''}>${esc(a.nama)}</option>`).join('');
  openSheet(m[0] + ' ' + b.kategori, `
    <div class="news-head" style="margin-bottom:10px">${avatar(p)}<div class="news-by"><b>${esc(p ? p.nama : 'Anggota')}</b><small>${esc(timeAgo(b.created_at))}${b.created_by === 'admin' ? ' · via admin' : ''}</small></div></div>
    ${b.status !== 'Terbit' ? `<p class="insight" style="margin:0 0 10px">Status: <b>${esc(b.status)}</b>. Berita ini belum terlihat oleh anggota lain.</p>` : ''}
    <h3 style="margin:0 0 8px;font-size:20px;line-height:1.3">${esc(b.judul)}</h3>
    <div style="font-size:14px;line-height:1.6;color:#1e293b">${richText(b.isi)}</div>
    ${b.foto_url ? `<img class="news-img" src="${esc(b.foto_url)}" alt="" referrerpolicy="no-referrer" style="margin-top:12px">` : ''}
    ${tags.length ? `<h4 style="margin:14px 0 8px;font-size:12px;color:var(--muted)">Anggota terkait</h4><div class="rel-list">${tags.map(a => `<button data-action="person" data-id="${esc(a.id)}">${avatar(a)}${esc(a.panggilan || a.nama)}</button>`).join('')}</div>` : ''}
    ${isAdmin() ? `<div class="btn-row" style="margin-top:14px;flex-wrap:wrap">
        ${b.status !== 'Terbit' ? `<button class="btn primary sm" data-action="berita-mod" data-reopen="1" data-v="terbit" data-id="${esc(id)}">✓ Terbitkan</button>` : `<button class="btn ghost sm" data-action="berita-mod" data-reopen="1" data-v="${b.disematkan ? 'lepas' : 'sematkan'}" data-id="${esc(id)}">${b.disematkan ? 'Lepas sematan' : '📌 Sematkan'}</button>`}
        ${b.status === 'Menunggu' ? `<button class="btn danger sm" data-action="berita-mod" data-reopen="1" data-v="tolak" data-id="${esc(id)}">Tolak</button>` : ''}
        <button class="btn ghost sm" data-action="edit-berita" data-id="${esc(id)}">Edit</button><button class="btn danger sm" data-action="del-berita" data-id="${esc(id)}">Hapus</button></div>` : ''}
    ${b.status === 'Terbit' ? `
    <h4 style="margin:20px 0 8px;font-size:14px">Komentar (${kom.length})</h4>
    <div class="comments">${kom.map(k => { const a = index().byId[k.penulis_id]; return `<div class="cmt">${avatar(a)}<div class="cmt-b"><b>${esc(a ? a.nama : 'Anggota')}</b> <small>${esc(timeAgo(k.created_at))}</small><p>${richText(k.isi)}</p>${isAdmin() ? `<button class="link" style="font-size:11px" data-action="del-komentar" data-id="${esc(k.id)}" data-b="${esc(id)}">hapus</button>` : ''}</div></div>`; }).join('') || '<p style="color:var(--muted);font-size:13px;margin:0">Belum ada komentar.</p>'}</div>
    <form id="f-kom" style="margin-top:12px"><div class="row2" style="grid-template-columns:1fr"><select class="input" name="penulis_id" aria-label="Nama Anda" required><option value="">Nama Anda…</option>${memberOpts}</select></div>
      <div style="display:flex;gap:8px;margin-top:8px"><input class="input" name="isi" maxlength="500" placeholder="Tulis komentar…" aria-label="Komentar" required><button class="btn primary" style="height:44px">Kirim</button></div></form>` : ''}`,
  body => {
    const f = $('#f-kom', body); if (!f) return;
    f.onsubmit = async ev => {
      ev.preventDefault(); const d = formData(f); const btn = $('button', f);
      if (!d.penulis_id) return showErr(f, 'Pilih nama Anda dulu.');
      if (!d.isi) return;
      d.berita_id = id; busy(btn, true);
      try { const r = await api('apiSaveKomentar', S.token, d); store.set('af_me', d.penulis_id); S.data.komentar.push(r); beritaDetail(id); render(); }
      catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}

function formBerita(b) {
  b = Object.assign({ kategori: 'Kabar Gembira', penulis_id: store.get('af_me') || '' }, b || {});
  const kats = S.data.beritaKategori || Object.keys(BERITA_META);
  const tags = String(b.terkait_ids || '').split(',');
  const people = S.data.anggota.filter(a => alive(a) || tags.includes(a.id)).sort((x, y) => x.nama.localeCompare(y.nama));
  const moderated = !isAdmin() && String(S.data.settings.moderasi_berita || 'Ya') !== 'Tidak';
  openSheet(b.id ? 'Edit Berita' : 'Tulis Kabar Keluarga', `<form id="f-berita" novalidate>
    <input type="hidden" name="id" value="${esc(b.id || '')}"><input type="hidden" name="foto_url" value="${esc(b.foto_url || '')}"><input type="hidden" name="file_id" value="${esc(b.file_id || '')}">
    ${moderated ? '<p class="insight" style="margin:0 0 12px">Berita akan tampil untuk keluarga setelah disetujui admin.</p>' : ''}
    <div class="field"><label for="fb-p">Ditulis oleh *</label><select class="input" id="fb-p" name="penulis_id" required><option value="">Pilih nama Anda…</option>${people.filter(alive).map(a => `<option value="${esc(a.id)}" ${a.id === b.penulis_id ? 'selected' : ''}>${esc(a.nama)}</option>`).join('')}</select></div>
    <div class="field"><label>Kategori *</label><div class="kat-grid">${kats.map(k => `<label class="kat"><input type="radio" name="kategori" value="${esc(k)}" ${k === b.kategori ? 'checked' : ''}><span>${bMeta(k)[0]}<small>${esc(k)}</small></span></label>`).join('')}</div></div>
    <div class="field"><label for="fb-j">Judul *</label><input class="input" id="fb-j" name="judul" maxlength="120" placeholder="Contoh: Alhamdulillah, Rizki lulus S2" value="${esc(b.judul || '')}"></div>
    <div class="field"><label for="fb-i">Cerita / kabar *</label><textarea class="input" id="fb-i" name="isi" maxlength="3000" rows="6" placeholder="Ceritakan kabarnya…">${esc(b.isi || '')}</textarea><span class="hint" id="fb-cnt"></span></div>
    <div class="field"><label for="fb-t">Anggota yang diberitakan</label><select class="input" id="fb-t" multiple size="4">${people.map(a => `<option value="${esc(a.id)}" ${tags.includes(a.id) ? 'selected' : ''}>${esc(a.nama)}</option>`).join('')}</select><span class="hint">Opsional. Tahan Ctrl/⌘ untuk memilih lebih dari satu.</span></div>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px"><label class="btn ghost sm" style="cursor:pointer">📷 ${b.foto_url ? 'Ganti foto' : 'Tambah foto'}<input type="file" accept="image/*" id="fb-f" hidden></label><span id="fb-prev">${b.foto_url ? `<img src="${esc(b.foto_url)}" alt="" style="height:54px;border-radius:10px" referrerpolicy="no-referrer">` : ''}</span></div>
    <button class="btn primary block" type="submit">${b.id ? 'Simpan perubahan' : moderated ? 'Kirim untuk ditinjau' : 'Terbitkan'}</button></form>`, body => {
    const f = $('#f-berita', body), isi = $('#fb-i', f), cnt = $('#fb-cnt', f);
    const upd = () => { cnt.textContent = isi.value.length + ' / 3000'; }; isi.addEventListener('input', upd); upd();
    $('#fb-f', f).onchange = e => uploadPicked(e.target, (url, fid) => { f.foto_url.value = url; f.file_id.value = fid; $('#fb-prev', f).innerHTML = `<img src="${esc(url)}" alt="" style="height:54px;border-radius:10px" referrerpolicy="no-referrer">`; });
    f.onsubmit = async ev => {
      ev.preventDefault(); const btn = $('button[type=submit]', f); const d = formData(f);
      d.kategori = (f.querySelector('input[name=kategori]:checked') || {}).value || '';
      d.terkait_ids = $$('#fb-t option:checked', f).map(o => o.value).join(',');
      if (!d.penulis_id) return showErr(f, 'Pilih nama Anda sebagai penulis.');
      if (!d.judul || d.judul.length < 3) return showErr(f, 'Judul minimal 3 huruf.');
      if (!d.isi) return showErr(f, 'Isi berita masih kosong.');
      busy(btn, true);
      try {
        const r = await api('apiSaveBerita', S.token, d); store.set('af_me', d.penulis_id);
        if (r.status === 'Terbit' || isAdmin()) upsert('berita', r);
        closeSheet(); toast(r.status === 'Menunggu' ? 'Terkirim. Menunggu persetujuan admin.' : 'Berita diterbitkan', 'ok');
        if (S.view !== 'berita') go('berita'); else render();
      } catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); }
    };
  });
}

/* ===================== CARI ===================== */
VIEWS.cari = function () {
  const q = S.cari.q.trim().toLowerCase();
  let res = '';
  if (q.length >= 2) {
    const ag = S.data.anggota.filter(a => (a.nama + ' ' + a.panggilan + ' ' + a.pekerjaan + ' ' + a.alamat).toLowerCase().includes(q)).slice(0, 20);
    const ev = S.data.agenda.filter(a => (a.judul + ' ' + a.lokasi + ' ' + a.deskripsi).toLowerCase().includes(q)).slice(0, 10);
    const ks = S.data.kas.filter(k => (k.kategori + ' ' + k.keterangan + ' ' + nameOf(k.anggota_id)).toLowerCase().includes(q)).slice(0, 15);
    const br = S.data.berita.filter(b => b.status === 'Terbit' && (b.judul + ' ' + b.isi + ' ' + b.kategori).toLowerCase().includes(q)).slice(0, 10);
    const gl = S.data.galeri.filter(g => (g.judul + ' ' + g.album + ' ' + g.keterangan).toLowerCase().includes(q)).slice(0, 9);
    const sec = (t, h) => h ? `<h4 style="margin:18px 4px 8px;font-size:13px;color:var(--muted)">${t}</h4>${h}` : '';
    res = sec('Anggota', ag.length ? `<div class="list">${ag.map(a => `<button class="item" data-action="person" data-id="${esc(a.id)}">${avatar(a)}<span class="tx"><b>${esc(a.nama)}</b><small>${esc(a.pekerjaan || years(a))}</small></span></button>`).join('')}</div>` : '')
      + sec('Agenda', ev.length ? `<div class="list">${ev.map(a => `<button class="item" data-action="agenda-detail" data-id="${esc(a.id)}"><span class="ic ev">📅</span><span class="tx"><b>${esc(a.judul)}</b><small>${fmtDate(a.tanggal)}</small></span></button>`).join('')}</div>` : '')
      + sec('Kabar keluarga', br.length ? `<div class="news-list">${br.map(b => beritaCard(b, true)).join('')}</div>` : '')
      + sec('Transaksi', ks.length ? `<div class="list">${ks.map(kasItem).join('')}</div>` : '')
      + sec('Galeri', gl.length ? `<div class="gallery">${gl.map(g => `<button data-action="foto" data-id="${esc(g.id)}"><img src="${esc(g.foto_url)}" alt="${esc(g.judul)}" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>` : '');
    if (!res) res = '<div class="empty"><b>Tidak ditemukan</b>Coba kata kunci lain.</div>';
  } else res = '<div class="empty">Ketik minimal 2 huruf untuk mencari anggota, agenda, transaksi, atau foto.</div>';
  return subhead('Cari', { extra: `<label class="search">${SEARCH_IC}<input id="q-cari" type="search" placeholder="Cari apa saja…" value="${esc(S.cari.q)}" aria-label="Cari"></label>` }) + `<div class="page">${res}</div>`;
};
VIEWS.cari.after = () => { bindSearch('#q-cari', v => { S.cari.q = v; }); if (!S.cari.q) $('#q-cari').focus(); };

/* ===================== AKUN & PENGATURAN ===================== */
VIEWS.akun = function () {
  const st = S.data.settings, roleName = { admin: 'Admin', anggota: 'Anggota keluarga', tamu: 'Pengunjung (tanpa login)' }[S.role] || '-';
  return subhead('Akun & Pengaturan') + `<div class="page">
    <div class="card" style="display:flex;gap:14px;align-items:center"><div class="hh-avatar" style="color:#fff">${esc(initials(roleName))}</div><div style="flex:1"><small style="color:var(--muted)">Masuk sebagai</small><h3 style="margin:2px 0 0">${esc(roleName)}</h3></div></div>
    <div class="btn-row" style="margin-top:12px">${isAdmin() ? '<button class="btn ghost" data-action="logout">Keluar dari Admin</button>' : '<button class="btn primary" data-action="login-admin">Masuk sebagai Admin</button>'}
      ${S.role === 'tamu' ? '<button class="btn ghost" data-action="login-member">PIN keluarga</button>' : ''}${S.role === 'anggota' ? '<button class="btn ghost" data-action="logout">Keluar</button>' : ''}</div>
    <button class="btn ghost block" style="margin-top:10px" data-action="reload">⟳ Muat ulang data</button>
    ${isAdmin() && S.data.appUrl && !window.AF_ADMIN ? `<a class="btn dark block" style="margin-top:10px" href="${esc(S.data.appUrl)}?page=admin" target="_blank" rel="noopener">🖥 Buka Panel Admin (web)</a>` : ''}
    ${isAdmin() ? `
    <h3 style="margin:24px 4px 10px;font-size:16px">Pengaturan</h3>
    <form id="f-set" class="card" novalidate>
      <div class="field"><label for="s-n">Nama keluarga</label><input class="input" id="s-n" name="nama_keluarga" value="${esc(st.nama_keluarga)}"></div>
      <div class="row2"><div class="field"><label for="s-i">Iuran bulanan (Rp)</label><input class="input" id="s-i" name="iuran_bulanan" inputmode="numeric" value="${esc(st.iuran_bulanan)}"></div>
        <div class="field"><label for="s-k">Kategori iuran</label><select class="input" id="s-k" name="kategori_iuran">${S.data.kategori.filter(k => k.jenis === 'Masuk').map(k => `<option ${k.nama === st.kategori_iuran ? 'selected' : ''}>${esc(k.nama)}</option>`).join('')}</select></div></div>
      <div class="field"><label for="s-m">Moderasi berita dari anggota</label><select class="input" id="s-m" name="moderasi_berita"><option value="Ya" ${st.moderasi_berita !== 'Tidak' ? 'selected' : ''}>Ya, tampil setelah disetujui admin</option><option value="Tidak" ${st.moderasi_berita === 'Tidak' ? 'selected' : ''}>Tidak, langsung terbit</option></select></div>
      <div class="row2"><div class="field"><label for="s-s">Saldo awal (Rp)</label><input class="input" id="s-s" name="saldo_awal" inputmode="numeric" value="${esc(st.saldo_awal)}"></div>
        <div class="field"><label for="s-t">Per tanggal</label><input class="input" id="s-t" type="date" name="tanggal_saldo_awal" value="${esc(st.tanggal_saldo_awal)}"></div></div>
      <div class="field"><label for="s-l">URL logo</label><input class="input" id="s-l" name="logo_url" placeholder="https://" value="${esc(st.logo_url)}"></div>
      <button class="btn primary block" type="submit">Simpan pengaturan</button></form>
    <h3 style="margin:24px 4px 10px;font-size:16px">Kategori transaksi</h3>
    <div class="card">${['Masuk', 'Keluar'].map(j => `<h4 style="margin:4px 0 8px;font-size:13px">${j === 'Masuk' ? 'Pemasukan' : 'Pengeluaran'}</h4><div class="rel-list" style="margin-bottom:12px">${S.data.kategori.filter(k => k.jenis === j).map(k => `<button data-action="del-kat" data-id="${esc(k.id)}" style="padding:6px 12px" title="Hapus">${esc(k.nama)} <span style="color:var(--red)">✕</span></button>`).join('')}</div>`).join('')}
      <form id="f-kat" class="row2" style="align-items:end"><select class="input" name="jenis" aria-label="Jenis kategori"><option>Masuk</option><option>Keluar</option></select><div style="display:flex;gap:6px"><input class="input" name="nama" placeholder="Kategori baru" aria-label="Nama kategori"><button class="btn dark sm" style="height:44px">＋</button></div></form></div>` : ''}
    <p style="text-align:center;color:var(--muted);font-size:12px;margin:24px 0">${esc(S.data.app.name)} v${esc(S.data.app.version)}</p>
  </div>`;
};
VIEWS.akun.after = function () {
  const f = $('#f-set');
  if (f) f.onsubmit = async ev => { ev.preventDefault(); const btn = $('button[type=submit]', f); busy(btn, true);
    try { S.data.settings = await api('apiSaveSettings', S.token, formData(f)); toast('Pengaturan tersimpan', 'ok'); render(); } catch (e) { showErr(f, e.message); handleAuthErr(e); } finally { busy(btn, false); } };
  const k = $('#f-kat');
  if (k) k.onsubmit = async ev => { ev.preventDefault(); const d = formData(k); if (!d.nama) return;
    try { const r = await api('apiSaveKategori', S.token, d); S.data.kategori.push(r); toast('Kategori ditambahkan', 'ok'); render(); } catch (e) { toast(e.message, 'error'); handleAuthErr(e); } };
};

/* ===================== LOGIN / SESI ===================== */
function loginSheet(role) {
  openSheet(role === 'admin' ? 'Aktifkan Mode Admin' : 'Masuk Anggota', `<form id="f-login" data-role="${role}"><p style="margin:0 0 12px;font-size:14px;color:var(--muted)">${role === 'admin' ? 'Mode Admin membuka fitur tambah, ubah, dan hapus data.' : 'Masukkan PIN keluarga untuk melihat kontak dan lokasi anggota.'}</p>${pinField()}<button class="btn primary block">Masuk</button></form>`,
    body => bindLogin($('#f-login', body)));
}
function bindLogin(f) {
  f.onsubmit = async ev => {
    ev.preventDefault(); const btn = $('button', f); busy(btn, true);
    try {
      const r = await api('apiLogin', f.pin.value, f.dataset.role);
      S.token = r.token; store.set('af_token', r.token); closeSheet(); toast(r.role === 'admin' ? 'Mode Admin aktif' : 'Berhasil masuk', 'ok'); await reload();
    } catch (e) { showErr(f, e.message); f.pin.value = ''; } finally { busy(btn, false); }
  };
}
async function logout() { try { await api('apiLogout', S.token); } catch (e) {} S.token = null; store.set('af_token', null); toast('Anda keluar'); await reload(); }
function handleAuthErr(e) { if (e && (e.code === 'FORBIDDEN' || e.code === 'AUTH_REQUIRED')) { S.token = null; store.set('af_token', null); setTimeout(reload, 1200); } }
function requireAdminUI() { if (isAdmin()) return true; loginSheet('admin'); return false; }

/* ---------- data lokal ---------- */
function upsert(list, rec) { const arr = S.data[list]; const i = arr.findIndex(x => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.push(rec); invalidate(); }
async function doDelete(fn, list, id) {
  try { await api(fn, S.token, id); S.data[list] = S.data[list].filter(x => x.id !== id); invalidate(); closeSheet(); toast('Data dihapus', 'ok'); render(); }
  catch (e) { toast(e.message, 'error'); handleAuthErr(e); }
}
async function reload() {
  try {
    const d = await api('apiBootstrap', S.token);
    S.data = d; S.role = d.role; invalidate();
    if (d.role && S.token && d.role === 'tamu') { S.token = null; store.set('af_token', null); }
    render();
    if (d.needLogin) bindLogin($('#login-form'));
  } catch (e) {
    $('#view').innerHTML = `<div class="boot"><div class="boot-logo">!</div><p><b>Gagal memuat data</b><br>${esc(e.message)}</p><button class="btn primary" data-action="reload">Coba lagi</button></div>`;
  }
}

/* ===================== AKSI (event delegation) ===================== */
const ACT = {
  back, 'close-sheet': closeSheet, reload: () => reload().then(() => toast('Data diperbarui', 'ok')),
  'toggle-admin': () => isAdmin() ? logout() : loginSheet('admin'),
  'login-admin': () => loginSheet('admin'), 'login-member': () => loginSheet('anggota'), logout,
  'nav-kas': () => go('kas'),
  notif() {
    const ag = upcomingAgenda(30), bd = birthdaysThisMonth(), t = todayStr();
    const nb = isMember() ? beritaBaru() : 0, np = beritaPending();
    openSheet('Pengingat', `${nb || np ? `<button class="item" data-nav="berita" style="margin-bottom:14px"><span class="ic ev">📰</span><span class="tx"><b>${nb ? nb + ' kabar keluarga baru' : ''}${nb && np ? ' · ' : ''}${np ? np + ' menunggu persetujuan' : ''}</b><small>Buka Kabar Keluarga</small></span></button>` : ''}<h4 style="margin:0 0 8px;font-size:13px">Agenda 30 hari ke depan</h4><div class="list">${ag.map(a => `<button class="item" data-action="agenda-detail" data-id="${esc(a.id)}"><span class="ic ev">📅</span><span class="tx"><b>${esc(a.judul)}</b><small>${fmtDate(a.tanggal, true)}</small></span></button>`).join('') || '<p class="empty" style="padding:8px">Tidak ada agenda.</p>'}</div>
      <h4 style="margin:16px 0 8px;font-size:13px">Ulang tahun bulan ini</h4><div class="list">${bd.map(a => `<button class="item" data-action="person" data-id="${esc(a.id)}">${avatar(a)}<span class="tx"><b>${esc(a.nama)}</b><small>${Number(a.tgl_lahir.slice(8))} ${BULAN[Number(a.tgl_lahir.slice(5, 7)) - 1]}${a.tgl_lahir.slice(5) === t.slice(5) ? ' · hari ini 🎉' : ''}</small></span></button>`).join('') || '<p class="empty" style="padding:8px">Tidak ada.</p>'}</div>`);
  },
  'quick-add'() {
    if (!isAdmin()) {
      if (S.role === 'anggota') return openSheet('Tambah cepat', `<div class="list"><button class="item" data-action="add-berita"><span class="ic ev">📰</span><span class="tx"><b>Tulis kabar keluarga</b><small>Bagikan kabar terbaru Anda</small></span></button><button class="item" data-action="login-admin"><span class="ic ev">🔐</span><span class="tx"><b>Masuk sebagai Admin</b></span></button></div>`);
      return requireAdminUI();
    }
    const opt = [['add-berita', '📰', 'Tulis kabar keluarga', 'ev'], ['add-kas-in', '↓', 'Catat pemasukan', 'in'], ['add-kas-out', '↑', 'Catat pengeluaran', 'out'], ['catat-iuran', '✓', 'Catat iuran bulan ini', 'in'], ['add-anggota', '👤', 'Tambah anggota', 'ev'], ['add-agenda', '📅', 'Tambah agenda', 'ev'], ['add-foto', '📷', 'Unggah foto', 'ev']];
    openSheet('Tambah cepat', `<div class="list">${opt.map(o => `<button class="item" data-action="${o[0]}"><span class="ic ${o[3]}">${o[1]}</span><span class="tx"><b>${o[2]}</b></span></button>`).join('')}</div>`);
  },
  'add-kas': () => requireAdminUI() && formKas(),
  'add-kas-in': () => requireAdminUI() && formKas(null, { jenis: 'Masuk' }),
  'add-kas-out': () => requireAdminUI() && formKas(null, { jenis: 'Keluar' }),
  'catat-iuran': el => { if (!requireAdminUI()) return; const st = S.data.settings, p = ym(todayStr()); formKas(null, { jenis: 'Masuk', kategori: st.kategori_iuran, periode: p, jumlah: Number(st.iuran_bulanan) || '', anggota_id: el.dataset.id || ((iuranStatus(p).belum[0] || {}).id || ''), keterangan: 'Iuran ' + fmtMonth(p) }); },
  'kas-detail': el => kasDetail(el.dataset.id),
  'edit-kas': el => formKas(S.data.kas.find(k => k.id === el.dataset.id)),
  'del-kas': async el => { if (await confirmSheet('Hapus transaksi?', 'Transaksi akan dihapus dari laporan. Riwayat tetap tersimpan di sheet (is_active = FALSE).')) doDelete('apiDeleteKas', 'kas', el.dataset.id); },
  'f-kas-jenis': el => { S.kas.jenis = el.dataset.v; render(); },
  person: el => personDetail(el.dataset.id),
  'add-anggota': () => requireAdminUI() && formAnggota(),
  'add-child': el => { if (index().gen[el.dataset.id] >= MAX_GEN) return toast('Anggota ini generasi ke-' + MAX_GEN + ' (batas aplikasi).', 'error'); const p = index().byId[el.dataset.id]; const sp = spouseIds(p).map(s => index().byId[s]).find(Boolean);
    const pre = {}; pre[p.jenis_kelamin === 'P' ? 'ibu_id' : 'ayah_id'] = p.id; if (sp) pre[sp.jenis_kelamin === 'P' ? 'ibu_id' : 'ayah_id'] = sp.id; formAnggota(null, pre); },
  'edit-anggota': el => formAnggota(index().byId[el.dataset.id]),
  'del-anggota': async el => { if (await confirmSheet('Hapus anggota?', 'Anggota disembunyikan dari aplikasi. Data tetap tersimpan di sheet dan bisa dipulihkan dengan mengubah is_active menjadi TRUE.')) { try { await api('apiDeleteAnggota', S.token, el.dataset.id); toast('Anggota dihapus', 'ok'); await reload(); } catch (e) { toast(e.message, 'error'); handleAuthErr(e); } } },
  'f-anggota': el => { S.anggota.f = el.dataset.v; render(); },
  'tree-focus': el => { closeSheet(); const id = el.dataset.id, T = S.tree;
    if (!(id === T.rootId || descendants(T.rootId).has(id) || spouseIds(index().byId[T.rootId]).includes(id))) T.rootId = topAncestor(id);
    lineage(id).forEach(i => T.collapsed.delete(i)); T.focus = id; T.q = ''; go('pohon'); },
  'tree-toggle': el => { const T = S.tree; T.collapsed.has(el.dataset.id) ? T.collapsed.delete(el.dataset.id) : T.collapsed.add(el.dataset.id); const keep = { x: T.x, y: T.y, s: T.scale }; render(); Object.assign(T, { x: keep.x, y: keep.y, scale: keep.s }); applyTreeTransform(); },
  'tree-expand': () => { S.tree.collapsed.clear(); S.tree.placed = false; render(); },
  'tree-spouse': () => { S.tree.showSpouse = !S.tree.showSpouse; S.tree.placed = false; render(); },
  'tree-fit': treeFit,
  zoom: el => { const r = $('#tree-stage').getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, Number(el.dataset.z)); },
  'tree-help': () => openSheet('Cara membaca pohon', `<ul style="padding-left:18px;font-size:14px;line-height:1.6;margin:0">
    <li>Pohon disusun dari <b>ayah/ibu</b> tiap anggota. Pasangan tampil di samping dengan garis merah muda.</li>
    <li>Ketuk kartu untuk melihat profil, saudara, anak, dan garis silsilah.</li>
    <li>Tombol <b>▾ n anak</b> melipat/membuka cabang.</li><li>Pilih "Mulai dari" untuk melihat cabang keluarga lain (misalnya dari pihak menantu).</li>
    <li>Kartu berbingkai kuning = hasil pencarian.</li></ul>`),
  'lap-tab': el => { S.lap.tab = el.dataset.v; render(); },
  'lap-preset': el => { const t = todayStr(), L = S.lap, v = el.dataset.v;
    if (v === 'bulan') { L.from = t.slice(0, 7) + '-01'; L.to = t; }
    if (v === 'lalu') { const p = addMonths(t.slice(0, 7), -1); L.from = p + '-01'; L.to = addDays(t.slice(0, 7) + '-01', -1); }
    if (v === 'tahun') { L.from = t.slice(0, 4) + '-01-01'; L.to = t; }
    if (v === 'semua') { const ds = S.data.kas.map(k => k.tanggal).sort(); L.from = ds[0] || t; L.to = t; }
    render(); },
  'lap-csv': exportLaporan, 'lap-print': () => window.print(),
  'agenda-detail': el => agendaDetail(el.dataset.id),
  'add-agenda': () => requireAdminUI() && formAgenda(),
  'edit-agenda': el => formAgenda(S.data.agenda.find(a => a.id === el.dataset.id)),
  'del-agenda': async el => { if (await confirmSheet('Hapus agenda?', 'Agenda akan disembunyikan dari aplikasi.')) doDelete('apiDeleteAgenda', 'agenda', el.dataset.id); },
  'f-agenda': el => { S.agenda.tab = el.dataset.v; render(); },
  'add-foto': () => requireAdminUI() && formFoto(),
  foto: el => lightbox(el.dataset.id),
  'f-album': el => { S.galeri.album = el.dataset.v; render(); },
  'pick-map': el => mapPicker(el.closest('form')),
  'add-berita': () => { if (!isMember()) return loginSheet('anggota'); formBerita(); },
  'berita-detail': el => beritaDetail(el.dataset.id),
  'edit-berita': el => formBerita(S.data.berita.find(b => b.id === el.dataset.id)),
  'del-berita': async el => { if (await confirmSheet('Hapus berita?', 'Berita dan komentarnya disembunyikan dari aplikasi. Data tetap ada di sheet.')) doDelete('apiDeleteBerita', 'berita', el.dataset.id); },
  'berita-mod': async el => { try { const r = await api('apiModerasiBerita', S.token, el.dataset.id, el.dataset.v); upsert('berita', r);
      toast({ terbit: 'Berita diterbitkan', tolak: 'Berita ditolak', sematkan: 'Berita disematkan di atas', lepas: 'Sematan dilepas' }[el.dataset.v], 'ok'); render(); if (el.dataset.reopen) beritaDetail(r.id); }
    catch (e) { toast(e.message, 'error'); handleAuthErr(e); } },
  'berita-react': async el => { const id = el.dataset.id; if (reacted(id)) return toast('Anda sudah memberi tanggapan');
    const b = S.data.berita.find(x => x.id === id); markReacted(id); b.reaksi = (b.reaksi || 0) + 1; render();
    try { b.reaksi = await api('apiReaksiBerita', S.token, id); render(); } catch (e) { toast(e.message, 'error'); } },
  'del-komentar': async el => { try { await api('apiDeleteKomentar', S.token, el.dataset.id); S.data.komentar = S.data.komentar.filter(k => k.id !== el.dataset.id); render(); beritaDetail(el.dataset.b); } catch (e) { toast(e.message, 'error'); } },
  'f-berita-tab': el => { S.berita.tab = el.dataset.v; render(); },
  'f-berita-kat': el => { S.berita.kat = el.dataset.v; render(); },
  'go-ultah': () => { S.anggota.f = 'ultah'; go('anggota'); },
  'del-kat': async el => { if (await confirmSheet('Hapus kategori?', 'Kategori tidak bisa dipilih lagi untuk transaksi baru. Transaksi lama tetap memakai nama kategori ini.')) doDelete('apiDeleteKategori', 'kategori', el.dataset.id); }
};

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); if ($('#sheet').hidden === false) closeSheet(); go(nav.dataset.nav); return; }
  const a = e.target.closest('[data-action]');
  if (a && ACT[a.dataset.action]) {
    e.preventDefault();
    if (a.closest('#sheet') && a.dataset.action !== 'close-sheet' && !a.closest('form')) closeSheet();
    ACT[a.dataset.action](a);
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#lightbox').hidden) $('#lightbox').hidden = true; else if (!$('#sheet').hidden) closeSheet(); } });

/* ---------- start ---------- */
// Panel admin web memulai sendiri setelah AdminScripts dimuat.
if (!window.AF_ADMIN) { S.token = store.get('af_token'); reload(); }
