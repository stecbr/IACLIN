import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Folder,
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  Download,
  X,
  ArrowLeft,
  Plus,
  Lock,
  Eye,
  ImageOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  patientId: string;
}

type FolderRow = { id: string; name: string; created_at: string };
type FileRow  = { id: string; name: string; file_url: string; file_type: string | null; created_at: string };

export function PatientFiles({ patientId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentFolder, setCurrentFolder] = useState<FolderRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string | null; name: string } | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // root = files not in any folder; otherwise the folder id
  const ctx = currentFolder ? currentFolder.id : 'root';
  const categoryKey = `doctor_file:${ctx}`;

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ['patient-private-folders', patientId, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('patient_id', patientId)
        .eq('uploaded_by', user.id)
        .eq('file_type', 'folder')
        .eq('category', 'doctor_folder')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as FolderRow[];
    },
    enabled: !!user,
  });

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['patient-private-files', patientId, user?.id, ctx],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('patient_id', patientId)
        .eq('uploaded_by', user.id)
        .eq('category', categoryKey)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FileRow[];
    },
    enabled: !!user,
  });

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    setCreatingFolder(true);
    try {
      const { error } = await supabase.from('documents').insert({
        patient_id: patientId,
        name: newFolderName.trim(),
        file_url: '',
        file_type: 'folder',
        category: 'doctor_folder',
        uploaded_by: user.id,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['patient-private-folders', patientId, user.id] });
      toast.success('Pasta criada!');
      setNewFolderName('');
      setCreateFolderOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder: FolderRow) => {
    if (!user) return;
    try {
      const { data: folderFiles } = await supabase
        .from('documents')
        .select('id, file_url')
        .eq('patient_id', patientId)
        .eq('uploaded_by', user.id)
        .eq('category', `doctor_file:${folder.id}`);

      if (folderFiles?.length) {
        const paths = folderFiles.map(f => f.file_url.split('/patient-files/')[1]).filter(Boolean);
        if (paths.length) await supabase.storage.from('patient-files').remove(paths);
        await supabase.from('documents').delete().in('id', folderFiles.map(f => f.id));
      }
      const { error } = await supabase.from('documents').delete().eq('id', folder.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['patient-private-folders', patientId, user.id] });
      toast.success('Pasta excluída');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop();
        const path = `${patientId}/private/${user.id}/${ctx}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage.from('patient-files').upload(path, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('patient-files').getPublicUrl(path);

        const { error: dbError } = await supabase.from('documents').insert({
          patient_id: patientId,
          name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          category: categoryKey,
          uploaded_by: user.id,
        });
        if (dbError) throw dbError;
      }
      queryClient.invalidateQueries({ queryKey: ['patient-private-files', patientId, user.id, ctx] });
      toast.success('Arquivo(s) enviado(s)!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: FileRow) => {
    if (!user) return;
    try {
      const urlPart = file.file_url.split('/patient-files/')[1];
      if (urlPart) await supabase.storage.from('patient-files').remove([urlPart]);
      const { error } = await supabase.from('documents').delete().eq('id', file.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['patient-private-files', patientId, user.id, ctx] });
      toast.success('Arquivo removido');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isImg  = (type: string | null) => !!type?.startsWith('image/');
  const isPdf  = (type: string | null) => type === 'application/pdf';
  const canPreview = (type: string | null) => isImg(type) || isPdf(type);

  const isEmpty = files.length === 0 && (!currentFolder ? folders.length === 0 : true);
  const isLoading = loadingFolders || loadingFiles;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentFolder ? (
            <>
              <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => setCurrentFolder(null)}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <span className="text-muted-foreground">/</span>
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{currentFolder.name}</span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Meus Arquivos</span>
              <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" />
                Privado
              </Badge>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Enviando…' : 'Upload'}
          </Button>
          {!currentFolder && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateFolderOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nova Pasta
            </Button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-border bg-muted/30">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-1">
            {currentFolder ? 'Nenhum arquivo nesta pasta' : 'Nenhum arquivo ainda'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Envie imagens, PDFs ou documentos — ou crie uma pasta para organizar
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Enviar arquivo
          </Button>
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* Image grid */}
          {files.some(f => isImg(f.file_type)) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Imagens</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {files.filter(f => isImg(f.file_type)).map(file => (
                  <div
                    key={file.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-border cursor-pointer bg-muted"
                    onClick={() => setPreview({ url: file.file_url, type: file.file_type, name: file.name })}
                  >
                    {brokenImages.has(file.id) ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <ImageOff className="h-6 w-6" />
                        <span className="text-[10px] text-center px-1 leading-tight">{file.name}</span>
                      </div>
                    ) : (
                      <img
                        src={file.file_url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={() => setBrokenImages(prev => new Set([...prev, file.id]))}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-white"
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document list */}
          {files.some(f => !isImg(f.file_type)) && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Documentos</p>
              <div className="space-y-2">
                {files.filter(f => !isImg(f.file_type)).map(file => (
                  <Card key={file.id} className="p-3 flex items-center justify-between border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(file.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {canPreview(file.file_type) && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          title="Pré-visualizar"
                          onClick={() => setPreview({ url: file.file_url, type: file.file_type, name: file.name })}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={file.file_url} download={file.name} target="_blank" rel="noopener noreferrer">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteFile(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Folder grid (root only) */}
      {!currentFolder && folders.length > 0 && (
        <div>
          {files.length > 0 && <p className="text-xs font-medium text-muted-foreground mb-2">Pastas</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map(folder => (
              <div
                key={folder.id}
                className="group relative cursor-pointer rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 p-4 transition-colors"
                onClick={() => setCurrentFolder(folder)}
              >
                <Folder className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-medium truncate pr-6">{folder.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(folder.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Pasta</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome da pasta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolder}>
              {creatingFolder ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      {preview && isImg(preview.type) && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <Button
            variant="ghost" size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setPreview(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={preview.url}
            alt={preview.name}
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* PDF preview dialog */}
      {preview && isPdf(preview.type) && (
        <Dialog open onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-4 py-3 border-b flex-shrink-0 flex flex-row items-center justify-between">
              <DialogTitle className="text-sm truncate">{preview.name}</DialogTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" asChild>
                  <a href={preview.url} download={preview.name} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                    Baixar
                  </a>
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              <iframe src={preview.url} className="w-full h-full border-0" title={preview.name} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
