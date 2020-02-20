import {rest} from "@karpeleslab/klbfw";
import {useVar, setPromise, useVarCtx, getVarSetter} from "./ssr";

// this performs get requests
export function useRest(path, params, noThrow) {
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
			set: setV
		};
		ctxRest[path+"?"+params] = restData;

		restData.refresh = (value) => {
			if (typeof value === "object") {
				restData.set({value: value});
				return;
			}
			let prom = rest(restData.path, "GET", restData.params);

			prom.then(res => restData.set({value: res})).catch(e => restData.set({error: e}));

			if (value !== true) {
				restData.set(null);
			}
			return prom;
		};

		// only trigget API call if we do not have a value yet
		if (v == null) {
			setPromise(ctx, restData.refresh());
		}
	} else {
		restData = ctxRest[path+"?"+params];
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

// this performs get requests
export function useRestRefresh(path, params) {
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
			set: setV
		};
		ctxRest[path+"?"+params] = restData;

		restData.refresh = (value) => {
			if (typeof value === "object") {
				restData.set({value: value});
				return;
			}
			let prom = rest(restData.path, "GET", restData.params);

			prom.then(res => restData.set({value: res})).catch(e => restData.set({error: e}));

			if (value !== true) {
				restData.set(null);
			}
			return prom;
		};

		// only trigget API call if we do not have a value yet
		if (v == null) {
			setPromise(ctx, restData.refresh());
		}
	} else {
		restData = ctxRest[path+"?"+params];
	}

	return restData.refresh;
}
