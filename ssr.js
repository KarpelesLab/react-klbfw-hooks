import React, { useState, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { renderToString } from 'react-dom/server';
import { BrowserRouter, StaticRouter } from "react-router-dom";
import { getPrefix, getUuid, getPath, getUrl, getInitialState } from "@karpeleslab/klbfw";
import { Helmet } from "react-helmet";

export const Context = React.createContext({});
Context.displayName = "Context";

// useVar works similar to setState() except:
// - all vars with the same name will share the same value
// - values will be passed to the client mode when running in SSR, so avoid storing stuff that is not json friendly in there (instances, etc)
// - setter will always be the same object for a given variable
// - special case: variable maes starting with a "@" will not be passed to client
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

export function useVarSetter(varName, defaultValue) {
	const ctx = useContext(Context);
	const [, setValue] = getVarSetter(ctx, varName, defaultValue);

	return setValue;
}

export function useVarCtx() {
	return useContext(Context);
}

// setPromise will register a given promise to be known
export function setPromise(ctx, prom) {
	if (!ctx.hasOwnProperty("@promises")) {
		// do not do anything if no @promises (ie. when running outside of SSR)
		return;
	}
	ctx["@promises"].add(prom);
}

// usePromise regs a promise for wait in ssr mode
export function usePromise(prom) {
	setPromise(useVarCtx(), prom);
}

// this function will return a ssr renderer for a given root component.
// example use: global._renderToString = makeRenderer(<App/>);
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

			result.app = renderToString(app);

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
				ReactDOM.hydrate(app, document.getElementById('root'));
			} else {
				// wait for promises
				Promise.all(promises).finally(function() { ReactDOM.hydrate(app, document.getElementById('root')); });
			}
			return;
		}

		// SSR did not run, go through rendering
		if (typeof promises === 'undefined') {
			ReactDOM.render(app, document.getElementById('root'));
		} else {
			Promise.all(promises).finally(function() { ReactDOM.render(app, document.getElementById('root')); });
		}
	} else {
		// we're running on server side, let the server do the work through a custom renderer
		global._renderToString = makeRenderer(app, promises);
	}
}
