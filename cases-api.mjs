import {bodyText} from './cases-richtext.mjs';
export const categories = ['임플란트', '보철', '충치·신경치료', '잇몸치료', '턱관절', '기타'];
export const doctors = ['이승준', '김유범'];
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateCase(value) {
  for (const [key, min, max] of [['title', 2, 120], ['summary', 2, 500], ['body', 2, 12000]]) {
    if (typeof value[key] !== 'string' || value[key].trim().length < min || value[key].length > max) throw Error('제목·요약·치료 내용을 확인해 주세요.');
  }
  if (!categories.includes(value.category) || !doctors.includes(value.doctor)) throw Error('진료 분야와 담당 원장을 선택해 주세요.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.treatment_date) || !Number.isFinite(Date.parse(value.treatment_date)) || new Date(value.treatment_date).toISOString().slice(0, 10) !== value.treatment_date) throw Error('진료일을 확인해 주세요.');
  if (bodyText(value.body).length < 2) throw Error('치료 내용을 두 글자 이상 입력해 주세요.');
  if (value.published && !value.consent_confirmed) throw Error('공개 전 사진·내용 게시 동의 확인에 체크해 주세요.');
  return value;
}
export function validatePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024 || file.size === 0) throw Error('사진은 8MB 이하의 JPG·PNG·WebP 파일을 선택해 주세요.');
}
export function isPublicKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('sb_publishable_')) return true;
  try { return JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { return false; }
}
export function createAPI(config, fetcher = fetch) {
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) && isPublicKey(config.key);
  let token = '';
  try { token = sessionStorage.getItem('seouls.cases.access') || ''; } catch {}
  function setToken(value) {
    token = value;
    try { value ? sessionStorage.setItem('seouls.cases.access', value) : sessionStorage.removeItem('seouls.cases.access'); } catch {}
  }
  async function request(path, {method = 'GET', body, admin = false, headers = {}} = {}) {
    if (!ready) throw Error('임상사례 게시판 연결을 준비하고 있습니다.');
    if (admin && !token) throw Error('관리자 로그인이 필요합니다.');
    const authHeaders = token && admin ? {Authorization: `Bearer ${token}`} : config.key.startsWith('eyJ') ? {Authorization: `Bearer ${config.key}`} : {};
    const binary = typeof Blob !== 'undefined' && body instanceof Blob;
    let response;
    try { response = await fetcher(config.url + path, {method, headers: {apikey: config.key, ...authHeaders, ...(body && !binary ? {'Content-Type': 'application/json'} : {}), ...headers}, body: body ? binary ? body : JSON.stringify(body) : undefined}); }
    catch { throw Error('연결이 불안정합니다. 입력 내용은 유지되니 잠시 후 다시 시도해 주세요.'); }
    if (!response.ok) {
      if (response.status === 401) {
        const error = Error(admin ? '로그인이 만료되었습니다. 입력 내용을 유지한 채 다시 로그인해 주세요.' : '아이디 또는 비밀번호를 확인해 주세요.');
        error.status = 401; throw error;
      }
      if (response.status === 400 && path.startsWith('/auth/v1/token')) throw Error('아이디 또는 비밀번호를 확인해 주세요.');
      if (response.status === 403) throw Error('게시 권한이 없습니다. 관리자 계정인지 확인해 주세요.');
      throw Error('요청을 처리하지 못했습니다. 입력 내용과 서비스 연결 상태를 확인해 주세요.');
    }
    return response.status === 204 ? null : response.json();
  }
  return {
    ready,
    async login(username, password) {
      if (username !== 'seouls') throw Error('아이디 또는 비밀번호를 확인해 주세요.');
      const data = await request('/auth/v1/token?grant_type=password', {method: 'POST', body: {email: config.adminEmail, password}});
      setToken(data.access_token);
      try { if (!await this.isAdmin()) throw Error('관리자 계정이 아닙니다.'); } catch (error) { setToken(''); throw error; }
    },
    isAdmin: () => token ? request('/rest/v1/rpc/is_case_admin', {method: 'POST', body: {}, admin: true}) : Promise.resolve(false),
    async logout() { try { if (token) await request('/auth/v1/logout', {method: 'POST', admin: true}); } finally { setToken(''); } },
    list: (admin = false, offset = 0) => request(`/rest/v1/clinical_cases?select=*&order=treatment_date.desc,created_at.desc&limit=20&offset=${offset}${admin ? '' : '&published=eq.true'}`, {admin}),
    get: id => uuidPattern.test(id) ? request(`/rest/v1/clinical_cases?id=eq.${id}&select=*&published=eq.true&limit=1`).then(rows => rows[0]) : Promise.reject(Error('사례 주소를 확인해 주세요.')),
    async save(id, value) {
      validateCase(value);
      if (!uuidPattern.test(id)) throw Error('사례 주소를 확인해 주세요.');
      return request('/rest/v1/clinical_cases?on_conflict=id', {method: 'POST', admin: true, headers: {Prefer: 'resolution=merge-duplicates,return=representation'}, body: {id, ...value}});
    },
    remove: id => uuidPattern.test(id) ? request(`/rest/v1/clinical_cases?id=eq.${id}`, {method: 'DELETE', admin: true, headers: {Prefer: 'return=representation'}}) : Promise.reject(Error('사례 주소를 확인해 주세요.')),
    async upload(id, file) {
      validatePhoto(file);
      if (!uuidPattern.test(id)) throw Error('사례 주소를 확인해 주세요.');
      const extension = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'}[file.type];
      const path = `${id}/${crypto.randomUUID()}.${extension}`;
      await request('/storage/v1/object/clinical-cases/' + path, {method: 'POST', body: file, admin: true, headers: {'Content-Type': file.type, 'x-upsert': 'false'}});
      return path;
    },
    async photoURL(path, admin = false) {
      if (!path) return '';
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)) throw Error('사진 주소를 확인해 주세요.');
      const data = await request('/storage/v1/object/sign/clinical-cases/' + path, {method: 'POST', body: {expiresIn: 300}, admin});
      return config.url + '/storage/v1' + data.signedURL;
    },
    removePhotos: paths => paths.length ? request('/storage/v1/object/clinical-cases', {method: 'DELETE', admin: true, body: {prefixes: paths}}) : Promise.resolve()
  };
}
