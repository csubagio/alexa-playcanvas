declare function startedInLaunch() : boolean;
declare const alexaHasWakeWord: boolean;

declare interface AlexaHost {
  pushDebug(val: any): void;
  spoof(intent: string, slots: Record<string, string[]>): void;
}

declare interface AlexaHostIntent {
  request: any;
  intent: string;
  slots: Record<string, string[]>;
}

declare const pc: any;