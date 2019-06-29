class BaseTestHook {
  public canBail: boolean;
  public isWaterfall: boolean;
  public isSeries: boolean;
  public isParallel: boolean;
  public opts?: string[];

  public constructor(name: string, opts?: string[]) {
    this.canBail = name.includes("Bail");
    this.isWaterfall = name.includes("Waterfall");
    this.isSeries = name.includes("Series");
    this.isParallel = !this.isSeries;
    this.opts = opts;
  }

  public isUsed = jest.fn();
}

const testHookBuilder = (name: string) =>
  name.startsWith("Sync")
    ? class SyncTestHook extends BaseTestHook {
        public constructor(opts?: string[]) {
          super(name, opts);
        }
        public call = jest.fn().mockImplementation((...args) => {
          expect(args.length).toBe((this.opts || []).length);
        });
      }
    : class AsyncTestHook extends BaseTestHook {
        public constructor(opts?: string[]) {
          super(name, opts);
        }
        public promise = jest.fn().mockImplementation((...args) => {
          expect(args.length).toBe((this.opts || []).length);
        });
      };

export const SyncHook = testHookBuilder("SyncHook");
export const SyncBailHook = testHookBuilder("SyncBailHook");
export const SyncWaterfallHook = testHookBuilder("SyncWaterfallHook");
export const SyncLoopHook = testHookBuilder("SyncLoopHook");
export const AsyncParallelHook = testHookBuilder("AsyncParallelHook");
export const AsyncParallelBailHook = testHookBuilder("AsyncParallelBailHook");
export const AsyncSeriesHook = testHookBuilder("AsyncSeriesHook");
export const AsyncSeriesBailHook = testHookBuilder("AsyncSeriesBailHook");
export const AsyncSeriesWaterfallHook = testHookBuilder("AsyncSeriesWaterfallHook");
