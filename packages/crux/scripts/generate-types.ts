import { compile } from "json-schema-to-typescript";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA_DIRECTORY = join(PACKAGE_ROOT, "schemas");
const TYPES_DIRECTORY = join(PACKAGE_ROOT, "types");
const GENERATED_DIRECTORY = join(TYPES_DIRECTORY, "generated");
const INDEX_PATH = join(TYPES_DIRECTORY, "index.d.ts");
const CHECK_FLAG = "--check";

const SCHEMAS = [
  ["rule.schema.json", "RuleRecord"],
  ["suppression.schema.json", "SuppressionForm"],
  ["profile.schema.json", "ExecutionProfile"],
  ["policy.schema.json", "Policy"],
  ["engine-manifest.schema.json", "EngineManifest"],
] as const;

const BANNER = `/**
 * Generated from packages/crux/schemas/*.schema.json.
 * Do not edit directly; run \`bun run --cwd packages/crux generate:types\`.
 */

`;

type GeneratedFile = {
  content: string;
  path: string;
};

async function generateDeclarations(): Promise<GeneratedFile[]> {
  const schemasById = await loadSchemas();
  const declarations = await Promise.all(
    SCHEMAS.map(async ([schemaFile, typeName]) => {
      const schemaId = schemasById
        .keys()
        .find((id) =>
          id.includes(`/${parse(schemaFile).name.replace(".schema", "")}/`),
        );
      if (schemaId === undefined) {
        throw new Error(`Schema ID not found for ${schemaFile}`);
      }
      const schema = schemasById.get(schemaId);
      if (schema === undefined) {
        throw new Error(`Schema not found for ${schemaId}`);
      }
      const generationSchema = schemaForTypes(structuredClone(schema)) as {
        $id?: string;
      };
      delete generationSchema.$id;
      const declaration = await compile(generationSchema, typeName, {
        $refOptions: {
          resolve: {
            cruxSchema: {
              canRead: (file: { url: string }) => schemasById.has(file.url),
              read: (file: { url: string }) => {
                const referencedSchema = schemasById.get(file.url);
                if (referencedSchema === undefined) {
                  throw new Error(`Unknown Crux schema reference: ${file.url}`);
                }
                return schemaForTypes(
                  structuredClone(referencedSchema),
                ) as object;
              },
            },
            http: false,
          },
        },
        additionalProperties: false,
        bannerComment: "",
        cwd: SCHEMA_DIRECTORY,
        format: true,
        style: {
          bracketSpacing: true,
          printWidth: 80,
          semi: true,
          singleQuote: false,
          tabWidth: 2,
          trailingComma: "all",
          useTabs: false,
        },
        unreachableDefinitions: true,
      });
      return {
        content: `${BANNER}${declaration}`,
        path: join(
          GENERATED_DIRECTORY,
          `${parse(schemaFile).name.replace(".schema", "")}.d.ts`,
        ),
      };
    }),
  );

  const index = `${BANNER}${SCHEMAS.map(
    ([schemaFile, typeName]) =>
      `export type { ${typeName} } from "./generated/${parse(schemaFile).name.replace(".schema", "")}.js";`,
  ).join("\n")}\n`;

  return [...declarations, { content: index, path: INDEX_PATH }];
}

async function loadSchemas(): Promise<Map<string, object>> {
  const entries = await Promise.all(
    SCHEMAS.map(async ([schemaFile]) => {
      const schema = JSON.parse(
        await readFile(join(SCHEMA_DIRECTORY, schemaFile), "utf8"),
      ) as { $id: string };
      return [schema.$id, schema] as const;
    }),
  );
  return new Map(entries);
}

async function main(): Promise<void> {
  const generatedFiles = await generateDeclarations();

  if (process.argv.includes(CHECK_FLAG)) {
    const staleFiles: string[] = [];
    for (const generatedFile of generatedFiles) {
      let committed = "";
      try {
        committed = await readFile(generatedFile.path, "utf8");
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      }
      if (committed !== generatedFile.content) {
        staleFiles.push(generatedFile.path);
      }
    }
    if (staleFiles.length > 0) {
      throw new Error(
        `Generated declarations are stale: ${staleFiles.join(", ")}; run bun run --cwd packages/crux generate:types`,
      );
    }
    return;
  }

  await mkdir(GENERATED_DIRECTORY, { recursive: true });
  await Promise.all(
    generatedFiles.map((generatedFile) =>
      writeFile(generatedFile.path, generatedFile.content),
    ),
  );
}

function schemaForTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => schemaForTypes(item));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const isConditionalConstraints =
        key === "allOf" &&
        Array.isArray(entry) &&
        entry.every(
          (item) =>
            item !== null &&
            typeof item === "object" &&
            "if" in item &&
            "then" in item,
        );
      return isConditionalConstraints
        ? []
        : [[key, schemaForTypes(entry)] as const];
    }),
  );
}

await main();
