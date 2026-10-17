# Memoria del Proyecto: USICAMM Quizz 2026

## 1. Estructura de Casos Prácticos y Lecturas Comprensivas
- **Lectura Enmarcada (Card Contextual):**
  - Cada reactivo debe contar con un caso práctico o lectura comprensiva amplia (`reading`) y su título descriptivo (`readingTitle`).
  - Presentación en recuadro con borde distintivo (`border-2 border-sky-400 dark:border-sky-500/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#161B22] shadow-sm`).
  - Separación de párrafos narrativa (`\n\n`), situando a los aspirantes en un escenario escolar realista de México (escuela, aula, alumnos con nombres propios, dilemas didácticos y pedagógicos, intervención docente y fundamento teórico/normativo).
- **Planteamiento / Pregunta:**
  - Sección independiente debajo de la lectura.
  - Indicador flecha `➤` destacado en color institucional con tipografía en negrita (`text-lg sm:text-2xl font-black`).

## 2. Regla de Espaciado para Respuestas (Cero Amontonamiento)
- **Panel de Opciones Desahogado:**
  - Ancho ampliado en escritorio: `w-full lg:w-[480px] xl:w-[580px] 2xl:w-[640px]`.
  - Separación vertical generosa entre opciones: `space-y-4 sm:space-y-5`.
  - Relleno interno de botones de respuesta amplio: `p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2`.
  - Letras identificadoras `a.`, `b.`, `c.`, `d.` con separación clara y destacada.
  - Altura de línea descansada (`leading-relaxed`), texto de `text-base sm:text-lg`.
  - Margen inferior de desplazamiento (`pb-24 sm:pb-32`) para evitar que el último botón quede apretado o cortado por el pie de página.

## 3. Revisión de Examen (Review Mode)
- Al expandir un reactivo en la revisión de respuestas, se muestra la lectura completa enmarcada (`q.reading`), el planteamiento y las opciones con el mismo espaciado generoso y etiquetas de justificación.

## 4. Banco de Reactivos
- Integra los reactivos de comprensión lectora (ej. caso "Sofía y la Magia de la Noche") junto con los reactivos pedagógicos de los 4 dominios de USICAMM 2026 (Normatividad y Ética, Desarrollo Infantil y Aprendizaje, Pedagogía y Didáctica NEM, y Gestión Escolar/CTE).

## 5. Control de Entradas y Administración por Correo Electrónico
- **Super Administrador:**
  - Correo: `cursospv@vamosporeducacion.com`
  - Tiene acceso total y permanente a la plataforma y al **Panel Maestro de Administración de Entradas** (`/admin`).
  - Botón directo de administración flotante en el encabezado general (`🛡️ Panel Administrador`).
- **Gestión de Entradas (`/admin`):**
  - **Autorización individual:** Registro de correo electrónico, nombre del docente y notas.
  - **Carga masiva (Bulk Add):** Pega listas de correos separadas por comas, espacios o saltos de línea.
  - **Control de estado:** Permite pausar o reactivar el acceso de cualquier aspirante con 1 clic.
  - **Eliminación:** Borrado seguro de autorizaciones.
  - **Supervisión de calificaciones:** Historial de exámenes enviados con aciertos, calificación sobre 10 y porcentaje.
- **Acceso Exclusivo por Correo Electrónico:**
  - Se eliminó el botón e inicio de sesión con Google.
  - El acceso es 100% por correo electrónico directo: el alumno ingresa su correo y el sistema comprueba en tiempo real si el maestro lo activó en el panel.
  - **Acceso No Activado:** Si el correo no ha sido activado por el maestro o fue pausado, el alumno recibe una pantalla de bloqueo con botón directo para solicitar su activación por WhatsApp al maestro.
