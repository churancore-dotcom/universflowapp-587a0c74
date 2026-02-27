-- Allow public read on profiles for demo admin panel
CREATE POLICY "Anyone can count profiles" ON public.profiles FOR SELECT USING (true);

-- Allow public read on recently_played for demo admin panel  
CREATE POLICY "Anyone can view recently played" ON public.recently_played FOR SELECT USING (true);