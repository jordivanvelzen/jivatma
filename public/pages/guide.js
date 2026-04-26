import { t, getCurrentLang, toggleLang } from '../lib/i18n.js';

const content = {
  es: {
    student: {
      intro: 'Esta guía explica cómo usar la app de Jivatma como alumna — desde crear tu cuenta hasta reservar clases y gestionar tus pases.',
      sections: [
        {
          title: '1. Crear una cuenta',
          steps: [
            'Abre la app y toca <strong>Crear cuenta</strong>.',
            'Escribe tu nombre completo, correo electrónico, número de WhatsApp y una contraseña (mínimo 6 caracteres).',
            'Toca <strong>Crear cuenta</strong>. Serás redirigida a la pantalla de inicio de sesión.',
            'Inicia sesión con tu correo y contraseña.',
          ],
        },
        {
          title: '2. Tu panel de inicio',
          steps: [
            'Al iniciar sesión llegas a tu <strong>Panel de Inicio</strong>.',
            '<strong>Tus pases activos</strong> se muestran en la parte superior — ves cuántas clases te quedan y cuándo vence el pase.',
            'Si tienes una solicitud de pase pendiente, aparece un aviso amarillo mientras esperas que Claudia la apruebe.',
            '<strong>Próximas clases</strong> muestra tus reservas activas.',
            '<strong>Asistencia reciente</strong> muestra las últimas clases a las que asististe.',
            'Si eres nueva y aún no tienes pases ni reservas, aparece una tarjeta de bienvenida con los pasos iniciales.',
          ],
        },
        {
          title: '3. Tipos de pases',
          steps: [
            '<strong>Clase única</strong> — vale para una sola clase. Puedes seleccionarla tú misma desde "Mis Pases" y pagarla al llegar al estudio.',
            '<strong>Pase de N clases</strong> — te da un número fijo de clases (por ejemplo, 5 o 10). Debes solicitarlo a Claudia.',
            '<strong>Mensual ilimitado</strong> — clases ilimitadas durante el mes de validez. Debes solicitarlo a Claudia.',
            'Los pases tienen una fecha de vencimiento. Un aviso ámbar aparece cuando tu pase vence en 7 días o menos.',
          ],
        },
        {
          title: '4. Solicitar un pase',
          steps: [
            'Ve a <strong>Mis Pases</strong> en el menú inferior.',
            'En la sección "Pases Disponibles", elige el pase que quieres.',
            'Para una <strong>clase única</strong>, toca "Seleccionar" y el pase se crea de inmediato (lo pagas en clase).',
            'Para pases de múltiples clases o ilimitados, toca "Solicitar" y elige tu método de pago (efectivo o transferencia).',
            'Si pagas por <strong>transferencia</strong>, los datos bancarios aparecen en el modal para que realices el pago.',
            'Si pagas en <strong>efectivo</strong>, aparece un aviso para que lleves el dinero a tu próxima clase (llega 10 min antes).',
            'Tu solicitud queda en estado "pendiente" hasta que Claudia la apruebe. Recibirás confirmación por WhatsApp.',
          ],
        },
        {
          title: '5. Ver el horario y reservar clases',
          steps: [
            'Ve a <strong>Clases</strong> en el menú inferior.',
            'Verás las clases disponibles en las próximas semanas. Cada tarjeta muestra la fecha, hora, tipo de clase y lugares disponibles.',
            'Necesitas un <strong>pase activo</strong> para poder reservar.',
            'Toca <strong>Reservar</strong> en la clase que quieras.',
            'Para clases <strong>híbridas</strong>, elige si asistirás presencialmente o en línea antes de confirmar.',
            'Tu reserva aparece con el estado "Reservado". Puedes cancelarla desde la misma pantalla.',
            'Si una clase se cancela, aparece un aviso rojo en tu panel y en el horario con el motivo de cancelación.',
          ],
        },
        {
          title: '6. Clases en línea',
          steps: [
            'Las clases <strong>en línea</strong> e <strong>híbridas</strong> incluyen un enlace de Zoom/Meet en la tarjeta de la clase.',
            'El enlace aparece después de que reserves tu lugar.',
            'En clases híbridas, asegúrate de elegir la modalidad "En línea" al reservar para ver el enlace.',
          ],
        },
        {
          title: '7. Historial de asistencia',
          steps: [
            'Ve a <strong>Perfil → Historial</strong> o usa el menú inferior.',
            'Verás una lista de todas las clases a las que has asistido con fecha, hora y tipo.',
            'Claudia marca tu asistencia al final de cada clase y el sistema descuenta automáticamente una clase de tu pase.',
          ],
        },
        {
          title: '8. Gestionar tu perfil',
          steps: [
            'Ve a <strong>Perfil</strong> en el menú inferior.',
            'Puedes actualizar tu <strong>nombre</strong> y número de <strong>WhatsApp</strong>.',
            'Para cambiar tu contraseña, toca "Cambiar contraseña" e ingresa la nueva contraseña.',
            'Toca <strong>Guardar</strong> para confirmar cualquier cambio.',
          ],
        },
      ],
    },
    admin: {
      intro: 'Esta guía cubre las funciones de administración: horarios, asistencia, alumnos, pases y configuración del estudio.',
      sections: [
        {
          title: '1. Panel de administración',
          steps: [
            'Al iniciar sesión como admin llegas al <strong>Panel de Administración</strong>.',
            'Muestra las clases de hoy y mañana como tarjetas expandibles. Toca una para marcar asistencia sin salir del panel.',
            'También muestra alertas de pases por vencer y alumnos con pocas clases restantes.',
            'El enlace "Abrir asistencia completa" en cada tarjeta abre la pantalla de asistencia completa (para agregar asistentes no reservados).',
          ],
        },
        {
          title: '2. Gestionar el horario',
          steps: [
            'Ve a <strong>Horario</strong> en el menú superior.',
            '<strong>Plantillas semanales</strong> — define el horario recurrente. Cada plantilla tiene día, hora, tipo de clase y capacidad. Toca una para expandirla y editarla.',
            'Para clases <strong>híbridas</strong>, configura capacidades separadas para presencial y en línea.',
            'Toca <strong>Agregar plantilla</strong> para crear un nuevo horario recurrente.',
            '<strong>Sesiones próximas</strong> — muestra las clases generadas para las próximas semanas. Puedes eliminar o cancelar sesiones individuales.',
            'Para agregar una clase especial (no recurrente), usa <strong>Agregar clase especial</strong>.',
            'El botón <strong>"Generar próximas 2 semanas"</strong> crea sesiones a partir de las plantillas activas.',
            'Después de editar una plantilla, usa <strong>"Aplicar cambios de plantilla"</strong> para actualizar las sesiones ya generadas.',
          ],
        },
        {
          title: '3. Días no disponibles (vacaciones/feriados)',
          steps: [
            'En la pantalla de Horario, desplázate hasta <strong>"Días no disponibles"</strong>.',
            'Toca <strong>Agregar rango de fechas</strong> e ingresa la fecha de inicio, fin y motivo opcional.',
            'Al guardar, las clases en ese rango se cancelan automáticamente y los alumnos verán el motivo en su horario.',
            'Para reactivar clases, elimina el rango de fechas. Las clases se restauran automáticamente.',
          ],
        },
        {
          title: '4. Marcar asistencia',
          steps: [
            'Ve a <strong>Asistencia</strong> en el menú inferior.',
            'Selecciona la fecha y la sesión.',
            'Verás la lista de alumnos con reserva activa. Marca ✓ (asistió) o ✗ (no se presentó) para cada uno.',
            'Para agregar un alumno que no reservó, búscalo en la sección "Otros alumnos" y márcalo.',
            'Si un alumno tiene un pase sin pagar, aparece un badge <strong>"💵 cobrar $X"</strong> con botón para marcarlo como pagado.',
            'Toca <strong>Guardar asistencia</strong>. El sistema descuenta automáticamente una clase del mejor pase activo de cada alumno (incluyendo no-shows).',
            'Puedes eliminar un registro de asistencia individual para revertir el descuento.',
          ],
        },
        {
          title: '5. Cancelar una clase',
          steps: [
            'En la lista de sesiones próximas, toca <strong>"Cancelar clase"</strong> en la sesión deseada.',
            'Escribe el motivo (o déjalo en blanco para "Cancelada").',
            'Recibirás un mensaje de Telegram con un enlace de WhatsApp por cada alumno que tenía reserva, para notificarles.',
            'La clase aparece tachada en el horario de los alumnos con el motivo visible.',
            'Puedes reabrir la clase con el botón <strong>"Reabrir"</strong> si fue cancelada por error.',
          ],
        },
        {
          title: '6. Gestionar alumnos',
          steps: [
            'Ve a <strong>Usuarios</strong> en el menú.',
            'Verás la lista de todos los alumnos con su nombre y pase activo actual.',
            'Toca un alumno para ver su detalle: rol, pases asignados, historial de asistencia.',
            'Desde el detalle puedes <strong>asignar un nuevo pase</strong> eligiendo el tipo, método de pago y si ya está pagado.',
            'También puedes <strong>editar pases existentes</strong>: clases restantes, fecha de vencimiento, estado de pago.',
            'Los botones <strong>+1 clase</strong> y <strong>+7 días</strong> permiten ajustes rápidos.',
            'Para cambiar el rol de un alumno a admin, usa el toggle de rol en su perfil.',
          ],
        },
        {
          title: '7. Tipos de pases',
          steps: [
            'Ve a <strong>Pases</strong> en el menú.',
            'La sección <strong>"Tipos de Pases"</strong> muestra todos los tipos configurados. Toca uno para expandirlo y editar precio, número de clases o días de validez.',
            'Para crear un nuevo tipo, toca <strong>"Agregar tipo de pase"</strong> y completa los campos.',
            'Puedes desactivar un tipo de pase para que no aparezca a los alumnos sin eliminarlo.',
          ],
        },
        {
          title: '8. Solicitudes de pase (por Telegram)',
          steps: [
            'Cuando un alumno solicita un pase, recibirás una notificación en <strong>Telegram</strong> con los detalles del pago.',
            'Toca <strong>✅ Aprobar</strong> para crear el pase automáticamente y marcar el pago como verificado.',
            'Toca <strong>❌ Rechazar</strong> para iniciar el flujo de rechazo: el bot te pedirá el motivo, luego podrás confirmar o cancelar el rechazo.',
            'Al aprobar, recibirás un enlace de WhatsApp para notificar al alumno.',
            'También puedes gestionar solicitudes desde la pestaña <strong>"Solicitudes"</strong> en la pantalla de Pases.',
          ],
        },
        {
          title: '9. Configuración del estudio',
          steps: [
            'Ve a <strong>Ajustes</strong> en el menú superior.',
            '<strong>Estudio</strong> — dirección del estudio, enlace de reunión (Zoom/Meet), ventana de reserva (semanas), capacidad por defecto.',
            '<strong>Plantillas de WhatsApp</strong> — edita los mensajes pre-llenados que Claudia envía a los alumnos (aprobación, rechazo, vencimiento, etc.). Usa los marcadores {name}, {kind}, {date}, {reason} según corresponda.',
            '<strong>Datos bancarios</strong> — nombre, banco, cuenta, CLABE, tarjeta e instrucciones adicionales para transferencias.',
            'Cada sección tiene su propio botón <strong>Guardar</strong>.',
          ],
        },
        {
          title: '10. Historial de notificaciones',
          steps: [
            'Ve a <strong>Ajustes → Notificaciones</strong> (enlace al fondo de la pantalla de Ajustes) o navega directamente.',
            'Muestra un registro de todos los mensajes de Telegram enviados: destinatario, tipo de evento, estado (enviado/fallido/omitido) y vista previa del mensaje.',
            'Usa los filtros para ver solo ciertos tipos de eventos.',
            'Útil para confirmar que las notificaciones se enviaron correctamente o diagnosticar fallos.',
          ],
        },
      ],
    },
  },

  en: {
    student: {
      intro: 'This guide explains how to use the Jivatma app as a student — from creating your account to booking classes and managing your passes.',
      sections: [
        {
          title: '1. Creating an account',
          steps: [
            'Open the app and tap <strong>Create account</strong>.',
            'Enter your full name, email address, WhatsApp number, and a password (minimum 6 characters).',
            'Tap <strong>Create account</strong>. You\'ll be redirected to the login screen.',
            'Log in with your email and password.',
          ],
        },
        {
          title: '2. Your dashboard',
          steps: [
            'After logging in you land on your <strong>Dashboard</strong>.',
            '<strong>Your active passes</strong> are shown at the top — you can see how many classes remain and when the pass expires.',
            'If you have a pending pass request, a yellow notice appears while you wait for Claudia to approve it.',
            '<strong>Upcoming classes</strong> shows your active bookings.',
            '<strong>Recent attendance</strong> shows the last classes you attended.',
            'If you\'re new with no passes or bookings yet, a welcome card walks you through the first steps.',
          ],
        },
        {
          title: '3. Pass types',
          steps: [
            '<strong>Single class</strong> — valid for one class. You can select it yourself from "My Passes" and pay when you arrive.',
            '<strong>Multi-class pass</strong> — gives you a fixed number of classes (e.g. 5 or 10). Must be requested from Claudia.',
            '<strong>Unlimited monthly</strong> — unlimited classes for the validity period. Must be requested from Claudia.',
            'Passes have an expiry date. An amber warning appears when your pass expires in 7 days or fewer.',
          ],
        },
        {
          title: '4. Requesting a pass',
          steps: [
            'Go to <strong>My Passes</strong> in the bottom menu.',
            'In the "Available Passes" section, choose the pass you want.',
            'For a <strong>single class</strong>, tap "Select" and the pass is created immediately (pay in class).',
            'For multi-class or unlimited passes, tap "Request" and choose your payment method (cash or transfer).',
            'If paying by <strong>transfer</strong>, bank details appear in the modal so you can make the payment.',
            'If paying in <strong>cash</strong>, a notice reminds you to bring the money to your next class (arrive 10 min early).',
            'Your request stays "pending" until Claudia approves it. You\'ll receive a WhatsApp confirmation.',
          ],
        },
        {
          title: '5. Viewing the schedule and booking classes',
          steps: [
            'Go to <strong>Classes</strong> in the bottom menu.',
            'You\'ll see available classes for the coming weeks. Each card shows the date, time, class type, and spots remaining.',
            'You need an <strong>active pass</strong> to book.',
            'Tap <strong>Book</strong> on the class you want.',
            'For <strong>hybrid</strong> classes, choose whether you\'ll attend in-person or online before confirming.',
            'Your booking shows as "Booked". You can cancel it from the same screen.',
            'If a class is cancelled, a red alert appears on your dashboard and schedule with the reason.',
          ],
        },
        {
          title: '6. Online classes',
          steps: [
            '<strong>Online</strong> and <strong>hybrid</strong> classes include a Zoom/Meet link on the class card.',
            'The link appears after you book your spot.',
            'For hybrid classes, make sure to select the "Online" mode when booking to see the link.',
          ],
        },
        {
          title: '7. Attendance history',
          steps: [
            'Go to <strong>Profile → History</strong> or use the bottom menu.',
            'You\'ll see a list of all classes you\'ve attended with date, time, and type.',
            'Claudia marks your attendance at the end of each class and the system automatically deducts one class from your pass.',
          ],
        },
        {
          title: '8. Managing your profile',
          steps: [
            'Go to <strong>Profile</strong> in the bottom menu.',
            'You can update your <strong>name</strong> and <strong>WhatsApp</strong> number.',
            'To change your password, tap "Change password" and enter the new one.',
            'Tap <strong>Save</strong> to confirm any changes.',
          ],
        },
      ],
    },
    admin: {
      intro: 'This guide covers the admin features: schedules, attendance, students, passes, and studio configuration.',
      sections: [
        {
          title: '1. Admin dashboard',
          steps: [
            'Logging in as admin takes you to the <strong>Admin Dashboard</strong>.',
            'It shows today\'s and tomorrow\'s classes as expandable cards. Tap one to mark attendance without leaving the dashboard.',
            'It also shows alerts for passes expiring soon and students with few classes remaining.',
            'The "Open full attendance" link on each card opens the full attendance screen (for adding walk-ins).',
          ],
        },
        {
          title: '2. Managing the schedule',
          steps: [
            'Go to <strong>Schedule</strong> in the top menu.',
            '<strong>Weekly templates</strong> — define the recurring schedule. Each template has a day, time, class type, and capacity. Tap to expand and edit.',
            'For <strong>hybrid</strong> classes, set separate capacities for in-person and online.',
            'Tap <strong>Add template</strong> to create a new recurring slot.',
            '<strong>Upcoming sessions</strong> — shows the generated classes for the coming weeks. You can delete or cancel individual sessions.',
            'To add a one-off class, use <strong>Add special class</strong>.',
            'The <strong>"Generate next 2 weeks"</strong> button creates sessions from active templates.',
            'After editing a template, use <strong>"Apply template changes"</strong> to update already-generated sessions.',
          ],
        },
        {
          title: '3. Unavailability (holidays / vacation)',
          steps: [
            'On the Schedule screen, scroll to <strong>"Unavailable dates"</strong>.',
            'Tap <strong>Add date range</strong> and enter the start date, end date, and an optional reason.',
            'On save, classes in that range are automatically cancelled and students see the reason on their schedule.',
            'To reactivate classes, delete the date range. Sessions are restored automatically.',
          ],
        },
        {
          title: '4. Marking attendance',
          steps: [
            'Go to <strong>Attendance</strong> in the bottom menu.',
            'Select the date and session.',
            'You\'ll see the list of students who booked. Mark ✓ (attended) or ✗ (no-show) for each.',
            'To add a walk-in, find them in the "Other students" section and check them in.',
            'If a student has an unpaid pass, a <strong>"💵 collect $X"</strong> badge appears with a one-tap "Mark paid" button.',
            'Tap <strong>Save attendance</strong>. The system automatically deducts one class from each student\'s best active pass (no-shows are also deducted).',
            'You can delete an individual attendance record to reverse the deduction.',
          ],
        },
        {
          title: '5. Cancelling a class',
          steps: [
            'In the upcoming sessions list, tap <strong>"Cancel class"</strong> on the desired session.',
            'Enter a reason (or leave blank for the default "Cancelled").',
            'You\'ll receive a Telegram message with a WhatsApp link for each student who had a booking, so you can notify them.',
            'The class appears struck through on students\' schedules with the reason visible.',
            'You can reopen the class with the <strong>"Reopen"</strong> button if it was cancelled by mistake.',
          ],
        },
        {
          title: '6. Managing students',
          steps: [
            'Go to <strong>Users</strong> in the menu.',
            'You\'ll see a list of all students with their name and current active pass.',
            'Tap a student to view their detail: role, assigned passes, attendance history.',
            'From the detail page you can <strong>assign a new pass</strong> by choosing the type, payment method, and paid status.',
            'You can also <strong>edit existing passes</strong>: classes remaining, expiry date, payment status.',
            'The <strong>+1 class</strong> and <strong>+7 days</strong> buttons allow quick adjustments.',
            'To change a student\'s role to admin, use the role toggle on their profile.',
          ],
        },
        {
          title: '7. Pass types',
          steps: [
            'Go to <strong>Passes</strong> in the menu.',
            'The <strong>"Pass Types"</strong> section shows all configured types. Tap one to expand and edit the price, class count, or validity days.',
            'To create a new type, tap <strong>"Add pass type"</strong> and fill in the fields.',
            'You can deactivate a pass type so it no longer appears to students without deleting it.',
          ],
        },
        {
          title: '8. Pass requests (via Telegram)',
          steps: [
            'When a student requests a pass, you\'ll receive a <strong>Telegram</strong> notification with the payment details.',
            'Tap <strong>✅ Approve</strong> to automatically create the pass and mark the payment as verified.',
            'Tap <strong>❌ Decline</strong> to start the decline flow: the bot will ask for a reason, then you can confirm or cancel.',
            'On approval, you\'ll receive a WhatsApp link to notify the student.',
            'You can also manage requests from the <strong>"Requests"</strong> tab on the Passes screen.',
          ],
        },
        {
          title: '9. Studio settings',
          steps: [
            'Go to <strong>Settings</strong> in the top menu.',
            '<strong>Studio</strong> — studio address, meeting link (Zoom/Meet), booking window (weeks ahead), default capacity.',
            '<strong>WhatsApp templates</strong> — edit the pre-filled messages sent to students (approval, decline, expiry, etc.). Use {name}, {kind}, {date}, {reason} placeholders as applicable.',
            '<strong>Bank details</strong> — name, bank, account number, CLABE, card, and extra transfer instructions.',
            'Each section has its own <strong>Save</strong> button.',
          ],
        },
        {
          title: '10. Notification history',
          steps: [
            'Go to <strong>Settings → Notifications</strong> (link at the bottom of the Settings screen) or navigate directly.',
            'Shows a log of all Telegram messages sent: recipient, event type, status (sent/failed/skipped), and a message preview.',
            'Use the filters to see only certain event types.',
            'Useful for confirming notifications were delivered or diagnosing failures.',
          ],
        },
      ],
    },
  },
};

export async function renderGuide() {
  const app = document.getElementById('app');
  const lang = getCurrentLang();
  const c = content[lang] || content.es;

  const tabFromHash = window.location.hash === '#admin' ? 'admin' : 'student';

  function renderSections(sections) {
    return sections.map(s => `
      <details class="guide-section">
        <summary class="guide-section__summary">${s.title}</summary>
        <ol class="guide-section__steps">
          ${s.steps.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </details>
    `).join('');
  }

  app.innerHTML = `
    <div class="guide-page">
      <header class="guide-header">
        <a href="/" class="guide-back">${t('guide.back')}</a>
        <h1 class="guide-title">${t('guide.title')}</h1>
        <button class="guide-lang-btn" id="js-guide-lang">${lang === 'es' ? 'EN' : 'ES'}</button>
      </header>

      <div class="guide-tabs" role="tablist">
        <button class="guide-tab ${tabFromHash === 'student' ? 'guide-tab--active' : ''}" data-tab="student" role="tab">
          ${t('guide.tab.student')}
        </button>
        <button class="guide-tab ${tabFromHash === 'admin' ? 'guide-tab--active' : ''}" data-tab="admin" role="tab">
          ${t('guide.tab.admin')}
        </button>
      </div>

      <div class="guide-content" id="js-guide-content">
        <div class="guide-pane ${tabFromHash === 'student' ? 'guide-pane--active' : ''}" data-pane="student">
          <p class="guide-intro">${c.student.intro}</p>
          ${renderSections(c.student.sections)}
        </div>
        <div class="guide-pane ${tabFromHash === 'admin' ? 'guide-pane--active' : ''}" data-pane="admin">
          <p class="guide-intro">${c.admin.intro}</p>
          ${renderSections(c.admin.sections)}
        </div>
      </div>
    </div>
  `;

  // Tab switching
  app.querySelectorAll('.guide-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      app.querySelectorAll('.guide-tab').forEach(b => b.classList.toggle('guide-tab--active', b.dataset.tab === tab));
      app.querySelectorAll('.guide-pane').forEach(p => p.classList.toggle('guide-pane--active', p.dataset.pane === tab));
      window.location.hash = tab === 'admin' ? '#admin' : '';
    });
  });

  // Language toggle
  app.querySelector('#js-guide-lang').addEventListener('click', () => {
    toggleLang();
  });
}
