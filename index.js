import {rest} from "@karpeleslab/klbfw";
import {useState} from "react";

var getGlobal = function () {
  //if (typeof self !== 'undefined') { return self; }
  if (typeof window !== 'undefined') { return window; }
  if (typeof global !== 'undefined') { return global; }
  throw new Error('unable to locate global object');
};

function runRest(restData) {
	let prom = rest(restData.path, "GET", restData.params);
	restData.promise = prom;

	prom.then((res) => {
		restData.res = {error: null, value: res};
		restData.cb.forEach((v) => v(restData.res));
	}, (err) => {
		restData.res = {error: err, value: null};
		restData.cb.forEach((v) => v(restData.res));
	});
}

function registerGet(path, params, setter) {
	var globalThis = getGlobal();
	// TODO: check if the shim for globalThis is present, if there is a risk of not, implement our own getter
	if (globalThis._useRest === undefined) {
		globalThis._useRest = {};
	}

	let paramsKey = "(null)";
	if (params) {
		if (typeof params !== "string") {
			params = JSON.stringify(params);
		}
		paramsKey = params;
	}

	if (!globalThis._useRest.hasOwnProperty(path)) {
		globalThis._useRest[path] = {};
	}
	if (globalThis._useRest[path].hasOwnProperty(paramsKey)) {
		let restData = globalThis._useRest[path][paramsKey];

		if (restData.cb.has(setter)) {
			return restData;
		}
		restData.cb.add(setter);
		setter(restData.res);
		return restData;
	}

	let restData = {
		path: path,
		params: params,
		paramsKey: paramsKey,
		cb: new Set(),
		res: null,
		refcount: 0
	};
	restData.cb.add(setter);
	globalThis._useRest[path][paramsKey] = restData;

	runRest(restData);

	return restData;
}

// this performs get requests
export const useRest = function(path, params) {
	const [v, setV] = useState(null);

	registerGet(path, params, setV);

	if (v == null) {
		return null;
	}

	if (v.error) {
		throw v.error;
	}

	return v.value;
}

// call clearAll() to reset context when doing SSR recycling
export const clearAll = function() {
	var globalThis = getGlobal();
	globalThis._useRest = {};
}

// reload result of a single endpoint
export const reloadRest = function(path, background) {
	var globalThis = getGlobal();
	if (globalThis._useRest === undefined) {
		return; // nothing to do
	}

	if (!globalThis._useRest.hasOwnProperty(path)) {
		return; // nothing to do
	}

	for(let restParamKey in globalThis._useRest[path]) {
		let restData = globalThis._useRest[path][restParamKey];
		if (restData.res === null) continue; // nothing to do (yet)

		if (background !== true) {
			// push null ("loading" state)
			restData.res = null;
			restData.cb.forEach((v) => v(restData.res));
		}

		// re-run rest
		runRest(restData);
	}
}

// wait for all requests to return
export const wait = function() {
	var globalThis = getGlobal();
	if (globalThis._useRest === undefined) {
		return Promise.all([]);
	}

	let l = [];
	for(let path in globalThis._useRest) {
		for(let restParamKey in globalThis._useRest[path]) {
			if (globalThis._useRest[path][restParamKey].res == null)
				l.push(globalThis._useRest[path][restParamKey].promise);
		}
	}

	return Promise.allSettled(l);
}

export const getInitial = function() {
	// generate initial status for SSR
	let init = {};
	var globalThis = getGlobal();
	if (globalThis._useRest === undefined) {
		return init;
	}

	for(let path in globalThis._useRest) {
		init[path] = {};
		for(let restParamKey in globalThis._useRest[path]) {
			let restData = globalThis._useRest[path][restParamKey];
			if (restData.res == null) continue; // not available yet
			init[path][restParamKey] = restData.res;
		}
	}

	return init;
}

export const setInitial = function(data) {
	// load data and set values
	var globalThis = getGlobal();
	if (globalThis._useRest === undefined) {
		globalThis._useRest = {};
	}

	for(let path in data) {
		if (!globalThis._useRest.hasOwnProperty(path))
			globalThis._useRest[path] = {};

		for(let restParamKey in data[path]) {
			let params = undefined;
			if (restParamKey !== "(null)") {
				params = restParamKey;
			}
			globalThis._useRest[path][restParamKey] = {
				path: path,
				params: params,
				paramsKey: restParamKey,
				cb: new Set(),
				res: data[path],
				promise: new Promise((a,b) => a()),
				refcount: 0
			};
		}
	}
	return true;
}
