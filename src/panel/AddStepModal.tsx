import React, { useState } from 'react';
import type { ContainerContext } from '../types';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Container, X } from 'lucide-react';

interface Props {
  /** Container picked before the step is saved, so the step is scoped to it. */
  pendingContainer?: ContainerContext;
  onSave: (text: string) => void;
  /** Closing also clears the pending container and stops the element picker. */
  onClose: () => void;
  onPickContainer: () => void;
  onClearContainer: () => void;
}

/**
 * Mounted only while open, so the draft text resets with the component.
 * Escape and backdrop clicks route through the Dialog's own onClose.
 */
export function AddStepModal({ pendingContainer, onSave, onClose, onPickContainer, onClearContainer }: Props) {
  const [text, setText] = useState('');
  const trimmed = text.trim();

  return (
    <Dialog open onClose={onClose}>
      <DialogContent data-qa="add-step-modal-content">
        <DialogHeader>
          <DialogTitle data-qa="add-step-title">Add Manual Step</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label data-qa="add-step-label" htmlFor="add-step-input">Step Description</Label>
          <textarea
            id="add-step-input"
            data-qa="add-step-textarea"
            className="flex w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring min-h-16 resize-y"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && trimmed) {
                e.preventDefault();
                onSave(trimmed);
              }
            }}
            placeholder="Describe what to do in this step..."
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label data-qa="add-step-container-label">Container (optional)</Label>
          {pendingContainer ? (
            <div className="flex items-center gap-2 p-2 bg-secondary rounded-md border border-amber-300">
              <Container className="w-3 h-3 text-amber-600 shrink-0" />
              <span className="text-sm flex-1 truncate text-foreground">
                {pendingContainer.containerLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClearContainer}
                title="Clear container"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={onPickContainer}>
              Pick Container (optional)
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button data-qa="add-step-cancel-btn" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button data-qa="add-step-save-btn" onClick={() => trimmed && onSave(trimmed)} disabled={!trimmed}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
