# nx-simple

A lightweight alternative to [@nrwl/js](https://nx.dev/packages/js).

Designed to slot into Nx monorepos and play nicely with other tools.

## Features

- Conventions optimised for an unsurprising developer experience
- Compatibility with upstream tools (without needing additional plugins)
- Documentation of both implicit and explicit configurations
- Automatic remapping of tsconfig baseUrl/paths
- Generates publishable packages with CJS/ESM support

See also [comparison with `@nrwl/js`](#comparison).

## Install

```
npm install nx-simple
```

## Executor Setup

### [nx-simple:build →](./src/executors/build/README.md)

> Compiles TypeScript projects for consumption by other build tools, bundlers and dev servers e.g. ts-node, vite, esbuild etc.

### [nx-simple:package →](./src/executors/package/README.md)

> Compiles, type checks, and packages TypeScript projects for publication to NPM, deployment as an app, or inclusion within another packagable project.

## Comparison

nx-simple aims to achieve the simplicity of a [package-based repo](https://nx.dev/concepts/integrated-vs-package-based), while retaining some of the power of an [integrated repo](https://nx.dev/concepts/integrated-vs-package-based).

The main difference with [@nrwl/js](https://nx.dev/packages/js) is nx-simple's approach to module resolution. Packages built by nx-simple can be resolved by setting up NPM workspaces, rather than relying on upstream plugins. This simplifies interoperability – if a package exists in node_modules, every bundler, dev server, and test runner will be able to resolve it.

Architecturally, this is enabled by providing two executors:

- A [build executor](./src/executors/build/README.md) for compiling local packages (writes transpiled JavaScript to `{projectRoot}/dist`)
- A [package executor](./src/executors/package/README.md) for creating external packages optimised for publishing and deployment (creates a new optimised package in `{workspaceRoot}/dist/{projectName}`)

Additional differences:

- **Configuration**. nx-simple opts to rely on user configuration, (`package.json`, `tsconfig.json` and `.swcrc`) to determine its behaviour.
- **Local dependencies** e.g. a publishable package that imports another local package. nx-simple builds local dependencies in isolation and then copies them to dist/node_modules (see [approach](https://github.com/sveltejs/sapper/issues/551#issue-402728689)). @nrwl/js copies all the source files into a single location, compiles them together, and then updates the imports (see [source code](https://github.com/nrwl/nx/blob/master/packages/js/src/utils/inline.ts#L63-L91)).
- **Generators**. nx-simple does not provide any generators at present. The focus is rather on transparently documenting all the configurations required to achieve a good DX.

## Compatibility

nx-simple aims to maximise compatibility with other tools in the ecosystem. This table provides an overview of how and why compatibility is achieved.

| Tooling                                             | Setup                                                                                            | Explanation                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Build tools** (ts-node, esbuild, webpack etc.) | using the [build executor](./src/executors/build/README.md#) and setting up NPM workspaces       | Build tools will resolve the package to the compiled code without the need for any custom path mappings                |
| 🟢 **Intellisense**                                 | [setting up](./src/executors/build/README.md#package-json-project) package.json types field      | Imports are resolved to their source files when using features like "Go to definition"                                 |
| 🟢 **Single-version monorepos**                     | using the [package executor](./src/executors/package/README.md) to detect dependencies           | A separate package is built with a generated package.json (including any detected dependencies)                        |
| 🟠 **Publishing/versioning tools<sup>1</sup>**      | using the [package executor](./src/executors/package/README.md) to create distributable packages | Versioning is applied to source packages as normal. Only packages built to `{workspaceRoot}/dist` should be published. |

#### Caveats

1. Publishing tools generally assume that the package they version-bump is also the package to be released. The workflow with Nx plugins is slightly different: the source package is version-bumped, and the built package (in `{workspaceRoot}/dist/{projectName}`) is published.

## Q&A

#### Why does the executor not bundle packages?

1. Now that ES modules are widely available, a good starting point is not to bundle
2. Bundling adds extra complexity, both in the implementation and, for the user, determining how to resolve context misalignments
3. There are great tools out there for bundling when it's required, and the packages that the [build executor](./src/executors/build/README.md) produces can be consumed by bundlers just as they would consume any regular package in node_modules

#### Why does the package executor generate a new package?

The package executor generates a package in `{workspaceRoot}/dist/{projectName}` so that it can make changes to the source package.json. This is necessary in any of these scenarios:

1. The repo follows a single version policy by placing all dependencies in the root package.json, rather than in each project's package.json. To deploy or publish packages, a new package.json that includes the projects dependencies needs to be generated.
2. The package.json contains references to source files for an improved developer experience. For example, we recommend the `types` field points to a source file rather than a generated .dts file (so intellisense is always using the latest types without needing a potentially slow re-compile). When the package is published, `.d.ts` files are created and the `types` field is removed from package.json.
3. Generating a ESM/CJS compatible packages.

## Principles

This plugin aims to achieve a predictable and cohesive development experience by adhering to the following design principles:

1. Compatibility with other tools in the ecosystem
1. Transparency about what is happening under-the-hood
1. Implicit contracts are identified and clearly documented
1. Any combination of options provide a working state
1. Well-defined goals can be achieved using a "strategy" option, which encapsulates a set of functions

## Roadmap

- Use rootDir instead of baseUrl to direct nx-simple to source files
- Accept SWC options https://swc.rs/docs/usage/cli#options either via options of path to swcrc
- Solution for copying assets. Possibly copy files defined in package.json#files and follow npm's [inclusion/exclusion rules](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#files).
- SWC helper
- Watch mode
- Accept option to specify what to do with non-publishable dependencies – error, skip, build subpackage, look for built modules in some search paths
- Provide package.json#exports [fallback strategies](https://github.com/andrewbranch/example-subpath-exports-ts-compat)
- Warn if sub-package executor has different target runtime to parent package
- Tame coupling between cache config and project name
- Scope approach for working with package-based repos e.g. lerna and pnpm (no source code analysis, no generated package.json, publishable bundle in package folder)
- Add `module` exports condition for bundlers e.g. webpack, [esbuild](https://esbuild.github.io/api/#how-conditions-work)
- Explore issues around inherited baseUrl/paths and potentially using project references to solve
- Fully leverage tsconfig incremental compilation

Feel free to open an issue to bump any of these points.

## Contributing

Contributions and feedback are welcome! Todo: write some contribution guidelines. When proposing new features, keep in mind the design (principles)[#principles].

## Contributors

- Daniel Grant [@djgrant\_](https://twitter.com/djgrant_)

## Licence

MIT
