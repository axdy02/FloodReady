import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import ts from "typescript";

const sourceRoots = ["src", "prisma", "scripts", "tests"];
const rootSources = ["Dockerfile", "eslint.config.mjs", "prisma.config.ts", "vitest.config.ts", "package.json", "tsconfig.demo-seed.json", ".env.example", ".gitignore", ".dockerignore", "README.md"];
const sourceExtensions = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".prisma", ".sql"]);
const scriptExtensions = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const allowedEnvironmentFiles = new Set(["src/config/env.ts", "scripts/test-runner.mjs", "scripts/acceptance.mjs", "prisma/demo-seed-config.ts"]);
const violations = [];
const files = [];

const normalizedPath = (path) => path.replaceAll("\\", "/");

const location = (sourceFile, position) => sourceFile.getLineAndCharacterOfPosition(position).line + 1;

const addViolation = (path, line, rule) => {
  violations.push({ path, line, rule });
};

const walk = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    const normalized = normalizedPath(entryPath);
    if (entry.isDirectory()) {
      if (!normalized.includes("/generated") && !normalized.includes("/node_modules") && !normalized.includes("/dist")) {
        await walk(entryPath);
      }
      continue;
    }
    const extension = entry.name.includes(".") ? `.${entry.name.split(".").at(-1)}` : "";
    if (sourceExtensions.has(extension)) {
      files.push(normalized);
    }
  }
};

const rootIdentifier = (expression) => {
  let current = expression;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
};

const isProcessEnvironment = (node) => ts.isPropertyAccessExpression(node)
  && node.name.text === "env"
  && (
    ts.isIdentifier(node.expression) && node.expression.text === "process"
    || ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "process"
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === "globalThis"
  );

const testApi = (expression) => {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return testApi(expression.expression);
  }
  if (ts.isCallExpression(expression)) {
    return testApi(expression.expression);
  }
  return null;
};

const checkScriptSource = (path, source) => {
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source);
  let token = scanner.scan();
  let templateBraceDepth = 0;
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia || token === ts.SyntaxKind.ShebangTrivia) {
      const comment = scanner.getTokenText();
      addViolation(path, location(sourceFile, scanner.getTokenPos()), comment.includes("@ts-ignore") ? "TS_IGNORE" : "COMMENT");
    }
    if (token === ts.SyntaxKind.TemplateHead || token === ts.SyntaxKind.TemplateMiddle) {
      templateBraceDepth = 1;
      token = scanner.scan();
      continue;
    }
    if (templateBraceDepth > 0 && token === ts.SyntaxKind.OpenBraceToken) {
      templateBraceDepth += 1;
    }
    if (templateBraceDepth > 0 && token === ts.SyntaxKind.CloseBraceToken) {
      templateBraceDepth -= 1;
      if (templateBraceDepth === 0) {
        token = scanner.reScanTemplateToken();
        continue;
      }
    }
    token = scanner.scan();
  }

  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      addViolation(path, location(sourceFile, node.getStart(sourceFile)), "ANY_TYPE");
    }
    if (ts.isNonNullExpression(node)) {
      addViolation(path, location(sourceFile, node.getStart(sourceFile)), "NON_NULL_ASSERTION");
    }
    if (
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      && (ts.isAsExpression(node.expression) || ts.isTypeAssertionExpression(node.expression))
    ) {
      addViolation(path, location(sourceFile, node.getStart(sourceFile)), "UNSAFE_DOUBLE_CAST");
    }
    if (isProcessEnvironment(node) && !allowedEnvironmentFiles.has(path)) {
      addViolation(path, location(sourceFile, node.getStart(sourceFile)), "PROCESS_ENV");
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiver = rootIdentifier(node.expression.expression);
      const testReceiver = testApi(node.expression.expression);
      if (receiver === "console") {
        addViolation(path, location(sourceFile, node.getStart(sourceFile)), "CONSOLE_CALL");
      }
      if (method === "$queryRawUnsafe" || method === "$executeRawUnsafe") {
        addViolation(path, location(sourceFile, node.getStart(sourceFile)), "UNSAFE_PRISMA_RAW");
      }
      if ((method === "only" || method === "skip" || method === "todo") && ["describe", "it", "test", "suite"].includes(testReceiver ?? "")) {
        addViolation(path, location(sourceFile, node.getStart(sourceFile)), "FOCUSED_OR_SKIPPED_TEST");
      }
      if (method === "concurrent" && ["describe", "it", "test", "suite"].includes(testReceiver ?? "")) {
        addViolation(path, location(sourceFile, node.getStart(sourceFile)), "CONCURRENT_TEST");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
};

const quoteAwareCommentLines = (source, grammar) => {
  const lines = [];
  let quote = null;
  let dollarQuote = null;
  let escaped = false;
  let line = 1;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1] ?? "";
    if (character === "\n") {
      line += 1;
      escaped = false;
      continue;
    }
    if (dollarQuote !== null) {
      if (source.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }
    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (grammar === "sql" && character === "$") {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(source.slice(index));
      if (tag !== null) {
        dollarQuote = tag[0];
        index += dollarQuote.length - 1;
        continue;
      }
    }
    if (grammar === "sql" && character === "-" && next === "-") {
      lines.push(line);
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      line += 1;
      continue;
    }
    if ((grammar === "prisma" || grammar === "sql") && character === "/" && next === "*") {
      lines.push(line);
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") {
          line += 1;
        }
        index += 1;
      }
      index += 1;
      continue;
    }
    if (grammar === "prisma" && character === "/" && next === "/") {
      lines.push(line);
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      line += 1;
    }
  }
  return lines;
};

const checkNonScriptSource = (path, source) => {
  if (path.endsWith(".env.example") || path.endsWith(".gitignore") || path.endsWith(".dockerignore") || path.endsWith(".json")) {
    if (path.endsWith(".env.example") && /replace_/u.test(source)) addViolation(path, 1, "SECRET_PLACEHOLDER");
    return;
  }
  if (basename(path) === "Dockerfile") {
    source.split(/\r?\n/u).forEach((line, index) => {
      if (/^\s*#/u.test(line)) {
        addViolation(path, index + 1, "COMMENT");
      }
    });
    return;
  }
  const grammar = path.endsWith(".sql") ? "sql" : "prisma";
  for (const line of quoteAwareCommentLines(source, grammar)) {
    addViolation(path, line, "COMMENT");
  }
};

for (const root of sourceRoots) {
  await walk(root);
}
for (const rootSource of rootSources) {
  try {
    await readFile(rootSource, "utf8");
    files.push(rootSource);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

for (const path of files.sort()) {
  const source = await readFile(path, "utf8");
  if (path === "README.md") {
    for (const block of source.split("```").filter((_, index) => index % 2 === 1)) {
      if (/replace_|password\s*=/iu.test(block)) addViolation(path, 1, "SECRET_LIKE_DOCUMENTATION");
    }
    continue;
  }
  if (scriptExtensions.has(`.${path.split(".").at(-1)}`)) {
    checkScriptSource(path, source);
  } else {
    checkNonScriptSource(path, source);
  }
}

if (violations.length > 0) {
  for (const violation of violations.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.rule.localeCompare(right.rule))) {
    process.stderr.write(`${violation.path}:${violation.line} ${violation.rule}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`${files.length} authored files scanned, 0 violations\n`);
}
