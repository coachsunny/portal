import { onRequestPost as handleCreateUser } from './functions/api/auth/create-user.js';
import { onRequestPost as handleResetPassword } from './functions/api/auth/reset-password.js';
import { onRequestPost as handleAssistantChat, onRequestOptions as handleAssistantChatOptions } from './functions/api/assistant/chat.js';
import { onRequestPost as handleAssistantIngest, onRequestOptions as handleAssistantIngestOptions } from './functions/api/assistant/ingest.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 路由分发
    if (url.pathname === '/api/assistant/chat') {
      if (request.method === 'OPTIONS') {
        return handleAssistantChatOptions();
      }
      return handleAssistantChat({ request, env, ctx });
    }

    if (url.pathname === '/api/assistant/ingest') {
      if (request.method === 'OPTIONS') {
        return handleAssistantIngestOptions();
      }
      return handleAssistantIngest({ request, env, ctx });
    }

    if (url.pathname === '/api/auth/create-user') {
      return handleCreateUser({ request, env, ctx });
    }

    if (url.pathname === '/api/auth/reset-password') {
      return handleResetPassword({ request, env, ctx });
    }

    // 静态资源文件直接交由 Cloudflare Assets 分发 (HTML, CSS, JS, PDF 等)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
