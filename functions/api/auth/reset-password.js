// 重置学员密码 API
// POST /api/auth/reset-password
// Body: { userId, newPassword }

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { userId, newPassword } = body;
    
    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: '用户ID和新密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 使用 service_role key 更新密码
    const supabaseUrl = 'https://subwcjqahjbgkdrocyoz.supabase.co';
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: '服务端配置错误：缺少 service_role key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 调用 Supabase Admin API 更新密码
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: newPassword
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error_description || data.msg || '重置密码失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
