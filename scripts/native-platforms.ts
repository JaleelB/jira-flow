import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface NativePlatform {
  package: string;
  os: "darwin" | "linux" | "win32";
  cpu: "arm64" | "x64";
  bunTarget: string;
  binary: "jira-flow" | "jira-flow.exe";
}

const projectRoot = join(import.meta.dir, "..");
export const NATIVE_PLATFORMS = JSON.parse(
  readFileSync(join(projectRoot, "npm", "platforms.json"), "utf8"),
) as Record<string, NativePlatform>;

export function currentNativeTarget(): string {
  return `${process.platform}-${process.arch}`;
}

export function selectedNativeTargets(args: string[]): string[] {
  if (args.includes("--all")) return Object.keys(NATIVE_PLATFORMS);
  const targetIndex = args.indexOf("--target");
  const target = targetIndex === -1 ? currentNativeTarget() : args[targetIndex + 1];
  if (target === undefined || NATIVE_PLATFORMS[target] === undefined) {
    throw new Error(
      `unsupported native target ${target ?? "(missing)"}; expected ${Object.keys(NATIVE_PLATFORMS).join(", ")}`,
    );
  }
  return [target];
}
