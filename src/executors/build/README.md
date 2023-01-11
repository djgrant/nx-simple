# nx-simple:build

Compiles and packages TypeScript projects for internal use within a monorepo.

### Usage

```jsonc
// package.json (see contracts)
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
      "executor": "nx-simple:build"
    }
  }
}
```

### Options

| Param           | Type                         | Default      | Description                           |
| --------------- | ---------------------------- | ------------ | ------------------------------------- |
| `entry`         | `string`                     | `"index.ts"` | the package's entry module            |
| `sourceDir`     | `string`                     | `"./"`       | the directory containing source code  |
| `assets`        | `string[]`                   | `[]`         | any files to copy to the build folder |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | `"es2020"`   | the target JavaScript environment     |

### Effects

- The parent directory of `entry` is considered the source directory. All TypeScript files under this directory will be compiled.
- If present, the SWC compiler will use `{projectRoot}.swcrc` as its base config
- Creates path mappings based on tsconfig `baseUrl` & `paths`
- Compiles a buildable package to `{projectRoot}/dist`
- Compiles all modules within the `entry` module's directory e.g if `entry` is `src/index.ts` then all modules inside `src` will be compiled
- Generates source maps

### Contracts

<details>
<summary><strong>1. The package is an NPM workspace</strong></summary>
<br />

**Why?** Allow the package to be imported by its package name, and resolvable by any tool in the ecosystem.

**How?** In the root `package.json`, include the package within the `workspaces` field.

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

**Why?** In development, features like "Go to definition" should navigate to source files, not the compiled output.

**How?** Set `types` to the entry module. Note: this works even if it's a regular TypeScript file! Publishable packages (built using the `external` strategy) will have this field replaced with the path of the generated `.d.ts` file).

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

**Why?** Build tools that encounter this package should resolve imports to the compiled code.

**How?** Set `main` to `dist/${entryModuleName}.js`. Note: the path to the entry module filename is not required.

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

**Why?** Interoperating between ESM and CJS can get messy. To keep things simple, this executor focuses just on ESM packages.

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

**Why?** Nx needs to know where build-package executor writes its artefacts.

**How?** Assuming internal packages are created using a `build` target, and external using a `prepublish` target, you would need the following configuration:

```jsonc
// nx.json
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
