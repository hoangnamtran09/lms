type VoidFn = () => void;

interface StudySessionBridge {
  endSession: VoidFn | null;
  getElapsed: (() => number) | null;
  getSessionId: (() => string | null) | null;
  timerEl: HTMLSpanElement | null;
}

export const bridge: StudySessionBridge = {
  endSession: null,
  getElapsed: null,
  getSessionId: null,
  timerEl: null,
};
