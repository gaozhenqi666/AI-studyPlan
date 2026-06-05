import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { BookOpen, Calendar, CheckCircle2, Clock, Coffee, Flame, LayoutDashboard, ListTodo, LogOut, Pause, Play, Plus, Sparkles, Target, Timer, Trophy, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './App.css';
import Auth from './components/ui/Auth';
import CircularProgress from './components/ui/CircularProgress';
import ColorBends from './components/ui/ColorBends';
import Counter from './components/ui/Counter';
import CountUp from './components/ui/CountUp';
import Heatmap from './components/ui/Heatmap';
import ScrollVelocity from './components/ui/ScrollVelocity';
import { supabase } from './lib/supabase';

// Reusable Champion-level Segmented Control
const SegmentedControl = ({ options, value, onChange, layoutIdPrefix, activeColor = 'bg-white/15' }) => (
  <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner relative z-20">
    {options.map(opt => {
      const isActive = value === opt.value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 relative flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-bold tracking-widest rounded-xl transition-colors ${isActive ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          {isActive && (
            <motion.div
              layoutId={`segment-bg-${layoutIdPrefix}`}
              className={`absolute inset-0 ${activeColor} border border-white/10 rounded-xl`}
              transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            {opt.icon}
            {opt.label}
          </span>
        </button>
      );
    })}
  </div>
);

function App() {
  const [session, setSession] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [todos, setTodos] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  
  const [currentView, setCurrentView] = useState('todo'); // 'todo', 'focus', 'dashboard'
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const stats = useMemo(() => {
    if (!historyRecords.length) {
      return { totalDuration: 0, activeDays: 0, currentStreak: 0, maxStreak: 0, avgDaily: 0 };
    }
    
    const totalDuration = historyRecords.reduce((acc, curr) => acc + curr.duration_minutes, 0);
    const uniqueDates = [...new Set(historyRecords.map(r => r.completed_date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const activeDays = uniqueDates.length;
    
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let lastDate = null;
    
    const ascDates = [...uniqueDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    ascDates.forEach(dateStr => {
      const date = new Date(dateStr);
      if (!lastDate) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(date.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
      lastDate = date;
    });

    const today = new Date();
    today.setHours(0,0,0,0);
    const lastActiveDate = new Date(ascDates[ascDates.length - 1]);
    lastActiveDate.setHours(0,0,0,0);
    const diffToToday = Math.ceil(Math.abs(today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffToToday <= 1) {
      currentStreak = tempStreak;
    }

    return {
      totalDuration,
      activeDays,
      currentStreak,
      maxStreak,
      avgDaily: Math.round(totalDuration / (activeDays || 1))
    };
  }, [historyRecords]);

  const historyData = useMemo(() => {
    const history = {};
    historyRecords.forEach(r => {
      const dateString = r.completed_date;
      if (!history[dateString]) {
        history[dateString] = {
          date: dateString,
          totalDuration: 0,
          tasks: []
        };
      }
      history[dateString].totalDuration += r.duration_minutes;
      if (r.todos) {
        history[dateString].tasks.push({
          text: r.todos.title || '未知任务',
          duration: r.duration_minutes
        });
      }
    });
    return history;
  }, [historyRecords]);

  // Fetch Data when session exists
  useEffect(() => {
    const fetchTodos = async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setTodos(data.map(d => ({
          ...d,
          id: d.id,
          text: d.title,
          type: d.item_type,
          taskType: d.task_type,
          priority: d.priority,
          duration: d.duration,
          completed: d.completed
        })));
      }
    };

    const fetchHistoryRecords = async () => {
      const { data, error } = await supabase
        .from('focus_records')
        .select(`
          id,
          duration_minutes,
          completed_date,
          todos ( title, task_type )
        `)
        .order('completed_date', { ascending: false });

      if (!error && data) {
        setHistoryRecords(data);
      }
    };

    if (session) {
      fetchTodos();
      fetchHistoryRecords();
    }
  }, [session]);

  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [itemType, setItemType] = useState('task');
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('study');
  const [duration, setDuration] = useState(20);
  const [customDuration, setCustomDuration] = useState('');
  const [priority, setPriority] = useState('medium');

  // Focus Mode State
  const [focusingTask, setFocusingTask] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [focusStartTime, setFocusStartTime] = useState(null);

  // Complete task from Focus Mode or Checkbox
  const completeTask = async (id, startTime = null) => {
    const endTime = new Date();
    
    // Optimistic UI update
    setTodos(prev => prev.map(todo => 
      todo.id === id ? { 
        ...todo, 
        completed: true, 
        startTime: startTime || new Date(), 
        endTime: endTime 
      } : todo
    ));

    const { data: todoData, error: todoError } = await supabase
      .from('todos')
      .update({ completed: true })
      .eq('id', id)
      .select()
      .single();

    if (!todoError && todoData) {
      let actualDurationMins = todoData.duration;
      if (startTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        actualDurationMins = Math.max(1, Math.ceil(diffMs / 60000));
      }
      
      const record = {
        user_id: session.user.id,
        todo_id: id,
        duration_minutes: actualDurationMins,
        completed_date: endTime.toISOString().split('T')[0]
      };
      
      const { data: recordData, error: recordError } = await supabase
        .from('focus_records')
        .insert([record])
        .select(`
          id,
          duration_minutes,
          completed_date,
          todos ( title, task_type )
        `)
        .single();
        
      if (!recordError && recordData) {
        setHistoryRecords(prev => [recordData, ...prev]);
      }
    }
  };

  const completeFocusTask = () => {
    if (focusingTask) {
      completeTask(focusingTask.id, focusStartTime);
      setFocusingTask(null);
      setIsTimerRunning(false);
    }
  };

  // Timer Effect
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setTimeout(() => completeFocusTask(), 0);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerRunning, timeLeft, focusingTask, focusStartTime]);

  // Enforce rest duration limit on type switch
  const handleItemTypeChange = (newType) => {
    setItemType(newType);
    if (newType === 'rest') {
      if (typeof duration === 'number' && duration > 20) setDuration(20);
      if (duration === 'custom' && parseInt(customDuration) > 20) setCustomDuration('20');
    }
  };

  const handleAddTodo = async () => {
    let finalDuration = duration === 'custom' ? parseInt(customDuration) : duration;
    if (isNaN(finalDuration) || finalDuration <= 0) finalDuration = 15;
    if (itemType === 'rest' && finalDuration > 20) finalDuration = 20;

    const newItem = {
      user_id: session.user.id,
      title: taskName.trim() || (itemType === 'task' ? '未命名任务' : '休息片刻'),
      item_type: itemType,
      task_type: itemType === 'task' ? taskType : null,
      priority: itemType === 'task' ? priority : null,
      duration: finalDuration,
      completed: false
    };

    const { data, error } = await supabase.from('todos').insert([newItem]).select().single();

    if (!error && data) {
      const formattedTodo = {
        ...data,
        text: data.title,
        type: data.item_type,
        taskType: data.task_type,
        priority: data.priority,
        duration: data.duration,
        completed: data.completed
      };
      setTodos([formattedTodo, ...todos]);
      setIsAdding(false);
      setTimeout(resetForm, 400);
    }
  };

  const resetForm = () => {
    setItemType('task');
    setTaskName('');
    setTaskType('study');
    setDuration(20);
    setCustomDuration('');
    setPriority('medium');
  };

  // Start Focus Mode
  const startFocus = (todo) => {
    if (todo.completed) return;
    setFocusingTask(todo);
    setTimeLeft(todo.duration * 60);
    setIsTimerRunning(true);
    setFocusStartTime(new Date());
  };

  const cancelFocus = () => {
    setFocusingTask(null);
    setIsTimerRunning(false);
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const addFiveMinutes = () => {
    setTimeLeft(prev => prev + 300);
  };

  // Split active and completed tasks
  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const handleReorder = (newOrder) => {
    setTodos([...newOrder, ...completedTodos]);
  };

  // Render Active List Items with Reorder
  const renderActiveItem = (todo) => {
    const isRest = todo.type === 'rest';
    
    // Dynamic styling based on priority and type
    let prioDot = 'bg-white/40';
    let prioText = 'text-white/40';
    if (!isRest) {
      if (todo.priority === 'high') { prioDot = 'bg-[#ff5c7a] shadow-[0_0_8px_rgba(255,92,122,0.8)]'; prioText = 'text-[#ff5c7a]/90'; }
      else if (todo.priority === 'medium') { prioDot = 'bg-[#ffb800] shadow-[0_0_8px_rgba(255,184,0,0.8)]'; prioText = 'text-[#ffb800]/90'; }
      else { prioDot = 'bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.6)]'; prioText = 'text-white/60'; }
    }

    return (
      <Reorder.Item 
        key={todo.id} 
        value={todo} 
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        className="flex flex-col gap-2.5 w-full px-4 py-3 mb-3 bg-black/40 backdrop-blur-xl border border-white/5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] rounded-[20px] group cursor-grab active:cursor-grabbing"
      >
        <div 
          className="text-xl font-bold tracking-wide transition-all duration-300 flex items-center gap-3 text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.4)]"
          onClick={() => startFocus(todo)}
        >
          {/* Custom Checkbox */}
          <div 
            className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all border-white/30 hover:border-white/60 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              completeTask(todo.id);
            }}
          ></div>
          <span className="flex-1 hover:text-[#00ffd1] transition-colors">{todo.text}</span>
        </div>
        
        <div className="flex flex-wrap gap-3 text-xs font-bold tracking-wider items-center mt-2">
          {!isRest ? (
            <>
              {todo.taskType === 'study' ? (
                <span className="px-3 py-1.5 rounded-lg border border-[#8a5cff]/40 bg-[#8a5cff]/15 text-[#b998ff] shadow-[0_0_15px_rgba(138,92,255,0.15)] flex items-center gap-1.5">
                  <BookOpen size={12} />
                  专注学习
                </span>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-[#00b8ff]/40 bg-[#00b8ff]/15 text-[#00b8ff] shadow-[0_0_15px_rgba(0,184,255,0.15)] flex items-center gap-1.5">
                  <BookOpen size={12} />
                  自由学习
                </span>
              )}
              <span className={`flex items-center gap-1.5 px-2 ${prioText}`}>
                <div className={`w-2 h-2 rounded-full ${prioDot}`} />
                {todo.priority === 'high' ? '高优先级' : todo.priority === 'medium' ? '中优先级' : '低优先级'}
              </span>
            </>
          ) : (
            <span className="px-3 py-1.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/15 text-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center gap-1.5">
              <Coffee size={12} />
              放松休息
            </span>
          )}
          <span className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 flex items-center gap-1.5 ml-auto">
            <Clock size={12} />
            {todo.duration} MIN
          </span>
        </div>
      </Reorder.Item>
    );
  };

  const renderCompletedItem = (todo) => {
    let actualDurationText = '';
    if (todo.startTime && todo.endTime) {
      const diffMs = todo.endTime.getTime() - todo.startTime.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      actualDurationText = `${m}分 ${s}秒`;
    }

    return (
      <motion.div 
        key={todo.id} 
        initial={{ opacity: 0, height: 0, scale: 0.9 }}
        animate={{ opacity: 1, height: 'auto', scale: 1 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        className="flex flex-col gap-2.5 w-full px-5 py-4 mb-4 bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] rounded-[20px]"
      >
        <div className="text-xl font-bold tracking-wide flex items-center gap-3 text-white/70 line-through decoration-white/30 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center border-[#00ffd1]/50 bg-[#00ffd1]/10 shrink-0">
            <div className="w-2.5 h-2.5 bg-[#00ffd1]/80 rounded-full shadow-[0_0_8px_rgba(0,255,209,0.8)]" />
          </div>
          <span className="truncate">{todo.text}</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold tracking-wider text-white/60 pl-8">
          <span className="flex items-center gap-1.5 text-[#00ffd1] drop-shadow-[0_0_8px_rgba(0,255,209,0.3)]">
            <CheckCircle2 size={14} className="text-[#00ffd1]" />
            已完成
          </span>
          {todo.startTime && todo.endTime && (
            <>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 border border-white/5 shadow-inner">
                <Clock size={12} className="text-white/40" />
                {todo.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                <span className="text-white/30 mx-0.5">-</span>
                {todo.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#8a5cff]/20 border border-[#8a5cff]/30 text-[#b998ff] shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]">
                <Timer size={12} className="text-[#b998ff]" />
                用时 {actualDurationText}
              </span>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  // Format Time for Focus Mode
  const focusMinutes = Math.floor(timeLeft / 60);
  const focusSeconds = timeLeft % 60;

  // Framer Motion Variants
  const formVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15, filter: 'blur(4px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', bounce: 0 } }
  };

  if (isInitializing) {
    return <div className="w-screen h-screen bg-black flex items-center justify-center text-white/50 text-sm tracking-widest uppercase font-bold">LOADING...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="w-screen h-screen relative bg-[#050505] flex items-center justify-center font-sans overflow-hidden">
      {/* Background - Fixed */}
      <div className="fixed inset-0 z-0">
        <ColorBends 
          colors={["#ff5c7a", "#8a5cff", "#00ffd1"]} 
          rotation={83} 
          speed={0.5} 
          scale={1} 
          frequency={2.3} 
          warpStrength={0.915} 
          mouseInfluence={0} 
          noise={0.66} 
          parallax={2} 
          iterations={1} 
          intensity={2} 
          bandWidth={3.5} 
          transparent 
          autoRotate={5} 
        />
        {/* Subtle Vignette */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#050505]/80 mix-blend-multiply pointer-events-none" />
        
        {/* Scroll Velocity Background Text */}
        <div className="absolute inset-0 z-0 flex flex-col justify-between py-20 pointer-events-none opacity-60">
          <ScrollVelocity 
            texts={['让时间更好的被使用', '让学习更加有效率', '让目标越来越近']} 
            velocity={40} 
            className="custom-scroll-text text-6xl md:text-8xl tracking-widest" 
            numCopies={4} 
            damping={50} 
            stiffness={400} 
          />
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="fixed top-6 right-6 z-50 flex items-center justify-center p-3 bg-black/40 border border-white/10 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all backdrop-blur-xl"
        title="退出登录"
      >
        <LogOut size={18} />
      </button>

      {/* Main Content Area - Scrollable */}
      <div className={`relative z-10 w-full h-full overflow-x-hidden flex flex-col items-center pt-10 ${currentView === 'dashboard' ? 'overflow-y-auto pb-32' : 'overflow-hidden pb-10'} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}>
        
        {/* Navigation Toggle */}
        {!focusingTask && !isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex bg-black/40 p-1.5 rounded-full border border-white/5 shadow-inner mb-8 z-50 backdrop-blur-xl"
          >
            <button
              onClick={() => setCurrentView('todo')}
              className={`relative flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold tracking-widest rounded-full transition-colors ${currentView === 'todo' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
            >
              {currentView === 'todo' && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute inset-0 bg-[#00ffd1] rounded-full shadow-[0_0_15px_rgba(0,255,209,0.5)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <ListTodo size={18} />
                任务专注
              </span>
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`relative flex items-center justify-center gap-2 px-8 py-3 text-sm font-bold tracking-widest rounded-full transition-colors ${currentView === 'dashboard' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
            >
              {currentView === 'dashboard' && (
                <motion.div
                  layoutId="nav-bg"
                  className="absolute inset-0 bg-[#8a5cff] rounded-full shadow-[0_0_15px_rgba(138,92,255,0.5)]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <LayoutDashboard size={18} />
                数据统计
              </span>
            </button>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {currentView === 'dashboard' ? (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.3 } }}
              className="w-full max-w-5xl flex flex-col gap-8 px-4 pb-20"
            >
              {/* Top Stats Row */}
              <div className="flex gap-6 w-full">
                {/* Average Daily Time */}
                <div className="flex-1 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] p-8 flex items-center justify-center gap-10 relative overflow-hidden">
                  <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#00ffd1]/10 rounded-full blur-[80px]" />
                  <CircularProgress value={stats.avgDaily} max={120} label="平均专注/分" color="#00ffd1" />
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-white/50 text-xs font-bold tracking-widest uppercase mb-1">累计专注总时长</span>
                      <span className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                        <CountUp from={0} to={Math.floor(stats.totalDuration / 60)} duration={1.5} />
                        <span className="text-xl text-white/50 font-bold ml-1 mr-2">小时</span> 
                        <CountUp from={0} to={stats.totalDuration % 60} duration={1.5} />
                        <span className="text-xl text-white/50 font-bold ml-1">分</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-white/50 text-xs font-bold tracking-widest uppercase mb-1">累计学习天数</span>
                      <span className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                        <CountUp from={0} to={stats.activeDays} duration={1.5} />
                        <span className="text-xl text-white/50 font-bold ml-1">天</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Achievements / Streaks */}
                <div className="flex-1 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] p-8 relative overflow-hidden flex flex-col justify-center gap-6">
                  <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#ff5c7a]/10 rounded-full blur-[80px]" />
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
                      <Flame size={32} className="text-[#ff5c7a]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-white/50 text-xs font-bold tracking-widest uppercase mb-1">当前连续学习</span>
                      <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,92,122,0.5)]">
                        <CountUp from={0} to={stats.currentStreak} duration={1.5} /> 
                        <span className="text-xl text-white/50 font-bold ml-1">天</span>
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
                      <Trophy size={32} className="text-[#ffb800]" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-white/50 text-xs font-bold tracking-widest uppercase mb-1">最高连续记录</span>
                      <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,184,0,0.5)]">
                        <CountUp from={0} to={stats.maxStreak} duration={1.5} /> 
                        <span className="text-xl text-white/50 font-bold ml-1">天</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Heatmap */}
              <Heatmap data={historyData} onDateSelect={setSelectedHistoryDate} selectedDate={selectedHistoryDate} />

              {/* History List */}
              <div className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] p-8 flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute -top-40 right-20 w-96 h-96 bg-[#8a5cff]/10 rounded-full blur-[100px]" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between z-10 gap-4">
                  <h3 className="text-xl font-bold tracking-widest text-white/90 uppercase flex items-center gap-2">
                    <Calendar size={20} className="text-[#8a5cff]" />
                    {selectedHistoryDate === new Date().toISOString().split('T')[0] ? '今日' : selectedHistoryDate} 学习记录
                  </h3>
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="relative">
                      <input 
                        type="date" 
                        value={selectedHistoryDate}
                        onChange={(e) => {
                          if (e.target.value) setSelectedHistoryDate(e.target.value);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm font-bold outline-none focus:border-[#8a5cff] cursor-pointer hover:bg-white/10 transition-colors"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm font-bold shrink-0">
                      共计 {historyData[selectedHistoryDate]?.totalDuration || 0} 分钟
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  {historyData[selectedHistoryDate] ? (
                    <div className="flex flex-col gap-3 p-5 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="flex flex-col gap-2">
                        {historyData[selectedHistoryDate].tasks.map((task, tidx) => (
                          <div key={tidx} className="flex items-center gap-3 text-sm font-medium text-white/70">
                            <CheckCircle2 size={14} className="text-[#00ffd1]/70" />
                            {task.text}
                            <span className="ml-auto text-xs font-bold text-white/40 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                              {task.duration} 分钟
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-white/30 gap-3">
                      <Coffee size={32} className="opacity-50" />
                      <span className="text-sm font-bold tracking-widest">这一天在休息哦</span>
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          ) : focusingTask ? (
            <motion.div
              key="focus-view"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.3 } }}
              className="bg-black/60 backdrop-blur-3xl w-[800px] max-w-[90vw] p-12 shadow-[0_30px_100px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(0,255,209,0.15)] relative overflow-hidden text-white border border-white/10 rounded-[40px] my-auto"
            >
              {/* Focus Ambient Glow */}
              <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00ffd1]/20 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#8a5cff]/10 rounded-full blur-[100px] pointer-events-none" />

              <button 
                onClick={cancelFocus}
                className="absolute top-8 right-8 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all backdrop-blur-md z-50"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center justify-center relative z-10">
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8 flex items-center gap-2">
                  <Target size={16} className="text-[#00ffd1]" />
                  <span className="text-sm font-bold tracking-widest text-white/70 uppercase">当前专注</span>
                </div>
                
                <h2 className="text-4xl font-extrabold tracking-tight mb-16 text-center drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                  {focusingTask.text}
                </h2>

                <div className="flex items-center justify-center gap-4 mb-16">
                  <Counter 
                    value={focusMinutes} 
                    places={[10, 1]} 
                    fontSize={120} 
                    padding={10} 
                    gap={8} 
                    textColor="white" 
                    fontWeight={900} 
                  />
                  <span className="text-[120px] font-black text-white/30 mb-4">:</span>
                  <Counter 
                    value={focusSeconds} 
                    places={[10, 1]} 
                    fontSize={120} 
                    padding={10} 
                    gap={8} 
                    textColor="white" 
                    fontWeight={900} 
                  />
                </div>

                <div className="flex items-center gap-6">
                  <button 
                    onClick={addFiveMinutes}
                    className="flex items-center justify-center h-20 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white font-bold text-xl tracking-wider rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.02)]"
                  >
                    +5 分钟
                  </button>
                  <button 
                    onClick={toggleTimer}
                    className="flex items-center justify-center w-20 h-20 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                  >
                    {isTimerRunning ? <Pause size={32} className="fill-white" /> : <Play size={32} className="fill-white ml-2" />}
                  </button>
                  <button 
                    onClick={completeFocusTask}
                    className="group flex items-center gap-3 px-8 py-6 h-20 bg-gradient-to-r from-[#00ffd1] to-[#00b8ff] text-black font-extrabold text-xl tracking-widest uppercase rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_-10px_rgba(0,255,209,0.6)]"
                  >
                    <CheckCircle2 size={24} className="fill-black/20" />
                    提前完成
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="todo-root"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
              className="flex flex-col items-center w-full my-auto"
            >
              {/* List Area - visually dimmed when adding */}
              <motion.div 
                animate={{ 
                  opacity: isAdding ? 0.3 : 1, 
                  scale: isAdding ? 0.95 : 1,
                  filter: isAdding ? "blur(8px)" : "blur(0px)"
                }}
                transition={{ duration: 0.4 }}
                className={`flex flex-col items-center w-full ${isAdding ? 'pointer-events-none' : ''}`}
              >
                <div 
                  className="w-[640px] max-w-[95vw] h-[650px] relative px-2 overflow-hidden"
                  style={{ 
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)', 
                    maskImage: 'linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)' 
                  }}
                >
                  <div className="h-full overflow-y-auto pb-32 pt-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <Reorder.Group axis="y" values={activeTodos} onReorder={handleReorder} className="flex flex-col">
                      <AnimatePresence mode="popLayout">
                        {activeTodos.map(todo => renderActiveItem(todo))}
                      </AnimatePresence>
                    </Reorder.Group>

                    {completedTodos.length > 0 && (
                      <motion.div layout className="flex flex-col mt-4">
                        <div className="flex items-center gap-3 mb-6 mt-4">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-white/20"></div>
                          <span className="text-xs font-black tracking-[0.2em] uppercase text-white/80 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">今日学习记录</span>
                          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/20 to-white/20"></div>
                        </div>
                        <AnimatePresence mode="popLayout">
                          {completedTodos.map(todo => renderCompletedItem(todo))}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Global Overlays for FAB and Modal --- */}
        <AnimatePresence>
          {currentView === 'todo' && !focusingTask && !isAdding && (
            <motion.button 
              layoutId="champion-modal"
              onClick={() => setIsAdding(true)}
              className="fixed bottom-12 right-12 sm:bottom-16 sm:right-16 z-[100] flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-2xl border border-white/20 text-white rounded-full hover:bg-white/20 hover:scale-110 active:scale-95 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)] shrink-0 overflow-hidden cursor-pointer"
              style={{ borderRadius: 999 }}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#8a5cff]/40 to-[#00ffd1]/40 opacity-0 hover:opacity-100 transition-opacity duration-500" />
              <Plus size={36} className="z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {currentView === 'todo' && !focusingTask && isAdding && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
              {/* Optional: Backdrop clickable to close */}
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={() => setIsAdding(false)}
              />
              
              <motion.div
                layoutId="champion-modal"
                className="bg-black/60 backdrop-blur-3xl w-[700px] max-w-full max-h-[95vh] overflow-hidden p-5 sm:p-8 shadow-[0_30px_100px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(138,92,255,0.15)] relative text-white border border-white/10"
                initial={{ borderRadius: 999 }}
                animate={{ borderRadius: 40 }}
                exit={{ borderRadius: 999, opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", bounce: 0.15, duration: 0.7 }}
              >
                {/* Ambient Modal Glow */}
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#8a5cff]/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#00ffd1]/10 rounded-full blur-[100px] pointer-events-none" />

                <button 
                  onClick={() => setIsAdding(false)}
                  className="absolute top-5 right-5 sm:top-6 sm:right-6 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all backdrop-blur-md z-50"
                >
                  <X size={20} />
                </button>

                <motion.div variants={formVariants} initial="hidden" animate="show" className="relative z-10">
                  <motion.div variants={itemVariants} className="flex items-center gap-3 mb-5 sm:mb-6">
                    <div className="p-2.5 bg-white/10 rounded-2xl border border-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                      <Sparkles className="text-[#00ffd1]" size={22} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
                      配置新目标
                    </h2>
                  </motion.div>

                  <div className="space-y-4">
                    {/* Type Selection */}
                    <motion.div variants={itemVariants}>
                      <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">模式选择</label>
                      <SegmentedControl 
                        layoutIdPrefix="main-type"
                        value={itemType}
                        onChange={handleItemTypeChange}
                        options={[
                          { value: 'task', label: '专注任务', icon: <Target size={16} /> },
                          { value: 'rest', label: '放松休息', icon: <Coffee size={16} /> }
                        ]}
                        activeColor={itemType === 'task' ? 'bg-[#8a5cff]/40' : 'bg-[#f59e0b]/40'}
                      />
                    </motion.div>

                    {/* Name Input */}
                    <motion.div variants={itemVariants}>
                      <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">目标名称</label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          value={taskName}
                          onChange={e => setTaskName(e.target.value)}
                          placeholder={itemType === 'task' ? "输入你要完成的事情..." : "输入休息方式 (如: 喝杯咖啡)..."}
                          className="w-full px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm sm:text-base font-medium text-white placeholder-white/20 shadow-inner focus:shadow-[0_0_20px_rgba(0,255,209,0.1)]"
                        />
                      </div>
                    </motion.div>

                    {/* Task Specifics */}
                    {itemType === 'task' && (
                      <motion.div variants={itemVariants} className="flex flex-row gap-4 sm:gap-5">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">任务属性</label>
                          <SegmentedControl 
                            layoutIdPrefix="task-type"
                            value={taskType}
                            onChange={setTaskType}
                            options={[
                              { value: 'study', label: '专注学习' },
                              { value: 'self-study', label: '自由学习' }
                            ]}
                            activeColor={taskType === 'study' ? 'bg-[#8a5cff]/30' : 'bg-[#00b8ff]/30'}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">优先级</label>
                          <SegmentedControl 
                            layoutIdPrefix="priority"
                            value={priority}
                            onChange={setPriority}
                            options={[
                              { value: 'high', label: '高' },
                              { value: 'medium', label: '中' },
                              { value: 'low', label: '低' }
                            ]}
                            activeColor={priority === 'high' ? 'bg-[#ff5c7a]/40' : priority === 'medium' ? 'bg-[#ffb800]/40' : 'bg-[#00ffd1]/40'}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Duration Selector */}
                    <motion.div variants={itemVariants}>
                      <label className="flex items-center justify-between text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">
                        <span>时间分配</span>
                        {itemType === 'rest' && <span className="text-[#ff5c7a] bg-[#ff5c7a]/10 px-2 py-0.5 rounded border border-[#ff5c7a]/20">MAX 20 MIN</span>}
                      </label>
                      <div className="flex flex-wrap gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                        {[15, 20, 25, 30, 45, 60].filter(d => !(itemType === 'rest' && d > 20)).map(d => (
                          <button 
                            key={d}
                            onClick={() => setDuration(d)}
                            className={`flex-1 min-w-[45px] sm:min-w-[50px] py-1.5 sm:py-2 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${duration === d ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105 z-10' : 'bg-transparent text-white/40 hover:bg-white/10 hover:text-white/80'}`}
                          >
                            {d}'
                          </button>
                        ))}
                        <div className="flex-1 min-w-[70px] sm:min-w-[80px] relative flex items-center">
                          <button 
                            onClick={() => setDuration('custom')}
                            className={`w-full py-1.5 sm:py-2 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${duration === 'custom' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-white/40 hover:bg-white/5'}`}
                          >
                            {duration === 'custom' ? '' : '自定义'}
                          </button>
                          {duration === 'custom' && (
                            <input 
                              type="number" 
                              autoFocus
                              value={customDuration}
                              onChange={e => setCustomDuration(e.target.value)}
                              placeholder="min"
                              className="absolute inset-0 w-full h-full bg-transparent text-center font-bold text-white outline-none placeholder-white/30 no-spin-button"
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>

                    {/* Submit Button */}
                    <motion.div variants={itemVariants} className="pt-2 sm:pt-4">
                      <button 
                        onClick={handleAddTodo}
                        className="group relative w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-[#8a5cff] to-[#00ffd1] text-black font-extrabold text-base sm:text-lg tracking-widest uppercase overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_40px_-10px_rgba(138,92,255,0.6)]"
                      >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <Zap size={20} className="fill-black" />
                          注入能量
                        </span>
                      </button>
                    </motion.div>

                  </div>
                </motion.div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

export default App;