
CREATE POLICY "listing-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-images');

CREATE POLICY "listing-images owner insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "listing-images owner update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "listing-images owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
