# nx-simple:package

Compiles and packages TypeScript projects for publication to NPM, deployment as an app, or inclusion within another packagable project.

## Features

- Creates a publishable package to `{workspaceRoot}/dist/{projectName}`
- Contains ESM and CJS builds
- Generates a `package.json` with `main`, `module`, `exports` and `dependencies` fields
- Copies README, LICENSE, and LICENCE files
- Uses `{projectRoot}.swcrc` as base SWC config, if present
- Generates SWC path mappings based on tsconfig `baseUrl` & `paths`
- Type checks project using nearest `tsconfig.json`
- Generates type definition (`.d.ts`) files
- Detects and packages non-publishable dependencies into a local node_modules directory

## Usage

<details open> 
<summary><strong>project.json </strong></summary>
<br />

```jsonc
{
  "targets": {
    "package": {
      "executor": "nx-simple:package",
      "options": {
        "distribution": "npm",
        "targetRuntime": "es2018"
      }
    }
  }
}
```

</details>

<details> 
<summary><strong>project.json (unpublished sub-package)</strong></summary>
<br />

```jsonc
{
  "targets": {
    "package": {
      "executor": "nx-simple:package",
      "options": {
        "distribution": "lib",
        "targetRuntime": "es2018"
      }
    }
  }
}
```

</details>

<details> 
<summary ><strong>tsconfig.json</strong></summary>
<br />

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "baseUrl": "src" } // 👈 tells nx-simple where source files are located
}
```

</details>

<details> 
<summary><strong>package.json</strong></summary>
<br />

```jsonc
{
  "type": "module",
  "exports": {
    "types": "src/index.ts", // 👈 entry point – removed by executor as adjacent .d.ts files are resolved automatically
    "import": "dist/index.js" // 👈 import path – used as base for `require` property to resolve CJS modules
  }
}
```

</details>

<details>
<summary><strong>tsconfig.base.json</strong></summary>
<br />

```jsonc
// When analysing source files, Nx needs to be told how to resolve dependencies.
// Note: that these are only required to build the Nx graph.
// With NPM workspaces configured, packages are resolving via their npm link to node_modules.
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@scope/mylib/*": "packages/mylib/*"
    }
  }
}
```

</details>

<details id="nx-json"> 
<summary><strong>nx.json</strong></summary>
<br />

```jsonc
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/nx-cloud",
      "options": {
        "cacheableOperations": ["build", "package", "package:lib"]
      }
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "nx-simple:package": {
      "inputs": ["default", "^default"],
      "outputs": [
        "{workspaceRoot}/dist/.nxsimple/{projectName}",
        "{workspaceRoot}/dist/{projectName}"
      ]
    },
    "package": {
      "dependsOn": ["^package:lib"]
    },
    "package:lib": {
      "dependsOn": ["^package:lib"]
    }
  }
}
```

</details>

## Executor Options

| Param           | Type                         | Description                                                     | Default    |
| --------------- | ---------------------------- | --------------------------------------------------------------- | ---------- |
| `distribution`  | `"npm"`                      | creates a distribution that can be published to NPM             | required   |
| `distribution`  | `"app"`                      | creates a distributon that can be installed                     | required   |
| `distribution`  | `"lib"`                      | creates a subpackage that can be copied to another distribution | required   |
|                 |                              |                                                                 |            |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | the target JavaScript environment                               | `"es2020"` |

Notes:

1. A package configured with `"distribution": "npm" | "app"` will include any non-publishable dependencies in its build.
1. Publishable projects have one of the following in their project.json:
   1. the package executor, also configured with `"distribution": "npm"`
   1. a `publish` target, configured with any executor
   1. `"willPublish": true` set at the root level
1. Non-publishable subpackage that are dependencies of publishable packages should have a package executor configured with `"distribution": "lib"`

## Project Configuration

The executor also reads configuration from these files:

| File            | Param                     | Required | Description                                                                                 |
| --------------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `tsconfig.json` | `compilerOptions.baseUrl` | yes      | the directory containing source code (within project directory)                             |
| `.swcrc`        | `{}`                      | no       | swc configraution, which may be partially [overwritten](../../utils/swc.ts) by the executor |

## Workspace Configuration

| File      | Param            | Required | Description                                                                         |
| --------- | ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `nx.json` | `targetDefaults` | yes      | Inform Nx where the executor writes its artefacts. See [nx.json example](#nx-json). |
