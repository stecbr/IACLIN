import { format, parseISO } from 'date-fns';
import { FileText, Download, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { usePatientData, type DocumentRow } from '@/hooks/usePatientData';

export default function PatientExams() {
  const { documents, loading } = usePatientData();

  const downloadDoc = async (doc: DocumentRow) => {
    try {
      const { data, error } = await supabase.storage
        .from('patient-files')
        .createSignedUrl(doc.file_url, 60 * 5);
      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch {
      window.open(doc.file_url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meus Exames</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documentos e exames enviados pela sua clínica.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Nenhum documento ainda</p>
              <p className="text-sm text-muted-foreground">
                Quando a clínica enviar exames ou laudos, eles aparecerão aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => downloadDoc(doc)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(doc.created_at), 'dd/MM/yyyy')}
                  {doc.category && ` · ${doc.category}`}
                  {doc.file_type && ` · ${doc.file_type}`}
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
