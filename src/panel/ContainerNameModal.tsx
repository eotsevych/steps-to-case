import React, { useState } from 'react';
import type { ContainerIdentityCandidate, ContainerIdentityField } from '../types';
import { Button } from './components/ui/button';
import { Checkbox } from './components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

interface Props {
  tagName: string;
  /** Best-effort label derived from the picked element; the user can override it. */
  suggestedName: string;
  /** Texts and attributes that could tell this container from similar ones (other rows, cards). */
  candidates?: ContainerIdentityCandidate[];
  /** How many similar containers the candidates were compared with. */
  similar?: number;
  /** identityUnique is undefined when nothing was chosen or there was nothing to compare with. */
  onConfirm: (name: string, identity?: ContainerIdentityField[], identityUnique?: boolean) => void;
  onCancel: () => void;
}

/** Mounted only once an element has been picked as a container, so the suggested name seeds the input. */
export function ContainerNameModal({ tagName, suggestedName, candidates = [], similar = 0, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(suggestedName);
  const [selected, setSelected] = useState<number[]>([]);
  const trimmed = name.trim();

  const chosen = candidates.filter((_, i) => selected.includes(i));
  // Similar containers that match every chosen field: none left means the choice singles this one out
  const stillShared = chosen.length
    ? chosen.map(c => c.sharedWith).reduce((a, b) => a.filter(i => b.includes(i)))
    : [];
  const status = !chosen.length ? ''
    : !similar ? 'No similar containers on this page to compare with, so this was not checked.'
    : stillShared.length ? `${stillShared.length} other similar ${stillShared.length === 1 ? 'container has' : 'containers have'} the same. Add another field.`
    : 'Tells this container from the similar ones on the current page.';

  const confirm = () => {
    if (!trimmed) return;
    if (!chosen.length) return onConfirm(trimmed);
    onConfirm(
      trimmed,
      chosen.map(({ source, value }) => ({ source, value })),
      similar ? stillShared.length === 0 : undefined,
    );
  };

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
              if (e.key === 'Enter') confirm();
            }}
            placeholder="e.g. Product card, Customer row..."
            autoFocus
          />
        </div>
        {candidates.length > 0 && (
          <div className="space-y-2" data-qa="container-identity">
            <Label>
              Identify this one by <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {candidates.map((c, i) => (
                <label key={`${c.source}|${c.value}`} data-qa="container-identity-option" className="flex cursor-pointer items-start gap-2 text-xs">
                  <Checkbox
                    className="mt-0.5 shrink-0"
                    checked={selected.includes(i)}
                    onCheckedChange={on => setSelected(on ? [...selected, i] : selected.filter(s => s !== i))}
                  />
                  <span className="min-w-0 break-words">
                    <span className="text-muted-foreground">{c.source}:</span> {c.value}
                  </span>
                </label>
              ))}
            </div>
            {status && <p data-qa="container-identity-status" className="text-xs text-muted-foreground">{status}</p>}
          </div>
        )}
        <DialogFooter>
          <Button data-qa="pre-pick-container-cancel-btn" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button data-qa="pre-pick-container-confirm-btn" onClick={confirm} disabled={!trimmed}>
            Set Container
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
