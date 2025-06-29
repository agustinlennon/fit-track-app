import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc, query, where, writeBatch, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Youtube, Link as LinkIcon, Bot, Send, Dumbbell, Utensils, Calendar, BarChart2, User, Settings as SettingsIcon, PlusCircle, Trash2, Sun, Moon, Flame, ChevronLeft, ChevronRight, X, Edit, MessageSquare, Plus, Check } from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
function initializeFirebase() {
  try {
    const firebaseConfigString = import.meta.env.VITE_FIREBASE_CONFIG;
    if (!firebaseConfigString) {
      console.error("Firebase config not found in environment variables.");
      return null;
    }
    const firebaseConfig = JSON.parse(firebaseConfigString);
    const app = initializeApp(firebaseConfig);
    return { app, config: firebaseConfig };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    return null;
  }
}
const firebaseData = initializeFirebase();
const appId = firebaseData ? firebaseData.config.appId : 'default-app-id';

// --- UI COMPONENTS ---
const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false, type = 'button' }) => {
  const baseClasses = 'px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-md hover:shadow-lg',
    secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    ghost: 'bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
  };
  return <button onClick={onClick} disabled={disabled} type={type} className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</button>;
};

const Modal = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  if (!isOpen) return null;
  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className={`bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const Input = React.forwardRef((props, ref) => (
  <input ref={ref} {...props} className={`w-full p-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow ${props.className || ''}`} />
));

// --- DASHBOARD COMPONENTS ---
const NextWorkout = ({ schedule, setView, setWorkoutData, dayOfWeek }) => {
  const workoutForToday = schedule ? (schedule[dayOfWeek] || []) : [];
  const workout = Array.isArray(workoutForToday) ? workoutForToday : [];

  const handleStartWorkout = () => {
    if (!Array.isArray(workoutForToday)) {
      alert("Por favor, actualiza tu plan semanal para añadir ejercicios específicos a este día.");
      return;
    }
    setWorkoutData(workout);
    setView('workoutSession');
  };
  
  return (
    <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white">
      <h2 className="text-2xl font-bold mb-2">Próximo Entrenamiento</h2>
      <p className="capitalize text-blue-100 mb-4">{dayOfWeek}</p>
      {typeof workoutForToday === 'string' && (
         <p className="text-lg bg-white/10 p-3 rounded-lg mb-4">{workoutForToday}</p>
      )}
      {workout.length > 0 ? (
        <>
          <ul className="space-y-2 mb-4">
            {workout.slice(0, 3).map((ex, i) => (
              <li key={i} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg text-sm">
                <Dumbbell className="text-blue-200" size={18}/>
                <span>{ex.name} - {ex.sets}x{ex.reps}</span>
              </li>
            ))}
            {workout.length > 3 && <li className="text-center text-blue-200 text-sm">y {workout.length - 3} más...</li>}
          </ul>
          <Button onClick={handleStartWorkout} className="w-full bg-white text-blue-600 hover:bg-blue-100">Comenzar Entrenamiento</Button>
        </>
      ) : typeof workoutForToday !== 'string' ? (
        <p>¡Día de descanso! Aprovecha para recuperar.</p>
      ) : null}
    </Card>
  );
};

const Macronutrients = ({ dailyLog, goals }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todaysLog = { loggedFoods: [], ...(dailyLog[today] || {}) };
  const totals = useMemo(() => {
    return (todaysLog.loggedFoods || []).reduce((acc, food) => {
      acc.calories += food.calories || 0;
      acc.protein += food.protein || 0;
      acc.carbs += food.carbs || 0;
      acc.fat += food.fat || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todaysLog.loggedFoods]);
  
  const getProgress = (current, goal) => (goal > 0 ? (current / goal) * 100 : 0);

  return (
    <Card>
      <h3 className="font-bold text-xl mb-4">Macronutrientes de Hoy</h3>
      <div className="space-y-3">
        {['calories', 'protein', 'carbs', 'fat'].map(macro => {
          const current = totals[macro];
          const goal = goals[macro];
          return (
            <div key={macro}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">{macro}</span>
                <span>{Math.round(current)} / {goal} {macro === 'calories' ? 'kcal' : 'g'}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                 <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(getProgress(current, goal), 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};


// --- WORKOUT SESSION COMPONENTS ---
const WorkoutSession = ({ workoutData, setView }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    if (!workoutData || workoutData.length === 0) {
        return (
            <div className="text-center p-6">
                <p className="text-lg">No hay entrenamiento para hoy.</p>
                <Button onClick={() => setView('dashboard')} className="mt-4">Volver al Dashboard</Button>
            </div>
        );
    }
    const currentExercise = workoutData[currentIndex];

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Sesión de Entrenamiento</h2>
                 <Button onClick={() => setView('dashboard')} variant="ghost"><X size={24}/></Button>
            </div>
            
            <Card className="flex-grow flex flex-col justify-between text-center">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Ejercicio {currentIndex + 1} / {workoutData.length}</p>
                    <h3 className="text-3xl md:text-4xl font-bold my-4 text-blue-600 dark:text-blue-400">{currentExercise.name}</h3>
                    <div className="flex justify-center gap-6 my-8 text-lg">
                        <div><p className="text-gray-500 dark:text-gray-400">Series</p><p className="font-bold text-2xl">{currentExercise.sets}</p></div>
                        <div><p className="text-gray-500 dark:text-gray-400">Reps</p><p className="font-bold text-2xl">{currentExercise.reps}</p></div>
                        <div><p className="text-gray-500 dark:text-gray-400">Peso</p><p className="font-bold text-2xl">{currentExercise.weight}</p></div>
                    </div>
                </div>
                <div className="mt-auto space-y-4">
                  {currentExercise.videoUrl && (
                    <a href={currentExercise.videoUrl} target="_blank" rel="noopener noreferrer" className="w-full bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
                      <Youtube size={20} /> Ver Video
                    </a>
                  )}
                  <Button onClick={() => setView('aiChat')} className="w-full" variant="secondary"><Bot size={20}/> Asistente IA</Button>
                </div>
            </Card>

            <div className="flex justify-between mt-4">
                <Button onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))} disabled={currentIndex === 0}><ChevronLeft /> Anterior</Button>
                {currentIndex === workoutData.length - 1 ? (
                   <Button onClick={() => { alert("¡Entrenamiento completado!"); setView('dashboard'); }} variant="primary">Finalizar</Button>
                ) : (
                   <Button onClick={() => setCurrentIndex(i => Math.min(i + 1, workoutData.length - 1))}>Siguiente <ChevronRight /></Button>
                )}
            </div>
        </div>
    );
};

// Placeholder for other components.
const FoodLogger = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Comidas</Card>;
const ExerciseManager = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Ejercicios</Card>;
const ProgressTracker = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Progreso</Card>;
const AppSettings = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Ajustes</Card>;
const AiChat = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Chat</Card>;
const Planner = ({handleGoBack}) => <Card><Button onClick={handleGoBack}>Volver</Button> Placeholder Plan Semanal</Card>;


// --- MAIN APP COMPONENT ---
export default function App() {
    const [firebaseServices, setFirebaseServices] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('dashboard');
    const [isDarkMode, setIsDarkMode] = useState(true);
    
    // --- Data States ---
    const [userData, setUserData] = useState(null);
    const [dailyLog, setDailyLog] = useState({});
    const [weightHistory, setWeightHistory] = useState([]);
    const [foodDatabase, setFoodDatabase] = useState([]);
    const [exerciseDatabase, setExerciseDatabase] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [workoutData, setWorkoutData] = useState([]);

    const dayOfWeek = new Date().toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();

    // Initialize Firebase
    useEffect(() => {
        if(firebaseData) {
            const { app } = firebaseData;
            const auth = getAuth(app);
            const db = getFirestore(app);
            setFirebaseServices({ auth, db, app });

            onAuthStateChanged(auth, async (user) => {
                if (user) { setUserId(user.uid); } 
                else { await signInAnonymously(auth); }
                setIsAuthReady(true);
            });
        } else {
          setIsAuthReady(true); // Still ready, but with no services
        }
    }, []);
    
    // Fetch all data
    useEffect(() => {
        if (isAuthReady && firebaseServices && userId) {
            const basePath = `artifacts/${appId}/users/${userId}`;
            const unsubs = [
                onSnapshot(doc(firebaseServices.db, `${basePath}/profile/data`), (doc) => {
                    if (doc.exists()) {
                        setUserData(doc.data());
                    } else {
                       setDoc(doc.ref, { 
                            goals: { calories: 2500, protein: 180, carbs: 250, fat: 70 },
                            workoutSchedule: { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [] }
                        });
                    }
                }),
                onSnapshot(collection(firebaseServices.db, `${basePath}/dailyLogs`), snap => {
                     setDailyLog(snap.docs.reduce((acc, doc) => ({ ...acc, [doc.id]: doc.data() }), {}));
                }),
                onSnapshot(query(collection(firebaseServices.db, `${basePath}/weightHistory`)), snap => {
                    setWeightHistory(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(a.date) - new Date(b.date)));
                }),
            ];
            return () => unsubs.forEach(unsub => unsub());
        }
    }, [isAuthReady, firebaseServices, userId]);
    
     // --- UI Mode ---
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);
    
    if (!isAuthReady || !userData) {
      return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><div className="text-center"><Flame className="mx-auto h-12 w-12 text-blue-600 animate-pulse" /><p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">Cargando tu plan...</p></div></div>;
    }
    
    // --- Navigation ---
    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <NextWorkout schedule={userData.workoutSchedule} setView={setView} setWorkoutData={setWorkoutData} dayOfWeek={dayOfWeek} />;
            case 'workoutSession':
                return <WorkoutSession workoutData={workoutData} setView={setView} />;
            case 'planner': return <Planner handleGoBack={() => setView('dashboard')} />;
            case 'food': return <FoodLogger handleGoBack={() => setView('dashboard')} />;
            case 'exercises': return <ExerciseManager handleGoBack={() => setView('dashboard')} />;
            case 'progress': return <ProgressTracker handleGoBack={() => setView('dashboard')} />;
            case 'settings': return <AppSettings handleGoBack={() => setView('dashboard')} />;
            case 'aiChat': return <AiChat handleGoBack={() => setView('dashboard')} />;
            default:
                return <NextWorkout schedule={userData.workoutSchedule} setView={setView} setWorkoutData={setWorkoutData} dayOfWeek={dayOfWeek} />;
        }
    };
    
    const NavItem = ({ icon: Icon, label, viewName }) => (
        <button onClick={() => setView(viewName)} className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1 sm:gap-3 p-2 sm:px-4 rounded-lg w-full text-left transition-colors ${view === viewName ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            <Icon size={22} /><span className="text-xs sm:text-base font-medium">{label}</span>
        </button>
    );

    return (
      <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen font-sans">
         <div className="flex flex-col sm:flex-row">
            <nav className="fixed bottom-0 sm:static sm:h-screen w-full sm:w-64 bg-white dark:bg-gray-800 shadow-lg sm:shadow-none border-t sm:border-r border-gray-200 dark:border-gray-700 p-2 sm:p-4 z-40">
               <div className="flex flex-row sm:flex-col justify-around sm:justify-start sm:gap-2 h-full">
                  <div className="hidden sm:flex items-center gap-3 mb-8"><Flame className="h-8 w-8 text-blue-500"/><h1 className="text-2xl font-bold">FitTrack Pro</h1></div>
                  <NavItem icon={BarChart2} label="Dashboard" viewName="dashboard" />
                  <NavItem icon={MessageSquare} label="Chat IA" viewName="aiChat" />
                  <NavItem icon={Calendar} label="Plan Semanal" viewName="planner" />
                  <NavItem icon={Utensils} label="Alimentos" viewName="food" />
                  <NavItem icon={Dumbbell} label="Ejercicios" viewName="exercises" />
                  <NavItem icon={User} label="Progreso" viewName="progress" />
                  <NavItem icon={SettingsIcon} label="Ajustes" viewName="settings" />
                  <div className="mt-auto hidden sm:block">
                     <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 mt-2">
                        {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}<span className="font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
                     </button>
                  </div>
               </div>
            </nav>
            <main className="flex-1 p-4 sm:p-8 pb-24 sm:pb-8">
               {renderView()}
               {view === 'dashboard' && (
                 <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Macronutrients dailyLog={dailyLog} goals={userData.goals}/>
                    <Card><h3 className="font-bold text-xl">Progreso de Peso</h3>{/* ... content ... */}</Card>
                 </div>
               )}
            </main>
         </div>
      </div>
    );
}

