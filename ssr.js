import React, { useState, useContext, useEffect } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import * as ReactDOMServer from 'react-dom/server';
import { createBrowserRouter, createStaticHandler, createStaticRouter, RouterProvider, StaticRouterProvider } from "react-router-dom";
import { getPrefix, getUuid, getPath, getUrl, getInitialState } from "@karpeleslab/klbfw";
import { Helmet } from "react-helmet";

/**
 * Context for the shared variable system
 * This is used internally by all hooks to maintain shared state
 */
export const Context = React.createContext({});
Context.displayName = "Context";

/**
 * Creates/accesses a named variable with shared state across components
 * 
 * useVar works similar to useState() except:
 * - All vars with the same name will share the same value
 * - Values will be passed to the client mode when running in SSR, so avoid storing stuff that is not JSON friendly
 * - Setter will always be the same object for a given variable
 * - Special case: variable names starting with a "@" will not be passed to client
 * 
 * @param {string} varName - The name of the shared variable
 * @param {any} defaultValue - Default value if the variable doesn't exist yet
 * @returns {Array} - [value, setter] tuple similar to useState
 */
export function useVar(varName, defaultValue) {
	const ctx = useContext(Context);

	// generate state
	const [v, setV] = useState({key: varName});

	if (v.key != varName) {
		// remove from old var
		if (ctx.hasOwnProperty(v.key)) {
			ctx[v.key].subscribers.delete(setV);
		}

		v.key = varName; // update value without re-render
	}

	if (!ctx.hasOwnProperty(varName)) {
		ctx[varName] = {
			value: defaultValue,
			subscribers: new Set(),
			setter: newVal => {
				ctx[varName].value = newVal;
				ctx[varName].subscribers.forEach(cb => cb({key: varName, newVal: newVal}));
			}
		};
	}

	// add setV to subscribers now
	ctx[varName].subscribers.add(setV);

	// set cleanup to remove setV from subscribers
	useEffect(() => {
		return () => {
			ctx[varName].subscribers.delete(setV);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return [ctx[varName].value, ctx[varName].setter];
}

/**
 * Internal helper function to get or create a variable setter in a context
 * 
 * @param {Object} ctx - The context object
 * @param {string} varName - The name of the shared variable
 * @param {any} defaultValue - Default value if the variable doesn't exist yet
 * @returns {Array} - [value, setter] tuple
 */
export function getVarSetter(ctx, varName, defaultValue) {
	if (!ctx.hasOwnProperty(varName)) {
		ctx[varName] = {
			value: defaultValue,
			subscribers: new Set(),
			setter: newVal => {
				ctx[varName].value = newVal;
				ctx[varName].subscribers.forEach(cb => cb({key: varName, newVal: newVal}));
			}
		};
	}

	return [ctx[varName].value, ctx[varName].setter];
}

/**
 * Returns only a setter for a named variable, without subscribing to updates
 * 
 * @param {string} varName - The name of the shared variable
 * @param {any} defaultValue - Default value if the variable doesn't exist yet
 * @returns {Function} - Setter function for the named variable
 */
export function useVarSetter(varName, defaultValue) {
	const ctx = useContext(Context);
	const [, setValue] = getVarSetter(ctx, varName, defaultValue);

	return setValue;
}

/**
 * Returns the current context object for direct access
 * 
 * @returns {Object} - The current context object
 */
export function useVarCtx() {
	return useContext(Context);
}

/**
 * Registers a promise for SSR to wait on before rendering
 * @deprecated This function is kept for backwards compatibility only. Promises are now handled directly by React Router.
 * 
 * @param {Object} ctx - The context object
 * @param {Promise} prom - The promise to register
 */
export function setPromise(ctx, prom) {
	// No-op function kept for backward compatibility
	return;
}

/**
 * Hook to register a promise for SSR to wait on before rendering
 * @deprecated This hook is kept for backwards compatibility only. Promises are now handled directly by React Router Data APIs.
 * 
 * @param {Promise} prom - The promise to register
 */
export function usePromise(prom) {
	// No-op function kept for backward compatibility
	return;
}

// Helper function to create a fetch request from our internal URL format
function createFetchRequest(url, query) {
	// Create headers similar to what a real request would have
	const headers = new Headers();
	headers.append("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
	
	// Create a request object that mimics what fetch would use
	return new Request(`${url}${query ? `?${query}` : ""}`, {
		method: "GET",
		headers: headers,
		redirect: "manual" // Important to handle redirects ourselves
	});
}

/**
 * Creates a server-side renderer function for a given application routes
 * This is used internally by the run() function for SSR mode
 * 
 * Example use: global._renderToString = makeRenderer(routes);
 * 
 * @param {Array} routes - The route configuration for React Router
 * @param {Array<Promise>} promises - Optional array of promises to wait for
 * @param {Object} options - Optional configuration options
 * @param {Object} options.routerProps - Additional props to pass to the StaticRouterProvider
 * @returns {Function} - Renderer function that accepts a callback
 */
export function makeRenderer(routes, promises, options = {}) {
	return async function(cbk) {
		let result = { uuid: getUuid(), initial: {} };

		let varCtx = {};
		
		// Get URL information from klbfw
		const pathname = getPrefix() + getPath();
		const getUrlResult = getUrl();
		const search = typeof getUrlResult.query !== "undefined" ? getUrlResult.query : "";
		
		try {
			// Create a static handler from the routes
			const { query } = createStaticHandler(routes);
			
			// Construct the full URL with scheme and host
			const scheme = getUrlResult.scheme || 'https';
			const host = getUrlResult.host || 'localhost';
			const fullUrl = `${scheme}://${host}${pathname}`;
			
			// Create a fetch request from the current URL
			const fetchRequest = createFetchRequest(fullUrl, search);
			
			// Run the query to get data and check for redirects
			const context = await query(fetchRequest);
			
			// Check if the context is a Response (which could be a redirect)
			if (context instanceof Response) {
				// Check if it's a redirect status code
				if ([301, 302, 303, 307, 308].includes(context.status)) {
					// This is a redirect - set properties and return
					result.redirect = context.headers.get("Location");
					result.statusCode = context.status;
					cbk(result);
					return;
				}
			}
			
			// If no redirect, create a static router with the data context
			const router = createStaticRouter(routes, context);
			
			// Create the app with our Context provider and StaticRouterProvider
			// Merge any additional router props from options
			const routerProps = {
				router: router,
				context: context,
				...(options.routerProps || {})
			};
			
			const app = React.createElement(
				Context.Provider,
				{value: varCtx},
				React.createElement(
					StaticRouterProvider, 
					routerProps
				)
			);
			
			try {
				// Handle initial promises if needed (for backward compatibility)
				if (promises instanceof Array && promises.length > 0) {
					try {
						// Wait for promises with a timeout
						await Promise.race([
							Promise.all(promises),
							new Promise((_, reject) => 
								setTimeout(() => reject(new Error('Promise timeout after 10 seconds')), 10000)
							)
						]);
					} catch (promiseError) {
						console.error('Error resolving server-side promises:', promiseError);
						// Continue rendering even if promises fail
					}
				}
				
				// Render the application using ReactDOMServer
				result.app = ReactDOMServer.renderToString(app);
				
				// pass values from varCtx to result.initial (skipping internal vars)
				for(let varName in varCtx) {
					if (varName.charAt(0) === "@") continue;
					result.initial[varName] = varCtx[varName].value;
				}
				
				// grab helmet data
				Helmet.canUseDOM = false;
				const helmet = Helmet.renderStatic();
				
				result.title = helmet.title ? helmet.title.toString() : null;
				result.meta = helmet.meta ? helmet.meta.toString() : null;
				result.script = helmet.script ? helmet.script.toString() : null;
				result.link = helmet.link ? helmet.link.toString() : null;
				result.bodyAttributes = helmet.bodyAttributes ? helmet.bodyAttributes.toString() : null;
				result.htmlAttributes = helmet.htmlAttributes ? helmet.htmlAttributes.toString() : null;
				
				cbk(result);
			} catch (error) {
				result.error = error;
				cbk(result);
			}
			
		} catch (error) {
			// Handle any errors during the process
			result.error = error;
			cbk(result);
		}
	};
}

/**
 * Main entry point for the application
 * Replaces ReactDOM.render/hydrate with SSR support
 * 
 * @param {Object} routes - A React Router routes configuration object
 * @param {Array<Promise>|Object} promisesOrOptions - Optional array of promises to wait for, or options object
 * @param {Object} [options] - Optional configuration options
 * @param {Object} [options.routerProps] - Additional props to pass to the Router component
 * @param {Object} [options.contextProps] - Additional props to pass to the Context.Provider
 */
export function run(routes, promisesOrOptions, options) {
	// Handle different parameter combinations
	let promises;
	let opts = {};
	
	// Check if promisesOrOptions is an array of promises or an options object
	if (Array.isArray(promisesOrOptions)) {
		promises = promisesOrOptions;
		opts = options || {};
	} else if (typeof promisesOrOptions === 'object' && promisesOrOptions !== null) {
		opts = promisesOrOptions || {};
	}
	
	if (typeof window !== 'undefined') {
		let ctx = {};
		
		// Get router props from options
		const routerProps = {
			basename: getPrefix(),
			...(opts.routerProps || {})
		};
		
		// Get context props from options
		const contextProps = {
			value: ctx,
			...(opts.contextProps || {})
		};
		
		// Create a browser router with the routes
		const router = createBrowserRouter(routes, {
			basename: getPrefix(),
			...(opts.routerProps || {})
		});

		// initialize app for client rendering with route configuration
		const app = React.createElement(
			Context.Provider,
			contextProps,
			React.createElement(
				RouterProvider,
				{ router }
			)
		);

		// read getInitialState()
		let init = getInitialState();

		if (typeof init === "object") {
			for(let varName in init) {
				ctx[varName] = {
					value: init[varName],
					subscribers: new Set(),
					setter: newVal => {
						ctx[varName].value = newVal;
						ctx[varName].subscribers.forEach(cb => cb({key: varName, newVal: newVal}));
					}
				};
			}

			if (typeof promises === 'undefined') {
				hydrateRoot(document.getElementById('root'), app);
			} else {
				// wait for promises with error handling and timeout
				Promise.race([
					Promise.all(promises),
					new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
				])
				.then(
					() => hydrateRoot(document.getElementById('root'), app),
					(error) => {
						console.error('Error resolving promises:', error);
						hydrateRoot(document.getElementById('root'), app);
					}
				);
			}
			return;
		}

		// SSR did not run, go through rendering
		if (typeof promises === 'undefined') {
			createRoot(document.getElementById('root')).render(app);
		} else {
			// wait for promises with error handling and timeout
			Promise.race([
				Promise.all(promises),
				new Promise(resolve => setTimeout(resolve, 10000)) // 10 second timeout
			])
			.then(
				() => createRoot(document.getElementById('root')).render(app),
				(error) => {
					console.error('Error resolving promises:', error);
					createRoot(document.getElementById('root')).render(app);
				}
			);
		}
	} else {
		// we're running on server side, let the server do the work through a custom renderer
		global._renderToString = makeRenderer(routes, promises, opts);
	}
}