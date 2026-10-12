const definitions = [['daily','방문자 수','날짜','활성 사용자'],['channel','유입 채널','채널','방문 횟수'],['pages','인기 페이지','페이지','조회수'],['source','유입 출처','출처','방문 횟수'],['region','접속 지역','지역','활성 사용자'],['device','접속 기기','기기','방문 횟수'],['search_queries','구글 검색어 TOP 10','검색어','클릭수'],['link_clicks','예약·상담 버튼 클릭','링크','클릭수']];
const maps = {
 channel:{Direct:'직접 방문','Organic Search':'검색 유입',Unassigned:'분류 안 됨',Referral:'다른 사이트','Organic Social':'소셜','Paid Search':'검색 광고'},
 source:{'(direct) / (none)':'직접 방문','(not set)':'확인 불가','naver.com / referral':'네이버 링크','google / organic':'구글 검색','naver / organic':'네이버 검색','bing / organic':'빙 검색','daum / organic':'다음 검색'},
 device:{mobile:'모바일',desktop:'PC',tablet:'태블릿'},
 region:Object.fromEntries(['Gyeonggi-do|경기도','Seoul|서울','Incheon|인천','Busan|부산','Daegu|대구','Daejeon|대전','Gwangju|광주','Ulsan|울산','Sejong-si|세종','Gangwon-do|강원도','Chungcheongbuk-do|충청북도','Chungcheongnam-do|충청남도','Jeollabuk-do|전라북도','Jeollanam-do|전라남도','Gyeongsangbuk-do|경상북도','Gyeongsangnam-do|경상남도','Jeju-do|제주도'].map(x=>x.split('|'))),
 pages:{'/':'메인 페이지','/doctors.html':'의료진 소개','/implant.html':'임플란트','/prosthetics.html':'심미보철','/orthodontics.html':'치아교정','/endodontics.html':'충치·신경치료','/periodontics.html':'잇몸치료','/tmj.html':'턱관절','/clinical-cases.html':'임상사례'},
 link_clicks:{'naver.me':'네이버 예약','pf.kakao.com':'카카오톡 채널','talk.naver.com':'네이버톡톡','blog.naver.com':'네이버 블로그'}
};
const num=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('ko-KR'):'0';
function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
const aiList=[[/chatgpt|openai/i,'ChatGPT'],[/perplexity/i,'Perplexity'],[/gemini|bard/i,'Gemini'],[/copilot/i,'Copilot'],[/claude|anthropic/i,'Claude'],[/grok|x\.ai/i,'Grok'],[/you\.com|phind|meta\.ai|deepseek|kimi/i,'기타 AI']];
const aiName=source=>(aiList.find(([re])=>re.test(source))||[])[1];
function mergeByLabel(section,rows){const m=new Map();for(const r of rows){const k=label(section,r),v=Number(r.metrics?.[0])||0;if(m.has(k))m.get(k).metrics[0]+=v;else m.set(k,{dimensions:r.dimensions,metrics:[v]});}return [...m.values()];}
function aiSummary(rows){const by={};let total=0;for(const r of rows){const n=aiName(r.dimensions?.[0]||'');if(n){const v=Number(r.metrics?.[0])||0;by[n]=(by[n]||0)+v;total+=v;}}
 const p=el('p',total?`AI 서비스에서 들어온 방문 ${num(total)}회 (${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`${n} ${num(v)}`).join(' · ')})`:'AI 서비스(ChatGPT, Perplexity 등)에서 들어온 방문이 아직 없습니다');p.className='stats-ai';return p;}
const cut=(t,n)=>t.length>n?t.slice(0,n)+'...':t;
function label(section,row){const key=row.dimensions?.[0]||'';if(section==='search_queries')return cut(key,20);if(section==='pages'){const path=row.dimensions?.[1]||'';return `${key==='ansansdental.com'?'홈페이지':key==='blog.ansansdental.com'?'블로그':cut(key,12)} · ${maps.pages[path]||cut(path,18)}`;}if(section==='source'&&aiName(key))return aiName(key)+' (AI)';return maps[section]?.[key]||(section==='region'?'확인 불가':section==='device'?'기타':key);}
const hosts=['ansansdental.com','blog.ansansdental.com'];
function fullLabel(section,row){const key=row.dimensions?.[0]||'';if(section==='search_queries')return key;if(section==='pages'){const path=row.dimensions?.[1]||'';return `${key==='ansansdental.com'?'홈페이지':key==='blog.ansansdental.com'?'블로그':key} · ${maps.pages[path]||path}`;}return label(section,row);}
function cell(section,row){const td=el('td'),text=label(section,row),title=fullLabel(section,row),host=row.dimensions?.[0],path=row.dimensions?.[1]||'';
 if(section==='pages'&&hosts.includes(host)&&path.startsWith('/')&&!path.startsWith('//')){const a=el('a',text);a.href=`https://${host}${path}`;a.target='_blank';a.rel='noopener noreferrer';a.title=title;td.append(a);}else td.textContent=text;
 td.title=title;return td;}
function dailyChart(rows){
 const ns='http://www.w3.org/2000/svg',wrap=el('div'),W=600,H=210,L=44,R=18,T=26,B=34;wrap.className='stats-chart-wrap';
 const vals=rows.map(r=>Number(r.metrics[1])||0),max=Math.max(0,...vals),top=max<=4?4:Math.ceil(max/2)*2,n=rows.length;
 const X=i=>L+(n>1?i*(W-L-R)/(n-1):(W-L-R)/2),Y=v=>T+(1-v/top)*(H-T-B);
 const mk=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(text!==undefined)e.textContent=text;return e;};
 const md=d=>`${+d.slice(4,6)}/${+d.slice(6,8)}`;
 const svg=mk('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'일별 활성 사용자 추이'});svg.classList.add('stats-chart');
 svg.append(mk('text',{x:L-8,y:T-12,'text-anchor':'end','font-size':'11',fill:'#64748b'},'명'));
 for(const t of [0,top/2,top]){svg.append(mk('line',{x1:L,x2:W-R,y1:Y(t),y2:Y(t),stroke:t?'#e5e9f0':'#cbd5e1','stroke-width':'1'}),mk('text',{x:L-8,y:Y(t)+4,'text-anchor':'end','font-size':'12',fill:'#64748b'},String(t)));}
 const step=Math.max(1,Math.ceil(n/7));let last=-99;
 rows.forEach((r,i)=>{if(i%step===0||(i===n-1&&i-last>=Math.ceil(step/2))){last=i;svg.append(mk('text',{x:X(i),y:H-10,'text-anchor':'middle','font-size':'12',fill:'#64748b'},md(r.dimensions[0])));}});
 svg.append(mk('polyline',{points:vals.map((v,i)=>`${X(i)},${Y(v)}`).join(' '),fill:'none',stroke:'#436bc0','stroke-width':'3','stroke-linejoin':'round'}));
 const tip=el('div');tip.className='stats-tip';
 vals.forEach((v,i)=>{svg.append(mk('circle',{cx:X(i),cy:Y(v),r:'4',fill:'#436bc0'}));
  if(n<=14)svg.append(mk('text',{x:X(i),y:Y(v)-10,'text-anchor':'middle','font-size':'12','font-weight':'700',fill:'#2a3a86'},String(v)));
  const hit=mk('circle',{cx:X(i),cy:Y(v),r:'14',fill:'transparent',tabindex:'0'});hit.style.cursor='pointer';
  const show=()=>{const d=rows[i].dimensions[0];tip.textContent=`${+d.slice(4,6)}월 ${+d.slice(6,8)}일 · 활성 사용자 ${num(v)}명`;tip.style.left=`${X(i)/W*100}%`;tip.style.top=`${Y(v)/H*100}%`;tip.classList.add('on');},hide=()=>tip.classList.remove('on');
  hit.addEventListener('mouseenter',show);hit.addEventListener('focus',show);hit.addEventListener('click',show);hit.addEventListener('mouseleave',hide);hit.addEventListener('blur',hide);svg.append(hit);});
 wrap.append(svg,tip);return wrap;}
export function renderStats(container,snapshots){
 container.replaceChildren();
 for(const [section,title,heading,metric] of definitions){
  const snapshot=snapshots.find(x=>x.section===section),payload=snapshot?.payload,rows=payload?.rows||[],card=el('section');card.className='stats-card';card.append(el('h2',title));
  if(!payload||!rows.length){const empty=el('p',payload?'아직 쌓인 데이터가 없습니다':'통계 수집을 준비하고 있습니다');empty.className='stats-empty';card.append(empty);}
  else if(section==='daily'){
   const summary=el('div');summary.className='stats-summary';['조회수','활성 사용자','방문 횟수'].forEach((name,i)=>{const item=el('div',name);item.append(el('strong',num(payload.totals?.[i])));summary.append(item);});card.append(summary);
   const sorted=[...rows].sort((a,b)=>a.dimensions[0].localeCompare(b.dimensions[0]));card.append(dailyChart(sorted));
   const detail=el('details');detail.append(el('summary','일별 수치 보기'));const table=el('table');for(const r of sorted){const tr=el('tr');tr.append(el('td',r.dimensions[0]),el('td',num(r.metrics[1])));table.append(tr);}detail.append(table);card.append(detail);
  }else{
   if(section==='source')card.append(aiSummary(rows));const table=el('table'),thead=el('thead'),tr=el('tr');tr.append(el('th',heading),el('th',metric));thead.append(tr);table.append(thead);const body=el('tbody');for(const row of [...(section==='source'?mergeByLabel(section,rows):rows)].sort((a,b)=>Number(b.metrics[0])-Number(a.metrics[0])).slice(0,10)){const tr=el('tr');tr.append(cell(section,row),el('td',num(row.metrics[0])));body.append(tr);}table.append(body);card.append(table);
  }
  if(snapshot){const meta=el('p',`${payload.startDate} ~ ${payload.endDate} · 갱신 ${new Date(snapshot.updated_at).toLocaleString('ko-KR')}`);meta.className='stats-meta';card.append(meta);}container.append(card);
 }
}
export function setupStats(api,onAuthError){
 const $=id=>document.getElementById(id);if(!$('statsPane'))return;let generation=0;
 async function load(){const version=++generation;$('statsStatus').textContent='통계를 불러오는 중입니다.';$('statsCards').replaceChildren();try{const rows=await api.stats($('statsPeriod').value);if(version!==generation)return;renderStats($('statsCards'),rows);$('statsStatus').textContent=rows.length?'집계된 통계입니다.':'첫 통계 수집을 기다리고 있습니다.';}catch(error){if(version!==generation)return;$('statsStatus').textContent=error.message;onAuthError(error);}}
 function show(stats){$('casesPane').hidden=stats;$('statsPane').hidden=!stats;for(const [id,selected] of [['tabCases',!stats],['tabStats',stats]]){$(id).classList.toggle('is-on',selected);$(id).setAttribute('aria-selected',String(selected));}$('sideCrumb').textContent=stats?'통계':'임상사례';if(stats)load();}
 $('tabCases').addEventListener('click',()=>show(false));$('tabStats').addEventListener('click',()=>show(true));$('statsPeriod').addEventListener('change',load);$('statsRefresh').addEventListener('click',load);$('statsLogout').addEventListener('click',()=>$('logout').click());
 return ()=>{generation++;$('statsCards').replaceChildren();$('statsStatus').textContent='';show(false);};
}
