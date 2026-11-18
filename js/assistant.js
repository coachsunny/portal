/**
 * 自牧平施教练班 - 学习小助手「小牧」前端组件
 * 包含：悬浮按钮 (FAB)、对话面板、讲义出处引用、即时问答
 */

(function () {
  // 避免重复初始化
  if (window.__AI_ASSISTANT_INITED__) return;
  window.__AI_ASSISTANT_INITED__ = true;

  // 状态管理
  const state = {
    isOpen: false,
    isLoading: false,
    history: [],
    currentClassId: null,
    storageKey: 'assistant_chat_history_v1'
  };

  // 读取已保存的历史记录
  try {
    const saved = localStorage.getItem(state.storageKey);
    if (saved) state.history = JSON.parse(saved);
  } catch (e) { }

  // 尝试获取当前班级 ID
  function resolveClassId() {
    try {
      if (window.currentClassId) return window.currentClassId;
      const urlParams = new URLSearchParams(window.location.search);
      const urlClassId = urlParams.get('class_id') || urlParams.get('id');
      if (urlClassId) return urlClassId;
      if (window.currentSession && window.currentSession.user) {
        const saved = localStorage.getItem('selected_class_' + window.currentSession.user.id);
        if (saved) return saved;
      }
    } catch (e) { }
    return null;
  }

  // 渲染 HTML
  function injectAssistantHtml() {
    const html = `
      <!-- 小牧学习小助手入口 -->
      <div id="ai-assistant-container" class="fixed bottom-6 right-6 z-50 font-sans">
        
        <!-- 首次进入页面的问候气泡 -->
        <div id="ai-assistant-greeting" class="hidden absolute bottom-16 right-0 mb-2 mr-1 bg-white text-gray-800 text-xs py-2 px-3.5 rounded-2xl shadow-xl border border-indigo-100 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all duration-300 hover:scale-105">
          <span>👋 同学好，我是<b>小牧</b>！讲义有疑问随时问我 😊</span>
          <button onclick="event.stopPropagation(); document.getElementById('ai-assistant-greeting').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 ml-1 text-sm">×</button>
        </div>

        <!-- 悬浮主按钮 (C-1 品牌字徽【牧】) -->
        <button id="ai-assistant-fab" onclick="toggleAssistantChat()" class="relative w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none" aria-label="打开学习小助手">
          <!-- 展开前的图标：字徽【牧】 -->
          <div id="ai-fab-icon-open" class="flex items-center justify-center">
            <span class="text-2xl font-bold font-serif tracking-tight select-none">牧</span>
            <span class="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping opacity-75"></span>
            <span class="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-300 rounded-full"></span>
          </div>
          <!-- 展开后的关闭图标 -->
          <svg id="ai-fab-icon-close" class="w-6 h-6 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        <!-- 弹出式对话视窗 -->
        <div id="ai-assistant-modal" class="hidden absolute right-0 w-[92vw] sm:w-[400px] h-[520px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300 origin-bottom-right" style="bottom: 72px;">
          
          <!-- 1. 顶部标题列 -->
          <div class="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3.5 text-white flex items-center justify-between flex-shrink-0 shadow-md">
            <div class="flex items-center gap-2.5">
              <div class="relative w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center font-serif font-bold text-base shadow">
                牧
                <span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-300 rounded-full"></span>
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-sm font-bold tracking-wide">小牧助教</h4>
                  <span class="text-[10px] px-1.5 py-0.2 bg-white/20 rounded text-blue-100">AI 伴学</span>
                </div>
                <p class="text-[11px] text-blue-100/80">依据自牧平施讲义库智能解答</p>
              </div>
            </div>
            
            <div class="flex items-center gap-1">
              <button onclick="clearAssistantChat()" title="清空对话" class="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <button onclick="toggleAssistantChat()" title="关闭视窗" class="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <!-- 2. 对话消息列表 -->
          <div id="ai-chat-messages" class="flex-1 p-3.5 space-y-3.5 overflow-y-auto bg-slate-50 text-xs">
            <!-- 默认欢迎语 -->
            <div class="flex items-start gap-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-serif font-bold flex-shrink-0 shadow-sm mt-0.5">
                牧
              </div>
              <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%] text-gray-800 space-y-2 leading-relaxed">
                <p>同学好！我是您的专属学习小助手<b>小牧</b> 🌱</p>
                <p class="text-gray-600">我能根据我们班级的课程讲义与教材，为您解答观念疑惑或梳理重点。请问有什么想了解的吗？</p>
              </div>
            </div>

            <!-- 快捷推荐问题 -->
            <div id="ai-quick-prompts" class="pl-9 space-y-1.5">
              <p class="text-[11px] text-gray-400 font-medium">💡 猜你想问：</p>
              <div class="flex flex-wrap gap-1.5">
                <button onclick="sendAssistantQuickPrompt('什么是 GROW 模型的具体流程？')" class="text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition shadow-2xs">
                  📌 什么是 GROW 模型？
                </button>
                <button onclick="sendAssistantQuickPrompt('倾听的三个层次分别是什么？')" class="text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition shadow-2xs">
                  👂 倾听的三个层次？
                </button>
                <button onclick="sendAssistantQuickPrompt('请为我总结核心重点与注意事项')" class="text-[11px] bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full transition shadow-2xs">
                  📝 总结核心要点
                </button>
              </div>
            </div>

            <!-- 动态对话容器 -->
            <div id="ai-dynamic-history" class="space-y-3.5"></div>

            <!-- 打字加载指示器 -->
            <div id="ai-typing-indicator" class="hidden flex items-start gap-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-serif font-bold flex-shrink-0 mt-0.5">
                牧
              </div>
              <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm text-gray-500 flex items-center gap-1.5">
                <span>小牧正在翻阅讲义</span>
                <span class="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                <span class="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.15s"></span>
                <span class="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.3s"></span>
              </div>
            </div>
          </div>

          <!-- 3. 底部提问输入框 -->
          <div class="p-2.5 bg-white border-t border-gray-200 flex-shrink-0">
            <form id="ai-chat-form" onsubmit="handleAssistantSubmit(event)" class="flex items-center gap-2">
              <input id="ai-user-input" type="text" placeholder="向小牧提问讲义内容..." class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition" />
              <button id="ai-send-btn" type="submit" class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-2 rounded-xl transition shadow flex-shrink-0 disabled:opacity-50">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </form>
            <p class="text-[10px] text-center text-gray-400 mt-1.5">内容由 DeepSeek 依据自牧平施讲义生成 · 仅供复习参考</p>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // 渲染历史纪录
    renderSavedHistory();

    // 3 秒后弹出问候气泡，10秒后自动隐去
    setTimeout(() => {
      const greeting = document.getElementById('ai-assistant-greeting');
      if (greeting && !state.isOpen) {
        greeting.classList.remove('hidden');
        setTimeout(() => greeting.classList.add('hidden'), 9000);
      }
    }, 2500);
  }

  // 展开/收合对话框
  window.toggleAssistantChat = function () {
    state.isOpen = !state.isOpen;
    const modal = document.getElementById('ai-assistant-modal');
    const openIcon = document.getElementById('ai-fab-icon-open');
    const closeIcon = document.getElementById('ai-fab-icon-close');
    const greeting = document.getElementById('ai-assistant-greeting');

    if (greeting) greeting.classList.add('hidden');

    if (state.isOpen) {
      modal.classList.remove('hidden');
      openIcon.classList.add('hidden');
      closeIcon.classList.remove('hidden');
      document.getElementById('ai-user-input').focus();
      scrollChatBottom();
    } else {
      modal.classList.add('hidden');
      openIcon.classList.remove('hidden');
      closeIcon.classList.add('hidden');
    }
  };

  // 清空对话
  window.clearAssistantChat = function () {
    if (!confirm('确定要清空与小牧的当前对话吗？')) return;
    state.history = [];
    localStorage.removeItem(state.storageKey);
    const container = document.getElementById('ai-dynamic-history');
    if (container) container.innerHTML = '';
  };

  // 点击快捷问题
  window.sendAssistantQuickPrompt = function (text) {
    const input = document.getElementById('ai-user-input');
    input.value = text;
    handleAssistantSubmit();
  };

  // 提交发问
  window.handleAssistantSubmit = async function (e) {
    if (e) e.preventDefault();
    if (state.isLoading) return;

    const input = document.getElementById('ai-user-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    state.currentClassId = resolveClassId();

    // 1. 渲染用户消息
    appendUserMessage(text);
    state.history.push({ role: 'user', content: text });
    saveHistory();

    // 2. 状态切换为正在加载
    state.isLoading = true;
    const sendBtn = document.getElementById('ai-send-btn');
    const indicator = document.getElementById('ai-typing-indicator');
    if (sendBtn) sendBtn.disabled = true;
    if (indicator) indicator.classList.remove('hidden');
    scrollChatBottom();

    // 3. 调用后端 API
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          classId: state.currentClassId,
          history: state.history.slice(-6)
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '连接助教服务失败');
      }

      // 4. 渲染小牧回答
      appendAssistantMessage(data.reply, data.sources);
      state.history.push({
        role: 'assistant',
        content: data.reply,
        sources: data.sources || []
      });
      saveHistory();

    } catch (err) {
      appendAssistantMessage(`抱歉，小牧遇到了点小状况：${err.message}。请稍后再试。`);
    } finally {
      state.isLoading = false;
      if (sendBtn) sendBtn.disabled = false;
      if (indicator) indicator.classList.add('hidden');
      scrollChatBottom();
    }
  };

  // 添加用户消息节点
  function appendUserMessage(text) {
    const container = document.getElementById('ai-dynamic-history');
    const escaped = escapeHtml(text);
    const html = `
      <div class="flex items-start justify-end gap-2">
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm p-2.5 shadow-xs max-w-[85%] text-xs leading-relaxed">
          ${escaped}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    scrollChatBottom();
  }

  // 添加小助手消息节点
  function appendAssistantMessage(reply, sources = []) {
    const container = document.getElementById('ai-dynamic-history');
    const formattedContent = formatMarkdown(reply);

    let sourcesHtml = '';
    if (Array.isArray(sources) && sources.length > 0) {
      sourcesHtml = `
        <div class="mt-2 pt-2 border-t border-indigo-100/60 space-y-1">
          <p class="text-[10px] text-gray-400 font-medium flex items-center gap-1">
            <span>📖</span> 引用讲义来源：
          </p>
          <div class="flex flex-wrap gap-1.5">
            ${sources.map(s => `
              <div class="bg-indigo-50/80 border border-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                <span class="font-medium">《${escapeHtml(s.title)}》第 ${s.pageNumber} 页</span>
                <span class="text-indigo-400">(${s.similarity}%)</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    const html = `
      <div class="flex items-start gap-2">
        <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-serif font-bold flex-shrink-0 shadow-sm mt-0.5">
          牧
        </div>
        <div class="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%] text-xs text-gray-800 leading-relaxed space-y-1.5">
          <div class="ai-reply-content">${formattedContent}</div>
          ${sourcesHtml}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    scrollChatBottom();
  }

  // 恢复已保存的对话记录
  function renderSavedHistory() {
    if (!state.history || state.history.length === 0) return;
    const container = document.getElementById('ai-dynamic-history');
    if (!container) return;

    state.history.forEach(item => {
      if (item.role === 'user') {
        appendUserMessage(item.content);
      } else if (item.role === 'assistant') {
        appendAssistantMessage(item.content, item.sources || []);
      }
    });
  }

  function saveHistory() {
    try {
      localStorage.setItem(state.storageKey, JSON.stringify(state.history.slice(-20)));
    } catch (e) { }
  }

  function scrollChatBottom() {
    const list = document.getElementById('ai-chat-messages');
    if (list) {
      setTimeout(() => { list.scrollTop = list.scrollHeight; }, 30);
    }
  }

  // 简易 Markdown 解析器 (支持加粗、列表、换行)
  function formatMarkdown(text) {
    if (!text) return '';
    let res = escapeHtml(text);
    // 加粗 **text**
    res = res.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // 数字列表 1. 2.
    res = res.replace(/(?:^|\n)(\d+\.\s+)(.*?)(?=\n|$)/g, '<div class="pl-2 mt-1"><span class="font-semibold text-indigo-600">$1</span>$2</div>');
    // 无序列表 • 或 -
    res = res.replace(/(?:^|\n)(?:[-•*]\s+)(.*?)(?=\n|$)/g, '<div class="pl-3 mt-1 relative before:content-[\'•\'] before:absolute before:left-0 before:text-indigo-500">$1</div>');
    // 换行
    res = res.replace(/\n\n/g, '<div class="h-2"></div>').replace(/\n/g, '<br>');
    return res;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 页面加载完成后注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAssistantHtml);
  } else {
    injectAssistantHtml();
  }

})();
