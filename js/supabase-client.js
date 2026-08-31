// ============================================
// Supabase 客户端配置
// ============================================

const SUPABASE_URL = 'https://subwcjqahjbgkdrocyoz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g8JbxP_AvORrvkQntqMbSA_HOOlrsP-';

// 初始化 Supabase 客户端（全局可用，变量名用 sb 避免和 CDN 全局对象冲突）
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 工具函数：获取当前登录用户
async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// 工具函数：获取当前用户角色
async function getUserRole() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('获取用户角色失败:', error);
    return null;
  }
  return data;
}

// 工具函数：检查是否为老师
async function isTeacher() {
  const profile = await getUserRole();
  return profile && profile.role === 'teacher';
}
