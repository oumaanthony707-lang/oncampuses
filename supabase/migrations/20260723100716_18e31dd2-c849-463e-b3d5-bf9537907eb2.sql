
CREATE POLICY "Chat images: owner upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Chat images: owner delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Chat images: authed read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images');
