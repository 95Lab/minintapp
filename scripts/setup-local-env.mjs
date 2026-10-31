import { copyFile } from "node:fs/promises";
import { constants } from "node:fs";
try {
  await copyFile(new URL("../.env.example", import.meta.url), new URL("../.env.local", import.meta.url), constants.COPYFILE_EXCL);
  console.log("Created .env.local. External integrations are not enabled.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(".env.local exists; preserved without changes.");
}
