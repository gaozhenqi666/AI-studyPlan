import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Heatmap = ({ data, onDateSelect, selectedDate }) => {
  const today = new Date();
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '', date: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  
  // Generate last 12 months data structure
  const months = [];
  for (let i = 11; i >= 0; i--) {
    // Determine year and month
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    
    // Get number of days in the month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Day of the week for the 1st of the month (0 = Sunday, 1 = Monday, ...)
    let firstDayOfWeek = d.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Make Monday = 0, Sunday = 6
    
    const weeks = [];
    let currentWeek = [];
    
    // Pad the first week with null for days before the 1st of the month
    for (let j = 0; j < firstDayOfWeek; j++) {
      currentWeek.push(null);
    }
    
    // Fill in the actual dates
    for (let day = 1; day <= daysInMonth; day++) {
      // Use 12:00:00 to avoid timezone shift issues crossing days
      const date = new Date(year, month, day, 12, 0, 0);
      currentWeek.push(date);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    
    // Pad the last week with null if needed
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    months.push({
      year,
      month,
      label: `${month + 1}月`,
      weeks
    });
  }

  const getColor = (duration) => {
    if (!duration || duration === 0) return 'bg-white/5 border-white/5';
    if (duration < 30) return 'bg-[#00ffd1]/20 border-[#00ffd1]/20 shadow-[0_0_5px_rgba(0,255,209,0.2)]';
    if (duration < 60) return 'bg-[#00ffd1]/40 border-[#00ffd1]/40 shadow-[0_0_8px_rgba(0,255,209,0.4)]';
    if (duration < 120) return 'bg-[#00ffd1]/70 border-[#00ffd1]/60 shadow-[0_0_12px_rgba(0,255,209,0.6)]';
    return 'bg-[#00ffd1] border-[#00ffd1] shadow-[0_0_15px_rgba(0,255,209,0.9)]';
  };

  const cellRoundedClass = "rounded-[2px] sm:rounded-[3px] lg:rounded-[4px]";

  return (
    <div className="w-full flex flex-col gap-3 p-4 sm:p-6 lg:p-8 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] overflow-hidden relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold tracking-widest text-white/90 uppercase flex items-center gap-2">
          过去一年专注记录
        </h3>
      </div>
      
      <div className="flex w-full items-start pb-8 pt-2 relative">
        
        {/* Custom Tooltip using Portal to escape overflow-hidden and filter context */}
        {mounted && createPortal(
          <AnimatePresence>
            {tooltip.visible && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  left: tooltip.x,
                  top: tooltip.y - 45, // offset above cursor
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                  zIndex: 99999,
                }}
                className="px-4 py-2 bg-white text-black text-sm font-bold rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-1 whitespace-nowrap"
              >
                {tooltip.content}
                <span className="text-black/50 ml-1 font-medium">{tooltip.date}</span>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {months.map((m, mIndex) => (
          <React.Fragment key={mIndex}>
            <div className="flex flex-col relative" style={{ flex: m.weeks.length }}>
              <div className="flex w-full">
                {m.weeks.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col flex-1 px-[1px] sm:px-[1.5px] md:px-[2px] gap-[2px] sm:gap-[3px] md:gap-[4px]">
                    {week.map((date, dIndex) => {
                      if (!date) {
                        return <div key={dIndex} className="w-full aspect-square opacity-0" />;
                      }
                      
                      const dateString = date.toISOString().split('T')[0];
                      const dayData = data[dateString];
                      const duration = dayData ? dayData.totalDuration : 0;
                      
                      if (date.getTime() > today.getTime()) {
                        return <div key={dIndex} className={`w-full aspect-square ${cellRoundedClass} border-[0.5px] sm:border border-white/5 bg-transparent`} />;
                      }
                      
                      const isSelected = dateString === selectedDate;
                      return (
                        <div 
                          key={dIndex} 
                          onMouseEnter={(e) => {
                            setTooltip({
                              visible: true,
                              x: e.clientX,
                              y: e.clientY,
                              content: duration > 0 ? `${duration}分钟专注` : '未学习',
                              date: `, ${dateString}`
                            });
                          }}
                          onMouseMove={(e) => {
                            setTooltip(prev => ({
                              ...prev,
                              x: e.clientX,
                              y: e.clientY
                            }));
                          }}
                          onMouseLeave={() => {
                            setTooltip(prev => ({ ...prev, visible: false }));
                          }}
                          onClick={() => onDateSelect && onDateSelect(dateString)}
                          className={`w-full aspect-square ${cellRoundedClass} border-[0.5px] sm:border ${getColor(duration)} transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer ${isSelected ? 'scale-125 z-10 shadow-[0_0_20px_rgba(255,255,255,0.8)] border-white' : ''}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] sm:text-xs font-bold text-white/40">
                {m.label}
              </div>
            </div>
            {mIndex < months.length - 1 && (
              <div style={{ flex: 1 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;
