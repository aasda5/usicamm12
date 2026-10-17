import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { 
  UserCircle, Phone, BookOpen, Clock, Trophy, ChevronRight, RotateCcw, 
  AlertTriangle, CheckCircle2, Info, Moon, Sun, ChevronDown, Share2, 
  Grid, X, Calendar, Check, Facebook, Twitter, Lock, ShieldCheck, 
  Users, LogOut, RefreshCw, Mail, Sparkles, BarChart3, Trash2
} from 'lucide-react';
import { questions } from './data/questions';
import { Question, UserSession } from './types';
import { 
  auth, 
  signInWithGoogle, 
  logout as firebaseLogout, 
  saveQuizResult, 
  getUserHistory,
  isUserAdmin,
  checkUserAuthorization,
  ADMIN_EMAIL,
  clearAppMemory,
  getAuthorizedUserRecord
} from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AdminPanel } from './components/AdminPanel';

// Constants
const DEFAULT_TIME = 20 * 60; // 20 minutes in seconds
const DEFAULT_QUESTIONS = 110;
const SESSION_KEY = 'usicamm_session';
const THEME_KEY = 'usicamm_theme';

const STUDY_MODES = [
  { id: 'all_easy', label: 'Básico', q: 40, t: 60 * 60, icon: '🌱', type: 'level' },
  { id: 'all_medium', label: 'Intermedio', q: 70, t: 120 * 60, icon: '⚡', type: 'level' },
  { id: 'all_hard', label: 'Simulacro Real', q: 110, t: 220 * 60, icon: '🔥', type: 'level' },
  { id: 'normativity', label: 'Normatividad', q: 25, t: 40 * 60, icon: '⚖️', type: 'domain' },
  { id: 'development', label: 'Desarrollo', q: 25, t: 40 * 60, icon: '🧠', type: 'domain' },
  { id: 'pedagogy', label: 'Pedagogía NEM', q: 25, t: 40 * 60, icon: '📝', type: 'domain' },
  { id: 'management', label: 'Gestión', q: 25, t: 40 * 60, icon: '🏫', type: 'domain' },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark';
  });

  const [user, setUser] = useState<User | null>(null);
  const [emailUser, setEmailUser] = useState<{ email: string; displayName?: string } | null>(() => {
    try {
      const saved = localStorage.getItem('usicamm_email_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const effectiveUser = user || emailUser;
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const isAdmin = useMemo(() => isUserAdmin(effectiveUser), [effectiveUser]);

  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [activeConfig, setActiveConfig] = useState({ q: DEFAULT_QUESTIONS, t: DEFAULT_TIME });
  const [startTime, setStartTime] = useState<Date | null>(null);

  const checkAuthStatus = useCallback(async (currentUser: any) => {
    if (!currentUser || !currentUser.email) {
      setIsAuthorized(null);
      return;
    }
    
    if (isUserAdmin(currentUser)) {
      setIsAuthorized(true);
      return;
    }

    setIsCheckingAuth(true);
    try {
      const authorized = await checkUserAuthorization(currentUser.email);
      setIsAuthorized(authorized);
    } catch (e) {
      console.error("Error checking auth status:", e);
      setIsAuthorized(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  // Firebase Google Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setSession(prev => ({ 
          name: u.displayName || prev?.name || 'Aspirante USICAMM', 
          whatsapp: prev?.whatsapp || '',
          email: u.email || '' 
        }));
        await checkAuthStatus(u);
        setIsLoadingHistory(true);
        try {
          const pastResults = await getUserHistory(u.uid);
          setHistory(pastResults || []);
        } catch (e) {
          console.error("Error loading history", e);
        } finally {
          setIsLoadingHistory(false);
        }
      } else if (!emailUser) {
        setSession(null);
        setHistory([]);
        setIsAuthorized(null);
      }
    });
    return () => unsubscribe();
  }, [checkAuthStatus, emailUser]);

  // Email User restoration listener
  useEffect(() => {
    if (!user && emailUser) {
      checkAuthStatus(emailUser);
      setIsLoadingHistory(true);
      getUserHistory(emailUser.email).then(pastResults => {
        setHistory(pastResults || []);
      }).finally(() => {
        setIsLoadingHistory(false);
      });
    }
  }, [user, emailUser, checkAuthStatus]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const startQuiz = useCallback((id?: string, count?: number, duration?: number) => {
    const mode = STUDY_MODES.find(m => m.id === id);
    const qCount = count !== undefined ? count : (mode ? mode.q : activeConfig.q);
    const qDuration = duration !== undefined ? duration * 60 : (mode ? mode.t : activeConfig.t);
    
    if (count !== undefined && duration !== undefined) {
      setActiveConfig({ q: count, t: duration });
    }

    // Get all seen question IDs from history and localStorage to fulfill "never repeat"
    const seenIds = new Set<number>();
    
    // From global history (Firebase)
    history.forEach(h => {
      if (h.questionIds) {
        h.questionIds.forEach((id: number) => seenIds.add(id));
      }
    });

    // From local storage (for non-logged in users or current browser session)
    const localSeen = localStorage.getItem('usicamm_seen_questions');
    if (localSeen) {
      try {
        const ids = JSON.parse(localSeen);
        if (Array.isArray(ids)) {
          ids.forEach(id => seenIds.add(id));
        }
      } catch (e) {
        console.error("Error parsing local seen questions", e);
      }
    }

    // Filter questions if a domain is selected
    let pool = [...questions];
    const selectedMode = STUDY_MODES.find(m => m.id === id);
    if (selectedMode && selectedMode.type === 'domain') {
      pool = pool.filter(q => q.difficulty === id);
    }

    // Filter out seen questions if possible
    const unseenPool = pool.filter(q => !seenIds.has(q.id));
    
    // Selection logic: prioritize unseen
    let selectionPool = unseenPool.length >= qCount ? unseenPool : pool;

    // Shuffle and slice
    const shuffled = [...selectionPool]
      .sort(() => 0.5 - Math.random())
      .slice(0, qCount)
      .map(q => {
        if (!q.options) return q;
        
        // Identify the correct option before shuffling and strip existing prefixes
        const optionsWithIdentity = q.options.map((opt, idx) => ({
          text: opt.replace(/^[A-D][)\.]\s*/i, ''), 
          isCorrect: idx === q.correctAnswer
        }));
        
        // Shuffle the options
        const shuffledList = [...optionsWithIdentity].sort(() => 0.5 - Math.random());
        
        return {
          ...q,
          options: shuffledList.map(o => o.text),
          correctAnswer: shuffledList.findIndex(o => o.isCorrect)
        };
      });
    
    setCurrentQuestions(shuffled);
    setCurrentIndex(0);
    setUserAnswers(new Array(shuffled.length).fill(-1));
    setTimeLeft(qDuration);
    setQuizFinished(false);
    setStartTime(new Date());
    navigate('/quiz');
  }, [activeConfig, navigate, history]);

  const handleLogin = (name: string, whatsapp: string, difficultyId?: string, qCount?: number, duration?: number) => {
    const currentEmail = effectiveUser?.email || session?.email || '';
    const newSession: UserSession = { 
      name, 
      whatsapp,
      email: currentEmail,
      role: isAdmin ? 'admin' : 'user'
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    startQuiz(difficultyId, qCount, duration);
  };

  const handleEmailLogin = async (email: string, studentName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isAdm = isUserAdmin(cleanEmail);
    const authorized = isAdm ? true : await checkUserAuthorization(cleanEmail);
    const record = await getAuthorizedUserRecord(cleanEmail);
    
    const newUser = {
      email: cleanEmail,
      displayName: studentName || record?.name || (isAdm ? 'Director del Curso' : 'Aspirante USICAMM')
    };

    localStorage.setItem('usicamm_email_user', JSON.stringify(newUser));
    setEmailUser(newUser);
    setIsAuthorized(authorized);

    const newSession: UserSession = {
      name: newUser.displayName,
      whatsapp: session?.whatsapp || '',
      email: cleanEmail,
      role: isAdm ? 'admin' : 'user',
      authMethod: 'email'
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);

    if (authorized) {
      getUserHistory(cleanEmail).then(pastResults => {
        setHistory(pastResults || []);
      });
    }

    return { isAuthorized: authorized, isAdmin: isAdm };
  };

  const logout = () => {
    firebaseLogout();
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('usicamm_email_user');
    setSession(null);
    setEmailUser(null);
    setUser(null);
    setIsAuthorized(null);
    navigate('/');
  };

  const finishQuiz = useCallback(async () => {
    setQuizFinished(true);
    navigate('/results');
    
    const finishedQuestionIds = currentQuestions.map(q => q.id);

    // Save seen questions locally to ensure "never repeat" even if not logged in
    const localSeen = localStorage.getItem('usicamm_seen_questions');
    let seenList: number[] = [];
    if (localSeen) {
      try {
        seenList = JSON.parse(localSeen);
      } catch (e) {}
    }
    const updatedSeen = Array.from(new Set([...seenList, ...finishedQuestionIds]));
    localStorage.setItem('usicamm_seen_questions', JSON.stringify(updatedSeen));

    // Save to Firebase / cache if user is logged in (Google or Email)
    const activeEmail = auth.currentUser?.email || effectiveUser?.email || session?.email || null;
    if (activeEmail || auth.currentUser) {
      const correctAnswers = currentQuestions.map(q => q.correctAnswer);
      const score = userAnswers.reduce((acc, ans, idx) => {
        if (ans === currentQuestions[idx]?.correctAnswer) return acc + 1;
        return acc;
      }, 0);

      try {
        await saveQuizResult(auth.currentUser?.uid || activeEmail || `user-${Date.now()}`, {
          score,
          totalQuestions: currentQuestions.length,
          userAnswers,
          correctAnswers,
          questionIds: finishedQuestionIds,
          email: activeEmail
        });
      } catch (e) {
        console.error("Error saving results to Firebase", e);
      }
    }
  }, [currentQuestions, userAnswers, effectiveUser, session]);

  const playWarningSound = useCallback((freq: number = 440) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio Context failed", e);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === '/quiz' && !quizFinished) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            finishQuiz();
            return 0;
          }
          // Warning at 5 minutes (300s) and 1 minute (60s)
          if (prev === 300) {
            playWarningSound(440);
          } else if (prev === 60) {
            playWarningSound(880);
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [location.pathname, quizFinished, finishQuiz, playWarningSound]);

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = optionIndex;
    setUserAnswers(newAnswers);
    if (currentIndex < currentQuestions.length - 1) {
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    }
  };

  const score = useMemo(() => {
    return userAnswers.reduce((acc, ans, idx) => {
      if (ans === currentQuestions[idx]?.correctAnswer) return acc + 1;
      return acc;
    }, 0);
  }, [userAnswers, currentQuestions]);

  useEffect(() => {
    if ((location.pathname === '/quiz' || location.pathname === '/results') && currentQuestions.length === 0) {
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, currentQuestions.length, navigate]);

  const percentage = Math.round((score / (currentQuestions.length || 1)) * 100);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="min-h-screen font-sans transition-colors duration-300 bg-[#F5F2ED] dark:bg-[#121212] text-[#1A1A1A] dark:text-[#E0E0E0]">
      {/* Global Top Actions Bar */}
      <div className="fixed top-4 right-4 z-[100] flex items-center gap-3">
        {isAdmin && (
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#621132] text-[#D4C19C] text-xs font-black uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 transition-all border border-[#D4C19C]/40"
            title="Administración de Entradas de Alumnos"
          >
            <ShieldCheck size={16} />
            <span className="hidden sm:inline">Panel Administrador</span>
          </button>
        )}

        {effectiveUser && (
          <button
            onClick={() => navigate('/profile')}
            className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full bg-white dark:bg-[#1E1E1E] shadow-md border border-gray-200 dark:border-gray-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
            title="Mi Perfil"
          >
            <UserCircle size={16} className="text-[#621132] dark:text-[#D4C19C]" />
            <span className="max-w-[130px] truncate">{effectiveUser.displayName || effectiveUser.email}</span>
          </button>
        )}

        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white dark:bg-[#1E1E1E] shadow-lg border border-gray-100 dark:border-gray-800 text-[#621132] dark:text-[#D4C19C] hover:scale-110 active:scale-95 transition-all"
          title="Cambiar tema"
        >
          {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen"
        >
          <Routes location={location}>
            <Route path="/" element={
              <LoginScreen 
                onLogin={handleLogin} 
                initialSession={session} 
                user={effectiveUser} 
                isAuthorized={isAuthorized}
                isCheckingAuth={isCheckingAuth}
                isAdmin={isAdmin}
                onEmailLogin={handleEmailLogin}
                onLogout={logout}
                onRecheckAuth={() => checkAuthStatus(effectiveUser)}
                onOpenAdmin={() => navigate('/admin')}
                setView={(v: string) => navigate(v === 'login' ? '/' : `/${v}`)} 
              />
            } />

            <Route path="/admin" element={
              isAdmin ? (
                <AdminPanel 
                  user={effectiveUser} 
                  onBack={() => navigate('/')} 
                  onLogout={logout} 
                />
              ) : (
                <Navigate to="/" replace />
              )
            } />

            <Route path="/quiz" element={
              (!effectiveUser || isAuthorized !== true) ? (
                <Navigate to="/" replace />
              ) : (
                <QuizScreen 
                  currentQuestion={currentQuestions[currentIndex]}
                  currentIndex={currentIndex}
                  totalQuestions={currentQuestions.length}
                  onAnswer={handleAnswer}
                  userAnswer={userAnswers[currentIndex]}
                  userAnswers={userAnswers}
                  timeLeft={timeLeft}
                  formatTime={formatTime}
                  onFinish={finishQuiz}
                  setCurrentIndex={setCurrentIndex}
                  currentQuestions={currentQuestions}
                  showNav={showNav}
                  setShowNav={setShowNav}
                  onExit={() => {
                    setSession(null);
                    localStorage.removeItem(SESSION_KEY);
                    navigate('/');
                  }}
                />
              )
            } />

            <Route path="/results" element={
              <ResultsScreen 
                session={session!}
                score={score}
                percentage={percentage}
                questions={currentQuestions}
                userAnswers={userAnswers}
                onRestart={() => startQuiz()}
                onLogout={logout}
                user={effectiveUser}
                history={history}
                startTime={startTime}
              />
            } />

            <Route path="/profile" element={
              <ProfileScreen 
                user={effectiveUser} 
                isAdmin={isAdmin}
                onOpenAdmin={() => navigate('/admin')}
                history={history} 
                onBack={() => navigate(-1)} 
                onLogout={logout}
              />
            } />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function ProfileScreen({ user, history, onBack, onLogout, isAdmin, onOpenAdmin }: any) {
  const [clearedNotice, setClearedNotice] = useState(false);
  const [seenCount, setSeenCount] = useState(() => {
    try {
      const s = localStorage.getItem('usicamm_seen_questions');
      return s ? JSON.parse(s).length : 0;
    } catch {
      return 0;
    }
  });

  const handleClearQuestionsMemory = () => {
    clearAppMemory();
    setSeenCount(0);
    setClearedNotice(true);
    setTimeout(() => setClearedNotice(false), 4000);
  };

  const recentFive = useMemo(() => {
    if (!history || !history.length) return [];
    return [...history].slice(0, 5).reverse();
  }, [history]);

  const stats = useMemo(() => {
    if (!history.length) return null;
    const totalExams = history.length;
    const highestScore = Math.max(...history.map((h: any) => (h.score / h.totalQuestions) * 100));
    const averageScore = history.reduce((acc: number, h: any) => acc + (h.score / h.totalQuestions) * 100, 0) / totalExams;
    
    return {
      totalExams,
      highestScore: Math.round(highestScore),
      averageScore: Math.round(averageScore)
    };
  }, [history]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto px-4 py-12"
    >
      <div className="flex items-center justify-between mb-12">
        <button 
          onClick={onBack}
          className="p-3 rounded-full bg-white dark:bg-[#1E1E1E] shadow border border-gray-100 dark:border-gray-800 text-[#621132] dark:text-[#D4C19C] hover:scale-110 transition-all"
        >
          <RotateCcw className="-rotate-90" size={24} />
        </button>
        <h1 className="text-3xl font-black text-[#621132] dark:text-[#D4C19C] uppercase tracking-tighter">Mi Perfil</h1>
        <div className="w-12"></div>
      </div>

      {isAdmin && (
        <button 
          onClick={onOpenAdmin}
          className="w-full mb-8 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#621132] to-[#8a1c47] text-[#D4C19C] font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 border border-[#D4C19C]/30 text-xs sm:text-sm"
        >
          <ShieldCheck size={20} />
          Panel de Administración de Entradas
        </button>
      )}

      <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 shadow-xl border border-[#D4C19C]/20 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-32 h-32 rounded-full border-4 border-[#621132] shadow-lg" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-4 border-[#621132]">
                <UserCircle size={64} className="text-gray-400" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 p-2 bg-green-500 text-white rounded-full border-4 border-white dark:border-[#1E1E1E]">
              <CheckCircle2 size={20} />
            </div>
          </div>
          
          <div className="text-center md:text-left flex-grow">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white mb-2">{user?.displayName || 'Usuario USICAMM'}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg mb-4">{user?.email}</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#621132]/5 dark:bg-[#D4C19C]/5 text-[#621132] dark:text-[#D4C19C] rounded-full text-xs font-black uppercase tracking-widest border border-[#621132]/10">
              <Trophy size={14} /> Aspirante USICAMM 2026
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-8">
        <div className="bg-white dark:bg-[#1E1E1E] p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
          <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1">Simulacros</p>
          <p className="text-xl sm:text-3xl font-black text-[#621132] dark:text-[#D4C19C]">{stats?.totalExams || 0}</p>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center">
          <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1">Puntaje Máx.</p>
          <p className="text-xl sm:text-3xl font-black text-[#621132] dark:text-[#D4C19C]">{stats?.highestScore || 0}%</p>
        </div>
        <div className="bg-white dark:bg-[#1E1E1E] p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 text-center col-span-2 md:col-span-1">
          <p className="text-gray-400 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1">Promedio General</p>
          <p className="text-xl sm:text-3xl font-black text-[#621132] dark:text-[#D4C19C]">{stats?.averageScore || 0}%</p>
        </div>
      </div>

      {/* Gráfico de Barras: Últimos 5 Simulacros */}
      {recentFive.length > 0 && (
        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <BarChart3 className="text-[#621132] dark:text-[#D4C19C]" />
                Rendimiento: Últimos 5 Simulacros
              </h3>
              <p className="text-xs text-gray-400 mt-1">Calificaciones porcentuales recientes</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-[#621132]/10 dark:bg-[#D4C19C]/10 text-[#621132] dark:text-[#D4C19C] rounded-full">
              Meta: 80%+
            </span>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 sm:gap-6 pt-6 pb-2 px-2 border-b border-gray-100 dark:border-gray-800">
            {recentFive.map((exam: any, idx: number) => {
              const pct = Math.round((exam.score / exam.totalQuestions) * 100);
              const isPassing = pct >= 80;
              return (
                <div key={exam.id || idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <span className={`text-[10px] sm:text-xs font-black mb-2 transition-transform group-hover:scale-110 ${
                    isPassing ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {pct}%
                  </span>
                  <div className="w-full max-w-[48px] bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden flex flex-col justify-end h-36">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${pct}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className={`w-full rounded-t-xl transition-all ${
                        isPassing 
                          ? 'bg-gradient-to-t from-green-600 to-emerald-400' 
                          : 'bg-gradient-to-t from-[#621132] to-[#992244] dark:from-[#D4C19C] dark:to-[#e8dbbf]'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 mt-2 truncate max-w-full">
                    Sim #{idx + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección: Limpieza de Memoria */}
      <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            <Trash2 size={18} className="text-[#621132] dark:text-[#D4C19C]" />
            Memoria del Simulador y Casos Prácticos
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
            {seenCount > 0 
              ? `Hay ${seenCount} reactivo(s) guardado(s) en memoria para no repetirse. Puedes limpiar la memoria para volver a practicarlos todos desde cero.`
              : 'La memoria de reactivos está completamente limpia. Todo el banco de preguntas y casos prácticos está listo.'}
          </p>
          {clearedNotice && (
            <p className="text-xs font-bold text-green-600 dark:text-green-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> ¡Memoria limpiada con éxito!
            </p>
          )}
        </div>
        <button
          onClick={handleClearQuestionsMemory}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-900/40 transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shrink-0"
        >
          <Trash2 size={16} />
          Limpiar Memoria
        </button>
      </div>

      <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl p-8 border border-gray-100 dark:border-gray-800 mb-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Clock className="text-[#621132] dark:text-[#D4C19C]" /> Actividad Reciente
        </h3>
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((h: any) => (
              <div key={h.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-[#252525] rounded-2xl border border-transparent hover:border-[#621132]/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${Math.round((h.score / h.totalQuestions) * 100) >= 80 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                    <Trophy size={24} />
                  </div>
                  <div>
                    <p className="font-black text-xl">{h.score} / {h.totalQuestions}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                      {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Reciente'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-black ${Math.round((h.score / h.totalQuestions) * 100) >= 80 ? 'text-green-600' : 'text-orange-500'}`}>
                    {Math.round((h.score / h.totalQuestions) * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-gray-400 font-bold italic">
            No hay actividad aún. ¡Comienza un simulacro!
          </div>
        )}
      </div>

      <button 
        onClick={() => {
          onLogout();
          onBack();
        }}
        className="w-full py-5 rounded-2xl border-2 border-red-200 dark:border-red-950/30 text-red-600 font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/10 transition-all flex items-center justify-center gap-3"
      >
        Cerrar Sesión Activa
      </button>
    </motion.div>
  );
}

function LoginScreen({ 
  onLogin, 
  initialSession, 
  user, 
  isAuthorized, 
  isCheckingAuth, 
  isAdmin, 
  onEmailLogin,
  onLogout, 
  onRecheckAuth, 
  onOpenAdmin, 
  setView 
}: any) {
  const [loginRole, setLoginRole] = useState<'student' | 'teacher'>('student');
  const [usernameInput, setUsernameInput] = useState(() => {
    try {
      return localStorage.getItem('usicamm_remember_email') || '';
    } catch (e) {
      return '';
    }
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);

  const [name, setName] = useState(initialSession?.name || user?.displayName || '');
  const [whatsapp, setWhatsapp] = useState(initialSession?.whatsapp || '');
  const [selectedModeId, setSelectedModeId] = useState('all_easy');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.displayName && (!name || name === 'Aspirante USICAMM')) {
      setName(user.displayName);
    }
  }, [user, name]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameInput.trim().toLowerCase();
    if (!cleanUser || !cleanUser.includes('@')) {
      setError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (rememberMe) {
      try {
        localStorage.setItem('usicamm_remember_email', cleanUser);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('usicamm_remember_email');
      } catch (e) {}
    }

    setIsVerifyingEmail(true);
    setError('');

    try {
      if (loginRole === 'teacher') {
        if (!isUserAdmin(cleanUser)) {
          setError('El correo ingresado no corresponde al maestro administrador. Si eres alumno, por favor selecciona "Alumno".');
          setIsVerifyingEmail(false);
          return;
        }
        const res = await onEmailLogin(cleanUser, 'Maestro Administrador');
        if (res?.isAdmin) {
          onOpenAdmin();
        }
      } else {
        await onEmailLogin(cleanUser);
      }
    } catch (err) {
      setError('Error al procesar el inicio de sesión. Por favor verifica tu correo.');
    } finally {
      setIsVerifyingEmail(false);
    }
  };

  const currentMode = STUDY_MODES.find(m => m.id === selectedModeId) || STUDY_MODES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError('Por favor ingresa tu nombre completo.');
      return;
    }
    if (!/^\d{10}$/.test(whatsapp)) {
      setError('El número de WhatsApp debe tener exactamente 10 dígitos.');
      return;
    }
    
    onLogin(name, whatsapp, selectedModeId, currentMode.q, currentMode.t / 60);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-sans ${
        !user 
          ? 'bg-gradient-to-b from-[#6ca4d7] via-[#4a7eb5] to-[#1e3c63]' 
          : 'bg-[#F5F2ED] dark:bg-[#121212]'
      }`}
    >
      {/* STATE 1: NOT LOGGED IN - EMAIL ONLY VALIDATED FROM ADMIN */}
      {!user && (
        <div className="w-full max-w-[380px] sm:max-w-[420px] mx-auto flex flex-col items-center">
          {/* Subtle Role Toggle */}
          <div className="flex p-1 bg-[#284566]/70 backdrop-blur-md rounded-2xl mb-8 border border-white/20 w-full max-w-[280px]">
            <button
              type="button"
              onClick={() => { setLoginRole('student'); setError(''); }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs tracking-wider transition-all ${
                loginRole === 'student'
                  ? 'bg-white text-[#1e3c63] shadow-md font-black'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Alumno
            </button>
            <button
              type="button"
              onClick={() => { setLoginRole('teacher'); setError(''); }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs tracking-wider transition-all ${
                loginRole === 'teacher'
                  ? 'bg-white text-[#1e3c63] shadow-md font-black'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              Maestro
            </button>
          </div>

          {/* User Icon Avatar as in image */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#243d5c] border border-[#3b5d82] shadow-[0_6px_20px_rgba(0,0,0,0.35)] flex items-center justify-center">
              {loginRole === 'teacher' ? (
                <ShieldCheck className="w-14 h-14 sm:w-16 sm:h-16 text-[#8bb4db]" />
              ) : (
                <svg className="w-16 h-16 sm:w-20 sm:h-20 text-[#3b5e85]" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="7.5" r="4.2" />
                  <path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
                </svg>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              {loginRole === 'teacher' ? 'Portal del Maestro' : 'Acceso de Alumno'}
            </h2>
            <p className="text-xs text-blue-100/80 font-medium mt-1">
              {loginRole === 'teacher' 
                ? 'Ingresa tu correo oficial para administrar y activar alumnos' 
                : 'Acceso directo con tu correo electrónico validado'}
            </p>
          </div>

          {error && (
            <div className="w-full mb-6 p-3.5 rounded-xl bg-red-900/60 border border-red-400 text-white text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form: Sin clave, únicamente correo electrónico validado */}
          <form onSubmit={handleLoginSubmit} className="w-full space-y-5">
            <div>
              <label className="block text-white text-sm font-bold tracking-wide mb-1.5 text-left">
                {loginRole === 'teacher' ? 'Correo del Maestro' : 'Correo Electrónico del Alumno'}
              </label>
              <input 
                type="email"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder={loginRole === 'teacher' ? 'cursospv@vamosporeducacion.com' : 'tu-correo@ejemplo.com'}
                className="w-full px-4 py-3 rounded-md bg-[#3e5f83] text-white placeholder-blue-200/50 border border-[#4d7199] outline-none focus:ring-2 focus:ring-blue-300 shadow-inner font-medium text-base transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm text-white/95 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#3e5f83] border-[#4d7199] text-blue-500 focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold text-white">Recordar mi correo</span>
              </label>
            </div>

            {/* Centered Oval Pill LOGIN Button */}
            <div className="flex justify-center pt-3">
              <button
                type="submit"
                disabled={isVerifyingEmail || !usernameInput}
                className="px-12 py-3.5 rounded-full bg-[#253e5b] hover:bg-[#2d4b6e] active:scale-95 text-white font-black text-sm tracking-widest uppercase shadow-[0_6px_18px_rgba(0,0,0,0.45)] border border-[#1a2d42] transition-all disabled:opacity-50"
              >
                {isVerifyingEmail ? 'VERIFICANDO...' : (loginRole === 'teacher' ? 'ENTRAR AL PANEL' : 'INGRESAR AL QUIZZ')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STATE 2, 3, 4: LOGGED IN STATES (EXAM SETUP & AUTHORIZATION STATUS) */}
      {user && (
        <div className="w-full max-w-2xl bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-2xl overflow-hidden border border-[#D4C19C]/30 dark:border-[#D4C19C]/10">
          <div className="h-4 w-full bg-[#621132]"></div>
          
          <div className="p-6 sm:p-10 text-center">
            <div className="mb-4 inline-flex p-3 sm:p-4 rounded-full bg-[#621132]/10 dark:bg-[#621132]/20">
              <BookOpen size={32} className="text-[#621132] dark:text-[#D4C19C]" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-black mb-1 text-[#621132] dark:text-[#D4C19C] tracking-tighter uppercase">
              USICAMM Quizz 2026
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
              Simulador de Evaluación Docente
            </p>

          {/* STATE 2: LOGGED IN BUT CHECKING AUTHORIZATION */}
          {user && isCheckingAuth && (
            <div className="py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-[#621132] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="font-black text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Comprobando permisos de entrada...
              </p>
              <p className="text-xs text-gray-400 font-mono">{user.email}</p>
            </div>
          )}

          {/* STATE 3: LOGGED IN BUT NOT AUTHORIZED (Vista de alumno sin información del admin) */}
          {user && !isCheckingAuth && isAuthorized === false && (
            <div className="space-y-6 text-left">
              <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900/40 space-y-4">
                <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                  <div className="p-3 bg-red-100 dark:bg-red-900/40 rounded-2xl">
                    <Lock size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-base uppercase tracking-tight">Acceso Pendiente de Activación</h3>
                    <p className="text-xs text-red-600/80 dark:text-red-300/80">Tu correo debe ser activado previamente para el quizz</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-red-100 dark:border-red-900/30 text-xs sm:text-sm text-red-900 dark:text-red-200 space-y-2">
                  <p>
                    Hola <strong className="underline">{user.displayName || 'Alumno'}</strong>, tu correo electrónico:
                  </p>
                  <p className="font-mono bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40 text-center font-bold text-red-700 dark:text-red-400">
                    {user.email}
                  </p>
                  <p>
                    Aún no se encuentra activado para presentar el simulador. Por favor solicita tu activación para habilitar tu acceso.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    const text = `Hola, solicito activar mi correo para acceder al Simulador USICAMM 2026: ${user.email}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-[#25D366] text-white font-black uppercase tracking-wider text-xs flex items-center justify-center gap-3 hover:brightness-110 shadow-lg active:scale-95 transition-all"
                >
                  <Phone size={18} />
                  Solicitar Activación por WhatsApp
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onRecheckAuth}
                    className="py-3.5 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800 text-slate-700 dark:text-gray-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Reintentar
                  </button>

                  <button
                    onClick={onLogout}
                    className="py-3.5 px-4 rounded-xl border-2 border-red-200 dark:border-red-950/40 font-bold text-xs uppercase tracking-wider text-red-600 hover:bg-red-50 dark:hover:bg-red-950/10 flex items-center justify-center gap-2"
                  >
                    <LogOut size={14} />
                    Cambiar Correo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: LOGGED IN AND AUTHORIZED */}
          {user && !isCheckingAuth && isAuthorized === true && (
            <div>
              {/* Admin Special Notification Banner */}
              {isAdmin && (
                <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-[#621132] via-[#7a153e] to-[#8a1c47] text-[#D4C19C] shadow-lg border-2 border-[#D4C19C]/40 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-[#D4C19C]/20 rounded-xl text-[#D4C19C]">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-[#D4C19C]">Sesión de Maestro Administrador</p>
                        <p className="text-sm font-black text-white">{user.email}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-[#D4C19C] text-[#621132] rounded-full text-[10px] font-black uppercase">
                      Maestro Activo
                    </span>
                  </div>

                  <p className="text-xs text-white/90">
                    Como maestro administrador, puedes activar, pausar o dar de alta correos de alumnos y revisar todos los exámenes enviados.
                  </p>

                  <button
                    onClick={onOpenAdmin}
                    className="w-full py-3.5 px-4 bg-[#D4C19C] hover:bg-[#e6d5b3] text-[#621132] rounded-xl font-black text-xs uppercase tracking-widest shadow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={16} />
                    Abrir Panel del Maestro: Activar Alumnos
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 text-left">
                <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <UserCircle size={12} /> Nombre del Aspirante
                    </label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej. María García"
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] focus:ring-2 focus:ring-[#621132] outline-none transition-all dark:text-white font-bold text-sm sm:text-base"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                      <Phone size={12} /> WhatsApp (10 dígitos)
                    </label>
                    <input 
                      type="tel" 
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="55XXXXXXXX"
                      className="w-full px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#252525] focus:ring-2 focus:ring-[#621132] outline-none transition-all dark:text-white font-bold text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {STUDY_MODES.filter(m => m.type === 'level').map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSelectedModeId(mode.id)}
                        className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all flex flex-col items-center gap-1 sm:gap-2 group ${
                          selectedModeId === mode.id 
                          ? 'border-[#621132] bg-[#621132]/5 text-[#621132] dark:text-[#D4C19C] dark:border-[#D4C19C]' 
                          : 'border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-transparent'
                        }`}
                      >
                        <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">{mode.icon}</span>
                        <span className="text-[8px] sm:text-[10px] font-black uppercase text-center leading-tight">{mode.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="bg-gray-50 dark:bg-[#252525] p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-800 flex justify-around items-center">
                    <div className="text-center">
                      <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase mb-0.5 sm:mb-1">Reactivos</p>
                      <p className="text-xl sm:text-2xl font-black text-[#621132] dark:text-[#D4C19C]">{currentMode.q}</p>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-gray-200 dark:bg-gray-800"></div>
                    <div className="text-center">
                      <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase mb-0.5 sm:mb-1">Duración</p>
                      <p className="text-xl sm:text-2xl font-black text-[#621132] dark:text-[#D4C19C]">{Math.round(currentMode.t / 60)}<span className="text-[10px] ml-0.5">min</span></p>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-3 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/40 font-bold">
                    <AlertTriangle size={18} /> {error}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full py-5 rounded-2xl text-white font-black text-xl shadow-xl hover:brightness-110 hover:-translate-y-1 active:translate-y-0 transition-all bg-[#621132] uppercase tracking-[0.2em]"
                >
                  Iniciar Evaluación
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-xs font-bold text-gray-500">
                <button 
                  onClick={() => setView('profile')}
                  className="hover:text-[#621132] dark:hover:text-[#D4C19C] transition-colors uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Trophy size={14} /> Mi Historial
                </button>
                <button 
                  onClick={onLogout}
                  className="hover:text-red-600 transition-colors uppercase tracking-wider flex items-center gap-1.5"
                >
                  <LogOut size={14} /> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      <p className="mt-8 text-[10px] font-black text-gray-300 dark:text-gray-700 uppercase tracking-[0.5em]">Material de Estudio • USICAMM 2026</p>
    </motion.div>
  );
}

function QuizScreen({ 
  currentQuestion, 
  currentIndex, 
  totalQuestions, 
  onAnswer, 
  userAnswer, 
  userAnswers,
  timeLeft, 
  formatTime,
  onFinish,
  setCurrentIndex,
  currentQuestions,
  showNav,
  setShowNav,
  onExit
}: any) {
  if (!currentQuestion) return null;

  const isAnswered = userAnswer !== -1;

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5] dark:bg-[#010409]">
      <AnimatePresence>
        {showNav && (
          <QuestionNavigator 
            questions={currentQuestions}
            userAnswers={userAnswers}
            currentIndex={currentIndex}
            onJump={(idx: number) => {
              setCurrentIndex(idx);
              setShowNav(false);
            }}
            onClose={() => setShowNav(false)}
          />
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 shadow-sm z-40 flex-shrink-0">
        <div className="px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => {
                if (confirm('¿Estás seguro de que quieres salir del examen? Tu progreso no se guardará.')) {
                  onExit();
                }
              }}
              className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all text-gray-600 dark:text-gray-400"
            >
              <RotateCcw size={16} className="sm:w-[20px]" />
            </button>
            <div className="flex flex-col">
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-[#621132] dark:text-[#D4C19C] leading-none mb-0.5">Activo</span>
              <h1 className="text-[10px] sm:text-sm font-bold text-gray-800 dark:text-gray-200 uppercase truncate max-w-[80px] sm:max-w-none">USICAMM</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4">
            <motion.div 
              animate={timeLeft < 60 ? { scale: [1, 1.05, 1], opacity: [1, 0.7, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-lg border-2 font-mono text-sm sm:text-lg font-bold transition-all shadow-sm ${
                timeLeft < 300 
                ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900' 
                : 'bg-[#F0F4F8] dark:bg-[#1C2128] border-blue-200 dark:border-blue-900/30 text-blue-700 dark:text-blue-400'
              }`}
            >
              <Clock size={12} className="sm:w-[18px]" />
              {formatTime(timeLeft)}
            </motion.div>

            <button
              onClick={() => setShowNav(true)}
              className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 sm:px-4 sm:py-3 rounded-lg bg-[#621132] text-white font-bold shadow-md hover:brightness-110 transition-all border border-[#621132]/20"
            >
              <Grid size={12} className="sm:w-[18px]" />
              <span className="text-[9px] sm:text-xs tracking-widest uppercase">Mapa</span>
            </button>
          </div>
        </div>

        {/* Visual Progress Bar Component */}
        <div className="relative h-3 sm:h-6 bg-gray-100 dark:bg-gray-800 w-full overflow-hidden flex flex-col justify-center">
           <motion.div 
             initial={false}
             animate={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
             className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#621132] to-[#8a1c47] dark:from-[#D4C19C] dark:to-[#e3d5b8]"
           />
           <div className="relative z-10 w-full px-3 sm:px-6 flex justify-between items-center text-[7px] sm:text-[10px] font-black uppercase tracking-widest mix-blend-difference text-white">
             <span>Pregunta {currentIndex + 1} de {totalQuestions}</span>
             <span className="hidden xs:inline">{Math.round(((currentIndex + 1) / totalQuestions) * 100)}% Completado</span>
           </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-8 overflow-hidden min-h-0">
        <div className="w-full max-w-7xl h-full flex flex-col">
          {/* Main Content Layout */}
          <div className="flex-grow flex flex-col lg:flex-row border border-gray-300 dark:border-gray-800 rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-[#010409] shadow-lg mb-2 sm:mb-4 min-h-0">
            {/* Left Column: Reading & Question Content Panel */}
            <div className="flex-[1.4] xl:flex-[1.6] flex flex-col bg-[#F8FAFC] dark:bg-[#0D1117] min-h-[300px] sm:min-h-[440px] border-r border-gray-200 dark:border-gray-800">
              <div className="bg-[#621132] dark:bg-[#252a33] px-4 py-2.5 sm:px-6 sm:py-3 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-white" />
                  <h3 className="font-black text-white text-xs sm:text-sm uppercase tracking-widest">
                    Reactivo {currentIndex + 1} de {totalQuestions}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-white/20 text-white px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                    {currentQuestion.difficulty ? currentQuestion.difficulty.toUpperCase() : 'USICAMM 2026'}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-grow custom-scrollbar space-y-6 sm:space-y-8">
                {/* Framed Reading / Practical Case Box like in User's Reference Image */}
                {currentQuestion.reading && (
                  <div className="border-2 border-sky-400 dark:border-sky-500/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-white dark:bg-[#161B22] shadow-sm relative transition-all">
                    <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2.5 text-sky-700 dark:text-sky-400">
                        <BookOpen size={20} />
                        <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                          {currentQuestion.readingTitle || 'Lectura y Caso Práctico Institucional'}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-sky-50 dark:bg-sky-950/40 px-3 py-1 rounded-full border border-sky-100 dark:border-sky-900/40">
                        Caso Práctico
                      </span>
                    </div>
                    
                    <div className="space-y-4 text-slate-800 dark:text-slate-100 text-base sm:text-lg leading-relaxed sm:leading-loose font-sans">
                      {currentQuestion.reading.split('\n\n').map((paragraph: string, pIdx: number) => (
                        <p key={pIdx} className="leading-relaxed sm:leading-loose text-justify">
                          {paragraph.trim()}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question / Prompt Section with distinct arrow */}
                <div className="bg-white dark:bg-[#161B22] rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="text-xl sm:text-2xl font-black text-[#621132] dark:text-[#D4C19C] shrink-0 mt-0.5 select-none">
                      ➤
                    </span>
                    <h4 className="text-lg sm:text-2xl font-black leading-snug text-slate-900 dark:text-white font-sans">
                      {currentQuestion.case.replace(/^➤\s*/, '')}
                    </h4>
                  </div>
                </div>

                {/* Enhanced Interactive List Layouts */}
                {(currentQuestion.type === 'ordenamiento' || currentQuestion.type === 'comienzo' || currentQuestion.type === 'casuistica') && currentQuestion.items && (
                  <div className="space-y-4 bg-gray-50/80 dark:bg-black/20 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-inner">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-grow bg-gray-200 dark:bg-gray-800"></div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em]">Elementos a considerar:</span>
                      <div className="h-px flex-grow bg-gray-200 dark:bg-gray-800"></div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestion.items.map((item: string, i: number) => (
                        <div key={i} className="flex gap-4 p-4 sm:p-5 bg-white dark:bg-[#1E1E1E] border-2 border-gray-100 dark:border-gray-800/40 rounded-2xl shadow-sm">
                          <span className="font-black text-[#D37233] text-lg sm:text-xl leading-none shrink-0 w-8">{i + 1}.</span>
                          <span className="text-slate-700 dark:text-slate-300 text-base sm:text-lg font-medium leading-normal">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'relacion' && currentQuestion.items && currentQuestion.matchItems && (
                  <div className="space-y-4 bg-white dark:bg-[#161B22] p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Columna I</span>
                          <div className="h-[2px] flex-grow bg-gray-200 dark:bg-gray-800"></div>
                        </div>
                        <div className="space-y-3">
                          {currentQuestion.items.map((item: string, i: number) => (
                            <div key={i} className="flex gap-3 items-start py-2">
                              <span className="font-black text-slate-800 dark:text-slate-200 min-w-[24px]">{i + 1}.</span>
                              <span className="text-base sm:text-lg dark:text-slate-300 leading-snug font-medium text-slate-700">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Columna II</span>
                          <div className="h-[2px] flex-grow bg-gray-200 dark:bg-gray-800"></div>
                        </div>
                        <div className="space-y-3">
                          {currentQuestion.matchItems.map((item: string, i: number) => (
                            <div key={i} className="flex gap-3 items-start py-2">
                              <span className="font-black text-slate-800 dark:text-slate-200 min-w-[24px]">{String.fromCharCode(97 + i)})</span>
                              <span className="text-base sm:text-lg dark:text-slate-400 font-normal leading-snug text-slate-600">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Spacious Options Panel (Que no se amontonen las respuestas) */}
            <div className="w-full lg:w-[480px] xl:w-[580px] 2xl:w-[640px] flex flex-col bg-white dark:bg-[#0D1117] border-t lg:border-t-0 shadow-xl flex-shrink-0">
              <div className="bg-[#E2E8F0] dark:bg-[#1C2128] px-4 py-2.5 sm:px-6 sm:py-3 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between shadow-sm">
                <h3 className="font-black text-slate-800 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-[0.2em]">
                  Opciones de Respuesta
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Elija una opción
                </span>
              </div>

              <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-grow custom-scrollbar bg-slate-50/50 dark:bg-black/30 pb-24 sm:pb-32">
                <div className="flex items-center gap-3 mb-2 sm:mb-4">
                  <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Seleccione la respuesta correcta:
                  </span>
                  <div className="h-px flex-grow bg-gray-200 dark:bg-gray-800"></div>
                </div>

                {currentQuestion.options.map((option: string, idx: number) => {
                  const letter = String.fromCharCode(97 + idx); // 'a', 'b', 'c', 'd'
                  const cleanOption = option.replace(/^[a-d][\.\)]\s*/i, '').replace(/^[A-D][\.\)]\s*/i, '');
                  const isSelected = userAnswer === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => onAnswer(idx)}
                      className={`w-full group text-left p-5 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all duration-200 flex items-start gap-4 sm:gap-5 shadow-sm transform hover:-translate-y-0.5 active:scale-[0.99] ${
                        isSelected 
                        ? 'border-[#621132] dark:border-[#D4C19C] bg-[#621132]/5 dark:bg-[#D4C19C]/10 ring-4 ring-[#621132]/10 dark:ring-[#D4C19C]/10 shadow-md' 
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161B22] hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md'
                      }`}
                    >
                      {/* Radio button indicator */}
                      <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isSelected 
                        ? 'border-[#621132] dark:border-[#D4C19C] bg-[#621132] dark:bg-[#D4C19C] text-white' 
                        : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 group-hover:border-gray-400'
                      }`}>
                        {isSelected ? (
                          <CheckCircle2 size={14} className="text-white dark:text-gray-900" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                        )}
                      </div>

                      {/* Option text with letter and generous breathing room */}
                      <div className="flex items-start gap-3 sm:gap-4 flex-grow">
                        <span className={`font-black text-base sm:text-lg shrink-0 select-none ${
                          isSelected ? 'text-[#621132] dark:text-[#D4C19C]' : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          {letter}.
                        </span>
                        <span className={`text-base sm:text-lg leading-relaxed transition-colors ${
                          isSelected ? 'text-black dark:text-white font-black' : 'text-slate-700 dark:text-slate-200 font-medium'
                        }`}>
                          {cleanOption}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="mt-1 sm:mt-2 flex flex-col sm:flex-row justify-between items-center px-1 sm:px-2 gap-2 sm:gap-4 pb-4 flex-shrink-0">
            <div className="w-full sm:w-auto">
              <AnimatePresence>
                {!isAnswered && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-[10px] sm:text-sm uppercase tracking-widest bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/30 shadow-sm justify-center"
                  >
                    <AlertTriangle size={14} className="animate-pulse sm:w-[18px]" />
                    Esta pregunta es obligatoria
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex gap-4 w-full sm:w-auto">
              {currentIndex === totalQuestions - 1 ? (
                <button 
                  disabled={!isAnswered}
                  onClick={onFinish}
                  className="w-full sm:w-auto px-10 py-3 bg-[#621132] text-white rounded-lg font-black shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs sm:text-sm tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
                >
                  Finalizar
                </button>
              ) : (
                <button 
                  disabled={!isAnswered}
                  onClick={() => setCurrentIndex((prev: number) => prev + 1)}
                  className="w-full sm:w-auto px-10 py-3 bg-[#621132] text-white rounded-lg font-black shadow-lg hover:brightness-110 active:scale-95 transition-all text-xs sm:text-sm tracking-widest uppercase disabled:opacity-30 disabled:cursor-not-allowed disabled:grayscale"
                >
                  Siguiente
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionNavigator({ questions, userAnswers, currentIndex, onJump, onClose }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-white dark:bg-[#0D1117] rounded-3xl shadow-2xl overflow-hidden border-2 border-[#621132] dark:border-[#30363d]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#161B22]">
          <div>
            <h2 className="text-xl font-black text-[#621132] dark:text-[#D4C19C]">Mapa del Examen</h2>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Resumen de avance</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
           <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-3">
             {questions.map((_: any, idx: number) => {
               const isAnswered = userAnswers[idx] !== -1;
               const isCurrent = idx === currentIndex;
               
               return (
                 <button
                   key={idx}
                   onClick={() => onJump(idx)}
                   className={`h-11 rounded-lg font-black text-sm transition-all flex items-center justify-center border-2 ${
                     isCurrent 
                     ? 'border-[#621132] bg-[#621132] text-white shadow-lg scale-110 z-10' 
                     : isAnswered 
                       ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                       : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-[#621132] dark:hover:border-[#D4C19C]'
                   }`}
                 >
                   {idx + 1}
                 </button>
               );
             })}
           </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-[#161B22] border-t dark:border-gray-800 flex flex-wrap gap-6 text-xs font-bold uppercase tracking-wider">
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-[#621132] rounded"></div>
             <span>Actual</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 bg-green-50 text-green-700 border-2 border-green-500 rounded"></div>
             <span>Respondida</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 border-2 border-gray-200 rounded"></div>
             <span>Pendiente</span>
           </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReviewItem({ q, index, userAnswer, totalQuestions }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isCorrect = userAnswer === q.correctAnswer;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex gap-4 items-start text-left hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
      >
        <div className={`p-2 rounded-lg shrink-0 mt-1 ${isCorrect ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
          {isCorrect ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
        </div>
        <div className="flex-grow">
          <div className="flex justify-between items-center mb-4">
            <ChevronDown size={18} className={`text-gray-400 transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
          <p className="text-base sm:text-xl font-black text-slate-800 dark:text-white leading-tight mb-4 tracking-tight">{q.case}</p>
          
          {/* Detailed Lists in Review */}
          {isOpen && q.items && (
            <div className="mt-4 mb-6 space-y-4">
                {q.type === 'ordenamiento' ? (
                  <div className="p-6 bg-gray-50 dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-gray-800">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Orden de elementos:</h5>
                    <div className="space-y-3">
                      {q.items.map((item: string, i: number) => (
                        <div key={i} className="flex gap-4 items-start">
                          <span className="w-6 h-6 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</span>
                          <span className="text-sm text-slate-700 dark:text-slate-300 font-bold leading-tight">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 p-6 bg-gray-50 dark:bg-[#161B22] rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="space-y-4">
                       <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">Columna I:</h5>
                       <div className="space-y-3">
                         {q.items.map((item: string, i: number) => (
                           <div key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 font-bold">
                             <span className="font-black text-gray-400 min-w-[20px]">{i+1}.</span>
                             <span>{item}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                    <div className="space-y-4">
                       <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-gray-700 pb-2">Columna II:</h5>
                       <div className="space-y-3">
                         {q.matchItems?.map((item: string, i: number) => (
                           <div key={i} className="flex gap-3 text-sm text-slate-600 dark:text-slate-400 font-medium">
                             <span className="font-black text-gray-400 min-w-[20px]">{String.fromCharCode(97+i)})</span>
                             <span>{item}</span>
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {!isOpen && (
             <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCorrect ? 'bg-green-100 dark:bg-green-900/40 text-green-700' : 'bg-red-100 dark:bg-red-900/40 text-red-700'}`}>
                  {isCorrect ? 'Correcta' : 'Incorrecta'}
                </span>
                <span className="text-xs text-gray-400">Ver respuesta detallada</span>
             </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50 dark:bg-[#1A1A1A]"
          >
            <div className="p-6 ml-4 sm:ml-12 space-y-6">
              {/* Framed Reading Case in Review */}
              {q.reading && (
                <div className="border-2 border-sky-400 dark:border-sky-500/50 rounded-2xl p-6 bg-white dark:bg-[#161B22] shadow-sm">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <BookOpen size={16} />
                    <h6 className="text-xs font-black uppercase tracking-wider">{q.readingTitle || 'Lectura / Caso Práctico'}</h6>
                  </div>
                  <div className="space-y-3 text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-relaxed">
                    {q.reading.split('\n\n').map((paragraph: string, pIdx: number) => (
                      <p key={pIdx} className="leading-relaxed">
                        {paragraph.trim()}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Options in Review with generous spacing */}
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Opciones analizadas:</p>
                {q.options.map((option: string, i: number) => {
                  const letter = String.fromCharCode(97 + i);
                  const isUserSelection = userAnswer === i;
                  const isCorrectAnswer = q.correctAnswer === i;
                  
                  let bgColor = 'bg-white dark:bg-[#252525]';
                  let borderColor = 'border-gray-200 dark:border-gray-800';
                  let textColor = 'text-slate-700 dark:text-slate-300';
                  let label = '';

                  if (isCorrectAnswer) {
                    borderColor = 'border-green-500';
                    bgColor = 'bg-green-50 dark:bg-green-950/20';
                    textColor = 'text-green-700 dark:text-green-400 font-bold';
                    label = 'Respuesta Correcta';
                  } else if (isUserSelection && !isCorrectAnswer) {
                    borderColor = 'border-red-500';
                    bgColor = 'bg-red-50 dark:bg-red-950/20';
                    textColor = 'text-red-700 dark:text-red-400';
                    label = 'Tu Elección (Incorrecta)';
                  }

                  return (
                    <div key={i} className={`p-5 rounded-2xl border-2 transition-all ${borderColor} ${bgColor}`}>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-start gap-3">
                          <span className="font-black text-sm sm:text-base shrink-0 mt-0.5">{letter}.</span>
                          <p className={`text-sm sm:text-base leading-relaxed ${textColor}`}>
                            {option.replace(/^[a-d][\.\)]\s*/i, '').replace(/^[A-D][\.\)]\s*/i, '')}
                          </p>
                        </div>
                        {label && (
                          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full shrink-0 self-start sm:self-auto ${
                            isCorrectAnswer ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                          }`}>
                            {label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-5 bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2 text-[#621132] dark:text-[#D4C19C]">
                  <BookOpen size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Fundamentación Bibliográfica</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed italic">{q.reference}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultsScreen({ session, score, percentage, questions, userAnswers, onRestart, onLogout, user, history, startTime: quizStartTime }: any) {
  const finalGrade = (score / questions.length * 10).toFixed(2);
  const startTime = quizStartTime || new Date();
  const endTime = new Date();
  
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);
  const durationSeconds = Math.floor((durationMs % 60000) / 1000);

  const [showReview, setShowReview] = useState(false);

  const userName = user?.displayName || session?.name || 'Aspirante USICAMM';
  const currentDateFormatted = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) + `, ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }).toUpperCase()}`;
  };

  const shareText = `¡He obtenido un ${finalGrade}/10 (${percentage}%) en el Simulacro USICAMM 2026! 🎓📚 Prepárate tú también en USICAMM Quizz.`;
  const shareUrl = window.location.origin;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Simulador USICAMM 2026',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert('¡Resultado copiado al portapapeles!');
      } catch (err) {
        alert('Copia el resultado manualmente:\n' + shareText);
      }
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, '_blank');
  };

  const shareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank');
  };

  const shareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-6 py-12 font-sans bg-white dark:bg-[#0D1117] min-h-screen"
    >
      {/* Header with User Name and Date */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 pb-8 border-b border-gray-100 dark:border-gray-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCircle size={14} className="text-[#621132] dark:text-[#D4C19C]" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Resultado de:</p>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-[#621132] dark:text-[#D4C19C] tracking-tighter uppercase leading-none">{userName}</h2>
        </div>
        <div className="text-left md:text-right">
          <div className="flex items-center md:justify-end gap-2 mb-1">
            <Calendar size={14} className="text-[#621132] dark:text-[#D4C19C]" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Fecha del Examen:</p>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-bold capitalize text-sm sm:text-base">{currentDateFormatted}</p>
        </div>
      </div>

      <div className="mb-12">
        <div className="bg-[#621132]/5 dark:bg-[#D4C19C]/5 p-6 rounded-3xl border border-[#621132]/10 dark:border-[#D4C19C]/10 mb-10">
          <p className="text-xs font-black text-[#621132] dark:text-[#D4C19C] uppercase tracking-[0.3em] mb-2">Puntaje Obtenido</p>
          <h1 className="text-4xl sm:text-6xl font-black text-slate-800 dark:text-gray-100 tracking-tight leading-tight">
            {finalGrade}<span className="text-2xl sm:text-3xl text-gray-400">/10.00</span>
          </h1>
          <div className="mt-4 flex items-center gap-4">
            <div className="h-2 flex-grow bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${percentage}%` }}
                 className={`h-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}
               />
            </div>
            <span className="font-black text-xl">{percentage}%</span>
          </div>
        </div>

        <h2 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-gray-200 mt-6 sm:mt-10 mb-4 sm:mb-6">
          Resumen detallado de la evaluación
        </h2>

        {/* The "Intento 1" Summary Box */}
        <div className="bg-[#f2f2f2] dark:bg-[#161B22] p-0 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden max-w-2xl shadow-sm">
          <div className="bg-[#e9ecef] dark:bg-[#1C2128] px-6 py-3 border-b border-gray-200 dark:border-gray-700">
             <h3 className="font-black text-lg text-slate-800 dark:text-gray-200">Intento 1</h3>
          </div>
          
          <table className="w-full text-xs sm:text-base">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right w-1/3 bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Estado</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400">
                  <span>Finalizado</span>
                  <CheckCircle2 size={14} className="text-green-600 sm:w-[16px]" />
                </td>
              </tr>
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Iniciado</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400">
                  <span className="capitalize truncate max-w-[120px] sm:max-w-none">{formatDate(startTime)}</span>
                  <Calendar size={14} className="text-gray-400 sm:w-[16px]" />
                </td>
              </tr>
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Finalizado</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400">
                  <span className="capitalize truncate max-w-[120px] sm:max-w-none">{formatDate(endTime)}</span>
                  <Calendar size={14} className="text-gray-400 sm:w-[16px]" />
                </td>
              </tr>
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Tiempo</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400">
                  <span>{durationMinutes}m {durationSeconds}s</span>
                  <Clock size={14} className="text-gray-400 sm:w-[16px]" />
                </td>
              </tr>
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Aciertos</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400">
                  <span>{score}/{questions.length}</span>
                  <Trophy size={14} className="text-gray-400 sm:w-[16px]" />
                </td>
              </tr>
              <tr className="group">
                <td className="px-3 py-2 sm:px-6 sm:py-3 font-black text-right bg-[#f8f9fa] dark:bg-[#0D1117] text-slate-700 dark:text-gray-300">Calificación</td>
                <td className="px-3 py-2 sm:px-6 sm:py-3 flex justify-between items-center text-slate-600 dark:text-gray-400 font-black">
                  <span>{finalGrade} ({percentage}%)</span>
                  <Check size={14} className="text-gray-400 sm:w-[16px]" />
                </td>
              </tr>
            </tbody>
          </table>
          <div className="bg-gray-100 dark:bg-gray-900/50 px-6 py-2">
            <p className="text-xs text-gray-500 italic">No permitido</p>
          </div>
        </div>

        <p className="mt-8 text-gray-700 dark:text-gray-400 font-medium">No se permiten más intentos</p>
      </div>

      <div className="flex flex-col gap-8 mt-16 pt-12 border-t border-gray-100 dark:border-gray-800">
        <div className="space-y-6">
          <h3 className="font-black text-[#621132] dark:text-[#D4C19C] uppercase tracking-widest text-sm">Acciones y Redes Sociales</h3>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={shareWhatsApp}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-[#25D366] text-white rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg min-w-[160px]"
            >
              <Phone size={18} /> WhatsApp
            </button>
            <button 
              onClick={shareFacebook}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-[#1877F2] text-white rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg min-w-[160px]"
            >
              <Facebook size={18} /> Facebook
            </button>
            <button 
              onClick={shareTwitter}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-[#1DA1F2] text-white rounded-xl font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg min-w-[160px]"
            >
              <Twitter size={18} /> Twitter
            </button>
            <button 
              onClick={handleShare}
              className="flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-[#1E1E1E] text-[#621132] dark:text-[#D4C19C] border border-[#621132] dark:border-[#D4C19C] rounded-xl font-black text-sm hover:bg-gray-50 dark:hover:bg-[#252525] transition-all shadow-lg min-w-[160px]"
            >
              <Share2 size={18} /> Otros
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setShowReview(!showReview)}
            className="px-6 py-3 bg-[#e9ecef] dark:bg-[#1C2128] text-slate-800 dark:text-gray-200 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors border border-gray-300 dark:border-gray-700 shadow-sm"
          >
            {showReview ? 'Ocultar Revisión' : 'Revisar Mis Respuestas'}
          </button>
        </div>

        <AnimatePresence>
          {showReview && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-8 bg-white dark:bg-[#1E1E1E] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xl"
            >
              <div className="p-6 bg-gray-50 dark:bg-[#161B22] border-b dark:border-gray-800">
                <h3 className="font-black text-[#621132] dark:text-[#D4C19C] uppercase tracking-widest text-sm">Detalle de Respuestas</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {questions.map((q: any, idx: number) => (
                  <ReviewItem 
                    key={q.id} 
                    q={q} 
                    index={idx} 
                    userAnswer={userAnswers[idx]} 
                    totalQuestions={questions.length} 
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-end gap-4 pt-12 border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={onRestart}
            className="px-8 py-3 bg-[#e9ecef] dark:bg-[#1C2128] text-slate-800 dark:text-gray-200 rounded-md font-bold hover:bg-gray-200 transition-colors border border-gray-300 dark:border-gray-700 shadow-sm"
          >
            Volver a Intentar
          </button>
          <button 
            onClick={onLogout}
            className="px-8 py-3 bg-[#e9ecef] dark:bg-[#1C2128] text-slate-800 dark:text-gray-200 rounded-md font-bold hover:bg-gray-200 transition-colors border border-gray-300 dark:border-gray-700 shadow-sm"
          >
            Volver al curso
          </button>
        </div>
      </div>
    </motion.div>
  );
}
