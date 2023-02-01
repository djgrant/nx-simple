# nx-simple

An Nx plugin that helps you fall into the pit of success.

## Principles

The plugin aims to achieve a predictable and cohesive development experience by adhering to the following design principles:

1. Compatibility with other tools in the ecosystem
1. Transparency about what is happening under-the-hood
1. Implicit contracts are identified and clearly documented
1. Any combination of options provide a working state
1. Well-defined goals can be achieved using a "strategy" option, which encapsulates a set of functions

## Executors

### [nx-simple:build →](./src/executors/build/README.md)

> Compiles and packages TypeScript projects for consumption by other build tools, bundlers and dev servers e.g. ts-node, vite, esbuild etc.

### [nx-simple:package →](./src/executors/package/README.md)

> Compiles and packages TypeScript projects for publication to NPM, deployment as an app, or inclusion within another packagable project.

## Compatibility

nx-simple aims to maximise compatability with other tools in the ecosystem. This table provides an overview of how and why compatability is achieved.

| Tooling                                             | Setup                                                                                            | Explanation                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Build tools** (ts-node, esbuild, webpack etc.) | using the [build executor](./src/executors/build/README.md#) and setting up NPM workspaces       | Build tools will resolve the package to the compiled code without the need for any custom path mappings                |
| 🟢 **Intellisense**                                 | [setting up](./src/executors/build/README.md#package-json-project) package.json types field      | Imports are resolved to their source files when using features like "Go to definition"                                 |
| 🟢 **Single-version monorepos**                     | using the [package executor](./src/executors/package/README.md) to detect dependencies           | A separate package is built with a generated package.json (including any detected dependencies)                        |
| 🟠 **Publishing/versioning tools<sup>1</sup>**      | using the [package executor](./src/executors/package/README.md) to create distributable packages | Versioning is applied to source packages as normal. Only packages built to `{workspaceRoot}/dist` should be published. |

#### Caveats

1. Publishing tools generally assume that the package they version-bump is also the package to be released. The workflow with Nx plugins is slightly different: the source package should be version-bumped, and the built package (in `{workspaceRoot}/dist/{projectName}` should be published.

## Q&A

#### Why does the executor not bundle packages?

1. Now that ES modules are widely available, a good starting point is not to bundle
2. Bundling adds extra complexity, both in the implementation and for the user, when determining how to resolve context misalignments
3. There are great tools out there for bundling when it's required, and the packages that the [build executor](./src/executors/build/README.md) produces can be consumed by bundlers just as they would consume any regular package in node_modules

## Roadmap

- Use rootDir instead of baseUrl to direct nx-simple to source files
- Accept SWC options https://swc.rs/docs/usage/cli#options either via options of path to swcrc
- Accept option to specify what to do with non-publishable dependencies – error, skip, build subpackage, look for built modules in some search paths
- Provide package.json#exports [fallback strategies](https://github.com/andrewbranch/example-subpath-exports-ts-compat)
- Warn if subpackage executor has different target runtime to parent package
- Solution for copying assets. Possibly copy files defined in package.json#files and follow npm's [inclusion/exclusion rules](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#files).
- SWC helper
- Watch mode
- Tame coupling between cache config and project name
- Scope approach for working with package-based repos e.g. lerna and pnpm (no source code analysis, no generated package.json, publishable bundle in package folder)
- Add `module` exports condition for bundlers e.g. webpack, [esbuild](https://esbuild.github.io/api/#how-conditions-work)
- Expolore issues around inherited baseUrl/paths and potentially using project references to solve
- Fully leverage tsconfig incremental compilation
