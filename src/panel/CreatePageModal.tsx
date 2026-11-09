import React, { useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';

interface Props {
  onSave: (name: string) => void;
  onCancel: () => void;
}

export function CreatePageModal({ onSave, onCancel }: Props) {
  const [name, setName] = useState('');

  const handleSave = () => {
    if (name.trim()) onSave(name.trim());
  };

  return (
    <Dialog open={true} onClose={onCancel}>
      <DialogContent id="qa-create-page-modal" data-qa="create-page-modal">
        <DialogHeader>
          <DialogTitle data-qa="create-page-title">Create Page</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label data-qa="create-page-label" htmlFor="qa-create-page-input">Page Name</Label>
          <Input
            id="qa-create-page-input"
            data-qa="create-page-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Login Modal, Settings Page"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button id="qa-create-page-cancel-btn" data-qa="create-page-cancel-btn" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button id="qa-create-page-save-btn" data-qa="create-page-save-btn" onClick={handleSave} disabled={!name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
