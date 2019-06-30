export enum ReleaseType {
  Major = "major",
  Minor = "minor",
  Patch = "patch",
}

export interface ValidRelease {
  kind: "valid";
  type: ReleaseType;
  skip: boolean;
}

export const validRelease = ({ type, skip }: { type: ReleaseType; skip: boolean }): ValidRelease => ({
  kind: "valid",
  type,
  skip,
});

export interface InvalidRelease<R> {
  kind: "invalid";
  reason: R;
}

export const invalidRelease = <R>(reason: R): InvalidRelease<R> => ({
  kind: "invalid",
  reason,
});

export type Release<R> = ValidRelease | InvalidRelease<R>;
