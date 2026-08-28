-- Migration 18: 学员私人备注表
-- 老师私下记录学员情况（家庭背景、特殊需求等），学员看不到

CREATE TABLE IF NOT EXISTS student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_student_notes_student ON student_notes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_notes_teacher ON student_notes(teacher_id);

-- RLS策略
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;

-- 老师可以查看自己写的备注
DROP POLICY IF EXISTS "teacher_read_own_notes" ON student_notes;
CREATE POLICY "teacher_read_own_notes" ON student_notes
  FOR SELECT USING (teacher_id = auth.uid());

-- 老师可以新增备注
DROP POLICY IF EXISTS "teacher_insert_notes" ON student_notes;
CREATE POLICY "teacher_insert_notes" ON student_notes
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

-- 老师可以更新自己的备注
DROP POLICY IF EXISTS "teacher_update_own_notes" ON student_notes;
CREATE POLICY "teacher_update_own_notes" ON student_notes
  FOR UPDATE USING (teacher_id = auth.uid());

-- 老师可以删除自己的备注
DROP POLICY IF EXISTS "teacher_delete_own_notes" ON student_notes;
CREATE POLICY "teacher_delete_own_notes" ON student_notes
  FOR DELETE USING (teacher_id = auth.uid());

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_student_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_notes_updated_at ON student_notes;
CREATE TRIGGER trigger_update_student_notes_updated_at
  BEFORE UPDATE ON student_notes
  FOR EACH ROW EXECUTE FUNCTION update_student_notes_updated_at();
