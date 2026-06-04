// Re-exports the real React but replaces `cache` with an identity wrapper so
// cache()-wrapped fetchers run outside a React render context. The loader maps
// bare "react" here; we pull the real module by its absolute node_modules path
// to avoid recursing back through the alias hook.
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const realUrl = pathToFileURL(
  resolvePath(process.cwd(), "node_modules/react/index.js")
).href;
const React = (await import(realUrl)).default ?? (await import(realUrl));

export const cache = (fn) => fn;
export default React;
export const {
  useState, useEffect, useRef, useMemo, useCallback, useContext,
  createContext, createElement, Fragment, Children, forwardRef, memo,
} = React;
