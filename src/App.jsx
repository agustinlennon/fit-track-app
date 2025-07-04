import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInAnonymously, linkWithCredential, EmailAuthProvider, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, addDoc, deleteDoc, arrayUnion, arrayRemove, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Youtube, PlusCircle, Trash2, Sun, Moon, Utensils, Dumbbell, Droplet, Bed, CheckCircle, BarChart2, User, Settings as SettingsIcon, X, Calendar, Flame, Sparkles, Clock, Edit, Play, Pause, RotateCcw, Check, Ruler, LogOut, History, Star } from 'lucide-react';

// --- FUNCIÓN AUXILIAR ---
// Función para quitar tildes y normalizar strings para comparaciones
const normalizeString = (str) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- INICIALIZACIÓN DE FIREBASE Y SERVICIOS ---

let firebaseConfig;
let GEMINI_API_KEY;

// Se prioriza la configuración del entorno de Canvas a través de variables globales.
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  try {
    firebaseConfig = JSON.parse(__firebase_config);
  } catch (e) {
    console.error("Error parsing __firebase_config:", e);
  }
}

if (typeof __gemini_api_key !== 'undefined') {
    GEMINI_API_KEY = __gemini_api_key;
}

// Si las variables globales no existen, se usan valores de respaldo.
// Se elimina el console.warn para una consola más limpia.
if (!firebaseConfig) {
  firebaseConfig = {
   apiKey: "AIzaSyBgJN1vtmv7-cMKASPuXGTavw2CFz72ba4",
  authDomain: "fit-track-app-final.firebaseapp.com",
  projectId: "fit-track-app-final",
  storageBucket: "fit-track-app-final.firebasestorage.app",
  messagingSenderId: "319971791213",
  appId: "1:319971791213:web:6921580a6072b322694a64"
  };
}

// Reemplaza "YOUR_GEMINI_API_KEY_HERE" con tu clave de API si no usas variables de entorno.
if (!GEMINI_API_KEY) {
    GEMINI_API_KEY = "AIzaSyC91dOhzUbC4aber1rvZMtbkxpx8DxBbhw"; // REEMPLAZA ESTO CON TU GEMINI API KEY REAL
}


const app = initializeApp(firebaseConfig);
const appId = firebaseConfig.appId || (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id');


// --- SERVICIO CENTRALIZADO PARA LA API DE GEMINI ---
const parseJsonFromMarkdown = (text) => {
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    console.error("Original text from AI:", text);
    throw new Error("Respuesta JSON inválida o mal formada de la IA.");
  }
};

const callGeminiAPI = async (prompt, generationConfig = null) => {
  const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
  if (generationConfig) {
    payload.generationConfig = generationConfig;
  }
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API call failed response:", errorBody);
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  } else {
    console.error("Invalid response structure from API:", result);
    throw new Error("Respuesta inválida de la API");
  }
};


// --- COMPONENTES DE UI REUTILIZABLES ---

const Card = ({ children, className = '' }) => (
  <div className={`relative bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md transition-all duration-300 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, className = '', variant = 'primary', disabled = false, asLink = false, href = '#' }) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
    youtube: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  };
  
  if (asLink) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</a>;
  }
  
  return <button onClick={onClick} disabled={disabled} className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</button>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const DashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        <div className="h-60 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
        </div>
    </div>
);


// --- VISTAS PRINCIPALES DE LA APLICACIÓN ---

const Dashboard = ({ userData, dailyLog, completedWorkouts, setView, handleLogFood }) => {
  const [timeFilter, setTimeFilter] = useState('week');
  const [aiRecommendation, setAiRecommendation] = useState({ text: 'Obtén una recomendación de nutrición para tu entrenamiento de hoy.', loading: false });

  const today = new Date().toISOString().slice(0, 10);
  const defaultTodaysLog = { loggedFoods: [], water: 0, sleep: 0, morningRoutine: false };
  const todaysLog = { ...defaultTodaysLog, ...(dailyLog[today] || {}) };
  
  const getDayPlan = (date) => {
    const dayName = normalizeString(date.toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase());
    const plan = userData?.workoutSchedule?.[dayName] || [];
    const text = Array.isArray(plan) && plan.length > 0 ? plan.map(w => `${w.name} a las ${w.time}`).join(' y ') : 'Descanso';
    return { name: dayName, text: text };
  };

  const todayDate = new Date();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(todayDate.getDate() - 1);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(todayDate.getDate() + 1);

  const todaysPlan = getDayPlan(todayDate);
  const yesterdaysPlan = getDayPlan(yesterdayDate);
  const tomorrowsPlan = getDayPlan(tomorrowDate);

  // --- MEJORA: Lógica de recomendación mejorada ---
  const getAiRecommendation = async () => {
    if (!userData) return;
    setAiRecommendation({ text: 'Analizando tu día...', loading: true });

    try {
        // --- MEJORA: El clima ahora es más realista para el invierno ---
        const weather = "Día fresco de invierno, 12°C.";
        
        const objectivePrompt = userData.objectivePrompt || 'Mis objetivos son ganar masa muscular y mantenerme saludable.';
        
        // --- MEJORA: Prompt rediseñado para ser más conciso y natural ---
        const prompt = `
            Actúa como mi entrenador personal y nutricionista, con un tono amigable y motivador. Mi nombre es ${userData.name}.

            Aquí está mi contexto para hoy, ${todayDate.toLocaleDateString('es-ES', { dateStyle: 'full' })}:
            - **Mi objetivo principal:** ${objectivePrompt}.
            - **Ayer (${yesterdaysPlan.name}) entrené:** ${yesterdaysPlan.text}.
            - **Hoy (${todaysPlan.name}) mi plan es:** ${todaysPlan.text}.
            - **Mañana (${tomorrowsPlan.name}) entrenaré:** ${tomorrowsPlan.text}.
            - **El clima de hoy:** ${weather}.

            Basado en todo esto, dame un informe breve y conciso para mi día. **No uses numeración ni listados.** Integra naturalmente los siguientes puntos en uno o dos párrafos:
            - Una sugerencia rápida para la comida pre y post entrenamiento.
            - Un consejo clave sobre hidratación o suplementación relevante para hoy.
            - Finaliza con una frase motivadora.
        `;

        const recommendationText = await callGeminiAPI(prompt);
        setAiRecommendation({ text: recommendationText, loading: false });

    } catch (error) {
        console.error("Error fetching AI recommendation:", error);
        setAiRecommendation({ text: 'No se pudo obtener la recomendación. Intenta más tarde.', loading: false });
    }
  };

  const workoutSummary = useMemo(() => {
    const now = new Date();
    let startDate;

    if (timeFilter === 'week') {
      startDate = new Date(new Date().setDate(now.getDate() - 7));
    } else if (timeFilter === 'month') {
      startDate = new Date(new Date().setMonth(now.getMonth() - 1));
    } else { 
      startDate = new Date(new Date().setFullYear(now.getFullYear() - 1));
    }

    const filteredWorkouts = Array.isArray(completedWorkouts) ? completedWorkouts.filter(w => new Date(w.date) >= startDate) : [];
    
    const totalWorkouts = filteredWorkouts.length;
    const totalSets = filteredWorkouts.reduce((acc, w) => acc + (Array.isArray(w.exercises) ? w.exercises.reduce((exAcc, ex) => exAcc + (parseInt(ex.sets, 10) || 0), 0) : 0), 0);
    const totalReps = filteredWorkouts.reduce((acc, w) => acc + (Array.isArray(w.exercises) ? w.exercises.reduce((exAcc, ex) => exAcc + (parseInt(ex.reps, 10) || 0), 0) : 0), 0);

    return { totalWorkouts, totalSets, totalReps };
  }, [completedWorkouts, timeFilter]);

  if (!userData) {
    return <DashboardSkeleton />;
  }

  const totals = useMemo(() => {
    return (todaysLog.loggedFoods || []).reduce((acc, food) => {
      acc.calories += food.calories || 0;
      acc.protein += food.protein || 0;
      acc.carbs += food.carbs || 0;
      acc.fat += food.fat || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [todaysLog.loggedFoods]);

  const goals = userData.goals || { calories: 2500, protein: 180, carbs: 250, fat: 70 };
  const getProgress = (current, goal) => (goal > 0 ? (current / goal) * 100 : 0);
  
  const MacroProgress = ({ label, current, goal, color }) => (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{Math.round(current)} / {goal} g</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.min(getProgress(current, goal), 100)}%` }}></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
       <div className="mb-8">
            <h1 className="text-4xl font-bold">¡Hola, {userData?.name || 'Atleta'}!</h1>
            <p className="text-gray-500 dark:text-gray-400">¿Listo para hoy?</p>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="md:col-span-3 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-800 dark:text-white">Entrenamiento de Hoy</h3>
            {Array.isArray(todaysPlan.text.split(' y ')) && todaysPlan.text !== 'Descanso' ? (
                todaysPlan.text.split(' y ').map((p, i) => {
                    const parts = p.split(' a las ');
                    return (
                        <div key={i} className="flex justify-between items-baseline mt-4">
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{parts[0]}</p>
                            <p className="text-lg text-gray-500 dark:text-gray-400">{parts[1]}</p>
                        </div>
                    )
                })
            ) : (
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 my-4">Descanso</p>
            )}
          </div>
          <Button onClick={() => setView('ai-workout')} className="w-full mt-4">
            <Sparkles size={18}/> Iniciar Rutina con IA
          </Button>
        </Card>
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xl text-gray-800 dark:text-white">Recomendación del Día</h3>
            <p className={`mt-2 text-gray-600 dark:text-gray-300 whitespace-pre-wrap ${aiRecommendation.loading ? 'animate-pulse' : ''}`}>
              {aiRecommendation.text}
            </p>
          </div>
          <Button onClick={getAiRecommendation} disabled={aiRecommendation.loading} className="w-full mt-4">
            <Sparkles size={18}/> 
            {aiRecommendation.loading ? 'Analizando...' : 'Generar Informe'}
          </Button>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xl text-gray-800 dark:text-white">Resumen de Actividad</h3>
            <div className="flex gap-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                <button onClick={() => setTimeFilter('week')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'week' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Semana</button>
                <button onClick={() => setTimeFilter('month')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'month' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Mes</button>
                <button onClick={() => setTimeFilter('year')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'year' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Año</button>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
            <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{workoutSummary.totalWorkouts}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Entrenos</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{workoutSummary.totalSets}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Series</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{workoutSummary.totalReps}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Reps</p>
            </div>
        </div>
      </Card>
      
      <Card>
        <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-white">Macronutrientes</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" className="text-gray-200 dark:bg-gray-700" fill="none" stroke="currentColor" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" className="text-blue-500" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${getProgress(totals.calories, goals.calories)}, 100`} strokeLinecap="round" transform="rotate(90 18 18)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-800 dark:text-white">{Math.round(totals.calories)}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ {goals.calories} kcal</span>
            </div>
          </div>
          <div className="w-full sm:w-1/2 space-y-4">
            <MacroProgress label="Proteínas" current={totals.protein} goal={goals.protein} color="bg-red-500" />
            <MacroProgress label="Carbohidratos" current={totals.carbs} goal={goals.carbs} color="bg-yellow-500" />
            <MacroProgress label="Grasas" current={totals.fat} goal={goals.fat} color="bg-green-500" />
          </div>
        </div>
         <Button onClick={() => setView('food')} className="w-full mt-6">
            <PlusCircle size={18}/> Registrar Comida
        </Button>
      </Card>
    </div>
  );
};

const FoodLogger = ({ dailyLog, foodDatabase, handleLogFood, handleGoBack }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todaysLog = { loggedFoods: [], ...(dailyLog[today] || {}) };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState('desayuno');

    const handleOpenModal = (meal) => {
        setSelectedMeal(meal);
        setIsModalOpen(true);
    };

    const meals = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', snacks: 'Snacks' };
    const getFoodsForMeal = (meal) => (todaysLog.loggedFoods || []).filter(f => f.meal === meal);
    const removeFood = (foodToRemove) => handleLogFood(today, { loggedFoods: arrayRemove(foodToRemove) }, true);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Registro de Comidas</h2>
                <Button onClick={handleGoBack} variant="secondary">Volver</Button>
            </div>
            <div className="space-y-6">
                {Object.entries(meals).map(([key, name]) => (
                    <Card key={key}>
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-lg text-gray-700 dark:text-gray-200">{name}</h3>
                            <Button onClick={() => handleOpenModal(key)} variant="secondary" className="px-3 py-1 text-sm"> <PlusCircle size={16}/> Añadir </Button>
                        </div>
                        <ul className="space-y-2">
                            {getFoodsForMeal(key).length > 0 ? getFoodsForMeal(key).map((food, index) => (
                                <li key={`${food.foodId}-${index}`} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-100">{food.foodName}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{food.quantity}g - {Math.round(food.calories)} kcal</p>
                                    </div>
                                    <button onClick={() => removeFood(food)} className="text-red-500 hover:text-red-700"> <Trash2 size={18}/> </button>
                                </li>
                            )) : <p className="text-sm text-gray-400 dark:text-gray-500 italic">No hay comidas registradas.</p>}
                        </ul>
                    </Card>
                ))}
            </div>
            <AddFoodModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} foodDatabase={foodDatabase} handleLogFood={handleLogFood} mealType={selectedMeal} today={today} />
        </div>
    );
};

const AddFoodModal = ({ isOpen, onClose, foodDatabase, handleLogFood, mealType, today }) => {
    const [selectedFoodId, setSelectedFoodId] = useState('');
    const [quantity, setQuantity] = useState(100);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (Array.isArray(foodDatabase) && foodDatabase.length > 0 && !selectedFoodId) {
            setSelectedFoodId(foodDatabase[0].id);
        }
    }, [foodDatabase, selectedFoodId]);

    const filteredFoodDatabase = useMemo(() => (foodDatabase || []).filter(food => food.name.toLowerCase().includes(searchTerm.toLowerCase())), [foodDatabase, searchTerm]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const foodData = foodDatabase.find(f => f.id === selectedFoodId);
        if (foodData) {
            const ratio = quantity / 100;
            const logEntry = {
                foodId: foodData.id, foodName: foodData.name, quantity: Number(quantity), meal: mealType,
                calories: (foodData.calories_per_100g || 0) * ratio, protein: (foodData.protein_per_100g || 0) * ratio,
                carbs: (foodData.carbs_per_100g || 0) * ratio, fat: (foodData.fat_per_100g || 0) * ratio,
            };
            handleLogFood(today, { loggedFoods: arrayUnion(logEntry) }, true);
            setQuantity(100); setSearchTerm(''); onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Añadir a ${mealType}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar Alimento</label>
                    <input type="text" id="search" placeholder="Ej: Pollo, Arroz..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
                </div>
                <div>
                    <label htmlFor="food" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seleccionar Alimento</label>
                    <select id="food" value={selectedFoodId} onChange={(e) => setSelectedFoodId(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
                        {Array.isArray(filteredFoodDatabase) && filteredFoodDatabase.map(food => (<option key={food.id} value={food.id}>{food.name}</option>))}
                    </select>
                </div>
                <div>
                    <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad (gramos)</label>
                    <input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" onClick={onClose} variant="secondary">Cancelar</Button>
                    <Button type="submit">Añadir</Button>
                </div>
            </form>
        </Modal>
    );
};

const ProgressTracker = ({ weightHistory, bodyMeasurements, handleAddWeight, handleAddMeasurements, handleGoBack }) => {
    const [newWeight, setNewWeight] = useState('');
    const [newMeasurements, setNewMeasurements] = useState({
        arms: '', forearms: '', back: '', core: '', quads: '', calves: ''
    });
    const [chartView, setChartView] = useState('weight');

    const measurementLabels = {
        weight: 'Peso Corporal (kg)', arms: 'Brazos (cm)', forearms: 'Antebrazos (cm)',
        back: 'Espalda (cm)', core: 'Core (cm)', quads: 'Cuádriceps (cm)', calves: 'Pantorrillas (cm)'
    };

    const chartData = useMemo(() => {
        if (chartView === 'weight') {
            return weightHistory;
        }
        return Array.isArray(bodyMeasurements) ? bodyMeasurements.map(m => ({
            date: m.date,
            [chartView]: m[chartView]
        })).filter(item => item[chartView] !== undefined) : [];
    }, [chartView, weightHistory, bodyMeasurements]);

    const onAddWeight = () => {
        if (newWeight && !isNaN(newWeight)) {
            handleAddWeight(parseFloat(newWeight));
            setNewWeight('');
        }
    };

    const handleMeasurementChange = (e) => {
        setNewMeasurements({ ...newMeasurements, [e.target.name]: e.target.value });
    };

    const onAddMeasurements = () => {
        const measurementsWithNumbers = Object.entries(newMeasurements).reduce((acc, [key, value]) => {
            if (value && !isNaN(value)) {
                acc[key] = parseFloat(value);
            }
            return acc;
        }, {});

        if (Object.keys(measurementsWithNumbers).length > 0) {
            handleAddMeasurements(measurementsWithNumbers);
            setNewMeasurements({ arms: '', forearms: '', back: '', core: '', quads: '', calves: '' });
        }
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Seguimiento de Progreso</h2>
          <Button onClick={handleGoBack} variant="secondary">Volver</Button>
        </div>
        <Card className="mb-6">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-xl text-gray-800 dark:text-white">Evolución Corporal</h3>
                 <select value={chartView} onChange={(e) => setChartView(e.target.value)} className="p-2 bg-gray-100 dark:bg-gray-700 border rounded-lg">
                    {Object.entries(measurementLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                 </select>
            </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} fontSize={12}/>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', borderColor: '#4B5563', borderRadius: '0.75rem', color: '#ffffff' }} />
                  <Legend />
                  <Line type="monotone" dataKey={chartView} name={measurementLabels[chartView]} stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
               <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Registrar Nuevo Peso</h3>
               <div className="flex gap-4">
                 <input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Ej: 85.5" className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded-lg" />
                 <Button onClick={onAddWeight}>Registrar</Button>
               </div>
            </Card>
            <Card>
               <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Registrar Nuevas Medidas (cm)</h3>
               <div className="grid grid-cols-2 gap-3">
                    {Object.keys(newMeasurements).map(key => (
                        <input key={key} type="number" name={key} value={newMeasurements[key]} onChange={handleMeasurementChange} placeholder={key.charAt(0).toUpperCase() + key.slice(1)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded-lg" />
                    ))}
               </div>
               <Button onClick={onAddMeasurements} className="w-full mt-4">Registrar Medidas</Button>
            </Card>
        </div>
      </div>
    );
};

const HabitsTracker = ({ dailyLog, handleUpdateHabit }) => {
    const habits = [
        { id: 'morningRoutine', label: 'Rutina Mañana', icon: <CheckCircle /> },
        { id: 'water', label: 'Agua (vasos)', icon: <Droplet /> },
        { id: 'sleep', label: 'Sueño (hs)', icon: <Bed /> },
    ];

    return (
        <div className="space-y-4">
            {habits.map(habit => (
                <div key={habit.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">{habit.icon}<span>{habit.label}</span></div>
                    {habit.id === 'morningRoutine' ? (
                        <input type="checkbox" checked={dailyLog[habit.id] || false} onChange={(e) => handleUpdateHabit(habit.id, e.target.checked)} className="w-6 h-6 rounded text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                    ) : (
                        <input type="number" value={dailyLog[habit.id] || 0} onChange={(e) => handleUpdateHabit(habit.id, Number(e.target.value))} className="w-20 p-1 text-center bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
                    )}
                </div>
            ))}
        </div>
    );
};

const FoodDatabaseManager = ({ foodDatabase, handleAddFood, handleDeleteFood, handleGoBack }) => {
    const [name, setName] = useState('');
    const [calories, setCalories] = useState('');
    const [protein, setProtein] = useState('');
    const [carbs, setCarbs] = useState('');
    const [fat, setFat] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if(name && calories && protein && carbs && fat) {
            handleAddFood({ name, calories_per_100g: parseFloat(calories), protein_per_100g: parseFloat(protein), carbs_per_100g: parseFloat(carbs), fat_per_100g: parseFloat(fat) });
            setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Alimentos</h2><Button onClick={handleGoBack} variant="secondary">Volver</Button></div>
            <Card className="mb-6">
                <h3 className="font-bold text-lg mb-3">Añadir Nuevo Alimento</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="p-2 bg-gray-100 dark:bg-gray-700 border rounded col-span-2 md:col-span-1" />
                    <input value={calories} onChange={e => setCalories(e.target.value)} type="number" placeholder="Kcal/100g" className="p-2 bg-gray-100 dark:bg-gray-700 border rounded" />
                    <input value={protein} onChange={e => setProtein(e.target.value)} type="number" placeholder="Prot/100g" className="p-2 bg-gray-100 dark:bg-gray-700 border rounded" />
                    <input value={carbs} onChange={e => setCarbs(e.target.value)} type="number" placeholder="Carbs/100g" className="p-2 bg-gray-100 dark:bg-gray-700 border rounded" />
                    <input value={fat} onChange={e => setFat(e.target.value)} type="number" placeholder="Grasa/100g" className="p-2 bg-gray-100 dark:bg-gray-700 border rounded" />
                    <Button type="submit" className="h-10">Añadir</Button>
                </form>
            </Card>
            <Card>
                 <h3 className="font-bold text-lg mb-3">Alimentos Guardados</h3>
                 <ul className="space-y-2 max-h-96 overflow-y-auto">{Array.isArray(foodDatabase) && foodDatabase.map(food => (<li key={food.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md"><span>{food.name}</span><button onClick={() => handleDeleteFood(food.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button></li>))}</ul>
            </Card>
        </div>
    );
};

const AppSettings = ({ user, userData, handleLinkAccount, handleLogin, handleRegister, handleLogout, handleUpdateGoals, handleUpdateObjective }) => {
    const [authMode, setAuthMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [goals, setGoals] = useState(userData?.goals || { calories: 2500, protein: 180, carbs: 250, fat: 70 });
    const [objectivePrompt, setObjectivePrompt] = useState(userData?.objectivePrompt || '');
    
    const [objectiveSaveStatus, setObjectiveSaveStatus] = useState('idle'); // 'idle', 'saving', 'saved'

    useEffect(() => {
        if (userData?.goals) setGoals(userData.goals);
        if (userData?.name && !user.isAnonymous) setName(userData.name);
        if (userData?.objectivePrompt) setObjectivePrompt(userData.objectivePrompt);
    }, [userData, user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (authMode === 'register') {
                await handleRegister(email, password, name);
            } else {
                await handleLogin(email, password);
            }
        } catch (err) {
            if (err.code === 'auth/operation-not-allowed') {
                setError('Error: El inicio de sesión con Email/Contraseña no está habilitado en la configuración de Firebase.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('El email ya está en uso por otra cuenta.');
            } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('Email o contraseña incorrectos.');
            }
            else {
                setError(err.message);
            }
        }
    };

    const handleGoalsSubmit = (e) => {
        e.preventDefault();
        handleUpdateGoals(goals);
    };

    const handleObjectiveSubmit = async (e) => {
        e.preventDefault();
        setObjectiveSaveStatus('saving');
        try {
            await handleUpdateObjective(objectivePrompt);
            setObjectiveSaveStatus('saved');
            setTimeout(() => setObjectiveSaveStatus('idle'), 2000);
        } catch (error) {
            console.error("Error saving objective prompt:", error);
            setObjectiveSaveStatus('idle');
        }
    };

    if (user && user.isAnonymous) {
        return (
            <Card>
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                    <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 font-semibold ${authMode === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Iniciar Sesión</button>
                    <button onClick={() => setAuthMode('register')} className={`flex-1 py-2 font-semibold ${authMode === 'register' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Registrarse</button>
                </div>
                <h2 className="text-2xl font-bold text-center mb-2">{authMode === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                    {authMode === 'register' ? 'Crea una cuenta para guardar tus datos y acceder desde cualquier dispositivo.' : 'Inicia sesión para ver tu progreso guardado.'}
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {authMode === 'register' && (
                        <div>
                            <label className="block text-sm font-medium">Nombre</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" required />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Contraseña</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" required />
                    </div>
                    {error && <p className="text-red-500 text-sm p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">{error}</p>}
                    <Button type="submit" className="w-full">{authMode === 'register' ? 'Registrarse' : 'Iniciar Sesión'}</Button>
                </form>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <h2 className="text-2xl font-bold mb-4">Hola, {userData?.name || user?.email}</h2>
                <p className="text-gray-600 dark:text-gray-400">Email: {user?.email}</p>
                <Button onClick={handleLogout} variant="danger" className="w-full mt-6">
                    <LogOut size={18} /> Cerrar Sesión
                </Button>
            </Card>
            
            <Card>
                <form onSubmit={handleObjectiveSubmit} className="space-y-4">
                    <h3 className="font-bold text-lg mb-2">Objetivos para la IA</h3>
                    <div>
                        <label htmlFor="objectivePrompt" className="block text-sm font-medium text-gray-600 dark:text-gray-300">Describe tus metas principales (ej: ganar masa muscular, perder peso, mejorar resistencia, etc.)</label>
                        <textarea 
                            id="objectivePrompt"
                            value={objectivePrompt} 
                            onChange={e => setObjectivePrompt(e.target.value)} 
                            className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" 
                            rows="3"
                        />
                    </div>
                    <div className="pt-2">
                        <Button type="submit" className="w-full" disabled={objectiveSaveStatus === 'saving'}>
                            {objectiveSaveStatus === 'idle' && 'Guardar Prompt'}
                            {objectiveSaveStatus === 'saving' && 'Guardando...'}
                            {objectiveSaveStatus === 'saved' && '¡Guardado!'}
                        </Button>
                    </div>
                </form>
            </Card>

            <Card>
                <form onSubmit={handleGoalsSubmit} className="space-y-4">
                    <h3 className="font-bold text-lg mb-2">Objetivos Nutricionales Diarios</h3>
                    <div><label className="block text-sm font-medium">Calorías (kcal)</label><input type="number" name="calories" value={goals.calories} onChange={e => setGoals({...goals, calories: parseFloat(e.target.value)})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Proteínas (g)</label><input type="number" name="protein" value={goals.protein} onChange={e => setGoals({...goals, protein: parseFloat(e.target.value)})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Carbohidratos (g)</label><input type="number" name="carbs" value={goals.carbs} onChange={e => setGoals({...goals, carbs: parseFloat(e.target.value)})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Grasas (g)</label><input type="number" name="fat" value={goals.fat} onChange={e => setGoals({...goals, fat: parseFloat(e.target.value)})} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div className="pt-2"><Button type="submit" className="w-full">Guardar Objetivos</Button></div>
                </form>
            </Card>
        </div>
    );
};

const WorkoutPlanner = ({ userData, handleUpdateSchedule, handleUpdateWorkoutOptions, handleGoBack }) => {
    if (!userData) { return <Card><p>Cargando plan...</p></Card>; }

    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const [schedule, setSchedule] = useState(userData.workoutSchedule || {});
    const [workoutOptions, setWorkoutOptions] = useState(userData.workoutOptions || []);
    const [newOption, setNewOption] = useState('');
    const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved

    useEffect(() => {
        setSchedule(userData.workoutSchedule || {});
    }, [userData.workoutSchedule]);

    const handleScheduleChange = (day, index, field, value) => {
        const newSchedule = JSON.parse(JSON.stringify(schedule));
        if(newSchedule[day] && newSchedule[day][index]) {
            newSchedule[day][index][field] = value;
            setSchedule(newSchedule);
        }
    };
    
    const addWorkoutToDay = (day) => {
        const newSchedule = JSON.parse(JSON.stringify(schedule));
        if (!newSchedule[day] || !Array.isArray(newSchedule[day])) {
            newSchedule[day] = [];
        }
        const defaultWorkoutName = workoutOptions.find(opt => opt !== 'Descanso') || 'Descanso';
        newSchedule[day].push({ time: '12:00', name: defaultWorkoutName });
        setSchedule(newSchedule);
    };

    const removeWorkoutFromDay = (day, index) => {
        const newSchedule = JSON.parse(JSON.stringify(schedule));
        if (newSchedule[day] && Array.isArray(newSchedule[day])) {
           newSchedule[day].splice(index, 1);
           setSchedule(newSchedule);
        }
    };

    const handleAddNewOption = () => {
        if (newOption && !workoutOptions.includes(newOption)) {
            const newOptionsList = [...workoutOptions, newOption];
            setWorkoutOptions(newOptionsList);
            handleUpdateWorkoutOptions(newOptionsList);
            setNewOption('');
        }
    };

    const handleSaveChanges = async () => {
        setSaveStatus('saving');
        try {
            await handleUpdateSchedule(schedule);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error("Error saving schedule:", error);
            setSaveStatus('idle');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Plan Semanal</h2>
                <Button onClick={handleGoBack} variant="secondary">Volver</Button>
            </div>
            
            <Card className="mb-6">
                <h3 className="font-bold text-lg mb-3">Mis Tipos de Ejercicio</h3>
                <div className="flex gap-2 mb-4">
                    <input 
                        value={newOption} 
                        onChange={e => setNewOption(e.target.value)} 
                        placeholder="Ej: Yoga, Crossfit" 
                        className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded"
                    />
                    <Button onClick={handleAddNewOption}><PlusCircle size={18}/></Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Array.isArray(workoutOptions) && workoutOptions.map(opt => <span key={opt} className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">{opt}</span>)}
                </div>
            </Card>

            <div className="space-y-4">
                {days.map(day => (
                    <Card key={day}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="capitalize font-bold text-xl text-gray-700 dark:text-gray-200">{day}</h3>
                             <Button onClick={() => addWorkoutToDay(day)} variant="secondary" className="px-3 py-1 text-sm"><PlusCircle size={16}/> Añadir Sesión</Button>
                        </div>
                        <div className="space-y-3">
                           {(!schedule[day] || !Array.isArray(schedule[day]) || schedule[day].length === 0) && <p className="text-sm text-gray-400 dark:text-gray-500 italic">Día de descanso.</p>}
                           {Array.isArray(schedule[day]) && schedule[day].map((workout, index) => (
                                <div key={index} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <input 
                                        type="time" 
                                        value={workout.time} 
                                        onChange={(e) => handleScheduleChange(day, index, 'time', e.target.value)} 
                                        className="p-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm"
                                    />
                                    <select 
                                        value={workout.name} 
                                        onChange={(e) => handleScheduleChange(day, index, 'name', e.target.value)} 
                                        className="w-full p-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm"
                                    >
                                        {Array.isArray(workoutOptions) && workoutOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <button onClick={() => removeWorkoutFromDay(day, index)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18}/></button>
                                </div>
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
             <Button onClick={handleSaveChanges} disabled={saveStatus === 'saving'} className="w-full mt-6">
                {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Plan Semanal'}
            </Button>
        </div>
    );
};

const Timer = ({ title, initialSeconds = 0, direction = 'up', onTimeSet }) => {
    const [seconds, setSeconds] = useState(initialSeconds);
    const [isActive, setIsActive] = useState(false);
    const [inputSeconds, setInputSeconds] = useState(initialSeconds);
    const timerRef = useRef(null);

    useEffect(() => {
        setSeconds(initialSeconds);
        setInputSeconds(initialSeconds);
    }, [initialSeconds]);

    useEffect(() => {
        if (isActive) {
            timerRef.current = setInterval(() => {
                if (direction === 'down') {
                    setSeconds(prev => {
                        if (prev > 0) {
                            return prev - 1;
                        } else {
                            clearInterval(timerRef.current);
                            setIsActive(false);
                            return 0;
                        }
                    });
                } else {
                    setSeconds(prev => prev + 1);
                }
            }, 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isActive, direction]);

    const toggleTimer = () => setIsActive(!isActive);
    const resetTimer = () => {
        setIsActive(false);
        setSeconds(initialSeconds);
    };
    
    const handleTimeChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setInputSeconds(isNaN(value) ? 0 : value);
    };
    
    const handleSetTime = () => {
        if(onTimeSet) {
            onTimeSet(inputSeconds);
        }
    };

    const formatTime = (timeInSeconds) => {
        const mins = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
        const secs = (timeInSeconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const isFinished = direction === 'down' && seconds === 0 && !isActive;

    return (
        <div className={`p-4 rounded-lg text-center transition-colors duration-300 ${isFinished ? 'bg-green-100 dark:bg-green-900/50' : 'bg-gray-100 dark:bg-gray-700/50'}`}>
            <div className="flex justify-center items-center gap-4 mb-2">
                 <h4 className="font-semibold text-gray-700 dark:text-gray-300">{title}</h4>
                 {direction === 'down' && (
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={inputSeconds}
                            onChange={handleTimeChange}
                            className="w-20 p-1 text-center bg-white dark:bg-gray-600 border rounded-md"
                        />
                        <Button onClick={handleSetTime} variant="secondary" className="px-2 py-1 text-xs">Set</Button>
                    </div>
                 )}
            </div>
            <p className="font-mono text-5xl font-bold my-2 text-gray-900 dark:text-white">{formatTime(seconds)}</p>
            <div className="flex justify-center gap-3">
                <Button onClick={toggleTimer} variant="primary" className="w-28">
                    {isActive ? <Pause size={18} /> : <Play size={18} />}
                    {isActive ? 'Pausar' : 'Iniciar'}
                </Button>
                <Button onClick={resetTimer} variant="secondary">
                    <RotateCcw size={18} />
                    Reset
                </Button>
            </div>
             {isFinished && <p className="text-green-600 dark:text-green-400 font-semibold mt-2 animate-pulse">¡A entrenar!</p>}
        </div>
    );
};

const AiWorkoutGeneratorView = ({ userData, completedWorkouts, handleGoBack, handleSaveWorkout, routine, setRoutine, handleToggleFavorite }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fatigueLevel, setFatigueLevel] = useState('normal');
    const [userNotes, setUserNotes] = useState('');
    const [restTime, setRestTime] = useState(90);
    const [recalculatingIndex, setRecalculatingIndex] = useState(null);

    const getWorkoutSuggestion = async () => {
        setIsLoading(true);
        setRoutine([]);
        setError('');

        const historySummary = Array.isArray(completedWorkouts) ? completedWorkouts.slice(0, 5).map(w => `El ${new Date(w.date).toLocaleDateString('es-ES')} hice: ${Array.isArray(w.exercises) ? w.exercises.map(e => e.name).join(', ') : ''}`).join('; ') : '';
        const todayDay = new Date().toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const todayWorkouts = (userData.workoutSchedule && Array.isArray(userData.workoutSchedule[todayDay])) ? userData.workoutSchedule[todayDay] : [];
        const todayWorkoutText = todayWorkouts.length > 0 ? todayWorkouts.map(w => w.name).join(' y ') : 'Descanso';
        const favoriteExercisesText = Array.isArray(userData.favoriteExercises) && userData.favoriteExercises.length > 0 ? `Mis ejercicios favoritos son: ${userData.favoriteExercises.join(', ')}. Intenta incluirlos si son apropiados.` : '';
        
        const objectivePromptText = userData.objectivePrompt || 'Mis objetivos son ganar masa muscular y mantenerme saludable.';

        const prompt = `Hola, soy ${userData.name}. ${objectivePromptText}
            Mi plan para hoy es: ${todayWorkoutText}.
            Sin embargo, para la sesión de hoy tengo estas notas específicas: "${userNotes || 'Ninguna'}".
            Por favor, prioriza mis notas si entran en conflicto con el plan del calendario. Por ejemplo, si el plan dice "Piernas" pero mis notas dicen "quiero enfocarme en hombros", genera una rutina de hombros.
            Mi nivel de energía hoy es: ${fatigueLevel}.
            Mi historial reciente es: ${historySummary || 'ninguno'}.
            ${favoriteExercisesText}
            
            Basado en toda esta información, y especialmente en mi historial para asegurar una buena rotación y evitar sobreentrenamiento, genera una rutina detallada para hoy.
            IMPORTANTE: Responde SIEMPRE en español. Para cada ejercicio, proporciona: name, sets, reps, weight, videoSearchQuery, estimatedDuration, difficultyLevel, equipment y caloriesBurned.`;
        
        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    routine: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                name: { type: "STRING" }, sets: { type: "STRING" }, reps: { type: "STRING" },
                                weight: { type: "STRING" }, videoSearchQuery: { type: "STRING" },
                                estimatedDuration: { type: "STRING" }, difficultyLevel: { type: "STRING" },
                                equipment: { type: "STRING" }, caloriesBurned: { type: "STRING" }
                            },
                             required: ["name", "sets", "reps", "weight", "videoSearchQuery", "estimatedDuration", "difficultyLevel", "equipment", "caloriesBurned"]
                        }
                    }
                }
            }
        };

        try {
            const resultText = await callGeminiAPI(prompt, generationConfig);
            const parsedJson = parseJsonFromMarkdown(resultText);
            const editableRoutine = (parsedJson.routine || []).map(ex => ({ ...ex, completed: false }));
            setRoutine(editableRoutine);
            if (!parsedJson.routine || parsedJson.routine.length === 0) {
                setError("La IA no pudo generar una rutina esta vez. Inténtalo de nuevo.");
            }
        } catch (err) {
            setError(`Ocurrió un error al contactar al asistente de IA. Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- SOLUCIÓN ERROR 429: Recálculo de calorías manual ---
    const handleRecalculateCalories = async (exerciseIndex) => {
        setRecalculatingIndex(exerciseIndex);
        const exercise = routine[exerciseIndex];
        const prompt = `Por favor, recalcula las calorías quemadas para el siguiente ejercicio basado en los nuevos datos:
        - Ejercicio: ${exercise.name}
        - Series: ${exercise.sets}
        - Repeticiones: ${exercise.reps}
        - Peso: ${exercise.weight}
        Responde únicamente con el nuevo valor de calorías quemadas (ej: "60-80 kcal").`;

        try {
            const newCalories = await callGeminiAPI(prompt);
            const updatedRoutine = [...routine];
            updatedRoutine[exerciseIndex].caloriesBurned = newCalories.trim();
            setRoutine(updatedRoutine);
        } catch (error) {
            console.error("Error recalculating calories:", error);
        } finally {
            setRecalculatingIndex(null);
        }
    };

    const handleExerciseUpdate = (index, field, value) => {
        const updatedRoutine = [...routine];
        updatedRoutine[index][field] = value;
        setRoutine(updatedRoutine);
    };

    const handleToggleComplete = (index) => {
        const updatedRoutine = [...routine];
        updatedRoutine[index].completed = !updatedRoutine[index].completed;
        setRoutine(updatedRoutine);
    };

    const handleDeleteExercise = (indexToDelete) => {
        const updatedRoutine = routine.filter((_, index) => index !== indexToDelete);
        setRoutine(updatedRoutine);
    };

    const handleFinishAndSave = () => {
        handleSaveWorkout(routine);
        setRoutine([]);
        handleGoBack();
    };

    const totalCaloriesBurned = useMemo(() => {
        return Array.isArray(routine) ? routine.reduce((total, exercise) => {
            const calString = exercise.caloriesBurned || "0";
            const numbers = calString.match(/\d+/g);
            if (!numbers) return total;
            
            if (numbers.length > 1) {
                return total + (parseInt(numbers[0], 10) + parseInt(numbers[1], 10)) / 2;
            } else if (numbers.length === 1) {
                return total + parseInt(numbers[0], 10);
            }
            return total;
        }, 0) : 0;
    }, [routine]);

    const inputClasses = "w-full p-1 mt-1 rounded bg-transparent border-transparent focus:bg-gray-100 dark:focus:bg-gray-700 focus:border-gray-300 dark:focus:border-gray-600 focus:ring-1 focus:ring-blue-500 transition-all";

    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-white">Generador de Rutina con IA</h2><Button onClick={handleGoBack} variant="secondary">Volver</Button></div>
            
            {routine.length === 0 && (
                <Card>
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg text-center">¡Personaliza tu rutina de hoy!</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1">¿Cómo te sientes de energía hoy?</label>
                            <select value={fatigueLevel} onChange={(e) => setFatigueLevel(e.target.value)} className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded">
                                <option value="baja">Baja energía</option>
                                <option value="normal">Normal</option>
                                <option value="alta">Mucha energía</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Notas para el entrenador IA (opcional)</label>
                            <textarea value={userNotes} onChange={(e) => setUserNotes(e.target.value)} placeholder="Ej: quiero enfocarme en hombros..." className="w-full p-2 bg-gray-100 dark:bg-gray-700 border rounded" rows="2"></textarea>
                        </div>
                        <Button onClick={getWorkoutSuggestion} disabled={isLoading} className="w-full">
                            <Sparkles size={18}/>
                            {isLoading ? 'Generando tu rutina...' : 'Generar Rutina de Hoy'}
                        </Button>
                    </div>
                </Card>
            )}

            {isLoading && <div className="mt-6 text-center p-4"><p className="animate-pulse text-lg">El entrenador IA está preparando tu sesión...</p></div>}
            {error && <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {Array.isArray(routine) && routine.length > 0 && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-xl font-bold text-center">Tu Rutina de Hoy</h3>
                    <Card>
                        <div className="flex justify-between items-center">
                            <Timer title="Cronómetro General" direction="up" />
                            <div className="text-center px-4">
                                <p className="font-semibold text-gray-700 dark:text-gray-300">Calorías Totales (Est.)</p>
                                <p className="font-mono text-4xl font-bold text-orange-500">{Math.round(totalCaloriesBurned)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">kcal</p>
                            </div>
                        </div>
                    </Card>

                    {routine.map((exercise, index) => {
                        const isFavorite = userData.favoriteExercises?.includes(exercise.name);
                        return (
                        <React.Fragment key={index}>
                            <Card className={`border-2 ${exercise.completed ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent'}`}>
                                <button onClick={() => handleToggleFavorite(exercise.name)} className="absolute top-2 left-2 text-gray-400 hover:text-yellow-400 transition-colors z-10" aria-label="Marcar como favorito">
                                    <Star size={20} className={isFavorite ? "text-yellow-400 fill-current" : ""} />
                                </button>
                                <button
                                    onClick={() => handleDeleteExercise(index)}
                                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                                    aria-label="Eliminar ejercicio"
                                >
                                    <X size={18} />
                                </button>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-6">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400">{exercise.name}</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                            <div>
                                                <label className="text-xs font-medium">Series</label>
                                                {/* --- SOLUCIÓN ERROR 429: Se elimina `onBlur` --- */}
                                                <input type="text" value={exercise.sets} onChange={(e) => handleExerciseUpdate(index, 'sets', e.target.value)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium">Reps</label>
                                                {/* --- SOLUCIÓN ERROR 429: Se elimina `onBlur` --- */}
                                                <input type="text" value={exercise.reps} onChange={(e) => handleExerciseUpdate(index, 'reps', e.target.value)} className={inputClasses} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium">Peso (kg)</label>
                                                {/* --- SOLUCIÓN ERROR 429: Se elimina `onBlur` --- */}
                                                <input type="text" value={exercise.weight} onChange={(e) => handleExerciseUpdate(index, 'weight', e.target.value)} className={inputClasses} />
                                            </div>
                                             <div>
                                                <label className="text-xs font-medium">Equipo</label>
                                                <select value={exercise.equipment} onChange={(e) => handleExerciseUpdate(index, 'equipment', e.target.value)} className={inputClasses}>
                                                    <option>Mancuerna</option>
                                                    <option>Barra</option>
                                                    <option>Peso Corporal</option>
                                                    <option>Máquina</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                                            <span className={`flex items-center gap-1 ${recalculatingIndex === index ? 'animate-pulse' : ''}`}>
                                                <Flame size={16} className="text-orange-500"/> {exercise.caloriesBurned}
                                            </span>
                                            {/* --- SOLUCIÓN ERROR 429: Botón para recalcular manualmente --- */}
                                            <Button onClick={() => handleRecalculateCalories(index)} variant="secondary" className="px-2 py-1 text-xs" disabled={recalculatingIndex === index}>
                                                <RotateCcw size={14}/>
                                                {recalculatingIndex === index ? '...' : 'Actualizar'}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-auto flex flex-col gap-2 mt-2 sm:mt-0">
                                        <Button onClick={() => handleToggleComplete(index)} variant={exercise.completed ? 'secondary' : 'success'} className="w-full">
                                            <Check size={18} /> {exercise.completed ? 'Deshacer' : 'Terminado'}
                                        </Button>
                                        <Button asLink={true} href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoSearchQuery)}`} variant="youtube" className="w-full">
                                            <Youtube size={18} /> Ver Video
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {index < routine.length - 1 && (
                                <div className="max-w-md mx-auto w-full">
                                    <Card>
                                        <Timer title="Descanso" initialSeconds={restTime} onTimeSet={setRestTime} direction="down" />
                                    </Card>
                                </div>
                            )}
                        </React.Fragment>
                    )})}
                    <Button onClick={handleFinishAndSave} variant="primary" className="w-full mt-4">
                        <CheckCircle size={20} /> Finalizar y Guardar Rutina
                    </Button>
                </div>
            )}
        </div>
    );
};

const HistoryTracker = ({ completedWorkouts, handleGoBack }) => {
    const [timeFilter, setTimeFilter] = useState('week');
    const [muscleData, setMuscleData] = useState([]);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    const filteredWorkouts = useMemo(() => {
        const now = new Date();
        let startDate;
        if (timeFilter === 'day') {
            startDate = new Date(now.setHours(0, 0, 0, 0));
        } else if (timeFilter === 'week') {
            startDate = new Date(new Date().setDate(now.getDate() - 7));
        } else { // month
            startDate = new Date(new Date().setMonth(now.getMonth() - 1));
        }
        return Array.isArray(completedWorkouts) ? completedWorkouts.filter(w => new Date(w.date) >= startDate) : [];
    }, [completedWorkouts, timeFilter]);

    const handleAnalyzeMuscles = async () => {
        if (filteredWorkouts.length === 0) {
            setMuscleData([]);
            return;
        }
        setLoadingAnalysis(true);
        const exerciseNames = [...new Set(filteredWorkouts.flatMap(w => (Array.isArray(w.exercises) ? w.exercises.map(e => e.name) : [])))];
        const prompt = `Para la siguiente lista de ejercicios, devuelve el principal grupo muscular trabajado para cada uno. Responde con un objeto JSON donde la clave es el nombre del ejercicio y el valor es el grupo muscular (ej: "Pecho", "Espalda", "Piernas", "Brazos", "Hombros", "Core"). Ejercicios: ${exerciseNames.join(', ')}`;
        
        try {
            const resultText = await callGeminiAPI(prompt);
            const muscleMap = parseJsonFromMarkdown(resultText);

            const muscleCounts = {};
            filteredWorkouts.forEach(workout => {
                (Array.isArray(workout.exercises) ? workout.exercises : []).forEach(exercise => {
                    const muscle = muscleMap[exercise.name] || 'Otro';
                    if (!muscleCounts[muscle]) {
                        muscleCounts[muscle] = 0;
                    }
                    muscleCounts[muscle] += parseInt(exercise.sets, 10) || 0;
                });
            });

            setMuscleData(Object.entries(muscleCounts).map(([name, sets]) => ({ name, sets })));

        } catch (error) {
            console.error("Error analyzing muscles:", error);
            setMuscleData([]);
        } finally {
            setLoadingAnalysis(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Historial de Entrenamientos</h2>
                <Button onClick={handleGoBack} variant="secondary">Volver</Button>
            </div>

            <Card className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white">Análisis Muscular</h3>
                    <div className="flex gap-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
                        <button onClick={() => setTimeFilter('day')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'day' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Día</button>
                        <button onClick={() => setTimeFilter('week')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'week' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Semana</button>
                        <button onClick={() => setTimeFilter('month')} className={`px-2 py-1 text-xs rounded-md ${timeFilter === 'month' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>Mes</button>
                    </div>
                </div>
                <div className="mb-4">
                    <Button onClick={handleAnalyzeMuscles} disabled={loadingAnalysis} className="w-full">
                        {loadingAnalysis ? 'Analizando...' : 'Analizar Músculos Trabajados'}
                    </Button>
                </div>
                {loadingAnalysis && <p className="text-center animate-pulse">Analizando...</p>}
                {muscleData.length > 0 && !loadingAnalysis && (
                    <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={muscleData}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', borderColor: '#4B5563', borderRadius: '0.75rem', color: '#ffffff' }}/>
                                <Bar dataKey="sets" name="Series totales" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </Card>

            <div className="space-y-4">
                {Array.isArray(filteredWorkouts) && filteredWorkouts.map(workout => (
                    <Card key={workout.id}>
                        <h3 className="font-bold text-lg mb-2">{new Date(workout.date).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}</h3>
                        <ul className="space-y-1">
                            {(Array.isArray(workout.exercises) ? workout.exercises : []).map((ex, i) => (
                                <li key={i} className="text-sm text-gray-600 dark:text-gray-300">
                                    - {ex.name}: {ex.sets} series de {ex.reps} reps con {ex.weight}.
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL DE LA APP ---
export default function App() {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [firebaseServices, setFirebaseServices] = useState(null);
    const [user, setUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [isDarkMode, setIsDarkMode] = useState(true);

    const [userData, setUserData] = useState(null); 
    const [dailyLog, setDailyLog] = useState({});
    const [weightHistory, setWeightHistory] = useState([]);
    const [foodDatabase, setFoodDatabase] = useState([]);
    const [bodyMeasurements, setBodyMeasurements] = useState([]);
    const [completedWorkouts, setCompletedWorkouts] = useState([]);
    const [currentAiRoutine, setCurrentAiRoutine] = useState([]);

    useEffect(() => {
        const auth = getAuth(app);
        const db = getFirestore(app);
        setFirebaseServices({ auth, db, app });

        const authUnsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            if (!isAuthReady) {
                setIsAuthReady(true);
            }
        });

        (async () => {
            try {
                if (auth.currentUser) {
                    setIsAuthReady(true);
                    return;
                }
                
                // Lógica de autenticación específica para el entorno de Canvas
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else if (typeof __firebase_config !== 'undefined') {
                    // Si __firebase_config existe, estamos en Canvas, usar anónimo
                    await signInAnonymously(auth);
                }
                // En Netlify, la autenticación se manejará por separado o se esperará la acción del usuario
            } catch (error) {
                console.error("Automatic sign-in failed:", error);
            } finally {
                setIsAuthReady(true);
            }
        })();

        return () => {
            authUnsubscribe();
        };
    }, []);

    const handleAddFoodToDb = useCallback(async (foodData) => {
        if (!firebaseServices || !user) return;
        const { db } = firebaseServices;
        const userId = user.uid;
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/foodDatabase`), foodData);
    }, [firebaseServices, user]);

    useEffect(() => {
        if (isAuthReady && firebaseServices && user) {
            const { db } = firebaseServices;
            const userId = user.uid;
            const userDocPath = `artifacts/${appId}/users/${userId}`;
            
            const unsubUser = onSnapshot(doc(db, `${userDocPath}/profile/data`), (docSnapshot) => {
                if(docSnapshot.exists()){ 
                    setUserData({ id: docSnapshot.id, ...docSnapshot.data() }); 
                } else {
                     const initialData = {
                        name: user.isAnonymous ? "Invitado" : user.displayName || "Atleta",
                        email: user.email,
                        goals: { calories: 2500, protein: 180, carbs: 250, fat: 70 },
                        objectivePrompt: 'Mis objetivos principales son ganar masa muscular y mantenerme saludable.',
                        workoutOptions: ['Descanso', 'Natación', 'Pesas - Tren Superior', 'Pesas - Tren Inferior', 'Fútbol', 'Cardio Ligero', 'Full Body'],
                        favoriteExercises: [],
                        workoutSchedule: { 
                            lunes: [{time: '18:00', name: 'Natación'}], martes: [{time: '19:00', name: 'Pesas - Tren Superior'}], 
                            miercoles: [{time: '19:00', name: 'Pesas - Tren Inferior'}], jueves: [{time: '20:00', name: 'Fútbol'}], 
                            viernes: [{time: '18:00', name: 'Natación'}], sabado: [], domingo: [] 
                        }
                    };
                    setDoc(docSnapshot.ref, initialData).then(() => setUserData(initialData));
                }
            });

            const unsubLogs = onSnapshot(collection(db, `${userDocPath}/dailyLogs`), (snap) => setDailyLog(snap.docs.reduce((acc, doc) => ({...acc, [doc.id]: doc.data() }), {})));
            const unsubWeight = onSnapshot(collection(db, `${userDocPath}/weightHistory`), (snap) => setWeightHistory(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(a.date) - new Date(b.date))));
            const unsubFood = onSnapshot(collection(db, `${userDocPath}/foodDatabase`), (snap) => {
                const foods = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                setFoodDatabase(foods);
                if (foods.length === 0 && !user.isAnonymous) {
                    [{ name: 'Pechuga de Pollo', c: 165, p: 31, h: 0, g: 3.6 }, { name: 'Arroz Blanco Cocido', c: 130, p: 2.7, h: 28, g: 0.3 }, { name: 'Huevo Entero', c: 155, p: 13, h: 1.1, g: 11 }, { name: 'Avena en Hojuelas', c: 389, p: 16.9, h: 66.3, g: 6.9 }].forEach(f => handleAddFoodToDb({name:f.name, calories_per_100g: f.c, protein_per_100g: f.p, carbs_per_100g: f.h, fat_per_100g: f.g}));
                }
            });
            const unsubMeasurements = onSnapshot(collection(db, `${userDocPath}/bodyMeasurements`), (snap) => setBodyMeasurements(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(a.date) - new Date(b.date))));
            const unsubWorkouts = onSnapshot(collection(db, `${userDocPath}/completedWorkouts`), (snap) => setCompletedWorkouts(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(b.date) - new Date(a.date))));

            return () => { unsubUser(); unsubLogs(); unsubWeight(); unsubFood(); unsubMeasurements(); unsubWorkouts(); };
        }
    }, [isAuthReady, firebaseServices, user, handleAddFoodToDb]);

    const handleRegister = async (email, password, name) => {
        const { auth, db } = firebaseServices;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userId = user.uid;
        const initialData = {
            name: name,
            email: user.email,
            goals: { calories: 2500, protein: 180, carbs: 250, fat: 70 },
            objectivePrompt: 'Mis objetivos principales son ganar masa muscular y mantenerme saludable.',
            workoutOptions: ['Descanso', 'Natación', 'Pesas - Tren Superior', 'Pesas - Tren Inferior', 'Fútbol', 'Cardio Ligero', 'Full Body'],
            favoriteExercises: [],
            workoutSchedule: { 
                lunes: [{time: '18:00', name: 'Natación'}], martes: [{time: '19:00', name: 'Pesas - Tren Superior'}], 
                miercoles: [{time: '19:00', name: 'Pesas - Tren Inferior'}], jueves: [{time: '20:00', name: 'Fútbol'}], 
                viernes: [{time: '18:00', name: 'Natación'}], sabado: [], domingo: [] 
            }
        };
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/data`), initialData);
    };

    const handleLogin = async (email, password) => {
        const { auth } = firebaseServices;
        await signInWithEmailAndPassword(auth, email, password);
    };

    const handleLinkAccount = async (email, password, name) => {
        const { auth, db } = firebaseServices;
        const credential = EmailAuthProvider.credential(email, password);
        
        try {
            const userCredential = await linkWithCredential(auth.currentUser, credential);
            const newUser = userCredential.user;
            const userId = newUser.uid;
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/data`), {
                name: name,
                email: newUser.email,
            }, { merge: true });
        } catch (error) {
            console.error("Error linking account:", error);
            throw error;
        }
    };

    const handleLogout = async () => {
        const { auth } = firebaseServices;
        await signOut(auth);
        setUserData(null);
        setDailyLog({});
        setWeightHistory([]);
        setFoodDatabase([]);
        setBodyMeasurements([]);
        setCompletedWorkouts([]);
        setCurrentAiRoutine([]);
        // Forzar un re-login anónimo para usuarios no registrados en el entorno de Canvas
        if (typeof __firebase_config !== 'undefined') {
             await signInAnonymously(auth);
        }
    };

    const handleUpdateGoals = async (newGoals) => { if (!firebaseServices || !user) return; await updateDoc(doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/profile/data`), { goals: newGoals }); };
    
    const handleUpdateObjective = async (newObjective) => {
        if (!firebaseServices || !user) return;
        const userDocRef = doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/profile/data`);
        await updateDoc(userDocRef, { objectivePrompt: newObjective });
    };

    const handleUpdateSchedule = async (newSchedule) => {
        if (!firebaseServices || !user) return;
        try {
            const userDocRef = doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/profile/data`);
            await updateDoc(userDocRef, { workoutSchedule: newSchedule });
        } catch (error) {
            console.error("Error al guardar el plan semanal.", error);
        }
    };

    const handleUpdateWorkoutOptions = async (newOptions) => { if (!firebaseServices || !user) return; await updateDoc(doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/profile/data`), { workoutOptions: newOptions }); };
    const handleLogFood = useCallback(async (date, data, merge = false) => { if (!firebaseServices || !user) return; await setDoc(doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/dailyLogs`, date), data, { merge: merge }); }, [firebaseServices, user]);
    const handleAddWeight = async (weight) => { if (!firebaseServices || !user) return; await addDoc(collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/weightHistory`), { date: new Date().toISOString().slice(0, 10), weight }); };
    const handleDeleteFood = async (foodId) => { if (!firebaseServices || !user) return; await deleteDoc(doc(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/foodDatabase`, foodId)); };
    const handleAddFood = async (foodData) => { await handleAddFoodToDb(foodData); };
    
    const handleSaveWorkout = async (workoutData) => {
        if (!firebaseServices || !user) return;
        const workoutLog = { date: new Date().toISOString(), exercises: workoutData };
        await addDoc(collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/completedWorkouts`), workoutLog);
    };

    const handleAddMeasurements = async (measurements) => {
        if (!firebaseServices || !user) return;
        const measurementLog = { date: new Date().toISOString().slice(0, 10), ...measurements };
        await addDoc(collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/bodyMeasurements`), measurementLog);
    };

    const handleToggleFavorite = async (exerciseName) => {
        if (!firebaseServices || !user || !userData) return;
        const { db } = firebaseServices;
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/data`);
        const isFavorite = userData.favoriteExercises?.includes(exerciseName);

        if (isFavorite) {
            await updateDoc(userDocRef, { favoriteExercises: arrayRemove(exerciseName) });
        } else {
            await updateDoc(userDocRef, { favoriteExercises: arrayUnion(exerciseName) });
        }
    };

    useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

    if (!isAuthReady || !firebaseServices || !user || !userData) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><div className="text-center"><Flame className="mx-auto h-12 w-12 text-blue-600 animate-pulse" /><p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">Inicializando FitTrack AI...</p></div></div>;
    }

    const renderView = () => {
        switch (view) {
            case 'food': return <FoodLogger dailyLog={dailyLog} foodDatabase={foodDatabase} handleLogFood={handleLogFood} handleGoBack={() => setView('dashboard')} />;
            case 'workout': return <WorkoutPlanner userData={userData} handleUpdateSchedule={handleUpdateSchedule} handleUpdateWorkoutOptions={handleUpdateWorkoutOptions} handleGoBack={() => setView('dashboard')} />;
            case 'progress': return <ProgressTracker weightHistory={weightHistory} bodyMeasurements={bodyMeasurements} handleAddWeight={handleAddWeight} handleAddMeasurements={handleAddMeasurements} handleGoBack={() => setView('dashboard')} />;
            case 'database': return <FoodDatabaseManager foodDatabase={foodDatabase} handleAddFood={handleAddFood} handleDeleteFood={handleDeleteFood} handleGoBack={() => setView('dashboard')} />;
            case 'settings': return <AppSettings user={user} userData={userData} handleLinkAccount={handleLinkAccount} handleRegister={handleRegister} handleLogin={handleLogin} handleLogout={handleLogout} handleUpdateGoals={handleUpdateGoals} handleUpdateObjective={handleUpdateObjective} />;
            case 'history': return <HistoryTracker completedWorkouts={completedWorkouts} handleGoBack={() => setView('dashboard')} />;
            case 'ai-workout': return <AiWorkoutGeneratorView userData={userData} completedWorkouts={completedWorkouts} handleGoBack={() => setView('dashboard')} handleSaveWorkout={handleSaveWorkout} routine={currentAiRoutine} setRoutine={setCurrentAiRoutine} handleToggleFavorite={handleToggleFavorite} />;
            default: return <Dashboard userData={userData} dailyLog={dailyLog} completedWorkouts={completedWorkouts} setView={setView} handleLogFood={handleLogFood} />;
        }
    };

    const NavItem = ({ icon: Icon, label, viewName }) => (
        <button onClick={() => setView(viewName)} className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg w-full text-left transition-colors sm:flex-row sm:justify-start sm:gap-3 sm:px-4 ${view === viewName ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            <Icon size={22} /><span className="text-xs sm:text-base font-medium">{label}</span>
        </button>
    );

    return (
        <div className="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen font-sans">
             <div className="flex flex-col sm:flex-row">
                <nav className="fixed bottom-0 sm:static sm:h-screen w-full sm:w-64 bg-white dark:bg-gray-800 shadow-lg sm:shadow-none border-t sm:border-r border-gray-200 p-2 sm:p-4 z-40">
                    <div className="hidden sm:flex sm:flex-col sm:justify-start sm:gap-2 h-full">
                        <div className="flex items-center gap-3 mb-8"><Flame className="h-8 w-8 text-blue-500"/><h1 className="text-2xl font-bold">FitTrack AI</h1></div>
                        <NavItem icon={BarChart2} label="Dashboard" viewName="dashboard" />
                        <NavItem icon={Sparkles} label="Rutina con IA" viewName="ai-workout" />
                        <NavItem icon={Calendar} label="Plan Semanal" viewName="workout" />
                        <NavItem icon={History} label="Historial" viewName="history" />
                        <NavItem icon={User} label="Progreso" viewName="progress" />
                        <NavItem icon={Utensils} label="Comidas" viewName="food" />
                        <NavItem icon={PlusCircle} label="Mis Alimentos" viewName="database" />
                        <NavItem icon={SettingsIcon} label="Ajustes" viewName="settings" />
                        <div className="mt-auto">
                           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 mt-2">
                               {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}<span className="font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
                           </button>
                        </div>
                    </div>
                    <div className="sm:hidden flex flex-row items-center gap-2 overflow-x-auto flex-nowrap h-full px-2">
                        <NavItem icon={BarChart2} label="Dashboard" viewName="dashboard" />
                        <NavItem icon={Sparkles} label="Rutina IA" viewName="ai-workout" />
                        <NavItem icon={Calendar} label="Plan" viewName="workout" />
                        <NavItem icon={History} label="Historial" viewName="history" />
                        <NavItem icon={User} label="Progreso" viewName="progress" />
                        <NavItem icon={Utensils} label="Comidas" viewName="food" />
                        <NavItem icon={PlusCircle} label="Alimentos" viewName="database" />
                        <NavItem icon={SettingsIcon} label="Ajustes" viewName="settings" />
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg flex-shrink-0">
                           {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                           <span className="text-xs font-medium">{isDarkMode ? 'Claro' : 'Oscuro'}</span>
                        </button>
                    </div>
                </nav>
                <main className="flex-1 p-4 sm:p-8 pb-24 sm:pb-8">
                    {renderView()}
                </main>
             </div>
        </div>
    );
}
