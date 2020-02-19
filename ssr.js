import React, { useState, useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { renderToString } from 'react-dom/server';
import { BrowserRouter, StaticRouter } from "react-router-dom";
import { getPrefix, getUuid, getUrl, getInitialState } from "@karpeleslab/klbfw";

export const Context = React.createContext({});
Context.displayName = "Context";

// useVar works similar to setState() except:
// - all vars with the same name will share the same value
// - values will be passed to the client mode when running in SSR, so avoid storing stuff that is not json friendly in there (instances, etc)
// - setter will always be the same object for a given variable
// - special case: variable maes starting with a "@" will not be passed to client
export function useVar(varName, defaultValue) {
	const ctx = useContext(Context);

	// if we already know this value, force default to it so we do not have to re-render
	if (ctx.hasOwnProperty(varName)) {
		defaultValue = ctx[varName].value;
	}

	// generate state
	const [v, setV] = useState(defaultValue);

	if (!ctx.hasOwnProperty(varName)) {
		ctx[varName] = {
			value: v,
			subscribers: new Set(),
			setter: newVal => {
				ctx[varName].value = newVal;
				ctx[varName].subscribers.forEach(cb => cb(newVal));
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

	return [v, ctx[varName].setter];
}

export function useVarCtx() {
	return useContext(Context);
}

// setPromise will register a given promise to be known
export function setPromise(ctx, prom) {
	if (!ctx.hasOwnProperty("@promises")) {
		ctx["@promises"] = new Set();
	}
	ctx["@promises"].add(prom);
}

// this function will return a ssr renderer for a given root component.
// example use: global._renderToString = makeRenderer(<App/>);
export function makeRenderer(app) {
	return function(cbk) {
		let result = { uuid: getUuid(), initial: {} };

		try {
			let context = {};
			let varCtx = {};

			result.app = renderToString(
				<Context.Provider value={varCtx}>
					<StaticRouter context={context} basename={getPrefix()} location={getUrl().full}>
						{app}
					</StaticRouter>
				</Context.Provider>
			);

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

			// grab helmet if available
			try {
				const Helmet = require("react-helmet").Helmet;
				Helmet.canUseDOM = false;
				const helmet = Helmet.renderStatic();

				result.title = helmet.title ? helmet.title.toString() : null;
				result.meta = helmet.meta ? helmet.meta.toString() : null;
				result.script = helmet.script ? helmet.script.toString() : null;
				result.link = helmet.link ? helmet.link.toString() : null;
				result.bodyAttributes = helmet.bodyAttributes ? helmet.bodyAttributes.toString() : null;
				result.htmlAttributes = helmet.htmlAttributes ? helmet.htmlAttributes.toString() : null;

				cbk(result);
			} catch(e) {
				// ignore
			}
		} catch(e) {
			result.error = e;
			cbk(result);
		}
	};
}

export function run(app) {
	if (typeof window !== 'undefined') {
		let ctx = {};

		// initialize app for client rendering
		app = (
			<Context.Provider value={ctx}>
				<BrowserRouter basename={getPrefix()}>
					{app}
				</BrowserRouter>
			</Context.Provider>
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
						ctx[varName].subscribers.forEach(cb => cb(newVal));
					}
				};
			}

			ReactDOM.hydrate(app, document.getElementById('root'));
			return;
		}

		// SSR did not run, go through rendering
		ReactDOM.render(app, document.getElementById('root'));
	} else {
		// we're running on server side, let the server do the work through a custom renderer
		global._renderToString = makeRenderer(app);
	}
}
