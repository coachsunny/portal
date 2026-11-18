// ==============================================================================
// 小牧学习小助手 - 问答与讲义知识库检索 API
// POST /api/assistant/chat
// Body: { message, classId, history }
// ==============================================================================

export async function onRequestPost(context) {
  const { request, env } = context;

  // 设置 CORS 头部
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { message, classId, history = [], lang = 'traditional' } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: '提问内容不能为空' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const deepseekApiKey = env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      return new Response(JSON.stringify({
        error: '服务端未配置 DEEPSEEK_API_KEY。请在 Cloudflare 环境变量中添加此密钥。'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const supabaseUrl = env.SUPABASE_URL || 'https://subwcjqahjbgkdrocyoz.supabase.co';
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_g8JbxP_AvORrvkQntqMbSA_HOOlrsP-';

    let relevantChunks = [];

    // 1. 生成问题的 1024 维 BGE-M3 向量并检索知识库
    if (env.AI) {
      try {
        const embedResult = await env.AI.run('@cf/baai/bge-m3', {
          text: [message.trim()]
        });

        const queryEmbedding = embedResult?.data?.[0] || embedResult?.[0];

        if (Array.isArray(queryEmbedding) && queryEmbedding.length > 0) {
          // 2. 调用 Supabase match_document_chunks 存储过程
          const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/match_document_chunks`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query_embedding: queryEmbedding,
              match_threshold: 0.35,
              match_count: 4,
              filter_class_id: classId ? parseInt(classId) : null
            })
          });

          if (rpcRes.ok) {
            const data = await rpcRes.json();
            if (Array.isArray(data)) {
              relevantChunks = data;
            }
          } else {
            console.warn('Supabase match_document_chunks RPC 响应异常:', await rpcRes.text());
          }
        }
      } catch (embedError) {
        console.warn('向量检索失败，降级为常规解答模式:', embedError.message);
      }
    }

    // 3. 构建来源引用出处
    const sources = [];
    const sourceMap = new Map();
    for (const chunk of relevantChunks) {
      const key = `${chunk.resource_title}_P${chunk.page_number}`;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, true);
        sources.push({
          resourceId: chunk.resource_id,
          title: chunk.resource_title,
          pageNumber: chunk.page_number,
          similarity: Math.round((chunk.similarity || 0) * 100)
        });
      }
    }

    // 4. 构建讲义参考上下文
    let contextPrompt = '';
    if (relevantChunks.length > 0) {
      contextPrompt = '【参考课程讲义资料】：\n' + relevantChunks.map((c, i) => {
        return `[资料片段 ${i + 1}] 出处：《${c.resource_title}》第 ${c.page_number} 页：\n${c.content}`;
      }).join('\n\n') + '\n\n';
    } else {
      contextPrompt = '【讲义检索情况】：知识库中暂未检索到直接匹配的切片，请根据通用专业教练知识亲切回答，并说明此回答为通用指引。\n\n';
    }

    // 5. 构建 DeepSeek 提示词
    const systemInstruction = `你是「自牧平施教练班」的专属 AI 学习小助手「小牧」。
你是一位温和、笃定、善于启发与倾听的伴学助教，深具教练素养（以学员为中心、不批判、重觉察）。

【回答规范】：
1. 请优先参考下方提供的【参考课程讲义资料】来回答学员的问题。
2. 解答要清晰、条理分明，适度运用粗体与要点列项（Bullet points）。
3. 如果讲义中有提及，请准确转述其精髓；若讲义中未提及，请诚实说明讲义中未详述此点，并建议学员向带班教练或通过「学员提问」功能请教，切勿臆造虚假的课程规定。
4. 在回答最后，可以给学员一句温和的教练式启发或鼓励语句。
5. 【语言规范】：${lang === 'simplified' ? '请全程使用「简体中文」回答。' : '请务必全程使用「繁体中文（正体中文，台湾习惯用语，如：资讯、程式、讲义、连结、互动）」回答，切勿夹杂简体字。'}

${contextPrompt}`;

    // 格式化最近对话历史 (保留最多 6 轮)
    const formattedHistory = [];
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          formattedHistory.push({
            role: msg.role,
            content: String(msg.content || '')
          });
        }
      }
    }

    const messages = [
      { role: 'system', content: systemInstruction },
      ...formattedHistory,
      { role: 'user', content: message.trim() }
    ];

    // 6. 调用 DeepSeek API
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.6,
        max_tokens: 1500
      })
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error('DeepSeek API 调用失败:', errText);
      return new Response(JSON.stringify({
        error: `DeepSeek API 响应错误 (${deepseekRes.status})：${errText}`
      }), {
        status: 502,
        headers: corsHeaders
      });
    }

    const deepseekData = await deepseekRes.json();
    const reply = deepseekData.choices?.[0]?.message?.content || '抱歉，小牧暂时无法生成回答，请稍后再试。';

    return new Response(JSON.stringify({
      success: true,
      reply: reply,
      sources: sources
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('小牧助教处理请求出错:', error);
    return new Response(JSON.stringify({
      error: '服务器内部错误：' + error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
