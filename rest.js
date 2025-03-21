import {rest} from "@karpeleslab/klbfw";
import {useVar, setPromise, useVarCtx, getVarSetter} from "./ssr";

/**
 * Hook to fetch data from the REST API with caching and SSR support
 * 
 * @param {string} path - API endpoint path
 * @param {string|object} params - Query parameters as string or object
 * @param {boolean} noThrow - If true, doesn't throw errors but returns [false, refresh]
 * @param {number} cacheLifeTime - Optional cache lifetime in milliseconds
 * @returns {Array} - [data, refreshFunction] tuple
 */
export function useRest(path, params, noThrow, cacheLifeTime) {
	// ensure params is a string
	switch(typeof params) {
	case "string":
		break;
	case "undefined":
		params = "";
		break;
	default:
		params = JSON.stringify(params);
	}

	const [v, setV] = useVar(path+"?"+params, null);

	const ctx = useVarCtx();
	if (!ctx.hasOwnProperty("@rest")) {
		ctx["@rest"] = {};
	}
	const ctxRest = ctx["@rest"];

	let restData = null;

	if (!ctxRest.hasOwnProperty(path+"?"+params)) {
		restData = {
			path: path,
			params: params,
			set: setV,
			time: undefined,
		};
		ctxRest[path+"?"+params] = restData;

		restData.refresh = (value) => {
			if (typeof value === "object") {
				restData.set({value: value});
				return;
			}

			let prom = rest(restData.path, "GET", restData.params);

			prom
				.then(res => restData.set({value: res}))
				.catch(e => restData.set({error: e}))
				.finally(() => restData.time = new Date().getTime());

			if (value !== true) {
				restData.set(null);
			}
			return prom;
		};

		// only trigger API call if we do not have a value yet or we provide a cacheLifeTime
		const cacheLifeTimeReached = (cacheLifeTime && restData.time && ((new Date().getTime()) - restData.time) > cacheLifeTime)
		if (v == null || cacheLifeTimeReached) {
			restData.time = undefined;
			setPromise(ctx, restData.refresh());
		}
	} else {
		restData = ctxRest[path+"?"+params];
		const cacheLifeTimeReached = (cacheLifeTime && restData.time && (new Date().getTime() - restData.time) > cacheLifeTime)
		if (cacheLifeTimeReached) {
			restData.time = undefined;
			setPromise(ctx, restData.refresh());
		}
	}

	if (v == null) {
		return [null, restData.refresh];
	}

	if (v.error) {
		if (noThrow === true) {
			// this is used so that refresh() can be accessed
			return [false, restData.refresh];
		}
		throw v.error;
	}

	return [v.value, restData.refresh];
}

/**
 * Returns only the refresh function for a REST endpoint without subscribing to updates
 * 
 * @param {string} path - API endpoint path
 * @param {string|object} params - Query parameters as string or object
 * @param {number} cacheLifeTime - Optional cache lifetime in milliseconds
 * @returns {Function} - Refresh function that returns a Promise
 */
export function useRestRefresh(path, params, cacheLifeTime) {
	// ensure params is a string
	switch(typeof params) {
	case "string":
		break;
	case "undefined":
		params = "";
		break;
	default:
		params = JSON.stringify(params);
	}

	const ctx = useVarCtx();
	const [v, setV] = getVarSetter(ctx, path+"?"+params, null);

	if (!ctx.hasOwnProperty("@rest")) {
		ctx["@rest"] = {};
	}
	const ctxRest = ctx["@rest"];

	let restData = null;

	if (!ctxRest.hasOwnProperty(path+"?"+params)) {
		restData = {
			path: path,
			params: params,
			set: setV,
			time: undefined,
		};
		ctxRest[path+"?"+params] = restData;

		restData.refresh = (value) => {
			if (typeof value === "object") {
				restData.set({value: value});
				return;
			}
			let prom = rest(restData.path, "GET", restData.params);

			prom
				.then(res => restData.set({value: res}))
				.catch(e => restData.set({error: e}))
				.finally(() => restData.time = new Date().getTime());

			if (value !== true) {
				restData.set(null);
			}
			return prom;
		};

		// only trigget API call if we do not have a value yet
		const cacheLifeTimeReached = (cacheLifeTime && restData.time && ((new Date().getTime()) - restData.time) > cacheLifeTime)
		if (v == null || cacheLifeTimeReached) {
			restData.time = undefined;
			setPromise(ctx, restData.refresh());
		}
	} else {
		restData = ctxRest[path+"?"+params];
		const cacheLifeTimeReached = (cacheLifeTime && restData.time && ((new Date().getTime()) - restData.time) > cacheLifeTime)
		if (cacheLifeTimeReached) {
			restData.time = undefined;
			setPromise(ctx, restData.refresh());
		}
	}

	return restData.refresh;
}

/**
 * Returns a function that clears all REST API cache
 * Useful for scenarios like logout where you want to reset all cached data
 * 
 * @returns {Function} - Function that clears all REST cache when called
 */
export function useRestResetter() {
	const ctx = useVarCtx();

	return () => {
		if (!ctx.hasOwnProperty("@rest")) return; // no rest

		const oldRest = ctx["@rest"];
		ctx["@rest"] = {};

		// trigger state erasure everywhere
		for(let k in oldRest) {
			oldRest[k].set(null);
		}
	};
}
