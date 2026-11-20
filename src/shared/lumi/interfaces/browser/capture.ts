export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturedPageResult {
  dataUrl: string;
  width: number;
  height: number;
  title: string;
  suggestedFilename: string;
}

export interface SaveCaptureResult {
  saved: boolean;
  path?: string;
}

export interface LumiCaptureAPI {
  captureVisible: (rect?: CaptureRect) => Promise<CapturedPageResult | null>;
  captureFullPage: () => Promise<CapturedPageResult | null>;
  copyDataUrl: (dataUrl: string) => Promise<boolean>;
  savePng: (dataUrl: string, suggestedFilename?: string) => Promise<SaveCaptureResult>;
}
