import React, { useRef, useState } from 'react';
import type { Precondition } from '../types';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Plus, Pencil, X } from 'lucide-react';

interface Props {
  preconditions: Precondition[];
  onChange: (preconditions: Precondition[]) => void;
  onAdd: () => void;
}

/** Preconditions list with inline rename, shown above the steps while recording. */
export function PreconditionsSection({ preconditions, onChange, onAdd }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  // Enter and Escape both unmount the focused input, and removal fires blur
  // afterwards — this makes whichever key ran first the one that decides,
  // so Escape really cancels and Enter does not save twice.
  const settledRef = useRef(false);

  const startEditing = (p: Precondition) => {
    settledRef.current = false;
    setEditingId(p.id);
    setEditText(p.name);
  };

  const settleEdit = (id: string, save: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const name = editText.trim();
    setEditingId(null);
    setEditText('');
    if (!save || !name) return;
    onChange(preconditions.map(p => (p.id === id ? { ...p, name } : p)));
  };

  const remove = (id: string) => {
    onChange(preconditions.filter(p => p.id !== id).map((p, i) => ({ ...p, order: i })));
  };

  return (
    <div id="qa-recording-preconditions" data-qa="preconditions-section">
      <div className="flex items-center justify-between mb-2">
        <h2 data-qa="preconditions-header" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preconditions
        </h2>
        <Button
          id="qa-recording-add-precondition-btn"
          data-qa="add-precondition-btn"
          variant="ghost"
          size="sm"
          onClick={onAdd}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>
      {preconditions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No preconditions added</p>
      ) : (
        <div className="space-y-1">
          {preconditions.map((p) => (
            <div key={p.id} data-qa={`precondition-${p.id}`} className="flex items-center gap-2 p-2 bg-secondary rounded-md border border-border">
              {editingId === p.id ? (
                <Input
                  data-qa="precondition-edit-input"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => settleEdit(p.id, true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') settleEdit(p.id, true);
                    if (e.key === 'Escape') settleEdit(p.id, false);
                  }}
                  autoFocus
                  className="h-6 text-sm flex-1"
                />
              ) : (
                <span data-qa="precondition-name" className="text-sm flex-1 text-foreground">{p.name}</span>
              )}
              {editingId !== p.id && (
                <Button
                  data-qa="edit-precondition-btn"
                  variant="ghost"
                  size="icon"
                  onClick={() => startEditing(p)}
                  title="Edit"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
              <Button
                data-qa="delete-precondition-btn"
                variant="ghost"
                size="icon"
                onClick={() => remove(p.id)}
                title="Delete"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
