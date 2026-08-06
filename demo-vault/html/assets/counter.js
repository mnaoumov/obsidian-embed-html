document.addEventListener('DOMContentLoaded', () => {
  const buttonEl = document.getElementById('count');
  let clicks = 0;
  buttonEl.addEventListener('click', () => {
    clicks++;
    buttonEl.textContent = `Clicked ${clicks} time${clicks === 1 ? '' : 's'}`;
  });
});
