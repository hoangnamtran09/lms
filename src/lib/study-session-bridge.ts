type VoidFn = () => void;

interface StudySessionBridge {
  endSession: VoidFn | null;
  getElapsed: (() => number) | null;
  timerEl: HTMLSpanElement | null;
}

export const bridge: StudySessionBridge = {
  endSession: null,
  getElapsed: null,
  timerEl: null,
};
