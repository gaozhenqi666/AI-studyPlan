import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('注册成功！请检查您的邮箱进行验证。');
      }
    } catch (err) {
      setError(err.message || '发生错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-black selection:bg-[#00ffd1]/30">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#8a5cff]/20 to-[#00ffd1]/20 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 sm:p-10 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[30px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8),0_0_40px_rgba(138,92,255,0.15)] relative z-10"
      >
        <div className="flex justify-center mb-8">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
            <Sparkles className="text-[#00ffd1]" size={32} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight">
          {isLogin ? '欢迎回来' : '开启专注之旅'}
        </h1>
        <p className="text-center text-white/40 text-sm font-bold tracking-widest uppercase mb-8">
          AI 辅助学习助手
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">邮箱地址</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm sm:text-base font-medium text-white placeholder-white/20 shadow-inner focus:shadow-[0_0_20px_rgba(0,255,209,0.1)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-[0.2em]">密码</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-12 pr-4 py-3 sm:py-4 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm sm:text-base font-medium text-white placeholder-white/20 shadow-inner focus:shadow-[0_0_20px_rgba(0,255,209,0.1)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full py-3.5 sm:py-4 mt-4 rounded-xl bg-gradient-to-r from-[#8a5cff] to-[#00ffd1] text-black font-extrabold text-base tracking-widest uppercase overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_10px_40px_-10px_rgba(138,92,255,0.6)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? '立即登录' : '注册账号')}
            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-white/40 hover:text-white text-sm font-bold transition-colors"
          >
            {isLogin ? '没有账号？点击注册' : '已有账号？立即登录'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
