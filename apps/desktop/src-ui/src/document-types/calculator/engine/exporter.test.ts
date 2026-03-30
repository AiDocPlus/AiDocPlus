import { describe, it, expect } from 'vitest';
import { exportToCSV, exportToTXT } from './exporter';
import type { CalculatorDocumentContent } from '../types';
import { DEFAULT_CALCULATOR_SETTINGS } from '../types';

function minimalDoc(): CalculatorDocumentContent {
  const now = new Date().toISOString();
  return {
    version: 2,
    sheets: [
      {
        id: 's1',
        name: 'T',
        lines: [
          {
            id: 'l1',
            lineNumber: 1,
            expression: '2+2',
            result: { type: 'number', value: 4, displayValue: '4' },
            definedVariables: [],
            dependencies: [],
            lineRole: 'normal',
            isNote: false,
          },
        ],
        variables: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
    activeSheetId: 's1',
    settings: { ...DEFAULT_CALCULATOR_SETTINGS },
    createdAt: now,
    updatedAt: now,
  };
}

describe('exportToCSV', () => {
  it('uses localized column labels when provided', () => {
    const csv = exportToCSV(minimalDoc(), undefined, {
      lineNumber: 'Line',
      expression: 'Expr',
      result: 'Res',
      type: 'Kind',
      noteKind: 'Note',
    });
    const first = csv.split('\n')[0];
    expect(first).toBe('Line,Expr,Res,Kind');
  });

  it('uses × ÷ in expression column when operatorSymbols is cjk', () => {
    const doc = minimalDoc();
    doc.sheets[0]!.lines[0]!.expression = '3*4';
    doc.settings = { ...DEFAULT_CALCULATOR_SETTINGS, operatorSymbols: 'cjk' };
    const csv = exportToCSV(doc);
    const row = csv.split('\n')[1];
    expect(row).toContain('×');
  });
});

describe('exportToTXT', () => {
  it('uses × in expression when operatorSymbols is cjk', () => {
    const doc = minimalDoc();
    doc.sheets[0]!.lines[0]!.expression = '2*3';
    doc.settings = { ...DEFAULT_CALCULATOR_SETTINGS, operatorSymbols: 'cjk' };
    expect(exportToTXT(doc)).toContain('×');
  });
});
