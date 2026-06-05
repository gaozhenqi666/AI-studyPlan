import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  separator = '',
  decimals = 0,
  onStart,
  onEnd,
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === 'down' ? to : from);
  
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 100,
    duration: duration * 1000,
  });

  const isInView = useInView(ref, { once: true, margin: "0px" });
  const [displayValue, setDisplayValue] = useState(from);

  useEffect(() => {
    if (isInView) {
      const timeoutId = setTimeout(() => {
        onStart?.();
        motionValue.set(direction === 'down' ? from : to);
      }, delay * 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isInView, delay, motionValue, direction, from, to, onStart]);

  useEffect(() => {
    return springValue.on("change", (latest) => {
      let formattedValue = Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: !!separator,
      }).format(Number(latest.toFixed(decimals)));
      
      if (separator && separator !== ',') {
        formattedValue = formattedValue.replace(/,/g, separator);
      }
      
      setDisplayValue(formattedValue);
      
      if (latest === (direction === 'down' ? from : to)) {
        onEnd?.();
      }
    });
  }, [springValue, decimals, separator, direction, from, to, onEnd]);

  return (
    <span ref={ref} className={className}>
      {displayValue}
    </span>
  );
}
