import type { ExportPage, ExportRecording, ExportStep } from '../types';
import { downloadBlob, makeFilenameBase } from './exporter';

type OrderedPageStep = {
  page: ExportPage;
  step: ExportStep;
  originalIndex: number;
};

function getOrderedPageSteps(recording: ExportRecording): OrderedPageStep[] {
  const pageSteps: OrderedPageStep[] = [];
  let originalIndex = 0;

  for (const page of recording.pages) {
    for (const step of page.steps) {
      pageSteps.push({ page, step, originalIndex: originalIndex++ });
    }
  }

  return pageSteps.sort((a, b) => {
    const orderDelta = a.step.stepOrder - b.step.stepOrder;
    return orderDelta || a.originalIndex - b.originalIndex;
  });
}

export function generateTestCase(recording: ExportRecording): string {
  const lines: string[] = [];

  // Header
  lines.push(recording.testName || 'Untitled Test');
  lines.push('');

  // Preconditions
  if (recording.preconditions?.length) {
    lines.push('Preconditions:');
    recording.preconditions.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push('');
  }

  const steps: string[] = [];
  const expectedResults: string[] = [];

  // Flatten all top-level steps to find where the trailing assertion block starts
  const orderedPageSteps = getOrderedPageSteps(recording);
  const allTopLevelSteps: ExportStep[] = orderedPageSteps.map(({ step }) => step);
  let trailingStart = allTopLevelSteps.length;
  for (let i = allTopLevelSteps.length - 1; i >= 0; i--) {
    const st = allTopLevelSteps[i].stepType;
    if (st === 'ASSERTION_WITH_ELEMENT' || st === 'ASSERTION_WITHOUT_ELEMENT') {
      trailingStart = i;
    } else {
      break;
    }
  }

  let flatIndex = 0;

  function walkStep(step: ExportStep): void {
    const isAssertion =
      step.stepType === 'ASSERTION_WITH_ELEMENT' ||
      step.stepType === 'ASSERTION_WITHOUT_ELEMENT';
    const isTrailing = flatIndex >= trailingStart;

    if (isAssertion && isTrailing) {
      // Trailing assertions go to expected results
      if (step.stepType === 'ASSERTION_WITH_ELEMENT') {
        expectedResults.push(step.expectedResultsDescription || step.actionName);
      } else {
        expectedResults.push(step.actionName);
      }
    } else if (isAssertion) {
      // Mid-test assertions stay inline with "Verify" prefix
      let text =
        step.stepType === 'ASSERTION_WITH_ELEMENT'
          ? (step.expectedResultsDescription || step.actionName)
          : step.actionName;
      text = text.replace(/^Assert:\s*/i, 'Verify ');
      steps.push(text);
    } else {
      // COMBINED/SUBGROUP containers and leaf actions all contribute their name
      steps.push(step.actionName);
    }

    flatIndex++;
  }

  function isManualOrAssertion(step: ExportStep): boolean {
    return step.actionKind === 'comment' ||
      step.stepType === 'ASSERTION_WITH_ELEMENT' ||
      step.stepType === 'ASSERTION_WITHOUT_ELEMENT';
  }

  const firstPage = orderedPageSteps[0]?.page ?? recording.pages[0];
  if (firstPage) {
    steps.push(`Open ${recording.baseUrl ?? ''}${firstPage.pageUrl}`);
  }

  let currentPageKey = '';
  let isFirstActionInPageSegment = false;

  for (const { page, step } of orderedPageSteps) {
    const pageKey = page.pageUrl || page.pageName;
    if (pageKey !== currentPageKey) {
      currentPageKey = pageKey;
      isFirstActionInPageSegment = true;
    }

    const prevLen = steps.length;
    walkStep(step);
    if (isFirstActionInPageSegment && steps.length > prevLen && !isManualOrAssertion(step)) {
      steps[steps.length - 1] += ` at ${page.pageName} page`;
      isFirstActionInPageSegment = false;
    }
  }

  // Output
  lines.push('Steps:');
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));

  if (expectedResults.length > 0) {
    lines.push('');
    lines.push('Expected results:');
    expectedResults.forEach((er, i) => lines.push(`${i + 1}. ${er}`));
  }

  return lines.join('\n');
}

export function downloadTestCase(recording: ExportRecording, text: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain' }), `${makeFilenameBase(recording.testName)}.txt`);
}
