# nx-simple:package

Compiles and packages TypeScript projects for publication to NPM, deployment as an app, or inclusion within another packagable project.

- Creates a publishable package to `{workspaceRoot}/dist/{projectName}` compatible with ESM and CJS environments
- Generates a `package.json` with `main`, `module`, `exports` and `dependencies` fields
- Copies any README, LICENSE, LICENCE files along with specified `assets`
- Uses `{projectRoot}.swcrc` as base SWC config, if present
- Generates SWC path mappings based on tsconfig `baseUrl` & `paths`
- Type checks project using nearest `tsconfig.json`
- Generates type definition (`.d.ts`) files
- Detects and packages non-publishable dependencies into a local node_modules directory

## Usage

<details open> 
<summary><strong>project.json</strong></summary>
<br />

```jsonc
{
  "targets": {
    "build": {
      "executor": "nx-simple:package",
      "options": {
        "distribution": "npm",
        "entry": "index.ts",
        "targetRuntime": "es2018"
      }
    }
  }
}
```

</details>

<details> 
<summary><strong>project.json (extending build options)</strong></summary>
<br />

```jsonc
{
  "targets": {
    "build": {
      "executor": "nx-simple:build",
      "options": {
        "entry": ["index.ts", "utils.ts"],
        "assets": ["data.json"]
      }
    },
    "package": {
      "executor": "nx-simple:package",
      "options": {
        "extends": "build", // 👈 extend the build target's options
        "distribution": "npm",
        "targetRuntime": "es2018"
      }
    }
  }
}
```

</details>

<details>
<summary><strong>project.json (of published dependencies)</strong></summary>
<br />

```jsonc
{
  // nx-simple will treat this package as external
  "targets": {
    "publish": {
      "executor": "any-executor"
    }
  },
  // if not publishing using an exector, add this flag
  "willPublish": true
}
```

</details>

<details>
<summary><strong>tsconfig.base.json</strong></summary>
<br />

```jsonc
// When analysing source files, Nx needs to be told how to resolve dependencies.
// Note: that these are only required to build the Nx graph.
// With NPM workspaces configured, types are resolving direclty from local packages in node_modules.
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
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "nx-simple:package": {
      "inputs": ["default", "^default"],
      "outputs": [
        "{workspaceRoot}/dist/.nxsimple/{projectName}",
        "{workspaceRoot}/dist/{projectName}"
      ],
      "dependsOn": ["^nx-simple:package", "publish"]
    }
}
```

</details>

## Executor Options

| Param           | Type                         | Description                                                               | Default                |
| --------------- | ---------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| `extends`       | `string`                     | a sibling target from which to inherit options                            | undefined              |
|                 |                              |                                                                           |                        |
| `distribution`  | `"npm"`                      | creates a distribution that can be published to NPM                       | required               |
| `distribution`  | `"app"`                      | creates a distributon that can be installed                               | required               |
| `distribution`  | `"lib"`                      | creates a distribution layer that can be packaged in another distribution | required               |
|                 |                              |                                                                           |                        |
| `entry`         | `string`                     | the package's entry module                                                | `{tsBaseUrl}/index.ts` |
| `entry`         | `string[]`                   | an array of entry modules                                                 |                        |
| `entry`         | `{ string: string }`         | mapping between import paths and entry points                             |                        |
|                 |                              |                                                                           |                        |
| `assets`        | `string[]`                   | any files to copy to the build folder                                     | `[]`                   |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | the target JavaScript environment                                         | `"es2020"`             |

Notes:

1. All paths are resolved relative to the project root
2. Distribution layers are compiled, type checked and cached independently, before being copied into other distributions as a node module.
3. If a package target is not defined for a non-publishable lib, as a fallback, nx-simple will compile a distribution layer dynamically based on a build executor target. However, this will not benefit from granular caching.

## Project Configuration

The executor also reads configuration from these files:

| File            | Param                     | Required | Description                                                           |
| --------------- | ------------------------- | -------- | --------------------------------------------------------------------- |
| `tsconfig.json` | `compilerOptions.baseUrl` | yes      | the directory containing source code (within project directory)       |
| `.swcrc`        | `{}`                      | no       | swc configraution, which may be partially overwritten by the executor |

## Workspace Configuration

| File      | Param            | Required | Description                                                                         |
| --------- | ---------------- | -------- | ----------------------------------------------------------------------------------- |
| `nx.json` | `targetDefaults` | yes      | Inform Nx where the executor writes its artefacts. See [nx.json example](#nx-json). |
