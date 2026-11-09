import React from 'react';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

interface Props {
  open: boolean;
  stepCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardConfirmModal({ open, stepCount, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogContent data-qa="back-confirm-modal-content">
        <DialogHeader>
          <DialogTitle data-qa="back-confirm-title">Discard Recording?</DialogTitle>
        </DialogHeader>
        <p data-qa="back-confirm-message" className="text-sm text-muted-foreground">
          You have {stepCount} recorded step{stepCount !== 1 ? 's' : ''}.
          Going back will lose all progress.
        </p>
        <DialogFooter>
          <Button data-qa="back-confirm-cancel-btn" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button data-qa="back-confirm-discard-btn" variant="destructive" onClick={onConfirm}>
            Discard &amp; Go Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
