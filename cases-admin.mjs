import {setupStats} from './stats-admin.mjs';
import {createAPI, validateCase, validatePhoto} from './cases-api.mjs';
import {createEditor, decodeBody, encodeBody, bodyText, safeLink} from './cases-richtext.mjs';
const api = createAPI(window.SEOULS_CASES || {});
const $ = id => document.getElementById(id);
const form = $('caseForm');
let current = null, busy = false, dirty = false, offset = 0;
let bodyEditor, previewEditor;
const photoVersions = {before: 0, after: 0}, localPhotos = {};
async function previewPhoto(name, file, path) {
  const version = ++photoVersions[name], image = $(name + 'Preview');
  if (localPhotos[name]) URL.revokeObjectURL(localPhotos[name]);
  delete localPhotos[name]; image.hidden = true; image.removeAttribute('src');
  try {
    let url;
    if (file) { validatePhoto(file); url = URL.createObjectURL(file); localPhotos[name] = url; }
    else if (path) url = await api.photoURL(path, true);
    if (version !== photoVersions[name] || !url) return;
    image.onerror = () => { image.hidden = true; $(name + 'Existing').textContent = '사진을 불러오지 못했습니다. 다시 선택하거나 새로고침해 주세요.'; };
    image.src = url; image.hidden = false;
  } catch (error) { if (version === photoVersions[name]) $(name + 'Existing').textContent = error.message; }
}
for (const name of ['before', 'after']) $(name).addEventListener('change', () => {
  $(name + 'Existing').textContent = '';
  previewPhoto(name, $(name).files[0], current?.[name + '_image']);
});
function syncBody() {
  form.elements.body.value = encodeBody(bodyEditor.getContents().ops);
  $('bodyCount').textContent = `${bodyText(form.elements.body.value).length}자 · 서식 포함 ${form.elements.body.value.length.toLocaleString()} / 12,000자`;
  $('bodyCount').classList.toggle('error', form.elements.body.value.length > 12000);
}
function prepareBody() {
  if (bodyEditor) return;
  bodyEditor = createEditor($('bodyEditor'), '#bodyToolbar');
  $('bodyToolbar').querySelector('.ql-header').textContent = '소제목';
  let selection = {index: 0, length: 0};
  bodyEditor.on('selection-change', range => { if (range) selection = range; });
  for (const [id, format] of [['bodyFont', 'font'], ['bodySize', 'size'], ['bodyColor', 'color']]) {
    $(id).addEventListener('change', () => {
      const value = $(id).value || false;
      bodyEditor.setSelection(selection); bodyEditor.format(format, value, 'user');
      $(id).value = value || '';
    });
  }
  bodyEditor.getModule('toolbar').addHandler('link', value => {
    if (!value) { bodyEditor.format('link', false, 'user'); return; }
    const url = prompt('연결할 주소를 입력하세요. (https://…)');
    if (!url) return;
    if (!safeLink(url.trim())) { message('saveStatus', 'https://로 시작하는 올바른 링크 주소를 입력해 주세요.', true); return; }
    bodyEditor.format('link', url.trim(), 'user');
  });
  $('bodyUndo').addEventListener('click', () => bodyEditor.history.undo());
  $('bodyRedo').addEventListener('click', () => bodyEditor.history.redo());
  bodyEditor.on('text-change', (_delta, _old, source) => { syncBody(); if (source === 'user') dirty = true; });
}
function message(id, text, error = false) { $(id).textContent = text; $(id).classList.toggle('error', error); }
function editor(show) { $('loginPanel').hidden = show; $('editorPanel').hidden = !show; }
function reauthenticate(error) { if (error.status === 401) { editor(false); message('loginStatus', error.message, true); $('password').focus(); } }
const clearStats = setupStats(api, reauthenticate);
function confirmDiscard() { return !dirty || confirm('저장하지 않은 내용을 닫을까요?'); }
function openCase(row) {
  if (busy || !confirmDiscard()) return;
  current = row; form.reset();
  for (const name of ['before', 'after']) previewPhoto(name, null, row?.[name + '_image']);
  for (const name of ['title', 'category', 'doctor', 'treatment_date', 'summary']) form.elements[name].value = row?.[name] || '';
  for (const name of ['consent_confirmed', 'published']) form.elements[name].checked = Boolean(row?.[name]);
  for (const name of ['before', 'after']) $(name + 'Existing').textContent = row?.[name + '_image'] ? '기존 사진이 있습니다. 새 파일을 선택하면 교체됩니다.' : '';
  $('deleteCase').hidden = !row; message('saveStatus', ''); dirty = false; form.hidden = false;
  try {
    prepareBody(); bodyEditor.setContents({ops: decodeBody(row?.body || '')}, 'silent'); bodyEditor.history.clear(); syncBody();
    for (const id of ['bodyFont', 'bodySize', 'bodyColor']) $(id).value = '';
    $('title').focus();
  } catch (error) { message('saveStatus', error.message, true); }
}
async function load(reset = false) {
  const button = $('adminMore'); button.disabled = true;
  if (reset) { offset = 0; $('adminList').replaceChildren(); }
  try {
    const rows = await api.list(true, offset);
    for (const row of rows) {
      const li = document.createElement('li'), text = document.createElement('span'), edit = document.createElement('button');
      text.textContent = [row.published ? '공개' : '임시 저장', row.title, row.treatment_date].filter(Boolean).join(' · ');
      edit.textContent = '수정'; edit.type = 'button'; edit.className = 'btn secondary'; edit.addEventListener('click', () => openCase(row)); li.append(text, edit); $('adminList').append(li);
    }
    offset += rows.length; button.hidden = rows.length < 20; message('adminStatus', offset ? '' : '등록된 사례가 없습니다. 새 사례 작성으로 시작하세요.');
  } catch (error) { message('adminStatus', error.message, true); reauthenticate(error); }
  finally { button.disabled = false; }
}
$('loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true; message('loginStatus', '로그인 중입니다.');
  try { await api.login($('username').value.trim(), $('password').value); $('password').value = ''; editor(true); message('loginStatus', ''); await load(true); }
  catch (error) { message('loginStatus', error.message, true); }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  if (busy || !confirmDiscard()) return;
  try { await api.logout(); message('loginStatus', '로그아웃되었습니다.'); }
  catch { message('loginStatus', '이 브라우저에서 로그아웃했습니다. 연결이 불안정해 서버 세션 종료는 확인하지 못했습니다.', true); }
  clearStats?.(); current = null; dirty = false; form.reset(); form.hidden = true; $('adminList').replaceChildren(); editor(false);
  for (const name of ['before', 'after']) previewPhoto(name);
});
$('newCase').addEventListener('click', () => openCase(null));
$('cancelEdit').addEventListener('click', () => { if (!busy && confirmDiscard()) { form.hidden = true; dirty = false; } });
$('adminMore').addEventListener('click', () => load());
form.addEventListener('input', () => { dirty = true; });
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
function setBusy(value) {
  busy = value;
  // 저장 중 다른 사례나 입력값으로 바뀌어 사진과 글이 섞이는 것을 막습니다.
  for (const control of document.querySelectorAll('#editorPanel button, #caseForm input, #caseForm select, #caseForm textarea')) control.disabled = value;
  bodyEditor?.enable(!value);
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  if (!bodyEditor) { message('saveStatus', '편집기를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.', true); return; }
  syncBody();
  const value = {};
  for (const name of ['title', 'category', 'doctor', 'treatment_date', 'summary', 'body']) value[name] = form.elements[name].value.trim();
  for (const name of ['consent_confirmed', 'published']) value[name] = form.elements[name].checked;
  const files = {before: $('before').files[0], after: $('after').files[0]};
  try { validateCase(value); for (const file of Object.values(files)) if (file) validatePhoto(file); }
  catch (error) { message('saveStatus', error.message, true); return; }
  const id = current?.id || crypto.randomUUID(), replaced = [];
  let saved = false;
  setBusy(true); message('saveStatus', '저장 중입니다.');
  try {
    for (const name of ['before', 'after']) {
      value[name + '_image'] = current?.[name + '_image'] || null;
      if (files[name]) {
        const path = await api.upload(id, files[name]);
        if (value[name + '_image']) replaced.push(value[name + '_image']);
        value[name + '_image'] = path;
      }
    }
    const rows = await api.save(id, value);
    if (!rows?.length) throw Error('저장을 확인하지 못했습니다. 다시 시도해 주세요.');
    saved = true; current = rows[0]; dirty = false; form.elements.before.value = ''; form.elements.after.value = ''; $('deleteCase').hidden = false;
    for (const name of ['before', 'after']) previewPhoto(name, null, current[name + '_image']);
    for (const name of ['before', 'after']) $(name + 'Existing').textContent = current[name + '_image'] ? '저장된 사진이 있습니다. 새 파일을 선택하면 교체됩니다.' : '';
    message('saveStatus', value.published ? '공개 사례로 저장했습니다.' : '임시 저장했습니다.');
    await load(true);
    try { await api.removePhotos(replaced); } catch { message('saveStatus', '글은 저장했습니다. 이전 사진 정리는 완료하지 못했습니다.', true); }
  } catch (error) {
    // 통신 응답만 유실됐을 수도 있으므로 업로드 사진을 자동 삭제하지 않습니다.
    // ponytail: 실패 업로드는 비공개로 남음. 관리 데이터가 커지면 고아 파일 정리 작업 추가.
    if (!saved) { message('saveStatus', error.message, true); reauthenticate(error); }
  } finally { setBusy(false); }
});
$('deleteCase').addEventListener('click', async () => {
  if (busy || !current || !confirm('이 임상사례를 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
  setBusy(true);
  try {
    const removed = await api.remove(current.id);
    if (!removed?.length) throw Error('삭제 권한 또는 사례 상태를 확인해 주세요.');
    const paths = [current.before_image, current.after_image].filter(Boolean);
    current = null; dirty = false; form.hidden = true; form.reset(); await load(true);
    try { await api.removePhotos(paths); message('adminStatus', '사례를 삭제했습니다.'); }
    catch { message('adminStatus', '사례를 삭제했습니다. 비공개 사진 파일 정리는 완료하지 못했습니다.', true); }
  } catch (error) { message('saveStatus', error.message, true); reauthenticate(error); }
  finally { setBusy(false); }
});
if (!api.ready) { message('loginStatus', '관리자 페이지 연결을 준비하고 있습니다. 아직 로그인할 수 없습니다.'); $('loginForm').querySelector('button').disabled = true; }
else try { if (await api.isAdmin()) { editor(true); await load(true); } } catch { editor(false); }
$('previewCase').addEventListener('click', () => {
  if (!bodyEditor || busy) return;
  syncBody();
  $('previewTitle').textContent = form.elements.title.value || '사례 미리보기';
  $('previewSummary').textContent = form.elements.summary.value;
  $('casePreview').showModal();
  previewEditor ||= createEditor($('previewBody'));
  previewEditor.setContents({ops: decodeBody(form.elements.body.value)}, 'silent');
  $('previewPhotos').replaceChildren();
  for (const [name, caption] of [['before', '치료 전'], ['after', '치료 후']]) {
    const image = $(name + 'Preview');
    if (image.hidden || !image.getAttribute('src')) continue;
    const figure = document.createElement('figure'), label = document.createElement('figcaption');
    label.textContent = caption; figure.append(image.cloneNode(), label); $('previewPhotos').append(figure);
  }
});
$('closePreview').addEventListener('click', () => $('casePreview').close());
$('casePreview').addEventListener('close', () => $('previewCase').focus());
