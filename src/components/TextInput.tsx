import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Upload, FileText } from 'lucide-react';

interface TextInputProps {
  onTextsSubmit: (texts: string[]) => void;
  disabled?: boolean;
}

export function TextInput({ onTextsSubmit, disabled }: TextInputProps) {
  const [textInput, setTextInput] = useState('');

  const handleSubmit = () => {
    const texts = textInput
      .split('\n\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (texts.length > 0) {
      onTextsSubmit(texts);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTextInput(content);
    };
    reader.readAsText(file);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Input Text Data</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paste text or upload a file. Separate entries with blank lines.
            </p>
          </div>
          <Button variant="outline" size="sm" className="relative">
            <Upload className="w-4 h-4 mr-2" />
            Upload File
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={disabled}
            />
          </Button>
        </div>

        <Textarea
          placeholder="Enter text data here... Separate different entries with blank lines."
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
          disabled={disabled}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>
              {textInput.split('\n\n').filter(t => t.trim()).length} entries
            </span>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={disabled || !textInput.trim()}
          >
            Analyze Sentiment
          </Button>
        </div>
      </div>
    </Card>
  );
}
