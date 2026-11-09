import React, { useState } from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

interface Props {
  tagName: string;
  /** Best-effort label derived from the picked element; the user can override it. */
  suggestedName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/** Mounted only once an element has been pre-picked, so the suggested name seeds the input. */
export function ContainerNameModal({ tagName, suggestedName, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(suggestedName);
  const trimmed = name.trim();

  return (
    <Dialog open onClose={onCancel}>
      <DialogContent data-qa="pre-pick-container-modal-content">
        <DialogHeader>
          <DialogTitle data-qa="pre-pick-container-title">Name this container</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Element: <code className="bg-secondary px-1 py-0.5 rounded text-xs">{tagName.toLowerCase()}</code>
        </p>
        <div className="space-y-2">
          <Label data-qa="pre-pick-container-label" htmlFor="container-name-input">Container name</Label>
          <Input
            id="container-name-input"
            data-qa="pre-pick-container-name-input"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && trimmed) onConfirm(trimmed);
            }}
            placeholder="e.g. Confirm dialog, User menu..."
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button data-qa="pre-pick-container-cancel-btn" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button data-qa="pre-pick-container-confirm-btn" onClick={() => trimmed && onConfirm(trimmed)} disabled={!trimmed}>
            Set Container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
