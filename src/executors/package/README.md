# nx-simple:package

Compiles and packages TypeScript projects for publication to NPM, deployment as an app, or inclusion within another packagable project.

The resulting package strcuture is optimised for compabatibility with CommonJS and ESM environments.

## Usage

```jsonc
// package.json
{
  "name": "my-package",
  "version": "1.0.0"
}
```

```jsonc
// project.json (see options)
{
  "targets": {
    "prepublish": {
      "executor": "nx-simple:package"
    }
  }
}
```

## Options

| Param           | Type                         | Default      | Description                           |
| --------------- | ---------------------------- | ------------ | ------------------------------------- |
| `distribution`  | `"npm" \| "app" \| "lib"`    | required     | the distribution strategy             |
| `entry`         | `string`                     | `"index.ts"` | the package's entry module            |
| `sourceDir`     | `string`                     | `"./"`       | the directory containing source code  |
| `assets`        | `string[]`                   | `[]`         | any files to copy to the build folder |
| `targetRuntime` | `"es5" \| "es6" \| "esYYYY"` | `"es2020"`   | the target JavaScript environment     |

## Effects

- The parent directory of `entry` is considered the source directory. All TypeScript files under this directory will be compiled.
- If present, the SWC compiler will use `{projectRoot}.swcrc` as its base config
- Creates path mappings based on tsconfig `baseUrl` & `paths`
- Compiles a publishable package to `{workspaceRoot}/dist/{projectName}`
- Compiles ESM and CJS versions of the source modules
- Generates a `package.json`
- Adds detected dependencies to `package.json`
- Adds `main` and `module` fields to `package.json`
- Copies any README, LICENSE, LICENCE files
- Type checks project using nearest `tsconfig.json`
- Type checks any included packages
- Generates type definition (`.d.ts`) files
- Detects, builds and packages non-publishable dependencies in a local node_modules directory

## Contracts

<details>
<summary><strong>1. Nx `inputs` and `outputs` are set</strong></summary>
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
    "nx-simple:package": {
      "inputs": ["default", "^default"],
      "outputs": [
        "{workspaceRoot}/dist/{projectName}",
        "{workspaceRoot}/dist/.nxsimple/{projectName}"
      ]
    }
  }
}
```

</details>

<details>
<summary><strong>2. Nx is configured to detect dependencies</strong></summary>
<br />

**Why?** When analysing source files, Nx needs to be told how to resolve dependencies.

**How?** Add path mappings to tsconfig.base.json.

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@scope/mylib/*": "packages/mylib/*"
    }
  }
}
```

Note: that these are only required to build the Nx graph. When NPM workspaces is configured, the TypeScript compiler will be able to get intellisense by resolving imports to your local packages in node_modules.

</details>

<details>
<summary><strong>3. Declare publishable packages</strong></summary>
<br />

**Why?** nx-simple needs to know if a proejct will be published.

**How?** Add a `publish` target to project.json, or, if publishing outside Nx, set a `willPublish` flag.

```jsonc
// project.json
{
  "targets": {
    "publish": {
      "executor": "any-executor"
    }
  }
}
```

```jsonc
// project.json
{
  "willPublish": true
}
```

</details>
