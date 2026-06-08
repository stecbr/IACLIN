import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Image, FileText, Trash2, Download, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

interface Props {
  patientId: string;
}

export function PatientDocuments({ patientId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['patient-documents', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`"${file.name}" excede o limite de 20 MB`);
          continue;
        }
        const ext = file.name.split('.').pop();
        const path = `${patientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('patient-files')
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('patient-files')
          .getPublicUrl(path);

        const isImage = file.type.startsWith('image/');
        const category = isImage ? 'image' : 'document';

        const { error: dbError } = await supabase.from('documents').insert({
          patient_id: patientId,
          name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          category,
          uploaded_by: user.id,
        });
        if (dbError) throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      toast.success('Arquivo(s) enviado(s)!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (doc: any) => {
    try {
      const urlParts = doc.file_url.split('/patient-files/');
      if (urlParts[1]) {
        await supabase.storage.from('patient-files').remove([urlParts[1]]);
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['patient-documents', patientId] });
      toast.success('Arquivo removido');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isImage = (type: string | null) => type?.startsWith('image/');

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{documents.length} arquivo(s)</p>
        <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Enviando…' : 'Upload'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
          <Image className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Nenhum documento ou imagem</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Enviar primeiro arquivo
          </Button>
        </div>
      ) : (
        <>
          {/* Image grid */}
          {documents.some(d => isImage(d.file_type)) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Imagens</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {documents.filter(d => isImage(d.file_type)).map(doc => (
                  <div
                    key={doc.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-border cursor-pointer bg-muted"
                    onClick={() => setPreview(doc.file_url)}
                  >
                    <img src={doc.file_url} alt={doc.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={(e) => { e.stopPropagation(); setDeleteTarget(doc); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document list */}
          {documents.some(d => !isImage(d.file_type)) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Documentos</p>
              <div className="space-y-2">
                {documents.filter(d => !isImage(d.file_type)).map(doc => (
                  <Card key={doc.id} className="p-3 flex items-center justify-between border-border/50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">"{deleteTarget?.name}"</span> será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteTarget); setDeleteTarget(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/10" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </Button>
          <img src={preview} alt="Preview" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
