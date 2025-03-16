# React Hooks for KLBFW

A collection of React hooks and SSR utilities for [KarpelesLab Framework](https://github.com/KarpelesLab/klbfw).

## Installation

```bash
npm install @karpeleslab/react-klbfw-hooks
```

## Features

* Shared state across components through named variables
* SSR (Server-Side Rendering) with React
* REST API integration with caching
* React Router v7 support for modern routing with SSR
* Promise handling for data loading during SSR

## Available Hooks

* **useRest(path, params, noThrow, cacheLifeTime)**: Fetches data from your backend with automatic caching and SSR support
* **useVar(varName, defaultValue)**: Provides shared state accessible by name throughout your application
* **useVarSetter(varName, defaultValue)**: Returns only a setter for the given variable without subscribing to updates
* **usePromise(promise)**: Registers a promise for SSR to wait for before rendering
* **useRestRefresh(path, params, cacheLifeTime)**: Returns only the refresh function for a REST endpoint
* **useRestResetter()**: Returns a function to clear all REST cache (useful for logout)

## Usage

### run(routes, promisesOrOptions, options)

The entry point function that replaces ReactDOM.render/hydrate with SSR support. Takes a routes array and optional configuration.

**Parameters:**
- `routes`: An array of React Router `<Route>` elements (e.g., `[<Route path="/" element={<Home />} />]`)
- `promisesOrOptions`: Either an array of promises to wait for, or an options object
- `options`: Configuration options (when using promises as the second parameter)

**Options object properties:**
- `routerProps`: Additional props to pass to the Router component (useful for injecting stores or providers)
- `contextProps`: Additional props to pass to the internal Context.Provider

#### Basic usage in your `index.js`:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import Home from './routes/Home';

// Define your routes as an array of React Router <Route> elements
const routes = [
  <Route path="/" element={<Home />} key="home" />
];

// Pass the routes array directly to run
run(routes);
```

#### Injecting additional props/providers:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { Route } from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from './store';
import Home from './routes/Home';

const routes = [
  <Route path="/" element={<Home />} key="home" />
];

// Inject the Redux store by providing a custom RouterProvider
run(routes, [], {
  routerProps: {
    // This creates a RouterProvider that will include the store
    // These props will be passed to the BrowserRouter (client) or StaticRouterProvider (server)
    children: (routerChildren) => (
      <Provider store={store}>
        {routerChildren}
      </Provider>
    )
  }
});
```

#### With React Router v7:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { redirect, Route } from "react-router-dom";
import Home from './routes/Home';
import About from './routes/About';
import Contact from './routes/Contact';

// Define your routes as an array of <Route> elements
const routes = [
  <Route path="/" element={<Home />} key="home" />,
  <Route path="/about" element={<About />} key="about" />,
  <Route 
    path="/contact" 
    element={<Contact />} 
    loader={async () => {
      // Load data needed for this route
      const data = await fetch('/api/contact-info').then(r => r.json());
      return data;
    }}
    key="contact"
  />,
  <Route 
    path="/redirect" 
    loader={() => {
      // Redirect example with status code
      return redirect("/about", 301);
    }}
    key="redirect"
  />
];

// Pass routes array to run
// IMPORTANT: routes must be an array of <Route> elements, not route configuration objects
run(routes);
```

### Server-Side Rendering with React Router v7

The library provides full support for React Router v7 SSR features including:

- **Data Loading**: Routes with loaders will have their data pre-loaded during SSR
- **Redirects**: Redirect responses from loaders are properly handled with status codes preserved
- **Static Router**: Uses the modern React Router v7 data APIs (createStaticHandler, createStaticRouter, StaticRouterProvider)

Under the hood, the implementation:

1. Creates a static handler from routes using `createStaticHandler`
2. Processes routes with `query` function to detect redirects and load data
3. Renders using `createStaticRouter` and `StaticRouterProvider`
4. Preserves HTTP status codes (301, 302, etc.) for proper SEO

This allows you to use all modern React Router features while still benefiting from server-side rendering.

With i18n support:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { Route } from "react-router-dom";
import Home from './routes/Home';
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

// Define your routes as an array of <Route> elements
const routes = [
  <Route path="/" element={<Home />} key="home" />
];

run(routes, [i18n.use(Backend).use(initReactI18next).init(i18nOpt)]);
```

### useVar(varName, defaultValue)

Hook for creating/accessing named variables which share a value anywhere in the application.

```javascript
function Counter() {
	const [count, setCount] = useVar("counter", 0);

	return (
		<div>
			Count is {count}
			<button onClick={() => setCount(count + 1)}>Increment</button>
		</div>
	);
}
```

In another component:

```javascript
function DisplayCounter() {
	const [count] = useVar("counter", 0);
	return <div>Current count: {count}</div>;
}
```

### useVarSetter(varName, defaultValue)

Returns only a setter for the given variable, without subscribing the current component to variable updates.

```javascript
function CounterControl() {
	const setCount = useVarSetter("counter", 0);
	return <button onClick={() => setCount(0)}>Reset Counter</button>;
}
```

### usePromise(promise)

Registers a promise that the server needs to wait for in SSR before rendering. Useful for ensuring data is available during server-side rendering.

```javascript
function DataComponent() {
	const [data, setData] = useState(null);
	
	useEffect(() => {
		const promise = fetchData().then(result => setData(result));
		usePromise(promise);
	}, []);
	
	return <div>{data ? JSON.stringify(data) : "Loading..."}</div>;
}
```

### useRest(path, params, noThrow, cacheLifeTime)

Performs a REST GET request to the specified path, caching the result and returning it in a way that is safe for rendering.

```javascript
function UserProfile({ userId }) {
	const [user, refreshUser] = useRest(`/api/users/${userId}`);
	
	return (
		<div>
			{user ? (
				<>
					<h2>{user.name}</h2>
					<p>{user.email}</p>
					<button onClick={refreshUser}>Refresh</button>
				</>
			) : "Loading..."}
		</div>
	);
}
```

With parameters:

```javascript
function SearchResults() {
	const [query, setQuery] = useState("");
	const [results, refreshResults] = useRest("/api/search", { q: query });
	
	return (
		<div>
			<input 
				value={query} 
				onChange={e => setQuery(e.target.value)} 
			/>
			<button onClick={refreshResults}>Search</button>
			
			{results && results.map(item => (
				<div key={item.id}>{item.title}</div>
			))}
		</div>
	);
}
```

## License

MIT