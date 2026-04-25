import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, RefreshCw, User, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClinicalCameraProps {
  patientId?: string;
}

export function ClinicalCamera({ patientId: initialPatientId }: ClinicalCameraProps = {}) {
  const { user, currentClinicId } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [patientId, setPatientId] = useState<string>(initialPatientId ?? '');
  const [tag, setTag] = useState('');
  const [observation, setObservation] = useState('');
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId);
  }, [initialPatientId]);

  const { data: patients = [] } = useQuery({
    queryKey: ['camera-patients', currentClinicId],
    queryFn: async () => {
      if (!currentClinicId) return [];
      const { data } = await supabase
        .from('patients')
        .select('id, full_name')
        .eq('clinic_id', currentClinicId)
        .eq('is_active', true)
        .order('full_name')
        .limit(500);
      return data ?? [];
    },
    enabled: !!currentClinicId,
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['clinical-photos', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data } = await supabase
        .from('documents')
        .select('id, name, file_url, created_at')
        .eq('patient_id', patientId)
        .eq('category', 'clinical_photo')
        .order('created_at', { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!patientId,
  });

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (err) {
      toast.error('Não consegui acessar a câmera. Verifique as permissões.');
      setSupported(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  useEffect(() => () => stopCamera(), []);

  const capture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setSnapshot(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSnapshot(reader.result as string);
    reader.readAsDataURL(file);
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [meta, base64] = dataUrl.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const upload = async () => {
    if (!snapshot || !patientId || !user) return;
    setUploading(true);
    try {
      const blob = dataUrlToBlob(snapshot);
      const ts = Date.now();
      const fileName = `${patientId}/clinical_photos/${ts}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('patient-files')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('patient-files').getPublicUrl(fileName);
      const docName = [tag, observation].filter(Boolean).join(' · ') || `Foto ${new Date().toLocaleString('pt-BR')}`;
      await supabase.from('documents').insert({
        patient_id: patientId,
        name: docName,
        file_url: urlData.publicUrl,
        file_type: 'image/jpeg',
        category: 'clinical_photo',
        uploaded_by: user.id,
      });
      toast.success('Foto salva no histórico do paciente.');
      setSnapshot(null);
      setTag('');
      setObservation('');
      queryClient.invalidateQueries({ queryKey: ['clinical-photos', patientId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4" /> Paciente
        </Label>
        <Select value={patientId} onValueChange={setPatientId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={cn('relative rounded-2xl overflow-hidden bg-black aspect-video', !streaming && !snapshot && 'border border-dashed')}>
        {snapshot ? (
          <img src={snapshot} alt="Captura" className="w-full h-full object-contain" />
        ) : streaming ? (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            <Camera className="h-12 w-12 opacity-30" />
          </div>
        )}
        {snapshot && (
          <button
            onClick={() => setSnapshot(null)}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!snapshot && (
        <div className="grid grid-cols-2 gap-2">
          {streaming ? (
            <Button size="lg" onClick={capture} className="col-span-2 gap-2">
              <Camera className="h-5 w-5" /> Capturar
            </Button>
          ) : (
            <>
              <Button size="lg" onClick={startCamera} disabled={!supported} className="gap-2">
                <Camera className="h-5 w-5" /> {supported ? 'Abrir câmera' : 'Indisponível'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="h-5 w-5" /> Da galeria
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {snapshot && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Região / dente" value={tag} onChange={(e) => setTag(e.target.value)} />
            <Input placeholder="Observação curta" value={observation} onChange={(e) => setObservation(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setSnapshot(null); startCamera(); }} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refazer
            </Button>
            <Button onClick={upload} disabled={uploading || !patientId} className="gap-2">
              <Upload className="h-4 w-4" /> {uploading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ImageIcon className="h-3 w-3" /> Fotos anteriores
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border bg-muted">
                <img src={p.file_url} alt={p.name} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}