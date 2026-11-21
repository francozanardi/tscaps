import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { build, type Rollup } from 'vite';
import ts from 'typescript';

/**
 * What importing this package costs, asked of a bundler.
 *
 * The inference library carries the whole ONNX runtime, which is the
 * heaviest dependency here by a wide margin and the only one with a
 * native binding. Reaching it from the entry point is not a matter of
 * taste: a consumer that renders captions and never transcribes pays for
 * it in download, and in Node the binding is loaded — and on musl, fails
 * to load — for code that never runs.
 *
 * A static read of the imports would only restate what the source says.
 * The question is what a bundler *resolves*, which is decided by every
 * re-export and every `import type` erasure along the way, so the bundler
 * is what gets asked. `TransformersRuntime` is the one place allowed to
 * reach the library, and it does so dynamically, which puts it in a chunk
 * of its own.
 */

const INFERENCE_RUNTIME = /@huggingface[\\/]transformers|onnxruntime/;

const ENTRY_POINTS = ['index.ts', 'advanced.ts'];

async function bundleEntryPoint(entry: string): Promise<Rollup.OutputChunk[]> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@modules': resolve(import.meta.dirname, 'modules') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, entry),
        // The entry is nothing but re-exports; an app build would shake
        // them away and measure an empty graph.
        preserveEntrySignatures: 'strict',
      },
    },
  });
  const outputs = (Array.isArray(result) ? result[0]! : result) as Rollup.RollupOutput;
  return outputs.output.filter((item): item is Rollup.OutputChunk => item.type === 'chunk');
}

function modulesOf(chunk: Rollup.OutputChunk): string[] {
  return Object.keys(chunk.modules);
}

describe.each(ENTRY_POINTS)('the package entry point %s', (entryFile) => {
  it('does not pull the inference runtime into the chunk it loads eagerly', async () => {
    const chunks = await bundleEntryPoint(entryFile);
    const entry = chunks.find((chunk) => chunk.isEntry);

    expect(entry).toBeDefined();
    expect(modulesOf(entry!).filter((id) => INFERENCE_RUNTIME.test(id))).toEqual([]);
  }, 120_000);

});

describe('the stable entry point', () => {
  it('still reaches the inference runtime, behind a chunk of its own', async () => {
    const chunks = await bundleEntryPoint('index.ts');
    const carrying = chunks.filter((chunk) => modulesOf(chunk).some((id) => INFERENCE_RUNTIME.test(id)));

    // Without this the first assertion would also pass on a package that
    // had dropped transcription altogether, which is not the promise.
    expect(carrying.length).toBeGreaterThan(0);
    expect(carrying.every((chunk) => !chunk.isEntry)).toBe(true);
  }, 120_000);
});

/**
 * What a caller of the stable entry can name.
 *
 * The stable entry promises semantic versioning for everything it
 * exports. That promise only holds if a caller never needs a type the
 * entry does not export: a constructor parameter, a method's argument or
 * result, a field of an exported interface. Such a type would either be
 * unnameable, or reachable only through `@tscaps/engine/advanced`, which
 * makes no such promise and would then carry the stable one in disguise.
 *
 * The compiler is the oracle: every type named in the public part of an
 * exported declaration is resolved to its declaration, and must be one
 * the stable entry exports. Private members, and anything declared
 * outside the engine (the DOM, mediabunny), are not asked about.
 */

/**
 * Advanced types a stable declaration names on purpose: extension points
 * a caller may plug in without the stable surface vouching for their shape.
 * Keyed by the stable declaration, valued by the advanced type.
 */
const ADVANCED_EXTENSION_POINTS: ReadonlyArray<string> = [
  'MediaBunnyRenderers -> MediaBunnyRendererParts',
  'MediaBunnyRenderersOptions -> MediaBunnyRendererOverrides',
  'RenderJob -> TopLayerSource',
];

function stableEntryProgram(): { program: ts.Program; entry: ts.SourceFile } {
  const engineRoot = resolve(import.meta.dirname, '..');
  const config = ts.getParsedCommandLineOfConfigFile(resolve(engineRoot, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    },
  });
  const entryPath = resolve(import.meta.dirname, 'index.ts');
  const program = ts.createProgram([entryPath], config!.options);
  return { program, entry: program.getSourceFile(entryPath)! };
}

function exportedDeclarationsOf(program: ts.Program, entry: ts.SourceFile): Set<ts.Symbol> {
  const checker = program.getTypeChecker();
  return new Set(checker.getExportsOfModule(checker.getSymbolAtLocation(entry)!).map((symbol) => checker.getAliasedSymbol(symbol)));
}

function publicTypeNodesOf(declaration: ts.Declaration): ts.Node[] {
  if (ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)) return [declaration];
  if (ts.isVariableDeclaration(declaration)) return declaration.type ? [declaration.type] : [];
  if (!ts.isClassDeclaration(declaration)) return [];
  const nodes: ts.Node[] = [...(declaration.heritageClauses ?? []), ...(declaration.typeParameters ?? [])];
  for (const member of declaration.members) {
    // Constructor parameters are public whatever properties they declare.
    if (ts.isConstructorDeclaration(member)) {
      nodes.push(...member.parameters.flatMap((parameter) => (parameter.type ? [parameter.type] : [])));
      continue;
    }
    const isPrivate = (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Private) !== 0
      || (member.name !== undefined && ts.isPrivateIdentifier(member.name));
    if (isPrivate) continue;
    if (ts.isPropertyDeclaration(member) && member.type) nodes.push(member.type);
    if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
      if (member.type) nodes.push(member.type);
      nodes.push(...member.parameters.flatMap((parameter) => (parameter.type ? [parameter.type] : [])));
      nodes.push(...(member.typeParameters ?? []));
    }
  }
  return nodes;
}

function namesOutsideTheStableEntry(): string[] {
  const { program, entry } = stableEntryProgram();
  const checker = program.getTypeChecker();
  const stable = exportedDeclarationsOf(program, entry);
  const sourceRoot = import.meta.dirname;
  const found = new Set<string>();
  const visit = (owner: string, node: ts.Node): void => {
    const reference = ts.isTypeReferenceNode(node) ? node.typeName
      : ts.isExpressionWithTypeArguments(node) ? node.expression
        : ts.isTypeQueryNode(node) ? node.exprName
          : null;
    if (reference !== null) {
      let symbol = checker.getSymbolAtLocation(reference);
      if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol);
      const declaredIn = symbol?.declarations?.[0]?.getSourceFile().fileName;
      const isOurs = declaredIn !== undefined && resolve(declaredIn).startsWith(sourceRoot);
      if (symbol && isOurs && (symbol.flags & ts.SymbolFlags.TypeParameter) === 0 && !stable.has(symbol)) {
        found.add(`${owner} -> ${symbol.name}`);
      }
    }
    ts.forEachChild(node, (child) => visit(owner, child));
  };
  for (const symbol of stable) {
    for (const declaration of symbol.declarations ?? []) {
      for (const node of publicTypeNodesOf(declaration)) visit(symbol.name, node);
    }
  }
  return [...found].filter((pair) => !ADVANCED_EXTENSION_POINTS.includes(pair)).sort();
}

describe('the names in the stable entry point', () => {
  it('exports every type its exported declarations name', () => {
    expect(namesOutsideTheStableEntry()).toEqual([]);
  }, 120_000);
});
