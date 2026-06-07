import { getAIClient } from './aiClient';

export const generateSimilarQuestion = async (originalQuestion, analysis) => {
  try {
    const { client: openai, model } = getAIClient();
    const prompt = `你是一个非常专业的各学科出题老师。
用户刚刚做过这样一道题，并且看了它的解析：
【原题】：${originalQuestion}
【解析】：${analysis}

请你根据这道题考察的核心知识点，**举一反三**，生成 1 道**类似但不同**的全新练习题。
要求：
1. 必须以严格的 JSON 格式返回，不要有任何额外的 Markdown 标记（如 \`\`\`json 等）。
2. JSON 格式必须为一个对象，包含 questions 数组（里面只有1道题），如下：
{
  "questions": [
    {
      "id": 999,
      "subject": "推断出的学科名",
      "question": "全新题目的具体内容。请务必使用双美元符号 $$包裹独立公式$$，单美元符号 $包裹行内公式$ 来确保数学公式渲染美观。",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "正确选项的字母，如 A"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.questions ? parsed.questions[0] : (Array.isArray(parsed) ? parsed[0] : parsed);
  } catch (error) {
    console.error("生成相似题目失败:", error);
    throw error;
  }
};

export const generateQuiz = async (topic) => {
  try {
    const { client: openai, model } = getAIClient();
    const prompt = `你是一个非常专业且平易近人的各学科出题老师。请根据用户提供的学习主题：“${topic}”，生成 3 道相关的练习题。
这可能是高数、物理、英语或任何学科。
要求：
1. 题目难度适中。
2. 必须以严格的 JSON 格式返回，不要有任何额外的 Markdown 标记（如 \`\`\`json 等）。
3. JSON 格式必须为一个对象，包含 questions 数组，如下：
{
  "questions": [
    {
      "id": 1,
      "subject": "推断出的学科名，例如：高等数学",
      "question": "题目的具体内容，请务必使用双美元符号 $$包裹独立公式$$，单美元符号 $包裹行内公式$ 来确保数学公式（如分式 \\frac{a}{b}、积分 \\int）能正确且美观地渲染上下结构。",
      "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
      "answer": "正确选项的字母，如 A"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    // 尝试移除可能的 markdown 代码块标记
    const jsonStr = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    return parsed.questions || parsed;
  } catch (error) {
    console.error("生成题目失败:", error);
    throw error;
  }
};

export const gradeQuiz = async (quizData, userAnswers) => {
  try {
    const { client: openai, model } = getAIClient();
    const prompt = `你是一个非常专业、耐心且逻辑清晰的批改老师。
这里是一份测试卷的题目和用户的答案：
题目数据：${JSON.stringify(quizData)}
用户答案：${JSON.stringify(userAnswers)}

请对用户的答卷进行批改。
要求：
1. 必须以严格的 JSON 格式返回，不要有任何额外的 Markdown 标记（如 \`\`\`json 等）。
2. JSON 格式如下：
{
  "score": 100, // 总分100，根据答对比例给分
  "details": [
    {
      "id": 1, // 对应题目的id
      "isCorrect": true/false, // 是否正确
      "analysis": "这道题的详细解析。排版要求极高：必须分点换行，不能挤在一坨！请直接给出正确的解题过程，**绝不要**输出你的内部思考过程，也**绝不要**输出算错或自我纠正的过程。直接给出标准答案的推导。\n格式范例：\n【考点分析】\n（直接说明本题考查了什么知识点和核心公式，1-2句话）\n\n【解题过程】\n1. （简要说明这一步的目的，例如：根据XXX公式，代入数据：）\n\n$$独立的计算公式$$\n\n2. （简要说明下一步计算：）\n\n$$独立的计算公式$$\n\n【总结】\n...\n\n注意：每一个独立的计算公式必须单独写在一行，前后必须有换行符，并使用双美元符号 $$ 包裹，行内公式使用单美元符号 $ 包裹。"
    },
    ...
  ],
  "summary": "对本次测验的整体评价，语气要像老师一样鼓励学生，并准确指出薄弱点及后续学习建议。"
}`;

    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content.trim();
    const jsonStr = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("批改题目失败:", error);
    throw error;
  }
};
