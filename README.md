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

The entry point function that replaces ReactDOM.render/hydrate with SSR support. Takes a route configuration and optional settings.

**Parameters:**
- `routes`: A React Router route configuration created with `createRoutesFromElements` or directly as a route object
- `promisesOrOptions`: Either an array of promises to wait for, or an options object
- `options`: Configuration options (when using promises as the second parameter)

**Options object properties:**
- `routerProps`: Additional props to pass to the Router component (useful for injecting stores or providers)
- `contextProps`: Additional props to pass to the internal Context.Provider

#### Basic usage in your `index.js`:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { Route, createRoutesFromElements } from "react-router-dom";
import Home from './routes/Home';

// Create routes with the Data Router API
const routes = createRoutesFromElements(
  <Route path="/" element={<Home />} />
);

// Pass the routes to run
run(routes);
```

#### Injecting additional props/providers:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { Route, createRoutesFromElements } from "react-router-dom";
import { Provider } from 'react-redux';
import { store } from './store';
import Home from './routes/Home';

// Create routes
const routes = createRoutesFromElements(
  <Route path="/" element={<Home />} />
);

// Inject the Redux store by providing custom router props
run(routes, {
  routerProps: {
    // These props will be passed to the RouterProvider (client) or StaticRouterProvider (server)
    fallbackElement: <div>Loading...</div>,
    future: {
      v7_startTransition: true
    }
  },
  contextProps: {
    // You can also wrap the entire app with providers using React.createElement in your index.js
    // This is an alternative approach for global store/provider setup
  }
});
```

#### With React Router v7:

```javascript
import { run } from "@karpeleslab/react-klbfw-hooks";
import { redirect, Route, createRoutesFromElements } from "react-router-dom";
import Home from './routes/Home';
import About from './routes/About';
import Contact from './routes/Contact';

// Create routes
const routes = createRoutesFromElements(
  <>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route 
      path="/contact" 
      element={<Contact />} 
      loader={async () => {
        // Load data needed for this route
        const data = await fetch('/api/contact-info').then(r => r.json());
        return data;
      }}
    />
    <Route 
      path="/redirect" 
      loader={() => {
        // Redirect example with status code
        return redirect("/about", 301);
      }}
    />
  </>
);

// Pass routes to run
run(routes);
```

### Server-Side Rendering with React Router v7

The library provides full support for React Router v7 SSR features including:

- **Data Loading**: Routes with loaders will have their data pre-loaded during SSR
- **Redirects**: Redirect responses from loaders are properly handled with status codes preserved
- **Data Router API**: Uses the modern React Router v7 data APIs (createBrowserRouter, createStaticHandler, createStaticRouter, RouterProvider, StaticRouterProvider)

Under the hood, the implementation:

1. On the client: Creates a browser router from routes using `createBrowserRouter`
2. On the server: Creates a static handler from routes using `createStaticHandler`
3. Processes routes with `query` function to detect redirects and load data
4. Renders using `createStaticRouter` and `StaticRouterProvider` for SSR
5. Preserves HTTP status codes (301, 302, etc.) for proper SEO

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