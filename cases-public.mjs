import {createAPI} from './cases-api.mjs';
import {showBody} from './cases-richtext.mjs';
const api = createAPI(window.SEOULS_CASES || {});
const status = document.getElementById('caseStatus');
const element = (tag, text, className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };
async function photo(path, alt) {
  const img = element('img'); img.alt = alt; img.loading = 'lazy'; img.src = await api.photoURL(path); return img;
}
const BLOG_CASE_FEED = 'https://blog.ansansdental.com/feeds/posts/default/-/' + encodeURIComponent('임상사례') + '?alt=json-in-script&max-results=20&callback=';
// 블로그에서 '임상사례' 라벨이 붙은 글을 JSON 피드로 가져온다 (실패하면 조용히 빈 목록)
function blogCaseEntries() {
  return new Promise(resolve => {
    const callback = '__seoulsBlogCases' + Date.now(), script = document.createElement('script');
    let timer;
    const done = entries => { clearTimeout(timer); delete window[callback]; script.remove(); resolve(entries || []); };
    timer = setTimeout(() => done([]), 8000);
    window[callback] = data => done((data.feed && data.feed.entry) || []);
    script.onerror = () => done([]);
    script.src = BLOG_CASE_FEED + callback;
    document.head.append(script);
  });
}
function blogCaseCard(entry) {
  const link = ((entry.link || []).find(l => l.rel === 'alternate') || {}).href || '';
  if (!link.startsWith('https://blog.ansansdental.com/')) return null;
  const html = (entry.content && entry.content.$t) || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const image = [...doc.querySelectorAll('img')].map(img => img.getAttribute('src') || '').find(src => src.startsWith('https://'));
  const excerpt = [...doc.querySelectorAll('p')].map(p => p.textContent.trim()).find(text => text.length >= 20 && !text.startsWith('※')) || '';
  const labels = (entry.category || []).map(c => c.term).filter(term => !['임상사례', '서울S치과의원', '안산치과'].includes(term));
  const card = element('a', '', 'case-card'); card.href = link;
  const cover = element('div', '', 'case-cover');
  if (image) { const img = element('img'); img.alt = entry.title.$t + ' 치료 사진'; img.loading = 'lazy'; img.src = image; cover.append(img); }
  else cover.textContent = '서울S치과 진료 기록';
  const copy = element('div', '', 'case-card-copy');
  copy.append(element('span', labels[0] || '임상사례', 'case-tag'), element('h2', entry.title.$t), element('p', excerpt.length > 90 ? excerpt.slice(0, 90) + '…' : excerpt), element('p', entry.published.$t.slice(0, 10) + ' · 블로그 임상사례', 'meta'));
  card.append(cover, copy); return card;
}
async function list() {
  const container = document.getElementById('caseList'), more = document.getElementById('loadMore');
  let offset = 0, blogCount = 0;
  for (const entry of await blogCaseEntries()) { const card = blogCaseCard(entry); if (card) { container.append(card); blogCount++; } }
  async function load() {
    more.disabled = true;
    try {
      const rows = await api.list(false, offset);
      for (const row of rows) {
        const card = element('a', '', 'case-card'); card.href = '/clinical-case.html?id=' + row.id;
        const cover = element('div', '', 'case-cover');
        if (row.after_image || row.before_image) { try { cover.append(await photo(row.after_image || row.before_image, row.title + ' 치료 사진')); } catch { cover.textContent = '치료 과정'; } }
        else cover.textContent = '서울S치과 진료 기록';
        const copy = element('div', '', 'case-card-copy'); copy.append(element('span', row.category, 'case-tag'), element('h2', row.title), element('p', row.summary), element('p', [row.treatment_date, `${row.doctor} 원장`].filter(Boolean).join(' · '), 'meta'));
        card.append(cover, copy); container.append(card);
      }
      offset += rows.length; more.hidden = rows.length < 20;
      const total = offset + blogCount;
      status.textContent = total ? `${total}개 사례를 표시합니다.` : '등록된 임상사례가 아직 없습니다. 사례를 준비하고 있습니다.';
      if (!total) status.className = 'case-empty';
    } catch (error) { status.textContent = error.message; status.className = 'case-empty'; }
    finally { more.disabled = false; }
  }
  more.addEventListener('click', load); await load();
}
async function detail() {
  const row = await api.get(new URLSearchParams(location.search).get('id') || '');
  if (!row) throw Error('공개된 사례를 찾을 수 없습니다. 목록에서 다른 사례를 확인해 주세요.');
  for (const [id, text] of [['caseCategory', row.category], ['caseTitle', row.title], ['caseSummary', row.summary], ['caseMeta', [row.treatment_date, `담당 ${row.doctor} 원장`].filter(Boolean).join(' · ')]]) document.getElementById(id).textContent = text;
  showBody(document.getElementById('caseBody'), row.body);
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
