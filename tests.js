// Example and test for react-klbfw-hooks with React Router DOM v7
const React = require("react");
const { redirect } = require("react-router-dom");
const { createRoutesFromElements, Route } = require("react-router-dom");
const { Helmet } = require("react-helmet");

// Define React components without JSX
function Home() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Helmet, null, 
      React.createElement("title", null, "Home Page"),
      React.createElement("meta", { name: "description", content: "Welcome to the home page!" })
    ),
    React.createElement("h1", null, "Home"),
    React.createElement("p", null, "Welcome to react-klbfw-hooks!")
  );
}

function About() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Helmet, null, 
      React.createElement("title", null, "About Us"),
      React.createElement("meta", { name: "description", content: "About react-klbfw-hooks" })
    ),
    React.createElement("h1", null, "About"),
    React.createElement("p", null, "This library provides React hooks for KarpelesLab Framework.")
  );
}

// Define routes with a loader that redirects
const routes = createRoutesFromElements(
  React.createElement(React.Fragment, null,
    React.createElement(Route, { path: "/", element: React.createElement(Home) }),
    React.createElement(Route, { path: "/about", element: React.createElement(About) }),
    React.createElement(Route, { path: "/redirect", loader: () => redirect("/about", 301) })
  )
);

// Mock klbfw functions for testing
global.getUuid = () => 'test-uuid-123';
global.getPrefix = () => '';
global.getPath = () => '/test';
global.getUrl = () => ({ 
  query: '',
  host: 'example.com',
  scheme: 'https'
});
global.getInitialState = () => ({});

module.exports = {
  routes,
  Home,
  About
};