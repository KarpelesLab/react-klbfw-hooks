// Type definitions for @karpeleslab/react-klbfw-hooks
// Project: https://github.com/KarpelesLab/react-klbfw-hooks
// Definitions by: Jeremy Vinai <https://github.com/jvinai>
// TypeScript Version: 3.9.7

declare module '@karpeleslab/react-klbfw-hooks';

import { Context } from "react";

// ssr
export function useVar<T>(varName: string, defaultValue: T): [T, (newValue: T) =>  void];
export function useVarCtx<T>(): T;
export function useVarSetter<T>(varName: string, defaultValue: T): (newValue: T) =>  void;
export function usePromise(prom: Promise<any>):  void;
export function setPromise<T>(ctx: Context<T>,prom: Promise<any>):  void;
export function run(routesOrApp: any, promises?: Array<Promise<any>>):  void;

// rest

export function useRest<T>(path: string, params?: string | {[paramKey: string]: any}, noThrow? :boolean, cacheLifeTime?: number): [T, (value: T) => Promise<T>];
export function useRestRefresh<T>(path: string, params?: string | {[paramKey: string]: any}, cacheLifeTime?: number): (value: T) => Promise<T>;
export function useRestResetter(): () => void;
