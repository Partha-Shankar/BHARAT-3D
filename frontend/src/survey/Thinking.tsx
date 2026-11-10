import React, { useEffect, useState } from 'react';

/**
 * A status line that steps through short "what is happening now" messages, so a long wait never looks frozen.
 * `hold` stops on the last message instead of cycling (for a check that moves through steps once).
 */
export const Thinking: React.FC<{ messages: string[]; every?: number; hold?: boolean; className?: string }> = ({
  messages, every = 2600, hold = false, className = '',
}) => {
  const [i, setI] = useState(0);
  const sig = messages.join('|');
  useEffect(() => {
    setI(0);
    if (messages.length < 2) return;
    const t = window.setInterval(() => setI((n) => (hold ? Math.min(n + 1, messages.length - 1) : (n + 1) % messages.length)), every);
    return () => window.clearInterval(t);
  }, [sig, every, hold]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = messages[Math.min(i, messages.length - 1)] ?? '';
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <span className="b3-think-dot" aria-hidden />
      <span key={text} className="b3-think b3-think-in truncate">{text}</span>
    </div>
  );
};
