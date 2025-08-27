import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, X } from 'lucide-react';

interface MatchingQueueProps {
  selectedTags: string[];
  onCancel: () => void;
}

export function MatchingQueue({ selectedTags, onCancel }: MatchingQueueProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            Searching for study buddies...
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 text-center">
          <div>
            <p className="text-muted-foreground mb-3">You picked:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Finding someone with matching interests...
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="text-xs text-muted-foreground">
            <p>Average wait time: 30-60 seconds</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}