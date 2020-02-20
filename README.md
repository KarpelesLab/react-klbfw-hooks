# Hooks for klbfw

This provides different hooks and ssr mechanics for klbfw.

* useRest(path, params): allows to easily grab data from our backend
* useVar(varName): shared state by name
* usePromise(promise): sets a promise that the server needs to wait for in SSR

# Usage

## run(app, promises)

Replaces ReactDOM.render.

Minimum usage, in file `index.js`:

```javascript
import App from './App';
import { run } from "@karpeleslab/react-klbfw-hooks";

run(<App/>);
```

With I18N:

```javascript
import App from './App';
import { run } from "@karpeleslab/react-klbfw-hooks";
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Backend } from '@karpeleslab/i18next-klb-backend';
import { getLocale } from "@karpeleslab/klbfw";

let i18nOpt = {
	lng: getLocale(),
	initImmediate: false,
	load: 'currentOnly',
	interpolation: {
		escapeValue: false, // not needed for react as it escapes by default
	},
	react: {
		useSuspense: false,
	}
};

run(<App/>, [i18n.use(Backend).use(initReactI18next).init(i18nOpt)]);
```

## useVar(varname, default)

Hook for named variables which share a value anywhere in the application.

```javascript
function Foo() {
	const [value, setValue] = useVar("foo", 0);

	return <div>foo is {value} <button onClick={() => setValue(value+1)}>+1</button></div>;
}
```

## useVarSetter(varname, default)

Returns only a setter for the given variable, not subscribing the current component to variable updates.

## usePromise(promise)

Handle re-render for a given promise in SSR.

## useRest(path, params)

Perform a rest() GET action on a given path, caching the result and returning it in a way that is safe to use during rendering.
