# nx-simple:build

Compiles and packages TypeScript projects for internal use within a monorepo.

- Creates an importable package in `{projectRoot}/dist`
- Generates source maps
- Uses `{projectRoot}.swcrc` as base SWC config, if present
- Generates SWC path mappings based on tsconfig `baseUrl` & `paths`

## Usage

<details open> 
<summary><strong>project.json</strong></summary>
<br />

```jsonc
{
  "targets": {
    "build": {
      "executor": "nx-simple:build",
      "options": {
        "entry": "index.ts",
        "assets": [],
        "targetRuntime": "es2020"
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
  "compilerOptions": { "baseUrl": "." } // 👈 tells nx-simple where source files are based
}
```

</details>

<details> 
<summary id="package-json-project"><strong>package.json</strong></summary>
<br />

```jsonc
{
  "type": "module",

  // Setting `main` to match the compiled entry point ensures that build tools that encounter this package should resolve imports to the compiled code.
  "main": "dist/index.js",

  // Setting `types` to the entry module enables intellisense and features like "Go to definition" to navigate to source files.
  // Note: this works even if it's a regular TypeScript file. (The package executor replaces this field with a reference to a .d.ts file).
  "types": "index.ts"
}
```

</details>

<details> 
<summary><strong>package.json (root)</strong></summary>
<br />

```jsonc
// Setting up workspaces ensure that other tools can import your projects.
{
  "workspaces": ["packages/**"]
}
```

</details>

<details> 
<summary><strong>nx.json</strong></summary>
<br />

```jsonc
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"]
  },
  "targetDefaults": {
    "nx-simple:build": {
      "inputs": ["default"],
      "outputs": ["{projectRoot}/dist"],
      "dependsOn": ["^nx-simple:build"]
    }
  }
}
```

</details>

## Executor Options

| Param           | Type                         | Description                                   | Default                |
| --------------- | ---------------------------- | --------------------------------------------- | ---------------------- |
| `entry`         | `string`                     | the package's entry module                    | `{tsBaseUrl}/index.ts` |
| `entry`         | `string[]`                   | an array of entry modules                     |                        |
| `entry`         | `{ string: string }`         | mapping between import paths and entry points |                        |
|                 |                              |                                               |                        |
| `assets`        | `string[]`                   | any files to copy to the build folder         | `[]`                   |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | the target JavaScript environment             | `"es2020"`             |

Notes:

1. All paths are resolved relative to the project root

## Project Configuration

The executor also reads configuration from these files:

| File            | Param                     | Required                 | Description                                                           |
| --------------- | ------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `tsconfig.json` | `compilerOptions.baseUrl` | yes                      | the directory containing source code (within project directory)       |
| `package.json`  | `main`                    | yes                      | the location of the compiled entry point                              |
| `package.json`  | `types`                   | if lib                   | the location of the source entry point                                |
| `package.json`  | `exports`                 | if multiple entry points | a map of entry points                                                 |
| `.swcrc`        | `{}`                      | no                       | swc configraution, which may be partially overwritten by the executor |

## Workspace Configuration

| File           | Param            | Required | Description                                                                          |
| -------------- | ---------------- | -------- | ------------------------------------------------------------------------------------ |
| `nx.json`      | `targetDefaults` | yes      | Inform Nx where the executor writes its artefacts. See [nx.json example](#nxjson).   |
| `package.json` | `workspaces`     | yes      | Allow the package to be imported by its package name, and be resolved by other tools |
