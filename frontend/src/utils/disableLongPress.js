// Stops the long-press menu (copy / open link / save image) on touch devices.
// Only runs on touch screens, so right-click and DevTools still work on desktop.
if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) {
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    e.preventDefault();
  });
}