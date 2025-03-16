import React, { useState, useContext, useEffect } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMServer from 'react-dom/server';
import { BrowserRouter } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
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
 * 
 * @param {Object} ctx - The context object
 * @param {Promise} prom - The promise to register
 */
export function setPromise(ctx, prom) {
	if (!ctx.hasOwnProperty("@promises")) {
		// do not do anything if no @promises (ie. when running outside of SSR)
		return;
	}
	ctx["@promises"].add(prom);
}

/**
 * Hook to register a promise for SSR to wait on before rendering
 * Used to ensure data is available during server-side rendering
 * 
 * @param {Promise} prom - The promise to register
 */
export function usePromise(prom) {
	setPromise(useVarCtx(), prom);
}

/**
 * Creates a server-side renderer function for a given React application
 * This is used internally by the run() function for SSR mode
 * 
 * Example use: global._renderToString = makeRenderer(<App/>);
 * 
 * @param {React.ReactNode} app - The root React component
 * @param {Array<Promise>} promises - Optional array of promises to wait for
 * @returns {Function} - Renderer function that accepts a callback
 */
export function makeRenderer(app, promises) {
	return function(cbk) {
		let result = { uuid: getUuid(), initial: {} };

		let context = {};
		let varCtx = {};

		let search = "";
		let getUrlResult = getUrl();
		if (typeof getUrlResult.query !== "undefined") {
			search = "?" + getUrlResult.query;
		}

		app = React.createElement(
				Context.Provider,
				{value: varCtx},
				React.createElement(
					StaticRouter,
					{context: context, basename: getPrefix(), location: { pathname: getPrefix()+getPath(), search: search }},
					app
				)
			);

		let fin = function() {
			// handle context from StaticRouter
			if (context.status)
				result.statusCode = context.status;

			if (context.url) {
				result.redirect = context.url;
				cbk(result);
				return;
			}

			// pass values from varCtx to result.initial (only those not starting with @)
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
		};

		// let it go~~~
		let go = function() {
			varCtx["@promises"] = new Set();

			// import promises on first run (if any)
			if (promises instanceof Array) {
				for (let i = 0; i < promises.length; i++) {
					varCtx["@promises"].add(promises[i]);
				}
				promises = null;
			}

			result.app = ReactDOMServer.renderToString(app);

			if (varCtx["@promises"].size == 0) {
				// finalize process
				fin();
				return;
			}

			// we have some promises, wait and run again!
			Promise.all(varCtx["@promises"]).then(go).catch(e => { result.error = e; cbk(result); });
		};

		go();
	};
}

/**
 * Main entry point for the application
 * Replaces ReactDOM.render/hydrate with SSR support
 * 
 * @param {React.ReactNode} app - The root React component
 * @param {Array<Promise>} promises - Optional array of promises to wait for
 */
export function run(app, promises) {
	if (typeof window !== 'undefined') {
		let ctx = {};

		// initialize app for client rendering
		app = React.createElement(
				Context.Provider,
				{value: ctx},
				React.createElement(
					BrowserRouter,
					{basename: getPrefix()},
					app
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
				ReactDOM.hydrateRoot(document.getElementById('root'), app);
			} else {
				// wait for promises
				Promise.all(promises).finally(function() { 
					ReactDOM.hydrateRoot(document.getElementById('root'), app);
				});
			}
			return;
		}

		// SSR did not run, go through rendering
		if (typeof promises === 'undefined') {
			ReactDOM.createRoot(document.getElementById('root')).render(app);
		} else {
			Promise.all(promises).finally(function() { 
				ReactDOM.createRoot(document.getElementById('root')).render(app);
			});
		}
	} else {
		// we're running on server side, let the server do the work through a custom renderer
		global._renderToString = makeRenderer(app, promises);
	}
}
