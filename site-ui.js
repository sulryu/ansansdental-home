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
