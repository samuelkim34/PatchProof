import { Daytona } from "@daytona/sdk";

const daytona = new Daytona();
let sandbox;

try {
  console.log("Creating Daytona sandbox...");

  sandbox = await daytona.create({
    language: "typescript",
    ephemeral: true,
    autoStopInterval: 5,
  });

  console.log("Sandbox created:", sandbox.id);

  const response = await sandbox.process.executeCommand(
    "echo PATCHPROOF_DAYTONA_OK"
  );

  console.log(response.result);

  if (response.exitCode !== 0) {
    throw new Error("Sandbox command failed");
  }
} catch (error) {
  console.error("Daytona test failed:", error.message);
  process.exitCode = 1;
} finally {
  if (sandbox) {
    try {
      await daytona.delete(sandbox, 60, true);
      console.log("Sandbox deleted successfully.");
    } catch (error) {
      console.error("Cleanup failed:", error.message);
      process.exitCode = 1;
    }
  }
}
