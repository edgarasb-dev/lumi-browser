/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "objc-js" {
  export class NobjcLibrary {
    constructor(path: string);
    [key: string]: any;
  }
  export interface NobjcObject {
    [key: string]: any;
  }
  export function callFunction(func: any, ...args: any[]): any;
}
