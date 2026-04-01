// View mode toggle for master admin users
// When "student view" is active, master admins see the student UI instead of admin UI

const MASTER_ADMIN_EMAILS = ['chaudy@gmail.com', 'jordi.vanvelzen@gmail.com'];

let studentView = false;

export function isMasterAdmin(email) {
  return MASTER_ADMIN_EMAILS.includes(email);
}

export function isStudentView() {
  return studentView;
}

export function setStudentView(enabled) {
  studentView = enabled;
}

export function toggleStudentView() {
  studentView = !studentView;
  return studentView;
}
