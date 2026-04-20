DROP POLICY IF EXISTS "Authenticated users can cache stream songs" ON public.stream_songs;
CREATE POLICY "Authenticated users can cache stream songs"
ON public.stream_songs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can refresh stream songs" ON public.stream_songs;
CREATE POLICY "Authenticated users can refresh stream songs"
ON public.stream_songs
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);