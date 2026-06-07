import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Save, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { clearAIConfig, getAIConfig, setAIConfig } from '../../lib/aiConfig';
import { getAIClient } from '../../lib/aiClient';

const AIConfigModal = ({ isOpen, onClose, onConfigured }) => {
  const initial = useMemo(() => {
    const stored = getAIConfig();
    return {
      apiKey: stored?.apiKey || '',
      baseURL: stored?.baseURL || 'https://api.deepseek.com/v1',
      model: stored?.model || 'deepseek-chat'
    };
  }, []);

  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [baseURL, setBaseURL] = useState(initial.baseURL);
  const [model, setModel] = useState(initial.model);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setAIConfig({ apiKey: apiKey.trim(), baseURL: baseURL.trim(), model: model.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onConfigured?.();
  };

  const handleClear = () => {
    clearAIConfig();
    setApiKey('');
    setBaseURL('https://api.deepseek.com/v1');
    setModel('deepseek-chat');
    onConfigured?.();
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      setAIConfig({ apiKey: apiKey.trim(), baseURL: baseURL.trim(), model: model.trim() });
      const { client, model: resolvedModel } = getAIClient();
      await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: '请回复：连接成功' }],
        temperature: 0
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onConfigured?.();
    } catch (e) {
      alert(`测试失败：${e?.message || '未知错误'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="text-white font-extrabold tracking-widest">AI 配置</div>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">API Key</div>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="粘贴你的 DeepSeek API Key"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
            />
            <div className="text-xs text-white/30 leading-relaxed">
              Key 只会保存在你本机浏览器（localStorage），不会上传到服务器。
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">Base URL</div>
              <input
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">Model</div>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors"
            >
              <Trash2 size={16} />
              清空
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8a5cff]/20 border border-[#8a5cff]/30 text-[#b998ff] hover:bg-[#8a5cff]/30 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              测试连接
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
            >
              {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saved ? '已保存' : '保存'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AIConfigModal;
