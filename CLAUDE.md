# React KLBFW Hooks

## Build Commands
- No test script is specified in package.json
- To install dependencies: `npm install`
- To publish package: `npm publish`

## Project Structure
- A lightweight React hooks library for [klbfw](https://github.com/KarpelesLab/klbfw)
- Main exports: `useVar`, `useRest`, `usePromise`, `run`
- Works with React 16.12.0 and above

## Code Style Guidelines
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Formatting**: 
  - Use tabs for indentation
  - No semicolon required at end of statements
  - Use single quotes for strings
- **Exports**: Named exports preferred over default exports
- **Error Handling**: Errors from REST calls are thrown unless `noThrow` is specified
- **Component Pattern**: Functional components with hooks
- **Types**: TypeScript definitions available in index.d.ts
- **Framework**: Works with react-router-dom and provides SSR capabilities