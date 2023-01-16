# nx-simple:build

Compiles and packages TypeScript projects for consumption by other build tools, bundlers and dev servers e.g. ts-node, vite, esbuild etc.

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
      "executor": "nx-simple:build"
    }
  }
}
```

</details>

<details open> 
<summary><strong>package.json</strong></summary>
<br />

```jsonc
{
  "type": "module",
  "exports": {
    "types": "src/index.ts", // 👈 typescript file entry point – enables intellisense to resolve module
    "import": "dist/index.js" // 👈 path to compiled file – enables build tools to resolve module
  }
}
```

</details>

<details open> 
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

| Param           | Type                         | Description                       | Default    |
| --------------- | ---------------------------- | --------------------------------- | ---------- |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | the target JavaScript environment | `"es2020"` |

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
