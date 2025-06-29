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
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
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
  const isWorkoutArray = Array.isArray(workoutForToday);
  const workout = isWorkoutArray ? workoutForToday : [];

  const handleStartWorkout = () => {
    if (!isWorkoutArray) {
      alert("Por favor, actualiza tu plan semanal para añadir ejercicios específicos a este día en la sección 'Plan Semanal'.");
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
      ) : !isWorkoutArray ? (
          <Button onClick={() => setView('planner')} className="w-full bg-white/20 hover:bg-white/30">Ir al Planificador</Button>
      ) : (
        <p>¡Día de descanso! Aprovecha para recuperar.</p>
      )}
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
        <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-gray-100">Macronutrientes de Hoy</h3>
        <div className="space-y-3">
          {['calories', 'protein', 'carbs', 'fat'].map(macro => {
            const current = totals[macro];
            const goal = goals[macro];
            const unit = macro === 'calories' ? 'kcal' : 'g';
            const color = macro === 'protein' ? 'bg-red-500' : macro === 'carbs' ? 'bg-yellow-500' : macro === 'fat' ? 'bg-green-500' : 'bg-blue-500';

            return (
              <div key={macro}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">{macro}</span>
                  <span className="text-gray-600 dark:text-gray-400">{Math.round(current)} / {goal} {unit}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                   <div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.min(getProgress(current, goal), 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };
  
// --- MAIN APP COMPONENT ---
export default function App() {
    // ... (omitting other components for brevity as they are now implemented)
    // You would paste the full code here including all the components like WorkoutSession, Planner, etc.
    // I am only showing the App component and the fixed NextWorkout component for clarity.
    
    // --- STATE MANAGEMENT ---
    const [firebaseServices, setFirebaseServices] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('dashboard');
    const [isDarkMode, setIsDarkMode] = useState(true);
    
    const [userData, setUserData] = useState(null);
    const [dailyLog, setDailyLog] = useState({});
    const [weightHistory, setWeightHistory] = useState([]);
    const [workoutData, setWorkoutData] = useState([]);

    const dayOfWeek = useMemo(() => new Date().toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase(), []);
    
    // --- FIREBASE INITIALIZATION & DATA FETCHING ---
    useEffect(() => {
        if(firebaseData) {
            const { app } = firebaseData;
            const auth = getAuth(app);
            const db = getFirestore(app);
            setFirebaseServices({ auth, db, app });

            const unsubAuth = onAuthStateChanged(auth, async (user) => {
                if (user) { 
                    setUserId(user.uid);
                } else {
                    await signInAnonymously(auth);
                }
                setIsAuthReady(true);
            });
            return () => unsubAuth();
        } else {
          setIsAuthReady(true);
        }
    }, []);
    
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
                // Add other listeners for food, exercises etc. here
            ];
            return () => unsubs.forEach(unsub => unsub());
        }
    }, [isAuthReady, firebaseServices, userId]);
    
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);
    
    if (!isAuthReady || !userData) {
      return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><div className="text-center"><Flame className="mx-auto h-12 w-12 text-blue-600 animate-pulse" /><p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">Cargando tu plan...</p></div></div>;
    }
    
    // --- NAVIGATION ---
    const renderView = () => {
        // This would contain the full logic with all implemented components
        switch (view) {
            case 'dashboard':
                return <NextWorkout schedule={userData.workoutSchedule} setView={setView} setWorkoutData={setWorkoutData} dayOfWeek={dayOfWeek} />;
            case 'workoutSession':
                return <WorkoutSession workoutData={workoutData} setView={setView} />;
            // ... other cases
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
