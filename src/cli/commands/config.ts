import type { Command } from "commander";
import { GLOBAL_SETTING_KEYS } from "../../application/ports/settings.port";
import { CONFIG_KEYS, type ManageConfig } from "../../application/use-cases/manage-config";

export function registerConfigCommand(
  program: Command,
  services: { manageConfig: ManageConfig },
): void {
  const config = program
    .command("config")
    .description("get or set JiraFlow repository or global configuration");

  config
    .command("list")
    .description("list effective configuration values")
    .option("--global", "global defaults and preferences")
    .action(async (options: { global?: boolean }) => {
      const result = await services.manageConfig.execute({
        path: process.cwd(),
        action: "list",
        global: options.global === true,
      });
      const lines = options.global
        ? GLOBAL_SETTING_KEYS.map((key) => `${key}=${String(result.globalSettings?.[key])}`)
        : CONFIG_KEYS.map((key) => {
            const value = String(result.effective[key]);
            const source = result.sources[key];
            return `${key}=${value} (${source})`;
          });
      process.stdout.write(`${lines.join("\n")}\n`);
    });

  config
    .command("get")
    .description("print one effective configuration value")
    .argument("<key>", "configuration key")
    .option("--global", "global defaults and preferences")
    .action(async (key: string, options: { global?: boolean }) => {
      const result = await services.manageConfig.execute({
        path: process.cwd(),
        action: "get",
        key,
        global: options.global === true,
      });
      process.stdout.write(`${result.value}\n`);
    });

  config
    .command("set")
    .description("set a repository-local configuration value")
    .argument("<key>", "configuration key")
    .argument("<value>", "value")
    .option("--global", "global defaults and preferences")
    .action(async (key: string, value: string, options: { global?: boolean }) => {
      await services.manageConfig.execute({
        path: process.cwd(),
        action: "set",
        key,
        value,
        global: options.global === true,
      });
    });

  config
    .command("unset")
    .description("remove a repository-local configuration value")
    .argument("<key>", "configuration key")
    .option("--global", "global defaults and preferences")
    .action(async (key: string, options: { global?: boolean }) => {
      await services.manageConfig.execute({
        path: process.cwd(),
        action: "unset",
        key,
        global: options.global === true,
      });
    });
}
