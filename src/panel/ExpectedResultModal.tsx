import React, { useEffect, useState } from 'react';
import type { AssertionType, ContainerContext, ElementInfo, ExpectedResult, Selectors } from '../types';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Check, Container } from 'lucide-react';

interface Props {
  onSave: (result: ExpectedResult) => void;
  onCancel: () => void;
  onPickElement: () => void;
  pickedElement?: { elementInfo: ElementInfo; selectors: Selectors } | null;
  pendingContainer?: ContainerContext;
  onPickContainer?: () => void;
  onClearContainer?: () => void;
  initialResult?: ExpectedResult;
  title?: string;
}

const assertionTypes: { value: AssertionType; label: string }[] = [
  { value: 'text_equals', label: 'Text equals' },
  { value: 'text_contains', label: 'Text contains' },
  { value: 'visible', label: 'Element is visible' },
  { value: 'hidden', label: 'Element is hidden' },
  { value: 'enabled', label: 'Element is enabled' },
  { value: 'disabled', label: 'Element is disabled' },
  { value: 'checked', label: 'Checkbox is checked' },
  { value: 'unchecked', label: 'Checkbox is unchecked' },
];

export function ExpectedResultModal({
  onSave,
  onCancel,
  onPickElement,
  pickedElement,
  pendingContainer,
  onPickContainer,
  onClearContainer,
  initialResult,
  title,
}: Props) {
  const [description, setDescription] = useState(initialResult?.description || '');
  const [assertionType, setAssertionType] = useState<AssertionType>(initialResult?.assertion?.type || 'visible');
  const [expectedValue, setExpectedValue] = useState(initialResult?.assertion?.expectedValue || '');

  useEffect(() => {
    if (pickedElement) {
      const text = pickedElement.elementInfo.innerText || pickedElement.elementInfo.textContent;
      if (text) setExpectedValue(text.slice(0, 200));
    }
  }, [pickedElement]);

  const effectiveElement = pickedElement || (() => {
    const el = initialResult?.assertion?.element;
    if (!el) return null;
    return {
      elementInfo: {
        tagName: 'element',
        textContent: el.textContent || '',
        accessibleName: el.accessibleName || '',
        innerText: el.textContent || '',
        attributes: {},
      } as ElementInfo,
      selectors: {
        primary: { type: 'css' as const, value: el.selector, score: 0 },
        alternatives: [],
      } as Selectors,
    };
  })();

  const handleSave = () => {
    const result: ExpectedResult = { description };

    if (effectiveElement) {
      result.assertion = {
        element: {
          selector: effectiveElement.selectors.primary.value,
          textContent: effectiveElement.elementInfo.textContent,
          accessibleName: effectiveElement.elementInfo.accessibleName,
        },
        type: assertionType,
        expectedValue: ['text_equals', 'text_contains'].includes(assertionType) ? expectedValue : undefined,
      };
    }

    onSave(result);
  };

  const needsValue = ['text_equals', 'text_contains'].includes(assertionType);

  return (
    <Dialog open={true} onClose={onCancel}>
      <DialogContent id="qa-expected-result-modal" data-qa="expected-result-modal" className="max-w-md">
        <DialogHeader>
          <DialogTitle data-qa="expected-result-title">{title || 'Add Expected Result'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label data-qa="expected-result-description-label" htmlFor="qa-expected-result-description">
              Description
            </Label>
            <textarea
              id="qa-expected-result-description"
              data-qa="expected-result-description"
              className="flex min-h-20 w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Login success message appears"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label data-qa="container-assertion-label">Container (optional)</Label>
            {pendingContainer ? (
              <div data-qa="picked-container-info" className="rounded-md border border-amber-300 bg-secondary px-3 py-2">
                <div className="flex items-start gap-2">
                  <Container className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {pendingContainer.containerLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      &lt;{pendingContainer.containerTag}&gt;
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  {onPickContainer && (
                    <Button data-qa="pick-different-container-btn" variant="outline" size="sm" onClick={onPickContainer}>
                      Pick Again
                    </Button>
                  )}
                  {onClearContainer && (
                    <Button data-qa="clear-container-btn" variant="outline" size="sm" onClick={onClearContainer}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            ) : onPickContainer ? (
              <Button data-qa="pick-container-btn" variant="outline" className="w-full justify-center" onClick={onPickContainer}>
                <Container className="mr-1 h-3.5 w-3.5" />
                Pick Container on Page
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label data-qa="element-assertion-label">Element Assertion (optional)</Label>
            {effectiveElement ? (
              <div data-qa="picked-element-info" className="rounded-md border border-green-500 bg-secondary px-3 py-2">
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      &lt;{effectiveElement.elementInfo.tagName}&gt;
                      {effectiveElement.elementInfo.innerText ? ` "${effectiveElement.elementInfo.innerText.slice(0, 40)}"` : ''}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {effectiveElement.selectors.primary.value}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button data-qa="pick-different-element-btn" variant="outline" size="sm" onClick={onPickElement}>
                    Pick Again
                  </Button>
                </div>
              </div>
            ) : (
              <Button data-qa="pick-element-btn" variant="outline" className="w-full justify-center" onClick={onPickElement}>
                Pick Element on Page
              </Button>
            )}
          </div>

          {effectiveElement && (
            <>
              <div className="space-y-2">
                <Label data-qa="assertion-type-label" htmlFor="qa-assertion-type-select">
                  Assertion Type
                </Label>
                <select
                  id="qa-assertion-type-select"
                  data-qa="assertion-type-select"
                  className="flex h-8 w-full rounded-md border border-border bg-input-background px-3 py-1 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring"
                  value={assertionType}
                  onChange={e => setAssertionType(e.target.value as AssertionType)}
                >
                  {assertionTypes.map(at => (
                    <option key={at.value} value={at.value}>{at.label}</option>
                  ))}
                </select>
              </div>

              {needsValue && (
                <div className="space-y-2">
                  <Label data-qa="expected-value-label" htmlFor="qa-expected-value-input">
                    Expected Value
                  </Label>
                  <Input
                    id="qa-expected-value-input"
                    data-qa="expected-value-input"
                    value={expectedValue}
                    onChange={e => setExpectedValue(e.target.value)}
                    placeholder="Expected text..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button data-qa="expected-result-cancel-btn" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button data-qa="expected-result-save-btn" onClick={handleSave} disabled={!description.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
