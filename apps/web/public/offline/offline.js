try {
  document.documentElement.dataset.theme =
    localStorage.getItem('oriva-theme') === 'dark' ? 'dark' : 'light';
} catch {
  /* The offline screen also works when storage is unavailable. */
}
document.getElementById('retry')?.addEventListener('click', () => window.location.reload());
