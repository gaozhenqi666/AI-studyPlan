import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { ArrowRightLeft, BookOpen, Bot, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList, Edit2, GripVertical, Loader2, Plus, Save, Sparkles, Target, Timer, Trash2, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAIClient } from '../../lib/aiClient';
import { supabase } from '../../lib/supabase';

const formatDow = (dow) => {
  const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return typeof dow === 'number' ? map[dow] : '';
};

const RoadmapView = ({ session, onBatchAddTodos, onNavigateToTodo }) => {
  const [roadmaps, setRoadmaps] = useState([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [applyingToday, setApplyingToday] = useState(false);
  const [applyPreview, setApplyPreview] = useState(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMode, setNewMode] = useState('learn');

  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyDow, setWeeklyDow] = useState(0);
  const [weeklyTime, setWeeklyTime] = useState('20:00');
  const [monthlyEnabled, setMonthlyEnabled] = useState(false);
  const [monthlyLast, setMonthlyLast] = useState(true);
  const [monthlyDay, setMonthlyDay] = useState(28);
  const [monthlyTime, setMonthlyTime] = useState('20:00');

  // Roadmap exam taking
  const [takingExam, setTakingExam] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examAnswers, setExamAnswers] = useState({});
  const [examReport, setExamReport] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [gradingExam, setGradingExam] = useState(false);

  // AI Generate Roadmap state
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiPreview, setAiPreview] = useState(null);
  const [aiGeneratingLoading, setAiGeneratingLoading] = useState(false);

  // AI Fill Details for a single node
  const [isAIFillingDetails, setIsAIFillingDetails] = useState(false);
  const [aiDetailsPreview, setAiDetailsPreview] = useState(null);

  // Move block popover
  const [moveBlockId, setMoveBlockId] = useState(null);

  // Confirmation states for delete operations
  const [confirmDeleteRoadmap, setConfirmDeleteRoadmap] = useState(null);
  const [confirmDeleteAllRoadmaps, setConfirmDeleteAllRoadmaps] = useState(false);
  const [confirmDeleteNode, setConfirmDeleteNode] = useState(false);

  // Manual exam
  const [showManualExam, setShowManualExam] = useState(false);
  const [manualExamScope, setManualExamScope] = useState('');

  // Exam template editor
  const [showExamTemplate, setShowExamTemplate] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);

  const loadRoadmaps = useCallback(async () => {
    const { data } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    setRoadmaps(data || []);
  }, [session.user.id]);

  const loadDetail = async (roadmap) => {
    setSelectedRoadmap(roadmap);
    const [nodesRes, examsRes] = await Promise.all([
      supabase
        .from('roadmap_nodes')
        .select('*')
        .eq('roadmap_id', roadmap.id)
        .eq('user_id', session.user.id)
        .order('order_index', { ascending: true }),
      supabase
        .from('roadmap_exams')
        .select('*')
        .eq('roadmap_id', roadmap.id)
        .eq('user_id', session.user.id)
        .order('scheduled_at', { ascending: false })
        .limit(10)
    ]);
    setNodes(nodesRes.data || []);
    setExams(examsRes.data || []);
  };

  useEffect(() => {
    if (session?.user?.id) {
      const init = async () => {
        await loadRoadmaps();
      };
      init();
    }
  }, [session?.user?.id, loadRoadmaps]);

  const scheduleText = (rm) => {
    if (rm.mode !== 'sprint') return '新知学习模式';
    const parts = [];
    if (rm.weekly_exam_enabled && rm.weekly_exam_dow !== null && rm.weekly_exam_time) {
      parts.push(`${formatDow(rm.weekly_exam_dow)} ${rm.weekly_exam_time.slice(0, 5)} 周考`);
    }
    if (rm.monthly_exam_enabled && rm.monthly_exam_time) {
      parts.push(`${rm.monthly_exam_last ? '每月最后一天' : `每月${rm.monthly_exam_day}号`} ${rm.monthly_exam_time.slice(0, 5)} 月考`);
    }
    return parts.length ? parts.join(' · ') : '冲刺模式（未设置考试时间）';
  };

  const stageNodes = useMemo(() => nodes.filter(n => n.node_type === 'stage'), [nodes]);
  const blockNodes = useMemo(() => nodes.filter(n => n.node_type === 'block'), [nodes]);

  const blocksByStage = useMemo(() => {
    const grouped = {};
    blockNodes.forEach(b => {
      const key = b.parent_id || '__root__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(b);
    });
    Object.values(grouped).forEach(list => list.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)));
    return grouped;
  }, [blockNodes]);

  const sortedStages = useMemo(() =>
    [...stageNodes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [stageNodes]
  );

  const handleCreateRoadmap = async () => {
    if (!newTitle.trim()) return;

    const payload = {
      user_id: session.user.id,
      title: newTitle.trim(),
      mode: newMode,
      weekly_exam_enabled: newMode === 'sprint' ? weeklyEnabled : false,
      weekly_exam_dow: newMode === 'sprint' && weeklyEnabled ? weeklyDow : null,
      weekly_exam_time: newMode === 'sprint' && weeklyEnabled ? weeklyTime : null,
      monthly_exam_enabled: newMode === 'sprint' ? monthlyEnabled : false,
      monthly_exam_last: newMode === 'sprint' ? monthlyLast : false,
      monthly_exam_day: newMode === 'sprint' && monthlyEnabled && !monthlyLast ? monthlyDay : null,
      monthly_exam_time: newMode === 'sprint' && monthlyEnabled ? monthlyTime : null
    };

    const { data, error } = await supabase.from('roadmaps').insert([payload]).select().single();
    if (!error && data) {
      setIsCreating(false);
      setNewTitle('');
      setNewMode('learn');
      setWeeklyEnabled(false);
      setMonthlyEnabled(false);
      await loadRoadmaps();
      await loadDetail(data);
    }
  };

  const deleteRoadmap = (rmId, e) => {
    e.stopPropagation();
    setConfirmDeleteRoadmap(rmId);
  };

  const confirmDeleteRoadmapAction = async () => {
    const rmId = confirmDeleteRoadmap;
    setConfirmDeleteRoadmap(null);
    const { error } = await supabase
      .from('roadmaps')
      .delete()
      .eq('id', rmId)
      .eq('user_id', session.user.id);
    if (!error) {
      if (selectedRoadmap?.id === rmId) {
        setSelectedRoadmap(null);
        setNodes([]);
        setExams([]);
      }
      setRoadmaps(prev => prev.filter(r => r.id !== rmId));
    }
  };

  const deleteAllRoadmaps = () => {
    setConfirmDeleteAllRoadmaps(true);
  };

  const confirmDeleteAllRoadmapsAction = async () => {
    setConfirmDeleteAllRoadmaps(false);
    const { error } = await supabase
      .from('roadmaps')
      .delete()
      .eq('user_id', session.user.id);
    if (!error) {
      setSelectedRoadmap(null);
      setNodes([]);
      setExams([]);
      setRoadmaps([]);
    }
  };

  const getNodeMeta = (node) => {
    const meta = node?.metadata && typeof node.metadata === 'object' ? node.metadata : {};
    return meta || {};
  };

  const updateSelectedNode = (patch) => {
    setSelectedNode(prev => prev ? ({ ...prev, ...patch }) : prev);
  };

  const saveNode = async () => {
    if (!selectedNode) return;
    if (!selectedNode.title.trim()) {
      alert('标题不能为空');
      return;
    }
    setDrawerSaving(true);
    try {
      if (selectedNode._isNew) {
        const orderIndex = (nodes.map(n => n.order_index).reduce((a, b) => Math.max(a, b), 0) || 0) + 1;
        const insertPayload = {
          roadmap_id: selectedRoadmap.id,
          user_id: session.user.id,
          node_type: selectedNode.node_type,
          title: selectedNode.title.trim(),
          planned_minutes: selectedNode.planned_minutes || selectedRoadmap.default_block_minutes,
          planned_start_date: selectedNode.planned_start_date || null,
          planned_end_date: selectedNode.planned_end_date || null,
          parent_id: selectedNode.parent_id || null,
          order_index: orderIndex,
          metadata: selectedNode.metadata || null
        };
        const { data, error } = await supabase
          .from('roadmap_nodes')
          .insert([insertPayload])
          .select()
          .single();
        if (error) throw error;
        setNodes(prev => [...prev, data]);
        setSelectedNode(null);
        // Refresh nodes to get updated order
        const { data: refreshed } = await supabase
          .from('roadmap_nodes')
          .select('*')
          .eq('roadmap_id', selectedRoadmap.id)
          .eq('user_id', session.user.id)
          .order('order_index', { ascending: true });
        if (refreshed) setNodes(refreshed);
      } else {
        const payload = {
          title: selectedNode.title,
          planned_minutes: selectedNode.planned_minutes,
          planned_start_date: selectedNode.planned_start_date || null,
          planned_end_date: selectedNode.planned_end_date || null,
          parent_id: selectedNode.parent_id || null,
          metadata: selectedNode.metadata || null
        };
        const { data, error } = await supabase
          .from('roadmap_nodes')
          .update(payload)
          .eq('id', selectedNode.id)
          .eq('user_id', session.user.id)
          .select()
          .single();
        if (error) throw error;
        setNodes(prev => prev.map(n => n.id === data.id ? data : n));
        setSelectedNode(data);
      }
    } catch (e) {
      alert(`保存失败：${e?.message || '未知错误'}`);
    } finally {
      setDrawerSaving(false);
    }
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    setConfirmDeleteNode(true);
  };

  const confirmDeleteNodeAction = async () => {
    setConfirmDeleteNode(false);
    try {
      const { error } = await supabase
        .from('roadmap_nodes')
        .delete()
        .eq('id', selectedNode.id)
        .eq('user_id', session.user.id);
      if (error) throw error;
      setNodes(prev => prev.filter(n => n.id !== selectedNode.id));
      setSelectedNode(null);
    } catch (e) {
      alert(`删除失败：${e?.message || '未知错误'}`);
    }
  };

  const handleMoveBlock = async (blockId, newParentId) => {
    // newParentId: null = root, string = stage id
    await supabase
      .from('roadmap_nodes')
      .update({ parent_id: newParentId || null })
      .eq('id', blockId)
      .eq('user_id', session.user.id);
    const { data } = await supabase
      .from('roadmap_nodes')
      .select('*')
      .eq('roadmap_id', selectedRoadmap.id)
      .eq('user_id', session.user.id)
      .order('order_index', { ascending: true });
    if (data) setNodes(data);
    setMoveBlockId(null);
  };

  const handleStageReorder = async (reorderedStages) => {
    for (let i = 0; i < reorderedStages.length; i++) {
      const stage = reorderedStages[i];
      if (stage.order_index !== i + 1) {
        await supabase
          .from('roadmap_nodes')
          .update({ order_index: i + 1 })
          .eq('id', stage.id)
          .eq('user_id', session.user.id);
      }
    }
    const { data } = await supabase
      .from('roadmap_nodes')
      .select('*')
      .eq('roadmap_id', selectedRoadmap.id)
      .eq('user_id', session.user.id)
      .order('order_index', { ascending: true });
    if (data) setNodes(data);
  };

  const handleBlockReorder = async (stageId, reorderedBlocks) => {
    for (let i = 0; i < reorderedBlocks.length; i++) {
      const block = reorderedBlocks[i];
      const updates = { order_index: i + 1 };
      if (block.parent_id !== stageId) {
        updates.parent_id = stageId === '__root__' ? null : stageId;
      }
      await supabase
        .from('roadmap_nodes')
        .update(updates)
        .eq('id', block.id)
        .eq('user_id', session.user.id);
    }
    const { data } = await supabase
      .from('roadmap_nodes')
      .select('*')
      .eq('roadmap_id', selectedRoadmap.id)
      .eq('user_id', session.user.id)
      .order('order_index', { ascending: true });
    if (data) setNodes(data);
  };

  const generateTasksFromDetails = async ({ roadmap, node, dayIndex, details }) => {
    const { client: openai, model } = getAIClient();
    const prompt = `你是一个非常专业的学习规划老师。用户在一个“长线学习计划”节点里写了一段长文本计划。\n\n【长文本计划】\n${details}\n\n请你只针对“第 ${dayIndex} 天”，生成一份可以直接写入待办列表的任务清单。\n要求：\n1) 必须严格输出 JSON（不要有任何 Markdown）。\n2) 返回格式必须为一个对象：\n{\n  "day": ${dayIndex},\n  "tasks": [\n    {\n      "title": "任务标题（简短明确）",\n      "item_type": "task"|"rest",\n      "task_type": "study"|"self-study"|null,\n      "priority": "high"|"medium"|"low"|null,\n      "duration": 25\n    }\n  ]\n}\n3) 默认按番茄 25 分钟为粒度拆分学习任务，并在合适的位置插入 5 分钟休息（item_type=rest）。\n4) 任务标题不要太长，不要写AI思考过程，只给用户可执行的步骤。\n5) 你可以参考该 Roadmap 的标题：${roadmap.title}，节点标题：${node.title}。`;

    const res = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });
    const content = res.choices[0].message.content.trim();
    return JSON.parse(content);
  };

  const applyToToday = async () => {
    if (!selectedRoadmap || !selectedNode) return;
    const meta = getNodeMeta(selectedNode);
    const details = meta.details || '';
    if (!details.trim()) {
      alert('请先在“详情”里写清楚计划内容。');
      return;
    }

    const dayIndex = parseInt(meta.current_day_index || 1);
    if (Number.isNaN(dayIndex) || dayIndex <= 0) {
      alert('当前第几天必须是正整数。');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (meta.last_applied_date === todayStr && meta.last_applied_day === dayIndex) {
      const ok = window.confirm('今天已经落实过这一日计划，是否重新生成并再次导入？');
      if (!ok) return;
    }

    setApplyingToday(true);
    try {
      const version = (meta.details_version || 0) + 1;
      const cache = meta.ai_plan_cache && typeof meta.ai_plan_cache === 'object' ? meta.ai_plan_cache : { version: 0, days: {} };
      const cacheDays = cache.days && typeof cache.days === 'object' ? cache.days : {};

      let dayPlan = null;
      if (cache.version === meta.details_version && cacheDays[String(dayIndex)]) {
        dayPlan = { day: dayIndex, tasks: cacheDays[String(dayIndex)] };
      } else {
        dayPlan = await generateTasksFromDetails({
          roadmap: selectedRoadmap,
          node: selectedNode,
          dayIndex,
          details
        });
        const nextCache = {
          version: meta.details_version ?? version,
          days: {
            ...cacheDays,
            [String(dayIndex)]: dayPlan.tasks || []
          }
        };
        const nextMeta = {
          ...meta,
          details_version: meta.details_version ?? version,
          ai_plan_cache: nextCache
        };
        updateSelectedNode({ metadata: nextMeta });
        await supabase
          .from('roadmap_nodes')
          .update({ metadata: nextMeta })
          .eq('id', selectedNode.id)
          .eq('user_id', session.user.id);
        setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, metadata: nextMeta } : n));
      }

      const tasks = (dayPlan.tasks || []).filter(t => t && t.title && t.item_type && t.duration);
      if (!tasks.length) {
        alert('AI 没有生成可用的任务，请检查长文本描述是否足够清晰。');
        return;
      }

      setApplyPreview({
        roadmapTitle: selectedRoadmap.title,
        nodeTitle: selectedNode.title,
        day: dayIndex,
        tasks
      });
    } catch (e) {
      if (e?.code === 'AI_NOT_CONFIGURED' || e?.message === 'AI_NOT_CONFIGURED') {
        alert('尚未配置 AI Key，请先点右上角「AI 配置」完成配置。');
      } else {
        alert(`落实到今日失败：${e?.message || '未知错误'}`);
      }
    } finally {
      setApplyingToday(false);
    }
  };

  const confirmApply = async () => {
    if (!applyPreview) return;
    const payload = applyPreview.tasks.map(t => ({
      title: `【Roadmap】${applyPreview.nodeTitle} · 第${applyPreview.day}天：${t.title}`,
      item_type: t.item_type,
      task_type: t.item_type === 'task' ? (t.task_type || 'study') : null,
      priority: t.item_type === 'task' ? (t.priority || 'high') : null,
      duration: parseInt(t.duration)
    }));
    await onBatchAddTodos(payload);

    const todayStr = new Date().toISOString().split('T')[0];
    const meta = getNodeMeta(selectedNode);
    const dayIndex = applyPreview.day;
    const nextDay = dayIndex + 1;
    const nextMeta = {
      ...meta,
      last_applied_date: todayStr,
      last_applied_day: dayIndex,
      current_day_index: nextDay
    };
    updateSelectedNode({ metadata: nextMeta });
    await supabase
      .from('roadmap_nodes')
      .update({ metadata: nextMeta, status: 'in_progress' })
      .eq('id', selectedNode.id)
      .eq('user_id', session.user.id);
    setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, metadata: nextMeta, status: 'in_progress' } : n));
    setApplyPreview(null);
    setTimeout(() => {
      onNavigateToTodo?.();
    }, 150);
  };

  // ─── AI Generate Roadmap ───────────────────────────────
  const generateRoadmapAI = async () => {
    if (!aiGoal.trim()) return;
    setAiGeneratingLoading(true);
    try {
      const { client: openai, model } = getAIClient();
      const prompt = `你是一个专业的学习规划师。用户想要学习以下内容，请为他生成一个详细的长线学习计划。

【用户目标】
${aiGoal.trim()}

请输出严格 JSON（不要 Markdown）：
{
  "title": "学习计划标题（简洁）",
  "mode": "learn",
  "stages": [
    {
      "title": "阶段名称（如：第一阶段 基础入门）",
      "order_index": 1,
      "summary": "这个阶段的概述说明，简明描述本阶段的学习目标、核心内容和预期成果（50-100字）",
      "blocks": [
        {
          "title": "Block 标题（简洁明确）",
          "planned_minutes": 60,
          "order_index": 1,
          "details": "这个 Block 的长文本详情，需要详细写明每一天（第1天、第2天...）具体学什么、练什么，让 AI 后续可以根据当前第几天自动拆分出每日任务。如果这个 Block 包含 N 天内容，就写到第 N 天。每个 Block 的 details 要足够详细，至少100字。"
        }
      ]
    }
  ]
}

要求：
1. 根据目标复杂度，分成 2-5 个阶段
2. 每个阶段有 2-6 个 Block
3. 每个阶段必须填写 summary 字段，简明描述本阶段的学习目标和内容概要
4. 每个 Block 默认 60 分钟，planned_minutes 可调
5. 每个 Block 的 details 必须是详细的长文本，描述每天的学习内容和练习方式
6. mode 固定为 "learn"
7. 标题用中文，内容用中文`;

      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });
      const content = res.choices[0].message.content.trim();
      const plan = JSON.parse(content);
      setAiPreview(plan);
    } catch (e) {
      if (e?.code === 'AI_NOT_CONFIGURED' || e?.message === 'AI_NOT_CONFIGURED') {
        alert('尚未配置 AI Key，请先点右上角「AI 配置」完成配置。');
      } else {
        alert(`AI 生成失败：${e?.message || '未知错误'}`);
      }
    } finally {
      setAiGeneratingLoading(false);
    }
  };

  const confirmAIGenerated = async () => {
    if (!aiPreview) return;
    try {
      // 1. Create Roadmap
      const { data: rm, error: rmErr } = await supabase
        .from('roadmaps')
        .insert([{
          user_id: session.user.id,
          title: aiPreview.title,
          mode: aiPreview.mode || 'learn'
        }])
        .select()
        .single();
      if (rmErr) throw rmErr;

      // 2. Create stages and blocks
      const nodesToInsert = [];
      let globalOrder = 0;
      for (const stage of (aiPreview.stages || [])) {
        globalOrder++;
        const stageId = crypto.randomUUID();
        nodesToInsert.push({
          id: stageId,
          roadmap_id: rm.id,
          user_id: session.user.id,
          node_type: 'stage',
          title: stage.title,
          order_index: globalOrder,
          status: 'pending',
          metadata: stage.summary ? {
            details: stage.summary,
            details_version: 1,
            current_day_index: 1
          } : null
        });

        for (const block of (stage.blocks || [])) {
          globalOrder++;
          nodesToInsert.push({
            roadmap_id: rm.id,
            user_id: session.user.id,
            parent_id: stageId,
            node_type: 'block',
            title: block.title,
            order_index: globalOrder,
            planned_minutes: block.planned_minutes || 60,
            status: 'pending',
            metadata: block.details ? {
              details: block.details,
              details_version: 1,
              current_day_index: 1
            } : null
          });
        }
      }

      // Handle blocks without stages
      if ((aiPreview.blocks || []).length > 0) {
        for (const block of aiPreview.blocks) {
          globalOrder++;
          nodesToInsert.push({
            roadmap_id: rm.id,
            user_id: session.user.id,
            node_type: 'block',
            title: block.title,
            order_index: globalOrder,
            planned_minutes: block.planned_minutes || 60,
            status: 'pending',
            metadata: block.details ? {
              details: block.details,
              details_version: 1,
              current_day_index: 1
            } : null
          });
        }
      }

      if (nodesToInsert.length > 0) {
        // Insert stages first (those with UUID id), then blocks
        const stageInserts = nodesToInsert.filter(n => n.node_type === 'stage');
        const blockInserts = nodesToInsert.filter(n => n.node_type === 'block');

        if (stageInserts.length > 0) {
          const { error: sErr } = await supabase.from('roadmap_nodes').insert(stageInserts);
          if (sErr) throw sErr;
        }
        if (blockInserts.length > 0) {
          const { error: bErr } = await supabase.from('roadmap_nodes').insert(blockInserts);
          if (bErr) throw bErr;
        }
      }

      // 3. Reset and reload
      setAiPreview(null);
      setAiGoal('');
      setIsAIGenerating(false);
      await loadRoadmaps();
      await loadDetail(rm);
    } catch (e) {
      alert(`创建失败：${e?.message || '未知错误'}`);
    }
  };

  // ─── AI Fill Details for a single node ────────────────
  const fillNodeDetailsAI = async () => {
    if (!selectedNode || !selectedRoadmap) return;
    setIsAIFillingDetails(true);
    try {
      const { client: openai, model } = getAIClient();
      const meta = getNodeMeta(selectedNode);
      const existingDetails = meta.details || '';
      const prompt = `你是一个专业的学习规划师。用户有一个学习节点需要填充长文本计划。

【Roadmap 标题】${selectedRoadmap.title}
【节点标题】${selectedNode.title}
【节点时长】${selectedNode.planned_minutes || 60} 分钟
${existingDetails ? `【现有详情】${existingDetails}` : ''}

请输出严格 JSON：
{
  "details": "这个节点的长文本详情，需要详细写明每一天（第1天、第2天...）具体学什么、练什么，让 AI 后续可以根据当前第几天自动拆分出每日任务。把学习内容拆分成合理的天数（3-10天），每天的内容要具体可执行。"
}`;

      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });
      const content = res.choices[0].message.content.trim();
      const result = JSON.parse(content);
      setAiDetailsPreview(result.details || '');
    } catch (e) {
      if (e?.code === 'AI_NOT_CONFIGURED') {
        alert('尚未配置 AI Key，请先点右上角「AI 配置」完成配置。');
      } else {
        alert(`AI 填充失败：${e?.message || '未知错误'}`);
      }
    } finally {
      setIsAIFillingDetails(false);
    }
  };

  const confirmFillDetails = () => {
    if (!aiDetailsPreview || !selectedNode) return;
    const meta = getNodeMeta(selectedNode);
    // 先清空原有详情内容
    const clearedMeta = {
      ...meta,
      details: '',
      details_version: (meta.details_version || 0) + 1,
      current_day_index: meta.current_day_index || 1
    };
    // 再填入 AI 生成的新详情
    const nextMeta = {
      ...clearedMeta,
      details: aiDetailsPreview,
      details_version: (clearedMeta.details_version || 0) + 1
    };
    updateSelectedNode({ metadata: nextMeta });
    supabase
      .from('roadmap_nodes')
      .update({ metadata: nextMeta })
      .eq('id', selectedNode.id)
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        if (data) {
          setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, metadata: nextMeta } : n));
        }
      });
    setAiDetailsPreview(null);
  };

  // ─── Roadmap Exam Taking ──────────────────────────────
  const startExam = async (exam) => {
    setExamLoading(true);
    setTakingExam(exam);
    setExamAnswers({});
    setExamReport(null);
    try {
      const { client: openai, model } = getAIClient();
      const template = exam.template || {};
      const types = template.types || [
        { type: 'single', count: 5, score_per: 4 },
        { type: 'multi', count: 3, score_per: 6 },
        { type: 'blank', count: 3, score_per: 4 }
      ];

      const typeDesc = types.map(t => `${t.type === 'single' ? '单选题' : t.type === 'multi' ? '多选题' : t.type === 'blank' ? '填空题' : t.type === 'calc' ? '计算题' : '综合题'} ${t.count}道，每题${t.score_per}分`).join('；');

      const prompt = `你是一个专业的出题老师。请为以下学习计划生成一份试卷。

【考试类型】${exam.exam_type === 'weekly' ? '周考' : exam.exam_type === 'monthly' ? '月考' : '阶段考试'}
【Roadmap 标题】${selectedRoadmap.title}
${exam.scope ? `【考试范围】${JSON.stringify(exam.scope)}` : ''}

请输出严格 JSON：
{
  "questions": [
    {
      "type": "single|multi|blank|calc|comprehensive",
      "question": "题目内容（支持 $$LaTeX$$）",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "A",
      "score": 5
    }
  ]
}

要求：
1. 共${types.reduce((sum, t) => sum + t.count, 0)}道题：${typeDesc}
2. 多选题可能不止一个正确答案，answer 用逗号分隔（如 "A,C"）
3. 填空题 answer 是期望填入的内容
4. 题目内容用中文，公式用 $$ 包裹`;

      const res = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });
      const content = res.choices[0].message.content.trim();
      const data = JSON.parse(content);
      setExamQuestions(data.questions || []);
    } catch (e) {
      if (e?.code === 'AI_NOT_CONFIGURED') {
        alert('尚未配置 AI Key，请先点右上角「AI 配置」完成配置。');
      } else {
        alert(`生成试卷失败：${e?.message || '未知错误'}`);
      }
      setTakingExam(null);
    } finally {
      setExamLoading(false);
    }
  };

  const submitExam = async () => {
    if (!takingExam) return;
    setGradingExam(true);
    try {
      let totalScore = 0;
      let maxScore = 0;
      const details = examQuestions.map((q, idx) => {
        const userAns = (examAnswers[idx] || '').trim();
        const correctAns = (q.answer || '').trim();
        const qScore = q.score || 5;
        maxScore += qScore;

        const isCorrect = q.type === 'multi'
          ? (() => {
              const userSet = new Set(userAns.toUpperCase().split(',').map(s => s.trim()).filter(Boolean));
              const correctSet = new Set(correctAns.toUpperCase().split(',').map(s => s.trim()).filter(Boolean));
              return userSet.size === correctSet.size && [...userSet].every(v => correctSet.has(v));
            })()
          : userAns.toUpperCase() === correctAns.toUpperCase();

        if (isCorrect) totalScore += qScore;
        return { ...q, userAnswer: userAns, isCorrect, score: isCorrect ? qScore : 0 };
      });

      const report = {
        score: Math.round((totalScore / maxScore) * 100),
        totalScore,
        maxScore,
        details,
        passed: (totalScore / maxScore) * 100 >= (takingExam.pass_score || 60)
      };

      // Save to DB
      await supabase
        .from('roadmap_exams')
        .update({ status: 'completed', score: report.score })
        .eq('id', takingExam.id)
        .eq('user_id', session.user.id);

      // Save questions
      const questionInserts = details.map(d => ({
        exam_id: takingExam.id,
        user_id: session.user.id,
        question_type: d.type,
        question_content: d.question,
        options: d.options || null,
        user_answer: d.userAnswer || null,
        correct_answer: d.answer || '',
        is_correct: d.isCorrect,
        score: d.score
      }));
      if (questionInserts.length > 0) {
        await supabase.from('roadmap_exam_questions').insert(questionInserts);
      }

      // Refresh exams
      const { data: refreshed } = await supabase
        .from('roadmap_exams')
        .select('*')
        .eq('roadmap_id', selectedRoadmap.id)
        .eq('user_id', session.user.id)
        .order('scheduled_at', { ascending: false })
        .limit(10);
      setExams(refreshed || []);

      setExamReport(report);
    } catch (e) {
      alert(`提交失败：${e?.message || '未知错误'}`);
    } finally {
      setGradingExam(false);
    }
  };

  const closeExam = () => {
    setTakingExam(null);
    setExamQuestions([]);
    setExamAnswers({});
    setExamReport(null);
  };

  const createManualExam = async () => {
    if (!selectedRoadmap) return;
    try {
      const { error } = await supabase
        .from('roadmap_exams')
        .insert([{
          roadmap_id: selectedRoadmap.id,
          user_id: session.user.id,
          exam_type: 'manual',
          status: 'pending',
          scheduled_at: new Date().toISOString(),
          pass_score: 60,
          scope: manualExamScope.trim() || null
        }]);
      if (error) throw error;
      setShowManualExam(false);
      setManualExamScope('');
      // Refresh exams
      const { data: refreshed } = await supabase
        .from('roadmap_exams')
        .select('*')
        .eq('roadmap_id', selectedRoadmap.id)
        .eq('user_id', session.user.id)
        .order('scheduled_at', { ascending: false })
        .limit(10);
      setExams(refreshed || []);
    } catch (e) {
      alert(`创建考试失败：${e?.message || '未知错误'}`);
    }
  };

  const saveExamTemplate = async () => {
    if (!selectedRoadmap || !editTemplate) return;
    try {
      const { data, error } = await supabase
        .from('roadmaps')
        .update({ exam_template: editTemplate })
        .eq('id', selectedRoadmap.id)
        .eq('user_id', session.user.id)
        .select()
        .single();
      if (error) throw error;
      setSelectedRoadmap(data);
      setShowExamTemplate(false);
    } catch (e) {
      alert(`保存模板失败：${e?.message || '未知错误'}`);
    }
  };

  const addTemplateType = (type) => {
    setEditTemplate(prev => ({
      types: [...(prev?.types || []), { type, count: 5, score_per: 5 }]
    }));
  };

  const removeTemplateType = (idx) => {
    setEditTemplate(prev => ({
      types: (prev?.types || []).filter((_, i) => i !== idx)
    }));
  };

  const updateTemplateType = (idx, patch) => {
    setEditTemplate(prev => ({
      types: (prev?.types || []).map((t, i) => i === idx ? { ...t, ...patch } : t)
    }));
  };

  const templateTotalScore = useMemo(() => {
    if (!editTemplate?.types) return 0;
    return editTemplate.types.reduce((sum, t) => sum + (t.count || 0) * (t.score_per || 0), 0);
  }, [editTemplate]);

  const templateTypeLabel = (type) => {
    const map = { single: '单选', multi: '多选', blank: '填空', calc: '计算', comprehensive: '综合' };
    return map[type] || type;
  };

  return (
    <>
    <motion.div
      key="roadmap-view"
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.3 } }}
      className="w-full max-w-5xl flex flex-col gap-8 px-4 pb-20"
    >
      {!selectedRoadmap ? (
        <div className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold tracking-widest text-white/90 uppercase flex items-center gap-2">
              <Target size={20} className="text-[#00ffd1]" />
              长线规划
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsAIGenerating(true);
                  setAiGoal('');
                  setAiPreview(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8a5cff]/20 border border-[#8a5cff]/30 text-[#b998ff] hover:bg-[#8a5cff]/30 text-sm font-bold transition-all"
              >
                <Sparkles size={16} />
                AI 生成
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
              >
                <Plus size={16} />
                新建
              </button>
              {roadmaps.length > 0 && (
                <button
                  onClick={deleteAllRoadmaps}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:bg-red-500/20 text-sm font-bold transition-all"
                >
                  <Trash2 size={16} />
                  全部删除
                </button>
              )}
            </div>
          </div>

          {roadmaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/30 gap-4">
              <Trophy size={48} className="opacity-20" />
              <span className="text-sm font-bold tracking-widest">还没有 Roadmap，先建一个长期目标吧</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {roadmaps.map(rm => (
                <div
                  key={rm.id}
                  className="relative group text-left p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => loadDetail(rm)}
                >
                  <button
                    onClick={(e) => deleteRoadmap(rm.id, e)}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 border border-white/10 text-white/30 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className={rm.mode === 'sprint' ? 'text-[#ff5c7a]' : 'text-[#00ffd1]'} />
                        <h4 className="text-lg font-extrabold text-white/90">{rm.title}</h4>
                      </div>
                      <div className="text-xs text-white/50 font-bold tracking-widest uppercase">
                        {scheduleText(rm)}
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-black tracking-widest ${rm.mode === 'sprint' ? 'bg-[#ff5c7a]/15 text-[#ff5c7a] border border-[#ff5c7a]/20' : 'bg-[#00ffd1]/15 text-[#00ffd1] border border-[#00ffd1]/20'}`}>
                      {rm.mode === 'sprint' ? '冲刺' : '新知'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[30px] p-8">
          <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
            <button
              onClick={() => {
                setSelectedRoadmap(null);
                setNodes([]);
                setExams([]);
              }}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-xl font-bold tracking-widest text-white/90 uppercase flex items-center gap-2">
              <Target size={20} className="text-[#00ffd1]" />
              {selectedRoadmap.title}
            </h3>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSelectedNode({ _isNew: true, node_type: 'block', title: '', planned_minutes: selectedRoadmap.default_block_minutes, parent_id: null, planned_start_date: null, planned_end_date: null, metadata: { details: '', details_version: 1, current_day_index: 1 } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
              >
                <Plus size={16} />
                添加 Block
              </button>
              <button
                onClick={() => setSelectedNode({ _isNew: true, node_type: 'stage', title: '', planned_start_date: null, planned_end_date: null, metadata: { details: '', details_version: 1, current_day_index: 1 } })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
              >
                <Plus size={16} />
                添加阶段
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/60">
                <Timer size={14} className="text-[#00ffd1]" />
                学习节点（Block）
              </div>
              {blockNodes.length === 0 && stageNodes.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-sm font-bold tracking-widest">
                  还没有学习块，先添加一个 Block
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Reorder.Group axis="y" values={sortedStages} onReorder={handleStageReorder}>
                    {sortedStages.map(stage => {
                      const blocksInStage = (blocksByStage[stage.id] || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                      return (
                        <Reorder.Item key={stage.id} value={stage}>
                          <motion.div layout className="p-5 rounded-2xl border bg-white/5 border-white/10">
                            <div className="flex items-center justify-between gap-3 mb-4">
                              <div className="flex items-center gap-2">
                                <GripVertical size={14} className="text-white/30" />
                                <BookOpen size={18} className="text-[#ffb800]" />
                                <span className="text-white/90 font-extrabold text-lg">{stage.title}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setSelectedNode({ _isNew: true, node_type: 'block', title: '', planned_minutes: selectedRoadmap.default_block_minutes, parent_id: stage.id, planned_start_date: null, planned_end_date: null, metadata: { details: '', details_version: 1, current_day_index: 1 } })}
                                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                                  title="添加 Block"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={() => setSelectedNode(stage)}
                                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                                  title="编辑阶段"
                                >
                                  <Edit2 size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3">
                              {blocksInStage.length === 0 ? (
                                <div className="text-xs text-white/40 font-bold tracking-widest uppercase">暂无 Block（下方 Block 可拖入此阶段）</div>
                              ) : (
                                <Reorder.Group axis="y" values={blocksInStage} onReorder={(vals) => handleBlockReorder(stage.id, vals)}>
                                  {blocksInStage.map(b => {
                                    const sBadge = b.status === 'completed' ? '已完成' : b.status === 'in_progress' ? '进行中' : '待开始';
                                    const sClass = b.status === 'completed' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : b.status === 'in_progress' ? 'bg-[#00ffd1]/15 text-[#00ffd1] border border-[#00ffd1]/20' : 'bg-white/5 text-white/50 border border-white/10';
                                    return (
                                      <Reorder.Item key={b.id} value={b}>
                                        <motion.div layout className="p-4 rounded-2xl bg-black/30 border border-white/10 group">
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                              <GripVertical size={14} className="text-white/30 shrink-0" />
                                              <div className="flex flex-col gap-2 flex-1 min-w-0">
                                                <div className="text-white/90 font-extrabold truncate">{b.title}</div>
                                                <div className="text-xs text-white/50 font-bold tracking-widest uppercase">
                                                  {b.planned_minutes || selectedRoadmap.default_block_minutes} MIN · 番茄 {selectedRoadmap.default_pomodoro_minutes}+{selectedRoadmap.default_break_minutes}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              <div className="relative">
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); setMoveBlockId(moveBlockId === b.id ? null : b.id); }}
                                                  className="p-2 rounded-xl opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 text-white/40 hover:text-[#b998ff] hover:bg-[#b998ff]/10 hover:border-[#b998ff]/20 transition-all"
                                                  title="移动到其他阶段"
                                                >
                                                  <ArrowRightLeft size={14} />
                                                </button>
                                                {moveBlockId === b.id && (
                                                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[300] overflow-hidden" onClick={e => e.stopPropagation()}>
                                                    {sortedStages.filter(s => s.id !== (b.parent_id || null)).map(s => (
                                                      <button
                                                        key={s.id}
                                                        onClick={() => handleMoveBlock(b.id, s.id)}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10 font-bold transition-colors"
                                                      >
                                                        {s.title}
                                                      </button>
                                                    ))}
                                                    {b.parent_id && (
                                                      <button
                                                        onClick={() => handleMoveBlock(b.id, null)}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-[#00ffd1]/80 hover:text-[#00ffd1] hover:bg-white/10 font-bold transition-colors border-t border-white/5"
                                                      >
                                                        → 移出阶段（独立 Block）
                                                      </button>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                              <div className={`px-3 py-1 rounded-full text-xs font-black tracking-widest ${sClass}`}>
                                                {sBadge}
                                              </div>
                                              <button
                                                onClick={() => setSelectedNode(b)}
                                                className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                                                title="编辑"
                                              >
                                                <Edit2 size={16} />
                                              </button>
                                            </div>
                                          </div>
                                        </motion.div>
                                      </Reorder.Item>
                                    );
                                  })}
                                </Reorder.Group>
                              )}
                            </div>
                          </motion.div>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>

                  {stageNodes.length > 0 && (
                    <motion.div layout className="p-5 rounded-2xl border bg-white/5 border-white/10 border-dashed">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="text-white/90 font-extrabold text-lg flex items-center gap-2">
                          <Timer size={18} className="text-[#00ffd1]" />
                          未分组 Block
                        </div>
                      </div>
                      {(blocksByStage.__root__ || []).length === 0 ? (
                        <div className="text-xs text-white/30 font-bold tracking-widest uppercase py-2">使用 → 按钮将 Block 移出阶段</div>
                      ) : (
                        <Reorder.Group axis="y" values={blocksByStage.__root__ || []} onReorder={(vals) => handleBlockReorder('__root__', vals)}>
                          {(blocksByStage.__root__ || []).map(b => {
                            const sBadge = b.status === 'completed' ? '已完成' : b.status === 'in_progress' ? '进行中' : '待开始';
                            const sClass = b.status === 'completed' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : b.status === 'in_progress' ? 'bg-[#00ffd1]/15 text-[#00ffd1] border border-[#00ffd1]/20' : 'bg-white/5 text-white/50 border border-white/10';
                            return (
                              <Reorder.Item key={b.id} value={b}>
                                <motion.div layout className="p-4 rounded-2xl bg-black/30 border border-white/10 group">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <GripVertical size={14} className="text-white/30 shrink-0" />
                                      <div className="flex flex-col gap-2 flex-1 min-w-0">
                                        <div className="text-white/90 font-extrabold truncate">{b.title}</div>
                                        <div className="text-xs text-white/50 font-bold tracking-widest uppercase">
                                          {b.planned_minutes || selectedRoadmap.default_block_minutes} MIN · 番茄 {selectedRoadmap.default_pomodoro_minutes}+{selectedRoadmap.default_break_minutes}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <div className="relative">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setMoveBlockId(moveBlockId === b.id ? null : b.id); }}
                                          className="p-2 rounded-xl opacity-0 group-hover:opacity-100 bg-white/5 border border-white/10 text-white/40 hover:text-[#b998ff] hover:bg-[#b998ff]/10 hover:border-[#b998ff]/20 transition-all"
                                          title="移动到阶段"
                                        >
                                          <ArrowRightLeft size={14} />
                                        </button>
                                        {moveBlockId === b.id && (
                                          <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[300] overflow-hidden" onClick={e => e.stopPropagation()}>
                                            {sortedStages.map(s => (
                                              <button
                                                key={s.id}
                                                onClick={() => handleMoveBlock(b.id, s.id)}
                                                className="w-full text-left px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10 font-bold transition-colors"
                                              >
                                                {s.title}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className={`px-3 py-1 rounded-full text-xs font-black tracking-widest ${sClass}`}>
                                        {sBadge}
                                      </div>
                                      <button
                                        onClick={() => setSelectedNode(b)}
                                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                                        title="编辑"
                                      >
                                        <Edit2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              </Reorder.Item>
                            );
                          })}
                        </Reorder.Group>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/60">
                <ClipboardList size={14} className="text-[#ff5c7a]" />
                最近考试
                {selectedRoadmap.mode === 'learn' && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => { setShowManualExam(true); setManualExamScope(''); }}
                      className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-[10px] font-bold transition-all"
                    >
                      手动生成试卷
                    </button>
                    <button
                      onClick={() => {
                        setEditTemplate(selectedRoadmap.exam_template || { types: [{ type: 'single', count: 10, score_per: 5 }] });
                        setShowExamTemplate(true);
                      }}
                      className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-[10px] font-bold transition-all"
                    >
                      试卷模板
                    </button>
                  </div>
                )}
              </div>
              {exams.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-sm font-bold tracking-widest">
                  暂无考试记录
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {exams.map(ex => (
                    <div key={ex.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-white/90 font-extrabold text-sm flex items-center gap-2">
                            <Trophy size={14} className="text-[#ffb800]" />
                            {ex.exam_type === 'weekly' ? '周考' : ex.exam_type === 'monthly' ? '月考' : ex.exam_type === 'stage' ? '阶段卷' : '考试'}
                          </div>
                          <div className="text-xs text-white/40 font-mono">
                            {new Date(ex.scheduled_at).toLocaleString()}
                          </div>
                        </div>
                        {ex.status === 'pending' ? (
                          <button
                            onClick={() => startExam(ex)}
                            className="px-3 py-1.5 rounded-lg bg-[#00ffd1]/20 border border-[#00ffd1]/30 text-[#00ffd1] hover:bg-[#00ffd1]/30 text-xs font-bold transition-colors"
                          >
                            开始考试
                          </button>
                        ) : (
                          <div className={`px-3 py-1 rounded-full text-xs font-black tracking-widest ${ex.score >= ex.pass_score ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                            {ex.score ?? 0}/{ex.pass_score}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {stageNodes.length > 0 && (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/60 mb-4">
                    <Timer size={14} className="text-[#8a5cff]" />
                    阶段节点
                  </div>
                  <div className="flex flex-col gap-3">
                    {stageNodes.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-3">
                        <div className="text-white/80 text-sm font-bold">{s.title}</div>
                        <div className="text-xs text-white/40 font-mono">{s.planned_start_date || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>

      {/* AI Generate Roadmap Modal */}
      <AnimatePresence>
        {isAIGenerating && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setIsAIGenerating(false); setAiPreview(null); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <Bot size={20} className="text-[#8a5cff]" />
                  AI 生成长线计划
                </div>
                <button
                  onClick={() => { setIsAIGenerating(false); setAiPreview(null); }}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {!aiPreview ? (
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">你想学习什么？</div>
                    <textarea
                      value={aiGoal}
                      onChange={(e) => setAiGoal(e.target.value)}
                      rows={4}
                      placeholder="例如：30天学会React前端开发，从零到能独立做项目"
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#8a5cff]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20 resize-none"
                    />
                    <div className="text-xs text-white/30 leading-relaxed">
                      AI 会根据你的目标自动生成阶段、学习块和详细计划。
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => { setIsAIGenerating(false); setAiPreview(null); }}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                    >
                      取消
                    </button>
                    <button
                      onClick={generateRoadmapAI}
                      disabled={aiGeneratingLoading || !aiGoal.trim()}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#8a5cff] text-white font-extrabold text-sm hover:bg-[#8a5cff]/90 transition-colors disabled:opacity-50"
                    >
                      {aiGeneratingLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {aiGeneratingLoading ? '生成中...' : '开始生成'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                  <div className="text-sm text-white/60 mb-2">AI 为你规划了以下学习计划：</div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-white font-extrabold text-lg mb-4 flex items-center gap-2">
                      <Target size={18} className="text-[#00ffd1]" />
                      {aiPreview.title}
                    </div>
                    {(aiPreview.stages || []).map((stage, si) => (
                      <div key={si} className="mb-4 last:mb-0">
                        <div className="text-[#ffb800] font-bold text-sm mb-2 flex items-center gap-2">
                          <BookOpen size={14} />
                          {stage.title}
                        </div>
                        <div className="flex flex-col gap-2 pl-6">
                          {(stage.blocks || []).map((block, bi) => (
                            <div key={bi} className="p-3 rounded-xl bg-black/30 border border-white/5">
                              <div className="text-white/80 font-bold text-sm">{block.title}</div>
                              <div className="text-xs text-white/40 mt-1">{block.planned_minutes || 60} MIN</div>
                              {block.details && (
                                <div className="text-xs text-white/30 mt-1 line-clamp-2">{block.details.slice(0, 100)}...</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(aiPreview.blocks || []).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="text-white/60 font-bold text-sm mb-2 flex items-center gap-2">
                          <Timer size={14} className="text-[#00ffd1]" />
                          未分组 Block
                        </div>
                        {(aiPreview.blocks || []).map((block, bi) => (
                          <div key={bi} className="p-3 rounded-xl bg-black/30 border border-white/5 mb-2">
                            <div className="text-white/80 font-bold text-sm">{block.title}</div>
                            <div className="text-xs text-white/40 mt-1">{block.planned_minutes || 60} MIN</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setAiPreview(null)}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                    >
                      重新生成
                    </button>
                    <button
                      onClick={confirmAIGenerated}
                      className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                    >
                      确认导入
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Fill Details Preview Modal */}
      {createPortal(
        <AnimatePresence>
        {aiDetailsPreview !== null && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAiDetailsPreview(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <Bot size={20} className="text-[#8a5cff]" />
                  AI 填充详情预览
                </div>
                <button
                  onClick={() => setAiDetailsPreview(null)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[50vh] overflow-y-auto">
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{aiDetailsPreview}</div>
              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
                <button
                  onClick={() => setAiDetailsPreview(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                >
                  取消
                </button>
                <button
                  onClick={confirmFillDetails}
                  className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                >
                  确认填入
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* Create Roadmap Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsCreating(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <Target size={20} className="text-[#00ffd1]" />
                  新建 Roadmap
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">Roadmap 名称</label>
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="例如：30天学会Vue / 高三数学上1-2章"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setNewMode('learn')}
                      className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${newMode === 'learn' ? 'bg-[#00ffd1] text-black border-[#00ffd1]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                    >
                      新知学习模式
                    </button>
                    <button
                      onClick={() => setNewMode('sprint')}
                      className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${newMode === 'sprint' ? 'bg-[#ff5c7a] text-black border-[#ff5c7a]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                    >
                      冲刺模式
                    </button>
                  </div>

                  {newMode === 'sprint' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-white/80 flex items-center gap-2"><ClipboardList size={16} className="text-[#00ffd1]" />周考</span>
                          <button
                            onClick={() => setWeeklyEnabled(!weeklyEnabled)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${weeklyEnabled ? 'bg-[#00ffd1]/20 text-[#00ffd1] border-[#00ffd1]/30' : 'bg-white/5 text-white/50 border-white/10'}`}
                          >
                            {weeklyEnabled ? '已开启' : '未开启'}
                          </button>
                        </div>
                        {weeklyEnabled && (
                          <div className="flex items-center gap-3">
                            <select
                              value={weeklyDow}
                              onChange={(e) => setWeeklyDow(parseInt(e.target.value))}
                              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm outline-none"
                            >
                              {[0, 1, 2, 3, 4, 5, 6].map(d => (
                                <option key={d} value={d}>{formatDow(d)}</option>
                              ))}
                            </select>
                            <input
                              type="time"
                              value={weeklyTime}
                              onChange={(e) => setWeeklyTime(e.target.value)}
                              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm outline-none"
                            />
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-white/80 flex items-center gap-2"><CalendarDays size={16} className="text-[#ff5c7a]" />月考</span>
                          <button
                            onClick={() => setMonthlyEnabled(!monthlyEnabled)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${monthlyEnabled ? 'bg-[#ff5c7a]/20 text-[#ff5c7a] border-[#ff5c7a]/30' : 'bg-white/5 text-white/50 border-white/10'}`}
                          >
                            {monthlyEnabled ? '已开启' : '未开启'}
                          </button>
                        </div>
                        {monthlyEnabled && (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setMonthlyLast(true)}
                                className={`flex-1 px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${monthlyLast ? 'bg-[#ff5c7a] text-black border-[#ff5c7a]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                              >
                                最后一天
                              </button>
                              <button
                                onClick={() => setMonthlyLast(false)}
                                className={`flex-1 px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${!monthlyLast ? 'bg-[#ff5c7a] text-black border-[#ff5c7a]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
                              >
                                指定日期
                              </button>
                            </div>
                            {!monthlyLast && (
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={monthlyDay}
                                onChange={(e) => setMonthlyDay(parseInt(e.target.value || '1'))}
                                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm outline-none"
                              />
                            )}
                            <input
                              type="time"
                              value={monthlyTime}
                              onChange={(e) => setMonthlyTime(e.target.value)}
                              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-sm outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreateRoadmap}
                      className="px-4 py-2 rounded-xl bg-[#00ffd1] text-black text-sm font-bold hover:bg-[#00ffd1]/90"
                    >
                      创建
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {selectedNode && (
            <div className="fixed inset-0 z-[310] pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 pointer-events-auto"
              onClick={() => setSelectedNode(null)}
            />
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', bounce: 0.1, duration: 0.5 }}
              className="absolute top-0 right-0 h-full w-[420px] max-w-[90vw] bg-[#0b0b0b] border-l border-white/10 shadow-2xl pointer-events-auto flex flex-col"
            >
              <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="text-white font-extrabold tracking-widest">
                  {selectedNode._isNew
                    ? (selectedNode.node_type === 'stage' ? '新建阶段' : '新建 Block')
                    : (selectedNode.node_type === 'stage' ? '编辑阶段' : '编辑 Block')}
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">标题</div>
                  <input
                    value={selectedNode.title}
                    onChange={(e) => updateSelectedNode({ title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
                  />
                </div>

                {selectedNode.node_type === 'block' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">时长（分钟）</div>
                      <input
                        type="number"
                        value={selectedNode.planned_minutes || selectedRoadmap.default_block_minutes}
                        onChange={(e) => updateSelectedNode({ planned_minutes: parseInt(e.target.value || '0') })}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">所属阶段</div>
                      <select
                        value={selectedNode.parent_id || ''}
                        onChange={(e) => updateSelectedNode({ parent_id: e.target.value || null })}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white"
                      >
                        <option value="">未分组</option>
                        {stageNodes.filter(s => s.id !== selectedNode.id).sort((a, b) => (a.order_index || 0) - (b.order_index || 0)).map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">开始日期（可空）</div>
                    <input
                      type="date"
                      value={selectedNode.planned_start_date || ''}
                      onChange={(e) => updateSelectedNode({ planned_start_date: e.target.value || null })}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">结束日期（可空）</div>
                    <input
                      type="date"
                      value={selectedNode.planned_end_date || ''}
                      onChange={(e) => updateSelectedNode({ planned_end_date: e.target.value || null })}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">详情（长文本计划）</div>
                    <button
                      onClick={fillNodeDetailsAI}
                      disabled={isAIFillingDetails}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#8a5cff]/20 border border-[#8a5cff]/30 text-[#b998ff] hover:bg-[#8a5cff]/30 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isAIFillingDetails ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                      AI 填充
                    </button>
                  </div>
                  <textarea
                    value={getNodeMeta(selectedNode).details || ''}
                    onChange={(e) => {
                      const meta = getNodeMeta(selectedNode);
                      updateSelectedNode({ metadata: { ...meta, details: e.target.value, details_version: (meta.details_version || 0) + 1 } });
                    }}
                    rows={10}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20 resize-none"
                    placeholder="在这里写明这个 Block / 阶段要如何落实到每天（第1天/第2天/...）。"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">当前第几天</div>
                    <input
                      type="number"
                      value={getNodeMeta(selectedNode).current_day_index || 1}
                      onChange={(e) => {
                        const meta = getNodeMeta(selectedNode);
                        updateSelectedNode({ metadata: { ...meta, current_day_index: parseInt(e.target.value || '1') } });
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">最近落实</div>
                    <div className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white/60 text-sm font-mono">
                      {getNodeMeta(selectedNode).last_applied_date ? `${getNodeMeta(selectedNode).last_applied_date} · 第${getNodeMeta(selectedNode).last_applied_day}天` : '-'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-white/10 bg-black/40 flex flex-wrap justify-end gap-3">
                {!selectedNode._isNew && (
                  <button
                    onClick={applyToToday}
                    disabled={applyingToday}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8a5cff]/20 border border-[#8a5cff]/30 text-[#b998ff] hover:bg-[#8a5cff]/30 text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {applyingToday ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                    落实到今日
                  </button>
                )}
                {!selectedNode._isNew && (
                  <button
                    onClick={deleteNode}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm font-bold transition-colors"
                  >
                    <Trash2 size={16} />
                    删除
                  </button>
                )}
                <button
                  onClick={saveNode}
                  disabled={drawerSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors disabled:opacity-50"
                >
                  {drawerSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {createPortal(
        <AnimatePresence>
        {applyPreview && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApplyPreview(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest">
                  今日任务预览 · 第{applyPreview.day}天
                </div>
                <button
                  onClick={() => setApplyPreview(null)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {applyPreview.tasks.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${t.item_type === 'rest' ? 'bg-[#ffb800]' : 'bg-[#00ffd1]'}`} />
                    <div className="flex-1 text-white/90 font-bold text-sm">
                      {t.title}
                    </div>
                    <div className="text-xs text-white/40 font-mono">
                      {t.duration} MIN
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
                <button
                  onClick={() => setApplyPreview(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                >
                  取消
                </button>
                <button
                  onClick={confirmApply}
                  className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                >
                  确认导入
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {/* Roadmap Exam Taking Modal */}
      <AnimatePresence>
        {takingExam && (
          <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { if (!examReport && !examLoading && window.confirm('确定要退出考试吗？')) closeExam(); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl max-h-[90vh] bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 shrink-0">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <Trophy size={20} className="text-[#ffb800]" />
                  {takingExam.exam_type === 'weekly' ? '周考' : takingExam.exam_type === 'monthly' ? '月考' : '阶段考试'}
                  {!examReport && <span className="text-xs text-white/40 font-mono ml-2">及格线 {takingExam.pass_score || 60} 分</span>}
                </div>
                <button
                  onClick={closeExam}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {examLoading ? (
                <div className="flex-1 flex items-center justify-center p-12">
                  <Loader2 size={40} className="animate-spin text-[#00ffd1]" />
                </div>
              ) : examReport ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="text-center">
                    <div className={`text-5xl font-black mb-2 ${examReport.passed ? 'text-[#00ffd1]' : 'text-[#ff5c7a]'}`}>
                      {examReport.score} 分
                    </div>
                    <div className={`text-lg font-bold ${examReport.passed ? 'text-green-400' : 'text-red-400'}`}>
                      {examReport.passed ? '及格！' : '不及格，继续加油！'}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      得分 {examReport.totalScore}/{examReport.maxScore} · 及格线 {takingExam.pass_score || 60}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {examReport.details.map((q, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border ${q.isCorrect ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-white/40">第 {idx + 1} 题</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${q.isCorrect ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                                {q.isCorrect ? '正确' : '错误'} · {q.score}分
                              </span>
                            </div>
                            <div className="text-white/80 text-sm">{q.question}</div>
                          </div>
                        </div>
                        {q.options && (
                          <div className="flex flex-wrap gap-2 mt-2 ml-2">
                            {q.options.map((opt, oi) => {
                              const label = String.fromCharCode(65 + oi);
                              const isUser = q.userAnswer?.toUpperCase().includes(label);
                              const isCorrect = q.answer?.toUpperCase().includes(label);
                              return (
                                <span key={oi} className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                                  isCorrect && isUser ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                  isCorrect ? 'bg-green-500/10 border-green-500/20 text-green-400/70' :
                                  isUser ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                  'bg-white/5 border-white/10 text-white/40'
                                }`}>
                                  {label}. {opt.replace(/^[A-D][.、]\s*/, '')}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {!q.isCorrect && (
                          <div className="mt-2 text-xs text-[#ffb800]">
                            正确答案：{q.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={closeExam}
                      className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                    >
                      完成
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {examQuestions.map((q, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-bold text-white/40 bg-white/10 px-2.5 py-1 rounded-full">
                          第 {idx + 1} 题
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          q.type === 'single' ? 'bg-blue-500/15 text-blue-400' :
                          q.type === 'multi' ? 'bg-[#8a5cff]/15 text-[#b998ff]' :
                          q.type === 'blank' ? 'bg-[#ffb800]/15 text-[#ffb800]' :
                          'bg-[#ff5c7a]/15 text-[#ff5c7a]'
                        }`}>
                          {q.type === 'single' ? '单选' : q.type === 'multi' ? '多选' : q.type === 'blank' ? '填空' : q.type === 'calc' ? '计算' : '综合'}
                        </span>
                        <span className="text-xs text-white/30 ml-auto">{q.score || 5} 分</span>
                      </div>
                      <div className="text-white/80 text-sm mb-4 leading-relaxed">{q.question}</div>

                      {q.type === 'blank' || q.type === 'calc' || q.type === 'comprehensive' ? (
                        <textarea
                          value={examAnswers[idx] || ''}
                          onChange={(e) => setExamAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                          rows={2}
                          placeholder="输入你的答案..."
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none text-sm text-white placeholder-white/20 resize-none"
                        />
                      ) : q.options ? (
                        <div className="flex flex-col gap-2">
                          {q.options.map((opt, oi) => {
                            const label = String.fromCharCode(65 + oi);
                            const isSelected = q.type === 'multi'
                              ? (examAnswers[idx] || '').toUpperCase().includes(label)
                              : examAnswers[idx] === label;
                            return (
                              <button
                                key={oi}
                                onClick={() => {
                                  if (q.type === 'multi') {
                                    const current = (examAnswers[idx] || '').toUpperCase();
                                    const labels = current.split(',').map(s => s.trim()).filter(Boolean);
                                    const newLabels = labels.includes(label)
                                      ? labels.filter(l => l !== label)
                                      : [...labels, label];
                                    setExamAnswers(prev => ({ ...prev, [idx]: newLabels.sort().join(',') }));
                                  } else {
                                    setExamAnswers(prev => ({ ...prev, [idx]: label }));
                                  }
                                }}
                                className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-[#00ffd1]/20 border-[#00ffd1]/40 text-[#00ffd1]'
                                    : 'bg-black/40 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                                }`}
                              >
                                {label}. {opt.replace(/^[A-D][.、]\s*/, '')}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      onClick={submitExam}
                      disabled={gradingExam}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors disabled:opacity-50"
                    >
                      {gradingExam ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      提交试卷
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Exam Modal */}
      <AnimatePresence>
        {showManualExam && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowManualExam(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <ClipboardList size={20} className="text-[#ff5c7a]" />
                  手动生成试卷
                </div>
                <button
                  onClick={() => setShowManualExam(false)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">考试范围（可选）</div>
                  <textarea
                    value={manualExamScope}
                    onChange={(e) => setManualExamScope(e.target.value)}
                    rows={3}
                    placeholder="例如：覆盖第1-5个Block的内容"
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none transition-all text-sm font-medium text-white placeholder-white/20 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowManualExam(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                  >
                    取消
                  </button>
                  <button
                    onClick={createManualExam}
                    className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                  >
                    生成考试
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Exam Template Editor Modal */}
      <AnimatePresence>
        {showExamTemplate && editTemplate && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowExamTemplate(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                <div className="text-white font-extrabold tracking-widest flex items-center gap-2">
                  <Edit2 size={20} className="text-[#ffb800]" />
                  试卷模板
                </div>
                <button
                  onClick={() => setShowExamTemplate(false)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {(editTemplate.types || []).map((t, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white/80">{templateTypeLabel(t.type)}</span>
                      <button
                        onClick={() => removeTemplateType(idx)}
                        className="p-1 text-white/30 hover:text-[#ff5c7a] transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-white/40 uppercase">数量</div>
                        <input
                          type="number"
                          min={1}
                          value={t.count}
                          onChange={(e) => updateTemplateType(idx, { count: parseInt(e.target.value || '1') })}
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none text-sm text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold text-white/40 uppercase">每题分数</div>
                        <input
                          type="number"
                          min={1}
                          value={t.score_per}
                          onChange={(e) => updateTemplateType(idx, { score_per: parseInt(e.target.value || '1') })}
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-[#00ffd1]/50 outline-none text-sm text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {['single', 'multi', 'blank', 'calc', 'comprehensive'].map(type => (
                    <button
                      key={type}
                      onClick={() => addTemplateType(type)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 text-xs font-bold transition-all"
                    >
                      + {templateTypeLabel(type)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-sm font-bold text-[#00ffd1]">总分：{templateTotalScore} 分</span>
                </div>
              </div>
              <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-3">
                <button
                  onClick={() => setShowExamTemplate(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold"
                >
                  取消
                </button>
                <button
                  onClick={saveExamTemplate}
                  className="px-5 py-2 rounded-xl bg-[#00ffd1] text-black font-extrabold text-sm hover:bg-[#00ffd1]/90 transition-colors"
                >
                  保存模板
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
        {confirmDeleteRoadmap && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmDeleteRoadmap(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 size={28} className="text-red-400" />
                </div>
                <div className="text-center space-y-2">
                  <div className="text-lg font-extrabold text-white">确认删除这个 Roadmap？</div>
                  <div className="text-sm text-white/50">其下所有阶段、Block 和考试数据都将被删除，此操作不可撤销。</div>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => setConfirmDeleteRoadmap(null)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDeleteRoadmapAction}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500/90 text-white font-extrabold text-sm hover:bg-red-500 transition-all"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {createPortal(
        <AnimatePresence>
        {confirmDeleteAllRoadmaps && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmDeleteAllRoadmaps(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 size={28} className="text-red-400" />
                </div>
                <div className="text-center space-y-2">
                  <div className="text-lg font-extrabold text-white">确认删除全部 Roadmap？</div>
                  <div className="text-sm text-white/50">
                    将删除全部 <span className="text-red-400 font-bold">{roadmaps.length}</span> 个 Roadmap，所有阶段、Block 和考试数据都将被永久删除，此操作不可撤销。
                  </div>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => setConfirmDeleteAllRoadmaps(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDeleteAllRoadmapsAction}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500/90 text-white font-extrabold text-sm hover:bg-red-500 transition-all"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}

      {createPortal(
        <AnimatePresence>
        {confirmDeleteNode && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirmDeleteNode(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0b] border border-white/10 rounded-[24px] shadow-2xl overflow-hidden"
            >
              <div className="p-6 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 size={28} className="text-red-400" />
                </div>
                <div className="text-center space-y-2">
                  <div className="text-lg font-extrabold text-white">
                    {selectedNode?.node_type === 'stage' ? '确认删除这个阶段？' : '确认删除这个 Block？'}
                  </div>
                  <div className="text-sm text-white/50">此操作不可撤销。</div>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => setConfirmDeleteNode(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 text-sm font-bold transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDeleteNodeAction}
                    className="flex-1 px-4 py-3 rounded-xl bg-red-500/90 text-white font-extrabold text-sm hover:bg-red-500 transition-all"
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </>
  );
};

export default RoadmapView;
