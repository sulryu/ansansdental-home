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
function label(section,row){const key=row.dimensions?.[0]||'';if(section==='search_queries')return key.length>20?key.slice(0,20)+'...':key;if(section==='pages'){const path=row.dimensions?.[1]||'';return `${key==='ansansdental.com'?'홈페이지':key} · ${maps.pages[path]||path}`;}return maps[section]?.[key]||(section==='region'?'확인 불가':section==='device'?'기타':key);}
export function renderStats(container,snapshots){
 container.replaceChildren();
 for(const [section,title,heading,metric] of definitions){
  const snapshot=snapshots.find(x=>x.section===section),payload=snapshot?.payload,rows=payload?.rows||[],card=el('section');card.className='stats-card';card.append(el('h2',title));
  if(!payload||!rows.length){const empty=el('p',payload?'아직 쌓인 데이터가 없습니다':'통계 수집을 준비하고 있습니다');empty.className='stats-empty';card.append(empty);}
  else if(section==='daily'){
   const summary=el('div');summary.className='stats-summary';['조회수','활성 사용자','방문 횟수'].forEach((name,i)=>{const item=el('div',name);item.append(el('strong',num(payload.totals?.[i])));summary.append(item);});card.append(summary);
   const sorted=[...rows].sort((a,b)=>a.dimensions[0].localeCompare(b.dimensions[0])),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 160');svg.classList.add('stats-chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','일별 활성 사용자 추이');
   const max=Math.max(1,...sorted.map(r=>Number(r.metrics[1])||0)),points=sorted.map((r,i)=>`${20+i*560/Math.max(1,sorted.length-1)},${140-(Number(r.metrics[1])||0)*120/max}`),line=document.createElementNS(ns,'polyline');line.setAttribute('points',points.join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#436bc0');line.setAttribute('stroke-width','3');svg.append(line);
   sorted.forEach((r,i)=>{const circle=document.createElementNS(ns,'circle'),[x,y]=points[i].split(',');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','3');circle.setAttribute('fill','#436bc0');const tip=document.createElementNS(ns,'title');tip.textContent=`${r.dimensions[0]}: ${num(r.metrics[1])}명`;circle.append(tip);svg.append(circle);});card.append(svg);
   const detail=el('details');detail.append(el('summary','일별 수치 보기'));const table=el('table');for(const r of sorted){const tr=el('tr');tr.append(el('td',r.dimensions[0]),el('td',num(r.metrics[1])));table.append(tr);}detail.append(table);card.append(detail);
  }else{
   const table=el('table'),thead=el('thead'),tr=el('tr');tr.append(el('th',heading),el('th',metric));thead.append(tr);table.append(thead);const body=el('tbody');for(const row of [...rows].sort((a,b)=>Number(b.metrics[0])-Number(a.metrics[0])).slice(0,section==='search_queries'?10:20)){const tr=el('tr');tr.append(el('td',label(section,row)),el('td',num(row.metrics[0])));body.append(tr);}table.append(body);card.append(table);
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
