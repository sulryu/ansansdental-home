import {createAPI} from './cases-api.mjs';
const api = createAPI(window.SEOULS_CASES || {});
const status = document.getElementById('caseStatus');
const element = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
async function photo(path, alt) {
  const img = element('img'); img.alt = alt; img.loading = 'lazy'; img.src = await api.photoURL(path); return img;
}
async function list() {
  const container = document.getElementById('caseList'), more = document.getElementById('loadMore');
  let offset = 0;
  async function load() {
    more.disabled = true;
    try {
      const rows = await api.list(false, offset);
      for (const row of rows) {
        const card = element('a', '', 'case-card'); card.href = '/clinical-case.html?id=' + row.id;
        const cover = element('div', '', 'case-cover');
        if (row.after_image || row.before_image) { try { cover.append(await photo(row.after_image || row.before_image, row.title + ' 치료 사진')); } catch { cover.textContent = '치료 과정'; } }
        else cover.textContent = '서울S치과 진료 기록';
        const copy = element('div', '', 'case-card-copy'); copy.append(element('span', row.category, 'case-tag'), element('h2', row.title), element('p', row.summary), element('p', `${row.treatment_date} · ${row.doctor} 원장`, 'meta'));
        card.append(cover, copy); container.append(card);
      }
      offset += rows.length; more.hidden = rows.length < 20;
      status.textContent = offset ? `${offset}개 사례를 표시합니다.` : '등록된 임상사례가 아직 없습니다. 사례를 준비하고 있습니다.';
      if (!offset) status.className = 'case-empty';
    } catch (error) { status.textContent = error.message; status.className = 'case-empty'; }
    finally { more.disabled = false; }
  }
  more.addEventListener('click', load); await load();
}
async function detail() {
  const row = await api.get(new URLSearchParams(location.search).get('id') || '');
  if (!row) throw Error('공개된 사례를 찾을 수 없습니다. 목록에서 다른 사례를 확인해 주세요.');
  for (const [id, text] of [['caseCategory', row.category], ['caseTitle', row.title], ['caseSummary', row.summary], ['caseBody', row.body], ['caseMeta', `${row.treatment_date} · 담당 ${row.doctor} 원장`]]) document.getElementById(id).textContent = text;
  document.title = row.title + ' | 서울S치과 임상사례';
  document.querySelector('meta[name=description]').content = row.summary;
  for (const [path, caption] of [[row.before_image, '치료 전'], [row.after_image, '치료 후']]) {
    if (!path) continue;
    const figure = element('figure');
    try { figure.append(await photo(path, row.title + ' · ' + caption)); }
    catch { figure.append(element('p', '사진을 불러오지 못했습니다. 새로고침해 주세요.')); }
    figure.append(element('figcaption', caption)); document.getElementById('casePhotos').append(figure);
  }
  status.textContent = ''; document.getElementById('caseDetail').hidden = false;
}
try { if (document.getElementById('caseList')) await list(); else await detail(); }
catch (error) { status.textContent = error.message; }
