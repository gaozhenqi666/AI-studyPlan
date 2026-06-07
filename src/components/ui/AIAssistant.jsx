import { AnimatePresence, motion } from 'framer-motion';
import 'katex/dist/katex.min.css';
import { Bot, Loader2, Maximize2, Minimize2, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { getAIClient } from '../../lib/aiClient';

const AIAssistant = ({ isOpen, onClose, todos, stats, onBatchAddTodos }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是你的专属AI学习助手。我可以帮你编排一天的学习任务，解答学习中的疑问，或者分析你的学习统计数据。有什么我可以帮你的吗？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { client: openai, model } = getAIClient();

      const systemPrompt = `你是一个智能学习助手。你的职责是：
1. 帮助用户解答学习中的任何问题（就像豆包一样）。
2. 帮助用户编排一天的学习和休息任务。
3. 分析用户的学习状况。

【任务编排核心工作流】（非常重要！）：
当用户要求你安排学习计划时（例如“我想学Vue，给我做个规划”）：
第一步（草案阶段）：你必须先给出一个**详细的学习规划草案**（包含具体知识点、每个任务的时长、休息时间的穿插）。
- 规划时，**必须考虑用户当前已有的未完成任务**，将新规划的任务与现有任务合理穿插结合，不要无视原有任务。
- 在草案的结尾，**必须主动询问用户**：“您觉得这个安排如何？是否需要我将这些新任务同步到您的今日任务列表中？”
- **此时绝对不要调用 schedule_tasks 函数！**

第二步（修改阶段）：如果用户提出修改意见，你需要根据意见优化安排，并再次询问是否同步。

第三步（执行阶段）：只有当用户**明确同意**（例如回复“好的”、“没问题”、“同步吧”、“就按这个来”等）后，你才可以调用 \`schedule_tasks\` 函数，将你刚刚规划好的**新任务**（不需要包含原有的任务，因为它们已经在列表里了）写入系统中。

【排版与数学公式要求】（非常重要！）：
1. 对于所有数学公式，请务必使用单美元符号 $包裹行内公式$ 或双美元符号 $$包裹独立公式$$，千万不要使用 \\( \\) 或 \\[ \\] ！每一个独立的计算公式必须单独写在一行，前后必须有换行符。
2. 如果需要输出表格，请使用标准 Markdown 表格语法。
3. 如果需要输出代码，请使用标准 Markdown 代码块语法。

当前用户的学习统计数据：
- 累计专注总时长：${Math.floor(stats.totalDuration / 60)}小时 ${stats.totalDuration % 60}分钟
- 累计学习天数：${stats.activeDays}天
- 当前连续学习：${stats.currentStreak}天
- 最高连续记录：${stats.maxStreak}天
- 平均每天专注：${stats.avgDaily}分钟

当前未完成的任务：
${todos.filter(t => !t.completed).map(t => `- [${t.type === 'task' ? '任务' : '休息'}] ${t.text} (${t.duration}分钟)`).join('\n') || '暂无未完成任务'}
`;

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ];

      const tools = [
        {
          type: "function",
          function: {
            name: "schedule_tasks",
            description: "安排一天的学习和休息任务",
            parameters: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "任务名称" },
                      item_type: { type: "string", enum: ["task", "rest"], description: "任务类型（专注任务或休息）" },
                      task_type: { type: "string", enum: ["study", "self-study"], description: "如果是专注任务，选择类型" },
                      priority: { type: "string", enum: ["high", "medium", "low"], description: "优先级" },
                      duration: { type: "integer", description: "预计时长（分钟，建议15-60）" }
                    },
                    required: ["title", "item_type", "duration"]
                  }
                }
              },
              required: ["tasks"]
            }
          }
        }
      ];

      const response = await openai.chat.completions.create({
        model,
        messages: apiMessages,
        tools: tools,
        tool_choice: "auto"
      });

      const message = response.choices[0].message;

      if (message.tool_calls) {
        const toolCall = message.tool_calls[0];
        if (toolCall.function.name === 'schedule_tasks') {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.tasks && args.tasks.length > 0) {
            await onBatchAddTodos(args.tasks);
            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: `我已经为你安排了 ${args.tasks.length} 个任务/休息环节，快去看看吧！祝你今天学习顺利！` 
            }]);
          }
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: message.content }]);
      }

    } catch (error) {
      console.error('AI Error:', error);
      if (error?.code === 'AI_NOT_CONFIGURED' || error?.message === 'AI_NOT_CONFIGURED') {
        setMessages(prev => [...prev, { role: 'assistant', content: '尚未配置 AI Key。请先点击右上角「AI 配置」完成配置后再使用。' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我现在有些连接问题，请稍后再试。' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.1}
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          className={`fixed z-[200] bg-black/80 backdrop-blur-3xl border border-white/20 shadow-[0_30px_100px_rgba(0,255,209,0.2)] rounded-3xl overflow-hidden flex flex-col ${isExpanded ? 'w-[800px] h-[80vh] inset-4 m-auto' : 'w-[380px] h-[600px] bottom-24 right-8'}`}
          style={{ 
            pointerEvents: 'auto',
            touchAction: 'none'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5 cursor-grab active:cursor-grabbing handle">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00ffd1]/20 rounded-full">
                <Bot size={20} className="text-[#00ffd1]" />
              </div>
              <span className="font-bold text-white tracking-widest text-sm">AI 学习助手</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-white/40 hover:text-white transition-colors p-1.5"
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button 
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors p-1.5"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 [&::-webkit-scrollbar]:hidden">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                {msg.role === 'user' ? (
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-[#00ffd1] text-black font-medium rounded-tr-sm whitespace-pre-wrap">
                    {msg.content}
                  </div>
                ) : (
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed bg-white/10 text-white/90 border border-white/5 rounded-tl-sm w-full overflow-hidden">
                    <div className="flex flex-col gap-2 w-full break-words
                        [&>h1]:text-lg [&>h1]:font-bold [&>h1]:text-white [&>h1]:mt-2 [&>h1]:mb-1
                        [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-white [&>h2]:mt-2 [&>h2]:mb-1
                        [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-white [&>h3]:mt-2 [&>h3]:mb-1
                        [&>p]:m-0 [&>p]:whitespace-pre-wrap
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:m-0 [&>ul]:space-y-1
                        [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:m-0 [&>ol]:space-y-1
                        [&>li]:m-0
                        [&_strong]:font-bold [&_strong]:text-white
                        [&_code]:bg-black/30 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[#00ffd1] [&_code]:text-xs [&_code]:font-mono
                        [&_pre]:bg-black/50 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:w-full [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-white/80 [&_pre_code]:text-xs
                        [&_table]:w-full [&_table]:border-collapse [&_table]:my-2
                        [&_th]:border [&_th]:border-white/20 [&_th]:p-2 [&_th]:bg-white/10 [&_th]:text-left
                        [&_td]:border [&_td]:border-white/20 [&_td]:p-2
                        [&_a]:text-[#00ffd1] [&_a]:underline">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="self-start px-4 py-3 bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm">
                <Loader2 size={18} className="text-[#00ffd1] animate-spin" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/40">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-2 focus-within:border-[#00ffd1]/50 focus-within:bg-white/10 transition-all">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="问我任何问题，或者让我帮你安排计划..."
                className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 placeholder-white/30"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-[#00ffd1] text-black rounded-xl hover:bg-[#00ffd1]/80 disabled:opacity-50 transition-colors"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AIAssistant;
