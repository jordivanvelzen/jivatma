// View mode toggle for master admin users
// When "student view" is active, master admins see the student UI instead of admin UI.
// State is persisted in sessionStorage so it survives hash navigations and page reloads
// within the same browser session. A fresh browser session resets to admin view.

const MASTER_ADMIN_EMAILS = ['chaudy@gmail.com', 'jordi.vanvelzen@gmail.com'];
const STORAGE_KEY = 'jivatma_student_view';

export function isMasterAdmin(email) {
  return MASTER_ADMIN_EMAILS.includes(email);
}

export function isStudentView() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStudentView(enabled) {
  try {
    if (enabled) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage unavailable — nothing to persist, view defaults to admin
  }
}

export function toggleStudentView() {
  const next = !isStudentView();
  setStudentView(next);
  return next;
}
