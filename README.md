# nx-simple

An Nx plugin that helps you fall into the pit of success.

## Principles

The plugin achieves a predictable and cohesive development by adhering to these design principles:

1. Configuration limited to a set of options that, in any combination, provide a working state

1. Non-configurable presets that achieve well-defined goals (strategies)

1. Transparency about what is happening under-the-hood

1. Compatibility with other tools in the ecosystem

1. Implicit contracts (conventions) are identified and clearly documented

# Executors

## build-node-mts

Builds TypeScript ESM packages that target Node.js. The executor creates builds for internal use within a monorepo, or for publication to an NPM registry.

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
      "executor": "nx-simple:build-node-mts",
      "options": {
        "strategy": "internal"
      }
    },
    "prepublish": {
      "executor": "nx-simple:build-node-mts",
      "options": {
        "strategy": "external"
      }
    }
  }
}
```

### Options

| Param      | Type                | Default    | Description                                                     |
| ---------- | ------------------- | ---------- | --------------------------------------------------------------- |
| `strategy` | `internal/external` | required   | the build strategy                                              |
| `assets`   | `string[]`          | `[]`       | any files to copy to the build folder                           |
| `entry`    | `string`            | `index.ts` | the package entry module                                        |
| `esbuild`  | `{}`                | `{}`       | any [esbuild options](https://esbuild.github.io/api/#build-api) |

### Strategies

#### `internal`

- Compiles a buildable package to `{projectRoot}/dist`
- Builds to ESM

#### `external`

- Compiles a publishable package to `{workspaceRoot}/dist/{projectName}`
- Creates ESM and CJS versions
- Generates a `package.json`
- Adds detected dependencies to `package.json`
- Adds `main` and `module` fields to `package.json`
- Copies any README, LICENSE, LICENCE files
- Type checks using nearest `tsconfig.json`
- Generates type definition (`.d.ts`) files

### Conventions

#### 1. The package is an NPM workspace

**Why?** Allow the package to be imported by its package name, and resolvable by any tool in the ecosystem.

**How?** In the root `package.json`, include the package within the `workspaces` field.

```jsonc
// root package.json
{
  "workspaces": ["pacakges/**"],
  "workspaces": ["pacakges/package-a"]
}
```

#### 2. The `types` field points to the entry module

**Why?** In development, features like "Go to definition" should navigate to source files, not the compiled output.

**How?** In the `package.json` point `types` to the entry module. Note: this works even if it's a regular TypeScript file! Publishable packages (built using the `external` strategy) will have this field replaced with the path of the generated `.d.ts` file).

```jsonc
// package.json
{
  "types": "src/index.ts",
  "types": "index.ts" // if this is your entry module in here, you can just omit this field
}
```

#### 3. The `main` field points to the build path

**Why?** Build tools that encounter this package should resolve imports to the compiled code.

**How?** Set `main` to `dist/index.js`. The executor will always compile to this location, so this path remains the same irrespective of where your entry module is located.

```jsonc
// package.json
{
  "main": "dist/index.js"
}
```

#### 4. The `type` field is `module`

**Why?** Using ESM comes with a set of caveats; interoperating between ESM and CJS can get quite complicated. To keep things simple, this executor focuses just on ESM packages.

**How?** Set `type` to `module` in your project `package.json`.

```jsonc
// package.json
{
  "type": "module"
}
```

### Compatibility

| Tooling                                             | Obligations                       | Explanation                                                                                                         |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 🟢 **Build tools** (ts-node, esbuild, webpack etc.) | `internal` strategy, convention 1 | Build tools will resolve the package to the compiled code without the need for any custom path mappings             |
| 🟢 **Single-version monorepos**                     | `external` strategy, convention 3 | A separate package is built with a generated package.json (including any detected dependencies)                     |
| 🟢 **Intellisense**                                 | convention 2                      | Imports are resolved to their source files when using features like "Go to definition"                              |
| 🟠 **Publishing/versioning tools**                  | `external` strategy               | Versioning is applied to source packages as normal. Publishing must be to packages built to `{workspaceRoot}/dist`. |

#### Caveats

- Publishing tools will probably assume that the package they version bump is also the package to be released. (To avoid package.json conflicts, the executor builds the publishable package to `{workspaceRoot}/dist`).
