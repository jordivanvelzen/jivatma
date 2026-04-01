// Bilingual support: Spanish (default) / English
// Language stored in cookie, persists across sessions

const translations = {
  es: {
    // Nav
    'nav.dashboard': 'Inicio',
    'nav.attendance': 'Asistencia',
    'nav.users': 'Usuarios',
    'nav.passes': 'Pases',
    'nav.schedule': 'Horario',
    'nav.settings': 'Ajustes',
    'nav.home': 'Inicio',
    'nav.classes': 'Clases',
    'nav.myPasses': 'Mis Pases',
    'nav.history': 'Historial',
    'nav.profile': 'Perfil',
    'nav.logout': 'Cerrar sesión',
    'nav.studentView': 'Vista Alumno',
    'nav.adminView': 'Vista Admin',

    // Auth
    'auth.login': 'Iniciar sesión',
    'auth.register': 'Crear cuenta',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.fullName': 'Nombre completo',
    'auth.forgotPassword': '¿Olvidaste tu contraseña?',
    'auth.createAccount': 'Crear cuenta',
    'auth.haveAccount': '¿Ya tienes cuenta?',
    'auth.noAccount': '¿No tienes cuenta?',
    'auth.sendResetLink': 'Enviar enlace',
    'auth.resetPassword': 'Restablecer contraseña',
    'auth.newPassword': 'Nueva contraseña',
    'auth.updatePassword': 'Actualizar contraseña',
    'auth.backToLogin': 'Volver al inicio de sesión',
    'auth.passwordMin': 'Contraseña (mín. 6 caracteres)',
    'auth.checkEmail': 'Revisa tu correo para confirmar tu cuenta.',
    'auth.checkEmailReset': 'Revisa tu correo para el enlace de restablecimiento.',
    'auth.passwordUpdated': '¡Contraseña actualizada!',
    'auth.accountCreated': '¡Cuenta creada! Revisa tu correo para confirmar.',

    // Dashboard
    'dash.welcome': 'Bienvenido/a',
    'dash.yourPasses': 'Tus Pases',
    'dash.noActivePasses': 'No tienes pases activos. Contacta a tu instructora para obtener uno.',
    'dash.upcomingClasses': 'Próximas Clases',
    'dash.noBookings': 'No tienes reservas.',
    'dash.browseClasses': 'Ver clases',
    'dash.recentAttendance': 'Asistencia Reciente',
    'dash.noAttendance': 'Aún no hay asistencia registrada.',

    // Schedule
    'schedule.title': 'Próximas Clases',
    'schedule.noClasses': 'No hay clases programadas.',
    'schedule.signup': 'Reservar',
    'schedule.cancel': 'Cancelar',
    'schedule.full': 'Lleno',
    'schedule.youreSignedUp': 'Estás inscrito/a',
    'schedule.signedUp': '¡Reservado!',
    'schedule.bookingCancelled': 'Reserva cancelada.',
    'schedule.spots': 'plazas',
    'schedule.onlineLink': 'Enlace en línea:',
    'schedule.noPass': 'Sin pase',
    'schedule.noPassBanner': 'No tienes un pase activo. Ve a Mis Pases para seleccionar una clase individual o contacta a tu instructora para un pase.',
    'schedule.getPasses': 'Obtener un pase',

    // Passes
    'passes.title': 'Mis Pases',
    'passes.noPasses': 'Aún no tienes pases.',
    'passes.singleClass': 'Clase Única',
    'passes.multiClass': 'Pase de {n} Clases',
    'passes.unlimited': 'Mensual Ilimitado',
    'passes.classesLeft': '{remaining}/{total} clases restantes',
    'passes.expires': 'Vence {date}',
    'passes.active': 'activo',
    'passes.expired': 'vencido',
    'passes.usedUp': 'agotado',
    'passes.payAtClass': 'pagar en clase',
    'passes.yourPasses': 'Tus Pases',
    'passes.availableTypes': 'Pases Disponibles',
    'passes.validFor': '{days} días de validez',
    'passes.singleNote': 'Selecciona y reserva una clase. Pagas al llegar.',
    'passes.selectSingle': 'Seleccionar',
    'passes.alreadySelected': 'Ya seleccionado',
    'passes.singleSelected': '¡Clase individual seleccionada! Ya puedes reservar una clase.',
    'passes.alreadyHasSingle': 'Ya tienes una clase individual activa.',
    'passes.contactInstructor': 'Contacta a tu instructora',

    // Attendance history
    'attendance.title': 'Historial de Asistencia',
    'attendance.noRecords': 'Aún no hay asistencia registrada.',
    'attendance.date': 'Fecha',
    'attendance.time': 'Hora',
    'attendance.type': 'Tipo',

    // Profile
    'profile.title': 'Perfil',
    'profile.fullName': 'Nombre completo',
    'profile.phone': 'Teléfono',
    'profile.phoneOptional': 'Opcional',
    'profile.save': 'Guardar',
    'profile.changePassword': 'Cambiar Contraseña',
    'profile.updated': '¡Perfil actualizado!',

    // Admin Dashboard
    'admin.dashboard': 'Panel de Administración',
    'admin.todaysClasses': 'Clases de Hoy',
    'admin.noClassesToday': 'No hay clases hoy.',
    'admin.expiringSoon': 'Pases por Vencer',
    'admin.noExpiring': 'No hay pases por vencer en los próximos 7 días.',
    'admin.expiresOn': 'vence el {date}',
    'admin.classesRemaining': '{n} clase(s) restante(s)',
    'admin.quickActions': 'Acciones Rápidas',
    'admin.markAttendance': 'Registrar Asistencia',
    'admin.manageUsers': 'Gestionar Usuarios',
    'admin.editSchedule': 'Editar Horario',

    // Admin Attendance
    'admin.attendance': 'Asistencia',
    'admin.booked': 'reservado',
    'admin.others': 'Otros',
    'admin.saveAttendance': 'Guardar Asistencia',
    'admin.checkedIn': '{n} registrados, {p} pases descontados',
    'admin.noPass': '{n} sin pase',
    'admin.noClassesDate': 'No hay clases en esta fecha.',

    // Admin Users
    'admin.users': 'Usuarios',
    'admin.noUsers': 'Aún no hay usuarios.',
    'admin.name': 'Nombre',
    'admin.role': 'Rol',
    'admin.view': 'Ver',
    'admin.backToUsers': '← Volver a usuarios',
    'admin.noPhone': 'Sin teléfono',
    'admin.removeAdmin': 'Quitar admin',
    'admin.makeAdmin': 'Hacer admin',
    'admin.roleChanged': 'Rol cambiado a {role}',

    // Admin Assign Pass
    'admin.assignPass': 'Asignar Pase',
    'admin.selectPassType': 'Seleccionar tipo de pase',
    'admin.cash': 'Efectivo',
    'admin.transfer': 'Transferencia',
    'admin.other': 'Otro',
    'admin.paid': 'Pagado',
    'admin.assign': 'Asignar',
    'admin.passAssigned': '¡Pase asignado!',
    'admin.recentAttendance': 'Asistencia Reciente',
    'admin.noAttendanceYet': 'Aún sin asistencia.',

    // Admin Pass Types
    'admin.passTypes': 'Tipos de Pase',
    'admin.classes': 'Clases',
    'admin.validDays': 'Validez (días)',
    'admin.price': 'Precio',
    'admin.activeCol': 'Activo',
    'admin.deactivate': 'Desactivar',
    'admin.activate': 'Activar',
    'admin.addPassType': 'Agregar Tipo de Pase',
    'admin.kind': 'Tipo',
    'admin.add': 'Agregar',
    'admin.passTypeAdded': '¡Tipo de pase agregado!',

    // Admin Schedule
    'admin.weeklySchedule': 'Horario Semanal',
    'admin.noTemplates': 'Aún no hay clases configuradas.',
    'admin.day': 'Día',
    'admin.capacity': 'Capacidad',
    'admin.disable': 'Desactivar',
    'admin.enable': 'Activar',
    'admin.delete': 'Eliminar',
    'admin.addClass': 'Agregar Clase',
    'admin.duration': 'Duración (min)',
    'admin.generateSessions': 'Generar Sesiones',
    'admin.generateNote': 'Las sesiones se generan automáticamente a diario. Haz clic para generar manualmente.',
    'admin.generateNext2Weeks': 'Generar Próximas 2 Semanas',
    'admin.generated': '{n} sesiones generadas.',
    'admin.deleted': 'Eliminado.',
    'admin.classAdded': '¡Clase agregada!',
    'admin.deleteConfirm': '¿Eliminar esta plantilla de clase?',

    // Admin Settings
    'admin.settingsTitle': 'Ajustes',
    'admin.locationAddress': 'Dirección del lugar',
    'admin.locationPlaceholder': 'Ej. Estudio de Yoga, Calle Principal 123',
    'admin.meetingLink': 'Enlace de reunión en línea',
    'admin.meetingLinkPlaceholder': 'https://zoom.us/j/...',
    'admin.signupWindow': 'Ventana de inscripción (semanas)',
    'admin.defaultCapacity': 'Capacidad por defecto',
    'admin.saveSettings': 'Guardar Ajustes',
    'admin.settingsSaved': '¡Ajustes guardados!',

    // Class types
    'type.online': '💻 En línea',
    'type.in_person': '🏠 Presencial',
    'type.hybrid': '🔀 Híbrido',

    // Days
    'day.0': 'Domingo', 'day.1': 'Lunes', 'day.2': 'Martes',
    'day.3': 'Miércoles', 'day.4': 'Jueves', 'day.5': 'Viernes', 'day.6': 'Sábado',

    // Language
    'lang.switch': 'English',

    // General
    'general.notFound': 'Página no encontrada',
    'general.goHome': 'Ir al inicio',
  },

  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.attendance': 'Attendance',
    'nav.users': 'Users',
    'nav.passes': 'Passes',
    'nav.schedule': 'Schedule',
    'nav.settings': 'Settings',
    'nav.home': 'Home',
    'nav.classes': 'Classes',
    'nav.myPasses': 'My Passes',
    'nav.history': 'History',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    'nav.studentView': 'Student View',
    'nav.adminView': 'Admin View',

    // Auth
    'auth.login': 'Log in',
    'auth.register': 'Create Account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full name',
    'auth.forgotPassword': 'Forgot password?',
    'auth.createAccount': 'Create account',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.sendResetLink': 'Send reset link',
    'auth.resetPassword': 'Reset Password',
    'auth.newPassword': 'New password',
    'auth.updatePassword': 'Update password',
    'auth.backToLogin': 'Back to login',
    'auth.passwordMin': 'Password (min 6 characters)',
    'auth.checkEmail': 'Check your email to confirm your account.',
    'auth.checkEmailReset': 'Check your email for the reset link.',
    'auth.passwordUpdated': 'Password updated!',
    'auth.accountCreated': 'Account created! Check your email to confirm.',

    // Dashboard
    'dash.welcome': 'Welcome back',
    'dash.yourPasses': 'Your Passes',
    'dash.noActivePasses': 'No active pass. Contact your instructor to get one.',
    'dash.upcomingClasses': 'Upcoming Classes',
    'dash.noBookings': 'No upcoming bookings.',
    'dash.browseClasses': 'Browse classes',
    'dash.recentAttendance': 'Recent Attendance',
    'dash.noAttendance': 'No attendance recorded yet.',

    // Schedule
    'schedule.title': 'Upcoming Classes',
    'schedule.noClasses': 'No classes scheduled yet.',
    'schedule.signup': 'Sign up',
    'schedule.cancel': 'Cancel',
    'schedule.full': 'Full',
    'schedule.youreSignedUp': "You're signed up",
    'schedule.signedUp': 'Signed up!',
    'schedule.bookingCancelled': 'Booking cancelled.',
    'schedule.spots': 'spots',
    'schedule.onlineLink': 'Online link:',
    'schedule.noPass': 'No pass',
    'schedule.noPassBanner': 'You don\'t have an active pass. Go to My Passes to select a single class or contact your instructor for a pass.',
    'schedule.getPasses': 'Get a pass',

    // Passes
    'passes.title': 'My Passes',
    'passes.noPasses': 'No passes yet.',
    'passes.singleClass': 'Single Class',
    'passes.multiClass': '{n}-Class Pass',
    'passes.unlimited': 'Unlimited Monthly',
    'passes.classesLeft': '{remaining}/{total} classes left',
    'passes.expires': 'Expires {date}',
    'passes.active': 'active',
    'passes.expired': 'expired',
    'passes.usedUp': 'used up',
    'passes.payAtClass': 'pay at class',
    'passes.yourPasses': 'Your Passes',
    'passes.availableTypes': 'Available Passes',
    'passes.validFor': '{days} days validity',
    'passes.singleNote': 'Select and book one class. Pay when you arrive.',
    'passes.selectSingle': 'Select',
    'passes.alreadySelected': 'Already selected',
    'passes.singleSelected': 'Single class selected! You can now book a class.',
    'passes.alreadyHasSingle': 'You already have an active single class pass.',
    'passes.contactInstructor': 'Contact your instructor',

    // Attendance history
    'attendance.title': 'Attendance History',
    'attendance.noRecords': 'No attendance recorded yet.',
    'attendance.date': 'Date',
    'attendance.time': 'Time',
    'attendance.type': 'Type',

    // Profile
    'profile.title': 'Profile',
    'profile.fullName': 'Full Name',
    'profile.phone': 'Phone',
    'profile.phoneOptional': 'Optional',
    'profile.save': 'Save',
    'profile.changePassword': 'Change Password',
    'profile.updated': 'Profile updated!',

    // Admin Dashboard
    'admin.dashboard': 'Admin Dashboard',
    'admin.todaysClasses': "Today's Classes",
    'admin.noClassesToday': 'No classes today.',
    'admin.expiringSoon': 'Passes Expiring Soon',
    'admin.noExpiring': 'No passes expiring within 7 days.',
    'admin.expiresOn': 'expires {date}',
    'admin.classesRemaining': '{n} class(es) remaining',
    'admin.quickActions': 'Quick Actions',
    'admin.markAttendance': 'Mark Attendance',
    'admin.manageUsers': 'Manage Users',
    'admin.editSchedule': 'Edit Schedule',

    // Admin Attendance
    'admin.attendance': 'Attendance',
    'admin.booked': 'booked',
    'admin.others': 'Others',
    'admin.saveAttendance': 'Save Attendance',
    'admin.checkedIn': '{n} checked in, {p} passes deducted',
    'admin.noPass': '{n} without pass',
    'admin.noClassesDate': 'No classes on this date.',

    // Admin Users
    'admin.users': 'Users',
    'admin.noUsers': 'No users yet.',
    'admin.name': 'Name',
    'admin.role': 'Role',
    'admin.view': 'View',
    'admin.backToUsers': '← Back to users',
    'admin.noPhone': 'No phone',
    'admin.removeAdmin': 'Remove admin',
    'admin.makeAdmin': 'Make admin',
    'admin.roleChanged': 'Role changed to {role}',

    // Admin Assign Pass
    'admin.assignPass': 'Assign Pass',
    'admin.selectPassType': 'Select pass type',
    'admin.cash': 'Cash',
    'admin.transfer': 'Transfer',
    'admin.other': 'Other',
    'admin.paid': 'Paid',
    'admin.assign': 'Assign',
    'admin.passAssigned': 'Pass assigned!',
    'admin.recentAttendance': 'Recent Attendance',
    'admin.noAttendanceYet': 'No attendance yet.',

    // Admin Pass Types
    'admin.passTypes': 'Pass Types',
    'admin.classes': 'Classes',
    'admin.validDays': 'Valid (days)',
    'admin.price': 'Price',
    'admin.activeCol': 'Active',
    'admin.deactivate': 'Deactivate',
    'admin.activate': 'Activate',
    'admin.addPassType': 'Add Pass Type',
    'admin.kind': 'Kind',
    'admin.add': 'Add',
    'admin.passTypeAdded': 'Pass type added!',

    // Admin Schedule
    'admin.weeklySchedule': 'Weekly Schedule',
    'admin.noTemplates': 'No classes set up yet.',
    'admin.day': 'Day',
    'admin.capacity': 'Capacity',
    'admin.disable': 'Disable',
    'admin.enable': 'Enable',
    'admin.delete': 'Delete',
    'admin.addClass': 'Add Class',
    'admin.duration': 'Duration (min)',
    'admin.generateSessions': 'Generate Sessions',
    'admin.generateNote': 'Sessions are auto-generated daily. Click below to manually generate now.',
    'admin.generateNext2Weeks': 'Generate Next 2 Weeks',
    'admin.generated': '{n} sessions generated.',
    'admin.deleted': 'Deleted.',
    'admin.classAdded': 'Class added!',
    'admin.deleteConfirm': 'Delete this class template?',

    // Admin Settings
    'admin.settingsTitle': 'Settings',
    'admin.locationAddress': 'Location Address',
    'admin.locationPlaceholder': 'e.g. Yoga Studio, Main St 123',
    'admin.meetingLink': 'Online Meeting Link',
    'admin.meetingLinkPlaceholder': 'https://zoom.us/j/...',
    'admin.signupWindow': 'Sign-up Window (weeks)',
    'admin.defaultCapacity': 'Default Class Capacity',
    'admin.saveSettings': 'Save Settings',
    'admin.settingsSaved': 'Settings saved!',

    // Class types
    'type.online': '💻 Online',
    'type.in_person': '🏠 In-person',
    'type.hybrid': '🔀 Hybrid',

    // Days
    'day.0': 'Sunday', 'day.1': 'Monday', 'day.2': 'Tuesday',
    'day.3': 'Wednesday', 'day.4': 'Thursday', 'day.5': 'Friday', 'day.6': 'Saturday',

    // Language
    'lang.switch': 'Español',

    // General
    'general.notFound': 'Page not found',
    'general.goHome': 'Go home',
  },
};

// Get/set language from cookie
function getLang() {
  const match = document.cookie.match(/(?:^|; )jivatma_lang=(\w+)/);
  return match ? match[1] : 'es';
}

function setLang(lang) {
  document.cookie = `jivatma_lang=${lang};path=/;max-age=31536000;SameSite=Lax`;
}

let currentLang = getLang();

/**
 * Translate a key, with optional replacements: t('passes.classesLeft', { remaining: 3, total: 10 })
 */
export function t(key, replacements = {}) {
  let str = translations[currentLang]?.[key] || translations['es']?.[key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}

/**
 * Get the current language code.
 */
export function getCurrentLang() {
  return currentLang;
}

/**
 * Get the locale string for date formatting.
 */
export function getLocale() {
  return currentLang === 'es' ? 'es-ES' : 'en-GB';
}

/**
 * Toggle language and reload the current page view.
 */
export function toggleLang() {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  setLang(currentLang);
  // Re-trigger current route
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
