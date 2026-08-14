// ============================================
// 通用认证模块 - 所有页面共用
// 依赖：supabase-client.js（需先引入）
// ============================================

// 页面路径配置
const PAGES = {
  login: 'index.html',
  admin: 'admin-dashboard.html',
  student: 'student-dashboard.html'
};

/**
 * 检查登录状态，未登录则跳转到登录页
 * 已登录则返回用户信息和角色
 */
async function requireAuth() {
  const { data: { user } } = await sb.auth.getUser();
  
  if (!user) {
    window.location.href = PAGES.login;
    return null;
  }

  // 获取用户资料（角色）
  const { data: profile, error } = await sb
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('获取用户资料失败:', error);
    // 有登录但没资料，强制登出
    await sb.auth.signOut();
    window.location.href = PAGES.login;
    return null;
  }

  return {
    user,
    name: profile.name,
    role: profile.role
  };
}

/**
 * 检查当前用户是否为老师，不是则跳转
 */
async function requireTeacher() {
  const session = await requireAuth();
  if (!session) return null;
  
  if (session.role !== 'teacher') {
    window.location.href = PAGES.student;
    return null;
  }
  return session;
}

/**
 * 检查当前用户是否为学员，不是则跳转
 */
async function requireStudent() {
  const session = await requireAuth();
  if (!session) return null;
  
  if (session.role !== 'student') {
    window.location.href = PAGES.admin;
    return null;
  }
  return session;
}

/**
 * 登录成功后按角色跳转
 */
async function redirectByRole() {
  const session = await requireAuth();
  if (!session) return;
  
  if (session.role === 'teacher') {
    window.location.href = PAGES.admin;
  } else {
    window.location.href = PAGES.student;
  }
}

/**
 * 登出
 */
async function logout() {
  await sb.auth.signOut();
  window.location.href = PAGES.login;
}

/**
 * 渲染顶部导航栏（老师和学员共用，根据角色显示不同菜单）
 * @param {string} currentPage - 当前页面标识
 */
function renderNavbar(session, currentPage) {
  const isTeacher = session.role === 'teacher';
  const roleLabel = isTeacher ? '老师' : '学员';
  
  const navItems = isTeacher ? [
    { id: 'dashboard', label: '首页', href: 'admin-dashboard.html' },
    { id: 'classes', label: '班级管理', href: 'classes.html' },
    { id: 'resources', label: '资源管理', href: 'resources.html' },
    { id: 'quizzes', label: '测验管理', href: 'classes.html?tab=quizzes' },
    { id: 'questions', label: '学员提问', href: 'classes.html?tab=questions' }
  ] : [
    { id: 'dashboard', label: '首页', href: PAGES.student },
    { id: 'resources', label: '学习资源', href: 'student-resources.html' },
    { id: 'quizzes', label: '我的测验', href: 'student-resources.html?tab=quizzes' },
    { id: 'questions', label: '我的提问', href: 'student-questions.html' }
  ];

  const navHtml = `
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <span class="text-xl font-bold text-gray-800">自牧平施教练班</span>
            <span class="ml-3 px-2 py-1 text-xs rounded-full ${isTeacher ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${roleLabel}</span>
          </div>
          <div class="flex items-center space-x-1">
            ${navItems.map(item => `
              <a href="${item.href}" class="px-3 py-2 rounded-md text-sm font-medium ${currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}">${item.label}</a>
            `).join('')}
            <div class="flex items-center ml-4 pl-4 border-l">
              <span class="text-sm text-gray-600 mr-3">${session.name}</span>
              <button onclick="logout()" class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition">退出</button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;
  
  document.body.insertAdjacentHTML('afterbegin', navHtml);
}
