import { Plus, Lightbulb, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ContextSuggestion {
  id: string;
  title: string;
  preview: string;
  text: string;
}

interface SuggestionsPanelProps {
  suggestions: ContextSuggestion[];
  promptPreview: string;
  onAdd: (text: string) => void;
}

export function SuggestionsPanel({ suggestions, promptPreview, onAdd }: SuggestionsPanelProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Sugestões do sistema</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Baseadas no que já sabemos da sua clínica.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma sugestão disponível ainda.
            </p>
          ) : (
            suggestions.map((s) => (
              <div
                key={s.id}
                className="group rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    {s.title}
                  </Badge>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed mb-2 line-clamp-3">
                  {s.preview}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAdd(s.text)}
                  className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar ao prompt
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Prévia</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Como o prompt está ficando.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[260px] rounded-lg border border-border/60 bg-muted/40 p-3">
            {promptPreview.trim() ? (
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono text-foreground/80">
                {promptPreview}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">
                Comece a escrever para ver a prévia aqui.
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
