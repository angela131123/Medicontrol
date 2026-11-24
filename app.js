const medications = [
  { id: 'losartan', name: 'Losartán', dose: '50 mg', time: '08:00' },
  { id: 'metformina', name: 'Metformina', dose: '850 mg', time: '14:00' },
  { id: 'atorvastatina', name: 'Atorvastatina', dose: '20 mg', time: '21:00' },
];

const statuses = { done: 'Realizada', omitted: 'Omitida', pending: 'Pendiente' };
const sessionKey = 'medicontrol.session';
const loginView = document.querySelector('#login-view');
const appView = document.querySelector('#app-view');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const doseForm = document.querySelector('#dose-form');
const doseError = doseForm.querySelector('.form-error');
const medicineList = document.querySelector('#medicine-list');
const medicineTemplate = document.querySelector('#medicine-template');
const screens = [...appView.querySelectorAll('.screen')];
const navButtons = appView.querySelectorAll('nav [data-view]');
let profile = '';

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recordKey(id, date) {
  return `medicontrol.dose:${encodeURIComponent(profile)}:${date}:${id}`;
}

function savedStatus(id, date) {
  try {
    const status = localStorage.getItem(recordKey(id, date));
    return Object.hasOwn(statuses, status) ? status : null;
  } catch {
    return null;
  }
}

function nextDose() {
  const now = new Date();
  const today = localDate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const upcoming = medications.find(({ id, time }) => {
    const status = savedStatus(id, today);
    return time >= currentTime && status !== 'done' && status !== 'omitted';
  });

  return upcoming ? { medication: upcoming, day: 'Hoy' } : { medication: medications[0], day: 'Mañana' };
}

function updateTime(element, value) {
  element.dateTime = value;
  element.textContent = value;
}

function updateNextDose(screen) {
  const { medication, day } = nextDose();
  updateTime(screen.querySelector('[data-next="time"]'), medication.time);
  screen.querySelector('[data-next="summary"]').textContent = `${medication.name} · ${medication.dose}`;
  screen.querySelector('[data-next="details"]').textContent = `1 tableta · ${day}`;
  const alert = screen.querySelector('[data-next="alert"]');
  if (alert) alert.textContent = `Próxima toma: ${day.toLocaleLowerCase('es')} a las ${medication.time}`;
}

function renderMedicines() {
  const { medication: next, day } = nextDose();
  const today = localDate();
  const cards = medications.map(medication => {
    const card = medicineTemplate.content.firstElementChild.cloneNode(true);
    const status = savedStatus(medication.id, today);
    const isNext = day === 'Hoy' && next.id === medication.id;
    const schedule = isNext ? 'Próxima toma' : 'Programada';
    const button = card.querySelector('button');

    card.querySelector('h3').textContent = medication.name;
    updateTime(card.querySelector('time'), medication.time);
    card.querySelector('.dose-amount').textContent = `${medication.dose} · 1 tableta`;
    card.querySelector('.medicine-status').textContent = `Cada 24 horas · ${statuses[status] || schedule}`;
    button.classList.toggle('primary', isNext);
    button.classList.toggle('secondary', !isNext);
    button.dataset.medication = medication.id;
    button.textContent = status ? 'Editar registro' : 'Registrar toma';
    button.setAttribute('aria-label', `${button.textContent} de ${medication.name}`);
    return card;
  });

  document.querySelector('#medication-count').textContent = medications.length;
  medicineList.replaceChildren(...cards);
}

function updateDoseCard(screen, medication) {
  screen.querySelector('[data-dose="name"]').textContent = medication.name;
  screen.querySelector('[data-dose="amount"]').textContent = `${medication.dose} · 1 tableta`;
  updateTime(screen.querySelector('[data-dose="time"]'), medication.time);
}

function showPage(view, medication, status) {
  const screen = screens.find(page => page.id === view);
  if (!screen) return;

  switch (view) {
    case 'home': {
      const name = profile.split('@')[0].split(/[._+-]/)[0] || 'paciente';
      screen.querySelector('#patient-name').textContent = name.charAt(0).toLocaleUpperCase('es') + name.slice(1);
      updateNextDose(screen);
      break;
    }
    case 'reminders':
      updateNextDose(screen);
      break;
    case 'medicines':
      renderMedicines();
      break;
    case 'dose':
      doseForm.reset();
      doseError.hidden = true;
      doseForm.dataset.medication = medication.id;
      doseForm.dataset.date = localDate();
      doseForm.elements.status.value = savedStatus(medication.id, doseForm.dataset.date) || '';
      updateDoseCard(screen, medication);
      break;
    case 'saved':
      updateDoseCard(screen, medication);
      screen.querySelector('[data-dose="status"]').textContent = statuses[status];
      break;
  }

  const activeNav = view === 'dose' || view === 'saved' ? 'medicines' : view;
  for (const button of navButtons) {
    if (button.dataset.view === activeNav) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  for (const page of screens) page.hidden = page !== screen;
  window.scrollTo(0, 0);
  screen.querySelector('h1').focus({ preventScroll: true });
}

function enterApp(email) {
  profile = email;
  loginView.hidden = true;
  appView.hidden = false;
  showPage('home');
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const email = loginForm.elements.email.value.trim().toLowerCase();
  loginForm.elements.password.value = '';
  try {
    localStorage.setItem(sessionKey, email);
  } catch {
    showError(loginError, 'Habilita el almacenamiento del sitio en tu navegador para continuar.');
    return;
  }
  loginError.hidden = true;
  loginForm.reset();
  enterApp(email);
});

function logout() {
  try {
    localStorage.removeItem(sessionKey);
    loginError.hidden = true;
  } catch {
    showError(loginError, 'El navegador bloqueó el acceso al almacenamiento local.');
  }
  profile = '';
  appView.hidden = true;
  loginView.hidden = false;
  loginForm.elements.email.focus();
}

appView.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.classList.contains('logout')) {
    logout();
  } else if (button.dataset.view) {
    const medication = medications.find(item => item.id === button.dataset.medication);
    showPage(button.dataset.view, medication);
  }
});

doseForm.addEventListener('submit', event => {
  event.preventDefault();
  const medication = medications.find(item => item.id === doseForm.dataset.medication);
  const status = doseForm.elements.status.value;
  if (!medication || !Object.hasOwn(statuses, status)) return;

  try {
    localStorage.setItem(recordKey(medication.id, doseForm.dataset.date), status);
  } catch {
    showError(doseError, 'No se pudo guardar la toma en este navegador. Intenta de nuevo.');
    return;
  }
  showPage('saved', medication, status);
});

loginForm.querySelector('button[type="submit"]').disabled = false;
try {
  profile = localStorage.getItem(sessionKey) || '';
} catch {
  showError(loginError, 'Habilita el almacenamiento del sitio en tu navegador para continuar.');
}

if (profile) enterApp(profile);
