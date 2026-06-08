import { motion } from 'framer-motion';
import 'katex/dist/katex.min.css';
import { AlertCircle, BookmarkPlus, BookOpen, CheckCircle2, Loader2, Plus, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { generateQuiz, generateSimilarQuestion, gradeQuiz } from '../../lib/quizApi';
import { supabase } from '../../lib/supabase';

const QuizModal = ({ isOpen, onClose, topic, taskId, userId, availableSubjects = [] }) => {
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradingSingle, setGradingSingle] = useState({});
  const [quizData, setQuizData] = useState(null);
  const [quizCount, setQuizCount] = useState(3);
  const [quizStep, setQuizStep] = useState('setup'); // setup | loading | ready
  const [userAnswers, setUserAnswers] = useState({});
  const [report, setReport] = useState(null);
  const [savingWrongBook, setSavingWrongBook] = useState({});
  const [selectedSubjectMap, setSelectedSubjectMap] = useState({});
  const [generatingSimilar, setGeneratingSimilar] = useState({});
  const [showSubjectSelect, setShowSubjectSelect] = useState(null);
  const [extraSubjects, setExtraSubjects] = useState([]);
  const similarIdRef = useRef(1);
  const inputRef = useRef(null);

  const subjects = useMemo(() => {
    return [...new Set([...(availableSubjects || []), ...extraSubjects])];
  }, [availableSubjects, extraSubjects]);

  const loadQuiz = async (currentTopic, count = 3) => {
    setLoading(true);
    setQuizStep('loading');
    try {
      const data = await generateQuiz(currentTopic, count);
      setQuizData(data);
      setUserAnswers({});
      setReport(null);
      setQuizStep('ready');
    } catch (error) {
      console.error("加载题目失败", error);
      alert("生成题目失败，请稍后重试");
      setQuizStep('setup');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    loadQuiz(topic, quizCount);
  };

  useEffect(() => {
    if (isOpen && topic) {
      setQuizData(null);
      setUserAnswers({});
      setReport(null);
      setSavingWrongBook({});
      setSelectedSubjectMap({});
      setGeneratingSimilar({});
      setShowSubjectSelect(null);
      setGradingSingle({});
      setExtraSubjects([]);
      setQuizCount(3);
      setQuizStep('setup');
    }
  }, [isOpen, topic]);

  const handleSelectOption = (questionId, optionLabel) => {
    const qReport = report?.details?.find(d => d.id === questionId);
    if (qReport) return; // 已交卷且已批改的不能再改
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionLabel
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(userAnswers).length < quizData.length) {
      if (!window.confirm("还有题目未完成，确认交卷吗？")) {
        return;
      }
    }
    
    setGrading(true);
    try {
      const result = await gradeQuiz(quizData, userAnswers);
      setReport(result);
      
      // Save quiz result to focus_records if taskId is provided
      if (taskId && userId) {
        try {
          // Find the most recent focus record for this task
          const { data: records } = await supabase
            .from('focus_records')
            .select('id')
            .eq('todo_id', taskId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (records && records.length > 0) {
            await supabase
              .from('focus_records')
              .update({ 
                quiz_data: {
                  topic,
                  score: result.score,
                  completed_at: new Date().toISOString()
                } 
              })
              .eq('id', records[0].id);
          }
        } catch (e) {
          console.error("Failed to save quiz record", e);
        }
      }
    } catch (error) {
      console.error("批改失败", error);
      alert("批改试卷失败，请稍后重试");
    } finally {
      setGrading(false);
    }
  };

  const handleGradeSingleQuestion = async (q) => {
    if (!userAnswers[q.id]) {
      alert("请先选择一个答案！");
      return;
    }
    setGradingSingle(prev => ({ ...prev, [q.id]: true }));
    try {
      const singleResult = await gradeQuiz([q], { [q.id]: userAnswers[q.id] });
      if (singleResult && singleResult.details && singleResult.details.length > 0) {
        const singleDetail = singleResult.details[0];
        setReport(prev => ({
          ...prev,
          details: [...(prev?.details || []), singleDetail]
        }));
      }
    } catch (error) {
      console.error("批改失败", error);
      alert("批改失败，请稍后重试");
    } finally {
      setGradingSingle(prev => ({ ...prev, [q.id]: false }));
    }
  };

  const handleGenerateSimilar = async (originalQuestion, qReport) => {
    setGeneratingSimilar(prev => ({ ...prev, [originalQuestion.id]: true }));
    try {
      const newQuestion = await generateSimilarQuestion(originalQuestion.question, qReport.analysis);
      const newId = `similar_${similarIdRef.current}`;
      similarIdRef.current += 1;
      
      // Add new question to the list right after the current one
      const currentIndex = quizData.findIndex(q => q.id === originalQuestion.id);
      const newQuizData = [...quizData];
      newQuizData.splice(currentIndex + 1, 0, {
        ...newQuestion,
        id: newId,
        isSimilar: true
      });
      setQuizData(newQuizData);
    } catch (e) {
      console.error("生成相似题目失败", e);
      alert("生成相似题目失败，请重试");
    } finally {
      setGeneratingSimilar(prev => ({ ...prev, [originalQuestion.id]: false }));
    }
  };

  const addToWrongBook = async (question, detail, subjectOverride) => {
    if (!userId) return alert("请先登录");
    
    const chosenSubject = subjectOverride || selectedSubjectMap[question.id] || question.subject || '综合';
    
    setSavingWrongBook(prev => ({ ...prev, [question.id]: true }));
    try {
      const { error } = await supabase.from('wrong_book').insert([{
        user_id: userId,
        subject: chosenSubject,
        question_content: question.question + '\n\n' + question.options.join('\n'),
        user_answer: userAnswers[question.id] || '未作答',
        correct_answer: question.answer,
        ai_analysis: detail.analysis
      }]);
      
      if (error) throw error;
      
      setSavingWrongBook(prev => ({ ...prev, [question.id]: 'saved' }));
      setTimeout(() => {
        setSavingWrongBook(prev => ({ ...prev, [question.id]: false }));
      }, 2000);
    } catch (error) {
      console.error("保存错题失败", error);
      alert("保存错题失败");
      setSavingWrongBook(prev => ({ ...prev, [question.id]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-3xl bg-[#111] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ffd1]/20 flex items-center justify-center">
              <BookOpen className="text-[#00ffd1]" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">巩固练习</h2>
              <p className="text-sm text-white/50 tracking-wide mt-1">学习任务：{topic}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {quizStep === 'setup' ? (
            <div className="flex flex-col items-center justify-center h-64 gap-6">
              <div className="text-white/80 font-extrabold text-lg">准备答题</div>
              <div className="flex items-center gap-3">
                <span className="text-white/50 text-sm font-bold">我要做</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quizCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    setQuizCount(Math.min(20, Math.max(1, v)));
                  }}
                  className="w-20 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-center font-extrabold text-xl outline-none focus:border-[#00ffd1]/50"
                />
                <span className="text-white/50 text-sm font-bold">道题</span>
              </div>
              <button
                onClick={startQuiz}
                className="px-8 py-3 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
              >
                开始答题
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-[#00ffd1] animate-spin" />
              <p className="text-white/60 font-medium">AI 老师正在为您生成专属练习题...</p>
            </div>
          ) : !quizData ? (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-white/60">暂无题目数据</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Report Summary */}
              {report && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-gradient-to-br from-[#00ffd1]/20 to-[#8a5cff]/20 border border-white/10 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <BookOpen size={100} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-end gap-4 mb-4">
                      <span className="text-5xl font-black text-white">{report.score}</span>
                      <span className="text-lg font-bold text-white/60 mb-2">分</span>
                    </div>
                    <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                      <ReactMarkdown>{report.summary}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Questions */}
              <div className="space-y-6">
                {quizData.map((q, idx) => {
                  const qReport = report?.details?.find(d => d.id === q.id);
                  const isWrong = qReport && !qReport.isCorrect;
                  
                  return (
                    <div key={q.id} className="p-6 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 pt-1 text-white/90 font-medium leading-relaxed prose-sm max-w-none prose-invert">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {q.question}
                          </ReactMarkdown>
                        </div>
                      </div>

                      <div className="space-y-3 pl-12">
                        {q.options.map((opt, oIdx) => {
                          const optLetter = opt.charAt(0);
                          const isSelected = userAnswers[q.id] === optLetter;
                          const isGraded = !!qReport;
                          
                          let optClass = "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ";
                          
                          if (isGraded) {
                            // Graded state
                            if (q.answer === optLetter) {
                              optClass += "bg-green-500/20 border-green-500/50 text-green-100";
                            } else if (isSelected) {
                              optClass += "bg-red-500/20 border-red-500/50 text-red-100";
                            } else {
                              optClass += "bg-white/5 border-white/5 text-white/50 opacity-50";
                            }
                          } else {
                            // Interactive state
                            if (isSelected) {
                              optClass += "bg-[#00ffd1]/20 border-[#00ffd1]/50 text-white";
                            } else {
                              optClass += "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20";
                            }
                          }

                          return (
                            <div 
                              key={oIdx} 
                              onClick={() => handleSelectOption(q.id, optLetter)}
                              className={optClass}
                            >
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors
                                ${isGraded 
                                  ? (q.answer === optLetter ? 'bg-green-500 border-green-500' : isSelected ? 'bg-red-500 border-red-500' : 'border-white/20')
                                  : isSelected ? 'border-[#00ffd1] bg-[#00ffd1]' : 'border-white/30'
                                }`}
                              >
                                {isGraded && q.answer === optLetter && <CheckCircle2 size={14} className="text-black" />}
                                {isGraded && isSelected && q.answer !== optLetter && <XCircle size={14} className="text-black" />}
                                {!isGraded && isSelected && <div className="w-2 h-2 rounded-full bg-black" />}
                              </div>
                              <div className="flex-1 prose-sm prose-invert">
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {opt}
                                </ReactMarkdown>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {report && !qReport && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pl-12 flex justify-end"
                        >
                          <button
                            onClick={() => handleGradeSingleQuestion(q)}
                            disabled={gradingSingle[q.id]}
                            className="px-6 py-2 bg-[#00ffd1] text-black font-bold rounded-lg hover:bg-[#00ffd1]/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {gradingSingle[q.id] ? <Loader2 size={16} className="animate-spin" /> : '提交批改此题'}
                          </button>
                        </motion.div>
                      )}

                      {/* Analysis and Add to Wrong Book */}
                      {qReport && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-6 pl-12"
                        >
                          <div className={`p-4 rounded-xl border ${isWrong ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                            <h4 className={`font-bold mb-2 flex items-center gap-2 ${isWrong ? 'text-red-400' : 'text-green-400'}`}>
                              {isWrong ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                              {isWrong ? '解析' : '很棒！解析'}
                            </h4>
                            <div className="text-sm text-white/80 leading-relaxed prose-sm max-w-none prose-invert">
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {qReport.analysis}
                              </ReactMarkdown>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-end gap-3">
                              <button
                                onClick={() => handleGenerateSimilar(q, qReport)}
                                disabled={generatingSimilar[q.id]}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-[#8a5cff]/20 text-[#b998ff] border border-[#8a5cff]/30 hover:bg-[#8a5cff]/30 transition-colors"
                              >
                                {generatingSimilar[q.id] ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                                )}
                                举一反三
                              </button>
                              
                              <div className="relative">
                                <button
                                  onClick={() => setShowSubjectSelect(showSubjectSelect === q.id ? null : q.id)}
                                  disabled={savingWrongBook[q.id] === true || savingWrongBook[q.id] === 'saved'}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                    savingWrongBook[q.id] === 'saved' 
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                  }`}
                                >
                                  {savingWrongBook[q.id] === true ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : savingWrongBook[q.id] === 'saved' ? (
                                    <CheckCircle2 size={16} />
                                  ) : (
                                    <BookmarkPlus size={16} />
                                  )}
                                  {savingWrongBook[q.id] === 'saved' ? '已收录' : '收录到错题本'}
                                </button>

                                {showSubjectSelect === q.id && (
                                  <div className="absolute bottom-full right-0 mb-2 p-3 bg-black/90 border border-white/20 rounded-xl shadow-xl z-50 w-56 backdrop-blur-xl">
                                    <div className="flex justify-between items-center mb-2">
                                      <h5 className="text-xs text-white/50 font-bold uppercase tracking-widest">选择收录科目</h5>
                                      <button onClick={() => setShowSubjectSelect(null)} className="text-white/40 hover:text-white"><X size={14}/></button>
                                    </div>
                                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                      {subjects.length === 0 && <div className="text-xs text-white/30 italic py-1">暂无科目</div>}
                                      {subjects.map(sub => (
                                        <button 
                                          key={sub}
                                          onClick={() => {
                                            setSelectedSubjectMap(prev => ({ ...prev, [q.id]: sub }));
                                            addToWrongBook(q, qReport, sub);
                                            setShowSubjectSelect(null);
                                          }}
                                          className="text-left px-2 py-1.5 hover:bg-white/10 rounded-lg text-sm text-white/90 transition-colors"
                                        >
                                          {sub}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <button
                                        onClick={() => {
                                          inputRef?.current?.focus();
                                        }}
                                        className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-[#00ffd1]/70 hover:text-[#00ffd1] hover:bg-white/5 font-bold transition-colors flex items-center gap-1"
                                      >
                                        <Plus size={14} />
                                        新增科目
                                      </button>
                                      <div className="flex items-center gap-1 mt-1">
                                        <input
                                          ref={inputRef}
                                          type="text"
                                          placeholder={subjects.length === 0 ? '输入科目名称并回车...' : '或输入新科目...'}
                                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#00ffd1]/50"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                              const newSub = e.target.value.trim();
                                              if (!subjects.includes(newSub)) {
                                                setExtraSubjects(prev => [...prev, newSub]);
                                              }
                                              setSelectedSubjectMap(prev => ({ ...prev, [q.id]: newSub }));
                                              addToWrongBook(q, qReport, newSub);
                                              setShowSubjectSelect(null);
                                              e.target.value = '';
                                            }
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && quizData && !report && (
          <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={grading}
              className="px-8 py-3 bg-[#00ffd1] text-black font-bold rounded-xl hover:bg-[#00ffd1]/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {grading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在批改...
                </>
              ) : (
                '提交试卷'
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default QuizModal;
