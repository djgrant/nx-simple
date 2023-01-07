# nx-simple

An Nx plugin that helps you fall into the pit of success.

## Principles

The plugin aims to achieve a predictable and cohesive development experience by adhering to the following design principles:

1. Compatibility with other tools in the ecosystem
1. Transparency about what is happening under-the-hood
1. Implicit contracts are identified and clearly documented
1. Any combination of options provide a working state
1. Well-defined goals can be achieved using a "strategy" option, which encapsulates a set of functions

# Executors

## build-package

Compiles and packages TypeScript projects for internal use within a monorepo, or for publication to an NPM registry.

A package is a directory (often found in node_modules) that contains one or more modules, one or more entry points, and a package.json. Building to this standard structure ensures that the compilations steps remain simple, and that other tools in the ecosystem can easily resolve and import the built package.

This executor does not bundle modules (for a few [reasons](#bundling)) but the packages produced by it can be consumed by your favourite bundler without making any modifications to how it works.

> ⚠️ Currently the executor only supports ESM projects. This may not change.

### Usage

```jsonc
// package.json (see conventions)
{
  "name": "my-package",
  "main": "dist/index.js",
  "types": "path/to/entry.ts"
}
```

```jsonc
// project.json (see options)
{
  "targets": {
    "build": {
      "executor": "nx-simple:build-package",
      "options": {
        "distribution": "internal"
      }
    },
    "prepublish": {
      "executor": "nx-simple:build-package",
      "options": {
        "distribution": "external"
      }
    }
  }
}
```

### Options

| Param           | Type                         | Default    | Description                           |
| --------------- | ---------------------------- | ---------- | ------------------------------------- |
| `distribution`  | `"internal" \| "external"`   | required   | the distribution strategy             |
| `entry`         | `string`                     | `index.ts` | the package's entry module            |
| `assets`        | `string[]`                   | `[]`       | any files to copy to the build folder |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | `es2020`   | the target JavaScript environment     |

### Effects

- The parent directory of `entry` is considered the source directory. All TypeScript files under this directory will be compiled.
- If present, the SWC compiler will use `{projectRoot}.swcrc` as its base config
- TODO: creates path mappings based on tsconfig baseUrl & paths

#### `distribution: internal`

- Compiles a buildable package to `{projectRoot}/dist`
- Compiles all modules within the `entry` module's directory e.g if `entry` is `src/index.ts` then all modules inside `src` will be compiled
- Generates source maps

#### `distribution: external`

- Compiles a publishable package to `{workspaceRoot}/dist/{projectName}`
- Compiles ESM and CJS versions of the source modules
- Generates a `package.json`
- Adds detected dependencies to `package.json`
- Adds `main` and `module` fields to `package.json`
- Copies any README, LICENSE, LICENCE files
- Type checks project using nearest `tsconfig.json`
- Type checks any included packages
- Generates type definition (`.d.ts`) files
- WIP: Detects, packages and includes non-publishable dependencies

### Contracts

<details>
<summary><strong>1. The package is an NPM workspace</strong></summary>
<br />

> **Why?** Allow the package to be imported by its package name, and resolvable by any tool in the ecosystem.

> **How?** In the root `package.json`, include the package within the `workspaces` field.

```jsonc
// root package.json
{
  "workspaces": ["pacakges/**"],
  "workspaces": ["pacakges/package-a"]
}
```

</details>

<details>
<summary><strong>2. The `types` field points to the entry module</strong></summary>
<br />

> **Why?** In development, features like "Go to definition" should navigate to source files, not the compiled output.

> **How?** Set `types` to the entry module. Note: this works even if it's a regular TypeScript file! Publishable packages (built using the `external` strategy) will have this field replaced with the path of the generated `.d.ts` file).

```jsonc
// package.json
{
  "types": "src/index.ts",
  "types": "index.ts" // if this is your entry module in here, you can just omit this field
}
```

</details>

<details>
<summary><strong>3. The `main` field points to the dist folder</strong></summary>
<br />

> **Why?** Build tools that encounter this package should resolve imports to the compiled code.

> **How?** Set `main` to `dist/${entryModuleName}.js`. Note: the path to the entry module filename is not required.

```jsonc
// project.json
{
  "targets": {
    "build": {
      "executor": "nx-simple:build-package",
      "options": {
        "entry": "src/index.ts"
      }
    }
  }
}
```

```jsonc
// package.json
{
  "main": "dist/index.js"
}
```

</details>

<details>
<summary><strong>4. The `type` field is `module`</strong></summary>
<br />

> **Why?** Using ESM comes with a set of caveats; interoperating between ESM and CJS can get quite complicated. To keep things simple, this executor focuses just on ESM packages.

> How? Set `type` to `module`

```jsonc
// package.json
{
  "type": "module"
}
```

</details>

<details>
<summary><strong>5. Nx `inputs` and `outputs` are set</strong></summary>
<br />

> **Why?** Nx needs to know where different executors write their artefacts.

> **How?** Assuming internal packages are created using a `build` target, and external using a `prepublish` target, you would need the following configuration:

```jsonc
// nx.json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["default", "^default"],
      "outputs": ["{projectRoot}/dist"],
      "dependsOn": ["^build"]
    },
    "prepublish": {
      "inputs": ["default", "^default"],
      "outputs": ["{workspaceRoot}/dist"]
    }
  }
}
```

</details>

<details>
<summary><strong>6. Nx is configured to analyse source files</strong></summary>
<br />

> **Why?** When using both a single-version policy, and creating external packages, Nx needs configured to detect dependencies within modules.

> **How?** Enable the `analyzeSourceFiles`.

```jsonc
// nx.json
{
  "pluginsConfig": {
    "@nrwl/js": {
      "analyzeSourceFiles": true
    }
  }
}
```

</details>

Todo:

- Update: correct destinations for cache outputs
- Add: how the plugin determines if a project is buildable and publishable
- Add: package.json is required for projects that build with nx-simple (needs to be enforced in code too)

### Compatibility

| Tooling                                             | Setup                               | Explanation                                                                                                            |
| --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Build tools** (ts-node, esbuild, webpack etc.) | convention 1, internal distribution | Build tools will resolve the package to the compiled code without the need for any custom path mappings                |
| 🟢 **Intellisense**                                 | convention 2                        | Imports are resolved to their source files when using features like "Go to definition"                                 |
| 🟢 **Single-version monorepos**                     | convention 3, external distribution | A separate package is built with a generated package.json (including any detected dependencies)                        |
| 🟠 **Publishing/versioning tools**                  | external distribution               | Versioning is applied to source packages as normal. Only packages built to `{workspaceRoot}/dist` should be published. |

#### Caveats

- Publishing tools will probably assume that the package they version-bump is also the package to be released. This is an unavoidable consequence of this plugin's setup (to avoid package.json conflicts, the executor builds the publishable package to `{workspaceRoot}/dist`).

### Bundling

There's a few reasons why this executor does not produce bundles:

1. Now that ES modules are implemented natively in all runtimes, a good starting point is not to bundle
2. Bundling adds extra complexity, both in the implementation and for the user, when determining things like how to handle rewriting `import.meta.url`
3. There are great tools out there for bundling when it's required, and the packages that this executor produces can be consumed by them as standard node modules

### Todo

- Accept compatible SWC options https://swc.rs/docs/usage/cli#options
- Consider compilation of non-ESM projects/files
