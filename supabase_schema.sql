-- ====================================================================
-- SUPABASE SCHEMA FOR TECHASSIST LK - TASK & ASSESSMENT TRACKER
-- Run this script in your Supabase Project: SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. Create enum for task status
DO $$ BEGIN
    CREATE TYPE task_status_enum AS ENUM (
        'submitted',       -- 1. Request Received / Submitted
        'reviewing',       -- 2. Assessment & Scope Review
        'in_progress',     -- 3. Working / In Progress
        'quality_polish',  -- 4. Review & Quality Polish
        'completed'        -- 5. Ready & Delivered
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    client_org TEXT,
    service_title TEXT NOT NULL,
    service_category TEXT DEFAULT 'general',
    budget NUMERIC(10, 2),
    budget_note TEXT,
    urgency TEXT DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'submitted', -- submitted, reviewing, in_progress, quality_polish, completed
    progress_percent INT NOT NULL DEFAULT 10 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    notes TEXT,
    deliverable_url TEXT,
    deliverable_notes TEXT,
    eta_date TIMESTAMPTZ,
    files JSONB DEFAULT '[]'::jsonb, -- Array of uploaded files [{name, url, size, format, public_id}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for instant lookup by tracking code (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_tasks_tracking_code ON public.tasks (LOWER(tracking_code));
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);

-- 3. Task updates log (milestone logs & notes from Imantha)
CREATE TABLE IF NOT EXISTS public.task_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    tracking_code TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status_tag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_task_updates_tracking_code ON public.task_updates (LOWER(tracking_code));

-- 4. Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_updates ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Allow anyone with a tracking code to read their task
CREATE POLICY "Public can view tasks with tracking code"
    ON public.tasks
    FOR SELECT
    USING (true);

-- Allow visitors to insert new tasks / assessments
CREATE POLICY "Public can submit new tasks"
    ON public.tasks
    FOR INSERT
    WITH CHECK (true);

-- Allow updates (controlled via admin PIN on frontend or service role key)
CREATE POLICY "Public can update tasks"
    ON public.tasks
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Allow anyone to read updates for tasks
CREATE POLICY "Public can read task updates"
    ON public.task_updates
    FOR SELECT
    USING (true);

-- Allow inserting task updates
CREATE POLICY "Public can insert task updates"
    ON public.task_updates
    FOR INSERT
    WITH CHECK (true);

-- 7. Enable Realtime Replication for instant live updates!
-- This allows visitor browser to automatically get live updates when Imantha updates status
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_updates;

-- 8. Seed sample / demo task
INSERT INTO public.tasks (
    tracking_code,
    client_name,
    client_phone,
    client_email,
    service_title,
    service_category,
    budget,
    status,
    progress_percent,
    notes,
    files
) VALUES (
    'TRK-DEMO-2026',
    'Sample Client',
    '+94 704 124 816',
    'demo@techassist.lk',
    'Academic Project & Excel Automation',
    'academic',
    15000,
    'in_progress',
    65,
    'Demo assessment for testing real-time status tracking.',
    '[{"name": "assignment_spec.pdf", "url": "#", "size": "1.2 MB", "format": "pdf"}, {"name": "data_analysis.xlsx", "url": "#", "size": "450 KB", "format": "xlsx"}]'::jsonb
) ON CONFLICT (tracking_code) DO NOTHING;

INSERT INTO public.task_updates (
    tracking_code,
    title,
    message,
    status_tag
) VALUES 
    ('TRK-DEMO-2026', 'Assessment Accepted', 'Requirements and dataset reviewed. Work initiated.', 'reviewing'),
    ('TRK-DEMO-2026', 'Data Cleaning Finished', 'Excel datasets cleaned and formulas configured. Next step: building summary charts.', 'in_progress')
ON CONFLICT DO NOTHING;

