import React, { useState } from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Label } from './components/ui/label';

interface Props {
  onSave: (text: string) => void;
  onClose: () => void;
}

/** Mounted only while open, so the draft text resets with the component. */
export function AddPreconditionModal({ onSave, onClose }: Props) {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  return (
    <Dialog open onClose={onClose}>
      <DialogContent data-qa="add-precondition-modal-content">
        <DialogHeader>
          <DialogTitle data-qa="add-precondition-title">Add Precondition</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label data-qa="add-precondition-label" htmlFor="precondition-input">Precondition</Label>
          <textarea
            id="precondition-input"
            data-qa="add-precondition-textarea"
            className="flex w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring min-h-16 resize-y"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && trimmed) {
                e.preventDefault();
                onSave(trimmed);
              }
            }}
            placeholder="e.g., User is logged in"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button data-qa="add-precondition-cancel-btn" variant="outline" onClick={onClose}>Cancel</Button>
          <Button data-qa="add-precondition-save-btn" onClick={() => trimmed && onSave(trimmed)} disabled={!trimmed}>
            Add Precondition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
