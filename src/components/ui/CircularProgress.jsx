import CountUp from './CountUp';

const CircularProgress = ({ value, max, label, color = '#00ffd1' }) => {
  const radius = 70;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / max) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
      >
        <circle
          stroke="rgba(255,255,255,0.08)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-1000 ease-in-out drop-shadow-[0_0_10px_rgba(0,255,209,0.4)]"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)] tracking-tighter" style={{ color }}>
          <CountUp from={0} to={value} duration={1.5} />
        </span>
        <span className="text-[10px] font-bold text-white/50 tracking-[0.2em] uppercase mt-1">
          {label}
        </span>
      </div>
    </div>
  );
};

export default CircularProgress;
