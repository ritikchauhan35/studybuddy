import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { X, Plus } from 'lucide-react';
import { STUDY_TAGS } from '@/types';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onStartMatching: () => void;
  isLoading?: boolean;
}

export function TagSelector({ selectedTags, onTagsChange, onStartMatching, isLoading = false }: TagSelectorProps) {
  const [customTag, setCustomTag] = useState('');

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const trimmedTag = customTag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onTagsChange([...selectedTags, trimmedTag]);
      setCustomTag('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCustomTag();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Find a study buddy
          </CardTitle>
          <p className="text-muted-foreground">No sign up, instant match</p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Choose subjects</h3>
            <p className="text-sm text-muted-foreground mb-4">
              e.g., Computer Science, Calculus, AI, Coding
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {STUDY_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer p-2 text-center hover:bg-primary/90 transition-colors"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Add custom subject..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={addCustomTag}
                disabled={!customTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Selected subjects:</h4>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-3 pr-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => toggleTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={onStartMatching}
            disabled={selectedTags.length === 0 || isLoading}
            className="w-full py-6 text-lg font-semibold"
          >
            {isLoading ? 'Finding Study Buddy...' : 'Find Study Buddy'}
          </Button>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>🔒 Stay anonymous. Don't share personal info.</p>
            <p>Report inappropriate behavior immediately.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}