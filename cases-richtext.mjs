const format = 'seouls-richtext-v1';
export const fonts = ['pretendard', 'malgun', 'serif'];
export const sizes = ['14px', '16px', '18px', '20px', '24px', '28px', '32px'];
export function safeLink(value) {
  try { const url = new URL(value); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null; } catch { return null; }
}
export function cleanOps(ops) {
  if (!Array.isArray(ops) || ops.length > 12000) throw Error('본문 형식을 확인해 주세요.');
  return ops.map(op => {
    if (typeof op?.insert !== 'string') throw Error('본문에는 글을 입력하고, 사진은 사진 첨부 항목에 올려 주세요.');
    const attrs = {}, source = op.attributes || {};
    for (const name of ['bold', 'italic', 'underline', 'strike']) if (source[name] === true) attrs[name] = true;
    for (const name of ['color', 'background']) if (/^#[0-9a-f]{6}$/i.test(source[name])) attrs[name] = source[name];
    if (fonts.includes(source.font)) attrs.font = source.font;
    if (sizes.includes(source.size)) attrs.size = source.size;
    if ([2, 3].includes(source.header)) attrs.header = source.header;
    if (['ordered', 'bullet'].includes(source.list)) attrs.list = source.list;
    if (['center', 'right', 'justify'].includes(source.align)) attrs.align = source.align;
    if (typeof source.link === 'string' && safeLink(source.link)) attrs.link = source.link;
    return Object.keys(attrs).length ? {insert: op.insert, attributes: attrs} : {insert: op.insert};
  });
}
export function decodeBody(body = '') {
  let parsed;
  try { parsed = JSON.parse(body); } catch {}
  return parsed?.format === format ? cleanOps(parsed.ops) : [{insert: body.endsWith('\n') ? body : body + '\n'}];
}
export function bodyText(body) { return decodeBody(body).map(op => op.insert).join('').trim(); }
export function encodeBody(ops) {
  const clean = cleanOps(ops);
  return clean.some(op => op.attributes) ? JSON.stringify({format, ops: clean}) : clean.map(op => op.insert).join('').replace(/\n$/, '');
}
let configured = false;
function configure() {
  if (!window.Quill) throw Error('편집기를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
  if (!configured) {
    const Font = Quill.import('attributors/class/font'); Font.whitelist = fonts; Quill.register(Font, true);
    const Size = Quill.import('attributors/style/size'); Size.whitelist = sizes; Quill.register(Size, true);
    configured = true;
  }
}
export function createEditor(container, toolbar = false) {
  configure();
  const editor = new Quill(container, {theme: 'snow', readOnly: !toolbar, placeholder: toolbar ? '내원 시 상태, 치료 계획과 과정을 입력해 주세요.' : '', formats: ['font', 'size', 'header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'align', 'link'], modules: {toolbar, history: {userOnly: true}}});
  editor.root.setAttribute('aria-label', toolbar ? '치료 과정 편집' : '치료 과정');
  if (toolbar) { editor.root.setAttribute('role', 'textbox'); editor.root.setAttribute('aria-multiline', 'true'); editor.root.setAttribute('aria-describedby', 'bodyHelp bodyCount'); }
  return editor;
}
export function showBody(container, body) {
  const editor = createEditor(container); editor.setContents({ops: decodeBody(body)}, 'silent'); return editor;
}
