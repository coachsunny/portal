// ============================================
// 通用认证模块 - 所有页面共用
// 依赖：supabase-client.js（需先引入）
// ============================================

/**
 * 注入手机端优化的CSS规则
 */
function injectMobileOptimizationCSS() {
  const css = `
    /* 手机端按钮和输入框最小高度，适合手指点击 */
    @media (max-width: 768px) {
      button, .btn, input[type="text"], input[type="email"], input[type="password"], 
      input[type="number"], input[type="date"], select, textarea {
        min-height: 44px !important;
        font-size: 15px !important;
      }
      
      /* 表格容器允许横向滚动 */
      .table-container, .overflow-x-auto {
        -webkit-overflow-scrolling: touch;
      }
      
      /* 卡片内边距在手机上适当减小 */
      .p-6 { padding: 1rem !important; }
      .p-8 { padding: 1.25rem !important; }
      
      /* 统计卡片在手机上字号适当调整 */
      .text-3xl { font-size: 1.5rem !important; }
      .text-4xl { font-size: 1.75rem !important; }
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// 页面加载时注入手机端优化CSS
injectMobileOptimizationCSS();

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

  // 获取用户资料（角色、有效期）
  const { data: profile, error } = await sb
    .from('profiles')
    .select('name, role, membership_expires_at')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('获取用户资料失败:', error);
    // 有登录但没资料，强制登出
    await sb.auth.signOut();
    window.location.href = PAGES.login;
    return null;
  }

  // 学员有效期检查
  if (profile.role === 'student' && profile.membership_expires_at) {
    const expiryDate = new Date(profile.membership_expires_at);
    const now = new Date();
    if (now > expiryDate) {
      alert('您的学习资格已过期（' + expiryDate.toLocaleDateString() + '），请联系老师续费。');
      await sb.auth.signOut();
      window.location.href = PAGES.login;
      return null;
    }
  }

  return {
    user,
    name: profile.name,
    role: profile.role,
    membershipExpiresAt: profile.membership_expires_at
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
  // 学员打卡（异步，不阻塞页面加载）
  checkIn(session.user.id);
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
    { id: 'todo', label: '待办处理', href: 'teacher-todo.html' },
    { id: 'classes', label: '班级管理', href: 'classes.html' },
    { id: 'student-stats', label: '学员状态', href: 'student-stats.html' },
    { id: 'resources', label: '资源管理', href: 'resources.html' },
    { id: 'quizzes', label: '测验管理', href: 'quizzes.html' },
    { id: 'questions', label: '学员提问', href: 'classes.html?tab=questions' }
  ] : [
    { id: 'dashboard', label: '首页', href: PAGES.student },
    { id: 'resources', label: '学习资源', href: 'student-resources.html' },
    { id: 'quizzes', label: '我的测验', href: 'student-resources.html?tab=quizzes' },
    { id: 'questions', label: '我的提问', href: 'student-questions.html', hasBadge: true },
    { id: 'care', label: '老师关怀', href: 'student-care.html', hasBadge: true },
    { id: 'assessment', label: '性向评估', href: 'personality-assessment.html' },
    { id: 'vision', label: '自我愿景', href: 'student-vision.html' },
    { id: 'profile', label: '个人中心', href: 'student-profile.html' },
    { id: 'guide', label: '📖 使用手册', href: 'student-guide.html', external: true }
  ];

  const navHtml = `
    <nav class="bg-white shadow-sm border-b sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-center h-14">
          <!-- 品牌 -->
          <div class="flex items-center flex-shrink-0">
            <span class="text-base font-bold text-gray-800">自牧平施教练班</span>
            <span class="ml-2 px-1.5 py-0.5 text-xs rounded-full ${isTeacher ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${roleLabel}</span>
          </div>
          
          <!-- 桌面端菜单 -->
          <div class="hidden md:flex items-center space-x-1">
            ${navItems.map(item => `
              <a href="${item.href}" ${item.external ? 'target="_blank"' : ''} class="relative px-3 py-2 rounded-md text-sm font-medium ${currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}">
                ${item.label}
                ${item.hasBadge ? '<span id="nav-unread-badge" class="hidden absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 font-bold"></span>' : ''}
              </a>
            `).join('')}
            <!-- 简繁切换 -->
            <button onclick="toggleLanguage()" class="px-3 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-l ml-2" title="简繁切换">
              <span id="lang-toggle-text">繁</span>
            </button>
            <div class="flex items-center ml-3 pl-3 border-l">
              <span class="text-sm text-gray-600 mr-3">${session.name}</span>
              <button onclick="logout()" class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition">退出</button>
            </div>
          </div>
          
          <!-- 手机端汉堡按钮 -->
          <button onclick="toggleMobileMenu()" class="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100" aria-label="菜单">
            <svg id="menu-icon-open" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            <svg id="menu-icon-close" class="w-6 h-6 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
      
      <!-- 手机端下拉菜单 -->
      <div id="mobile-menu" class="hidden md:hidden bg-white border-t">
        <div class="px-4 py-3 space-y-1">
          ${navItems.map(item => `
            <a href="${item.href}" ${item.external ? 'target="_blank"' : ''} class="relative block px-3 py-2.5 rounded-md text-sm font-medium ${currentPage === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}">
              ${item.label}
              ${item.hasBadge ? '<span id="nav-unread-badge-mobile" class="hidden absolute right-3 top-1/2 -translate-y-1/2 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1 font-bold"></span>' : ''}
            </a>
          `).join('')}
          <!-- 简繁切换 -->
          <button onclick="toggleLanguage()" class="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-gray-500 hover:bg-gray-50 border-t mt-2 pt-3">
            切换为<span id="lang-toggle-text-mobile">繁体</span>
          </button>
          <div class="pt-3 mt-3 border-t flex items-center justify-between">
            <span class="text-sm text-gray-600">${session.name}</span>
            <button onclick="logout()" class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition">退出登录</button>
          </div>
        </div>
      </div>
    </nav>
  `;
  
  document.body.insertAdjacentHTML('afterbegin', navHtml);
  
  // 应用语言设置（简繁切换）
  applyLanguageSetting();
}

/**
 * 切换手机端菜单显示/隐藏
 */
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden');
    iconOpen.classList.add('hidden');
    iconClose.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
  }
}

/**
 * 查询学员未读的老师回复数量
 * @param {string} userId - 学员用户ID
 * @returns {Promise<number>} 未读数量
 */
async function loadUnreadCount(userId) {
  try {
    // 查询未读的老师回复（提问）
    const { data: questions, error: qe } = await sb
      .from('questions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'answered')
      .is('student_read_at', null);
    if (qe) throw qe;
    const questionCount = questions ? questions.length : 0;

    // 查询未读的老师关怀消息
    const { data: careMessages, error: ce } = await sb
      .from('care_messages')
      .select('id')
      .eq('student_id', userId)
      .eq('sender_role', 'teacher')
      .eq('is_read', false);
    // care_messages表可能还不存在，忽略错误
    const careCount = (!ce && careMessages) ? careMessages.length : 0;

    const totalCount = questionCount + careCount;
    updateUnreadBadge(totalCount);
    return totalCount;
  } catch (e) {
    console.error('查询未读消息失败:', e);
    return 0;
  }
}

/**
 * 更新导航栏未读红点
 * @param {number} count - 未读数量
 */
function updateUnreadBadge(count) {
  ['nav-unread-badge', 'nav-unread-badge-mobile'].forEach(id => {
    const badge = document.getElementById(id);
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}

/**
 * 将学员所有已回复的提问标记为已读
 * @param {string} userId - 学员用户ID
 */
async function markQuestionsAsRead(userId) {
  try {
    const { error } = await sb
      .from('questions')
      .update({ student_read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'answered')
      .is('student_read_at', null);
    if (error) throw error;
    updateUnreadBadge(0);
  } catch (e) {
    console.error('标记已读失败:', e);
  }
}

/**
 * 学习打卡：同一天只记一次，所有学员页面加载时自动调用
 */
async function checkIn(userId) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const lastDate = localStorage.getItem('last_checkin_' + userId);
  if (lastDate === today) return;
  try {
    // 从localStorage读取当前选中的班级
    const classId = localStorage.getItem('selected_class_' + userId);
    const record = { user_id: userId, activity_type: 'browse' };
    if (classId) record.class_id = parseInt(classId);
    await sb.from('study_logs').insert(record);
    localStorage.setItem('last_checkin_' + userId, today);
  } catch (e) {
    console.error('打卡失败:', e);
  }
}

// ============================================
// 简繁切换功能（使用 OpenCC 库）
// ============================================

let openccLoaded = false;
let s2tConverter = null;
let t2sConverter = null;

/**
 * 动态加载 OpenCC 库
 */
function loadOpenCC(callback) {
  if (openccLoaded && typeof OpenCC !== 'undefined') {
    callback();
    return;
  }
  
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js';
  script.onload = function() {
    openccLoaded = true;
    s2tConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
    t2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });
    callback();
  };
  script.onerror = function() {
    console.error('OpenCC 库加载失败');
  };
  document.head.appendChild(script);
}

/**
 * 递归转换所有文本节点
 */
function convertTextNodes(node, converter) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue && node.nodeValue.trim()) {
      node.nodeValue = converter(node.nodeValue);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'input' || tag === 'code' || tag === 'pre') {
      return;
    }
    if (node.id === 'lang-toggle-text' || node.id === 'lang-toggle-text-mobile') {
      return;
    }
    for (let i = 0; i < node.childNodes.length; i++) {
      convertTextNodes(node.childNodes[i], converter);
    }
  }
}

/**
 * 转换整个页面为繁体
 */
function convertPageToTraditional() {
  if (!s2tConverter) return;
  convertTextNodes(document.body, s2tConverter);
  document.title = s2tConverter(document.title);
}

/**
 * 切换语言（切换后刷新页面）
 */
function toggleLanguage() {
  const currentLang = localStorage.getItem('language') || 'simplified';
  const newLang = currentLang === 'simplified' ? 'traditional' : 'simplified';
  localStorage.setItem('language', newLang);
  location.reload();
}

/**
 * 页面加载时应用语言设置
 */
function applyLanguageSetting() {
  const currentLang = localStorage.getItem('language') || 'simplified';
  updateLanguageButton();
  
  if (currentLang === 'traditional') {
    loadOpenCC(function() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', convertPageToTraditional);
      } else {
        setTimeout(convertPageToTraditional, 200);
      }
    });
  }
}

/**
 * 更新语言切换按钮文字
 */
function updateLanguageButton() {
  const currentLang = localStorage.getItem('language') || 'simplified';
  const isTraditional = currentLang === 'traditional';
  const desktopBtn = document.getElementById('lang-toggle-text');
  const mobileBtn = document.getElementById('lang-toggle-text-mobile');
  
  if (desktopBtn) desktopBtn.textContent = isTraditional ? '简' : '繁';
  if (mobileBtn) mobileBtn.textContent = isTraditional ? '简体' : '繁体';
}
