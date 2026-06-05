-- Create todos table
CREATE TABLE todos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('task', 'rest')),
    task_type TEXT CHECK (task_type IN ('study', 'self-study')),
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
    duration INTEGER NOT NULL,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create focus_records table
CREATE TABLE focus_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
    duration_minutes INTEGER NOT NULL,
    completed_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_records ENABLE ROW LEVEL SECURITY;

-- Create Policies for todos
CREATE POLICY "Users can view their own todos" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own todos" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own todos" ON todos FOR DELETE USING (auth.uid() = user_id);

-- Create Policies for focus_records
CREATE POLICY "Users can view their own focus_records" ON focus_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own focus_records" ON focus_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus_records" ON focus_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus_records" ON focus_records FOR DELETE USING (auth.uid() = user_id);
