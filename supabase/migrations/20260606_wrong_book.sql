-- Create wrong_book table
CREATE TABLE IF NOT EXISTS public.wrong_book (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    question_content TEXT NOT NULL,
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    ai_analysis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.wrong_book ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own wrong book entries"
    ON public.wrong_book FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wrong book entries"
    ON public.wrong_book FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wrong book entries"
    ON public.wrong_book FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wrong book entries"
    ON public.wrong_book FOR DELETE
    USING (auth.uid() = user_id);
