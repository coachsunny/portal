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
// 简繁切换功能
// ============================================

// 常用简繁转换映射表（覆盖常用字）
const simplifiedToTraditionalMap = {
  '个':'個', '们':'們', '这':'這', '那':'嗎', '么':'麼', '发':'發', '现':'現', '说':'說', '话':'話',
  '请':'請', '问':'問', '题':'題', '答':'答', '对':'對', '错':'錯', '学':'學', '习':'習', '师':'師',
  '生':'生', '课':'課', '程':'程', '资':'資', '源':'源', '测':'測', '验':'驗', '评':'評', '估':'估',
  '结':'結', '果':'果', '时':'時', '间':'間', '日':'日', '期':'期', '开':'開', '始':'始', '结':'結',
  '束':'束', '页':'頁', '面':'面', '点':'點', '击':'擊', '按':'按', '钮':'鈕', '输':'輸', '入':'入',
  '选':'選', '择':'擇', '确':'確', '认':'認', '取':'取', '消':'消', '删':'刪', '除':'除', '编':'編',
  '辑':'輯', '新':'新', '增':'增', '加':'加', '修':'修', '改':'改', '查':'查', '看':'看', '显':'顯',
  '示':'示', '隐':'隱', '藏':'藏', '搜':'搜', '索':'索', '筛':'篩', '选':'選', '排':'排', '序':'序',
  '导':'導', '出':'出', '进':'進', '口':'口', '下':'下', '载':'載', '上':'上', '传':'傳', '文':'文',
  '件':'件', '图':'圖', '片':'片', '视':'視', '频':'頻', '音':'音', '乐':'樂', '录':'錄', '制':'製',
  '账':'賬', '号':'號', '密':'密', '码':'碼', '登':'登', '录':'錄', '注':'註', '册':'冊', '退':'退',
  '出':'出', '个':'個', '人':'人', '中':'中', '心':'心', '设':'設', '置':'置', '系':'系', '统':'統',
  '管':'管', '理':'理', '员':'員', '工':'工', '作':'作', '台':'檯', '数':'數', '据':'據', '统':'統',
  '计':'計', '总':'總', '分':'分', '析':'析', '报':'報', '表':'表', '单':'單', '位':'位', '类':'類',
  '别':'別', '状':'狀', '态':'態', '标':'標', '记':'記', '签':'簽', '注':'註', '释':'釋', '说':'說',
  '明':'明', '详':'詳', '细':'細', '简':'簡', '介':'介', '绍':'紹', '内':'內', '容':'容', '标':'標',
  '题':'題', '目':'目', '答':'答', '案':'案', '选':'選', '项':'項', '多':'多', '少':'少', '大':'大',
  '小':'小', '长':'長', '短':'短', '宽':'寬', '窄':'窄', '高':'高', '低':'低', '快':'快', '慢':'慢',
  '远':'遠', '近':'近', '深':'深', '浅':'淺', '厚':'厚', '薄':'薄', '重':'重', '轻':'輕', '硬':'硬',
  '软':'軟', '冷':'冷', '热':'熱', '温':'溫', '暖':'暖', '凉':'涼', '湿':'濕', '干':'乾', '脏':'髒',
  '净':'淨', '乱':'亂', '齐':'齊', '整':'整', '洁':'潔', '净':'淨', '美':'美', '丑':'醜', '好':'好',
  '坏':'壞', '优':'優', '劣':'劣', '强':'強', '弱':'弱', '硬':'硬', '软':'軟', '聪':'聰', '明':'明',
  '愚':'愚', '蠢':'蠢', '笨':'笨', '灵':'靈', '活':'活', '敏':'敏', '锐':'銳', '迟':'遲', '钝':'鈍',
  '勤':'勤', '奋':'奮', '懒':'懶', '惰':'惰', '认真':'認真', '仔细':'仔細', '马虎':'馬虎', '粗心':'粗心',
  '专':'專', '注':'注', '心':'心', '分':'分', '散':'散', '聚':'聚', '精':'精', '神':'神', '贯':'貫',
  '彻':'徹', '领':'領', '会':'會', '悟':'悟', '理':'理', '解':'解', '掌':'掌', '握':'握', '运':'運',
  '用':'用', '应':'應', '实':'實', '践':'踐', '经':'經', '验':'驗', '体':'體', '会':'會', '感':'感',
  '受':'受', '觉':'覺', '得':'得', '认':'認', '识':'識', '知':'知', '道':'道', '懂':'懂', '会':'會',
  '能':'能', '够':'夠', '可':'可', '以':'以', '应':'應', '该':'該', '须':'須', '必':'必', '要':'要',
  '想':'想', '要':'要', '愿':'願', '意':'意', '希':'希', '望':'望', '期':'期', '待':'待', '盼':'盼',
  '望':'望', '等':'等', '待':'待', '期':'期', '限':'限', '时':'時', '间':'間', '天':'天', '周':'週',
  '月':'月', '年':'年', '今':'今', '昨':'昨', '明':'明', '前':'前', '后':'後', '现':'現', '在':'在',
  '过':'過', '去':'去', '将':'將', '来':'來', '未':'未', '来':'來', '以':'以', '前':'前', '后':'後',
  '来':'來', '回':'回', '去':'去', '进':'進', '出':'出', '上':'上', '下':'下', '左':'左', '右':'右',
  '东':'東', '西':'西', '南':'南', '北':'北', '中':'中', '间':'間', '内':'內', '外':'外', '里':'裡',
  '面':'面', '边':'邊', '旁':'旁', '侧':'側', '顶':'頂', '底':'底', '上':'上', '下':'下', '前':'前',
  '后':'後', '左':'左', '右':'右', '东':'東', '西':'西', '南':'南', '北':'北', '中':'中', '间':'間',
  '国':'國', '际':'際', '省':'省', '市':'市', '县':'縣', '区':'區', '乡':'鄉', '镇':'鎮', '村':'村',
  '学':'學', '校':'校', '园':'園', '院':'院', '系':'系', '班':'班', '级':'級', '组':'組', '队':'隊',
  '团':'團', '队':'隊', '员':'員', '长':'長', '师':'師', '生':'生', '徒':'徒', '弟':'弟', '兄':'兄',
  '姐':'姐', '妹':'妹', '哥':'哥', '弟':'弟', '父':'父', '母':'母', '儿':'兒', '女':'女', '子':'子',
  '孙':'孫', '亲':'親', '戚':'戚', '友':'友', '朋':'朋', '邻':'鄰', '居':'居', '客':'客', '主':'主',
  '宾':'賓', '客':'客', '人':'人', '民':'民', '众':'眾', '群':'群', '体':'體', '个':'個', '位':'位',
  '名':'名', '员':'員', '者':'者', '人':'人', '家':'家', '户':'戶', '口':'口', '丁':'丁', '男':'男',
  '女':'女', '老':'老', '少':'少', '幼':'幼', '童':'童', '婴':'嬰', '儿':'兒', '孩':'孩', '子':'子',
  '青':'青', '年':'年', '壮':'壯', '中':'中', '老':'老', '寿':'壽', '命':'命', '岁':'歲', '龄':'齡',
  '轮':'輪', '辈':'輩', '代':'代', '世':'世', '纪':'紀', '元':'元', '年':'年', '载':'載', '秋':'秋',
  '春':'春', '夏':'夏', '秋':'秋', '冬':'冬', '季':'季', '节':'節', '气':'氣', '候':'候', '天':'天',
  '气':'氣', '象':'象', '风':'風', '雨':'雨', '雪':'雪', '霜':'霜', '露':'露', '雾':'霧', '雷':'雷',
  '电':'電', '闪':'閃', '晴':'晴', '阴':'陰', '云':'雲', '雾':'霧', '霾':'霾', '冷':'冷', '热':'熱',
  '温':'溫', '暖':'暖', '凉':'涼', '寒':'寒', '暑':'暑', '干':'乾', '湿':'濕', '潮':'潮', '燥':'燥',
  '风':'風', '雨':'雨', '雷':'雷', '电':'電', '闪':'閃', '云':'雲', '雾':'霧', '霜':'霜', '露':'露',
  '冰':'冰', '雪':'雪', '冻':'凍', '冷':'冷', '热':'熱', '温':'溫', '暖':'暖', '凉':'涼', '寒':'寒',
  '业':'業', '务':'務', '职':'職', '位':'位', '岗':'崗', '责':'責', '任':'任', '权':'權', '利':'利',
  '义':'義', '务':'務', '服':'服', '务':'務', '业':'業', '绩':'績', '效':'效', '果':'果', '成':'成',
  '败':'敗', '功':'功', '过':'過', '错':'錯', '误':'誤', '失':'失', '得':'得', '获':'獲', '取':'取',
  '给':'給', '予':'予', '赋':'賦', '予':'予', '授':'授', '予':'予', '传':'傳', '授':'授', '教':'教',
  '育':'育', '培':'培', '养':'養', '训':'訓', '练':'練', '习':'習', '学':'學', '研':'研', '究':'究',
  '钻':'鑽', '研':'研', '探':'探', '索':'索', '寻':'尋', '找':'找', '发':'發', '现':'現', '明':'明',
  '白':'白', '清':'清', '楚':'楚', '懂':'懂', '会':'會', '能':'能', '够':'夠', '可':'可', '以':'以',
  '应':'應', '该':'該', '须':'須', '必':'必', '要':'要', '想':'想', '要':'要', '愿':'願', '意':'意',
  '希':'希', '望':'望', '期':'期', '待':'待', '盼':'盼', '望':'望', '等':'等', '待':'待', '期':'期',
  '限':'限', '时':'時', '间':'間', '天':'天', '周':'週', '月':'月', '年':'年', '今':'今', '昨':'昨',
  '明':'明', '前':'前', '后':'後', '现':'現', '在':'在', '过':'過', '去':'去', '将':'將', '来':'來',
  '未':'未', '来':'來', '以':'以', '前':'前', '后':'後', '来':'來', '回':'回', '去':'去', '进':'進',
  '出':'出', '上':'上', '下':'下', '左':'左', '右':'右', '东':'東', '西':'西', '南':'南', '北':'北',
  '中':'中', '间':'間', '内':'內', '外':'外', '里':'裡', '面':'面', '边':'邊', '旁':'旁', '侧':'側',
  '顶':'頂', '底':'底', '上':'上', '下':'下', '前':'前', '后':'後', '左':'左', '右':'右', '东':'東',
  '西':'西', '南':'南', '北':'北', '中':'中', '间':'間', '国':'國', '际':'際', '省':'省', '市':'市',
  '县':'縣', '区':'區', '乡':'鄉', '镇':'鎮', '村':'村', '学':'學', '校':'校', '园':'園', '院':'院',
  '系':'系', '班':'班', '级':'級', '组':'組', '队':'隊', '团':'團', '队':'隊', '员':'員', '长':'長',
  '师':'師', '生':'生', '徒':'徒', '弟':'弟', '兄':'兄', '姐':'姐', '妹':'妹', '哥':'哥', '弟':'弟',
  '父':'父', '母':'母', '儿':'兒', '女':'女', '子':'子', '孙':'孫', '亲':'親', '戚':'戚', '友':'友',
  '朋':'朋', '邻':'鄰', '居':'居', '客':'客', '主':'主', '宾':'賓', '客':'客', '人':'人', '民':'民',
  '众':'眾', '群':'群', '体':'體', '个':'個', '位':'位', '名':'名', '员':'員', '者':'者', '人':'人',
  '家':'家', '户':'戶', '口':'口', '丁':'丁', '男':'男', '女':'女', '老':'老', '少':'少', '幼':'幼',
  '童':'童', '婴':'嬰', '儿':'兒', '孩':'孩', '子':'子', '青':'青', '年':'年', '壮':'壯', '中':'中',
  '老':'老', '寿':'壽', '命':'命', '岁':'歲', '龄':'齡', '轮':'輪', '辈':'輩', '代':'代', '世':'世',
  '纪':'紀', '元':'元', '年':'年', '载':'載', '秋':'秋', '春':'春', '夏':'夏', '秋':'秋', '冬':'冬',
  '季':'季', '节':'節', '气':'氣', '候':'候', '天':'天', '气':'氣', '象':'象', '风':'風', '雨':'雨',
  '雪':'雪', '霜':'霜', '露':'露', '雾':'霧', '雷':'雷', '电':'電', '闪':'閃', '晴':'晴', '阴':'陰',
  '云':'雲', '雾':'霧', '霾':'霾', '冷':'冷', '热':'熱', '温':'溫', '暖':'暖', '凉':'涼', '寒':'寒',
  '暑':'暑', '干':'乾', '湿':'濕', '潮':'潮', '燥':'燥', '风':'風', '雨':'雨', '雷':'雷', '电':'電',
  '闪':'閃', '云':'雲', '雾':'霧', '霜':'霜', '露':'露', '冰':'冰', '雪':'雪', '冻':'凍', '冷':'冷',
  '热':'熱', '温':'溫', '暖':'暖', '凉':'涼', '寒':'寒', '业':'業', '务':'務', '职':'職', '位':'位',
  '岗':'崗', '责':'責', '任':'任', '权':'權', '利':'利', '义':'義', '务':'務', '服':'服', '务':'務',
  '业':'業', '绩':'績', '效':'效', '果':'果', '成':'成', '败':'敗', '功':'功', '过':'過', '错':'錯',
  '误':'誤', '失':'失', '得':'得', '获':'獲', '取':'取', '给':'給', '予':'予', '赋':'賦', '予':'予',
  '授':'授', '予':'予', '传':'傳', '授':'授', '教':'教', '育':'育', '培':'培', '养':'養', '训':'訓',
  '练':'練', '习':'習', '学':'學', '研':'研', '究':'究', '钻':'鑽', '研':'研', '探':'探', '索':'索',
  '寻':'尋', '找':'找', '发':'發', '现':'現', '明':'明', '白':'白', '清':'清', '楚':'楚'
};

// 当前语言状态
let currentLanguage = localStorage.getItem('language') || 'simplified';

/**
 * 简体转繁体
 */
function simplifiedToTraditional(text) {
  if (!text) return text;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    result += simplifiedToTraditionalMap[char] || char;
  }
  return result;
}

/**
 * 转换页面所有文字（更可靠的方法）
 */
function convertPageLanguage(toTraditional) {
  // 遍历所有元素，转换其直接文本子节点
  const allElements = document.querySelectorAll('body *:not(script):not(style):not(noscript)');
  
  let convertedCount = 0;
  
  allElements.forEach(el => {
    // 只处理有直接文本子节点的元素
    for (let i = 0; i < el.childNodes.length; i++) {
      const node = el.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
        if (toTraditional) {
          if (!node.dataset.originalText) {
            node.dataset.originalText = node.textContent;
          }
          const converted = simplifiedToTraditional(node.dataset.originalText);
          if (converted !== node.textContent) {
            node.textContent = converted;
            convertedCount++;
          }
        } else {
          if (node.dataset.originalText) {
            node.textContent = node.dataset.originalText;
            convertedCount++;
          }
        }
      }
    }
  });
  
  console.log(`[语言切换] 转换了 ${convertedCount} 个文本节点，目标：${toTraditional ? '繁体' : '简体'}`);
  
  // 更新按钮文字
  updateLanguageButton();
}

/**
 * 更新语言切换按钮文字
 */
function updateLanguageButton() {
  const isTraditional = currentLanguage === 'traditional';
  const desktopBtn = document.getElementById('lang-toggle-text');
  const mobileBtn = document.getElementById('lang-toggle-text-mobile');
  
  if (desktopBtn) desktopBtn.textContent = isTraditional ? '简' : '繁';
  if (mobileBtn) mobileBtn.textContent = isTraditional ? '简体' : '繁体';
}

/**
 * 切换语言
 */
function toggleLanguage() {
  currentLanguage = currentLanguage === 'simplified' ? 'traditional' : 'simplified';
  localStorage.setItem('language', currentLanguage);
  convertPageLanguage(currentLanguage === 'traditional');
}

/**
 * 页面加载时应用语言设置
 */
function applyLanguageSetting() {
  if (currentLanguage === 'traditional') {
    // 延迟执行，确保导航栏已渲染
    setTimeout(() => convertPageLanguage(true), 100);
  }
}
