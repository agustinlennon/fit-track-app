import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, collection, addDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Youtube, PlusCircle, Trash2, Sun, Moon, Utensils, Dumbbell, Droplet, Bed, CheckCircle, BarChart2, User, Settings as SettingsIcon, X, Calendar, Flame, Sparkles } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE (FINAL) ---
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
const appId = firebaseConfig.appId;

// --- COMPONENTES DE LA UI ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md transition-all duration-300 ${className}`}>
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

// --- COMPONENTES DE ESQUELETO (LOADING) ---
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

// --- COMPONENTES PRINCIPALES DE LA APP ---

const Dashboard = ({ userData, dailyLog, weightHistory, setView, handleLogFood }) => {
  if (!userData) {
    return <DashboardSkeleton />;
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysLog = dailyLog[today] || { loggedFoods: [], water: 0, sleep: 0, morningRoutine: false, workout: '' };

  const totals = useMemo(() => {
    return todaysLog.loggedFoods.reduce((acc, food) => {
      acc.calories += food.calories;
      acc.protein += food.protein;
      acc.carbs += food.carbs;
      acc.fat += food.fat;
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
  
  const getMotivationalMessage = () => {
      const remainingProtein = goals.protein - totals.protein;
      const remainingCarbs = goals.carbs - totals.carbs;

      if (remainingProtein > 40) return { message: `¡Aún te faltan ${Math.round(remainingProtein)}g de proteína! Un batido o pollo podría ayudar.`, icon: <Flame className="text-orange-400" /> };
      if (remainingCarbs > 90) return { message: `¡Necesitas energía! Te faltan ${Math.round(remainingCarbs)}g de carbohidratos. ¿Qué tal avena o arroz?`, icon: <Dumbbell className="text-blue-400" /> };
      if (totals.calories > 0 && totals.calories < goals.calories / 2) return { message: '¡Buen comienzo! Sigue registrando para alcanzar tus metas de hoy.', icon: <CheckCircle className="text-green-400" /> };
      return { message: '¡Listo para romperla! Registra tu primera comida o entrenamiento.', icon: <Utensils className="text-gray-400" /> };
  };

  const motivationalMessage = getMotivationalMessage();

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">Resumen de Hoy</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
            {motivationalMessage.icon}
            <p className="text-sm text-gray-700 dark:text-gray-300">{motivationalMessage.message}</p>
        </div>
      </Card>
      
      <Card>
        <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-white">Macronutrientes</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" className="text-gray-200 dark:text-gray-700" fill="none" stroke="currentColor" strokeWidth="3" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-white">Progreso de Peso</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', borderColor: '#4B5563', borderRadius: '0.75rem', color: '#ffffff' }} />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <Button onClick={() => setView('progress')} className="w-full mt-4" variant="secondary">
              Ver todo el progreso
            </Button>
        </Card>
        <Card>
           <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-white">Hábitos Diarios</h3>
           <HabitsTracker dailyLog={todaysLog} handleUpdateHabit={(habit, value) => handleLogFood(today, { [habit]: value }, true)} />
        </Card>
      </div>
    </div>
  );
};

const FoodLogger = ({ dailyLog, foodDatabase, handleLogFood, handleGoBack }) => {
    const today = new Date().toISOString().slice(0, 10);
    const todaysLog = dailyLog[today] || { loggedFoods: [] };
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMeal, setSelectedMeal] = useState('desayuno');

    const handleOpenModal = (meal) => {
        setSelectedMeal(meal);
        setIsModalOpen(true);
    };

    const meals = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', snacks: 'Snacks' };
    const getFoodsForMeal = (meal) => todaysLog.loggedFoods.filter(f => f.meal === meal);
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
                                <li key={index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
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
        if (foodDatabase.length > 0) {
            setSelectedFoodId(foodDatabase[0].id);
        }
    }, [foodDatabase]);

    const filteredFoodDatabase = useMemo(() => foodDatabase.filter(food => food.name.toLowerCase().includes(searchTerm.toLowerCase())), [foodDatabase, searchTerm]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const foodData = foodDatabase.find(f => f.id === selectedFoodId);
        if (foodData) {
            const ratio = quantity / 100;
            const logEntry = {
                foodId: foodData.id, foodName: foodData.name, quantity: Number(quantity), meal: mealType,
                calories: foodData.calories_per_100g * ratio, protein: foodData.protein_per_100g * ratio,
                carbs: foodData.carbs_per_100g * ratio, fat: foodData.fat_per_100g * ratio,
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
                        {filteredFoodDatabase.map(food => (<option key={food.id} value={food.id}>{food.name}</option>))}
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

const WorkoutPlanner = ({ userData, handleUpdateSchedule, handleGoBack }) => {
    if (!userData) { return <Card><p>Cargando plan...</p></Card>; }

    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const workoutOptions = ['Descanso', 'Natación', 'Pesas - Tren Superior', 'Pesas - Tren Inferior', 'Fútbol', 'Cardio Ligero', 'Full Body'];
    const currentSchedule = userData.workoutSchedule || {};
    const handleChange = (day, value) => handleUpdateSchedule({ ...currentSchedule, [day]: value });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Plan Semanal</h2>
                <Button onClick={handleGoBack} variant="secondary">Volver</Button>
            </div>
            <Card>
                <div className="space-y-4">
                    {days.map(day => (
                        <div key={day} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="capitalize font-semibold text-gray-700 dark:text-gray-200">{day}</span>
                            <select value={currentSchedule[day] || 'Descanso'} onChange={(e) => handleChange(day, e.target.value)} className="p-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-sm">
                                {workoutOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};

const ProgressTracker = ({ weightHistory, handleAddWeight, handleGoBack }) => {
    const [newWeight, setNewWeight] = useState('');
    const onAddWeight = () => { if (newWeight && !isNaN(newWeight)) { handleAddWeight(parseFloat(newWeight)); setNewWeight(''); } };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Seguimiento de Progreso</h2>
          <Button onClick={handleGoBack} variant="secondary">Volver</Button>
        </div>
        <Card className="mb-6">
          <h3 className="font-bold text-xl mb-4 text-gray-800 dark:text-white">Evolución del Peso Corporal</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2}/>
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} fontSize={12}/>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(31, 41, 55, 0.8)', borderColor: '#4B5563', borderRadius: '0.75rem', color: '#ffffff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="weight" name="Peso (kg)" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
           <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-white">Registrar Nuevo Peso</h3>
           <div className="flex gap-4">
             <input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Ej: 85.5" className="w-full p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg" />
             <Button onClick={onAddWeight}>Registrar</Button>
           </div>
        </Card>
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
                 <ul className="space-y-2 max-h-96 overflow-y-auto">{foodDatabase.map(food => (<li key={food.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md"><span>{food.name}</span><button onClick={() => handleDeleteFood(food.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button></li>))}</ul>
            </Card>
        </div>
    );
};

const AppSettings = ({ userData, handleUpdateGoals, handleGoBack }) => {
    if (!userData) { return <Card><p>Cargando ajustes...</p></Card>; }

    const [goals, setGoals] = useState(userData.goals || { calories: 2500, protein: 180, carbs: 250, fat: 70 });
    const handleChange = (e) => setGoals({ ...goals, [e.target.name]: parseFloat(e.target.value) });
    const handleSubmit = (e) => { e.preventDefault(); handleUpdateGoals(goals); alert("¡Objetivos actualizados!"); };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-white">Ajustes y Objetivos</h2><Button onClick={handleGoBack} variant="secondary">Volver</Button></div>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <h3 className="font-bold text-lg mb-2">Objetivos Nutricionales Diarios</h3>
                    <div><label className="block text-sm font-medium">Calorías (kcal)</label><input type="number" name="calories" value={goals.calories} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Proteínas (g)</label><input type="number" name="protein" value={goals.protein} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Carbohidratos (g)</label><input type="number" name="carbs" value={goals.carbs} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div><label className="block text-sm font-medium">Grasas (g)</label><input type="number" name="fat" value={goals.fat} onChange={handleChange} className="w-full p-2 mt-1 bg-gray-100 dark:bg-gray-700 border rounded" /></div>
                    <div className="pt-2"><Button type="submit" className="w-full">Guardar Cambios</Button></div>
                </form>
            </Card>
        </div>
    );
};

const AiWorkoutGeneratorView = ({ userData, handleGoBack }) => {
    const [routine, setRoutine] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!userData) { return <Card><p>Cargando Asistente de Rutinas...</p></Card>; }

    const getWorkoutSuggestion = async () => {
        setIsLoading(true);
        setRoutine([]);
        setError('');

        const profile = `Soy un hombre de 41 años, peso 90kg, mido 186cm. Mis objetivos son ganar masa muscular, mejorar la potencia para el fútbol y mantenerme saludable.`;
        const schedule = userData.workoutSchedule;
        const todayDay = new Date().toLocaleDateString('es-ES', { weekday: 'long' }).toLowerCase();
        const todayWorkout = schedule[todayDay] || 'Descanso';

        const prompt = `${profile} Mi plan semanal es: Lunes: ${schedule.lunes}, Martes: ${schedule.martes}, Miércoles: ${schedule.miercoles}, Jueves: ${schedule.jueves}, Viernes: ${schedule.viernes}, Sábado: ${schedule.sabado}, Domingo: ${schedule.domingo}. Hoy es ${todayDay} y me toca: ${todayWorkout}. Genera una rutina detallada para el entrenamiento de hoy. Considera que si es de pesas, entreno en casa con mancuernas de 3kg y 6kg, una barra (sin discos adicionales) y peso corporal, y no tengo banco. Si es natación, dame consejos de enfoque. Si es fútbol, consejos de calentamiento. Si es descanso, una sugerencia de recuperación activa. Para cada ejercicio, proporciona un término de búsqueda en español para encontrar un video tutorial en YouTube.`;
        
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
                                name: { type: "STRING", description: "Nombre del ejercicio." },
                                sets: { type: "STRING", description: "Número de series." },
                                reps: { type: "STRING", description: "Número de repeticiones." },
                                weight: { type: "STRING", description: "Peso a utilizar (ej. '6 kg', 'Peso Corporal')." },
                                videoSearchQuery: { type: "STRING", description: "Término de búsqueda en español para YouTube." }
                            },
                             required: ["name", "sets", "reps", "weight", "videoSearchQuery"]
                        }
                    }
                }
            }
        };

        try {
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            
            if (!response.ok) throw new Error(`La llamada a la API falló: ${response.status}`);
            
            const result = await response.json();

            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                const parsedJson = JSON.parse(result.candidates[0].content.parts[0].text);
                setRoutine(parsedJson.routine || []);
                 if (!parsedJson.routine || parsedJson.routine.length === 0) {
                     setError("La IA no pudo generar una rutina esta vez. Inténtalo de nuevo.");
                 }
            } else {
                setError("No se pudo obtener una rutina. La respuesta de la IA estaba vacía.");
            }
        } catch (err) {
            console.error("Error al llamar a la API de Gemini o al procesar la respuesta:", err);
            setError(`Ocurrió un error al contactar al asistente de IA. Por favor, revisa la consola para más detalles.`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-gray-800 dark:text-white">Generador de Rutina con IA</h2><Button onClick={handleGoBack} variant="secondary">Volver</Button></div>
            <Card>
                <div className="text-center">
                    <h3 className="font-bold text-lg mb-2">¿Listo para entrenar?</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Presiona el botón para que la IA genere tu rutina de hoy, basada en tu plan semanal y tu equipamiento.</p>
                    <Button onClick={getWorkoutSuggestion} disabled={isLoading} className="w-full max-w-xs mx-auto">
                        <Sparkles size={18}/>
                        {isLoading ? 'Generando tu rutina...' : 'Generar Rutina de Hoy'}
                    </Button>
                </div>
            </Card>

            {isLoading && <div className="mt-6 text-center p-4"><p className="animate-pulse text-lg">El entrenador IA está preparando tu sesión...</p></div>}
            {error && <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

            {routine.length > 0 && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-xl font-bold text-center">Tu Rutina de Hoy</h3>
                    {routine.map((exercise, index) => (
                        <Card key={index} className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex-1">
                                <h4 className="font-bold text-lg text-blue-600 dark:text-blue-400">{exercise.name}</h4>
                                <p className="text-gray-700 dark:text-gray-300"><span className="font-semibold">{exercise.sets} x {exercise.reps}</span> repeticiones</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Peso: {exercise.weight}</p>
                            </div>
                            <Button
                                asLink={true}
                                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoSearchQuery)}`}
                                variant="youtube"
                                className="w-full sm:w-auto"
                            >
                                <Youtube size={18} />
                                Ver Video
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};


export default function App() {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [view, setView] = useState('dashboard');
    const [isDarkMode, setIsDarkMode] = useState(true);

    const [userData, setUserData] = useState(null); 
    const [dailyLog, setDailyLog] = useState({});
    const [weightHistory, setWeightHistory] = useState([]);
    const [foodDatabase, setFoodDatabase] = useState([]);

    useEffect(() => {
      try {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb); 
        setAuth(firebaseAuth);

        onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) { 
            setUserId(user.uid);
          } else {
            await signInAnonymously(firebaseAuth);
          }
          setIsAuthReady(true);
        });
      } catch (error) {
        console.error("Error initializing Firebase:", error);
      }
    }, []);

    const handleAddFood = useCallback(async (foodData) => {
        if (!db || !userId) return;
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/foodDatabase`), foodData);
    }, [db, userId]);

    useEffect(() => {
        if (isAuthReady && db && userId) {
            const userDocPath = `artifacts/${appId}/users/${userId}`;
            
            const unsubUser = onSnapshot(doc(db, `${userDocPath}/profile/data`), (doc) => {
                if(doc.exists()){ setUserData(doc.data()); } 
                else { setDoc(doc.ref, { goals: { calories: 2500, protein: 180, carbs: 250, fat: 70 }, workoutSchedule: { lunes: 'Natación', martes: 'Pesas - Tren Superior', miercoles: 'Pesas - Tren Inferior', jueves: 'Fútbol', viernes: 'Natación', sabado: 'Descanso', domingo: 'Descanso' } }); }
            });

            const unsubLogs = onSnapshot(collection(db, `${userDocPath}/dailyLogs`), (snap) => setDailyLog(snap.docs.reduce((acc, doc) => ({...acc, [doc.id]: doc.data() }), {})));
            const unsubWeight = onSnapshot(collection(db, `${userDocPath}/weightHistory`), (snap) => setWeightHistory(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a,b) => new Date(a.date) - new Date(b.date))));
            const unsubFood = onSnapshot(collection(db, `${userDocPath}/foodDatabase`), (snap) => {
                const foods = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                setFoodDatabase(foods);
                if (foods.length === 0) {
                    [{ name: 'Pechuga de Pollo', c: 165, p: 31, h: 0, g: 3.6 }, { name: 'Arroz Blanco Cocido', c: 130, p: 2.7, h: 28, g: 0.3 }, { name: 'Huevo Entero', c: 155, p: 13, h: 1.1, g: 11 }, { name: 'Avena en Hojuelas', c: 389, p: 16.9, h: 66.3, g: 6.9 }].forEach(f => handleAddFood({name:f.name, calories_per_100g: f.c, protein_per_100g: f.p, carbs_per_100g: f.h, fat_per_100g: f.g}));
                }
            });
            return () => { unsubUser(); unsubLogs(); unsubWeight(); unsubFood(); };
        }
    }, [isAuthReady, db, userId, handleAddFood]);

    const handleUpdateGoals = async (newGoals) => { if (!db || !userId) return; await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/data`), { goals: newGoals }); };
    const handleUpdateSchedule = async (newSchedule) => { if (!db || !userId) return; await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/profile/data`), { workoutSchedule: newSchedule }); };
    const handleLogFood = useCallback(async (date, data, merge = false) => { if (!db || !userId) return; await setDoc(doc(db, `artifacts/${appId}/users/${userId}/dailyLogs`, date), data, { merge: merge }); }, [db, userId]);
    const handleAddWeight = async (weight) => { if (!db || !userId) return; await addDoc(collection(db, `artifacts/${appId}/users/${userId}/weightHistory`), { date: new Date().toISOString().slice(0, 10), weight }); };
    const handleDeleteFood = async (foodId) => { if (!db || !userId) return; await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/foodDatabase`, foodId)); };

    useEffect(() => { document.documentElement.classList.toggle('dark', isDarkMode); }, [isDarkMode]);

    if (!isAuthReady || !userId) {
        return <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900"><div className="text-center"><Flame className="mx-auto h-12 w-12 text-blue-600 animate-pulse" /><p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">Conectando...</p></div></div>;
    }

    const renderView = () => {
        switch (view) {
            case 'food': return <FoodLogger dailyLog={dailyLog} foodDatabase={foodDatabase} handleLogFood={handleLogFood} handleGoBack={() => setView('dashboard')} />;
            case 'workout': return <WorkoutPlanner userData={userData} handleUpdateSchedule={handleUpdateSchedule} handleGoBack={() => setView('dashboard')} />;
            case 'progress': return <ProgressTracker weightHistory={weightHistory} handleAddWeight={handleAddWeight} handleGoBack={() => setView('dashboard')} />;
            case 'database': return <FoodDatabaseManager foodDatabase={foodDatabase} handleAddFood={handleAddFood} handleDeleteFood={handleDeleteFood} handleGoBack={() => setView('dashboard')} />;
            case 'settings': return <AppSettings userData={userData} handleUpdateGoals={handleUpdateGoals} handleGoBack={() => setView('dashboard')} />;
            case 'ai-workout': return <AiWorkoutGeneratorView userData={userData} handleGoBack={() => setView('dashboard')} />;
            default: return <Dashboard userData={userData} dailyLog={dailyLog} weightHistory={weightHistory} setView={setView} handleLogFood={handleLogFood} />;
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
                        <div className="hidden sm:flex items-center gap-3 mb-8"><Flame className="h-8 w-8 text-blue-500"/><h1 className="text-2xl font-bold">FitTrack AI</h1></div>
                        <NavItem icon={BarChart2} label="Dashboard" viewName="dashboard" />
                        <NavItem icon={Sparkles} label="Rutina con IA" viewName="ai-workout" />
                        <NavItem icon={Utensils} label="Comidas" viewName="food" />
                        <NavItem icon={Calendar} label="Plan Semanal" viewName="workout" />
                        <NavItem icon={User} label="Progreso" viewName="progress" />
                        <NavItem icon={SettingsIcon} label="Ajustes" viewName="settings" />
                        
                        <div className="mt-auto hidden sm:block">
                           <NavItem icon={PlusCircle} label="Mis Alimentos" viewName="database" />
                           <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 mt-2">
                               {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}<span className="font-medium">{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
                           </button>
                           <p className="text-xs text-center text-gray-400 mt-4">ID: <span className="font-mono break-all">{userId}</span></p>
                        </div>
                    </div>
                </nav>
                <main className="flex-1 p-4 sm:p-8 pb-24 sm:pb-8">{renderView()}</main>
             </div>
        </div>
    );
}
