import React, { useState } from 'react';
import type { TestMetadata } from '../types';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Upload, FilePlus2 } from 'lucide-react';

interface Props {
  metadata: Partial<TestMetadata>;
  onSave: (metadata: Partial<TestMetadata>) => void;
  onStartRecording: () => void;
  onStartSingleStep: () => void;
  onLoadJson: () => void;
}

export function TestMetadataForm({ metadata, onSave, onStartRecording, onStartSingleStep, onLoadJson }: Props) {
  const [name, setName] = useState(metadata.name || '');

  const handleStart = () => {
    onSave({ name: name.trim() || '' });
    onStartRecording();
  };

  return (
    <div id="qa-form-container" data-qa="form-container" className="flex flex-col h-screen bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full space-y-6">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Steps To Case</h1>
            <p className="text-sm text-muted-foreground">
              Record user actions and create test cases
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label id="qa-form-name-label" data-qa="name-label" htmlFor="test-name">
                Test Name
              </Label>
              <Input
                id="test-name"
                data-qa="name-input"
                placeholder="e.g., Login Flow Test"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStart(); }}
                autoFocus
              />
            </div>

            <Button
              id="qa-form-start-btn"
              data-qa="start-btn"
              onClick={handleStart}
              className="w-full"
            >
              Start Recording
            </Button>

            <div className="space-y-1">
              <Button
                id="qa-form-single-step-btn"
                data-qa="single-step-btn"
                variant="outline"
                className="w-full gap-2"
                onClick={onStartSingleStep}
              >
                <FilePlus2 className="w-4 h-4" />
                Record Single Page
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Capture all steps on the current page — nothing after you navigate away
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              id="qa-form-load-json-btn"
              data-qa="load-json-btn"
              variant="outline"
              className="w-full gap-2"
              onClick={onLoadJson}
            >
              <Upload className="w-4 h-4" />
              Upload JSON File
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
