# Hooks for klbfw

This provides different hooks and ssr mechanics for klbfw.

* useRest(path, params): allows to easily grab data from our backend
* useVar(varName): shared state by name
* setPromise(useVarCtx(), promise): sets a promise that the server needs to wait for in SSR
