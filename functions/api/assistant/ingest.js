// ==============================================================================
// 讲义知识库入库与向量化 API
// POST /api/assistant/ingest
// Body: { resourceId, classId, chunks: [{ pageNumber, chunkIndex, content }] }
// ==============================================================================

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { resourceId, classId, chunks } = body;

    if (!resourceId || !Array.isArray(chunks) || chunks.length === 0) {
      return new Response(JSON.stringify({ error: '参数不完整：缺少 resourceId 或切片列表' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'Cloudflare Workers AI 未绑定，无法生成向量' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const supabaseUrl = env.SUPABASE_URL || 'https://subwcjqahjbgkdrocyoz.supabase.co';
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || 'sb_publishable_g8JbxP_AvORrvkQntqMbSA_HOOlrsP-';

    // 提取文本列表并进行 BGE-M3 向量化
    const texts = chunks.map(c => c.content.trim().slice(0, 1500));
    const embedResult = await env.AI.run('@cf/baai/bge-m3', {
      text: texts
    });

    const embeddings = embedResult?.data || embedResult;
    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
      throw new Error('向量生成失败或返回维度不符');
    }

    // 组装写入 Supabase 的记录
    const rowsToInsert = chunks.map((c, i) => ({
      resource_id: resourceId,
      class_id: classId ? parseInt(classId) : null,
      page_number: c.pageNumber || 1,
      chunk_index: c.chunkIndex || i,
      content: c.content,
      embedding: embeddings[i]
    }));

    // 批量写入 Supabase document_chunks 表
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/document_chunks`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(rowsToInsert)
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      return new Response(JSON.stringify({ error: '写入 Supabase 失败: ' + err }), {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response(JSON.stringify({
      success: true,
      insertedCount: rowsToInsert.length
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('入库切片出错:', error);
    return new Response(JSON.stringify({
      error: '入库处理异常: ' + error.message
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
