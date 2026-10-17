import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ShieldCheck, 
  Mail, 
  Trophy, 
  Calendar, 
  Clock, 
  AlertTriangle,
  ArrowLeft,
  Upload,
  LogOut,
  Lock
} from 'lucide-react';
import { 
  getAuthorizedEmails, 
  addAuthorizedEmail, 
  addMultipleAuthorizedEmails, 
  toggleAuthorizedEmail, 
  deleteAuthorizedEmail, 
  getAllQuizResultsForAdmin,
  AuthorizedEmailRecord,
  ADMIN_EMAIL,
  clearAppMemory
} from '../services/firebase';

interface AdminPanelProps {
  user: any;
  onBack: () => void;
  onLogout: () => void;
}

export function AdminPanel({ user, onBack, onLogout }: AdminPanelProps) {
  const [emails, setEmails] = useState<AuthorizedEmailRecord[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'emails' | 'results'>('emails');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Single email form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk add modal/state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [emailList, resultList] = await Promise.all([
        getAuthorizedEmails(),
        getAllQuizResultsForAdmin()
      ]);
      setEmails(emailList);
      setResults(resultList);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setMessage({ type: 'error', text: 'Error al cargar los datos del panel.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Ingresa un correo electrónico válido.' });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      await addAuthorizedEmail(newEmail, newName, newNotes);
      setMessage({ type: 'success', text: `Correo ${newEmail} autorizado correctamente.` });
      setNewEmail('');
      setNewName('');
      setNewNotes('');
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al autorizar correo. Verifica la conexión.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;
    setIsBulkSubmitting(true);
    setMessage(null);
    try {
      const { added, errors } = await addMultipleAuthorizedEmails(bulkText);
      setMessage({ 
        type: 'success', 
        text: `Se autorizaron ${added} correo(s) correctamente.${errors > 0 ? ` (${errors} omitidos por formato inválido)` : ''}` 
      });
      setBulkText('');
      setShowBulkAdd(false);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Error en la carga masiva.' });
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      await toggleAuthorizedEmail(id, currentActive);
      setEmails(prev => prev.map(item => item.id === id ? { ...item, active: !currentActive } : item));
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al actualizar estado del correo.' });
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar la autorización para ${email}? El alumno ya no podrá ingresar al simulacro.`)) {
      return;
    }

    try {
      await deleteAuthorizedEmail(id);
      setEmails(prev => prev.filter(item => item.id !== id));
      setMessage({ type: 'success', text: `Autorización de ${email} eliminada.` });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al eliminar autorización.' });
    }
  };

  const filteredEmails = emails.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.email.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q));
  });

  const activeCount = emails.filter(e => e.active).length;

  const handleClearMemory = () => {
    const success = clearAppMemory();
    if (success) {
      setMessage({
        type: 'success',
        text: '¡Memoria del sistema limpiada correctamente! Se han restablecido las preguntas vistas y el caché local.'
      });
    } else {
      setMessage({ type: 'error', text: 'Error al limpiar la memoria del sistema.' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 font-sans">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 rounded-full bg-white dark:bg-[#1E1E1E] shadow border border-gray-100 dark:border-gray-800 text-[#621132] dark:text-[#D4C19C] hover:scale-105 active:scale-95 transition-all"
            title="Volver al inicio"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-[#621132] dark:text-[#D4C19C]" size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Panel del Maestro</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#621132] dark:text-[#D4C19C] uppercase tracking-tight">
              Activación de Alumnos por Correo
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Maestro Administrador</p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user?.email || ADMIN_EMAIL}</p>
          </div>
          <button 
            onClick={handleClearMemory}
            className="px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-wider"
            title="Limpiar memoria del sistema y preguntas vistas"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Limpiar Memoria</span>
          </button>
          <button 
            onClick={loadData}
            className="p-3 rounded-xl bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-800 text-slate-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            title="Refrescar lista"
          >
            <RotateCcw size={18} />
          </button>
          <button 
            onClick={onLogout}
            className="px-3.5 py-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
            title="Cerrar sesión de administrador"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-[#621132]/10 dark:bg-[#D4C19C]/10 text-[#621132] dark:text-[#D4C19C]">
            <Users size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Alumnos</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white">{emails.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Alumnos Activados</p>
            <h3 className="text-3xl font-black text-green-600 dark:text-green-400">{activeCount}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Trophy size={28} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Simulacros Guardados</p>
            <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400">{results.length}</h3>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-4 rounded-2xl mb-6 flex items-center justify-between border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-3 font-bold text-sm">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs uppercase font-black underline">Cerrar</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 mb-6">
        <button
          onClick={() => setActiveTab('emails')}
          className={`pb-4 px-6 font-black text-sm uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'emails' 
              ? 'border-[#621132] text-[#621132] dark:border-[#D4C19C] dark:text-[#D4C19C]' 
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <Mail size={16} /> Alumnos por Correo ({emails.length})
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`pb-4 px-6 font-black text-sm uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'results' 
              ? 'border-[#621132] text-[#621132] dark:border-[#D4C19C] dark:text-[#D4C19C]' 
              : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <Trophy size={16} /> Exámenes de Alumnos ({results.length})
        </button>
      </div>

      {activeTab === 'emails' && (
        <div className="space-y-8">
          {/* Add New Email Section */}
          <div className="bg-white dark:bg-[#1E1E1E] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                  <Plus size={18} className="text-[#621132] dark:text-[#D4C19C]" />
                  Activar Nuevo Alumno por Correo
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Ingresa el correo electrónico del alumno que deseas activar para presentar el simulacro.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkAdd(!showBulkAdd)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Upload size={14} />
              </button>
            </div>

            {showBulkAdd ? (
              <div className="p-5 bg-gray-50 dark:bg-[#161B22] rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest">
                  Pega una lista de correos electrónicos (separados por coma, espacio o salto de línea):
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="ejemplo1@gmail.com&#10;ejemplo2@hotmail.com&#10;docente3@escuela.edu.mx"
                  className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] focus:ring-2 focus:ring-[#621132] outline-none font-mono text-sm dark:text-white"
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(false)}
                    className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isBulkSubmitting || !bulkText.trim()}
                    onClick={handleBulkAdd}
                    className="px-6 py-2.5 rounded-xl bg-[#621132] text-white font-black text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {isBulkSubmitting ? 'Procesando...' : 'Autorizar Todos los Correos'}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddEmail} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="aspirante@gmail.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] focus:ring-2 focus:ring-[#621132] outline-none font-bold text-sm dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                    Nombre del Docente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Prof. Juan Pérez"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] focus:ring-2 focus:ring-[#621132] outline-none font-bold text-sm dark:text-white"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newEmail}
                    className="w-full py-3.5 px-6 bg-[#621132] text-white font-black rounded-xl text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    {isSubmitting ? 'Guardando...' : 'Autorizar'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* List of Authorized Emails */}
          <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-base">
                  Lista de Correos Habilitados ({filteredEmails.length})
                </h3>
                <p className="text-xs text-gray-400">Solo los correos con estado activo podrán iniciar el examen.</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar correo o nombre..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252525] text-xs font-bold outline-none focus:ring-2 focus:ring-[#621132] dark:text-white"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-gray-400 font-bold">
                Cargando lista de correos autorizados...
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="py-16 text-center text-gray-400 font-medium">
                {searchQuery ? 'No se encontraron correos que coincidan con la búsqueda.' : 'Aún no hay correos autorizados en la lista. Agrega el primero arriba.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredEmails.map((item) => (
                  <div key={item.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${item.active ? 'bg-green-100 dark:bg-green-950/40 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        <Mail size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                            {item.email}
                          </p>
                          <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            item.active 
                              ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          }`}>
                            {item.active ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                        {item.name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.name}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <button
                        onClick={() => handleToggle(item.id, item.active)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                          item.active 
                            ? 'border-orange-200 dark:border-orange-900/40 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20' 
                            : 'border-green-200 dark:border-green-900/40 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20'
                        }`}
                      >
                        {item.active ? 'Pausar Alumno' : 'Activar Alumno'}
                      </button>

                      <button
                        onClick={() => handleDelete(item.id, item.email)}
                        className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                        title="Eliminar de la lista"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight text-base">
              Historial Global de Exámenes Presentados
            </h3>
            <p className="text-xs text-gray-400">Resultados registrados en la base de datos de los aspirantes.</p>
          </div>

          {results.length === 0 ? (
            <div className="py-16 text-center text-gray-400 font-bold">
              No se han registrado exámenes aún en el sistema.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((r) => {
                const pct = Math.round((r.score / (r.totalQuestions || 1)) * 100);
                const grade = ((r.score / (r.totalQuestions || 1)) * 10).toFixed(2);
                const isPassed = pct >= 80;

                return (
                  <div key={r.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${isPassed ? 'bg-green-100 dark:bg-green-950/40 text-green-600' : 'bg-orange-100 dark:bg-orange-950/40 text-orange-600'}`}>
                        <Trophy size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                          {r.userEmail || 'Aspirante Registrado'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-3">
                          <span>{r.score} de {r.totalQuestions} aciertos</span>
                          <span>•</span>
                          <span>Calificación: <strong>{grade}/10</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right self-end sm:self-auto">
                      <span className={`text-xl font-black ${isPassed ? 'text-green-600' : 'text-orange-500'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
