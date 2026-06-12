import { Response } from 'express';
import { ImportExecutionResult, ImportProgressEvent } from './parsers/types';

export function writeImportStreamEvent(
  res: Response,
  payload:
    | { type: 'progress'; data: ImportProgressEvent }
    | { type: 'complete'; result: ImportExecutionResult }
    | { type: 'error'; message: string },
): void {
  res.write(`${JSON.stringify(payload)}\n`);
}

export function initImportStreamResponse(res: Response): void {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}
