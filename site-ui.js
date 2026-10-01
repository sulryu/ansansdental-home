const menu = document.getElementById('siteMenu');
let previous;
if (menu) {
  document.querySelectorAll('[data-site-menu]').forEach(button => button.addEventListener('click', () => {
    if (menu.open) return;
    previous = button; menu.showModal();
  }));
  menu.querySelector('[data-site-menu-close]').addEventListener('click', () => menu.close());
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => menu.close()));
  menu.addEventListener('close', () => previous?.focus({preventScroll:true}));
}

const dropdowns = [...document.querySelectorAll('.site-dropdown')];
function closeDropdowns(except) { dropdowns.forEach(item => { if (item !== except) item.open = false; }); }
dropdowns.forEach(item => {
  item.addEventListener('toggle', () => { if (item.open) closeDropdowns(item); });
  item.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && window.matchMedia('(min-width:1001px)').matches) { closeDropdowns(item); item.open = true; } });
  item.addEventListener('pointerleave', () => { if (!item.contains(document.activeElement)) item.open = false; });
});
document.addEventListener('click', event => { if (!dropdowns.some(item => item.contains(event.target))) closeDropdowns(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const open = dropdowns.find(item => item.open);
  if (open) { closeDropdowns(); open.querySelector('summary').focus(); }
});
