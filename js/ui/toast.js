// Всплывающие уведомления
function toast(message) {
  const toastElement = $('#ts');
  toastElement.textContent = message;
  toastElement.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastElement.classList.remove('on'), 2600);

  const adminMessage = $('#am');
  if ($('#dg').open && adminMessage) adminMessage.textContent = message;
}
