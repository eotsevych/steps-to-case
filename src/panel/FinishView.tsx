import React, { useEffect, useMemo, useState } from 'react';
import type { ExportRecording } from '../types';
import { exportToJson, downloadJson, downloadBlob, makeFilenameBase } from '../lib/exporter';
import { generateTestCase, downloadTestCase } from '../lib/testCaseGenerator';
import { loadPromptTemplate, savePromptTemplate } from '../lib/settings';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { ArrowLeft, Copy, Download, Check, Plus } from 'lucide-react';

interface Props {
  recording: ExportRecording;
  onBack: () => void;
  jsonOnly?: boolean; // single-step flow: show only the JSON tab
  jsonOverride?: string; // single-step flow: use this JSON instead of the full recording export
  onNewTest?: () => void; // start recording a fresh test case
}

export function FinishView({ recording, onBack, jsonOnly, jsonOverride, onNewTest }: Props) {
  const testCaseText = useMemo(() => generateTestCase(recording), [recording]);
  const jsonText = useMemo(
    () => jsonOverride ?? exportToJson(recording),
    [recording, jsonOverride],
  );

  const [copiedTestCase, setCopiedTestCase] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [promptText, setPromptText] = useState('');

  useEffect(() => {
    loadPromptTemplate().then(setPromptText);
  }, []);

  const handleCopy = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // split/join replaces every occurrence and is immune to `$&`-style
  // replacement patterns that may appear in the recorded content.
  const buildFilledPrompt = () => {
    return promptText
      .split('%PLAIN_TEXT%').join(testCaseText)
      .split('%JSON%').join(jsonText);
  };

  const handleDownloadPrompt = () => {
    const filled = buildFilledPrompt();
    downloadBlob(new Blob([filled], { type: 'text/plain' }), `${makeFilenameBase(recording.testName)}-prompt.txt`);
  };

  const handleSavePrompt = async () => {
    await savePromptTemplate(promptText);
  };

  const handleDownloadJson = () => {
    if (jsonOverride != null) {
      downloadBlob(new Blob([jsonOverride], { type: 'application/json' }), `${makeFilenameBase(recording.testName)}.json`);
      return;
    }
    downloadJson(recording);
  };

  return (
    <div id="qa-finish-container" data-qa="finish-container" className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div id="qa-finish-header" data-qa="finish-header" className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button id="qa-finish-back-btn" data-qa="back-btn" variant="ghost" size="icon" onClick={onBack} title="Back to review">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-sm font-semibold text-foreground truncate">Export</h1>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-32">{recording.testName || 'Untitled Test'}</span>
        </div>
      </div>

      {/* Tabs body */}
      <div className="flex-1 overflow-auto px-4 py-3">
        <Tabs defaultValue={jsonOnly ? 'json' : 'prompt'}>
          {!jsonOnly && (
            <TabsList className="mb-1">
              <TabsTrigger value="prompt">AI Prompt</TabsTrigger>
              <TabsTrigger value="testcase">Test Case</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          )}

          {/* AI Prompt tab */}
          {!jsonOnly && (
          <TabsContent value="prompt">
            <div id="qa-finish-prompt-section" data-qa="prompt-section" className="space-y-3">
              <p id="qa-finish-prompt-hint" data-qa="prompt-hint" className="text-sm text-muted-foreground">
                Edit the prompt below. Leave <code className="bg-secondary px-1 py-0.5 rounded text-xs">%PLAIN_TEXT%</code> and <code className="bg-secondary px-1 py-0.5 rounded text-xs">%JSON%</code> in the text.
              </p>
              <textarea
                id="qa-finish-prompt-textarea"
                data-qa="prompt-textarea"
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                rows={10}
                className="flex w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring resize-y"
              />
              <div id="qa-finish-prompt-actions" data-qa="prompt-actions" className="flex gap-2">
                <Button
                  id="qa-finish-prompt-copy-btn"
                  data-qa="prompt-copy-btn"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleCopy(buildFilledPrompt(), setCopiedPrompt)}
                >
                  {copiedPrompt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedPrompt ? 'Copied' : 'Copy Filled'}
                </Button>
                <Button
                  id="qa-finish-prompt-download-btn"
                  data-qa="prompt-download-btn"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleDownloadPrompt}
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
                <Button
                  id="qa-finish-prompt-save-btn"
                  data-qa="prompt-save-btn"
                  size="sm"
                  onClick={handleSavePrompt}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </TabsContent>
          )}

          {/* Test Case tab */}
          {!jsonOnly && (
          <TabsContent value="testcase">
            <div id="qa-finish-testcase-section" data-qa="testcase-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generated Test Case</h2>
                <div className="flex gap-2">
                  <Button
                    id="qa-finish-testcase-copy-btn"
                    data-qa="testcase-copy-btn"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleCopy(testCaseText, setCopiedTestCase)}
                  >
                    {copiedTestCase ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedTestCase ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    id="qa-finish-testcase-download-btn"
                    data-qa="testcase-download-btn"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => downloadTestCase(recording, testCaseText)}
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </Button>
                </div>
              </div>
              <pre
                id="qa-finish-testcase-content"
                data-qa="testcase-content"
                className="bg-[#161b22] text-[#e6edf3] rounded-lg p-3 text-sm font-mono whitespace-pre-wrap break-all max-h-[480px] overflow-auto border border-border"
              >
                {testCaseText}
              </pre>
            </div>
          </TabsContent>
          )}

          {/* JSON tab */}
          <TabsContent value="json">
            <div id="qa-finish-json-section" data-qa="json-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">JSON Export</h2>
                <div className="flex gap-2">
                  <Button
                    id="qa-finish-json-copy-btn"
                    data-qa="json-copy-btn"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleCopy(jsonText, setCopiedJson)}
                  >
                    {copiedJson ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedJson ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    id="qa-finish-json-download-btn"
                    data-qa="json-download-btn"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleDownloadJson}
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </Button>
                </div>
              </div>
              <pre
                id="qa-finish-json-content"
                data-qa="json-content"
                className="bg-[#161b22] text-[#e6edf3] rounded-lg p-3 text-sm font-mono whitespace-pre-wrap break-all max-h-[480px] overflow-auto border border-border"
              >
                {jsonText}
              </pre>
            </div>
          </TabsContent>
        </Tabs>

        {onNewTest && (
          <div
            id="qa-finish-new-test-banner"
            data-qa="new-test-banner"
            className="flex items-center justify-between gap-3 mt-4 px-3 py-2 rounded-md border border-border bg-secondary"
          >
            <p className="text-xs text-muted-foreground">
              Ready to record another one?
            </p>
            <Button
              id="qa-finish-new-test-btn"
              data-qa="new-test-btn"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={onNewTest}
            >
              <Plus className="w-3 h-3" />
              New Test Case
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
