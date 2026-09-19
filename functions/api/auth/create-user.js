// 创建学员用户 API
// POST /api/auth/create-user
// Body: { email, password, name }

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const body = await request.json();
    const { email, password, name } = body;
    
    if (!email || !password) {
      return new Response(JSON.stringify({ error: '邮箱和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 使用 service_role key 创建用户
    const supabaseUrl = 'https://subwcjqahjbgkdrocyoz.supabase.co';
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: '服务端配置错误：缺少 service_role key' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 调用 Supabase Admin API 创建用户
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        password: password,
        email_confirm: true, // 自动确认邮箱
        user_metadata: {
          name: name || ''
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error_description || data.msg || '创建用户失败' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      userId: data.id 
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
