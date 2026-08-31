-- ============================================
-- Migration 18: 新增工具表
-- 用于管理教练工具页面的工具链接
-- ============================================

-- 创建工具表
CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  icon VARCHAR(20) DEFAULT '🔧',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE tools IS '教练工具页面的工具链接列表';
COMMENT ON COLUMN tools.name IS '工具名称';
COMMENT ON COLUMN tools.description IS '工具描述';
COMMENT ON COLUMN tools.url IS '工具链接';
COMMENT ON COLUMN tools.icon IS '工具图标（emoji）';
COMMENT ON COLUMN tools.sort_order IS '排序（数字越小越靠前）';
COMMENT ON COLUMN tools.is_active IS '是否显示';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tools_sort_order ON tools(sort_order);
CREATE INDEX IF NOT EXISTS idx_tools_is_active ON tools(is_active);

-- 插入初始数据
INSERT INTO tools (name, description, url, icon, sort_order, is_active) VALUES
('教练博客', '分享教练心得、学习笔记与成长故事', 'https://coachsunny.github.io/blog/', '📝', 1, true),
('专注工具', '帮助你保持专注，提升学习效率', 'https://coachsunny.github.io/focus/', '🎯', 2, true)
ON CONFLICT DO NOTHING;

-- RLS策略：所有人都可以查看活跃的工具
DROP POLICY IF EXISTS "tools_select_public" ON tools;
CREATE POLICY "tools_select_public" ON tools
  FOR SELECT USING (is_active = true);

-- 老师可以查看所有工具（包括未激活的）
DROP POLICY IF EXISTS "tools_select_teacher" ON tools;
CREATE POLICY "tools_select_teacher" ON tools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- 只有老师可以增删改工具
DROP POLICY IF EXISTS "tools_modify_teacher" ON tools;
CREATE POLICY "tools_modify_teacher" ON tools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- 启用RLS
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;

-- 更新updated_at触发器
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tools_updated_at ON tools;
CREATE TRIGGER trigger_update_tools_updated_at
  BEFORE UPDATE ON tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();
